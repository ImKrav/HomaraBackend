import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  contextoExpress,
  mockPrismaAdmin,
  ordenEntregada,
  itemVendido,
  programarOrdenes,
} from "../_ayudas.js";

const prismaFalso = mockPrismaAdmin();
vi.mock("../../src/infrastructure/database/prisma-client.js", () => ({ prisma: prismaFalso }));

const { AdminController } = await import(
  "../../src/infrastructure/http/controllers/admin.controller.js"
);

const ANIO = new Date().getFullYear();
const cuerpoDe = (res: any) => res.body;

describe("F-ADM-01 · Tablero de indicadores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaFalso.order.count.mockResolvedValue(7);
    prismaFalso.product.count.mockResolvedValue(42);
    prismaFalso.user.count.mockResolvedValue(5);
    prismaFalso.orderItem.findMany.mockResolvedValue([]);
  });

  it("CP-F-ADM-01-01: Calcula variación de ventas respecto al mes anterior y categorías principales", async () => {
    programarOrdenes(prismaFalso, {
      actual: [ordenEntregada({ total: 150000 })],
      anterior: [ordenEntregada({ total: 100000 })],
      anio: [ordenEntregada({ total: 150000, createdAt: new Date(ANIO, 7, 10) })],
    });
    prismaFalso.orderItem.findMany.mockResolvedValue([itemVendido(150000, "Pisos y Ceramicas")]);

    const { req, res, next } = contextoExpress();
    await AdminController.getMetrics(req, res, next);

    const cuerpo = cuerpoDe(res);
    expect(next).not.toHaveBeenCalled();
    expect(cuerpo.success).toBe(true);
    expect(cuerpo.data[0].label).toBe("Ventas del Mes");
    expect(cuerpo.data[0].change).toBe(50);
    expect(cuerpo.data[0].value.replace(/\D/g, "")).toBe("150000");
    expect(cuerpo.data[1].value).toBe("7");
    expect(cuerpo.data[2].value).toBe("42");
    expect(cuerpo.data[3].value).toBe("5");
    expect(cuerpo.charts.salesByMonth).toHaveLength(12);
    expect(cuerpo.charts.salesByMonth[7]).toBe(150000);
    expect(cuerpo.charts.topCategories).toEqual([{ name: "Pisos y Ceramicas", pct: 100 }]);
  });

  it("CP-F-ADM-01-02: Evita división por cero y retorna variación 0 cuando no hay ventas el mes anterior", async () => {
    programarOrdenes(prismaFalso, {
      actual: [ordenEntregada({ total: 250000 })],
      anterior: [],
      anio: [ordenEntregada({ total: 250000, createdAt: new Date(ANIO, 7, 3) })],
    });
    prismaFalso.orderItem.findMany.mockResolvedValue([itemVendido(250000, "Cementos")]);

    const { req, res, next } = contextoExpress();
    await AdminController.getMetrics(req, res, next);

    const cuerpo = cuerpoDe(res);
    expect(cuerpo.data[0].change).toBe(0);
    expect(Number.isNaN(cuerpo.data[0].change)).toBe(false);
    expect(Number.isFinite(cuerpo.data[0].change)).toBe(true);
    expect(String(cuerpo.data[0].change)).not.toContain("Infinity");
    expect(cuerpo.data[0].value.replace(/\D/g, "")).toBe("250000");
    expect(cuerpo.charts.topCategories).toEqual([{ name: "Cementos", pct: 100 }]);
  });

  it("CP-F-ADM-01-03: Agrupa ventas del año por mes correspondiente", async () => {
    programarOrdenes(prismaFalso, {
      actual: [ordenEntregada({ total: 80000 })],
      anterior: [ordenEntregada({ total: 40000 })],
      anio: [
        ordenEntregada({ total: 300000, createdAt: new Date(ANIO, 0, 5) }),
        ordenEntregada({ total: 120000, createdAt: new Date(ANIO, 7, 20) }),
      ],
    });
    prismaFalso.orderItem.findMany.mockResolvedValue([itemVendido(420000, "Pinturas")]);

    const { req, res, next } = contextoExpress();
    await AdminController.getMetrics(req, res, next);

    const cuerpo = cuerpoDe(res);
    expect(cuerpo.data[0].change).toBe(100);
    expect(cuerpo.charts.salesByMonth[0]).toBe(300000);
    expect(cuerpo.charts.salesByMonth[7]).toBe(120000);
    expect(cuerpo.charts.salesByMonth.filter((v: number) => v === 0)).toHaveLength(10);
    expect(cuerpo.charts.salesByMonth.reduce((a: number, b: number) => a + b, 0)).toBe(420000);
  });

  it("CP-F-ADM-01-04: Acumula montos repetidos de la misma categoría", async () => {
    programarOrdenes(prismaFalso, {
      actual: [ordenEntregada({ total: 200000 })],
      anterior: [ordenEntregada({ total: 200000 })],
      anio: [ordenEntregada({ total: 200000, createdAt: new Date(ANIO, 7, 1) })],
    });
    prismaFalso.orderItem.findMany.mockResolvedValue([
      itemVendido(120000, "Pisos y Ceramicas"),
      itemVendido(80000, "Pisos y Ceramicas"),
    ]);

    const { req, res, next } = contextoExpress();
    await AdminController.getMetrics(req, res, next);

    const cuerpo = cuerpoDe(res);
    expect(cuerpo.data[0].change).toBe(0);
    expect(cuerpo.charts.topCategories).toHaveLength(1);
    expect(cuerpo.charts.topCategories[0]).toEqual({ name: "Pisos y Ceramicas", pct: 100 });
  });

  it("CP-F-ADM-01-05: Ordena categorías y limita el reporte a las 5 principales", async () => {
    programarOrdenes(prismaFalso, {
      actual: [ordenEntregada({ total: 100 })],
      anterior: [ordenEntregada({ total: 50 })],
      anio: [ordenEntregada({ total: 100, createdAt: new Date(ANIO, 7, 8) })],
    });
    prismaFalso.orderItem.findMany.mockResolvedValue([
      itemVendido(10, "Herrajes"),
      itemVendido(30, "Pisos y Ceramicas"),
      itemVendido(25, "Cementos"),
      itemVendido(20, "Pinturas"),
      itemVendido(3, "Herrajes"),
      itemVendido(7, "Griferias"),
      itemVendido(5, "Iluminacion"),
    ]);

    const { req, res, next } = contextoExpress();
    await AdminController.getMetrics(req, res, next);

    const cuerpo = cuerpoDe(res);
    expect(cuerpo.charts.topCategories).toHaveLength(5);
    expect(cuerpo.charts.topCategories).toEqual([
      { name: "Pisos y Ceramicas", pct: 30 },
      { name: "Cementos", pct: 25 },
      { name: "Pinturas", pct: 20 },
      { name: "Herrajes", pct: 13 },
      { name: "Griferias", pct: 7 },
    ]);
    expect(cuerpo.charts.topCategories.map((c: any) => c.name)).not.toContain("Iluminacion");
  });

  it("CP-F-ADM-01-06: Asigna 0% a categorías cuando las ventas totales por categoría son 0", async () => {
    programarOrdenes(prismaFalso, {
      actual: [ordenEntregada({ total: 90000 })],
      anterior: [ordenEntregada({ total: 60000 })],
      anio: [ordenEntregada({ total: 90000, createdAt: new Date(ANIO, 7, 12) })],
    });
    prismaFalso.orderItem.findMany.mockResolvedValue([
      itemVendido(0, "Pisos y Ceramicas"),
      itemVendido(0, "Pisos y Ceramicas"),
    ]);

    const { req, res, next } = contextoExpress();
    await AdminController.getMetrics(req, res, next);

    const cuerpo = cuerpoDe(res);
    expect(cuerpo.charts.topCategories).toEqual([{ name: "Pisos y Ceramicas", pct: 0 }]);
    expect(Number.isNaN(cuerpo.charts.topCategories[0].pct)).toBe(false);
    expect(cuerpo.data[0].change).toBe(50);
  });
});
