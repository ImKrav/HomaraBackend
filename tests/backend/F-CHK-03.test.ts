import { describe, it, expect, beforeEach } from "vitest";
import { mockCartRepository, mockProductRepository, mockOrderRepository } from "../test-helpers.js";
import { CreateOrderUseCase } from "../../src/application/use-cases/order.use-cases.js";
import { AppError } from "../../src/shared/errors/AppError.js";

const ID_USUARIO = "usr_001";
const ID_A = "clx0000000000000000000001";
const ID_B = "clx0000000000000000000002";

function itemCarrito(over: Record<string, any> = {}) {
  const { price = 38900, stockQuantity = 100, productId = ID_A, ...resto } = over;
  return {
    id: "ci_001",
    quantity: 1,
    cartId: "cart_001",
    productId,
    product: { id: productId, name: "Piso Ceramico Beige 60x60", price, stockQuantity },
    ...resto,
  };
}

function carritoCon(items: any[]) {
  return { id: "cart_001", userId: ID_USUARIO, items };
}

const datosEnvio = {
  paymentMethod: "tarjeta",
  shippingAddress: "Calle 1 #2-3",
  shippingCity: "Bogotá",
  shippingState: "Cundinamarca",
  shippingZip: "110111",
  shippingNotes: "Dejar en portería",
};

describe("F-CHK-03 · Confirmar el pedido", () => {
  let pedidos: ReturnType<typeof mockOrderRepository>;
  let carritos: ReturnType<typeof mockCartRepository>;
  let productos: ReturnType<typeof mockProductRepository>;
  let caso: CreateOrderUseCase;

  beforeEach(() => {
    pedidos = mockOrderRepository();
    carritos = mockCartRepository();
    productos = mockProductRepository();
    pedidos.create.mockImplementation(async (o: any) => ({
      ...o,
      id: "ord_001",
      orderNumber: "ORD-2026-001",
      createdAt: new Date("2026-08-25"),
    }));
    caso = new CreateOrderUseCase(pedidos, carritos, productos);
  });

  it("CP-F-CHK-03-01: Rechaza creación de orden cuando el carrito está vacío", async () => {
    carritos.findByUserId.mockResolvedValue(carritoCon([]));

    await expect(caso.execute(ID_USUARIO, datosEnvio)).rejects.toThrow(AppError);
    await expect(caso.execute(ID_USUARIO, datosEnvio)).rejects.toThrow("El carrito está vacío");
    expect(pedidos.create).not.toHaveBeenCalled();
    expect(productos.updateStock).not.toHaveBeenCalled();

    carritos.findByUserId.mockResolvedValue({ id: "cart_001", userId: ID_USUARIO, items: undefined });
    await expect(caso.execute(ID_USUARIO, datosEnvio)).rejects.toThrow("El carrito está vacío");
    expect(pedidos.create).not.toHaveBeenCalled();
  });

  it("CP-F-CHK-03-02: Genera pedido con envío gratuito e ítems congelados cuando subtotal supera 500000", async () => {
    carritos.findByUserId.mockResolvedValue(
      carritoCon([
        itemCarrito({ id: "ci_a", quantity: 2, price: 200000, stockQuantity: 1 }),
        itemCarrito({ id: "ci_b", productId: ID_B, quantity: 1, price: 100001, stockQuantity: 50 }),
      ])
    );

    const pedido = await caso.execute(ID_USUARIO, datosEnvio);
    const enviado = pedidos.create.mock.calls[0][0];

    expect(enviado.subtotal).toBe(500001);
    expect(enviado.shippingCost).toBe(0);
    expect(enviado.total).toBe(500001);
    expect(enviado.items).toEqual([
      { productId: ID_A, quantity: 2, unitPrice: 200000, total: 400000 },
      { productId: ID_B, quantity: 1, unitPrice: 100001, total: 100001 },
    ]);
    expect(enviado.status).toBe("PENDIENTE");
    expect(enviado.userId).toBe(ID_USUARIO);
    expect(enviado).toMatchObject({
      paymentMethod: "tarjeta",
      shippingAddress: "Calle 1 #2-3",
      shippingCity: "Bogotá",
      shippingState: "Cundinamarca",
      shippingZip: "110111",
      shippingNotes: "Dejar en portería",
    });
    expect(pedido.orderNumber).toMatch(/^ORD-\d{4}-\d{3}$/);
    expect(productos.findById).not.toHaveBeenCalled();
  });

  it("CP-F-CHK-03-03: Evalúa umbral de envío gratuito con subtotal de 500000 exactos", async () => {
    carritos.findByUserId.mockResolvedValue(
      carritoCon([itemCarrito({ quantity: 4, price: 125000 })])
    );

    const pedido = await caso.execute(ID_USUARIO, datosEnvio);
    const enviado = pedidos.create.mock.calls[0][0];

    expect(enviado.subtotal).toBe(500000);
    expect(enviado.items).toEqual([{ productId: ID_A, quantity: 4, unitPrice: 125000, total: 500000 }]);
    expect(pedido.orderNumber).toBe("ORD-2026-001");

    carritos.findByUserId.mockResolvedValue(
      carritoCon([itemCarrito({ quantity: 1, price: 500001 })])
    );
    await caso.execute(ID_USUARIO, datosEnvio);
    expect(pedidos.create.mock.calls[1][0].shippingCost).toBe(0);

    // DEFECTO: con 500.000 exactos el envío no es gratuito según HU19 (RF16 vs HU19)
    expect(enviado.shippingCost).toBe(0);
    expect(enviado.total).toBe(500000);
    expect(pedido.total).toBe(500000);
  });
});
