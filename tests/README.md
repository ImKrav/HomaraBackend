# Pruebas del backend

Suite sobre **Vitest**. Los dobles son mocks de Vitest usados con su API a la
vista (`vi.fn()`, `vi.mock()`), sin ninguna capa intermedia y sin costuras de
prueba en el código de producción. Los casos siguen derivando del método de
**cobertura de ruta básica de McCabe** (ISTQB, ISO/IEC/IEEE 29119); los ids del
plan no cambiaron.

Todos los casos están escritos con el **patrón AAA** (Arrange · Act · Assert),
marcado explícitamente con comentarios en cada cuerpo de prueba:

```ts
test("CP-F-AUTH-01-02", "Rechaza registro si el correo ya existe", async () => {
  // Arrange
  const repo = fakeUsuarios();
  const caso = new RegisterUserUseCase(repo as any);
  repo.findByEmail.mockResolvedValue(usuario());

  // Act
  const error = await grab(caso.execute(datosRegistro() as any));

  // Assert
  expect(error).toBeInstanceOf(AppError);
  expect(error.message).toBe("El correo electrónico ya está registrado.");
  expect(repo.create).not.toHaveBeenCalled();
});
```

Regla: el **Act** es una sola invocación de la unidad bajo prueba (o una por
escenario, cuando el caso cubre varios); ninguna aserción vive antes de él. Si
un escenario necesita rearmar un doble a mitad de camino, ese rearmado va en el
Act con un comentario, y el valor que se va a comprobar se captura ahí mismo
—antes de que un `mockReset()` lo borre.

## Cómo ejecutar

```bash
npm install
npx prisma generate                  # necesario: los repos importan el cliente generado
npm test                             # corre los 268 casos
npm run test:watch                   # modo watch de Vitest
npm test -- tests/F-CHK-01.ts        # un archivo
npm test -- -t CP-F-AUTH-01-02       # un caso por id (filtro por nombre)
npm test -- -t F-CHK                 # un módulo (subcadena del id)
npm run test:coverage                # cobertura v8
```

`npm test` es `vitest run`. Un run limpio hoy es `268 passed (268)` y sale con
código 0, **sin ningún `test.fails`**: los 15 casos que documentaban defectos
abiertos se corrigieron en el código y volvieron a `test(...)` (ver la tabla de
defectos abajo y `docs/REFACTORIZACION.md`).

## Estructura

| Archivo | Qué contiene |
|---|---|
| `vitest.config.ts` | `include: tests/**/*.ts` (menos `harness`/`helpers`), cobertura v8 y el alias que traduce los imports `"./x.js"` de ESM NodeNext a los `.ts` reales. |
| `tests/harness.ts` | `test(id, desc, fn)` → `it()` de Vitest, `grab`/`grabSync` para capturar errores en el Act, y re-export de `expect` / `vi` (salvo para `vi.mock()`, que exige importar `vi` de `"vitest"`). Todas las aserciones son fluidas: `expect(x).toBe(y)`, y `expect.soft(...)` para las no abortivas. |
| `tests/helpers.ts` | Repositorios falsos como objetos de `vi.fn()` (`fakeUsuarios()`, `fakeCarritos()`…), fábricas de datos en español (`producto()`, `proyecto()`, `carrito()`…), `contextoExpress()` y `conRelojFijo()`. |
| `tests/mocks/repositorios.ts` | Instancias de mock compartidas entre la prueba y el código bajo prueba, más `reiniciarRepositorios()`. Excluido del `include` de Vitest. |
| `tests/F-<MODULO>-<NN>.ts` | Un archivo por unidad / grafo de flujo. |
| `tests/unit-*.ts` | Pruebas unitarias de controladores, repositorios Prisma, middlewares, validadores y rutas. |

No hay `run-all.ts`: Vitest descubre los archivos por el `include` del config.

### Mocks

