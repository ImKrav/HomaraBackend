// ============================================================================
// F-ADM-03 · Inventario y stock — Backend
// Grafo:   29_F-ADM-03_BACKEND_Inventario_y_stock.drawio
// Unidad:  AdminController.getInventoryReport()  ·  GET /api/v1/admin/inventory
// Métrica: N=27  A=30  P=4  →  V(G) = 30 − 27 + 2 = 5
// Cobertura de ruta básica: 5 caminos independientes → 5 casos de prueba
// Trazabilidad: RF33 · HU40 · ESC33
// ============================================================================
import { describe, it, expect, beforeEach, vi } from "vitest";
import { contextoExpress, mockPrismaAdmin, filaProductoPrisma } from "../_ayudas.js";

// El controlador importa el cliente `prisma` al cargar el módulo: se sustituye.
const prismaFalso = mockPrismaAdmin();
vi.mock("../../src/infrastructure/database/prisma-client.js", () => ({ prisma: prismaFalso }));

const { AdminController } = await import(
  "../../src/infrastructure/http/controllers/admin.controller.js"
);

/** Ejecuta el reporte con el listado que devolvería el nodo 2 y entrega el cuerpo de la respuesta. */
async function reporteCon(productos: any[]) {
  prismaFalso.product.findMany.mockResolvedValue(productos);
  const { req, res, next } = contextoExpress();
  await AdminController.getInventoryReport(req, res, next);
  return { cuerpo: res.body as any, next };
}

