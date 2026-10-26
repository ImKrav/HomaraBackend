# Pruebas de seguridad (revisión defensiva)

Revisión defensiva del **propio** backend del equipo. Se verifican, con peticiones
reales contra el stack levantado, los controles de **acceso, autenticación,
validación de entrada y configuración**. No se emplean cargas útiles más allá de
lo necesario para evidenciar cada hallazgo.

- Suite: `tests/security/*.ts`
- Configuración: `vitest.security.config.ts` (fuera del `vitest run` por defecto)
- Ejecución: `npm run test:security` (requiere el stack arriba en `API_URL`, por
  defecto `http://localhost:5000`)
- Evidencia de la corrida: [`evidencias/test-security.txt`](evidencias/test-security.txt)

Convención (antes de la refactorización): cada caso **afirma el comportamiento seguro
esperado** y se marcaba con `test.fails(...)`. Mientras el defecto siga abierto el
caso queda **en verde** (se espera que falle). Si alguien corrige el código, el
caso se pondrá **rojo** con «expected to fail, but passed»: esa es la señal para
devolverlo a `test(...)` normal y cerrar la fila de la tabla.

## Controles verificados que SÍ funcionan (`SEG-CONTROLES.ts`)

| ID | ESC / RN | Objetivo | Resultado |
|---|---|---|---|
| CP-SEG-AUT-01..06 | ESC36 / RN-008 | Rutas protegidas sin token responden 401 (`/users/me`, `/cart/items`, `/orders`, `/projects`, `/admin/*`) | Aprobado |
| CP-SEG-AUT-07 | RN-008 | Token malformado se rechaza (401) | Aprobado |
| CP-SEG-AUT-08 | RN-008 | Token expirado se rechaza (401) | Aprobado |
| CP-SEG-AUT-09 | RN-008 | Token de usuario inexistente se rechaza (401) | Aprobado |
| CP-SEG-AUT-10 | ESC06 / RN-010 | Un CUSTOMER no entra a rutas de administrador (403) | Aprobado |
| CP-SEG-CRED-01 | ESC35 / RN-005 | Login no devuelve la contraseña ni el hash bcrypt | Aprobado |
| CP-SEG-CRED-02 | ESC35 / RN-006 | Error de login genérico (no revela si el correo existe) | Aprobado |
| CP-SEG-CRED-03 | ESC35 / RN-005 | `GET /users/me` nunca incluye la contraseña | Aprobado |
| CP-SEG-CRED-04 | RN-012 | `PUT /users/:id` no permite escalar el rol a ADMIN | Aprobado |
| CP-SEG-CRED-05 | ESC36 / RN-011 | Un usuario no puede editar el perfil de otro (403) | Aprobado |
| CP-SEG-ERR-01 | ESC41 / RN-062 | Errores con sobre uniforme `{success:false,error}` | Aprobado |
| CP-SEG-ERR-02 | ESC41 | En producción el error NO filtra el stack trace | Aprobado |
| CP-SEG-ERR-03 | ESC41 / RN-063 | JSON malformado se maneja con el sobre uniforme (400) | Aprobado |
| CP-SEG-CFG-01 | Config | No se expone `X-Powered-By` | Aprobado |
| CP-SEG-CFG-02 | Config | Existe límite de tamaño de cuerpo (payload grande = 413) | Aprobado |
| CP-SEG-CORS-01 | ESC36 | CORS refleja exactamente el origen permitido, nunca `*` | Aprobado |
| CP-SEG-CORS-02 | ESC36 | CORS no refleja un origen ajeno a la lista blanca | Aprobado |

Observaciones que **refutan** sospechas iniciales:

- **Sí hay límite de tamaño de cuerpo** (Express `express.json()` por defecto,
  ~100 kb → 413). No es un defecto.
- **RN-012 se cumple**: aunque `PUT /users/:id` reciba `role`, el controlador usa
  una lista blanca de campos y el rol no cambia.
- **El error de login es genérico** y no distingue correo inexistente de
  contraseña incorrecta (RN-006).

## Defectos confirmados (`SEG-DEFECTOS.ts`) — **todos corregidos**

