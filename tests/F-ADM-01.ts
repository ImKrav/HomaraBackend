// F-ADM-01 · Tablero de indicadores
// Unidad: AdminController.getMetrics()  (GET /api/v1/admin/metrics)

import { vi, beforeEach } from "vitest";
import { test, expect } from "./harness.js";
import { contextoExpress, ordenEntregada, itemVendido, programarOrdenes } from "./helpers.js";
import { mockPrisma, reiniciarRepositorios } from "./mocks/repositorios.js";
import { AdminController } from "../src/infrastructure/http/controllers/admin.controller.js";

// El controlador captura `prisma` al importarse: se mockea el módulo del
// cliente para que devuelva el doble compartido.
vi.mock("../src/infrastructure/database/prisma-client.js", async () => {
  const { mockPrisma } = await import("./mocks/repositorios.js");
  return { prisma: mockPrisma };
});

beforeEach(reiniciarRepositorios);


const ANIO = new Date().getFullYear();

/** Programa los contadores por defecto del cliente Prisma mockeado. */
function montar() {
  mockPrisma.order.count.mockResolvedValue(7);
  mockPrisma.product.count.mockResolvedValue(42);
  mockPrisma.user.count.mockResolvedValue(5);
  mockPrisma.orderItem.findMany.mockResolvedValue([]);
  return mockPrisma;
}

test("CP-F-ADM-01-01", "Calcula variación de ventas respecto al mes anterior y categorías principales", async () => {
  // Arrange
  const p = montar();
  programarOrdenes(p, {
    actual: [ordenEntregada({ total: 150000 })],
    anterior: [ordenEntregada({ total: 100000 })],
    anio: [ordenEntregada({ total: 150000, createdAt: new Date(ANIO, 7, 10) })],
  });
  p.orderItem.findMany.mockResolvedValue([itemVendido(150000, "Pisos y Ceramicas")]);
  const { req, res, next } = contextoExpress();

  // Act
  await AdminController.getMetrics(req, res, next);

  // Assert
  const cuerpo = res.body;
  expect(next).not.toHaveBeenCalled();
  expect(cuerpo.success).toBe(true);
  expect(cuerpo.data[0].label).toBe("Ventas del Mes");
  expect(cuerpo.data[0].change).toBe(50);
  expect(cuerpo.data[0].value.replace(/\D/g, "")).toBe("150000");
  expect(cuerpo.data[1].value).toBe("7");
  expect(cuerpo.data[2].value).toBe("42");
  expect(cuerpo.data[3].value).toBe("5");
  expect(cuerpo.charts.salesByMonth.length).toBe(12);
  expect(cuerpo.charts.salesByMonth[7]).toBe(150000);
  expect(cuerpo.charts.topCategories).toStrictEqual([{ name: "Pisos y Ceramicas", pct: 100 }]);
});

test("CP-F-ADM-01-02", "Evita división por cero y retorna variación 0 cuando no hay ventas el mes anterior", async () => {
  // Arrange
  const p = montar();
  programarOrdenes(p, {
    actual: [ordenEntregada({ total: 250000 })],
    anterior: [],
    anio: [ordenEntregada({ total: 250000, createdAt: new Date(ANIO, 7, 3) })],
  });
  p.orderItem.findMany.mockResolvedValue([itemVendido(250000, "Cementos")]);
  const { req, res, next } = contextoExpress();

  // Act
  await AdminController.getMetrics(req, res, next);

  // Assert
  const cuerpo = res.body;
  expect(cuerpo.data[0].change).toBe(0);
  expect(Number.isNaN(cuerpo.data[0].change)).toBe(false);
  expect(Number.isFinite(cuerpo.data[0].change)).toBe(true);
  expect(String(cuerpo.data[0].change).includes("Infinity")).toBe(false);
  expect(cuerpo.data[0].value.replace(/\D/g, "")).toBe("250000");
  expect(cuerpo.charts.topCategories).toStrictEqual([{ name: "Cementos", pct: 100 }]);
});