No hay capa intermedia: los dobles **son** mocks de Vitest y se usan con su API
a la vista. Los repositorios falsos de `helpers.ts` son objetos planos de
`vi.fn()`, y en los casos se programan y comprueban así:

| Para qué | Cómo |
|---|---|
| Crear el doble | `vi.fn()` (o `vi.fn(impl)` con implementación por defecto) |
| Programar el retorno | `.mockResolvedValue(v)` · `.mockRejectedValue(e)` · `.mockReturnValue(v)` |
| Implementación propia | `.mockImplementation(f)` |
| Encolar una sola llamada | `.mockResolvedValueOnce(v)` |
| Rearmar a mitad de caso | `.mockReset()` (vuelve a la implementación inicial) |
| Inspeccionar argumentos | `.mock.calls[i][j]` |
| Comprobar la llamada | `expect(m).toHaveBeenCalledWith(...)` · `expect(m).not.toHaveBeenCalled()` |
| Congelar el reloj | `vi.useFakeTimers()` + `vi.setSystemTime()` (en `conRelojFijo`) |

Recuento actual: 129 `vi.fn()`, 208 programaciones (`mock*Value*`), 97 lecturas
de `.mock.calls` y 79 aserciones con matchers de mock.

#### Mockeo de módulos

Los controladores y `middlewares/auth.ts` construyen sus repositorios Prisma en
el ámbito del módulo y se los pasan a los casos de uso al importarse. Para
sustituirlos **no hay ninguna costura en producción**: se mockea el módulo, y el
constructor devuelve el doble compartido de `tests/mocks/repositorios.ts`.

```ts
vi.mock("../src/infrastructure/database/repositories/prisma-cart.repository.js", async () => {
  const { mockCarritos } = await import("./mocks/repositorios.js");
  return { PrismaCartRepository: vi.fn(() => mockCarritos) };
});

beforeEach(reiniciarRepositorios);
```

Como los casos de uso capturan la referencia al importar, `reiniciarRepositorios()`
no crea objetos nuevos: **renueva las propiedades del mismo objeto**, así cada caso
arranca con mocks limpios sin romper esa referencia.

`vi` se importa de `"vitest"` directamente en los archivos que usan `vi.mock()`:
la llamada se hoistea y Vitest no reconoce un `vi` re-exportado por `harness.ts`.

Archivos con `vi.mock()`: `unit-controllers.ts` (8 módulos), `unit-auth-middleware.ts`,
`unit-routes-and-server.ts`, `F-AUTH-03`, `F-ADM-01`, `F-ADM-02`, `F-ADM-03`.

Las pruebas de repositorio (`unit-prisma-repositories.ts`, `F-CAT-01`, `F-CHK-*`)
siguen inyectando un cliente `db` falso por constructor
(`new PrismaCartRepository(dbFalso)`), que es una dependencia declarada, no una
costura. Ninguna prueba toca una base de datos real.

## Catálogo de casos

| Módulo | Archivos | Casos |
|---|---|---|
| Autenticación (`F-AUTH`) | 3 | 18 |
| Catálogo (`F-CAT`) | 3 | 19 |
| Carrito y pago (`F-CHK`) | 3 | 15 |
| Proyectos (`F-PROY`) | 3 | 43 |
| Administración (`F-ADM`) | 3 | 16 |
| **Subtotal flujos** | **15** | **111** |
| Unitarias (`unit-*`) | 8 | 85 |
| Regresión (`regression/REG-*`) | 11 | 72 |
| **Total** | **34** | **268** |

## Pruebas de regresión

`tests/regression/` es la suite que se vuelve a correr después de cada cambio
para comprobar que **todas las funcionalidades** siguen funcionando. Hay un
archivo por módulo que recorre la app Express real por HTTP (solo los
repositorios Prisma son dobles, con JWT reales), más cuatro archivos que
protegen correcciones puntuales y contratos con el frontend. Mismo harness,
aserciones fluidas y AAA.

