// F-CHK-03 · Confirmar el pedido
// Unidad: CreateOrderUseCase.execute()  (POST /api/v1/orders)

import { test, is, eq, ok, matches, subset, grab } from "./harness.js";
import { fakeCarritos, fakeProductos, fakePedidos, arg, neverCalled } from "./helpers.js";
import { CreateOrderUseCase } from "../src/application/use-cases/order.use-cases.js";
import { AppError } from "../src/shared/errors/AppError.js";

const ID_USUARIO = "usr_001";
const ID_A = "clx0000000000000000000001";
const ID_B = "clx0000000000000000000002";

const itemCarrito = (o: Record<string, any> = {}) => {
  const { price = 38900, stockQuantity = 100, productId = ID_A, ...resto } = o;
  return {
    id: "ci_001",
    quantity: 1,
    cartId: "cart_001",
    productId,
    product: { id: productId, name: "Piso Ceramico Beige 60x60", price, stockQuantity },
    ...resto,
  };
};

const carritoCon = (items: any[]) => ({ id: "cart_001", userId: ID_USUARIO, items });

const datosEnvio = {
  paymentMethod: "tarjeta",
  shippingAddress: "Calle 1 #2-3",
  shippingCity: "Bogotá",
  shippingState: "Cundinamarca",
  shippingZip: "110111",
  shippingNotes: "Dejar en portería",
};

function montar() {
  const pedidos = fakePedidos();
  const carritos = fakeCarritos();
  const productos = fakeProductos();
  pedidos.create.does(async (o: any) => ({
    ...o,
    id: "ord_001",
    orderNumber: "ORD-2026-001",
    createdAt: new Date("2026-08-25"),
  }));
  const caso = new CreateOrderUseCase(pedidos as any, carritos as any, productos as any);
  return { pedidos, carritos, productos, caso };
}

test("CP-F-CHK-03-01", "Rechaza creación de orden cuando el carrito está vacío", async () => {
  const { pedidos, carritos, productos, caso } = montar();
  carritos.findByUserId.resolves(carritoCon([]));

  const e1 = await grab(caso.execute(ID_USUARIO, datosEnvio));
  ok(e1 instanceof AppError);
  is(e1.message, "El carrito está vacío");
  ok(neverCalled(pedidos.create));
  ok(neverCalled(productos.updateStock));

  carritos.findByUserId.resolves({ id: "cart_001", userId: ID_USUARIO, items: undefined });
  const e2 = await grab(caso.execute(ID_USUARIO, datosEnvio));
  is(e2.message, "El carrito está vacío");
  ok(neverCalled(pedidos.create));
});

test("CP-F-CHK-03-02", "Genera pedido con envío gratuito e ítems congelados cuando subtotal supera 500000", async () => {
  const { pedidos, productos, carritos, caso } = montar();
  carritos.findByUserId.resolves(
    carritoCon([
      itemCarrito({ id: "ci_a", quantity: 2, price: 200000, stockQuantity: 1 }),
      itemCarrito({ id: "ci_b", productId: ID_B, quantity: 1, price: 100001, stockQuantity: 50 }),
    ]),
  );

  const pedido = await caso.execute(ID_USUARIO, datosEnvio);
  const enviado = arg(pedidos.create);

  is(enviado.subtotal, 500001);
  is(enviado.shippingCost, 0);
  is(enviado.total, 500001);
  eq(enviado.items, [
    { productId: ID_A, quantity: 2, unitPrice: 200000, total: 400000 },
    { productId: ID_B, quantity: 1, unitPrice: 100001, total: 100001 },
  ]);
  is(enviado.status, "PENDIENTE");
  is(enviado.userId, ID_USUARIO);
  subset(enviado, {
    paymentMethod: "tarjeta",
    shippingAddress: "Calle 1 #2-3",
    shippingCity: "Bogotá",
    shippingState: "Cundinamarca",
    shippingZip: "110111",
    shippingNotes: "Dejar en portería",
  });
  matches(pedido.orderNumber, /^ORD-\d{4}-\d{3}$/);
  ok(neverCalled(productos.findById));
});

test("CP-F-CHK-03-03", "Evalúa umbral de envío gratuito con subtotal de 500000 exactos", async () => {
  const { pedidos, carritos, caso } = montar();
  carritos.findByUserId.resolves(carritoCon([itemCarrito({ quantity: 4, price: 125000 })]));

  const pedido = await caso.execute(ID_USUARIO, datosEnvio);
  const enviado = arg(pedidos.create);

  is(enviado.subtotal, 500000);
  eq(enviado.items, [{ productId: ID_A, quantity: 4, unitPrice: 125000, total: 500000 }]);
  is(pedido.orderNumber, "ORD-2026-001");

  carritos.findByUserId.resolves(carritoCon([itemCarrito({ quantity: 1, price: 500001 })]));
  await caso.execute(ID_USUARIO, datosEnvio);
  is(pedidos.create.calls[1][0].shippingCost, 0);

  // DEFECTO: con 500.000 exactos el envío no es gratuito según HU19 (RF16 vs HU19)
  is(enviado.shippingCost, 0);
  is(enviado.total, 500000);
  is(pedido.total, 500000);
});
