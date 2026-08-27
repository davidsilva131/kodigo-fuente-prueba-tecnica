# Plan — Módulo de Gestión de Promociones

**Repo:** davidsilva131/kodigo-fuente-prueba-tecnica (público)
**Prueba:** gestión de promociones (React + Vite | Node.js | PostgreSQL | Docker Compose | GitHub Actions)

## Stack

- **Backend:** Node.js + Express + TypeScript, `pg` para PostgreSQL, `zod` para validación, `vitest` + `supertest` para tests.
- **Frontend:** React + Vite + TypeScript, `vitest` + React Testing Library. En producción se sirve el build estático con **nginx** (proxy `/api` → backend).
- **BD:** PostgreSQL 16. **3 tablas** (≥2 requeridas):
  - `categories` (id, name) — sembrada
  - `products` (id, name, category_id FK) — sembrada
  - `promotions` (id, name, target_type product|category, target_id, discount_type percent|fixed, discount_value numeric, starts_at, ends_at, status scheduled|active|finished)
- **Migrations:** SQL idempotente ejecutado al boot del backend (CREATE IF NOT EXISTS + seed ON CONFLICT DO NOTHING).
- **Compose:** `db` (postgres:16-alpine), `backend`, `frontend` (nginx). `/health` expone estado de app + conexión real a BD (503 si cae).

## Decisiones de dominio

1. **Estado**: máquina secuencial `scheduled → active → finished` (solo al siguiente estado; PATCH de estado valida transición).
2. **Finalizada**: inmutable (rechaza update). **Eliminar**: solo en `scheduled`.
3. **Vigente hoy**: calculado por fechas (`starts_at <= now() <= ends_at`), independiente del estado manual.
4. **Validaciones** (zod, 400): nombre/target/valor obligatorios; `ends_at > starts_at`; percent entre 1–100.
5. **Resumen**: `GET /api/promotions/summary` → contadores por estado + `valid_today`.

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | 200 si app + BD operativas |
| GET | `/api/promotions` | Lista con target_name |
| POST | `/api/promotions` | Crear |
| PATCH | `/api/promotions/:id` | Editar (no si finished) |
| PATCH | `/api/promotions/:id/status` | Transición de estado |
| DELETE | `/api/promotions/:id` | Solo scheduled |
| GET | `/api/promotions/summary` | Contadores |
| GET | `/api/references` | categories + products (para el form) |

## CI/CD (GitHub Actions, `ci.yml`)

Jobs dependientes en cadena: **lint → test → build → smoke-test** (cada uno `needs:` el anterior).

1. `lint`: ESLint backend + frontend.
2. `test`: vitest backend (con `services: postgres` del runner) + frontend (jsdom).
3. `build`: `docker build` de backend y frontend.
4. `smoke-test`: `docker compose up -d` → retry con timeout a `/health` → 200 o pipeline falla.

**Secretos** (obligatorio):
- Nada de credenciales en el repo; `.env.example` con placeholders.
- `POSTGRES_PASSWORD` real se inyecta como GitHub Secret (`gh secret set`).
- Compose usa `${VAR:?VAR requerida}` → fallo explícito si falta variable.
- `.gitignore` excluye `.env` y `node_modules`.

## Entregables

- `DECISIONS.md` (justificación de cada elección) · `README.md` (pasos locales) · `.env.example` · Actions visible en repo.

## Tickets (GitHub Issues, con bloques encadenados)

1. **Backend API** — modelo, CRUD, transiciones, validaciones, /health, migrations, tests. *(base)*
2. **Frontend** — lista, formulario, cambio de estado, resumen, validación client-side, tests. *(bloqueado por #1)*
3. **Infra y docs** — Dockerfiles, docker-compose, .env.example, README, DECISIONS. *(bloqueado por #1, #2)*
4. **CI/CD** — workflow lint→test→build→smoke + GitHub Secrets. *(bloqueado por #3)*

## Verificación

- Local: `docker compose up` + `curl /health` + ciclo CRUD completo contra la API.
- CI: cada push dispara el pipeline; verificar en pestaña Actions hasta green.

## Notas

- Implementación 100% con herramientas nativas de Hermes (sin OpenCode CLI — preferencia del usuario).
- Push al repo: aprobado por el usuario (deliverable exige Actions visible).