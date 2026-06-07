# 🛠️ Homara — Backend API

¡Bienvenido al repositorio del Backend de **Homara**! Esta es una API REST construida bajo los principios de la **Arquitectura Hexagonal (Puertos y Adaptadores)**, diseñada para ofrecer alta modularidad, escalabilidad y facilitar el desacoplamiento de la base de datos y del transporte HTTP.

Homara es un E-Commerce especializado en productos para el hogar y ferretería, cuya propuesta de valor central es asistir a los clientes mediante un motor inteligente de estimación de materiales de construcción y remodelación, reduciendo errores de compra en un 30%.

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

### Opción 1: Docker Compose (Recomendado)

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

### Opción 2: Construcción y Ejecución Manual

Si prefieres controlar cada paso a mano:

```bash
# 1. Construir la imagen
docker build -t homara-backend .

# 2. Ejecutar el contenedor (asume que ya tienes un PostgreSQL accesible)
docker run -d -p 5000:5000 --name homara-backend \
  -e DATABASE_URL="postgresql://usuario:password@host_postgres:5432/homara?schema=public" \
  -e PORT=5000 \
  -e JWT_SECRET="homara_jwt_secret_key_2026_secure" \
  homara-backend
```

---

## ☸️ Despliegue Local con Minikube (driver Docker)

Los manifiestos de Kubernetes viven en `k8s/` (Namespace, PostgreSQL con PVC, Backend como `NodePort`). Están pensados para un cluster local de [Minikube](https://minikube.sigs.k8s.io/) usando el driver de Docker.

### Requisitos Previos

- [Docker](https://www.docker.com/)
- [Minikube](https://minikube.sigs.k8s.io/docs/start/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)

### Paso a paso

```bash
# 1. Inicia el cluster (driver Docker)
minikube start --driver=docker

# 2. Apunta tu shell al daemon de Docker de Minikube para que `docker build`
#    deposite la imagen dentro del cluster y k8s la encuentre.
eval $(minikube docker-env)

# 3. Construye la imagen en el daemon de Minikube
docker build -t homara-backend:latest .

# 4. Aplica los manifiestos (Namespace + PVC + Postgres + Backend)
kubectl apply -f k8s/

# 5. Espera a que los pods arranquen
kubectl -n homara wait --for=condition=ready pod -l app=homara-db --timeout=180s
kubectl -n homara wait --for=condition=ready pod -l app=homara-backend --timeout=180s

# 6. Abre la API en tu navegador. Devuelve algo como http://127.0.0.1:30500
minikube service homara-backend --url -n homara
```

### Inspección y logs

```bash
# Estado de los recursos
kubectl -n homara get pods,svc,pvc

# Logs en tiempo real
kubectl -n homara logs -f deployment/homara-backend
kubectl -n homara logs -f deployment/homara-db

# Acceder al contenedor del backend
kubectl -n homara exec -it deploy/homara-backend -- sh
```

### Limpieza

```bash
# Borrar todos los recursos del stack
kubectl delete -f k8s/

# Apagar el cluster
minikube stop
```

> **Nota sobre Prisma Studio:** los manifiestos solo incluyen la API y la base de datos. Si necesitas Prisma Studio dentro del cluster, puedes añadir un Deployment + Service extra; o exponer el PostgreSQL del cluster a tu máquina local con `kubectl port-forward -n homara svc/homara-db 51214:5432` y correr `npx prisma studio` desde aquí.

---

## 🧪 Pruebas Unitarias

El backend implementa pruebas con **Vitest** enfocado en los servicios de dominio y casos de uso. Para ejecutarlas:

```bash
npm run test
```

Para generar reportes de cobertura:

```bash
npm run test -- --coverage
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
