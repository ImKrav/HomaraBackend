// ============================================
// Homara — Express Server Setup (TS)
// ============================================

import express from "express";
import swaggerUi from "swagger-ui-express";
import { specs } from "../config/swagger.config.js";
import { errorHandler } from "./middlewares/errorHandler.js";

// Importar rutas de Express
import categoriesRouter from "./routes/categories.js";
import productsRouter from "./routes/products.js";
import projectsRouter from "./routes/projects.js";
import cartRouter from "./routes/cart.js";
import ordersRouter from "./routes/orders.js";
import usersRouter from "./routes/users.js";
import adminRouter from "./routes/admin.js";

const app = express();

// Middlewares globales
app.use(express.json());

// CORS — habilita accesos remotos y del frontend
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Endpoint base informativo
app.get("/", (req, res) => {
  res.json({
    message: "🏠 Homara API — Backend activo (Hexagonal + TS)",
    version: "1.0.0",
    endpoints: {
      categories: "/api/v1/categories",
      products: "/api/v1/products",
      projects: "/api/v1/projects",
      cart: "/api/v1/cart",
      orders: "/api/v1/orders",
      users: "/api/v1/users",
      admin: "/api/v1/admin",
    },
  });
});

// Agrupar todas las rutas v1
const apiV1Router = express.Router();
apiV1Router.use("/categories", categoriesRouter);
apiV1Router.use("/products", productsRouter);
apiV1Router.use("/projects", projectsRouter);
apiV1Router.use("/cart", cartRouter);
apiV1Router.use("/orders", ordersRouter);
apiV1Router.use("/users", usersRouter);
apiV1Router.use("/admin", adminRouter);

// Compatibilidad hacia atrás: reescritura interna transparente de /api/ a /api/v1/
app.use("/api", (req, res, next) => {
  if (!req.url.startsWith("/v1")) {
    req.url = `/v1${req.url}`;
  }
  next();
});

// Registrar rutas v1 oficiales
app.use("/api/v1", apiV1Router);

// Documentación de Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// Manejador de errores global
app.use(errorHandler);

export default app;
