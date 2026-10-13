# Pruebas de rendimiento (k6) — ESC38

Pruebas de carga con **k6** ejecutadas vía Docker (`grafana/k6:0.54.0`) contra el
stack en vivo (`http://host.docker.internal:5000`). Tres escenarios: humo, carga
y estrés acotado a ~60 VUs (una sola instancia de la API y PostgreSQL local en la
misma máquina que genera la carga).

- Scripts: `perf/smoke.js`, `perf/load.js`, `perf/stress.js` (lógica común en
  `perf/comun.js`, resumen en `perf/resumen.js`).
- Ejecución: `npm run test:perf:smoke` · `:load` · `:stress`. Cada script guarda su
  resumen en `docs/pruebas/evidencias/` (sobrescribe la corrida anterior).
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

Las tres pruebas se ejecutaron en secuencia, en la misma máquina y sin otras cargas
en paralelo (Windows 11, Docker Desktop; API y PostgreSQL en contenedores locales).

### Smoke — 2 VUs, 30 s

| Métrica | Valor | Umbral | Estado |
|---|---|---|---|
| Peticiones (throughput) | 364 (11,7 req/s) | — | — |
| http_req_failed | 0,00 % | < 1 % | OK |
| p95 lecturas | 71,8 ms | < 500 ms | OK |
| p95 login | 134,9 ms | < 1000 ms | OK |
| p95 autenticado | 77,9 ms | < 800 ms | OK |

**Todos los umbrales pasaron.** Línea base sin carga: el login (bcrypt) ya es la
operación más costosa, casi el doble que una lectura.

### Load — rampa a 30 VUs, 2 min

| Métrica | Valor | Umbral | Estado |
|---|---|---|---|
| Peticiones (throughput) | 11 379 (94,5 req/s) | — | — |
| http_req_failed | 0,00 % | < 1 % | OK |
| p95 lecturas | 100,2 ms | < 500 ms | OK |
| p95 login | 144,2 ms | < 1000 ms | OK |
| p95 autenticado | 101,6 ms | < 800 ms | OK |
| Máximo (todas) | 232,6 ms | — | — |

**Todos los umbrales pasaron con amplio margen** (p95 entre 5 y 8 veces por debajo
del límite). Con 30 usuarios concurrentes la latencia apenas sube respecto al humo.

### Stress — rampa a 60 VUs, 2 min

| Métrica | Valor | Umbral | Estado |
|---|---|---|---|
| Peticiones (throughput) | 14 000 (116,3 req/s) | — | — |
| http_req_failed | 0,00 % | < 1 % | OK |
| p95 lecturas | 562,6 ms | < 500 ms | **FALLA** |
| p95 login | 1023,5 ms | < 1000 ms | **FALLA** |
| p95 autenticado | 718,8 ms | < 800 ms | OK (al límite) |
| Máximo (todas) | 1120,4 ms | — | — |

A ~60 VUs el sistema **no pierde corrección** (0 % de errores, ningún 5xx ni
timeout), pero la **latencia se multiplica por 5–7** respecto a la carga y dos de
los tres umbrales se cruzan. k6 termina con código 99 por el cruce de umbrales: es
el resultado buscado para **documentar** el límite, no un fallo del pipeline.

## Interpretación

- **Punto de saturación entre 30 y 60 VUs.** Al duplicar los usuarios (30 → 60) el
  throughput solo sube un 23 % (94,5 → 116,3 req/s) mientras la latencia se
  multiplica: las peticiones adicionales hacen cola en lugar de atenderse. La
  capacidad de esta instancia ronda las **~115 req/s** con esta mezcla de operaciones.
- **El login es el cuello de botella principal.** Su promedio pasa de 86 ms (carga)
  a 537 ms (estrés). bcrypt con coste 10 consume CPU de forma síncrona por cada
  intento, y en estrés la mitad de los VUs inicia sesión en cada iteración.
- **Las lecturas se degradan por contención, no por su propio costo.** Son baratas
  en carga (p95 100 ms), pero en estrés comparten el mismo proceso Node (un solo
  hilo de eventos) con los hash de bcrypt y con consultas que devuelven listados
  completos sin paginación (`GET /products` trae todo el catálogo).
- **Estabilidad buena:** ninguna petición falló en ninguna de las tres pruebas, así
  que el límite observado es de latencia, no de disponibilidad.

## Propuestas de mejora

1. **Login / bcrypt:** mantener el coste 10 (bajarlo debilita el hash), pero
   **limitar intentos** (`express-rate-limit`, ver DEF-11 de seguridad) para que un
   pico de logins no acapare la CPU, y evitar logins repetidos reutilizando el
   token de 7 días en el cliente.
2. **Paginación** en los listados (`GET /products`, `GET /orders?admin=true`,
   `GET /projects`): hoy devuelven la colección completa; con `limit`/`offset` o
   cursor se acota el trabajo por petición.
3. **Índices**: verificar índices en los filtros usados (`Product.categoryId` ya
   existe); la búsqueda por texto `q` y las consultas de métricas, que hacen
   `findMany` + reduce en memoria, son las candidatas a revisar.
4. **Caching** de respuestas poco cambiantes (`/categories`, `/products/storefront`)
   con `Cache-Control`/ETag (ya hay ETag de Express) o una capa en memoria/Redis.
5. **Escalado horizontal**: al ser Node mono-proceso, correr varias instancias
   detrás de un balanceador (o `cluster`) multiplicaría el throughput de login y
   lecturas, que es justo donde se satura.
6. **Cálculo de métricas admin** (`/admin/metrics`): agrega en memoria sobre
   `findMany`; conviene mover las sumas a consultas agregadas (`groupBy`/SQL) para
   no traer todas las filas.
