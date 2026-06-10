# 🛠️ Homara — Backend API

¡Bienvenido al repositorio del Backend de **Homara**! Esta es una API REST construida bajo los principios de la **Arquitectura Hexagonal (Puertos y Adaptadores)**, diseñada para ofrecer alta modularidad, escalabilidad y facilitar el desacoplamiento de la base de datos y del transporte HTTP.

Homara es un E-Commerce especializado en productos para el hogar y ferretería, cuya propuesta de valor central es asistir a los clientes mediante un motor inteligente de estimación de materiales de construcción y remodelación, reduciendo errores de compra en un 30%.

---

## 🎯 Casos de Uso Críticos de la Arquitectura

Basado en la visión del negocio, los siguientes flujos representan el núcleo transaccional y la propuesta de valor de **Homara**. Deben ser monitoreados constantemente y mantener una cobertura de pruebas exhaustiva:

1. **`CreateOrderUseCase` (Checkout):** Embudo final de conversión. Genera los ingresos y depende fuertemente de la consistencia y bloqueos de base de datos (`FOR UPDATE`) para manejar concurrencia y quiebres de stock.
2. **`GetCartUseCase` (Soft Allocation):** No es un simple GET; calcula en tiempo real la reserva de inventario temporal (15 min) y los límites de *Backordering* basándose en otros carritos activos.
3. **`CreateProjectUseCase` (Motor Físico):** Orquesta la lógica del `calculateMaterials`. Un fallo matemático aquí romperá la promesa de "eliminar errores de cálculo", generando compras erróneas.
4. **Auth UseCases (Gatekeeper):** Gestión de la identidad, validación de hashes y emisión de JWTs.

---

## 📐 Arquitectura del Proyecto

El backend se estructura de forma estricta en capas desacopladas dentro de `src/`:

```
src/
├── domain/             # 1. Capa de Dominio (Lógica pura de negocio)
│   ├── entities/       # Entidades de negocio (User, Product, Project, etc.)
│   ├── repositories/   # Puertos (Interfaces) que definen accesos a datos
│   └── services/       # Servicios de dominio independientes (materialCalculator.ts)
├── application/        # 2. Capa de Aplicación (Casos de uso y orquestación)
│   └── use-cases/      # Implementaciones de casos de uso (Login, GetCart, etc.)
├── infrastructure/     # 3. Capa de Infraestructura (Adaptadores externos y frameworks)
│   ├── config/         # Configuraciones de variables y Swagger
│   ├── database/       # Repositorios Prisma y cliente de base de datos
│   ├── http/           # Controladores de Express, enrutamiento y middlewares
│   └── entrypoints/    # Puntos de entrada de la aplicación (api.ts)
└── shared/             # 4. Capa Compartida (Recursos transversales)
    ├── errors/         # Gestión estándar de excepciones (AppError.ts)
    └── utils/          # Utilidades comunes (authHelper.ts, etc.)
```

---

## 🚀 Pila Tecnológica (Tech Stack)

* **Entorno de ejecución:** Node.js (v20), ESM (`"type": "module"`)
* **Lenguaje:** TypeScript (v6) con tipado estricto
* **Framework Web:** Express (v5)
* **Base de Datos:** PostgreSQL (v17)
* **ORM:** Prisma ORM (v7.8.0)
* **Testing:** Vitest (v4.1.7) para pruebas unitarias veloces
* **Documentación:** Swagger / OpenAPI 3.0 (`swagger-ui-express`)

---

## 🛠️ Instalación y Configuración Local (sin Docker)

Sigue los siguientes pasos para levantar y ejecutar el backend localmente con Node.

### Requisitos Previos