describe("F-ADM-03 · Inventario y stock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("CP-F-ADM-03-01 · camino 1,2,3,4,5,6,7,8,9,13,17,21,F · Paso 8 = SI, Paso 17 = NO → el producto con existencias negativas se marca como stock_negativo", async () => {
    // Nodo 8 = SI: el único producto quedó en −5 unidades.
    const { cuerpo, next } = await reporteCon([
      filaProductoPrisma({ id: "prd_neg", stockQuantity: -5, price: 1000, inStock: false }),
    ]);

    expect(next).not.toHaveBeenCalled();
    expect(cuerpo.success).toBe(true);
    // Nodo 9: categoría propia para el inventario negativo.
    expect(cuerpo.data.products[0].stockStatus).toBe("stock_negativo");
    // Nodo 13: el valor del inventario también sale negativo (1000 × −5).
    expect(cuerpo.data.products[0].stockValue).toBe(-5000);
    expect(cuerpo.data.products[0].category).toBe("Pisos y Ceramicas");
    // Nodos 3, 4 y 5: solo cuenta como negativo, no como bajo ni como agotado.
    expect(cuerpo.data.stats).toMatchObject({
      totalProducts: 1,
      lowStockCount: 0,
      outOfStockCount: 0,
      negativeStockCount: 1,
    });

    // DEFECTO: el nodo 6 resta las existencias negativas de totalUnits.
    // El total de unidades en bodega debe sumar únicamente las existencias positivas: no
    // hay −5 unidades físicas en el almacén, hay 0. El descuadre ya queda registrado en
    // negativeStockCount, así que restarlo del total lo contabiliza dos veces y subestima
    // el inventario disponible en los tableros de reabastecimiento (RF33, criterio 2).
    expect(cuerpo.data.stats.totalUnits).toBe(0);
  });

  it("CP-F-ADM-03-02 · camino 1,2,3,4,5,6,7,8,10,11,16,20,24,F · Paso 8 = NO, Paso 10 = SI → el producto agotado se marca como sin_stock", async () => {
    // Nodo 10 = SI: existencias exactamente en 0.
    const { cuerpo } = await reporteCon([
      filaProductoPrisma({ id: "prd_cero", stockQuantity: 0, price: 38900, inStock: false }),
    ]);

    // Nodo 11: agotado, no "stock bajo": el límite inferior del stock bajo es exclusivo.
    expect(cuerpo.data.products[0].stockStatus).toBe("sin_stock");
    // Nodo 16: 38.900 × 0 = 0.
    expect(cuerpo.data.products[0].stockValue).toBe(0);
    expect(cuerpo.data.stats.outOfStockCount).toBe(1);
    expect(cuerpo.data.stats.lowStockCount).toBe(0);
    expect(cuerpo.data.stats.negativeStockCount).toBe(0);
    expect(cuerpo.data.stats.totalUnits).toBe(0);
  });

  it("CP-F-ADM-03-03 · camino 1,2,3,4,5,6,7,8,10,12,14,18,22,25,F · Paso 8 = NO, Paso 10 = NO, Paso 12 = SI → 49 unidades es el último valor de stock_bajo", async () => {
    // Nodo 12 = SI: 49 es el valor límite superior de la alerta de existencias bajas.
    const { cuerpo } = await reporteCon([
      filaProductoPrisma({ id: "prd_49", stockQuantity: 49, price: 2000, inStock: true }),
    ]);

    // Nodo 14: se marca como stock bajo.
    expect(cuerpo.data.products[0].stockStatus).toBe("stock_bajo");
    // Nodo 18: 2000 × 49.
    expect(cuerpo.data.products[0].stockValue).toBe(98000);
    expect(cuerpo.data.products[0].stockQuantity).toBe(49);
    // Nodo 3: el filtro 0 < stock < 50 lo cuenta como alerta de reabastecimiento.
    expect(cuerpo.data.stats.lowStockCount).toBe(1);
    expect(cuerpo.data.stats.outOfStockCount).toBe(0);
    expect(cuerpo.data.stats.negativeStockCount).toBe(0);
    expect(cuerpo.data.stats.totalUnits).toBe(49);
  });

  it("CP-F-ADM-03-04 · camino 1,2,3,4,5,6,7,8,10,12,15,19,23,26,F · Paso 8 = NO, Paso 10 = NO, Paso 12 = NO → 50 unidades ya es inventario normal", async () => {
    // Nodo 12 = NO: 50 es el primer valor que deja de considerarse existencia baja.
    const { cuerpo } = await reporteCon([
      filaProductoPrisma({ id: "prd_50", stockQuantity: 50, price: 2000, inStock: true }),
    ]);

    // Nodo 15: el umbral de 50 es excluyente, así que el producto se reporta como normal.
    expect(cuerpo.data.products[0].stockStatus).toBe("normal");
    // Nodo 19: 2000 × 50.
    expect(cuerpo.data.products[0].stockValue).toBe(100000);
    // Ninguna de las tres alertas se dispara en el límite.
    expect(cuerpo.data.stats).toEqual({
      totalProducts: 1,
      totalUnits: 50,
      lowStockCount: 0,
      outOfStockCount: 0,
      negativeStockCount: 0,
    });
  });

  it("CP-F-ADM-03-05 · camino 1,2,3,4,5,6,7,8,9,13,17,7,8,10,11,16,20,24,F · Paso 17 = SI → el reporte clasifica varios productos en una sola pasada", async () => {
    // Nodo 17 = SI: tras el producto negativo queda otro por clasificar (Paso 8 = NO, Paso 10 = SI).
    const { cuerpo } = await reporteCon([
      filaProductoPrisma({ id: "prd_neg", name: "Arena", stockQuantity: -3, price: 5000, inStock: false }),
      filaProductoPrisma({ id: "prd_cero", name: "Grava", stockQuantity: 0, price: 4000, inStock: false }),
    ]);

    // Nodo 2: el listado conserva el orden ascendente por existencias que impone la consulta.
    expect(cuerpo.data.products.map((p: any) => p.id)).toEqual(["prd_neg", "prd_cero"]);
    expect(cuerpo.data.products[0].stockStatus).toBe("stock_negativo");
    expect(cuerpo.data.products[1].stockStatus).toBe("sin_stock");
    // Nodos 13 y 16: cada fila calcula su propio valor de inventario.
    expect(cuerpo.data.products[0].stockValue).toBe(-15000);
    expect(cuerpo.data.products[1].stockValue).toBe(0);
    // Nodo 24: los conteos de alerta suman las dos clasificaciones.
    expect(cuerpo.data.stats).toMatchObject({
      totalProducts: 2,
      lowStockCount: 0,
      outOfStockCount: 1,
      negativeStockCount: 1,
    });

    // DEFECTO: el descuadre negativo no se aisla, se descuenta del total del reporte.
    // Con un producto en -3 y otro en 0, las unidades realmente disponibles en bodega
    // son 0. El total debe sumar solo las existencias positivas y dejar el faltante
    // reflejado unicamente en negativeStockCount.
    expect(cuerpo.data.stats.totalUnits).toBe(0);
  });
});
