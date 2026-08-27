# DECISIONS.md — Decisiones técnicas

La prueba dejaba libertad de elección con justificación obligatoria. Este documento explica cada decisión y sus alternativas consideradas.

## 1. Backend: Node.js + Express + TypeScript (vs Laravel)

**Elegido:** Node.js + Express + TypeScript.

| Criterio | Node.js + Express + TS | Laravel (PHP) |
|---|---|---|
| Coherencia con el frontend | Un solo lenguaje (TS) en toda la pila | PHP + JS |
| Tipado | TypeScript estricto, de punta a punta | PHP dinámico (tipos parciales) |
| Peso del contenedor | ~200 MB runtime | ~500 MB+ (PHP-FPM) |
| Velocidad de iteración | Alta | Media (generación de scaffolding, ORM) |

**Justificación:** el equipo ya trabaja React + Vite; mantener TypeScript en el backend reduce el cambio de contexto, permite compartir contratos de datos y acelera el desarrollo. Express es mínimo y predecible para un CRUD de una tabla de dominio — sin magia de framework. Las validaciones se declaran con **zod**, que da tipos de TypeScript y guardas de runtime en una sola fuente. La **actualización** además valida el **estado resultante** (fila actual + campos recibidos) con las mismas reglas que la creación: un PATCH parcial nunca deja la promoción inválida ni produce un 500 por violación de constraints (400 con detalle del campo).

## 2. Base de datos: PostgreSQL (vs MongoDB, SQL Server)

**Elegido:** PostgreSQL 16.

- **Integridad referencial real**: las promociones referencian productos/categorías. Con `FOREIGN KEY` + `CHECK` constraints, las reglas de negocio (`ends_at > starts_at`, porcentaje 1–100, estados válidos) se aplican incluso si alguien escribe SQL a mano.
- **SQL Server** se descartó por licenciamiento y peso de contenedor.
- **MongoDB** se descartó porque el modelo es claramente relacional (catálogo + promociones) y las constraints de documento no cubren referencias entre colecciones.

**Esquema (3 tablas, mínimo exigido: 2):**

```
categories (id, name)
products   (id, name, category_id → categories)
promotions (id, name, target_type product|categoría, target_id,
            discount_type percent|fixed, discount_value NUMERIC(10,2),
            starts_at, ends_at, status scheduled|active|finished, created_at)
```

- `target_type` + `target_id` modelan "producto **o** categoría" sin tablas pivote.
- Las reglas de negocio viven además como `CHECK` en la BD (defensa en profundidad), con validación previa en la API (zod). La **migración 002** endureció el CHECK de porcentaje al rango completo **1–100** (la 001 solo acotaba ≤ 100): una inserción SQL directa con 0.5 o 150 es rechazada por la BD.

## 3. Migraciones: SQL plano idempotente al boot (vs ORM/migración por herramienta)

**Elegido:** script propio (`src/migrate.ts`) que aplica `migrations/*.sql` en orden, registrando cada archivo en `schema_migrations`. Idempotente (`CREATE TABLE IF NOT EXISTS`, seed con `ON CONFLICT DO NOTHING`) y se ejecuta al arrancar el backend.

**Motivo:** para 3 tablas no se justifica una dependencia de migraciones (node-pg-migrate, Prisma, etc.). SQL plano es legible, versionable y sin sorpresas. El seed de categorías/productos es opinado y solo demostrativo.

## 4. Máquina de estados: transiciones secuenciales estrictas

La especificación pide `Programada → Activa → Finalizada`. Se implementó como **transiciones de un solo paso** (sin saltos ni retrocesos), en un módulo puro (`stateMachine.ts`) fácil de testear:

- `scheduled → active` y `active → finished` son las únicas permitidas (HTTP 409 si no).
- Una promoción **Finalizada es inmutable** (PATCH devuelve 409).
- Solo se puede **eliminar** en estado `Programada` (409 si no).
- "**Vigente hoy**" se calcula por fechas (`starts_at <= now() <= ends_at`), independiente del estado manual: la vigencia es un hecho temporal; el estado es una decisión de negocio.
- La **actualización** valida el **estado resultante** (fila actual + cambios) con las mismas reglas de creación antes de escribir; si el resultado es inválido → 400 con el campo problemático (nunca 500). Esto cubre casos como pasar de Monto fijo a Porcentaje dejando un valor fuera de rango, o editar solo la fecha de fin dejándola antes del inicio actual.

## 5. Frontend: React + Vite, servido por nginx en producción

**Elegido:** React 19 + Vite 8 + TypeScript, con el build estático servido por **nginx** (multi-stage Dockerfile: `node build → nginx`).

**Por qué nginx y no `vite dev`/`vite preview`:** es el patrón estándar de producción para apps Vite (así lo recomienda la documentación oficial). Vite sigue siendo el build tool y React la tecnología de UI — "estático" se refiere solo al servidor del bundle. nginx además actúa como **reverse proxy** de `/api` y `/health` hacia el backend (un solo origen, sin CORS en producción). En desarrollo, Vite hace el proxy equivalente.

