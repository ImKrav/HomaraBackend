# Pruebas unitarias derivadas de los grafos de flujo

Suite de verificación del backend de Homara construida con el método de **cobertura de ruta básica de McCabe**, según los lineamientos del ISTQB y la norma ISO/IEC/IEEE 29119.

## De dónde sale cada caso de prueba

Cada archivo de `tests/backend/` corresponde a un grafo de flujo del plan de pruebas:

| En el grafo | En el test |
|---|---|
| Complejidad ciclomática V(G) | Número de casos de la suite para esa unidad |
| Una fila de la tabla de caminos | Un `it()` |
| Columna **Prueba** (`Paso 3 = SI`) | El *arrange*: qué se mockea para forzar esa rama |
| Columna **Entrada** | Los datos con los que se invoca la unidad |
| Columna **Salida** | Las aserciones |

El nombre de cada test lleva el identificador del caso y su descripción concisa:

```
CP-F-AUTH-01-02: Rechaza registro si el correo ya existe
```

## Cobertura General

| Módulo | Archivos | V(G) acumulada | Casos Totales |
|---|---|---|---|
| Autenticación | 3 | 13 | 17 |
| Catálogo | 3 | 13 | 19 |
| Proyectos | 3 | 42 | 43 |
| Carrito y pago | 3 | 14 | 14 |
| Administración | 3 | 16 | 16 |
| **Total** | **15** | **98** | **109** |

---

## Catálogo Detallado de Pruebas Unitarias

### 1. Módulo Autenticación (`F-AUTH`)

#### `F-AUTH-01.test.ts` · Registro de usuario
- **Unidad**: `RegisterUserUseCase.execute()` (`POST /api/v1/users/register`)
- **Casos**:
  - `CP-F-AUTH-01-01`: Rechaza contraseña corta en validación de esquema sin consultar repositorio.
  - `CP-F-AUTH-01-02`: Rechaza registro si el correo ya existe.
  - `CP-F-AUTH-01-03`: Crea la cuenta con contraseña cifrada y retorna token de sesión.
  - `CP-F-AUTH-01-03b`: Normaliza correo con mayúsculas y espacios y acepta contraseña de 8 caracteres.

#### `F-AUTH-02.test.ts` · Inicio de sesión
- **Unidad**: `LoginUserUseCase.execute()` (`POST /api/v1/users/login`)
- **Casos**:
  - `CP-F-AUTH-02-01`: Rechaza correo con formato inválido antes de consultar repositorio.
  - `CP-F-AUTH-02-02`: Rechaza credenciales cuando el correo no existe.
  - `CP-F-AUTH-02-03`: Rechaza credenciales cuando la contraseña no coincide.
  - `CP-F-AUTH-02-04`: Emite credencial de sesión al ingresar credenciales válidas.
  - `CP-F-AUTH-02-03b`: Devuelve el mismo mensaje de error para correo inexistente y clave incorrecta.
  - `CP-F-AUTH-02-04b`: Normaliza correo antes de consultar.

#### `F-AUTH-03.test.ts` · Control de acceso por rol
- **Unidad**: Middlewares `requireAuth` y `requireAdmin`
- **Casos**:
  - `CP-F-AUTH-03-01`: Retorna 401 si no se provee cabecera Authorization.
  - `CP-F-AUTH-03-02`: Retorna error cuando el token JWT ha caducado.
  - `CP-F-AUTH-03-03`: Retorna 401 si el usuario asociado al token no existe en la base de datos.
  - `CP-F-AUTH-03-04`: Retorna 403 cuando un usuario cliente intenta acceder a rutas de administración.
  - `CP-F-AUTH-03-05`: Permite el acceso cuando el usuario tiene rol ADMIN en base de datos.
  - `CP-F-AUTH-03-06`: Traduce fallos internos no controlados a error 500.
  - `CP-F-AUTH-03-04b`: Valida el rol real de base de datos ignorando el payload del token.

---

### 2. Módulo Catálogo (`F-CAT`)

