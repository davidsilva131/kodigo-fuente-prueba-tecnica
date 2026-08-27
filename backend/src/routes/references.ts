import { Router } from 'express';
import type { DbPool } from '../db.js';

/** Catálogo de categorías y productos para los formularios del frontend. */
export function referencesRouter(pool: DbPool): Router {
  const router = Router();

  router.get('/api/references', async (_req, res, next) => {
    try {
      const [categories, products] = await Promise.all([
        pool.query('SELECT id, name FROM categories ORDER BY name'),
        pool.query(
          `SELECT p.id, p.name, p.category_id, c.name AS category_name
           FROM products p
           JOIN categories c ON c.id = p.category_id
           ORDER BY p.name`,
        ),
      ]);
      res.json({ categories: categories.rows, products: products.rows });
    } catch (err) {
      next(err);
    }
  });

  return router;
}