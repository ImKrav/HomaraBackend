// F-ADM-03 · Inventario y stock
// Unidad: AdminController.getInventoryReport()  (GET /api/v1/admin/inventory)

import { vi, beforeEach } from "vitest";
import { test, expect } from "./harness.js";
import { contextoExpress, filaProductoPrisma } from "./helpers.js";
import { mockPrisma, reiniciarRepositorios } from "./mocks/repositorios.js";
import { AdminController } from "../src/infrastructure/http/controllers/admin.controller.js";

// El controlador captura `prisma` al importarse: se mockea el módulo del
// cliente para que devuelva el doble compartido.
vi.mock("../src/infrastructure/database/prisma-client.js", async () => {
  const { mockPrisma } = await import("./mocks/repositorios.js");
  return { prisma: mockPrisma };
});

beforeEach(reiniciarRepositorios);


async function reporteCon(productos: any[]) {
  mockPrisma.product.findMany.mockResolvedValue(productos);
  const { req, res, next } = contextoExpress();
  await AdminController.getInventoryReport(req, res, next);
  return { cuerpo: res.body as any, next };
}

// Defecto abierto #11 (ver la tabla en tests/README.md): se espera que falle.
test.fails("CP-F-ADM-03-01", "Clasifica productos con existencias menores a cero como stock_negativo", async () => {
  // Arrange
  const filas = [filaProductoPrisma({ id: "prd_neg", stockQuantity: -5, price: 1000, inStock: false })];

  // Act
  const { cuerpo, next } = await reporteCon(filas);

  // Assert
  expect(next).not.toHaveBeenCalled();
  expect(cuerpo.success).toBe(true);
  expect(cuerpo.data.products[0].stockStatus).toBe("stock_negativo");
  expect(cuerpo.data.products[0].stockValue).toBe(-5000);
  expect(cuerpo.data.products[0].category).toBe("Pisos y Ceramicas");
  expect(cuerpo.data.stats).toMatchObject({
    totalProducts: 1,
    lowStockCount: 0,
    outOfStockCount: 0,
    negativeStockCount: 1,
  });
  // DEFECTO: totalUnits debería sumar solo existencias positivas (no restar stock negativo)
  expect(cuerpo.data.stats.totalUnits).toBe(0);
});

test("CP-F-ADM-03-02", "Clasifica productos con existencias en 0 como sin_stock", async () => {
  // Arrange
  const filas = [
    filaProductoPrisma({ id: "prd_cero", stockQuantity: 0, price: 38900, inStock: false }),
  ];

  // Act
  const { cuerpo } = await reporteCon(filas);

  // Assert
  expect(cuerpo.data.products[0].stockStatus).toBe("sin_stock");
  expect(cuerpo.data.products[0].stockValue).toBe(0);
  expect(cuerpo.data.stats.outOfStockCount).toBe(1);
  expect(cuerpo.data.stats.lowStockCount).toBe(0);
  expect(cuerpo.data.stats.negativeStockCount).toBe(0);
  expect(cuerpo.data.stats.totalUnits).toBe(0);
});

test("CP-F-ADM-03-03", "Marca 49 unidades como límite superior de alerta stock_bajo", async () => {
  // Arrange
  const filas = [
    filaProductoPrisma({ id: "prd_49", stockQuantity: 49, price: 2000, inStock: true }),
  ];

  // Act
  const { cuerpo } = await reporteCon(filas);

  // Assert
  expect(cuerpo.data.products[0].stockStatus).toBe("stock_bajo");
  expect(cuerpo.data.products[0].stockValue).toBe(98000);
  expect(cuerpo.data.products[0].stockQuantity).toBe(49);
  expect(cuerpo.data.stats.lowStockCount).toBe(1);
  expect(cuerpo.data.stats.outOfStockCount).toBe(0);
  expect(cuerpo.data.stats.negativeStockCount).toBe(0);
  expect(cuerpo.data.stats.totalUnits).toBe(49);
});

test("CP-F-ADM-03-04", "Marca 50 unidades como límite inferior de inventario normal", async () => {
  // Arrange
  const filas = [
    filaProductoPrisma({ id: "prd_50", stockQuantity: 50, price: 2000, inStock: true }),
  ];

  // Act
  const { cuerpo } = await reporteCon(filas);

  // Assert
  expect(cuerpo.data.products[0].stockStatus).toBe("normal");
  expect(cuerpo.data.products[0].stockValue).toBe(100000);
  expect(cuerpo.data.stats).toStrictEqual({
    totalProducts: 1,
    totalUnits: 50,
    lowStockCount: 0,
    outOfStockCount: 0,
    negativeStockCount: 0,
  });
});

// Defecto abierto #11 (ver la tabla en tests/README.md): se espera que falle.
test.fails("CP-F-ADM-03-05", "Procesa múltiples productos combinando estados en el reporte", async () => {
  // Arrange
  const filas = [
    filaProductoPrisma({ id: "prd_neg", name: "Arena", stockQuantity: -3, price: 5000, inStock: false }),
    filaProductoPrisma({ id: "prd_cero", name: "Grava", stockQuantity: 0, price: 4000, inStock: false }),
  ];

  // Act
  const { cuerpo } = await reporteCon(filas);

  // Assert
  expect(cuerpo.data.products.map((p: any) => p.id)).toStrictEqual(["prd_neg", "prd_cero"]);
  expect(cuerpo.data.products[0].stockStatus).toBe("stock_negativo");
  expect(cuerpo.data.products[1].stockStatus).toBe("sin_stock");
  expect(cuerpo.data.products[0].stockValue).toBe(-15000);
  expect(cuerpo.data.products[1].stockValue).toBe(0);
  expect(cuerpo.data.stats).toMatchObject({
    totalProducts: 2,
    lowStockCount: 0,
    outOfStockCount: 1,
    negativeStockCount: 1,
  });
  // DEFECTO: totalUnits no debería restar existencias negativas
  expect(cuerpo.data.stats.totalUnits).toBe(0);
});
