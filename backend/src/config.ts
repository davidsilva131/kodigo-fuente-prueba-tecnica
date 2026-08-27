import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173,http://localhost:8080'),
});

export type Config = z.infer<typeof envSchema>;

/**
 * Carga y valida la configuración desde el entorno.
 * Falla EXPLÍCITAMENTE si falta alguna variable requerida (POSTGRES_*).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Faltan variables de entorno requeridas: ${missing}`);
  }
  return parsed.data;
}

export function databaseUrl(cfg: Config): string {
  return `postgres://${cfg.POSTGRES_USER}:${cfg.POSTGRES_PASSWORD}@${cfg.POSTGRES_HOST}:${cfg.POSTGRES_PORT}/${cfg.POSTGRES_DB}`;
}

export function corsOrigins(cfg: Config): string[] {
  return cfg.CORS_ORIGIN.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}