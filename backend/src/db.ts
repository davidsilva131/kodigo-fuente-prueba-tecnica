import pg from 'pg';

const { Pool } = pg;

export type DbPool = pg.Pool;
export type DbClient = pg.PoolClient;

export function createPool(connectionString: string): DbPool {
  const pool = new Pool({ connectionString, max: 10 });
  pool.on('error', (err) => {
    console.error('Error inesperado en el pool de PostgreSQL:', err.message);
  });
  return pool;
}