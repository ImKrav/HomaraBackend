// REG-ADM · Regresión del panel de administración
// (/api/v1/admin, alta/edición/baja de productos en /api/v1/products)
// Flujo protegido: solo un ADMIN entra; métricas, inventario y gestión de productos.

import { vi, beforeEach } from "vitest";
import { test, expect } from "../harness.js";
import { mockPrisma, mockProductos, reiniciarRepositorios } from "../mocks/repositorios.js";
import { datosProducto, producto, programarOrdenes, ordenEntregada, itemVendido } from "../helpers.js";
import { pedir, sesion, CUID } from "./soporte.js";

vi.mock("../../src/infrastructure/database/prisma-client.js", async () => {
  const { mockPrisma } = await import("../mocks/repositorios.js");
  return { prisma: mockPrisma };
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

const admin = () => sesion({ id: "usr_admin", role: "ADMIN" });

test("REG-ADM-01", "Un cliente no entra al panel ni gestiona productos", async () => {
  // Arrange
  const { token } = sesion({ role: "CUSTOMER" });

  // Act
  const metricas = await pedir("GET", "/api/v1/admin/metrics", { token });
  const inventario = await pedir("GET", "/api/v1/admin/inventory", { token });
  const alta = await pedir("POST", "/api/v1/products", { token, body: datosProducto() });

  // Assert
  for (const res of [metricas, inventario, alta]) expect(res.status).toBe(403);
  expect(mockPrisma.order.findMany).not.toHaveBeenCalled();
  expect(mockProductos.create).not.toHaveBeenCalled();
});

test("REG-ADM-02", "Las métricas suman solo pedidos ENTREGADOS y cuentan los activos", async () => {
  // Arrange
  const { token } = admin();
  programarOrdenes(mockPrisma as any, {
    actual: [ordenEntregada({ total: 300_000 }), ordenEntregada({ total: 200_000 })],
    anterior: [ordenEntregada({ total: 250_000 })],
  });
  mockPrisma.order.count.mockResolvedValue(4);
  mockPrisma.product.count.mockResolvedValue(120);
  mockPrisma.user.count.mockResolvedValue(7);
  mockPrisma.orderItem.findMany.mockResolvedValue([itemVendido(300_000), itemVendido(100_000, "Pinturas")]);

  // Act
  const res = await pedir("GET", "/api/v1/admin/metrics", { token });

  // Assert
  expect(res.status).toBe(200);
  const [ventas, activos, productos, clientes] = res.body.data;
  expect(ventas.value.replaceAll(/\D/g, "")).toBe("500000");
  expect(ventas.change).toBe(100);
  expect(activos.value).toBe("4");
  expect(productos.value).toBe("120");
  expect(clientes.value).toBe("7");
  expect(res.body.charts.topCategories).toStrictEqual([
    { name: "Pisos y Ceramicas", pct: 75 },
    { name: "Pinturas", pct: 25 },
  ]);
  expect(mockPrisma.order.findMany.mock.calls[0][0].where.status).toBe("ENTREGADO");
});

test("REG-ADM-03", "El inventario clasifica el stock y valoriza cada producto", async () => {
  // Arrange
  const { token } = admin();
  const fila = (id: string, stockQuantity: number) => ({
    id, name: id, stockQuantity, unit: "m²", price: 10_000, inStock: stockQuantity > 0, category: { name: "Pisos" },
  });
  mockPrisma.product.findMany.mockResolvedValue([fila("agotado", 0), fila("bajo", 10), fila("normal", 80)]);

  // Act
  const res = await pedir("GET", "/api/v1/admin/inventory", { token });

  // Assert
  expect(res.body.data.stats).toMatchObject({ totalProducts: 3, totalUnits: 90, lowStockCount: 1, outOfStockCount: 1 });
  expect(res.body.data.products.map((p: any) => p.stockStatus)).toStrictEqual(["sin_stock", "stock_bajo", "normal"]);
  expect(res.body.data.products[2].stockValue).toBe(800_000);
});

test("REG-ADM-04", "El admin da de alta, edita y elimina productos", async () => {
  // Arrange
  const { token } = admin();
  mockProductos.create.mockImplementation(async (d: any) => producto({ ...d, id: CUID.producto }));
  mockProductos.findById.mockResolvedValue(producto({ id: CUID.producto }));
  mockProductos.update.mockImplementation(async (_id: string, d: any) => producto({ id: CUID.producto, ...d }));
  const ruta = `/api/v1/products/${CUID.producto}`;

  // Act
  const alta = await pedir("POST", "/api/v1/products", { token, body: datosProducto() });
  const edicion = await pedir("PUT", ruta, { token, body: { price: 35_000 } });
  const baja = await pedir("DELETE", ruta, { token });

  // Assert
  expect(alta.status).toBe(201);
  expect(mockProductos.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Cemento Gris 50 kg", price: 32_000 }));
  expect(edicion.status).toBe(200);
  expect(edicion.body.data.price).toBe(35_000);
  expect(baja.status).toBe(200);
  expect(mockProductos.delete).toHaveBeenCalledWith(CUID.producto);
});

test("REG-ADM-05", "El alta rechaza precios o stock negativos antes de llegar al repositorio", async () => {
  // Arrange
  const { token } = admin();

  // Act
  const precio = await pedir("POST", "/api/v1/products", { token, body: datosProducto({ price: -1 }) });
  const stock = await pedir("POST", "/api/v1/products", { token, body: datosProducto({ stockQuantity: -3 }) });

  // Assert
  expect(precio.status).toBe(400);
  expect(precio.body.error).toContain("El precio no puede ser negativo.");
  expect(stock.status).toBe(400);
  expect(stock.body.error).toContain("El stock no puede ser negativo.");
  expect(mockProductos.create).not.toHaveBeenCalled();
});
