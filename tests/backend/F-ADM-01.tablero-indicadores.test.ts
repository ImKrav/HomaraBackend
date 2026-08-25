// ============================================================================
// F-ADM-01 · Tablero de indicadores — Backend
// Grafo:   25_F-ADM-01_BACKEND_Tablero_de_indicadores.drawio
// Unidad:  AdminController.getMetrics()  ·  GET /api/v1/admin/metrics
// Métrica: N=27  A=31  P=5  →  V(G) = 31 − 27 + 2 = 6
// Cobertura de ruta básica: 6 caminos independientes → 6 casos de prueba
// Trazabilidad: RF31 · HU37 · HU38 · ESC31 · CP-143 · CP-144
// ============================================================================
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  contextoExpress,
  mockPrismaAdmin,
  ordenEntregada,
  itemVendido,
  programarOrdenes,
} from "../_ayudas.js";

// El controlador importa el cliente `prisma` al cargar el módulo: se sustituye.
const prismaFalso = mockPrismaAdmin();
vi.mock("../../src/infrastructure/database/prisma-client.js", () => ({ prisma: prismaFalso }));

const { AdminController } = await import(
  "../../src/infrastructure/http/controllers/admin.controller.js"
);

const ANIO = new Date().getFullYear();
/** Devuelve el cuerpo que el controlador entregó por res.json(). */
const cuerpoDe = (res: any) => res.body;

