# Pruebas de V&V — API, Seguridad y Rendimiento

Este directorio documenta las pruebas **de sistema contra el stack en vivo** que
complementan a la suite unitaria/funcional/regresión con mocks de `tests/`
(descrita en [`tests/README.md`](../../tests/README.md)).

| Suite | Carpeta | Config | Script | Documento |
|---|---|---|---|---|
| API (HTTP en vivo) | `tests/api/` | `vitest.api.config.ts` | `npm run test:api` | [API.md](API.md) |
| Seguridad (defensiva) | `tests/security/` | `vitest.security.config.ts` | `npm run test:security` | [SEGURIDAD.md](SEGURIDAD.md) |
| Rendimiento (k6) | `perf/` | — | `npm run test:perf:smoke` · `:load` · `:stress` | [RENDIMIENTO.md](RENDIMIENTO.md) |

Las evidencias de cada corrida real están en [`evidencias/`](evidencias/).

## Requisitos

- El stack debe estar levantado (docker compose): API en `http://localhost:5000`,
  rutas bajo `/api/v1`, Swagger en `/api-docs`. Usuarios semilla con clave
  `123456` (`admin@homara.co`, `juan@email.com`, …).
- **`JWT_SECRET`** definido (obligatorio, sin valor por defecto: `openssl rand -hex 32`).
- **`CORS_ORIGINS=http://localhost:3000`** en el backend: el contenedor corre con
  `NODE_ENV=production` y, sin esta variable, no permite ningún origen, por lo que
  `CP-SEG-CORS-01` falla. Basta con `cp .env.example .env` antes de
  `docker compose up -d`, o con `CORS_ORIGINS=http://localhost:3000 docker compose up -d`.
- Para las pruebas de API y seguridad: `npm install` y `npx prisma generate`
  (necesario también para la suite por defecto).
- Para rendimiento: Docker, con la imagen `grafana/k6:0.54.0`.

## Cómo ejecutar cada suite

```bash
# Suite por defecto (con mocks; NO toca el servidor). Debe seguir en verde.
npm test

# API en vivo (requiere el stack arriba)
API_URL=http://localhost:5000 npm run test:api

# Seguridad en vivo (requiere el stack arriba)
API_URL=http://localhost:5000 npm run test:security

# Rendimiento (k6 vía Docker; apunta a host.docker.internal:5000)
npm run test:perf:smoke
npm run test:perf:load
npm run test:perf:stress
```

> **Importante:** `tests/api/**` y `tests/security/**` están **excluidas** del
> `vitest run` por defecto (ver `vitest.config.ts`), porque CI no tiene servidor
> corriendo. Sólo corren con sus scripts dedicados.

> **Estado tras la refactorización:** todos los defectos de esta página están
> **corregidos**. Comparación antes/después y detalle de cada cambio en
> [`../REFACTORIZACION.md`](../REFACTORIZACION.md). Las corridas previas se
> conservan en [`evidencias/antes-refactorizacion/`](evidencias/antes-refactorizacion/).

## Resumen de resultados (última corrida real, después de la refactorización)

- **API:** 65/65 Aprobados, sin `test.fails` — ver [`evidencias/test-api.txt`](evidencias/test-api.txt).
- **Seguridad:** 33/33 Aprobados (los 11 defectos, antes `test.fails`, ahora
  afirman el comportamiento seguro y pasan) — ver [`evidencias/test-security.txt`](evidencias/test-security.txt).
- **Suite por defecto (mocks):** 268/268 Aprobados, sin `test.fails` — ver
  [`evidencias/test-unit.txt`](evidencias/test-unit.txt).
- La suite de seguridad necesita `JWT_SECRET` con el mismo valor que el backend
  (el secreto ya no tiene valor por defecto).
- **Rendimiento:** ver [RENDIMIENTO.md](RENDIMIENTO.md) y los JSON/TXT en
  `evidencias/` (`smoke`, `load`, `stress`).

## Tabla de defectos encontrados (todos corregidos)

Defectos **de seguridad** (detalle y corrección en [SEGURIDAD.md](SEGURIDAD.md)):

| ID | Severidad | Resumen |
|---|---|---|
| CP-SEG-DEF-01 | Alta | JWT de ADMIN forjable con el secreto por defecto embebido |
| CP-SEG-DEF-02 | Alta | `?admin=true` honrado para cualquier CUSTOMER (lista todos los pedidos) |
| CP-SEG-DEF-03 | Alta | `GET /orders?userId=X` sin token filtra pedidos ajenos |
| CP-SEG-DEF-04 | Alta | `GET /projects?userId=X` sin token filtra proyectos ajenos |
| CP-SEG-DEF-05 | Media | `GET /cart?userId=X` sin token expone carrito ajeno |
| CP-SEG-DEF-06 | Alta | `GET /orders/:id` sin auth ni propiedad expone PII del cliente |
| CP-SEG-DEF-07 | Alta | `GET /projects/:id` sin auth ni propiedad expone proyectos ajenos |
| CP-SEG-DEF-08 | Alta | `GET /users/:id` expone PII sin verificar propiedad |
| CP-SEG-DEF-09 | Alta | `PUT /users/:id` devuelve la entidad con el hash de la contraseña |
| CP-SEG-DEF-10 | Media | Sin cabeceras de seguridad (falta helmet) |
| CP-SEG-DEF-11 | Media | Login sin rate limiting (fuerza bruta) |

Defecto **de documentación**:

| ID | Severidad | Resumen |
|---|---|---|
| CP-API-DOC-04 | Baja | Rutas implementadas sin documentar en Swagger (storefront, reseñas, CRUD de productos) |

Estos defectos se documentaron primero con `test.fails` y luego se **corrigieron**
en `src/`; los casos volvieron a `test(...)` y pasan. Ver
[`../REFACTORIZACION.md`](../REFACTORIZACION.md).
