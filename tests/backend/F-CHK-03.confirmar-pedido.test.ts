// ============================================================================
// F-CHK-03 · Confirmar el pedido — Backend
// Grafo:   23_F-CHK-03_BACKEND_Confirmar_el_pedido.drawio
// Unidad:  CreateOrderUseCase.execute()  ·  POST /api/v1/orders
// Métrica: N=14  A=15  P=2  →  V(G) = 15 − 14 + 2 = 3
// Cobertura de ruta básica: 3 caminos independientes → 3 casos de prueba
// Trazabilidad: RF28 · HU21 · ESC28 · RF16 · HU19 · ESC16 · BE-CHK-02
// ============================================================================
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockCartRepository, mockProductRepository } from "../_ayudas.js";
import { CreateOrderUseCase } from "../../src/application/use-cases/order.use-cases.js";
import type { IOrderRepository } from "../../src/domain/repositories/order-repository.interface.js";
import { AppError } from "../../src/shared/errors/AppError.js";

const ID_USUARIO = "usr_001";
const ID_A = "clx0000000000000000000001";
const ID_B = "clx0000000000000000000002";

/** Doble de prueba del repositorio de pedidos (aún no vive en _ayudas.ts). */
function mockOrderRepositoryLocal(): IOrderRepository & Record<string, any> {
  return {
    findAll: vi.fn(),
    findByIdOrNumber: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    countByYear: vi.fn(),
  } as any;
}

/** Línea del carrito con su producto, tal como la devuelve ICartRepository. */
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

/** Carrito devuelto por cartRepository.findByUserId(). */
function carritoCon(items: any[]) {
  return { id: "cart_001", userId: ID_USUARIO, items };
}

/** Datos de envío y pago que el esquema del servidor ya validó (nodo 1). */
const datosEnvio = {
  paymentMethod: "tarjeta",
  shippingAddress: "Calle 1 #2-3",
  shippingCity: "Bogotá",
  shippingState: "Cundinamarca",
  shippingZip: "110111",
  shippingNotes: "Dejar en portería",
};

