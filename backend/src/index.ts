import { createApp } from './app.js';
import { databaseUrl, loadConfig } from './config.js';
import { createPool } from './db.js';
import { runMigrations } from './migrate.js';

async function main() {
  const config = loadConfig();
  const pool = createPool(databaseUrl(config));

  const applied = await runMigrations(pool);
  if (applied.length > 0) {
    console.log(`Migraciones aplicadas: ${applied.join(', ')}`);
  }

  const app = createApp(pool, config);
  app.listen(config.PORT, () => {
    console.log(`API de promociones escuchando en http://localhost:${config.PORT}`);
  });
}

main().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});