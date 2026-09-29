// REG-API · Regresión del contrato HTTP que consume el frontend
// Protege: la reescritura de compatibilidad /api/* → /api/v1/* (express-server.ts)
//          y el sobre { success, data } / { success: false, error } del errorHandler.
//
// El frontend (`app/lib/api.ts`) quita cualquier /api/vN/ y reenvía; clientes
// viejos todavía llaman /api/... sin versión. Si alguno de los dos contratos se
// rompe, el front deja de funcionar sin que falle ninguna prueba unitaria.

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { vi, beforeEach } from "vitest";
import { test, expect } from "../harness.js";
import { mockCategorias, reiniciarRepositorios } from "../mocks/repositorios.js";
import app from "../../src/infrastructure/http/express-server.js";

vi.mock("../../src/infrastructure/database/repositories/prisma-category.repository.js", async () => {
  const { mockCategorias } = await import("../mocks/repositorios.js");
  return { PrismaCategoryRepository: vi.fn(() => mockCategorias) };
});

beforeEach(reiniciarRepositorios);

/** Levanta la app en un puerto libre, hace GET a cada ruta y cierra el servidor. */
async function obtener(...rutas: string[]) {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const respuestas = [];
    for (const ruta of rutas) {
      const res = await fetch(`http://127.0.0.1:${port}${ruta}`);
      respuestas.push({ status: res.status, body: await res.json() });
    }
    return respuestas;
  } finally {
    server.close();
  }
}

test("REG-API-01", "/api/categories sin versión responde igual que /api/v1/categories", async () => {
  // Arrange
  const categorias = [{ id: "cat_1", name: "Pisos y Cerámicas", slug: "pisos-ceramicas" }];
  mockCategorias.findAll.mockResolvedValue(categorias);

  // Act
  const [sinVersion, conVersion] = await obtener("/api/categories", "/api/v1/categories");

  // Assert
  expect(sinVersion.status).toBe(200);
  expect(sinVersion).toStrictEqual(conVersion);
  expect(mockCategorias.findAll).toHaveBeenCalledTimes(2);
});

test("REG-API-02", "Las respuestas exitosas conservan el sobre { success: true, data }", async () => {
  // Arrange
  const categorias = [{ id: "cat_1", name: "Pinturas", slug: "pinturas" }];
  mockCategorias.findAll.mockResolvedValue(categorias);

  // Act
  const [respuesta] = await obtener("/api/v1/categories");

  // Assert
  expect(respuesta.body).toStrictEqual({ success: true, data: categorias });
});

test("REG-API-03", "Los errores conservan el sobre { success: false, error } con el mensaje", async () => {
  // Arrange
  mockCategorias.findAll.mockRejectedValue(new Error("Base de datos caída"));

  // Act
  const [respuesta] = await obtener("/api/v1/categories");

  // Assert
  expect(respuesta.status).toBe(500);
  expect(respuesta.body).toStrictEqual({ success: false, error: "Base de datos caída" });
});