**Configuración por plantilla (envsubst):** la imagen oficial de nginx renderiza `nginx.conf.template` con las variables de entorno del servicio — `PORT` (puerto de escucha), `BACKEND_INTERNAL_URL` (URL del backend), `BACKEND_HOST` (host del backend para el `Host` header) y `NGINX_DNS_RESOLVER`. Tres detalles críticos aprendidos en el deploy a Railway:

1. **DNS dinámico**: `proxy_pass` usa una variable (`set $upstream …`) con `resolver`, para que nginx re-resuelva el upstream por request. Con URL estática nginx resuelve **una sola vez al arrancar** y un redeploy del backend deja el proxy apuntando a una IP reciclada (timeouts).
2. **Host header (bucle con el edge de la plataforma)**: al proxear al **dominio público** del backend, el `Host` debe ser el del backend (`BACKEND_HOST`); si se reenvía el del frontend, el edge de Railway enruta por Host y devuelve el request al frontend → bucle infinito (timeouts anidados + headers acumulados).
3. **Buffers de respuesta**: el edge añade headers grandes de respuesta; `proxy_buffer_size 16k` / `proxy_buffers 4 32k` evita el 502 `upstream sent too big header`.

En Docker Compose el mismo template funciona con la red interna del compose (`backend:3000`, resolver Docker `127.0.0.11`).

**Validación client-side** espeja la del backend (obligatorios, rango de porcentaje, fechas) para feedback inmediato; el backend sigue siendo la autoridad (validación server-side siempre).

## 6. Estado global y datos: estado local de React + fetch (sin Redux/react-query)

**Motivo:** una sola vista con tres fuentes de datos (`promotions`, `summary`, `references`). Añadir react-query/Redux sería sobre-ingeniería para este alcance. El fetching se centraliza en `src/api.ts` con manejo de errores uniforme.

## 7. Tests: vitest + supertest (backend) · vitest + Testing Library (frontend)

- **Backend:** tests de unidad (máquina de estados, validaciones) + **integración contra Postgres real** (CRUD completo, transiciones, resumen, `/health` 200 y 503). **40 tests** — los 5 últimos son regresión del fix de PATCH parciales (resultado inválido → 400) e idempotencia de migraciones.
- **Frontend:** componentes y flujos de usuario con fetch mockeado (validación del formulario, creación, activación, banner de error). 8 tests.
- El runner de CI levanta Postgres como servicio (`services:`), por lo que los tests de integración corren contra una BD real, no mocks.

## 8. Contenedores y Compose

- **Imágenes multi-stage** para minimizar el runtime (backend: node 24 alpine + solo `dist`; frontend: nginx).
- `depends_on: condition: service_healthy` — el backend espera a que Postgres responda `pg_isready`; healthchecks en todos los servicios.
- **Fallo explícito si faltan variables**: sintaxis `${VAR:?mensaje}` en `docker-compose.yml` — Compose aborta con error claro. El backend además valida su entorno al boot (`config.ts`).
- Scripts de arranque con `pnpm` (gestor elegido por determinismo y velocidad) y `--frozen-lockfile` en las imágenes para builds reproducibles.

## 9. Secretos y entorno

- `.env.example` con placeholders; `.env` real en `.gitignore`; **cero credenciales en el repo**.
- `POSTGRES_PASSWORD` se inyecta como **GitHub Secret** en CI (nunca aparece en el workflow).
- `.env` local para Compose; variables de entorno para el backend.

## 10. CI/CD: GitHub Actions encadenado

Jobs **dependientes** (cada uno `needs:` el anterior): `lint → test → build → smoke-test`.

1. **lint** — ESLint (backend) + oxlint (frontend).
2. **test** — vitest; backend con `services: postgres` real en el runner, frontend con jsdom.
3. **build** — `docker build` de ambas imágenes (valida Dockerfiles).
4. **smoke-test** — `docker compose up -d` → espera de readiness → `GET /health` debe responder 200; cualquier fallo rompe el pipeline.

Se dispara en `push` a `main` y manualmente (`workflow_dispatch`).

## 11. Alternativas evaluadas y descartadas

| Opción | Por qué se descartó |
|---|---|
| Laravel | Más peso y contexto extra; el equipo es TS-first |
| MongoDB | Modelo relacional claro; constraints débiles entre colecciones |
| SQL Server | Licenciamiento + contenedor pesado para el alcance |
| ORM (Prisma/TypeORM) | 3 tablas; SQL plano + zod cubre el caso sin capa extra |
| Redux / react-query | Sub-ingeniería para una vista; estado local alcanza |
| `vite preview` en el contenedor | Menos "producción"; nginx aporta proxy y es el estándar Vite |

## 12. Deploy en Railway

La misma imagen Docker se despliega en Railway (demostración en vivo): servicios `backend`/`frontend` (Dockerfiles) + plugin `Postgres` gestionado. El frontend proxya al backend por su **dominio público** con el template de nginx descrito en §5 (resolver dinámico + `Host` del backend + buffers). Las credenciales del plugin viven en las variables del proyecto de Railway (referencias `${{Postgres.*}}` resueltas al vincular), nunca en el repositorio. URLs en el `README.md`.