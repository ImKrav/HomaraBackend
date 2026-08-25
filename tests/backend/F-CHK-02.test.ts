import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const carritoBuscar = vi.fn();
const carritoCrear = vi.fn();
const lineaBuscarVarias = vi.fn();

vi.mock("../../src/infrastructure/database/prisma-client.js", () => ({
  prisma: {
    cart: {
      findUnique: (...a: any[]) => carritoBuscar(...a),
      create: (...a: any[]) => carritoCrear(...a),
    },
    cartItem: {
      findMany: (...a: any[]) => lineaBuscarVarias(...a),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const { GetCartUseCase } = await import("../../src/application/use-cases/cart.use-cases.js");
const { PrismaCartRepository } = await import(
  "../../src/infrastructure/database/repositories/prisma-cart.repository.js"
);

const ID_USUARIO = "usr_001";
const ID_A = "clx0000000000000000000001";
const ID_B = "clx0000000000000000000002";
const QUINCE_MINUTOS_MS = 15 * 60 * 1000;

function filaProducto(over: Record<string, any> = {}) {
  return {
    id: ID_A,
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

function filaLinea(over: Record<string, any> = {}) {
  const p = over.product ?? filaProducto();
  return {
    id: "ci_001",
    quantity: 1,
    cartId: "cart_001",
    productId: p.id,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...over,
    product: p,
  };
}

function filaCarrito(items: any[] = [], over: Record<string, any> = {}) {
  return {
    id: "cart_001",
    userId: ID_USUARIO,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    items,
    ...over,
  };
}

describe("F-CHK-02 · Ver y modificar el carrito", () => {
  let caso: InstanceType<typeof GetCartUseCase>;

  beforeEach(() => {
    [carritoBuscar, carritoCrear, lineaBuscarVarias].forEach((m) => m.mockReset());
    lineaBuscarVarias.mockResolvedValue([]);
    caso = new GetCartUseCase(new PrismaCartRepository());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("CP-F-CHK-02-01: Crea un carrito vacío cuando el usuario no tenía uno previo", async () => {
    carritoBuscar.mockResolvedValue(null);
    carritoCrear.mockResolvedValue(filaCarrito([], { id: "cart_nuevo" }));

    const salida = await caso.execute(ID_USUARIO);

    expect(carritoCrear).toHaveBeenCalledTimes(1);
    expect(carritoCrear.mock.calls[0][0].data).toEqual({ userId: ID_USUARIO });
    expect(salida.id).toBe("cart_nuevo");
    expect(lineaBuscarVarias).not.toHaveBeenCalled();
    expect(salida.items).toEqual([]);
    expect(salida.itemCount).toBe(0);
    expect(salida.subtotal).toBe(0);
    expect(salida.shipping).toBe(25000);
    expect(salida.total).toBe(25000);
  });

  it("CP-F-CHK-02-02: Retorna estructura de carrito existente sin productos", async () => {
    carritoBuscar.mockResolvedValue(filaCarrito([]));

    const salida = await caso.execute(ID_USUARIO);

    expect(carritoCrear).not.toHaveBeenCalled();
    expect(carritoBuscar.mock.calls[0][0].where).toEqual({ userId: ID_USUARIO });
    expect(lineaBuscarVarias).not.toHaveBeenCalled();
    expect(salida).toMatchObject({ subtotal: 0, shipping: 25000, total: 25000, itemCount: 0 });
  });

  it("CP-F-CHK-02-03: Calcula backorder y aplica envío gratuito cuando subtotal supera 500000", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-25T12:00:00.000Z"));

    carritoBuscar.mockResolvedValue(
      filaCarrito([filaLinea({ quantity: 3, product: filaProducto({ price: 200000, stockQuantity: 10 }) })])
    );
    lineaBuscarVarias.mockResolvedValue([{ productId: ID_A, quantity: 8 }]);

    const salida = await caso.execute(ID_USUARIO);

    const filtro = lineaBuscarVarias.mock.calls[0][0].where;
    expect(filtro.productId).toEqual({ in: [ID_A] });
    expect(filtro.cartId).toEqual({ not: "cart_001" });
    expect(filtro.updatedAt.gte).toEqual(new Date("2026-08-25T11:45:00.000Z"));
    expect(salida.items[0].availableStock).toBe(2);
    expect(salida.items[0].isBackorder).toBe(true);
    expect(salida.items[0].backorderQuantity).toBe(1);
    expect(salida.subtotal).toBe(600000);
    expect(salida.shipping).toBe(0);
    expect(salida.total).toBe(600000);
    expect(salida.itemCount).toBe(1);
  });

  it("CP-F-CHK-02-04: Muestra disponibilidad total sin backorder con stock suficiente", async () => {
    carritoBuscar.mockResolvedValue(
      filaCarrito([filaLinea({ quantity: 1, product: filaProducto({ price: 500001, stockQuantity: 10 }) })])
    );
    lineaBuscarVarias.mockResolvedValue([]);

    const salida = await caso.execute(ID_USUARIO);

    expect(salida.items[0].availableStock).toBe(10);
    expect(salida.items[0].isBackorder).toBe(false);
    expect(salida.items[0].backorderQuantity).toBe(0);
    expect(salida.subtotal).toBe(500001);
    expect(salida.shipping).toBe(0);
    expect(salida.total).toBe(500001);
    expect(lineaBuscarVarias).toHaveBeenCalledTimes(1);
  });

  it("CP-F-CHK-02-05: Itera múltiples líneas combinando disponibles y pedidos pendientes", async () => {
    carritoBuscar.mockResolvedValue(
      filaCarrito([
        filaLinea({ id: "ci_a", quantity: 5, product: filaProducto({ price: 100000, stockQuantity: 4 }) }),
        filaLinea({ id: "ci_b", quantity: 2, product: filaProducto({ id: ID_B, price: 150000, stockQuantity: 50 }) }),
      ])
    );
    lineaBuscarVarias.mockResolvedValue([{ productId: ID_A, quantity: 2 }]);

    const salida = await caso.execute(ID_USUARIO);

    expect(lineaBuscarVarias.mock.calls[0][0].where.productId).toEqual({ in: [ID_A, ID_B] });
    expect(salida.items[0].availableStock).toBe(2);
    expect(salida.items[0].isBackorder).toBe(true);
    expect(salida.items[0].backorderQuantity).toBe(3);
    expect(salida.items[1].availableStock).toBe(50);
    expect(salida.items[1].isBackorder).toBe(false);
    expect(salida.items[1].backorderQuantity).toBe(0);
    expect(salida.subtotal).toBe(800000);
    expect(salida.shipping).toBe(0);
    expect(salida.total).toBe(800000);
    expect(salida.itemCount).toBe(2);
  });

  it("CP-F-CHK-02-06: Cobra tarifa de envío con subtotal inferior al umbral y evalúa umbral de 500000", async () => {
    carritoBuscar.mockResolvedValue(filaCarrito([]));

    const vacio = await caso.execute(ID_USUARIO);
    expect(vacio.subtotal).toBe(0);
    expect(vacio.shipping).toBe(25000);
    expect(vacio.total).toBe(25000);

    carritoBuscar.mockResolvedValue(
      filaCarrito([filaLinea({ quantity: 2, product: filaProducto({ price: 250000, stockQuantity: 10 }) })])
    );
    lineaBuscarVarias.mockResolvedValue([]);

    const limite = await caso.execute(ID_USUARIO);
    expect(limite.subtotal).toBe(500000);

    // DEFECTO: con 500.000 exactos el envío no es gratuito según HU19 (RF16 vs HU19)
    expect(limite.shipping).toBe(0);
    expect(limite.total).toBe(500000);
  });
});
