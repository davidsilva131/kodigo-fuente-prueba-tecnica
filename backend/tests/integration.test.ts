import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { databaseUrl, loadConfig } from '../src/config';
import { createPool, type DbPool } from '../src/db';
import { runMigrations } from '../src/migrate';

let pool: DbPool;
let app: ReturnType<typeof createApp>;

const DAY = 86_400_000;
const days = (n: number) => new Date(Date.now() + n * DAY).toISOString();

function makePromo(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Promo test',
    target_type: 'product',
    target_id: 1,
    discount_type: 'percent',
    discount_value: 15,
    starts_at: days(1),
    ends_at: days(7),
    ...overrides,
  };
}

beforeAll(async () => {
  const config = loadConfig();
  pool = createPool(databaseUrl(config));
  await runMigrations(pool);
  app = createApp(pool, config);
});

beforeEach(async () => {
  await pool.query('TRUNCATE promotions, products, categories RESTART IDENTITY CASCADE');
  await pool.query("INSERT INTO categories (id, name) VALUES (1, 'Bebidas'), (2, 'Snacks')");
  await pool.query(
    "INSERT INTO products (id, name, category_id) VALUES (1, 'Café', 1), (2, 'Agua', 1)",
  );
});

afterAll(async () => {
  await pool.end();
});

describe('migraciones', () => {
  it('son idempotentes: no re-aplican sobre una base ya migrada', async () => {
    const applied = await runMigrations(pool);
    expect(applied).toEqual([]);
  });
});