describe("F-ADM-01 · Tablero de indicadores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Nodos 5 y 6: conteos fijos, no participan en ninguna decisión del grafo.
    prismaFalso.order.count.mockResolvedValue(7);
    prismaFalso.product.count.mockResolvedValue(42);
    prismaFalso.user.count.mockResolvedValue(5);
    prismaFalso.orderItem.findMany.mockResolvedValue([]);
  });

  it("CP-F-ADM-01-01 · camino 1,2,3,4,5,6,7,8,10,11,12,13,14,15,16,17,18,19,20,21,23,25,F · Paso 7 = SI, Paso 13 = NO, Paso 16 = NO, Paso 19 = NO, Paso 20 = SI → el tablero muestra la variación de ventas y una categoría", async () => {
    // Nodos 3 y 4: 150.000 este mes contra 100.000 el mes pasado.
    programarOrdenes(prismaFalso, {
      actual: [ordenEntregada({ total: 150000 })],
      anterior: [ordenEntregada({ total: 100000 })],
      anio: [ordenEntregada({ total: 150000, createdAt: new Date(ANIO, 7, 10) })], // Paso 13 = NO: una sola orden
    });
    // Nodo 14: un solo item, de una categoría todavía no contada (Paso 16 = NO, Paso 19 = NO).
    prismaFalso.orderItem.findMany.mockResolvedValue([itemVendido(150000, "Pisos y Ceramicas")]);

    const { req, res, next } = contextoExpress();
    await AdminController.getMetrics(req, res, next);

    const cuerpo = cuerpoDe(res);
    expect(next).not.toHaveBeenCalled();
    expect(cuerpo.success).toBe(true);
    // Nodo 8: ((150000 − 100000) / 100000) × 100 = 50 %.
    expect(cuerpo.data[0].label).toBe("Ventas del Mes");
    expect(cuerpo.data[0].change).toBe(50);
    expect(cuerpo.data[0].value.replace(/\D/g, "")).toBe("150000");
    // Nodos 5 y 6: las otras tres tarjetas de KPI.
    expect(cuerpo.data[1].value).toBe("7");
    expect(cuerpo.data[2].value).toBe("42");
    expect(cuerpo.data[3].value).toBe("5");
    // Nodo 12: la venta se acumuló en el mes que le corresponde (agosto = índice 7).
    expect(cuerpo.charts.salesByMonth).toHaveLength(12);
    expect(cuerpo.charts.salesByMonth[7]).toBe(150000);
    // Nodos 21 y 23: la única categoría concentra el 100 %.
    expect(cuerpo.charts.topCategories).toEqual([{ name: "Pisos y Ceramicas", pct: 100 }]);
  });

  it("CP-F-ADM-01-02 · camino 1,2,3,4,5,6,7,9,10,11,12,13,14,15,16,17,18,19,20,21,23,25,F · Paso 7 = NO → sin ventas el mes pasado la variación queda en 0 y no hay división por cero", async () => {
    // Nodo 4: el mes anterior no tuvo ninguna orden ENTREGADO → lastMonthSales = 0 (Paso 7 = NO).
    programarOrdenes(prismaFalso, {
      actual: [ordenEntregada({ total: 250000 })],
      anterior: [],
      anio: [ordenEntregada({ total: 250000, createdAt: new Date(ANIO, 7, 3) })],
    });
    prismaFalso.orderItem.findMany.mockResolvedValue([itemVendido(250000, "Cementos")]);

    const { req, res, next } = contextoExpress();
    await AdminController.getMetrics(req, res, next);

    const cuerpo = cuerpoDe(res);
    // Nodo 9: la variación es exactamente 0, no NaN ni Infinity.
    expect(cuerpo.data[0].change).toBe(0);
    expect(Number.isNaN(cuerpo.data[0].change)).toBe(false);
    expect(Number.isFinite(cuerpo.data[0].change)).toBe(true);
    expect(String(cuerpo.data[0].change)).not.toContain("Infinity");
    // Las ventas del mes sí se muestran, aunque no haya con qué compararlas.
    expect(cuerpo.data[0].value.replace(/\D/g, "")).toBe("250000");
    expect(cuerpo.charts.topCategories).toEqual([{ name: "Cementos", pct: 100 }]);
  });

  it("CP-F-ADM-01-03 · camino 1,2,3,4,5,6,7,8,10,11,12,13,11,12,13,14,...,25,F · Paso 13 = SI y luego NO → dos órdenes del año se acumulan en sus meses", async () => {
    programarOrdenes(prismaFalso, {
      actual: [ordenEntregada({ total: 80000 })],
      anterior: [ordenEntregada({ total: 40000 })],
      // Nodo 13 = SI en la primera vuelta y NO en la segunda: dos órdenes de meses distintos.
      anio: [
        ordenEntregada({ total: 300000, createdAt: new Date(ANIO, 0, 5) }),
        ordenEntregada({ total: 120000, createdAt: new Date(ANIO, 7, 20) }),
      ],
    });
    prismaFalso.orderItem.findMany.mockResolvedValue([itemVendido(420000, "Pinturas")]);

    const { req, res, next } = contextoExpress();
    await AdminController.getMetrics(req, res, next);

    const cuerpo = cuerpoDe(res);
    // Nodo 8: ((80000 − 40000) / 40000) × 100 = 100 %.
    expect(cuerpo.data[0].change).toBe(100);
    // Nodo 12 ejecutado dos veces: cada total cayó en su propio mes.
    expect(cuerpo.charts.salesByMonth[0]).toBe(300000);
    expect(cuerpo.charts.salesByMonth[7]).toBe(120000);
    // Los meses sin ventas quedan en 0, no en undefined.
    expect(cuerpo.charts.salesByMonth.filter((v: number) => v === 0)).toHaveLength(10);
    expect(cuerpo.charts.salesByMonth.reduce((a: number, b: number) => a + b, 0)).toBe(420000);
  });

  it("CP-F-ADM-01-04 · camino 1,2,3,4,5,6,7,8,10,11,12,13,14,15,16,18,19,20,21,23,25,F · Paso 16 = SI → la categoría ya contada acumula sin reiniciarse", async () => {
    programarOrdenes(prismaFalso, {
      actual: [ordenEntregada({ total: 200000 })],
      anterior: [ordenEntregada({ total: 200000 })],
      anio: [ordenEntregada({ total: 200000, createdAt: new Date(ANIO, 7, 1) })],
    });
    // Nodo 16 = SI en el segundo item: la categoría ya estaba inicializada por el primero.
    prismaFalso.orderItem.findMany.mockResolvedValue([
      itemVendido(120000, "Pisos y Ceramicas"),
      itemVendido(80000, "Pisos y Ceramicas"),
    ]);

    const { req, res, next } = contextoExpress();
    await AdminController.getMetrics(req, res, next);

    const cuerpo = cuerpoDe(res);
    // Nodo 8: ventas iguales mes a mes → 0 % de variación (distinto del caso sin base de comparación).
    expect(cuerpo.data[0].change).toBe(0);
    // Nodo 18: 120.000 + 80.000 sobre un total de 200.000 → una sola categoría al 100 %.
    expect(cuerpo.charts.topCategories).toHaveLength(1);
    expect(cuerpo.charts.topCategories[0]).toEqual({ name: "Pisos y Ceramicas", pct: 100 });
  });

  it("CP-F-ADM-01-05 · camino 1,2,3,4,5,6,7,8,10,...,15,16,18,19,15,16,17,18,19,20,21,23,25,F · Paso 19 = SI → varias categorías se ordenan y se recortan a cinco", async () => {
    programarOrdenes(prismaFalso, {
      actual: [ordenEntregada({ total: 100 })],
      anterior: [ordenEntregada({ total: 50 })],
      anio: [ordenEntregada({ total: 100, createdAt: new Date(ANIO, 7, 8) })],
    });
    // Siete items: "Herrajes" se repite (Paso 16 = SI) y el resto estrena categoría (Paso 16 = NO).
    // El total suma 100, así que cada monto equivale directamente a su porcentaje.
    prismaFalso.orderItem.findMany.mockResolvedValue([
      itemVendido(10, "Herrajes"),
      itemVendido(30, "Pisos y Ceramicas"),
      itemVendido(25, "Cementos"),
      itemVendido(20, "Pinturas"),
      itemVendido(3, "Herrajes"), // Paso 16 = SI
      itemVendido(7, "Griferias"),
      itemVendido(5, "Iluminacion"), // Paso 19 = NO en la última vuelta
    ]);

    const { req, res, next } = contextoExpress();
    await AdminController.getMetrics(req, res, next);

    const cuerpo = cuerpoDe(res);
    // Nodo 23: seis categorías detectadas, pero solo se publican las cinco primeras.
    expect(cuerpo.charts.topCategories).toHaveLength(5);
    expect(cuerpo.charts.topCategories).toEqual([
      { name: "Pisos y Ceramicas", pct: 30 },
      { name: "Cementos", pct: 25 },
      { name: "Pinturas", pct: 20 },
      { name: "Herrajes", pct: 13 }, // 10 + 3 acumulados en el nodo 18
      { name: "Griferias", pct: 7 },
    ]);
    // "Iluminacion" (5 %) queda fuera del recorte de cinco.
    expect(cuerpo.charts.topCategories.map((c: any) => c.name)).not.toContain("Iluminacion");
  });

  it("CP-F-ADM-01-06 · camino 1,2,3,4,5,6,7,8,10,...,15,16,18,19,20,22,24,26,F · Paso 20 = NO → sin ventas por categoría todos los porcentajes quedan en 0", async () => {
    programarOrdenes(prismaFalso, {
      actual: [ordenEntregada({ total: 90000 })],
      anterior: [ordenEntregada({ total: 60000 })],
      anio: [ordenEntregada({ total: 90000, createdAt: new Date(ANIO, 7, 12) })],
    });
    // Nodo 19/20: hay items, pero todos con total 0 → totalCategorySales = 0 (Paso 20 = NO).
    prismaFalso.orderItem.findMany.mockResolvedValue([
      itemVendido(0, "Pisos y Ceramicas"),
      itemVendido(0, "Pisos y Ceramicas"),
    ]);

    const { req, res, next } = contextoExpress();
    await AdminController.getMetrics(req, res, next);

    const cuerpo = cuerpoDe(res);
    // Nodo 22: la rama que evita dividir por cero asigna 0 % a todas las categorías.
    expect(cuerpo.charts.topCategories).toEqual([{ name: "Pisos y Ceramicas", pct: 0 }]);
    expect(Number.isNaN(cuerpo.charts.topCategories[0].pct)).toBe(false);
    // Las tarjetas de KPI siguen siendo correctas aunque las gráficas queden en cero.
    expect(cuerpo.data[0].change).toBe(50);

    // OBSERVACIÓN (sin aserción, el defecto hoy no es observable): el nodo 16 se implementa
    // como `if (!categorySales[catName])`, una comprobación de valor falso y no de clave
    // ausente. Cuando el acumulado de una categoría vale 0, la condición vuelve a dar SI en
    // cada item y la categoría se reinicializa una y otra vez. Reasignar 0 sobre 0 es inocuo,
    // así que la respuesta es la misma y no hay nada que afirmar en contra; queda registrado
    // como riesgo latente: sería un defecto real si algún item.total pudiera ser negativo
    // (por ejemplo, una nota crédito o una devolución), porque el acumulado se perdería.
  });
});
