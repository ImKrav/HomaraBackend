// F-ADM-02 · Gestión de productos
// Unidad: CreateProductUseCase.execute() y UpdateProductUseCase.execute()  (POST y PUT /api/v1/products)

import { vi, beforeEach } from "vitest";
import { test, grab, expect } from "./harness.js";
import { fakeProductos, producto, datosProducto, contextoExpress, errorDeNext, usuario } from "./helpers.js";
import { mockUsuarios, reiniciarRepositorios } from "./mocks/repositorios.js";
import jwt from "jsonwebtoken";
import { requireAdmin } from "../src/infrastructure/http/middlewares/auth.js";
import { CreateProductUseCase, UpdateProductUseCase } from "../src/application/use-cases/catalog.use-cases.js";
import { createProductSchema, updateProductSchema } from "../src/infrastructure/http/validators/catalog.validator.js";
import { AppError } from "../src/shared/errors/AppError.js";

const SECRETO = process.env.JWT_SECRET || "homara_jwt_secret_key_2026_secure";
const tokenDe = (payload: object) => jwt.sign(payload, SECRETO, { expiresIn: "7d" });

function montar() {
  const repo = fakeProductos();
  const crear = new CreateProductUseCase(repo as any);
  const actualizar = new UpdateProductUseCase(repo as any);
  return { repo, crear, actualizar };
}

// `requireAdmin` re-consulta el usuario en la base: se mockea el repositorio
// que el middleware construye al importarse.
vi.mock("../src/infrastructure/database/repositories/prisma-user.repository.js", async () => {
  const { mockUsuarios } = await import("./mocks/repositorios.js");
  return { PrismaUserRepository: vi.fn(() => mockUsuarios) };
});

beforeEach(reiniciarRepositorios);

test("CP-F-ADM-02-01", "Rechaza con 403 a usuarios con rol CUSTOMER antes de modificar productos", async () => {
  // Arrange
  const { repo } = montar();
  mockUsuarios.findById.mockResolvedValue(usuario({ role: "CUSTOMER" }));
  const { req, res, next } = contextoExpress(
    `Bearer ${tokenDe({ id: "usr_001", email: "ana@homara.com", role: "ADMIN" })}`,
  );

  // Act
  await requireAdmin(req, res, next);

  // Assert
  const error = errorDeNext(next);
  expect(error).toBeInstanceOf(AppError);
  expect(error.statusCode).toBe(403);
  expect(error.message).toBe("Acceso denegado. Se requieren permisos de administrador.");
  expect(repo.create).not.toHaveBeenCalled();
  expect(repo.update).not.toHaveBeenCalled();
});

test("CP-F-ADM-02-02", "Rechaza campos inválidos (precio negativo, stock negativo, nombre vacío) en validación", () => {
  // Arrange
  const { repo } = montar();

  // Act
  const precioNegativo = createProductSchema.safeParse(datosProducto({ price: -1 }));
  const stockNegativo = createProductSchema.safeParse(datosProducto({ stockQuantity: -5 }));
  const sinNombre = createProductSchema.safeParse(datosProducto({ name: "" }));
  const parcheConPrecioNegativo = updateProductSchema.safeParse({ price: -1 });

  // Assert
  expect(precioNegativo.success).toBe(false);
  if (!precioNegativo.success) expect(precioNegativo.error.issues[0].message).toBe("El precio no puede ser negativo.");
  expect(stockNegativo.success).toBe(false);
  if (!stockNegativo.success) expect(stockNegativo.error.issues[0].message).toBe("El stock no puede ser negativo.");
  expect(sinNombre.success).toBe(false);
  if (!sinNombre.success) expect(sinNombre.error.issues[0].message).toBe("El nombre es obligatorio y no puede estar vacío.");
  expect(parcheConPrecioNegativo.success).toBe(false);
  expect(repo.create).not.toHaveBeenCalled();
  expect(repo.update).not.toHaveBeenCalled();
});