#### `F-CAT-01.test.ts` · Listar y filtrar catálogo
- **Unidad**: `ListProductsUseCase.execute()` + `PrismaProductRepository.findAll()` (`GET /api/v1/products`)
- **Casos**:
  - `CP-F-CAT-01-01`: Filtra por categoría, término de búsqueda y etiqueta simultáneamente.
  - `CP-F-CAT-01-02`: Filtra por texto y etiqueta sin categoría.
  - `CP-F-CAT-01-03`: Filtra únicamente por etiqueta.
  - `CP-F-CAT-01-04`: Lista catálogo sin filtros aplicados.
  - `CP-F-CAT-01-05`: Excluye reservas del propio carrito para usuario autenticado.
  - `CP-F-CAT-01-06`: Descuenta todas las reservas activas para visitante anónimo.
  - `CP-F-CAT-01-05b`: Evita stock negativo cuando las reservas superan el inventario físico.
  - `CP-F-CAT-01-06c`: Trata filtros con cadenas vacías como filtros ausentes.

#### `F-CAT-02.test.ts` · Detalle de producto
- **Unidad**: `GetProductDetailUseCase.execute()` (`GET /api/v1/products/:id`)
- **Casos**:
  - `CP-F-CAT-02-01`: Retorna 404 si el producto no existe.
  - `CP-F-CAT-02-02`: Excluye la reserva propia del usuario autenticado al calcular stock disponible.
  - `CP-F-CAT-02-03`: Descuenta todas las reservas activas para usuario anónimo.
  - `CP-F-CAT-02-03b`: Marca producto como agotado si las reservas consumen todo el stock.
  - `CP-F-CAT-02-03c`: Mantiene stock físico intacto cuando no hay reservas activas.

#### `F-CAT-03.test.ts` · Publicar reseña
- **Unidad**: `CreateProductReviewUseCase.execute()` (`POST /api/v1/products/:id/reviews`)
- **Casos**:
  - `CP-F-CAT-03-01`: Rechaza calificación fuera del rango 1-5 o con decimales en validación de esquema.
  - `CP-F-CAT-03-02`: Retorna 404 si el producto a calificar no existe.
  - `CP-F-CAT-03-03`: Rechaza si el usuario ya había publicado una reseña previa para el producto.
  - `CP-F-CAT-03-04`: Guarda la reseña y actualiza el promedio de calificación del producto.
  - `CP-F-CAT-03-04b`: Valida límites de calificación (1 y 5) y longitud máxima de comentario (500).
  - `CP-F-CAT-03-04c`: Rechaza calificación fuera de rango directamente en el caso de uso.

---

### 3. Módulo Carrito y Pago (`F-CHK`)

#### `F-CHK-01.test.ts` · Agregar producto al carrito
- **Unidad**: `AddCartItemUseCase.execute()` (`POST /api/v1/cart/items`)
- **Casos**:
  - `CP-F-CHK-01-01`: Retorna 401 sin sesión autenticada antes de modificar el carrito.
  - `CP-F-CHK-01-02`: Valida esquema para cantidades (1..9999, enteros) y formato cuid de ID.
  - `CP-F-CHK-01-03`: Crea carrito si no existía y acumula cantidad si la línea ya existía.
  - `CP-F-CHK-01-04`: Acumula cantidades de producto existente en el carrito respetando tope.
  - `CP-F-CHK-01-05`: Agrega una nueva línea de producto cuando no estaba en el carrito.

#### `F-CHK-02.test.ts` · Ver y modificar carrito
- **Unidad**: `GetCartUseCase.execute()` (`GET /api/v1/cart`)
- **Casos**:
  - `CP-F-CHK-02-01`: Crea un carrito vacío cuando el usuario no tenía uno previo.
  - `CP-F-CHK-02-02`: Retorna estructura de carrito existente sin productos.
  - `CP-F-CHK-02-03`: Calcula backorder y aplica envío gratuito cuando subtotal supera 500000.
  - `CP-F-CHK-02-04`: Muestra disponibilidad total sin backorder con stock suficiente.
  - `CP-F-CHK-02-05`: Itera múltiples líneas combinando disponibles y pedidos pendientes.
  - `CP-F-CHK-02-06`: Cobra tarifa de envío con subtotal inferior al umbral y evalúa umbral de 500000.

#### `F-CHK-03.test.ts` · Confirmar pedido
- **Unidad**: `CreateOrderUseCase.execute()` (`POST /api/v1/orders`)
- **Casos**:
  - `CP-F-CHK-03-01`: Rechaza creación de orden cuando el carrito está vacío.
  - `CP-F-CHK-03-02`: Genera pedido con envío gratuito e ítems congelados cuando subtotal supera 500000.
  - `CP-F-CHK-03-03`: Evalúa umbral de envío gratuito con subtotal de 500000 exactos.

