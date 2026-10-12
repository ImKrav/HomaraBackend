# Pruebas de API (HTTP en vivo)

Pruebas de contrato y comportamiento contra la API **real** levantada (sin mocks),
con `fetch` nativo de Node. Casos positivos y negativos, con aserciones sobre
código de estado, forma del cuerpo y sobre `{success,data}` / `{success:false,error}`.

- Suite: `tests/api/*.ts`
- Configuración: `vitest.api.config.ts` (fuera del `vitest run` por defecto)
- Ejecución: `npm run test:api` (requiere el stack arriba en `API_URL`, por
  defecto `http://localhost:5000`)
- Evidencia de la corrida: [`evidencias/test-api.txt`](evidencias/test-api.txt)

Los usuarios y datos de prueba se crean con correos/nombres con sello de tiempo
(`qa_<timestamp>@test.local`) para no colisionar con la semilla ni con otros
agentes. Los productos creados por el ADMIN se eliminan en el mismo caso.

**Resultado de la última corrida: 65/65 Aprobados.**

## Autenticación y usuarios — `API-AUTH.ts` (ESC01, ESC02, ESC35)

| ID | ESC / RN | Objetivo | Esperado | Estado |
|---|---|---|---|---|
| CP-API-AUTH-01 | ESC01 / RN-001,002 | Registrar usuario válido | 201 con sesión, rol CUSTOMER | Aprobado |
| CP-API-AUTH-02 | ESC01 / RN-005 | El registro no devuelve contraseña | sin `password` | Aprobado |
| CP-API-AUTH-03 | ESC01 / RN-004 | Correo normalizado a minúsculas | `email` en minúsculas | Aprobado |
| CP-API-AUTH-04 | ESC01 / RN-002,063 | Rechaza clave de menos de 8 caracteres | 400 con error uniforme | Aprobado |
| CP-API-AUTH-05 | ESC01 / RN-001 | Rechaza correo con formato inválido | 400 | Aprobado |
| CP-API-AUTH-06 | ESC01 / RN-003 | Rechaza correo duplicado | 400 | Aprobado |
| CP-API-AUTH-07 | ESC02 | Login con credenciales correctas | 200 + token | Aprobado |
| CP-API-AUTH-08 | ESC02 / RN-006 | Error genérico con contraseña incorrecta | 401 genérico | Aprobado |
| CP-API-AUTH-09 | ESC02 / RN-006 | Mismo error con correo inexistente | 401 genérico idéntico | Aprobado |
| CP-API-AUTH-10 | ESC02 | `GET /users/me` del autenticado | 200, perfil sin password | Aprobado |
| CP-API-AUTH-11 | RN-007 | El token expira a 7 días | `exp-iat = 7 días` | Aprobado |
| CP-API-AUTH-12 | ESC36 / RN-011 | El usuario edita su propio perfil | 200 | Aprobado |

## Catálogo: categorías, productos y reseñas — `API-CATALOGO.ts` (ESC08, ESC09)

| ID | ESC / RN | Objetivo | Esperado | Estado |
|---|---|---|---|---|
| CP-API-CAT-01 | ESC08 | Listar categorías | 200, array, con `slug` | Aprobado |
| CP-API-CAT-02 | ESC08 | Listar productos | 200, forma esperada | Aprobado |
| CP-API-CAT-03 | ESC09 / RN-016 | Filtrar por categoría | todos del slug | Aprobado |
| CP-API-CAT-04 | ESC09 / RN-016 | Búsqueda insensible a mayúsculas | igual nº de resultados | Aprobado |
| CP-API-CAT-05 | ESC09 / RN-017 | Combinar categoría + texto | respeta ambos filtros | Aprobado |
| CP-API-CAT-06 | ESC08 | Detalle de producto | 200, `id` correcto | Aprobado |
| CP-API-CAT-07 | ESC08 / RN-062 | Producto inexistente | 404 + sobre error | Aprobado |
| CP-API-CAT-08 | ESC08 | Vitrina (storefront) | recomendados/ofertas/más vendidos | Aprobado |
| CP-API-CAT-09 | RN-020 | Listar reseñas | 200, array | Aprobado |
| CP-API-CAT-10 | RN-020 | Una reseña por usuario y producto | 2ª reseña 400 | Aprobado |
| CP-API-CAT-11 | RN-063 | Calificación fuera de rango | 400 | Aprobado |
| CP-API-CAT-12 | ESC36 | Crear reseña sin token | 401 | Aprobado |

## Carrito — `API-CARRITO.ts` (ESC13, ESC16)

| ID | ESC / RN | Objetivo | Esperado | Estado |
|---|---|---|---|---|
| CP-API-CART-01 | ESC13 | Carrito de visitante | 200, vacío, totales 0 | Aprobado |
| CP-API-CART-02 | ESC13 / RN-063 | Agregar exige sesión | 401 | Aprobado |
| CP-API-CART-03 | ESC13 / RN-063 | `productId` no CUID | 400 | Aprobado |
| CP-API-CART-04 | ESC13 | Agregar producto | 201 | Aprobado |
| CP-API-CART-05 | RN-024 | Acumula cantidad (2+3=5) | 1 ítem, qty 5 | Aprobado |
| CP-API-CART-06 | ESC16 / RN-029..031 | Subtotal y envío (≤500k = 25.000) | totales correctos | Aprobado |
| CP-API-CART-07 | ESC16 / RN-032 | Envío gratis > 500.000 | shipping 0 | Aprobado |
| CP-API-CART-08 | RN-011 / ESC36 | Ítem inexistente | 404 | Aprobado |
| CP-API-CART-09 | RN-011 / ESC36 | No modificar ítem ajeno | 403 | Aprobado |
| CP-API-CART-10 | ESC13 | Eliminar ítem propio | 200 | Aprobado |

