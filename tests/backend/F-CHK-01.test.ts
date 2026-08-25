import { describe, it, expect, beforeEach, vi } from "vitest";
import { contextoExpress, errorDeNext } from "../test-helpers.js";

const carritoBuscar = vi.fn();
const carritoCrear = vi.fn();
const lineaBuscar = vi.fn();
const lineaActualizar = vi.fn();
const lineaCrear = vi.fn();
const lineaBuscarVarias = vi.fn();
const usuarioBuscarPorId = vi.fn();

vi.mock("../../src/infrastructure/database/prisma-client.js", () => ({
  prisma: {
    cart: {
      findUnique: (...a: any[]) => carritoBuscar(...a),
      create: (...a: any[]) => carritoCrear(...a),
    },
    cartItem: {
      findUnique: (...a: any[]) => lineaBuscar(...a),
      update: (...a: any[]) => lineaActualizar(...a),
      create: (...a: any[]) => lineaCrear(...a),
      findMany: (...a: any[]) => lineaBuscarVarias(...a),
    },
  },
}));

vi.mock("../../src/infrastructure/database/repositories/prisma-user.repository.js", () => ({
  PrismaUserRepository: class {
    findById = (...a: any[]) => usuarioBuscarPorId(...a);
  },
}));

const { AddCartItemUseCase } = await import("../../src/application/use-cases/cart.use-cases.js");
const { PrismaCartRepository } = await import(
  "../../src/infrastructure/database/repositories/prisma-cart.repository.js"
);
const { addItemSchema } = await import("../../src/infrastructure/http/validators/cart.validator.js");
const { requireAuth } = await import("../../src/infrastructure/http/middlewares/auth.js");
const { AppError } = await import("../../src/shared/errors/AppError.js");

const ID_PRODUCTO = "clx0000000000000000000001";
const ID_USUARIO = "usr_001";

function filaProducto(over: Record<string, any> = {}) {
  return {
    id: ID_PRODUCTO,
    name: "Piso Ceramico Beige 60x60",
    description: "Piso ceramico para interiores",
    price: 38900,
    originalPrice: null,
    image: "piso.png",
    rating: 4.5,
    reviewCount: 10,
    inStock: true,
    stockQuantity: 100,
    unit: "m²",
    categoryId: "cat_001",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    tags: [{ name: "nuevo" }],
    category: { name: "Pisos y Ceramicas", slug: "pisos-ceramicas" },
    ...over,
  };
}

function filaCarrito(over: Record<string, any> = {}) {
  return {
    id: "cart_001",
    userId: ID_USUARIO,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    items: [],
    ...over,
  };
}

function filaLinea(over: Record<string, any> = {}) {
  return {
    id: "ci_001",
    quantity: 2,
    cartId: "cart_001",
    productId: ID_PRODUCTO,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...over,
  };
}

