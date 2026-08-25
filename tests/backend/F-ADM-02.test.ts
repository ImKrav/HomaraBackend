import { describe, it, expect, beforeEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import {
  mockProductRepository,
  producto,
  datosProducto,
  contextoExpress,
  errorDeNext,
  usuario,
} from "../test-helpers.js";

const findById = vi.fn();
vi.mock("../../src/infrastructure/database/repositories/prisma-user.repository.js", () => ({
  PrismaUserRepository: class {
    findById = (...a: any[]) => findById(...a);
  },
}));

const { requireAdmin } = await import("../../src/infrastructure/http/middlewares/auth.js");
const { CreateProductUseCase, UpdateProductUseCase } = await import(
  "../../src/application/use-cases/catalog.use-cases.js"
);
const { createProductSchema, updateProductSchema } = await import(
  "../../src/infrastructure/http/validators/catalog.validator.js"
);
const { AppError } = await import("../../src/shared/errors/AppError.js");

const SECRETO = process.env.JWT_SECRET || "homara_jwt_secret_key_2026_secure";
const tokenDe = (payload: object) => jwt.sign(payload, SECRETO, { expiresIn: "7d" });

describe("F-ADM-02 · Gestión de productos", () => {
  let repo: ReturnType<typeof mockProductRepository>;
  let crear: InstanceType<typeof CreateProductUseCase>;
  let actualizar: InstanceType<typeof UpdateProductUseCase>;

  beforeEach(() => {
    findById.mockReset();
    repo = mockProductRepository();
    crear = new CreateProductUseCase(repo);
    actualizar = new UpdateProductUseCase(repo);
  });

  it("CP-F-ADM-02-01: Rechaza con 403 a usuarios con rol CUSTOMER antes de modificar productos", async () => {
    findById.mockResolvedValue(usuario({ role: "CUSTOMER" }));
    const { req, res, next } = contextoExpress(
      `Bearer ${tokenDe({ id: "usr_001", email: "ana@homara.com", role: "ADMIN" })}`
    );

    await requireAdmin(req, res, next);

    const error = errorDeNext(next);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe("Acceso denegado. Se requieren permisos de administrador.");
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("CP-F-ADM-02-02: Rechaza campos inválidos (precio negativo, stock negativo, nombre vacío) en validación", () => {
    const precioNegativo = createProductSchema.safeParse(datosProducto({ price: -1 }));
    expect(precioNegativo.success).toBe(false);
    if (!precioNegativo.success) {
      expect(precioNegativo.error.issues[0].message).toBe("El precio no puede ser negativo.");
    }

    const stockNegativo = createProductSchema.safeParse(datosProducto({ stockQuantity: -5 }));
    expect(stockNegativo.success).toBe(false);
    if (!stockNegativo.success) {
      expect(stockNegativo.error.issues[0].message).toBe("El stock no puede ser negativo.");
    }

    const sinNombre = createProductSchema.safeParse(datosProducto({ name: "" }));
    expect(sinNombre.success).toBe(false);
    if (!sinNombre.success) {
      expect(sinNombre.error.issues[0].message).toBe(
        "El nombre es obligatorio y no puede estar vacío."
      );
    }

    expect(updateProductSchema.safeParse({ price: -1 }).success).toBe(false);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("CP-F-ADM-02-03: Retorna 404 al intentar actualizar un producto que no existe", async () => {
    repo.findById.mockResolvedValue(null);

    await expect(actualizar.execute("prd_borrado", { price: 45000 })).rejects.toThrow(AppError);
    await expect(actualizar.execute("prd_borrado", { price: 45000 })).rejects.toThrow(
      "Producto no encontrado"
    );
    expect(repo.findById).toHaveBeenCalledWith("prd_borrado");
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("CP-F-ADM-02-04: Crea producto nuevo con valores derivados y valida precio mayor a 0", async () => {
    repo.create.mockImplementation(async (p: any) => producto({ ...p, id: "prd_nuevo" }));

    const salida = await crear.execute(datosProducto() as any);

    const guardado = repo.create.mock.calls[0][0];
    expect(guardado.inStock).toBe(true);
    expect(guardado.image).toBe("/products/placeholder.jpg");
    expect(guardado.rating).toBe(0);
    expect(guardado.reviewCount).toBe(0);
    expect(guardado.originalPrice).toBeNull();
    expect(guardado.tags).toEqual([]);
    expect(salida.id).toBe("prd_nuevo");
    expect(salida.name).toBe("Cemento Gris 50 kg");

    repo.create.mockClear();
    const sinExistencias = datosProducto({ stockQuantity: 0 });
    expect(createProductSchema.safeParse(sinExistencias).success).toBe(true);

    await crear.execute(sinExistencias as any);

    const guardadoSinExistencias = repo.create.mock.calls[0][0];
    expect(guardadoSinExistencias.stockQuantity).toBe(0);
    expect(guardadoSinExistencias.inStock).toBe(false);

    // DEFECTO: el esquema del servidor acepta precio 0 cuando debería exigir precio > 0 (RF32)
    const precioCero = createProductSchema.safeParse(datosProducto({ price: 0 }));
    expect(precioCero.success).toBe(false);
  });

  it("CP-F-ADM-02-05: Aplica parche parcial en actualización y actualiza inStock si stockQuantity llega a 0", async () => {
    repo.findById.mockResolvedValue(producto());
    repo.update.mockImplementation(async (id: string, d: any) => producto({ id, ...d }));

    const salida = await actualizar.execute("prd_001", { price: 45000, stockQuantity: 30 });

    const parche = repo.update.mock.calls[0][1];
    expect(parche.price).toBe(45000);
    expect(parche.stockQuantity).toBe(30);
    expect(parche).not.toHaveProperty("name");
    expect(parche).not.toHaveProperty("description");
    expect(parche).not.toHaveProperty("categoryId");
    expect(salida.price).toBe(45000);
    expect(salida.name).toBe("Piso Ceramico Beige 60x60");

    // DEFECTO: reducir existencias a 0 en PUT debería marcar inStock = false
    repo.update.mockClear();
    await actualizar.execute("prd_001", { stockQuantity: 0 });
    expect(repo.update.mock.calls[0][1]).toMatchObject({ stockQuantity: 0, inStock: false });
  });
});