```bash
npm run test:regression        # solo tests/regression (también corren en npm test)
npm run test:regression:demo   # demuestra que la suite detecta cambios que rompen algo
```

| Archivo | Funcionalidad / qué protege | Casos |
|---|---|---|
| `REG-AUTH.ts` | Registro (rol CUSTOMER, clave cifrada, correo normalizado), login, perfil sin contraseña, token de usuario dado de baja, edición de perfil sin escalar rol | 8 |
| `REG-CAT.ts` | Listado con filtros, stock visible menos reservas de otros carritos (15 min), ficha 404, reseñas (listado, promedio, una por usuario, rango 1..5), vitrina | 8 |
| `REG-CART.ts` | Carrito de visitante, subtotal/envío/backorder, envío gratis > 500.000, agregar exige sesión y CUID, nadie toca ítems ajenos | 7 |
| `REG-ORD.ts` | Checkout con carrito vacío, precios tomados del carrito, envío, listado del cliente, solo ADMIN cambia estados y solo a valores válidos | 7 |
| `REG-PROY.ts` | Crear proyecto con materiales y costo en pesos enteros, validación, listado propio, 404, editar recalcula (solo si cambian datos de cálculo), solo el dueño edita o borra | 9 |
| `REG-ADM.ts` | Acceso exclusivo de ADMIN, métricas (solo pedidos ENTREGADOS), inventario por umbrales, alta/edición/baja de productos, precios y stock no negativos | 5 |
| `REG-SEG.ts` | `b4d9ad4`, `53729d7` — CORS por lista blanca: no refleja orígenes ajenos ni responde `*`; `CORS_ORIGINS` se recorta y en producción sin configurar no permite nada | 6 |
| `REG-API.ts` | Reescritura `/api/*` → `/api/v1/*` y el sobre `{ success, data }` / `{ success: false, error }` que consume el frontend | 3 |
| `REG-VAL.ts` | `aecb5e1` — `cuidValidator` acepta y rechaza los mismos IDs que `z.cuid()` y conserva los mensajes | 4 |
| `REG-DEF.ts` | Correcciones de la refactorización: helmet, límite de login (429), `userId`/`admin` ignorados, carrito de visitante, perfil y pedido ajenos (403), nombre vacío, espacios en el checkout, umbral de envío y proyección del perfil | 10 |
| `REG-MAT.ts` | `b4d9ad4`, `da2b147` — ramas de respaldo de pegante/boquilla vinculados, `materialType` sin distinguir mayúsculas, y el vocabulario de nombres/notas que el frontend traduce por texto literal (contraparte: `HomaraFrontend/tests/regression/REG-I18N.test.mts`) | 5 |

`tests/regression/soporte.ts` (excluido del `include`) levanta la app en un
puerto libre (`pedir()`) y firma sesiones reales (`sesion()`).

### Demostración: la suite detecta los cambios que rompen algo

`npm run test:regression:demo` (`scripts/regression-demo.mjs`) introduce a
propósito, de a uno, un error conocido en cada funcionalidad, corre la suite y
restaura el archivo byte a byte (también si se interrumpe). Termina con código 1
si algún error pasa inadvertido. Salida actual:

```
Línea base: 72/72 casos en verde
✔ detectado  [Autenticación] El registro asigna rol ADMIN en vez de CUSTOMER → REG-AUTH-01
✔ detectado  [Catálogo] El listado ignora las reservas de otros carritos → REG-CAT-02
✔ detectado  [Catálogo] Las reseñas de un producto dejan de listarse → REG-CAT-08
✔ detectado  [Carrito] Un usuario puede modificar ítems de otro carrito → REG-CART-06
✔ detectado  [Carrito] Nunca se marca backorder → REG-CART-02
✔ detectado  [Pedidos] Envío gratis desde 50.000 en vez de 500.000 → REG-CART-02, REG-DEF-08, REG-ORD-02
✔ detectado  [Pedidos] Un cliente vuelve a leer el detalle de un pedido ajeno → REG-DEF-10
✔ detectado  [Seguridad] Se quita helmet (sin cabeceras de seguridad) → REG-DEF-01
✔ detectado  [Seguridad] El login vuelve a no limitar intentos → REG-DEF-02
✔ detectado  [Seguridad] Editar el perfil vuelve a devolver la entidad con el hash → REG-AUTH-08, REG-DEF-09
✔ detectado  [Proyectos] Cualquiera puede borrar un proyecto ajeno → REG-PROY-05
✔ detectado  [Proyectos] Cualquiera puede editar un proyecto ajeno → REG-PROY-08
✔ detectado  [Proyectos] Cambia una nota del calculador que el frontend traduce → REG-MAT-01
✔ detectado  [Administración] Un cliente entra a las rutas de administrador → REG-ADM-01, REG-ORD-05
✔ detectado  [Administración] El umbral de stock bajo pasa de 50 a 5 unidades → REG-ADM-03
✔ detectado  [Seguridad] CORS refleja cualquier origen → REG-SEG-01, REG-SEG-03
✔ detectado  [API] Se quita la compatibilidad /api/* → /api/v1/* → REG-API-01
✔ detectado  [Validación] El validador CUID acepta guiones (UUID) → REG-VAL-02
Resultado: 18/18 errores detectados por la suite. Código restaurado.
```

`REG-MAT` no compara la lista completa de materiales, para no fijar los
defectos abiertos del calculador.

## Defectos localizados — corregidos

Estos 15 casos estuvieron declarados con `test.fails(...)` mientras el defecto
seguía abierto. Tras la refactorización **todos pasan como `test(...)`**: el
código cumple la regla de negocio. La tabla se conserva como trazabilidad; el
antes/después de cada uno está en `docs/REFACTORIZACION.md`.

| # | Defecto (antes) | Corrección | Caso |
|---|---|---|---|
| 1 | `nombre.includes("cal")` rechazaba «Piso Calacatta» | Palabras completas en `classifyProductName` (compartida) | `CP-F-PROY-01-06`, `CP-F-PROY-02-08` |
| 2 | Paredes con producto por galón: `precio_galón × m²` | Galones = ⌈m²/30⌉ | `CP-F-PROY-02-02` |
| 3 | `materialType` desconocido cobrado con el precio de otro formato | Rótulo y precio de la misma tabla | `CP-F-PROY-02-19` |
| 4 | Desperdicio no aplicado a pegante/boquilla/crucetas | **Rechazado** (conflicto con 02-03/07/08/10/11/12: insumos sobre área neta); 02-02 alineado | `CP-F-PROY-02-02` |
| 5 | El producto elegido desaparecía de la cotización | Se cotiza siempre | `CP-F-PROY-02-06` |
| 6 | Herramientas de pintura en un proyecto de baldosa | Herramientas de baldosa | `CP-F-PROY-02-02` |
| 7 | Lista manual descartada al recalcular | La lista manual tiene prioridad | `CP-F-PROY-03-07` |
| 8 | Calificación 99 guardada por el caso de uso | Validación 1..5 en el dominio | `CP-F-CAT-03-04c` |
| 9 | 9999 + 9999 = 19998 en el carrito | Tope de 9999 | `CP-F-CHK-01-04` |
| 10 | Envío cobrado con 500.000 exactos | `>= 500000` (y 0 con carrito vacío) | `CP-F-CHK-02-06`, `CP-F-CHK-03-03` |
| 11 | `totalUnits` restaba negativos | Solo positivos | `CP-F-ADM-03-01`, `CP-F-ADM-03-05` |
| 12 | Producto con precio 0 aceptado | Precio > 0 | `CP-F-ADM-02-04` |
| 13 | Stock 0 con `PUT` seguía disponible | `inStock` recalculado | `CP-F-ADM-02-05` |
| 14 | `PUT /users/:id` devolvía el hash | Proyección pública | `REG-AUTH-08` |