describe("F-CHK-01 · Agregar un producto al carrito", () => {
  let repo: InstanceType<typeof PrismaCartRepository>;
  let caso: InstanceType<typeof AddCartItemUseCase>;

  beforeEach(() => {
    [carritoBuscar, carritoCrear, lineaBuscar, lineaActualizar, lineaCrear,
     lineaBuscarVarias, usuarioBuscarPorId].forEach((m) => m.mockReset());
    repo = new PrismaCartRepository();
    caso = new AddCartItemUseCase(repo);
  });

  it("CP-F-CHK-01-01: Retorna 401 sin sesión autenticada antes de modificar el carrito", async () => {
    const { req, res, next } = contextoExpress();

    await requireAuth(req, res, next);

    const error = errorDeNext(next);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
    expect(req.user).toBeUndefined();
    expect(carritoBuscar).not.toHaveBeenCalled();
    expect(lineaCrear).not.toHaveBeenCalled();
  });

  it("CP-F-CHK-01-02: Valida esquema para cantidades (1..9999, enteros) y formato cuid de ID", () => {
    const cero = addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 0 });
    expect(cero.success).toBe(false);
    if (!cero.success) expect(cero.error.issues[0].message).toContain("al menos 1");

    expect(addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 10000 }).success).toBe(false);

    const decimal = addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 2.5 });
    expect(decimal.success).toBe(false);
    if (!decimal.success) expect(decimal.error.issues[0].message).toContain("entero");

    const idMalo = addItemSchema.safeParse({ productId: "123", quantity: 1 });
    expect(idMalo.success).toBe(false);
    if (!idMalo.success) expect(idMalo.error.issues[0].message).toBe("ID de producto inválido");

    expect(addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 1 }).success).toBe(true);
    expect(addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 9999 }).success).toBe(true);
    expect(addItemSchema.parse({ productId: ID_PRODUCTO }).quantity).toBe(1);
    expect(carritoBuscar).not.toHaveBeenCalled();
  });

  it("CP-F-CHK-01-03: Crea carrito si no existía y acumula cantidad si la línea ya existía", async () => {
    carritoBuscar.mockResolvedValue(null);
    carritoCrear.mockResolvedValue(filaCarrito({ id: "cart_nuevo" }));
    lineaBuscar.mockResolvedValue(filaLinea({ cartId: "cart_nuevo", quantity: 2 }));
    lineaActualizar.mockResolvedValue(
      filaLinea({ cartId: "cart_nuevo", quantity: 5, product: filaProducto() })
    );

    const item = await caso.execute(ID_USUARIO, ID_PRODUCTO, 3);

    expect(carritoCrear).toHaveBeenCalledTimes(1);
    expect(carritoCrear.mock.calls[0][0].data).toEqual({ userId: ID_USUARIO });
    expect(lineaCrear).not.toHaveBeenCalled();
    expect(lineaActualizar).toHaveBeenCalledTimes(1);
    expect(lineaActualizar.mock.calls[0][0].data).toEqual({ quantity: 5 });
    expect(item.quantity).toBe(5);
    expect(item.productId).toBe(ID_PRODUCTO);
  });

  it("CP-F-CHK-01-04: Acumula cantidades de producto existente en el carrito respetando tope", async () => {
    carritoBuscar.mockResolvedValue(filaCarrito());
    lineaBuscar.mockResolvedValue(filaLinea({ quantity: 9997 }));
    lineaActualizar.mockResolvedValue(filaLinea({ quantity: 9999, product: filaProducto() }));

    const item = await caso.execute(ID_USUARIO, ID_PRODUCTO, 2);

    expect(carritoCrear).not.toHaveBeenCalled();
    expect(lineaBuscar.mock.calls[0][0].where).toEqual({
      cartId_productId: { cartId: "cart_001", productId: ID_PRODUCTO },
    });
    expect(lineaActualizar.mock.calls[0][0].data).toEqual({ quantity: 9999 });
    expect(item.quantity).toBe(9999);

    lineaBuscar.mockResolvedValue(filaLinea({ quantity: 9999 }));
    lineaActualizar.mockResolvedValue(filaLinea({ quantity: 19998, product: filaProducto() }));

    // DEFECTO: la acumulación supera el máximo de 9999 sin validación adicional
    const excedido = await caso.execute(ID_USUARIO, ID_PRODUCTO, 9999);
    expect(excedido.quantity).toBeLessThanOrEqual(9999);
  });

  it("CP-F-CHK-01-05: Agrega una nueva línea de producto cuando no estaba en el carrito", async () => {
    carritoBuscar.mockResolvedValue(filaCarrito());
    lineaBuscar.mockResolvedValue(null);
    lineaCrear.mockResolvedValue(filaLinea({ id: "ci_nuevo", quantity: 1, product: filaProducto() }));

    const item = await caso.execute(ID_USUARIO, ID_PRODUCTO, 1);

    expect(lineaActualizar).not.toHaveBeenCalled();
    expect(lineaCrear).toHaveBeenCalledTimes(1);
    expect(lineaCrear.mock.calls[0][0].data).toEqual({
      cartId: "cart_001",
      productId: ID_PRODUCTO,
      quantity: 1,
    });
    expect(item.id).toBe("ci_nuevo");
    expect(item.quantity).toBe(1);
    expect(item.product?.id).toBe(ID_PRODUCTO);
  });
});
