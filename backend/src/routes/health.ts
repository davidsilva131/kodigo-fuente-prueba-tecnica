import { Router } from 'express';
import type { DbPool } from '../db.js';

/**
 * /health → 200 solo si la aplicación y su conexión a BD están operativas.
 */
export function healthRouter(pool: DbPool): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.status(200).json({ status: 'ok', db: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'down' });
    }
  });

  return router;
}