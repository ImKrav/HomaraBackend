# Refactorización del backend guiada por las pruebas

Este documento presenta la versión **final** del backend de Homara, corregida a
partir de los hallazgos de **todas** las suites de prueba (unitarias y de
regresión con Vitest, API y seguridad en vivo, Cypress, Screenplay, k6), y la
compara con la versión **anterior** (commit `f38ffe2`, rama `main` antes de esta
refactorización).

La contraparte del frontend está en `HomaraFrontend/docs/REFACTORIZACION.md`.

## 1. Resumen: antes y después

| Indicador | Antes (`f38ffe2`) | Después |
|---|---|---|
| Suite por defecto (`npm test`) | 258 casos; **15 con `test.fails`** (defecto abierto) | **268 casos, 0 `test.fails`** (10 nuevos en `REG-DEF`) |
| API en vivo (`npm run test:api`) | 65/65, con `CP-API-DOC-04` como `test.fails` | **65/65 sin `test.fails`** |
| Seguridad en vivo (`npm run test:security`) | 33/33 = 22 controles + **11 defectos confirmados** (`test.fails`) | **33/33 controles; 0 defectos abiertos** |
| Demo de regresión por mutación | 14/14 errores detectados | **18/18** (4 mutaciones nuevas sobre las correcciones) |
| Defectos de seguridad abiertos | 8 Alta + 3 Media | **0** |
| Defectos funcionales abiertos (`tests/README.md`) | 14 | **0** (uno rechazado por conflicto de especificación, ver §4) |
| Defectos del backend hallados por Cypress/Screenplay | DEF-02, 03, 07, 08, 09, 10, 11, 21, 28 y OBS-03 | **0** |
| Rutas implementadas sin documentar en Swagger | 6 | **0** |
| Cambio en `src/` | — | 27 archivos, ≈ +400 / −145 líneas; 2 dependencias (`helmet`, `express-rate-limit`) |

Evidencias: `docs/pruebas/evidencias/test-*.txt` (después) y
`docs/pruebas/evidencias/antes-refactorizacion/` (antes).

## 2. Seguridad

| ID | Sev. | Antes | Después | Dónde |
|---|---|---|---|---|
| CP-SEG-DEF-01 / DEF-SEG-01 | Alta | `JWT_SECRET \|\| "homara_jwt_secret_key_2026_secure"`: con el secreto publicado se forjaba un token de ADMIN (200 en `/admin/metrics`) | `JWT_SECRET` **obligatorio**; la API no arranca si falta o si es el secreto publicado. Una sola fuente (`envConfig.jwtSecret`) en vez de dos copias del valor por defecto. `docker-compose` exige la variable (`${JWT_SECRET:?…}`) | `config/env.config.ts`, `shared/utils/authHelper.ts`, `docker-compose.yml`, `.env.example` |
| CP-SEG-DEF-02 / DEF-10 | Alta | `?admin=true` honrado para cualquier usuario: un CUSTOMER veía **todos** los pedidos | `admin` solo vale si `req.user.role === "ADMIN"` | `controllers/order.controller.ts` |
| CP-SEG-DEF-03/04/05 | Alta/Media | `req.user?.id \|\| req.query.userId`: sin token se leían pedidos, proyectos y carrito ajenos | El usuario sale **siempre** del token; `userId` salió de los esquemas de query (Zod lo descarta) | controladores de pedidos, proyectos y carrito; `validators/common.validator.ts` |
| CP-SEG-DEF-06 / DEF-10 | Alta | `GET /orders/:id` sin autenticación ni propiedad: exponía nombre, correo y dirección | `requireAuth` + verificación de propietario (o ADMIN) en `GetOrderDetailUseCase` → 401 / 403 | `routes/orders.ts`, `use-cases/order.use-cases.ts` |
| CP-SEG-DEF-07 / DEF-11 | Alta | `GET /projects/:id` sin autenticación ni propiedad | Igual que arriba; misma regla que ya tenían `PUT`/`DELETE` | `routes/projects.ts`, `use-cases/project.use-cases.ts` |
| CP-SEG-DEF-08 | Alta | `GET /users/:id` con `optionalAuth` entregaba el PII de cualquiera (y `me` sin sesión caía a un usuario "demo") | `requireAuth` + propio usuario o ADMIN (403); se eliminó `DEMO_USER_ID` | `routes/users.ts`, `controllers/auth.controller.ts` |
| CP-SEG-DEF-09 / DEF-07 | Alta | `PUT /users/:id` respondía la entidad del repositorio, **con el hash bcrypt** | Responde la misma proyección pública que `GET /users/me` | `controllers/auth.controller.ts` |
| CP-SEG-DEF-10 | Media | Sin cabeceras de seguridad | `helmet()` (nosniff, `X-Frame-Options`, CSP, HSTS…). Swagger UI sigue funcionando con la CSP (verificado en Chromium) | `http/express-server.ts` |
| CP-SEG-DEF-11 | Media | Login sin límite: 25 fallos seguidos sin bloqueo | `express-rate-limit`: **10 intentos fallidos por IP y correo cada 15 min** → 429 con el sobre de error uniforme. Los logins exitosos no cuentan, así que k6 y los usuarios legítimos no se ven afectados | `routes/users.ts` |

