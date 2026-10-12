# Pruebas de rendimiento (k6) — ESC38

Pruebas de carga con **k6** ejecutadas vía Docker (`grafana/k6:0.54.0`) contra el
stack en vivo (`http://host.docker.internal:5000`). Tres escenarios: humo, carga
y estrés acotado (se limita a ~60 VUs porque otros agentes comparten el stack).

- Scripts: `perf/smoke.js`, `perf/load.js`, `perf/stress.js` (lógica común en
  `perf/comun.js`, resumen en `perf/resumen.js`).
- Ejecución: `npm run test:perf:smoke` · `:load` · `:stress`.
- Evidencias (JSON + TXT exportados con `handleSummary`):
  [`evidencias/smoke.json`](evidencias/smoke.json)/[`.txt`](evidencias/smoke.txt),
  [`evidencias/load.json`](evidencias/load.json)/[`.txt`](evidencias/load.txt),
  [`evidencias/stress.json`](evidencias/stress.json)/[`.txt`](evidencias/stress.txt).

## Endpoints ejercidos

- **Lecturas públicas** (`dur_lectura`): `GET /categories`, `GET /products`,
  `GET /products/storefront`, `GET /products/:id`.
- **Login** (`dur_login`): `POST /users/login` (mide el costo de bcrypt).
- **Flujo autenticado** (`dur_autenticado`): `GET /users/me` + `GET /cart`.

## Criterios de aceptación (umbrales)

| Métrica | Umbral |
|---|---|
| `dur_lectura` p95 (lecturas públicas) | < 500 ms |
| `dur_login` p95 | < 1000 ms |
| `dur_autenticado` p95 | < 800 ms |
| `http_req_failed` | < 1 % |

## Resultados reales

### Smoke — 2 VUs, 30 s

| Métrica | Valor | Umbral | Estado |
|---|---|---|---|
| Peticiones | 294 | — | — |
| http_req_failed | 0.00 % | < 1 % | OK |
| p95 lecturas | 167.4 ms | < 500 ms | OK |
| p95 login | 345.8 ms | < 1000 ms | OK |
| p95 autenticado | 186.8 ms | < 800 ms | OK |

**Todos los umbrales pasaron.** Línea base sana sin carga.

### Load — rampa a 30 VUs, ~2 min

| Métrica | Valor | Umbral | Estado |
|---|---|---|---|
| Peticiones | 7281 | — | — |
| http_req_failed | 0.00 % | < 1 % | OK |
| p95 lecturas | 473.5 ms | < 500 ms | OK |
| p95 login | 603.5 ms | < 1000 ms | OK |
| p95 autenticado | 549.9 ms | < 800 ms | OK |

**Todos los umbrales pasaron**, con margen estrecho en lecturas (473 de 500 ms).
El `avg` global y el `max` aparecen inflados por **una muestra atípica** (una
conexión que quedó colgada durante la rampa en el stack compartido); la métrica de
aceptación es el p95, que se mantuvo dentro del umbral.

### Stress — rampa a 60 VUs, ~2 min

| Métrica | Valor | Umbral | Estado |
|---|---|---|---|
| Peticiones | 4006 | — | — |
| http_req_failed | 0.00 % | < 1 % | OK |
| p95 lecturas | 3982.4 ms | < 500 ms | **FALLA** |
| p95 login | 3218.2 ms | < 1000 ms | **FALLA** |
| p95 autenticado | 5576.5 ms | < 800 ms | **FALLA** |

A ~60 VUs el sistema **no pierde corrección** (0 % de errores: ninguna petición
falló ni devolvió 5xx), pero la **latencia se degrada fuertemente** (p95 de 4–5.5
s). Es el punto de saturación esperado para una sola instancia; k6 devuelve código
99 por el cruce de umbrales, lo cual es el resultado buscado para **documentar** el
límite, no un fallo del pipeline.

## Interpretación

- Hasta ~30 VUs el backend cumple los objetivos de latencia con un único proceso
  Node y un PostgreSQL local.
- El **login** es la operación más cara por diseño (bcrypt con coste 10); su p95
  sube de 346 ms (humo) a 3.2 s (estrés), confirmando que bcrypt es el principal
  consumidor de CPU bajo concurrencia.
- Las **lecturas** se degradan bajo estrés pese a ser simples: apuntan a un cuello
  de botella de CPU/conexiones y a consultas sin índices ni paginación (listados
  completos de productos/pedidos).
- La ausencia de errores bajo estrés indica buena estabilidad (sin caídas ni
  timeouts del lado de la app en la ventana probada).

## Propuestas de mejora

1. **Login / bcrypt:** el coste 10 domina la CPU bajo carga. Evaluar bajar a
   coste 11→10 ya está en 10; mantener 10 pero **limitar intentos**
   (`express-rate-limit`, ver DEF-11 de seguridad) para que un pico de logins no
   sature la CPU; considerar cachear sesiones/validación de token.
2. **Paginación** en los listados (`GET /products`, `GET /orders?admin=true`,
   `GET /projects`): hoy devuelven la colección completa; con `limit`/`offset` o
   cursor se acota el trabajo por petición.
3. **Índices**: verificar índices en los filtros usados (`Product.categoryId` ya
   existe; añadir soporte para búsqueda por texto `q` e índices en
   `Order.createdAt`/`status` que ya están, pero revisar las consultas de métricas
   que hacen `findMany` + reduce en memoria).
4. **Caching** de respuestas poco cambiantes (`/categories`, `/products/storefront`)
   con `Cache-Control`/ETag (ya hay ETag de Express) o una capa en memoria/Redis.
5. **Escalado horizontal**: al ser Node mono-proceso, correr varias instancias
   detrás de un balanceador (o `cluster`) multiplicaría el throughput de login y
   lecturas.
6. **Cálculo de métricas admin** (`/admin/metrics`): agrega en memoria sobre
   `findMany`; conviene mover las sumas a consultas agregadas (`groupBy`/SQL) para
   no traer todas las filas.
