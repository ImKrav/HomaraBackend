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

## 🛠️ Instalación y Configuración Local

Sigue los siguientes pasos para levantar y ejecutar el backend localmente en tu máquina.

### Requisitos Previos

- [Node.js](https://nodejs.org/) (versión 20 recomendada)
- Una instancia activa de [PostgreSQL](https://www.postgresql.org/) (puerto local por defecto: `51214`)

### Pasos de Configuración

1. **Instalar Dependencias:**
   Navega a la carpeta raíz del backend e instala todos los paquetes necesarios:
   ```bash
   npm install
   ```

2. **Configurar el Entorno:**
   Copia el archivo de plantilla `.env.example` y nómbralo como `.env`:
   ```bash
   cp .env.example .env
   ```
   Abre `.env` y configura tus variables de entorno, principalmente la URL de tu base de datos:
   ```env
   PORT=5000
   DATABASE_URL="postgresql://postgres:postgres@localhost:51214/homara?schema=public"
   JWT_SECRET="tu_secreto_super_seguro_para_tokens"
   ```

3. **Sincronizar la Base de Datos:**
   Utiliza Prisma para crear las tablas en tu base de datos basándose en el esquema:
   ```bash
   npx prisma db push
   ```

4. **Poblar la Base de Datos (Semillas):**
   Ejecuta el script de semilla para insertar categorías, productos de muestra y un usuario demo (`CUSTOMER` y `ADMIN`):
   ```bash
   npm run seed
   ```

5. **Validar la Conexión de Base de Datos:**
   Ejecuta el script de validación integrado para comprobar que la conexión y el conteo de tablas sean óptimos:
   ```bash
   npm run validate
   ```

6. **Iniciar el Servidor en Desarrollo:**
   Arranca el backend con monitoreo en caliente (`tsx watch`):
   ```bash
   npm run dev
   ```
   La API estará lista y escuchando en `http://localhost:5000`.

---

## 🐳 Despliegue con Docker

Este repositorio incluye un `Dockerfile` optimizado para entornos de producción.

### Opción 1: Construcción y Ejecución Manual del Contenedor

1. **Construir la Imagen:**
   ```bash
   docker build -t homara-backend .
   ```

2. **Ejecutar el Contenedor:**
   Asegúrate de pasarle la variable de entorno `DATABASE_URL` correspondiente para que se conecte a tu base de datos PostgreSQL:
   ```bash
   docker run -d -p 5000:5000 --name homara-backend-instance -e DATABASE_URL="postgresql://usuario:password@host_postgres:5432/homara?schema=public" homara-backend
   ```

### Opción 2: Docker Compose Independiente (Recomendado para Dev)

Si deseas levantar rápidamente el Backend junto a una base de datos PostgreSQL dedicada en Docker, puedes crear un archivo `docker-compose.yml` en la raíz del proyecto backend con el siguiente contenido:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: homara_postgres_db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: super_password
      POSTGRES_DB: homara
    ports:
      - "51214:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d homara"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: .
    container_name: homara_backend_app
    ports:
      - "5000:5000"
    environment:
      - PORT=5000
      - DATABASE_URL=postgresql://postgres:super_password@postgres:5432/homara?schema=public
      - JWT_SECRET=jwt_token_secreto_desarrollo
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
```

Luego, simplemente ejecuta:
```bash
docker compose up --build -d
```

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

Una vez que el servidor esté corriendo:

- **Base URL:** `http://localhost:5000/api`
- **Documentación Swagger:** [http://localhost:5000/api-docs](http://localhost:5000/api-docs) (Consulta interactiva de endpoints y esquemas).
- **Prisma Studio (Administrador Local de BD):** Levántalo con `npx prisma studio` y accede en `http://localhost:5555`.

### Principales Rutas de la API:
- `POST /api/auth/register` - Registro de nuevos usuarios.
- `POST /api/auth/login` - Inicio de sesión y entrega de JWT token.
- `GET /api/products` - Catálogo completo de productos con filtros y paginación.
- `GET /api/categories` - Listado de categorías disponibles.
- `POST /api/projects` - Creación y estimación de materiales para un proyecto.
- `GET /api/projects/user` - Listado de proyectos del usuario autenticado.
- `GET /api/cart` - Carrito de compras actual del usuario.
- `POST /api/cart/items` - Añadir productos al carrito.
- `POST /api/orders` - Creación de órdenes (compra en un clic).