```ts
// ANTES — order.controller.ts
const userId = req.user?.id || (req.query.userId as string);
const isAdmin = req.query.admin === "true";

// DESPUÉS
if (!req.user) return res.json({ success: true, data: [] });
const isAdmin = req.user.role === "ADMIN" && String(req.query.admin) === "true";
const result = await listOrdersUseCase.execute({ userId: req.user.id, admin: isAdmin });
```

## 3. API y reglas de negocio

| ID | Antes | Después | Dónde |
|---|---|---|---|
| #10 / DEF-02 (Screenplay SP-24) | Envío gratis con `subtotal > 500000`: con 500.000 exactos se cobraban 25.000 (RN-031 dice "igual o mayor") | Regla única `calculateShipping()` en el dominio: `>= 500000` | `domain/services/shipping.ts` (nuevo), casos de uso de carrito y pedido |
| DEF-03 (Cypress) | Un carrito vacío cobraba envío: el checkout mostraba "Pagar $ 25.000" sin productos | Carrito vacío → envío 0 | `domain/services/shipping.ts` |
| DEF-03 (Screenplay SP-27) | Datos de envío con solo espacios creaban el pedido | `trim()` + no vacío en `createOrderSchema` → 400 | `validators/order.validator.ts` |
| DEF-08 (Cypress) | `PUT /users/me` aceptaba `firstName: ""` | `updateProfileSchema = registerSchema.partial()` → 400 | `validators/auth.validator.ts`, `routes/users.ts` |
| DEF-09 (Cypress) | Ítems del carrito con "Sin Categoría" (el repositorio no pasaba la relación al dominio) | Categoría y slug reales | `prisma-cart.repository.ts`, `cart.use-cases.ts` |
| DEF-21 (Cypress) | El carrito no enviaba `updatedAt` → la cuenta regresiva de la reserva nunca se veía | Se envía `updatedAt` de cada ítem | `cart.use-cases.ts` |
| DEF-28 (Cypress) | Cancelar un pedido no devolvía el stock (10 → 7 → 7) | En la misma transacción: entrar a `CANCELADO` repone las unidades y salir de él las vuelve a descontar | `prisma-order.repository.ts` |
| DEF-06 (Cypress, apoyo) | El listado de pedidos no traía la ciudad por la que el buscador del admin dice filtrar | Se agrega `shippingCity` al listado | `order.use-cases.ts` |
| #8 | El caso de uso guardaba una reseña con calificación 99 (solo el endpoint validaba) | Validación de dominio 1..5 en `CreateProductReviewUseCase` | `catalog.use-cases.ts` |
| #9 | Acumular en el carrito superaba el tope (9999 + 9999 = 19998) | `Math.min(…, 9999)` | `prisma-cart.repository.ts` |
| #11 | `totalUnits` restaba las existencias negativas | Suma solo existencias positivas | `admin.controller.ts` |
| #12 | Se podía publicar un producto con precio 0 | `price` positivo en alta y edición | `catalog.validator.ts` |
| #13 | Bajar el stock a 0 con `PUT` dejaba `inStock: true` | `inStock` se recalcula si cambia `stockQuantity` | `catalog.use-cases.ts` |
| #14 | (= CP-SEG-DEF-09) | Ver §2 | |
| OBS-03 (Screenplay) | Borrar un producto con pedidos decía "La entidad referenciada no existe" (engañoso) | "el registro está en uso por otros datos (p. ej. pedidos) o la referencia no existe" | `middlewares/errorHandler.ts` |
| CP-API-DOC-04 | 6 rutas sin documentar en Swagger | Documentadas vitrina, reseñas (GET/POST) y CRUD de productos; las rutas protegidas declaran `bearerAuth`, 401/403 y ya no anuncian `?userId=` | `routes/*.ts` |

## 4. Calculadora de materiales