describe('POST /api/promotions', () => {
  it('crea una promoción en estado Programada', async () => {
    const res = await request(app).post('/api/promotions').send(makePromo());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Promo test', status: 'scheduled', discount_value: '15.00' });
  });

  it('rechaza 400 si falta el nombre', async () => {
    const res = await request(app).post('/api/promotions').send(makePromo({ name: '' }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.some((d: { path: string }) => d.path === 'name')).toBe(true);
  });

  it('rechaza 400 si la fecha de fin no es posterior a la de inicio', async () => {
    const res = await request(app)
      .post('/api/promotions')
      .send(makePromo({ ends_at: days(0) }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.some((d: { path: string }) => d.path === 'ends_at')).toBe(true);
  });

  it('rechaza 400 si el porcentaje está fuera de 1–100', async () => {
    for (const value of [0, 101]) {
      const res = await request(app)
        .post('/api/promotions')
        .send(makePromo({ discount_value: value }));
      expect(res.status).toBe(400);
    }
  });

  it('rechaza 400 si el target no existe', async () => {
    const res = await request(app).post('/api/promotions').send(makePromo({ target_id: 999 }));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/no existe/i);
  });
});

describe('GET /api/promotions', () => {
  it('lista promociones con el nombre del target', async () => {
    await request(app).post('/api/promotions').send(makePromo());
    await request(app)
      .post('/api/promotions')
      .send(makePromo({ target_type: 'category', target_id: 2, name: 'Promo snacks' }));

    const res = await request(app).get('/api/promotions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ name: 'Promo snacks', target_name: 'Snacks' });
  });
});

describe('PATCH /api/promotions/:id', () => {
  it('actualiza campos editables', async () => {
    const created = await request(app).post('/api/promotions').send(makePromo());
    const res = await request(app)
      .patch(`/api/promotions/${created.body.id}`)
      .send({ name: 'Promo renovada', discount_value: 25 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Promo renovada', discount_value: '25.00' });
  });

  it('rechaza 409 editar una promoción Finalizada', async () => {
    const created = await request(app).post('/api/promotions').send(makePromo());
    await request(app).patch(`/api/promotions/${created.body.id}/status`).send({ status: 'active' });
    await request(app).patch(`/api/promotions/${created.body.id}/status`).send({ status: 'finished' });

    const res = await request(app)
      .patch(`/api/promotions/${created.body.id}`)
      .send({ name: 'Intento' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Finalizada/i);
  });

  it('rechaza 400 target incompleto', async () => {
    const created = await request(app).post('/api/promotions').send(makePromo());
    const res = await request(app).patch(`/api/promotions/${created.body.id}`).send({ target_id: 2 });
    expect(res.status).toBe(400);
  });

  it('devuelve 404 para una promoción inexistente', async () => {
    const res = await request(app).patch('/api/promotions/9999').send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('rechaza 400 pasar de Monto fijo a Porcentaje dejando el valor fuera de rango', async () => {
    const created = await request(app)
      .post('/api/promotions')
      .send(makePromo({ discount_type: 'fixed', discount_value: 150 }));
    const res = await request(app)
      .patch(`/api/promotions/${created.body.id}`)
      .send({ discount_type: 'percent' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.some((d: { path: string }) => d.path === 'discount_value')).toBe(true);
  });

  it('rechaza 400 editar solo la fecha de fin dejándola antes del inicio actual', async () => {
    const created = await request(app)
      .post('/api/promotions')
      .send(makePromo({ starts_at: days(5), ends_at: days(10) }));
    const res = await request(app)
      .patch(`/api/promotions/${created.body.id}`)
      .send({ ends_at: days(1) });
    expect(res.status).toBe(400);
    expect(res.body.error.details.some((d: { path: string }) => d.path === 'ends_at')).toBe(true);
  });

  it('rechaza 400 un valor fuera de rango con tipo Porcentaje vigente', async () => {
    const created = await request(app)
      .post('/api/promotions')
      .send(makePromo({ discount_type: 'percent', discount_value: 20 }));
    const res = await request(app)
      .patch(`/api/promotions/${created.body.id}`)
      .send({ discount_value: 150 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.some((d: { path: string }) => d.path === 'discount_value')).toBe(true);
  });
});

describe('PATCH /api/promotions/:id/status', () => {
  it('recorre Programada → Activa → Finalizada', async () => {
    const created = await request(app).post('/api/promotions').send(makePromo());

    const active = await request(app)
      .patch(`/api/promotions/${created.body.id}/status`)
      .send({ status: 'active' });
    expect(active.status).toBe(200);
    expect(active.body.status).toBe('active');

    const finished = await request(app)
      .patch(`/api/promotions/${created.body.id}/status`)
      .send({ status: 'finished' });
    expect(finished.status).toBe(200);
    expect(finished.body.status).toBe('finished');
  });

  it('rechaza 409 saltos o retrocesos', async () => {
    const created = await request(app).post('/api/promotions').send(makePromo());

    const jump = await request(app)
      .patch(`/api/promotions/${created.body.id}/status`)
      .send({ status: 'finished' });
    expect(jump.status).toBe(409);
    expect(jump.body.error.message).toMatch(/inválida/i);

    await request(app).patch(`/api/promotions/${created.body.id}/status`).send({ status: 'active' });
    const back = await request(app)
      .patch(`/api/promotions/${created.body.id}/status`)
      .send({ status: 'scheduled' });
    expect(back.status).toBe(409);
  });

  it('rechaza 400 un estado desconocido', async () => {
    const created = await request(app).post('/api/promotions').send(makePromo());
    const res = await request(app)
      .patch(`/api/promotions/${created.body.id}/status`)
      .send({ status: 'borrado' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/promotions/:id', () => {
  it('elimina solo en estado Programada', async () => {
    const created = await request(app).post('/api/promotions').send(makePromo());
    const del = await request(app).delete(`/api/promotions/${created.body.id}`);
    expect(del.status).toBe(204);

    const list = await request(app).get('/api/promotions');
    expect(list.body).toHaveLength(0);
  });

  it('rechaza 409 eliminar una promoción Activa', async () => {
    const created = await request(app).post('/api/promotions').send(makePromo());
    await request(app).patch(`/api/promotions/${created.body.id}/status`).send({ status: 'active' });

    const res = await request(app).delete(`/api/promotions/${created.body.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Programada/i);
  });

  it('devuelve 404 para una promoción inexistente', async () => {
    const res = await request(app).delete('/api/promotions/9999');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/promotions/summary', () => {
  it('cuenta por estado y vigentes hoy', async () => {
    await request(app).post('/api/promotions').send(makePromo({ starts_at: days(-2), ends_at: days(2) }));
    await request(app).post('/api/promotions').send(makePromo({ name: 'Futura' }));
    await request(app).post('/api/promotions').send(makePromo({ name: 'Vencida', starts_at: days(-10), ends_at: days(-5) }));

    const summary = await request(app).get('/api/promotions/summary');
    expect(summary.status).toBe(200);
    expect(summary.body).toEqual({ scheduled: 3, active: 0, finished: 0, valid_today: 1 });

    const list = await request(app).get('/api/promotions');
    await request(app).patch(`/api/promotions/${list.body[2].id}/status`).send({ status: 'active' });
    const after = await request(app).get('/api/promotions/summary');
    expect(after.body).toEqual({ scheduled: 2, active: 1, finished: 0, valid_today: 1 });
  });
});

describe('GET /api/references', () => {
  it('devuelve categorías y productos', async () => {
    const res = await request(app).get('/api/references');
    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(2);
    expect(res.body.products).toHaveLength(2);
    expect(res.body.products[0].category_name).toBe('Bebidas');
  });
});

describe('GET /health', () => {
  it('responde 200 con BD operativa', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('responde 503 cuando la BD no responde', async () => {
    const deadPool = createPool('postgres://postgres:test@localhost:59999/nope');
    const broken = createApp(deadPool, loadConfig());
    const res = await request(broken).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', db: 'down' });
    await deadPool.end();
  });
});