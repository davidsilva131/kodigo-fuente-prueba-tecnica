import { Router } from 'express';
import type { DbPool } from '../db.js';
import { HttpError } from '../errors.js';
import { transitionError } from '../stateMachine.js';
import type { Status } from '../types.js';
import {
  createPromotionSchema,
  statusUpdateSchema,
  updatePromotionSchema,
} from '../validation.js';

const LIST_SQL = `
  SELECT p.*, COALESCE(pr.name, c.name) AS target_name
  FROM promotions p
  LEFT JOIN products pr  ON p.target_type = 'product'  AND pr.id = p.target_id
  LEFT JOIN categories c ON p.target_type = 'category' AND c.id = p.target_id
  ORDER BY p.created_at DESC, p.id DESC
`;

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'ID inválido');
  }
  return id;
}

export function promotionsRouter(pool: DbPool): Router {
  const router = Router();

  const findPromotion = async (id: number) => {
    const { rows } = await pool.query('SELECT * FROM promotions WHERE id = $1', [id]);
    return rows[0] ?? null;
  };

  const assertTargetExists = async (type: 'product' | 'category', id: number) => {
    const table = type === 'product' ? 'products' : 'categories';
    const { rows } = await pool.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
    if (rows.length === 0) {
      const who = type === 'product' ? 'El producto' : 'La categoría';
      throw new HttpError(400, `${who} con id ${id} no existe`);
    }
  };

  // Listar todas las promociones con sus datos principales
  router.get('/api/promotions', async (_req, res, next) => {
    try {
      const { rows } = await pool.query(LIST_SQL);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  // Vista de resumen: contadores por estado + vigentes hoy
  router.get('/api/promotions/summary', async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        'SELECT status, COUNT(*)::int AS count FROM promotions GROUP BY status',
      );
      const byStatus: Record<Status, number> = { scheduled: 0, active: 0, finished: 0 };
      for (const r of rows) {
        byStatus[r.status as Status] = r.count;
      }
      const { rows: vigentes } = await pool.query(
        'SELECT COUNT(*)::int AS count FROM promotions WHERE starts_at <= now() AND ends_at >= now()',
      );
      res.json({ ...byStatus, valid_today: vigentes[0].count });
    } catch (err) {
      next(err);
    }
  });

  // Crear una promoción (estado inicial: Programada)
  router.post('/api/promotions', async (req, res, next) => {
    try {
      const data = createPromotionSchema.parse(req.body);
      await assertTargetExists(data.target_type, data.target_id);
      const { rows } = await pool.query(
        `INSERT INTO promotions
           (name, target_type, target_id, discount_type, discount_value, starts_at, ends_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
         RETURNING *`,
        [
          data.name,
          data.target_type,
          data.target_id,
          data.discount_type,
          data.discount_value,
          data.starts_at,
          data.ends_at,
        ],
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // Editar una promoción (no permitido si está Finalizada)
  router.patch('/api/promotions/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const promo = await findPromotion(id);
      if (!promo) {
        throw new HttpError(404, 'Promoción no encontrada');
      }
      if (promo.status === 'finished') {
        throw new HttpError(409, 'Una promoción Finalizada no puede modificarse');
      }
      const data = updatePromotionSchema.parse(req.body);
      if (Object.keys(data).length === 0) {
        throw new HttpError(400, 'No se enviaron campos para actualizar');
      }
      const targetBoth = (data.target_type !== undefined) === (data.target_id !== undefined);
      if (!targetBoth) {
        throw new HttpError(400, 'target_type y target_id deben enviarse juntos');
      }
      if (data.target_type && data.target_id !== undefined) {
        await assertTargetExists(data.target_type, data.target_id);
      }
      const { rows } = await pool.query(
        `UPDATE promotions SET
           name          = COALESCE($2, name),
           target_type   = COALESCE($3, target_type),
           target_id     = COALESCE($4, target_id),
           discount_type = COALESCE($5, discount_type),
           discount_value= COALESCE($6, discount_value),
           starts_at     = COALESCE($7, starts_at),
           ends_at       = COALESCE($8, ends_at)
         WHERE id = $1
         RETURNING *`,
        [
          id,
          data.name ?? null,
          data.target_type ?? null,
          data.target_id ?? null,
          data.discount_type ?? null,
          data.discount_value ?? null,
          data.starts_at ?? null,
          data.ends_at ?? null,
        ],
      );
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // Cambiar estado: Programada → Activa → Finalizada (solo siguiente estado)
  router.patch('/api/promotions/:id/status', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const { status: to } = statusUpdateSchema.parse(req.body);
      const promo = await findPromotion(id);
      if (!promo) {
        throw new HttpError(404, 'Promoción no encontrada');
      }
      const reason = transitionError(promo.status as Status, to);
      if (reason) {
        throw new HttpError(409, reason);
      }
      const { rows } = await pool.query(
        'UPDATE promotions SET status = $2 WHERE id = $1 RETURNING *',
        [id, to],
      );
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // Eliminar una promoción (solo si está Programada)
  router.delete('/api/promotions/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const promo = await findPromotion(id);
      if (!promo) {
        throw new HttpError(404, 'Promoción no encontrada');
      }
      if (promo.status !== 'scheduled') {
        throw new HttpError(409, 'Solo se puede eliminar una promoción en estado Programada');
      }
      await pool.query('DELETE FROM promotions WHERE id = $1', [id]);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}