# Pruebas manuales del backend

Suite de verificación **a la antigua**: sin Vitest, sin librería de mocks. Son
scripts de Node en TypeScript que llaman al código real, comprueban con
`node:assert/strict` e imprimen `[PASS]` / `[FAIL]` por caso.

Los casos siguen derivando del método de **cobertura de ruta básica de McCabe**
(ISTQB, ISO/IEC/IEEE 29119); solo cambió la forma de ejecutarlos.

## Cómo ejecutar

```bash
npm install
npx prisma generate          # necesario: los repos importan el cliente generado
npm test                     # corre los 109 casos
npm test -- F-CHK            # filtra por módulo (subcadena del id)
npm test -- CP-F-AUTH-01-02  # un caso puntual
```

`npm test` es `tsx tests/run-all.ts`. Sale con código ≠ 0 si algún caso falla,
**incluidos los 14 casos que documentan defectos abiertos** (ver tabla abajo):
un run limpio hoy es `95 passed, 14 failed`.

## Estructura

| Archivo | Qué contiene |
|---|---|
| `tests/harness.ts` | Registro de casos (`test`), ejecutor (`run`), aserciones (`is`, `eq`, `ok`, `has`, `subset`, `grab`…) y `soft()` para aserciones no abortivas. |
| `tests/helpers.ts` | `spy()` artesanal, repositorios falsos (`fakeUsuarios()`, `fakeCarritos()`…), fábricas de datos en español (`producto()`, `proyecto()`, `carrito()`…), `contextoExpress()` y `conRelojFijo()`. |
| `tests/run-all.ts` | Importa los 15 archivos `F-*.ts` y llama a `run()`. |
| `tests/F-<MODULO>-<NN>.ts` | Un archivo por unidad / grafo de flujo. |

### Sustituciones respecto a la suite vieja

| Vitest | Manual |
|---|---|
| `vi.fn()` | `spy()` de `helpers.ts` |
| `.mockResolvedValue(v)` / `.mockImplementation(f)` | `.resolves(v)` / `.does(f)` |
| `.mock.calls[0][0]` | `arg(spy)` / `spy.calls[0][0]` |
| `expect(x).toHaveBeenCalledWith(a)` | `calledWith(spy, a)` |
| `expect(x).not.toHaveBeenCalled()` | `neverCalled(spy)` |
| `vi.mock("prisma-client")` | cliente falso inyectado por constructor: `new PrismaCartRepository(dbFalso)` |
| `vi.mock("prisma-user.repository")` | `setUserRepositoryForTests(repoFalso)` (costura en `middlewares/auth.ts`) |
| `prisma` global del `AdminController` | `setPrismaClientForTests(clienteFalso)` (costura en `admin.controller.ts`) |
| `vi.useFakeTimers()` / `setSystemTime` | `conRelojFijo(iso, fn)` (parchea `Date.now`) |
| `expect.soft(...)` | `soft(() => ...)` |

## Catálogo de casos

Los ids y descripciones no cambiaron. Resumen por módulo:

| Módulo | Archivos | Casos |
|---|---|---|
| Autenticación (`F-AUTH`) | 3 | 17 |
| Catálogo (`F-CAT`) | 3 | 19 |
| Carrito y pago (`F-CHK`) | 3 | 14 |
| Proyectos (`F-PROY`) | 3 | 43 |
| Administración (`F-ADM`) | 3 | 16 |
| **Total** | **15** | **109** |

## Defectos localizados

La suite mantiene aserciones estrictas que documentan la regla de negocio
exigida frente al comportamiento actual. Estos 14 casos **fallan a propósito**
hasta que se corrija el código.

| # | Defecto | Unidad | Caso que lo evidencia |
|---|---|---|---|
| 1 | La clasificación de material de construcción usa `nombre.includes("cal")`, rechazando «Piso Calacatta» legítimo | `CreateProjectUseCase`, `UpdateProjectUseCase`, `calculateMaterials` | `CP-F-PROY-01-06`, `CP-F-PROY-02-08` |
| 2 | Las paredes cotizan un producto vendido por galón como `precio_galón × m²` | `calculateMaterials` | `CP-F-PROY-02-02` |
| 3 | Un `materialType` desconocido se etiqueta con un formato y se cobra con el precio de otro | `calculateMaterials` | `CP-F-PROY-02-19` |
| 4 | El desperdicio se aplica a la baldosa pero no al pegante, la boquilla ni las crucetas | `calculateMaterials` | `CP-F-PROY-02-02` |
| 5 | El producto elegido desaparece de la cotización si no encaja en ninguna rama | `calculateMaterials` | `CP-F-PROY-02-06` |
| 6 | Se entregan herramientas de pintura en un proyecto de baldosa | `calculateMaterials` | `CP-F-PROY-02-02` |
| 7 | La lista manual de materiales se descarta en silencio al recalcular | `UpdateProjectUseCase` | `CP-F-PROY-03-07` |
| 8 | La calificación de una reseña no se revalida fuera del endpoint: un 99 se guarda y contamina el promedio | `CreateProductReviewUseCase` | `CP-F-CAT-03-04c` |
| 9 | La acumulación en el carrito no respeta el tope de 9999 (9999 + 9999 = 19998) | `PrismaCartRepository.addItem` | `CP-F-CHK-01-04` |
| 10 | Umbral de envío: `> 500000` (RF16) vs «igual o mayor» (HU19). Con 500.000 exactos se cobra envío | `GetCartUseCase`, `CreateOrderUseCase` | `CP-F-CHK-02-06`, `CP-F-CHK-03-03` |
| 11 | `totalUnits` resta las existencias negativas del total de unidades en bodega | `AdminController.getInventoryReport` | `CP-F-ADM-03-01`, `CP-F-ADM-03-05` |
| 12 | La API acepta publicar un producto con precio 0, que el panel prohíbe | `createProductSchema` | `CP-F-ADM-02-04` |
| 13 | Al bajar las existencias a 0 con `PUT`, el producto sigue marcado como disponible | `UpdateProductUseCase` | `CP-F-ADM-02-05` |

**Antes de "arreglar" un caso que parece mal, revisá esta tabla**: varios
codifican un conflicto de especificación, no un bug para parchear en silencio.