---

### 4. Módulo Proyectos (`F-PROY`)

#### `F-PROY-01.test.ts` · Crear proyecto
- **Unidad**: `CreateProjectUseCase.execute()` (`POST /api/v1/projects`)
- **Casos**:
  - `CP-F-PROY-01-01`: Rechaza materialType no soportado antes de consultar catálogo.
  - `CP-F-PROY-01-02`: Retorna 404 si el selectedProductId no existe en el catálogo.
  - `CP-F-PROY-01-03`: Crea proyecto con materiales genéricos cuando no se vincula producto.
  - `CP-F-PROY-01-04`: Rechaza producto sin categoría válida asignada.
  - `CP-F-PROY-01-05`: Rechaza categorías no permitidas para proyectos (ej. herramientas).
  - `CP-F-PROY-01-06`: Valida correspondencia entre nombre de insumo y su categoría.
  - `CP-F-PROY-01-07`: Rechaza producto de pisos en proyecto configurado como pintura.
  - `CP-F-PROY-01-08`: Rechaza vincular pegante en proyecto de madera.
  - `CP-F-PROY-01-09`: Rechaza pintura en proyecto de madera.
  - `CP-F-PROY-01-10`: Asigna pegante real del catálogo en proyecto de cerámica.
  - `CP-F-PROY-01-11`: Asigna pintura real del catálogo en proyecto de pintura.
  - `CP-F-PROY-01-12`: Asigna producto de pisos del catálogo calculando desperdicio y costo.

#### `F-PROY-02.test.ts` · Calcular materiales
- **Unidad**: `calculateMaterials()` (`src/domain/services/materialCalculator.ts`)
- **Casos**:
  - `CP-F-PROY-02-01`: Aplica 5% de desperdicio por defecto para proyectos de pintura.
  - `CP-F-PROY-02-02`: Prioriza porcentaje explícito de desperdicio sobre patrón de colocación.
  - `CP-F-PROY-02-02b`: Respeta cota mínima de 0.1 m² cuando los descuentos superan el área.
  - `CP-F-PROY-02-03`: Asigna 15% de desperdicio para colocación en diagonal.
  - `CP-F-PROY-02-04`: Asigna 12% de desperdicio para colocación en trabadura.
  - `CP-F-PROY-02-05`: Asigna 10% de desperdicio para colocación directa o por defecto.
  - `CP-F-PROY-02-06`: Mantiene pintura genérica si el producto vinculado es material de construcción.
  - `CP-F-PROY-02-07`: Cotiza producto del catálogo por m² con desperdicio aplicado.
  - `CP-F-PROY-02-08`: Asigna baldosa genérica y calcula pegante vinculado por rendimiento de peso.
  - `CP-F-PROY-02-09`: Excluye insumos de baldosa (pegante, boquilla, crucetas) en proyectos de madera.
  - `CP-F-PROY-02-10`: Cotiza boquilla real vinculada y omite pegante si se desactiva includeAdhesive.
  - `CP-F-PROY-02-11`: Asigna pegante genérico de 25kg cuando el producto vinculado no es adhesivo.
  - `CP-F-PROY-02-12`: Mantiene crucetas cuando se omiten pegante y boquilla.
  - `CP-F-PROY-02-13`: Calcula boquilla genérica a rendimiento de 8 m² por kilo.
  - `CP-F-PROY-02-14`: Excluye insumos de baldosa pero preserva herramientas correspondientes.
  - `CP-F-PROY-02-15`: Calcula primer para vinilo y excluye cinta underlayment.
  - `CP-F-PROY-02-16`: Omite cinta underlayment para madera cuando includeAdhesive es false.
  - `CP-F-PROY-02-17`: Omite insumos específicos ante materialType desconocido cotizando producto galón.
  - `CP-F-PROY-02-18`: Omite primer para vinilo si includeAdhesive está desactivado.
  - `CP-F-PROY-02-19`: Cotiza paredes en proyecto integral aunque includeTools sea false.
  - `CP-F-PROY-02-20`: Incluye kit de herramientas de baldosa (nivel, llana y mazo).
  - `CP-F-PROY-02-21`: Incluye solo nivel en herramientas para proyectos sin baldosa.
  - `CP-F-PROY-02-22`: Omite estimación de paredes para pintura o cuando el tipo no es integral.