- [Node.js](https://nodejs.org/) (versión 20 recomendada)
- Una instancia activa de [PostgreSQL](https://www.postgresql.org/) (puerto local por defecto: `51214`)

### Pasos de Configuración

1. **Instalar Dependencias:**
   ```bash
   npm install
   ```

2. **Configurar el Entorno:**
   ```bash
   cp .env.example .env
   ```
   Edita `.env` con tus variables, principalmente `DATABASE_URL`:
   ```env
   PORT=5000
   DATABASE_URL="postgresql://postgres:postgres@localhost:51214/homara?schema=public"
   JWT_SECRET="tu_secreto_super_seguro_para_tokens"
   ```

3. **Sincronizar la Base de Datos:**
   ```bash
   npx prisma db push
   ```

4. **Poblar la Base de Datos (Semillas):**
   ```bash
   npm run seed
   ```

5. **Validar la Conexión de Base de Datos:**
   ```bash
   npm run validate
   ```

6. **Iniciar el Servidor en Desarrollo:**
   ```bash
   npm run dev
   ```
   La API estará lista y escuchando en `http://localhost:5000`.

---

## 📦 Imagen Pública en Docker Hub

La imagen oficial del backend se publica y actualiza automáticamente en DockerHub en cada push a `main` mediante GitHub Actions:

- **Repositorio:** [**imkrav/homara-backend**](https://hub.docker.com/r/imkrav/homara-backend)
- **Pull de la última versión:**
  ```bash
  docker pull imkrav/homara-backend:latest
  ```
- **Tags disponibles:** `latest` y `<short-sha>` por cada commit en `main`.

Para usarla directamente sin clonar este repo (asume un PostgreSQL accesible):

```bash
docker run -d -p 5000:5000 --name homara-backend \
  -e DATABASE_URL="postgresql://usuario:password@host_postgres:5432/homara?schema=public" \
  -e PORT=5000 \
  -e JWT_SECRET="homara_jwt_secret_key_2026_secure" \
  imkrav/homara-backend:latest
```

---

## 🐳 Despliegue con Docker

Este repositorio incluye un `Dockerfile` multi-stage y un `docker-compose.yml` listo para orquestar la API junto a PostgreSQL.

### Requisitos Previos

- [Docker](https://www.docker.com/) 20.10+
- [Docker Compose](https://docs.docker.com/compose/) v2 (incluido en Docker Desktop)

### Docker Compose

Levanta PostgreSQL + la API con un solo comando. Todo está preconfigurado con los puertos y credenciales definidos en `AGENTS.md`.

```bash
# Levantar DB + Backend en segundo plano
docker compose up -d

# Reconstruir las imágenes después de cambios
docker compose up -d --build

# Ver logs en tiempo real
docker compose logs -f backend

# Detener todo (conserva el volumen pgdata con los datos de la BD)
docker compose down

# Detener y BORRAR el volumen de la BD (reset completo)
docker compose down -v
```

Una vez arriba:

- **API:** `http://localhost:5000` (Swagger en `/api-docs`)
- **PostgreSQL:** `localhost:51214`

Para incluir **Prisma Studio** (UI web para la BD en `http://localhost:5555`):

```bash
docker compose --profile tools up -d
```

#### Variables de entorno

El `docker-compose.yml` define valores por defecto para todas las variables. Puedes sobreescribirlas creando un archivo `.env` en esta misma carpeta:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=homara
POSTGRES_PORT=51214
BACKEND_PORT=5000
PRISMA_STUDIO_PORT=5555
JWT_SECRET=homara_jwt_secret_key_2026_secure
```

---

## ☸️ Despliegue Local con Minikube (driver Docker)

Manifiestos en `k8s/`. Hemos simplificado el despliegue a comandos directos en `package.json` para evitar configuraciones manuales complejas:

```bash
# 1. Iniciar Minikube
minikube start --driver=docker

# 2. Compilar la imagen y desplegar todo (BD, Backend, Secrets y Grafana)
npm run k8s:deploy

# 3. Monitorear el estado de los pods y servicios
npm run k8s:status

# 4. Abrir los servicios en tu navegador (túneles de Minikube)
npm run k8s:backend   # Para la API Backend
npm run k8s:grafana   # Para la consola de Grafana (admin/admin)
```

### Comandos de Inspección y Limpieza Adicionales
```bash
# Ver logs en tiempo real
kubectl -n homara logs -f deployment/homara-backend
kubectl -n homara logs -f deployment/homara-grafana

# Limpiar todo el despliegue
kubectl delete -f k8s/
```

> **Prisma Studio:** Exponer el Postgres del cluster a tu host con `kubectl port-forward -n homara svc/homara-db 51214:5432` y correr `npx prisma studio` desde este repo.

---

## 🧪 Pruebas Unitarias, de Integración y Concurrencia

El backend implementa pruebas con **Vitest** enfocado en los servicios de dominio, casos de uso e integración directa con la base de datos PostgreSQL.

Para ejecutar todas las pruebas:

```bash
npm run test
```

### 🔬 Casos de Prueba Extremos Documentados

#### A. Concurrencia y Soft Allocation (Integración)
Validamos escenarios de carrera (*Race Conditions*) en el Checkout:

#### 1. Reserva Temporal de Inventario (Soft Allocation)
* **Caso**: Un usuario añade un producto a su carrito y otro usuario consulta el catálogo.
* **Validación**:
  * El stock disponible dinámicamente visible para otros usuarios disminuye en tiempo real.
  * El usuario que realizó la reserva lógica sigue viendo su stock completo (permitiéndole comprar lo que reservó).
  * Al transcurrir los 15 minutos de la reserva lógica (simulado en base de datos), el stock se restaura automáticamente para el resto de clientes si el primero no concretó la compra.

#### 2. Concurrencia Extrema de Compras (Race Conditions)
* **Caso**: Dos usuarios intentan comprar simultáneamente el mismo producto a través de checkouts paralelos mediante `Promise.all`, con stock disponible limitado.
* **Validación**:
  * Implementación de **Row-Level Locking (`FOR UPDATE`)** y generación de `orderNumber` seguro dentro del bloque de transacción de Prisma.
  * Garantiza que ambas compras se serialicen correctamente en la base de datos sin colisionar en números de órdenes duplicados.
  * Decrementa el stock hasta números negativos (ej. `-2`), indicando un quiebre de stock exitosamente procesado bajo la modalidad de **Envío Diferido (Backorder)**.
  * Comprueba que la primera orden procesada tome los artículos en existencia regular, mientras que la segunda transacción procese y marque las unidades faltantes como backorder de manera exacta.

#### B. Motor de Cálculo Físico de Materiales (Dominio)
Estresamos la matemática de la propuesta de valor:
* **Deducciones Mayores al Área:** Asegura que si se restan muchas puertas/ventanas, el sistema aplique una salvaguarda de no permitir áreas calculadas menores a `0.1 m²` para evitar errores fatales o facturaciones en cero.
* **Comportamiento Asimétrico (Pintura vs. Enchapes):** Comprueba que la pintura utiliza rendimiento por galón (+5% desperdicio constante) ignorando patrones de colocación, mientras que la cerámica respeta incrementos porcentuales altos (15% en diagonal).
* **Sobreescritura de Proyectos Integrales:** Verifica que al calcular un proyecto "Integral" y vincularlo a un producto real, las paredes generadas (60% del área neta) extraigan correctamente el precio y métricas asociadas al ítem del catálogo.
* **Resistencia a Extremos Numéricos:** Manejo de porcentajes en cero, sustracciones exageradas y áreas grandes sin truncamientos ni inestabilidad.

Para generar reportes de cobertura:

```bash
npm run test --coverage
```

---

## 🌐 Accesos Útiles y Endpoints

Una vez que el servidor esté corriendo (en cualquier modalidad):

- **Base URL:** `http://localhost:5000/api/v1`
- **Documentación Swagger:** [http://localhost:5000/api-docs](http://localhost:5000/api-docs) (Consulta interactiva de endpoints y esquemas).
- **Prisma Studio (Administrador Local de BD):** Levántalo con `docker compose --profile tools up -d` y accede en `http://localhost:5555`.

### Principales Rutas de la API:
- `POST /api/v1/auth/register` - Registro de nuevos usuarios.
- `POST /api/v1/auth/login` - Inicio de sesión y entrega de JWT token.
- `GET /api/v1/products` - Catálogo completo de productos con filtros y paginación.
- `GET /api/v1/categories` - Listado de categorías disponibles.
- `POST /api/v1/projects` - Creación y estimación de materiales para un proyecto.
- `GET /api/v1/projects/user` - Listado de proyectos del usuario autenticado.
- `GET /api/v1/cart` - Carrito de compras actual del usuario.
- `POST /api/v1/cart/items` - Añadir productos al carrito.
- `POST /api/v1/orders` - Creación de órdenes (compra en un clic).