## Pedidos — `API-PEDIDOS.ts` (ESC28, ESC34, ESC37)

| ID | ESC / RN | Objetivo | Esperado | Estado |
|---|---|---|---|---|
| CP-API-ORD-01 | ESC28 / RN-036,042 | Checkout genera pedido | 201, PENDIENTE, `ORD-YYYY-NNN` | Aprobado |
| CP-API-ORD-02 | ESC28 / RN-038 | Carrito vacío tras pedido | items = [] | Aprobado |
| CP-API-ORD-03 | ESC28 / RN-063 | Checkout con carrito vacío | 400 | Aprobado |
| CP-API-ORD-04 | ESC28 | Checkout sin token | 401 | Aprobado |
| CP-API-ORD-05 | ESC28 / RN-063 | Método de pago obligatorio | 400 | Aprobado |
| CP-API-ORD-06 | ESC28 | Cliente lista sus pedidos | ve el recién creado | Aprobado |
| CP-API-ORD-07 | ESC28 | Detalle por número | 200, con items | Aprobado |
| CP-API-ORD-08 | ESC28 / RN-062 | Pedido inexistente | 404 | Aprobado |
| CP-API-ORD-09 | ESC34 / RN-010 | CUSTOMER no cambia estado | 403 | Aprobado |
| CP-API-ORD-10 | ESC34 / RN-043 | ADMIN cambia a estado válido | 200 | Aprobado |
| CP-API-ORD-11 | ESC34 / RN-043 | Estado fuera del catálogo | 400 | Aprobado |

## Proyectos — `API-PROYECTOS.ts` (ESC17, ESC36)

| ID | ESC / RN | Objetivo | Esperado | Estado |
|---|---|---|---|---|
| CP-API-PROY-01 | ESC17 | Crear proyecto + materiales | 201 | Aprobado |
| CP-API-PROY-02 | ESC17 | Crear sin token | 401 | Aprobado |
| CP-API-PROY-03 | ESC17 / RN-063 | Tipo inválido | 400 | Aprobado |
| CP-API-PROY-04 | ESC17 / RN-063 | Área no positiva | 400 | Aprobado |
| CP-API-PROY-05 | ESC17 | Lista solo sus proyectos | ve el propio | Aprobado |
| CP-API-PROY-06 | ESC17 / RN-062 | Proyecto inexistente | 404 | Aprobado |
| CP-API-PROY-07 | ESC36 / RN-011 | No editar proyecto ajeno | 403 | Aprobado |
| CP-API-PROY-08 | ESC36 / RN-011 | No borrar proyecto ajeno | 403 | Aprobado |
| CP-API-PROY-09 | ESC17 / RN-011 | El dueño edita y borra | 200 | Aprobado |

## Administración — `API-ADMIN.ts` (ESC06, ESC32)

| ID | ESC / RN | Objetivo | Esperado | Estado |
|---|---|---|---|---|
| CP-API-ADM-01 | ESC06 / RN-010 | `/admin/metrics` sin token | 401 | Aprobado |
| CP-API-ADM-02 | ESC06 / RN-010 | CUSTOMER en `/admin/metrics` | 403 | Aprobado |
| CP-API-ADM-03 | ESC06 | ADMIN obtiene métricas | 200 + `charts` | Aprobado |
| CP-API-ADM-04 | ESC06 | ADMIN obtiene inventario | 200 + `stats` | Aprobado |
| CP-API-ADM-05 | ESC32 / RN-010 | CUSTOMER no crea productos | 403 | Aprobado |
| CP-API-ADM-06 | ESC32 | ADMIN crea/edita/borra producto | ciclo 201/200/200 | Aprobado |
| CP-API-ADM-07 | ESC32 / RN-063 | Precio negativo | 400 | Aprobado |

## Contrato de documentación — `API-CONTRATO.ts` (ESC42, RN-064)

Compara las rutas publicadas en `/api-docs` (documento OpenAPI que sirve
swagger-ui-express) contra las rutas realmente implementadas.

| ID | ESC / RN | Objetivo | Esperado | Estado |
|---|---|---|---|---|
| CP-API-DOC-01 | ESC42 | `/api-docs` expone OpenAPI 3 con rutas | doc válido | Aprobado |
| CP-API-DOC-02 | ESC42 / RN-064 | Toda ruta documentada existe (sin rutas fantasma) | 0 faltantes | Aprobado |
| CP-API-DOC-03 | ESC42 | Rutas públicas principales documentadas | 0 sin documentar | Aprobado |
| CP-API-DOC-04 | ESC42 / RN-064 | **DEFECTO**: rutas implementadas sin documentar | `test.fails` (en verde) | Defecto |

**Defecto de documentación (CP-API-DOC-04):** quedan sin bloque `@openapi` las
rutas `GET /products/storefront`, `GET`/`POST /products/{id}/reviews` y el CRUD de
administración de productos (`POST /products`, `PUT /products/{id}`,
`DELETE /products/{id}`). Severidad **Baja**. Corrección: documentarlas en
`routes/products.ts`.