#### `F-PROY-03.test.ts` · Asignar producto al proyecto
- **Unidad**: `UpdateProjectUseCase.execute()` (`PUT /api/v1/projects/:id`)
- **Casos**:
  - `CP-F-PROY-03-01`: Rechaza materialType no soportado.
  - `CP-F-PROY-03-02`: Retorna 404 si el proyecto no existe.
  - `CP-F-PROY-03-03`: Retorna 403 si el proyecto pertenece a otro usuario.
  - `CP-F-PROY-03-04`: Rechaza vincular producto incompatible con el tipo de proyecto.
  - `CP-F-PROY-03-05`: Guarda lista manual de materiales enviada por el cliente y recalcula presupuesto.
  - `CP-F-PROY-03-06`: Actualiza únicamente campos descriptivos sin alterar materiales.
  - `CP-F-PROY-03-07`: Recalcula materiales genéricos al cambiar área.
  - `CP-F-PROY-03-08`: Vincula producto compatible y recalcula materiales y presupuesto.

---

### 5. Módulo Administración (`F-ADM`)

#### `F-ADM-01.test.ts` · Tablero de indicadores
- **Unidad**: `AdminController.getMetrics()` (`GET /api/v1/admin/metrics`)
- **Casos**:
  - `CP-F-ADM-01-01`: Calcula variación de ventas respecto al mes anterior y categorías principales.
  - `CP-F-ADM-01-02`: Evita división por cero y retorna variación 0 cuando no hay ventas el mes anterior.
  - `CP-F-ADM-01-03`: Agrupa ventas del año por mes correspondiente.
  - `CP-F-ADM-01-04`: Acumula montos repetidos de la misma categoría.
  - `CP-F-ADM-01-05`: Ordena categorías y limita el reporte a las 5 principales.
  - `CP-F-ADM-01-06`: Asigna 0% a categorías cuando las ventas totales por categoría son 0.

#### `F-ADM-02.test.ts` · Gestión de productos
- **Unidad**: `CreateProductUseCase.execute()` y `UpdateProductUseCase.execute()` (`POST` y `PUT /api/v1/products`)
- **Casos**:
  - `CP-F-ADM-02-01`: Rechaza con 403 a usuarios con rol CUSTOMER antes de modificar productos.
  - `CP-F-ADM-02-02`: Rechaza campos inválidos (precio negativo, stock negativo, nombre vacío) en validación.
  - `CP-F-ADM-02-03`: Retorna 404 al intentar actualizar un producto que no existe.
  - `CP-F-ADM-02-04`: Crea producto nuevo con valores derivados y valida precio mayor a 0.
  - `CP-F-ADM-02-05`: Aplica parche parcial en actualización y actualiza inStock si stockQuantity llega a 0.

#### `F-ADM-03.test.ts` · Inventario y stock
- **Unidad**: `AdminController.getInventoryReport()` (`GET /api/v1/admin/inventory`)
- **Casos**:
  - `CP-F-ADM-03-01`: Clasifica productos con existencias menores a cero como stock_negativo.
  - `CP-F-ADM-03-02`: Clasifica productos con existencias en 0 como sin_stock.
  - `CP-F-ADM-03-03`: Marca 49 unidades como límite superior de alerta stock_bajo.
  - `CP-F-ADM-03-04`: Marca 50 unidades como límite inferior de inventario normal.
  - `CP-F-ADM-03-05`: Procesa múltiples productos combinando estados en el reporte.

---

## Defectos Localizados

La suite incluye aserciones estrictas que documentan reglas de negocio exigidas frente al comportamiento actual del código:

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

---

## Cómo Ejecutar la Suite

```bash
npm install
npm test              # Ejecuta los 109 casos
npm run test:cov      # Con informe de cobertura
npm test -- F-CHK     # Ejecuta solo un módulo específico
```

## Estructura de Archivos

- `tests/backend/F-*.test.ts` — Un archivo por unidad/grafo del sistema.
- `tests/test-helpers.ts` — Dobles de prueba (`mocks`), fábricas de datos y utilidades compartidas.
- `tests/_caminos.json` — Volcado JSON de caminos y nodos de diseño.