> Tras la refactorización los 11 casos dejaron de ser `test.fails` y pasan
> afirmando el comportamiento seguro. Detalle de cada corrección en
> [`../REFACTORIZACION.md`](../REFACTORIZACION.md#2-seguridad).

Todos confirmados con peticiones reales. Severidad según impacto sobre
confidencialidad/integridad y facilidad de explotación.

| ID | ESC | Sev. | Defecto confirmado | Comportamiento correcto esperado | Corrección recomendada |
|---|---|---|---|---|---|
| CP-SEG-DEF-01 | ESC35 | **Alta** | Un JWT de ADMIN **forjado** con el secreto por defecto (`homara_jwt_secret_key_2026_secure`, fallback embebido en `authHelper.ts`) es aceptado: `GET /admin/metrics` → 200 | El token forjado debe rechazarse (401) | Exigir `JWT_SECRET` por entorno **sin fallback**; abortar el arranque si falta; rotar el secreto |
| CP-SEG-DEF-02 | ESC36 | **Alta** | `GET /orders?admin=true` con token de **CUSTOMER** lista TODOS los pedidos del sistema | El cliente solo debe ver sus propios pedidos | Validar `req.user.role === "ADMIN"` antes de honrar `admin=true` |
| CP-SEG-DEF-03 | ESC36 | **Alta** | `GET /orders?userId=<ajeno>` **sin token** devuelve los pedidos de ese usuario | Sin sesión no debe devolver datos ajenos (401/propios) | Reemplazar `optionalAuth` por `requireAuth` e ignorar `userId` del query; derivar siempre del token |
| CP-SEG-DEF-04 | ESC36 | **Alta** | `GET /projects?userId=<ajeno>` **sin token** filtra los proyectos de ese usuario | Igual que arriba | `requireAuth` + ignorar `userId` del query |
| CP-SEG-DEF-05 | ESC36 | **Media** | `GET /cart?userId=<ajeno>` **sin token** expone el carrito de otro usuario | Igual que arriba | `requireAuth` + ignorar `userId` del query |
| CP-SEG-DEF-06 | ESC36 | **Alta** | `GET /orders/:id` **sin token ni verificación de propiedad** expone el detalle y el **PII** del cliente (nombre + correo) | Exigir sesión y que el pedido sea del usuario (o ADMIN) | Añadir `requireAuth` y verificación de propiedad en el caso de uso |
| CP-SEG-DEF-07 | ESC36 | **Alta** | `GET /projects/:id` **sin token ni propiedad** expone el proyecto de cualquiera | Igual que arriba | `requireAuth` + verificación de propiedad |
| CP-SEG-DEF-08 | ESC36 | **Alta** | `GET /users/:id` expone el **PII** (teléfono, dirección, correo) de cualquier usuario sin verificar propiedad | Solo el propio usuario o un ADMIN; o no exponer PII | Verificación de propiedad/rol y recorte de campos sensibles |
| CP-SEG-DEF-09 | ESC35 | **Alta** | `PUT /users/:id` responde con la entidad completa **incluido el hash de la contraseña** | La respuesta nunca debe incluir `password` | Mapear la salida con la misma proyección que `formatUserProfile` |
| CP-SEG-DEF-10 | ESC35 | **Media** | No hay **cabeceras de seguridad** (sin `X-Content-Type-Options`, `X-Frame-Options`, HSTS, CSP) | Cabeceras endurecidas por defecto | Añadir `helmet()` en `express-server.ts` |
| CP-SEG-DEF-11 | ESC35 | **Media** | El login **no limita intentos** (sin rate limiting): 25 intentos seguidos, ninguno bloqueado | Bloquear tras N intentos fallidos (429) | `express-rate-limit` sobre `/users/login` (y global) |

### Notas de explotación (mínimas)

- **DEF-01** se evidencia firmando un JWT HS256 a mano con el secreto conocido
  (`tests/api/soporte-api.ts → firmarTokenConSecretoPorDefecto`). Es el hallazgo
  más crítico: habilita suplantar al administrador sin credenciales.
- **DEF-02..08** son fallas de **control de acceso roto / IDOR**: la API confía en
  parámetros del cliente (`userId`, `admin`) o no verifica propiedad en `/:id`.
- **DEF-09** es fuga de dato sensible en la respuesta (coincide con el defecto #14
  del `tests/README.md`, caso `REG-AUTH-08`).

### Prioridad de corrección sugerida

1. **DEF-01** (secreto JWT) y **DEF-06/07/08** (exposición de PII sin auth) — Alta.
2. **DEF-02/03/04** (listados con `admin`/`userId` sin verificación) — Alta.
3. **DEF-09** (hash en respuesta) — Alta.
4. **DEF-05, DEF-10, DEF-11** (carrito ajeno, helmet, rate limiting) — Media.
