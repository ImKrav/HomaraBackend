// ============================================================================
// F-ADM-02 · Gestión de productos — Backend
// Grafo:   27_F-ADM-02_BACKEND_Gestion_de_productos.drawio
// Unidad:  CreateProductUseCase.execute() y UpdateProductUseCase.execute()
//          POST /api/v1/products  ·  PUT /api/v1/products/:id
// Métrica: N=20  A=23  P=4  →  V(G) = 23 − 20 + 2 = 5
// Cobertura de ruta básica: 5 caminos independientes → 5 casos de prueba
// Trazabilidad: RF32 · HU39 · ESC32 · RNF02–ESC36
// ============================================================================
import { describe, it, expect, beforeEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import {
  mockProductRepository,
  producto,
  datosProducto,
  contextoExpress,
  errorDeNext,
  usuario,
} from "../_ayudas.js";

// El middleware requireAdmin instancia PrismaUserRepository al cargar el módulo: se sustituye.
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

  it("CP-F-ADM-02-01 · camino 1,2,3,4,7,F · Paso 3 = NO → un cliente no puede guardar productos", async () => {
    // Nodo 2: la sesión es válida, pero el rol almacenado es CUSTOMER (Paso 3 = NO).
    findById.mockResolvedValue(usuario({ role: "CUSTOMER" }));
    const { req, res, next } = contextoExpress(
      `Bearer ${tokenDe({ id: "usr_001", email: "ana@homara.com", role: "ADMIN" })}`
    );

    await requireAdmin(req, res, next);

    // Nodos 4 y 7: se corta con 403 antes de validar campos o tocar el repositorio.
    const error = errorDeNext(next);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe("Acceso denegado. Se requieren permisos de administrador.");
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("CP-F-ADM-02-02 · camino 1,2,3,5,6,8,12,F · Paso 3 = SI, Paso 6 = NO → los campos inválidos se rechazan antes de guardar", async () => {
    // Nodo 5: la validación corre en validateZod(createProductSchema), antes del caso de uso.
    const precioNegativo = createProductSchema.safeParse(datosProducto({ price: -1 }));
    expect(precioNegativo.success).toBe(false);
    if (!precioNegativo.success) {
      expect(precioNegativo.error.issues[0].message).toBe("El precio no puede ser negativo.");
    }

    // Nodo 6 = NO también para las existencias negativas y para el nombre vacío.
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

    // Nodo 8: el mismo rechazo aplica al esquema de edición.
    expect(updateProductSchema.safeParse({ price: -1 }).success).toBe(false);
    // Salida esperada: el flujo termina en el errorHandler; el repositorio nunca se usa.
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("CP-F-ADM-02-03 · camino 1,2,3,5,6,9,10,13,15,19,F · Paso 9 = SI, Paso 13 = NO → editar un producto inexistente devuelve 404", async () => {
    // Nodo 10: la ruta trae :id, pero la búsqueda no encuentra nada (Paso 13 = NO).
    repo.findById.mockResolvedValue(null);

    await expect(actualizar.execute("prd_borrado", { price: 45000 })).rejects.toThrow(AppError);
    await expect(actualizar.execute("prd_borrado", { price: 45000 })).rejects.toThrow(
      "Producto no encontrado"
    );

    // Nodos 15 y 19: no se intenta ninguna escritura.
    expect(repo.findById).toHaveBeenCalledWith("prd_borrado");
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("CP-F-ADM-02-04 · camino 1,2,3,5,6,9,11,14,17,F · Paso 9 = NO → el producto nuevo se crea con sus valores derivados", async () => {
    repo.create.mockImplementation(async (p: any) => producto({ ...p, id: "prd_nuevo" }));

    const salida = await crear.execute(datosProducto() as any);

    // Nodo 11: con 120 unidades el producto queda disponible y toma la imagen por defecto.
    const guardado = repo.create.mock.calls[0][0];
    expect(guardado.inStock).toBe(true);
    expect(guardado.image).toBe("/products/placeholder.jpg");
    expect(guardado.rating).toBe(0);
    expect(guardado.reviewCount).toBe(0);
    expect(guardado.originalPrice).toBeNull();
    expect(guardado.tags).toEqual([]);
    // Nodo 17: se confirma el producto guardado.
    expect(salida.id).toBe("prd_nuevo");
    expect(salida.name).toBe("Cemento Gris 50 kg");

    // Valor límite sobre el mismo camino: stock 0 sí es un dato válido de alta.
    repo.create.mockClear();
    const sinExistencias = datosProducto({ stockQuantity: 0 });
    expect(createProductSchema.safeParse(sinExistencias).success).toBe(true); // nodo 6 = SI

    await crear.execute(sinExistencias as any);

    // Nodo 11: sin existencias el producto se marca como no disponible.
    const guardadoSinExistencias = repo.create.mock.calls[0][0];
    expect(guardadoSinExistencias.stockQuantity).toBe(0);
    expect(guardadoSinExistencias.inStock).toBe(false);

    // DEFECTO: el servidor deja publicar un producto con precio 0.
    // El nodo 5 (createProductSchema) solo exige `nonnegative`, mientras AdminProductosPage
    // exige un precio mayor que cero. Un producto dado de alta por la API con precio 0 queda
    // publicado en el catálogo y se puede llevar al carrito gratis. El esquema debe rechazar
    // el precio 0 igual que rechaza los negativos, para que las dos capas apliquen la misma
    // regla de negocio (RF32, criterio 2).
    const precioCero = createProductSchema.safeParse(datosProducto({ price: 0 }));
    expect(precioCero.success).toBe(false);
  });

  it("CP-F-ADM-02-05 · camino 1,2,3,5,6,9,10,13,16,18,F · Paso 9 = SI, Paso 13 = SI → la edición aplica solo los campos enviados", async () => {
    // Nodo 10: el producto existe (Paso 13 = SI).
    repo.findById.mockResolvedValue(producto());
    repo.update.mockImplementation(async (id: string, d: any) => producto({ id, ...d }));

    const salida = await actualizar.execute("prd_001", { price: 45000, stockQuantity: 30 });

    // Nodo 16: se envía el parche recibido, sin rellenar los campos que no se tocaron.
    const parche = repo.update.mock.calls[0][1];
    expect(parche.price).toBe(45000);
    expect(parche.stockQuantity).toBe(30);
    expect(parche).not.toHaveProperty("name");
    expect(parche).not.toHaveProperty("description");
    expect(parche).not.toHaveProperty("categoryId");
    // Nodo 18: se confirma el producto guardado con el nombre que ya tenía.
    expect(salida.price).toBe(45000);
    expect(salida.name).toBe("Piso Ceramico Beige 60x60");

    // DEFECTO: bajar las existencias a 0 por PUT deja el producto marcado como disponible.
    // UpdateProductUseCase pasa el parche tal cual al repositorio y no recalcula inStock al
    // cambiar stockQuantity: ese cálculo solo existe en el nodo 11 del camino de creación y
    // en updateStock(). Un producto agotado desde el panel sigue apareciendo como disponible
    // en el catálogo y se puede añadir al carrito. El caso de uso debe derivar
    // inStock = stockQuantity > 0 también en la edición.
    repo.update.mockClear();
    await actualizar.execute("prd_001", { stockQuantity: 0 });
    expect(repo.update.mock.calls[0][1]).toMatchObject({ stockQuantity: 0, inStock: false });
  });
});
