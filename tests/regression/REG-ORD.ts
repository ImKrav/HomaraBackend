// REG-ORD · Regresión de checkout y pedidos (/api/v1/orders)
// Flujo protegido: pagar el carrito → consultar pedidos → el admin cambia el estado.
// Reglas clave: precios tomados del catálogo (no del cliente), envío gratis
// con subtotal > 500.000 y solo un ADMIN cambia estados.

import { vi, beforeEach } from "vitest";
import { test, expect } from "../harness.js";
import { mockCarritos, mockPedidos, reiniciarRepositorios } from "../mocks/repositorios.js";
import { producto, carrito } from "../helpers.js";
import { pedir, sesion, CUID } from "./soporte.js";

vi.mock("../../src/infrastructure/database/repositories/prisma-order.repository.js", async () => {
  const { mockPedidos } = await import("../mocks/repositorios.js");
  return { PrismaOrderRepository: vi.fn(() => mockPedidos) };
});
vi.mock("../../src/infrastructure/database/repositories/prisma-cart.repository.js", async () => {
  const { mockCarritos } = await import("../mocks/repositorios.js");
  return { PrismaCartRepository: vi.fn(() => mockCarritos) };
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

const conItems = (...items: Array<[string, number, number]>) =>
  carrito({
    items: items.map(([id, cantidad, precio]) => ({
      id: `itm_${id}`,
      productId: id,
      quantity: cantidad,
      product: producto({ id, price: precio }),
    })),
  });

const pago = { paymentMethod: "PSE", shippingAddress: "Calle 1 #2-3", shippingCity: "Bogotá" };

test("REG-ORD-01", "No se puede pagar un carrito vacío", async () => {
  // Arrange
  const { token } = sesion();
  mockCarritos.findByUserId.mockResolvedValue(carrito());

  // Act
  const res = await pedir("POST", "/api/v1/orders", { token, body: pago });

  // Assert
  expect(res.status).toBe(400);
  expect(res.body.error).toBe("El carrito está vacío");
  expect(mockPedidos.create).not.toHaveBeenCalled();
});

test("REG-ORD-02", "El pedido se arma con los precios del carrito, 25.000 de envío y estado PENDIENTE", async () => {
  // Arrange
  const { token } = sesion();
  mockCarritos.findByUserId.mockResolvedValue(conItems(["prd_a", 2, 38_900], ["prd_b", 1, 120_000]));
  mockPedidos.create.mockImplementation(async (o: any) => ({ id: CUID.pedido, orderNumber: "ORD-2026-0001", ...o }));

  // Act
  const res = await pedir("POST", "/api/v1/orders", { token, body: { ...pago, total: 1 } });

  // Assert
  expect(res.status).toBe(201);
  expect(mockPedidos.create).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "PENDIENTE",
      userId: "usr_001",
      subtotal: 197_800,
      shippingCost: 25_000,
      total: 222_800,
      paymentMethod: "PSE",
      items: [
        { productId: "prd_a", quantity: 2, unitPrice: 38_900, total: 77_800 },
        { productId: "prd_b", quantity: 1, unitPrice: 120_000, total: 120_000 },
      ],
    }),
  );
  expect(res.body.data.orderNumber).toBe("ORD-2026-0001");
});

test("REG-ORD-03", "Con subtotal mayor a 500.000 el envío del pedido es gratis", async () => {
  // Arrange
  const { token } = sesion();
  mockCarritos.findByUserId.mockResolvedValue(conItems(["prd_a", 3, 200_000]));
  mockPedidos.create.mockImplementation(async (o: any) => o);

  // Act
  const res = await pedir("POST", "/api/v1/orders", { token, body: pago });

  // Assert
  expect(res.body.data).toMatchObject({ subtotal: 600_000, shippingCost: 0, total: 600_000 });
});

test("REG-ORD-04", "El listado del cliente muestra número, estado en minúsculas y nombre", async () => {
  // Arrange
  const { token } = sesion();
  mockPedidos.findAll.mockResolvedValue([
    {
      id: CUID.pedido,
      orderNumber: "ORD-2026-0007",
      createdAt: new Date("2026-03-04T10:00:00Z"),
      status: "ENVIADO",
      items: [{}, {}],
      total: 90_000,
      user: { firstName: "Ana", lastName: "Rojas" },
    },
  ]);

  // Act
  const res = await pedir("GET", "/api/v1/orders", { token });

  // Assert
  expect(res.body.data).toStrictEqual([
    { id: "ORD-2026-0007", dbId: CUID.pedido, date: "2026-03-04", status: "enviado", items: 2, total: 90_000, customer: "Ana Rojas" },
  ]);
  expect(mockPedidos.findAll).toHaveBeenCalledWith({ userId: "usr_001", admin: false });
});

test("REG-ORD-05", "Un cliente no puede cambiar el estado de un pedido", async () => {
  // Arrange
  const { token } = sesion({ role: "CUSTOMER" });

  // Act
  const res = await pedir("PUT", `/api/v1/orders/${CUID.pedido}/status`, { token, body: { status: "ENTREGADO" } });

  // Assert
  expect(res.status).toBe(403);
  expect(res.body.error).toBe("Acceso denegado. Se requieren permisos de administrador.");
  expect(mockPedidos.updateStatus).not.toHaveBeenCalled();
});

test("REG-ORD-06", "El admin cambia el estado solo a valores válidos", async () => {
  // Arrange
  const { token } = sesion({ id: "usr_admin", role: "ADMIN" });
  mockPedidos.updateStatus.mockResolvedValue({ id: CUID.pedido, status: "ENVIADO" });
  const ruta = `/api/v1/orders/${CUID.pedido}/status`;

  // Act
  const valido = await pedir("PUT", ruta, { token, body: { status: "ENVIADO" } });
  const invalido = await pedir("PUT", ruta, { token, body: { status: "PERDIDO" } });

  // Assert
  expect(valido.status).toBe(200);
  expect(mockPedidos.updateStatus).toHaveBeenCalledWith(CUID.pedido, "ENVIADO");
  expect(invalido.status).toBe(400);
  expect(mockPedidos.updateStatus).toHaveBeenCalledTimes(1);
});

test("REG-ORD-07", "El detalle de un pedido inexistente responde 404", async () => {
  // Arrange
  mockPedidos.findByIdOrNumber.mockResolvedValue(null);

  // Act
  const res = await pedir("GET", "/api/v1/orders/ORD-2026-9999");

  // Assert
  expect(res.status).toBe(404);
  expect(res.body.error).toBe("Pedido no encontrado");
});
