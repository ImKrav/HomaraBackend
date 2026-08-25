# Pruebas unitarias derivadas de los grafos de flujo

Suite de verificación del backend de Homara construida con el método de
**cobertura de ruta básica de McCabe**, según los lineamientos del ISTQB y la
norma ISO/IEC/IEEE 29119.

## De dónde sale cada caso de prueba

Cada archivo de `tests/backend/` corresponde a un grafo de flujo del plan de
pruebas. La derivación es directa:

| En el grafo | En el test |
|---|---|
| Complejidad ciclomática V(G) | Número de casos de la suite para esa unidad |
| Una fila de la tabla de caminos | Un `it()` |
| Columna **Prueba** (`Paso 3 = SI`) | El *arrange*: qué se mockea para forzar esa rama |
| Columna **Entrada** | Los datos con los que se invoca la unidad |
| Columna **Salida** | Las aserciones |

El nombre de cada test lleva el identificador del caso y su descripción concisa, de modo que se puede rastrear del test al grafo y del grafo al requisito:

```
CP-F-AUTH-01-02: Rechaza registro si el correo ya existe
```

## Cobertura

| Módulo | Grafos | V(G) acumulada | Casos |
|---|---|---|---|
| Autenticación | 3 | 13 | 17 |
| Catálogo | 3 | 13 | 19 |
| Proyectos | 3 | 42 | 43 |
| Carrito y pago | 3 | 14 | 14 |
| Administración | 3 | 16 | 16 |
| **Total** | **15** | **98** | **109** |

Los 98 casos base cubren los caminos independientes de los 15 grafos. Los 11
restantes son pruebas complementarias de valor límite y de reglas no
funcionales sobre esos mismos caminos.

## Los rojos son el resultado, no un problema

**Esta suite no está pensada para estar en verde.** Los tests afirman lo que el
grafo y las reglas de negocio exigen, no lo que el código hace hoy. Un test en
rojo es un defecto localizado, con su camino, su nodo y su unidad.

La corrección del código queda fuera del alcance de esta etapa: aquí se
verifica, no se refactoriza.

Estado actual: **95 pasan · 14 fallan**. Cada aserción que falla lleva encima un
comentario `// DEFECTO:` que explica qué regla incumple.

## Defectos localizados

| # | Defecto | Unidad | Caso que lo evidencia |
|---|---|---|---|
| 1 | La clasificación de material de construcción usa `nombre.includes("cal")`, así que un «Piso Calacatta» legítimo se rechaza | `CreateProjectUseCase`, `UpdateProjectUseCase`, `calculateMaterials` | `CP-F-PROY-01-06`, `CP-F-PROY-02-08` |
| 2 | Las paredes cotizan un producto vendido por galón como `precio_galón × m²` | `calculateMaterials` | `CP-F-PROY-02-02` |
| 3 | Un `materialType` desconocido se etiqueta con un formato y se cobra con el precio de otro | `calculateMaterials` | `CP-F-PROY-02-19` |
| 4 | El desperdicio se aplica a la baldosa pero no al pegante, la boquilla ni las crucetas | `calculateMaterials` | `CP-F-PROY-02-02` |
| 5 | El producto que el usuario eligió desaparece de la cotización si no encaja en ninguna rama | `calculateMaterials` | `CP-F-PROY-02-06` |
| 6 | Se entregan herramientas de pintura en un proyecto de baldosa | `calculateMaterials` | `CP-F-PROY-02-02` |
| 7 | La lista manual de materiales se descarta en silencio al recalcular | `UpdateProjectUseCase` | `CP-F-PROY-03-07` |
| 8 | La calificación de una reseña no se revalida fuera del endpoint: un 99 se guarda y contamina el promedio | `CreateProductReviewUseCase` | `CP-F-CAT-03-04c` |
| 9 | La acumulación en el carrito no respeta el tope de 9999 (9999 + 9999 = 19998) | `PrismaCartRepository.addItem` | `CP-F-CHK-01-04` |
| 10 | Umbral de envío: el código usa `> 500000` (RF16) y la historia de usuario dice «igual o mayor» (HU19). Con 500.000 exactos el cliente paga envío | `GetCartUseCase`, `CreateOrderUseCase` | `CP-F-CHK-02-06`, `CP-F-CHK-03-03` |
| 11 | `totalUnits` resta las existencias negativas del total de unidades en bodega | `AdminController.getInventoryReport` | `CP-F-ADM-03-01`, `CP-F-ADM-03-05` |
| 12 | La API acepta publicar un producto con precio 0, que el panel prohíbe | `createProductSchema` | `CP-F-ADM-02-04` |
| 13 | Al bajar las existencias a 0 con `PUT`, el producto sigue marcado como disponible | `UpdateProductUseCase` | `CP-F-ADM-02-05` |

El defecto 10 no es un error de implementación sino una **contradicción entre
requisitos**: RF16 y HU19 dicen cosas distintas sobre el mismo umbral. Necesita
una decisión de negocio antes de tocar código.

## Cómo ejecutarla

```bash
npm install
npm test              # los 109 casos
npm run test:cov      # con informe de cobertura
npm test -- F-CHK     # solo un módulo
```

## Archivos

- `tests/backend/*.test.ts` — un archivo por grafo.
- `tests/test-helpers.ts` — dobles de prueba y constructores de datos compartidos.
- `tests/_caminos.json` — los 98 caminos exportados desde los grafos, con el
  texto de cada nodo. Es la fuente de la que se derivaron los casos y sirve
  para regenerarlos si un grafo cambia.
