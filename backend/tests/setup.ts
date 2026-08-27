// Variables de entorno para los tests de integración.
// CI (GitHub Actions) las sobreescribe; localmente apuntan al
// contenedor de Postgres de desarrollo (ver README).
process.env.POSTGRES_HOST ??= 'localhost';
process.env.POSTGRES_PORT ??= '5433';
process.env.POSTGRES_USER ??= 'postgres';
process.env.POSTGRES_PASSWORD ??= 'test';
process.env.POSTGRES_DB ??= 'promotions_test';