# Gestión de Promociones — Kódigo Fuente

![CI](https://github.com/davidsilva131/kodigo-fuente-prueba-tecnica/actions/workflows/ci.yml/badge.svg)

Aplicación web para **registrar y gestionar promociones** de los POS de Kódigo Fuente, controlando su estado (`Programada → Activa → Finalizada`) y su vigencia.

> Prueba técnica. Prioridad: calidad sobre cantidad.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TypeScript (servido por nginx) |
| Backend | Node.js + Express + TypeScript + zod |
| Base de datos | PostgreSQL 16 (3 tablas: `categories`, `products`, `promotions`) |
| Infra | Docker Compose |
| CI/CD | GitHub Actions (lint → test → build → smoke test) |

## Requisitos

- Docker (con Compose v2) — para levantar la app completa
- Node.js ≥ 20 + pnpm (opcional, solo para desarrollo)

## Levantar el proyecto (producción local)

```bash
# 1. Crear el .env a partir del ejemplo (ajustar POSTGRES_PASSWORD)
cp .env.example .env

# 2. Construir y levantar todo
docker compose up --build -d

# 3. Verificar
curl http://localhost:3000/health        # → {"status":"ok","db":"up"} (HTTP 200)
# App: http://localhost:8080
```

> Si falta alguna variable requerida, Compose **falla explícitamente** con un mensaje claro. Nunca hay secretos en el repositorio; `.env` está en `.gitignore`.

Detener: `docker compose down` (conserva los datos en el volumen `db-data`). Borrar datos: `docker compose down -v`.

> El contenedor `frontend` renderiza su configuración de nginx desde una plantilla con
> envsubst (`PORT`, `BACKEND_INTERNAL_URL`, `BACKEND_HOST`, `NGINX_DNS_RESOLVER`) — los
> valores del archivo ya son válidos para Docker Compose.

## Desarrollo local

```bash
# Backend (puerto 3000; migraciones automáticas al boot)
cd backend
pnpm install
POSTGRES_HOST=localhost POSTGRES_DB=promociones_dev POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres pnpm dev

# Frontend (puerto 5173; el servidor de Vite hace proxy /api → localhost:3000)
cd frontend
pnpm install
pnpm dev
```

## Tests y calidad

```bash
# Backend: 40 tests (unit + integración con Postgres real)
cd backend && pnpm lint && pnpm test && pnpm build

# Frontend: 8 tests (componentes + flujos, fetch mockeado)
cd frontend && pnpm lint && pnpm test && pnpm build
```

Los tests de integración del backend requieren Postgres en `localhost:5433` con
`POSTGRES_PASSWORD=test`, `POSTGRES_DB=promotions_test` (así está configurado el runner de CI).

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | 200 si app + BD operativas (503 si no) |
| GET | `/api/promotions` | Lista con nombre del target |
| POST | `/api/promotions` | Crear (estado inicial `scheduled`) |
| PATCH | `/api/promotions/:id` | Editar (rechazado si `finished`; **400** si el resultado queda inválido) |
| PATCH | `/api/promotions/:id/status` | Transición `scheduled → active → finished` |
| DELETE | `/api/promotions/:id` | Eliminar (solo `scheduled`) |
| GET | `/api/promotions/summary` | Contadores por estado + `valid_today` |
| GET | `/api/references` | Catálogo de productos/categorías |

## CI/CD

`.github/workflows/ci.yml` ejecuta en cadena: **lint → test → build → smoke test**.
El smoke test levanta la app con `docker compose up`, espera a los contenedores y
verifica `GET /health` → 200; si no responde, el pipeline falla.
`POSTGRES_PASSWORD` se inyecta como GitHub Secret (nunca está en el repo).

## Deploy (Railway)

Demostración en vivo del proyecto (mismos Dockerfiles):

- **Frontend:** https://frontend-production-6136.up.railway.app
- **Backend API:** https://backend-production-a751.up.railway.app
- **Base de datos:** plugin PostgreSQL gestionado por Railway (credenciales solo en las variables del proyecto, nunca en el repo)

Servicios: `backend` y `frontend` (Dockerfiles) + plugin `Postgres`. Variables por servicio:

| Servicio | Variables |
|---|---|
| backend | `PORT`, `POSTGRES_HOST/PORT/DB/USER/PASSWORD` (referencias al plugin) |
| frontend | `PORT`, `NGINX_DNS_RESOLVER=8.8.8.8`, `BACKEND_INTERNAL_URL` (URL pública del backend), `BACKEND_HOST` (host del backend) |

Redesplegar el último build: `railway redeploy -s <servicio> -y`. Detalles de la configuración del proxy en [`DECISIONS.md`](./DECISIONS.md) §5.

## Decisiones técnicas

Ver [`DECISIONS.md`](./DECISIONS.md).