describe("F-CHK-03 · Confirmar el pedido", () => {
  let pedidos: ReturnType<typeof mockOrderRepositoryLocal>;
  let carritos: ReturnType<typeof mockCartRepository>;
  let productos: ReturnType<typeof mockProductRepository>;
  let caso: CreateOrderUseCase;

  beforeEach(() => {
    pedidos = mockOrderRepositoryLocal();
    carritos = mockCartRepository();
    productos = mockProductRepository();
    // Nodo 12: el checkout transaccional vive en el repositorio (BE-CHK-03);
    // aquí sólo se comprueba con qué datos se le invoca.
    pedidos.create.mockImplementation(async (o: any) => ({
      ...o,
      id: "ord_001",
      orderNumber: "ORD-2026-001",
      createdAt: new Date("2026-08-25"),
    }));
    caso = new CreateOrderUseCase(pedidos, carritos, productos);
  });

  it("CP-F-CHK-03-01 · camino 1,2,3,4,7,14 · Paso 3 = NO → el carrito está vacío y no se genera pedido", async () => {
    // Nodo 3 = NO: el carrito existe pero no tiene ninguna línea.
    carritos.findByUserId.mockResolvedValue(carritoCon([]));

    // Nodos 4 y 7: se corta con un 400 y el mensaje llega al cliente.
    await expect(caso.execute(ID_USUARIO, datosEnvio)).rejects.toThrow(AppError);
    await expect(caso.execute(ID_USUARIO, datosEnvio)).rejects.toThrow("El carrito está vacío");
    try {
      await caso.execute(ID_USUARIO, datosEnvio);
    } catch (e) {
      expect((e as InstanceType<typeof AppError>).statusCode).toBe(400);
    }
    // Salida esperada: no se registra nada ni se descuenta inventario.
    expect(pedidos.create).not.toHaveBeenCalled();
    expect(productos.updateStock).not.toHaveBeenCalled();

    // Misma rama cuando el carrito ni siquiera trae la relación de items.
    carritos.findByUserId.mockResolvedValue({ id: "cart_001", userId: ID_USUARIO, items: undefined });
    await expect(caso.execute(ID_USUARIO, datosEnvio)).rejects.toThrow("El carrito está vacío");
    expect(pedidos.create).not.toHaveBeenCalled();
  });

  it("CP-F-CHK-03-02 · camino 1,2,3,5,6,8,10,11,12,13,14 · Paso 3 = SI, Paso 6 = SI → envío gratis en el valor límite 500001", async () => {
    // Nodo 3 = SI: dos productos en el carrito.
    carritos.findByUserId.mockResolvedValue(
      carritoCon([
        itemCarrito({ id: "ci_a", quantity: 2, price: 200000, stockQuantity: 1 }),
        itemCarrito({ id: "ci_b", productId: ID_B, quantity: 1, price: 100001, stockQuantity: 50 }),
      ])
    );

    const pedido = await caso.execute(ID_USUARIO, datosEnvio);

    const enviado = pedidos.create.mock.calls[0][0];
    // Nodo 5: RF16 — 200.000×2 + 100.001×1 = 500.001.
    expect(enviado.subtotal).toBe(500001);
    // Nodos 6 y 8: 500.001 > 500.000 → envío gratuito (valor límite inferior).
    expect(enviado.shippingCost).toBe(0);
    // Nodo 10.
    expect(enviado.total).toBe(500001);
    // Nodo 11: el detalle congela el precio unitario vigente (HU21).
    expect(enviado.items).toEqual([
      { productId: ID_A, quantity: 2, unitPrice: 200000, total: 400000 },
      { productId: ID_B, quantity: 1, unitPrice: 100001, total: 100001 },
    ]);
    // Nodo 12: el pedido nace en estado PENDIENTE con los datos de envío.
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
    // Nodo 13: se devuelve el consecutivo ORD-AAAA-NNN (RF28).
    expect(pedido.orderNumber).toMatch(/^ORD-\d{4}-\d{3}$/);

    // HALLAZGO (comportamiento actual documentado, no se corrige el código):
    // el caso de uso NO marca el pedido pendiente aunque la primera línea pide
    // 2 unidades y sólo hay 1 en existencias. RF26 se resuelve dentro del
    // checkout transaccional del repositorio (BE-CHK-03), no en esta unidad.
    expect(enviado.items[0]).not.toHaveProperty("isBackorder");
    expect(enviado.items[0]).not.toHaveProperty("backorderQuantity");
    expect(productos.findById).not.toHaveBeenCalled();
  });

  it("CP-F-CHK-03-03 · camino 1,2,3,5,6,9,10,11,12,13,14 · Paso 6 = NO → con 500.000 exactos el envío debería ser gratuito (HU19)", async () => {
    // Nodo 3 = SI con un único producto en el valor límite del nodo 6.
    carritos.findByUserId.mockResolvedValue(
      carritoCon([itemCarrito({ quantity: 4, price: 125000 })])
    );

    const pedido = await caso.execute(ID_USUARIO, datosEnvio);

    const enviado = pedidos.create.mock.calls[0][0];
    // Nodo 5: 125.000 × 4 = 500.000 exactos.
    expect(enviado.subtotal).toBe(500000);
    // Nodos 11 a 13: el detalle congela el precio unitario y llega el consecutivo.
    expect(enviado.items).toEqual([{ productId: ID_A, quantity: 4, unitPrice: 125000, total: 500000 }]);
    expect(pedido.orderNumber).toBe("ORD-2026-001");

    // Un peso más cruza el umbral y el envío pasa a ser gratuito.
    carritos.findByUserId.mockResolvedValue(
      carritoCon([itemCarrito({ quantity: 1, price: 500001 })])
    );
    await caso.execute(ID_USUARIO, datosEnvio);
    expect(pedidos.create.mock.calls[1][0].shippingCost).toBe(0);

    // DEFECTO: con 500.000 exactos el envío no es gratuito.
    // Mismo umbral mal resuelto que en F-CHK-02, ahora sobre el pedido ya
    // confirmado: HU19 pide envío gratuito con un subtotal "igual o mayor a
    // 500.000 COP" y el nodo 6 está implementado como `subtotal > 500000`, así
    // que el cliente paga 25.000 y el total queda en 525.000 en vez de 500.000.
    // La contradicción entre RF16 y HU19 sigue sin resolverse (RF28 · HU21 · ESC16).
    expect(enviado.shippingCost).toBe(0);
    expect(enviado.total).toBe(500000);
    expect(pedido.total).toBe(500000);
  });
});