test("CP-F-ADM-01-03", "Agrupa ventas del año por mes correspondiente", async () => {
  // Arrange
  const p = montar();
  programarOrdenes(p, {
    actual: [ordenEntregada({ total: 80000 })],
    anterior: [ordenEntregada({ total: 40000 })],
    anio: [
      ordenEntregada({ total: 300000, createdAt: new Date(ANIO, 0, 5) }),
      ordenEntregada({ total: 120000, createdAt: new Date(ANIO, 7, 20) }),
    ],
  });
  p.orderItem.findMany.mockResolvedValue([itemVendido(420000, "Pinturas")]);
  const { req, res, next } = contextoExpress();

  // Act
  await AdminController.getMetrics(req, res, next);

  // Assert
  const cuerpo = res.body;
  expect(cuerpo.data[0].change).toBe(100);
  expect(cuerpo.charts.salesByMonth[0]).toBe(300000);
  expect(cuerpo.charts.salesByMonth[7]).toBe(120000);
  expect(cuerpo.charts.salesByMonth.filter((v: number) => v === 0).length).toBe(10);
  expect(cuerpo.charts.salesByMonth.reduce((a: number, b: number) => a + b, 0)).toBe(420000);
});

test("CP-F-ADM-01-04", "Acumula montos repetidos de la misma categoría", async () => {
  // Arrange
  const p = montar();
  programarOrdenes(p, {
    actual: [ordenEntregada({ total: 200000 })],
    anterior: [ordenEntregada({ total: 200000 })],
    anio: [ordenEntregada({ total: 200000, createdAt: new Date(ANIO, 7, 1) })],
  });
  p.orderItem.findMany.mockResolvedValue([
    itemVendido(120000, "Pisos y Ceramicas"),
    itemVendido(80000, "Pisos y Ceramicas"),
  ]);
  const { req, res, next } = contextoExpress();

  // Act
  await AdminController.getMetrics(req, res, next);

  // Assert
  const cuerpo = res.body;
  expect(cuerpo.data[0].change).toBe(0);
  expect(cuerpo.charts.topCategories.length).toBe(1);
  expect(cuerpo.charts.topCategories[0]).toStrictEqual({ name: "Pisos y Ceramicas", pct: 100 });
});

test("CP-F-ADM-01-05", "Ordena categorías y limita el reporte a las 5 principales", async () => {
  // Arrange
  const p = montar();
  programarOrdenes(p, {
    actual: [ordenEntregada({ total: 100 })],
    anterior: [ordenEntregada({ total: 50 })],
    anio: [ordenEntregada({ total: 100, createdAt: new Date(ANIO, 7, 8) })],
  });
  p.orderItem.findMany.mockResolvedValue([
    itemVendido(10, "Herrajes"),
    itemVendido(30, "Pisos y Ceramicas"),
    itemVendido(25, "Cementos"),
    itemVendido(20, "Pinturas"),
    itemVendido(3, "Herrajes"),
    itemVendido(7, "Griferias"),
    itemVendido(5, "Iluminacion"),
  ]);
  const { req, res, next } = contextoExpress();

  // Act
  await AdminController.getMetrics(req, res, next);

  // Assert
  const cuerpo = res.body;
  expect(cuerpo.charts.topCategories.length).toBe(5);
  expect(cuerpo.charts.topCategories).toStrictEqual([
    { name: "Pisos y Ceramicas", pct: 30 },
    { name: "Cementos", pct: 25 },
    { name: "Pinturas", pct: 20 },
    { name: "Herrajes", pct: 13 },
    { name: "Griferias", pct: 7 },
  ]);
  expect(cuerpo.charts.topCategories.map((c: any) => c.name).includes("Iluminacion")).toBe(false);
});

test("CP-F-ADM-01-06", "Asigna 0% a categorías cuando las ventas totales por categoría son 0", async () => {
  // Arrange
  const p = montar();
  programarOrdenes(p, {
    actual: [ordenEntregada({ total: 90000 })],
    anterior: [ordenEntregada({ total: 60000 })],
    anio: [ordenEntregada({ total: 90000, createdAt: new Date(ANIO, 7, 12) })],
  });
  p.orderItem.findMany.mockResolvedValue([
    itemVendido(0, "Pisos y Ceramicas"),
    itemVendido(0, "Pisos y Ceramicas"),
  ]);
  const { req, res, next } = contextoExpress();

  // Act
  await AdminController.getMetrics(req, res, next);

  // Assert
  const cuerpo = res.body;
  expect(cuerpo.charts.topCategories).toStrictEqual([{ name: "Pisos y Ceramicas", pct: 0 }]);
  expect(Number.isNaN(cuerpo.charts.topCategories[0].pct)).toBe(false);
  expect(cuerpo.data[0].change).toBe(50);
});
