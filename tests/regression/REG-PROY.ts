// REG-PROY · Regresión de proyectos y estimación (/api/v1/projects)
// Flujo protegido: crear un proyecto → recibir la lista de materiales con
// costo → consultarlo → borrarlo. Solo el dueño puede borrar.

import { vi, beforeEach } from "vitest";
import { test, expect } from "../harness.js";
import { mockProyectos, reiniciarRepositorios } from "../mocks/repositorios.js";
import { proyecto } from "../helpers.js";
import { pedir, sesion, CUID } from "./soporte.js";

vi.mock("../../src/infrastructure/database/repositories/prisma-project.repository.js", async () => {
  const { mockProyectos } = await import("../mocks/repositorios.js");
  return { PrismaProjectRepository: vi.fn(() => mockProyectos) };
});
vi.mock("../../src/infrastructure/database/repositories/prisma-product.repository.js", async () => {
  const { mockProductos } = await import("../mocks/repositorios.js");
  return { PrismaProductRepository: vi.fn(() => mockProductos) };
});
vi.mock("../../src/infrastructure/database/repositories/prisma-user.repository.js", async () => {
  const { mockUsuarios } = await import("../mocks/repositorios.js");
  return { PrismaUserRepository: vi.fn(() => mockUsuarios) };
});

beforeEach(reiniciarRepositorios);

const nuevo = { name: "Cocina", type: "PISO", area: 20, materialType: "ceramica", tileFormat: "60x60" };

test("REG-PROY-01", "Crear un proyecto guarda los materiales calculados y su costo total en pesos", async () => {
  // Arrange
  const { token } = sesion();

  // Act
  const res = await pedir("POST", "/api/v1/projects", { token, body: nuevo });

  // Assert
  expect(res.status).toBe(201);
  const guardado = mockProyectos.create.mock.calls[0][0];
  const suma = guardado.materials.reduce((s: number, m: any) => s + m.price, 0);
  expect(guardado).toMatchObject({ userId: "usr_001", status: "EN_PROGRESO", wastePercent: 10 });
  expect(guardado.materials.length).toBeGreaterThan(0);
  expect(guardado.estimatedCost).toBe(suma);
  expect(Number.isInteger(guardado.estimatedCost)).toBe(true);
});

test("REG-PROY-02", "Crear exige sesión y datos válidos", async () => {
  // Arrange
  const { token } = sesion();

  // Act
  const sinSesion = await pedir("POST", "/api/v1/projects", { body: nuevo });
  const tipoInvalido = await pedir("POST", "/api/v1/projects", { token, body: { ...nuevo, type: "JARDIN" } });
  const areaNegativa = await pedir("POST", "/api/v1/projects", { token, body: { ...nuevo, area: -5 } });

  // Assert
  expect(sinSesion.status).toBe(401);
  expect(tipoInvalido.status).toBe(400);
  expect(areaNegativa.status).toBe(400);
  expect(areaNegativa.body.error).toContain("El área debe ser un número positivo");
  expect(mockProyectos.create).not.toHaveBeenCalled();
});

test("REG-PROY-03", "El listado devuelve solo los proyectos del usuario autenticado", async () => {
  // Arrange
  const { token } = sesion();
  mockProyectos.findAllByUserId.mockResolvedValue([proyecto()]);

  // Act
  const res = await pedir("GET", "/api/v1/projects", { token });

  // Assert
  expect(res.status).toBe(200);
  expect(mockProyectos.findAllByUserId).toHaveBeenCalledWith("usr_001");
  expect(res.body.data).toHaveLength(1);
});

test("REG-PROY-04", "Consultar exige un id CUID y responde 404 si no existe", async () => {
  // Arrange
  mockProyectos.findById.mockResolvedValue(null);

  // Act
  const idInvalido = await pedir("GET", "/api/v1/projects/123");
  const inexistente = await pedir("GET", `/api/v1/projects/${CUID.proyecto}`);

  // Assert
  expect(idInvalido.status).toBe(400);
  expect(inexistente.status).toBe(404);
});

test("REG-PROY-05", "Solo el dueño puede borrar un proyecto", async () => {
  // Arrange
  const { token } = sesion();
  mockProyectos.findById.mockResolvedValue(proyecto({ id: CUID.proyecto, userId: "usr_otro" }));

  // Act
  const res = await pedir("DELETE", `/api/v1/projects/${CUID.proyecto}`, { token });

  // Assert
  expect(res.status).toBe(403);
  expect(res.body.error).toBe("No tienes permiso para eliminar este proyecto.");
  expect(mockProyectos.delete).not.toHaveBeenCalled();
});

test("REG-PROY-06", "El dueño borra su proyecto", async () => {
  // Arrange
  const { token } = sesion();
  mockProyectos.findById.mockResolvedValue(proyecto({ id: CUID.proyecto, userId: "usr_001" }));

  // Act
  const res = await pedir("DELETE", `/api/v1/projects/${CUID.proyecto}`, { token });

  // Assert
  expect(res.body).toStrictEqual({ success: true, message: "Proyecto eliminado" });
  expect(mockProyectos.delete).toHaveBeenCalledWith(CUID.proyecto);
});
