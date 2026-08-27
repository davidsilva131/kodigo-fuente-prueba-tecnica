import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { corsOrigins, type Config } from './config.js';
import type { DbPool } from './db.js';
import { HttpError } from './errors.js';
import { healthRouter } from './routes/health.js';
import { promotionsRouter } from './routes/promotions.js';
import { referencesRouter } from './routes/references.js';

export function createApp(pool: DbPool, config: Config) {
  const app = express();

  app.use(cors({ origin: corsOrigins(config) }));
  app.use(express.json());

  app.use(healthRouter(pool));
  app.use(promotionsRouter(pool));
  app.use(referencesRouter(pool));

  app.use((_req, res) => {
    res.status(404).json({ error: { message: 'Ruta no encontrada' } });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: {
          message: 'Datos inválidos',
          details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      });
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: { message: err.message } });
      return;
    }
    console.error(err);
    res.status(500).json({ error: { message: 'Error interno del servidor' } });
  });

  return app;
}