test("CP-F-ADM-02-03", "Retorna 404 al intentar actualizar un producto que no existe", async () => {
  // Arrange
  const { repo, actualizar } = montar();
  repo.findById.mockResolvedValue(null);

  // Act
  const error = await grab(actualizar.execute("prd_borrado", { price: 45000 }));

  // Assert
  expect(error).toBeInstanceOf(AppError);
  expect(error.message).toBe("Producto no encontrado");
  expect(repo.findById).toHaveBeenCalledWith("prd_borrado");
  expect(repo.update).not.toHaveBeenCalled();
});

// Defecto abierto #12 (ver la tabla en tests/README.md): se espera que falle.
test.fails("CP-F-ADM-02-04", "Crea producto nuevo con valores derivados y valida precio mayor a 0", async () => {
  // Arrange
  const { repo, crear } = montar();
  repo.create.mockImplementation(async (p: any) => producto({ ...p, id: "prd_nuevo" }));
  const sinExistencias = datosProducto({ stockQuantity: 0 });

  // Act — se captura lo guardado antes de rearmar el doble para el 2º escenario.
  const salida = await crear.execute(datosProducto() as any);
  const guardado = repo.create.mock.calls[0][0];

  repo.create.mockReset();
  repo.create.mockImplementation(async (p: any) => producto({ ...p, id: "prd_nuevo" }));
  const validacionSinExistencias = createProductSchema.safeParse(sinExistencias);
  await crear.execute(sinExistencias as any);
  const guardadoSinExistencias = repo.create.mock.calls[0][0];

  const precioCero = createProductSchema.safeParse(datosProducto({ price: 0 }));

  // Assert
  expect(guardado.inStock).toBe(true);
  expect(guardado.image).toBe("/products/placeholder.jpg");
  expect(guardado.rating).toBe(0);
  expect(guardado.reviewCount).toBe(0);
  expect(guardado.originalPrice).toBe(null);
  expect(guardado.tags).toStrictEqual([]);
  expect(salida.id).toBe("prd_nuevo");
  expect(salida.name).toBe("Cemento Gris 50 kg");
  expect(validacionSinExistencias.success).toBe(true);
  expect(guardadoSinExistencias.stockQuantity).toBe(0);
  expect(guardadoSinExistencias.inStock).toBe(false);
  // DEFECTO: el esquema del servidor acepta precio 0 cuando debería exigir precio > 0 (RF32)
  expect(precioCero.success).toBe(false);
});

// Defecto abierto #13 (ver la tabla en tests/README.md): se espera que falle.
test.fails("CP-F-ADM-02-05", "Aplica parche parcial en actualización y actualiza inStock si stockQuantity llega a 0", async () => {
  // Arrange
  const { repo, actualizar } = montar();
  repo.findById.mockResolvedValue(producto());
  repo.update.mockImplementation(async (id: string, d: any) => producto({ id, ...d }));

  // Act — se captura el parche antes de rearmar el doble para el 2º escenario.
  const salida = await actualizar.execute("prd_001", { price: 45000, stockQuantity: 30 });
  const parche = repo.update.mock.calls[0][1];

  repo.update.mockReset();
  repo.update.mockImplementation(async (id: string, d: any) => producto({ id, ...d }));
  await actualizar.execute("prd_001", { stockQuantity: 0 });
  const parcheSinExistencias = repo.update.mock.calls[0][1];

  // Assert
  expect(parche.price).toBe(45000);
  expect(parche.stockQuantity).toBe(30);
  expect(parche).not.toHaveProperty("name");
  expect(parche).not.toHaveProperty("description");
  expect(parche).not.toHaveProperty("categoryId");
  expect(salida.price).toBe(45000);
  expect(salida.name).toBe("Piso Ceramico Beige 60x60");
  // DEFECTO: reducir existencias a 0 en PUT debería marcar inStock = false
  expect(parcheSinExistencias).toMatchObject({ stockQuantity: 0, inStock: false });
});