| # | Antes | Después |
|---|---|---|
| 1 | `nombre.includes("cal")` clasificaba "Piso **Cal**acatta" como material de construcción (y la validación del proyecto lo rechazaba) | Palabras completas con plural (`/\b(pegante\|…\|cal)(e?s)?\b/`) en **una sola función** `classifyProductName`, que usan el calculador y la validación de proyectos (antes había dos listas duplicadas) |
| 2 | Paredes de un proyecto integral con un producto por galón: `precio_galón × m²` | Galones = ⌈m² / 30⌉ y precio por galón |
| 3 | `materialType` desconocido: se rotulaba "Cerámica 80x80" pero se cobraba a precio de 60x60 | Rótulo y precio salen de la misma tabla y formato |
| 5 | El insumo elegido (pegante/boquilla) desaparecía si no encajaba en ninguna rama | Se cotiza igual al final de la lista |
| 6 | Un producto por galón daba herramientas de **pintura** a un proyecto de baldosa | Proyecto de baldosa → nivel, llana y mazo |
| 7 | `PUT` con lista manual **y** un campo de cálculo descartaba la lista en silencio | La lista editada a mano tiene prioridad |
| 4 | "El desperdicio no se aplica a pegante/boquilla/crucetas" | **Rechazado por conflicto de especificación**: seis casos que ya pasaban (02-03, 02-07, 02-08, 02-10, 02-11, 02-12) fijan que los insumos se calculan sobre el **área neta** (el pegante cubre la superficie colocada; el desperdicio es de corte de baldosa). Se mantuvo esa regla y el caso 02-02 se alineó con ella, con la decisión anotada en el propio caso |

## 5. Pruebas actualizadas

- Los 15 casos `test.fails` de `tests/` y los 12 de `tests/api` y `tests/security`
  pasaron a `test(...)`: ahora **afirman el comportamiento correcto y pasan**.
- Los casos que fijaban el comportamiento inseguro o defectuoso se actualizaron a
  la regla nueva (p. ej. `REG-PROY-04` y `REG-ORD-07` exigen sesión; `UNIT-CTRL-*`
  comprueban 403 ante recursos ajenos; `CP-F-CHK-02-*` esperan envío 0 con carrito vacío).
- `CP-F-CHK-01-04` comprobaba el valor que **devuelve el doble** (programado en
  19998), no lo que el repositorio le pide guardar; ahora verifica que se pide
  guardar 9999.
- Nueva suite `tests/regression/REG-DEF.ts` (10 casos): helmet, 429 en el login,
  `userId`/`admin` ignorados, carrito de visitante, perfil ajeno, nombre vacío,
  espacios en el checkout, umbral de envío, proyección del perfil y pedido ajeno.
- `scripts/regression-demo.mjs`: +4 mutaciones (detalle de pedido ajeno, sin
  helmet, sin límite de login, hash en el perfil). La primera **no** la detectaba
  ninguna prueba hasta que se agregó `REG-DEF-10`.
- **Una regresión propia, detectada por Cypress:** la primera versión de la
  corrección de CP-SEG-DEF-02 comparaba `req.query.admin === true` confiando en la
  transformación de Zod, pero Express 5 recalcula `req.query` en cada lectura y el
  valor seguía siendo el texto `"true"`; el ADMIN dejó de ver todos los pedidos.
  Los flujos E2E del panel de pedidos fallaron, se corrigió y `REG-DEF-03` ahora
  cubre también el caso ADMIN.
- `CP-SEG-AUT-08/09` firmaban con el secreto por defecto (y pasaban por la razón
  equivocada); ahora usan el secreto real del servidor (`JWT_SECRET` en el entorno
  de la suite).

## 6. Lo que no se cambió (y por qué)

- **Rendimiento (k6):** las propuestas de `RENDIMIENTO.md` (paginación, caché,
  agregados SQL para métricas, escalado horizontal) son mejoras de capacidad, no
  defectos: ninguna petición falló. No se implementaron para no cambiar el
  contrato de `GET /products` que el frontend consume completo. k6 no se volvió a
  correr en esta refactorización (sin Docker en el entorno); el límite de login no
  afecta a k6 porque solo cuenta intentos **fallidos**.
- **OBS-06 (archivar productos):** requiere un campo nuevo en el esquema y filtros
  en todas las consultas; es una funcionalidad, no un defecto.
- **DEF-SEG-FE-02 (JWT en `localStorage`):** migrar a cookie `HttpOnly` cambia el
  contrato de autenticación de ambos repositorios y de todas las suites E2E; queda
  como el siguiente paso recomendado (ver el documento del frontend).

## 7. Cómo reproducir

```bash
npm install && npx prisma generate
npm test                                  # 268/268
npm run test:regression:demo              # 18/18 mutaciones detectadas

# En vivo (requiere el stack arriba; JWT_SECRET igual al del backend).
# En esta refactorización también se corrió la suite Cypress completa del frontend
# contra este backend: 232/232 (ver HomaraFrontend/docs/REFACTORIZACION.md).
export JWT_SECRET=<el del backend>
API_URL=http://localhost:5000 npm run test:api        # 65/65
API_URL=http://localhost:5000 npm run test:security   # 33/33
```
