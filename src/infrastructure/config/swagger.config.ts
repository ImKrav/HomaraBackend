import swaggerJsDoc from "swagger-jsdoc";
import { envConfig } from "./env.config.js";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Homara API",
      version: "1.0.0",
      description: "Documentación oficial de la API de Homara",
    },
    servers: [
      {
        url: `http://localhost:${envConfig.port}`,
      },
    ],
  },
  apis: ["./src/infrastructure/http/routes/*.ts", "./dist/infrastructure/http/routes/*.js"],
};

export const specs = swaggerJsDoc(options);
