// ============================================================================
// F-CAT-01 · Listar y filtrar el catálogo — Backend
// Grafo:   07_F-CAT-01_BACKEND_Listar_y_filtrar_el_catalogo.drawio
// Unidad:  ListProductsUseCase.execute() + PrismaProductRepository.findAll()
//          · GET /api/v1/products?category=&q=&tag=
// Métrica: N=20  A=24  P=5  →  V(G) = 24 − 20 + 2 = 6
// Cobertura de ruta básica: 6 caminos independientes → 6 casos de prueba
// Trazabilidad: RF08 · HU8 · ESC08 (CP-037–CP-040) · RF09 · HU9 · ESC09 (CP-041–CP-044) · BE-CAT-01
// ============================================================================
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  mockCartRepository,
  filaProductoPrisma,
  carrito,
} from "../_ayudas.js";

// El repositorio real llama a prisma directamente (nodo 9): se sustituye el cliente.
const findMany = vi.fn();
vi.mock("../../src/infrastructure/database/prisma-client.js", () => ({
  prisma: { product: { findMany: (...a: any[]) => findMany(...a) } },
}));

const { PrismaProductRepository } = await import(
  "../../src/infrastructure/database/repositories/prisma-product.repository.js"
);
const { ListProductsUseCase } = await import(
  "../../src/application/use-cases/catalog.use-cases.js"
);

/** Devuelve el objeto `where` con el que se consultó la base de datos (nodo 9). */
const whereUsado = () => findMany.mock.calls[0][0].where;

describe("F-CAT-01 · Listar y filtrar el catálogo", () => {
  let productos: InstanceType<typeof PrismaProductRepository>;
  let carritos: ReturnType<typeof mockCartRepository>;
  let caso: InstanceType<typeof ListProductsUseCase>;

  beforeEach(() => {
    findMany.mockReset();
    productos = new PrismaProductRepository();
    carritos = mockCartRepository();
    caso = new ListProductsUseCase(productos as any, carritos);
  });

  it("CP-F-CAT-01-01 · camino 1,2,3,4,5,6,7,8,9,10,11,F · Paso 3 = SI, Paso 5 = SI, Paso 7 = SI, Paso 10 = SI → los tres filtros juntos no arrojan resultados", async () => {
    findMany.mockResolvedValue([]);                                  // fuerza Paso 10 = SI

    const salida = await caso.execute(
      { categorySlug: "cementos", query: "gris", tag: "oferta" },     // fuerza Pasos 3, 5 y 7 = SI
      undefined
    );

    const where = whereUsado();
    expect(where.category).toEqual({ slug: "cementos" });             // nodo 4
    expect(where.OR).toEqual([                                        // nodo 6
      { name: { contains: "gris", mode: "insensitive" } },
      { description: { contains: "gris", mode: "insensitive" } },
    ]);
    expect(where.tags).toEqual({ some: { name: "oferta" } });         // nodo 8
    // Nodo 11: se responde con una lista vacía sin consultar las reservas.
    expect(salida).toEqual([]);
    expect(carritos.getReservedQuantities).not.toHaveBeenCalled();
    expect(carritos.findByUserId).not.toHaveBeenCalled();
  });

  it("CP-F-CAT-01-02 · camino 1,2,3,5,6,7,8,9,10,11,F · Paso 3 = NO, Paso 5 = SI, Paso 7 = SI, Paso 10 = SI → búsqueda por texto y etiqueta sin resultados", async () => {
    findMany.mockResolvedValue([]);                                  // fuerza Paso 10 = SI

    const salida = await caso.execute({ query: "estuco", tag: "oferta" }); // Paso 3 = NO

    const where = whereUsado();
    expect(where.category).toBeUndefined();                           // el nodo 4 no se ejecuta
    expect(where.OR).toHaveLength(2);                                 // nodo 6
    expect(where.tags).toEqual({ some: { name: "oferta" } });         // nodo 8
    expect(salida).toEqual([]);
    expect(carritos.getReservedQuantities).not.toHaveBeenCalled();
  });

  it("CP-F-CAT-01-03 · camino 1,2,3,5,7,8,9,10,11,F · Paso 3 = NO, Paso 5 = NO, Paso 7 = SI, Paso 10 = SI → solo la etiqueta filtra y no hay coincidencias", async () => {
    findMany.mockResolvedValue([]);                                  // fuerza Paso 10 = SI

    const salida = await caso.execute({ tag: "inexistente" });        // Pasos 3 y 5 = NO, Paso 7 = SI

    const where = whereUsado();
    expect(where.category).toBeUndefined();                           // el nodo 4 no se ejecuta
    expect(where.OR).toBeUndefined();                                 // el nodo 6 no se ejecuta
    expect(where.tags).toEqual({ some: { name: "inexistente" } });    // nodo 8
    expect(salida).toEqual([]);
  });

  it("CP-F-CAT-01-04 · camino 1,2,3,5,7,9,10,11,F · Paso 3 = NO, Paso 5 = NO, Paso 7 = NO, Paso 10 = SI → catálogo sin filtros y sin productos cargados", async () => {
    findMany.mockResolvedValue([]);                                  // fuerza Paso 10 = SI

    const salida = await caso.execute();                              // sin filtros: Pasos 3, 5 y 7 = NO

    // Nodo 2: el objeto de filtro queda vacío.
    expect(whereUsado()).toEqual({});
    expect(salida).toEqual([]);
    expect(carritos.getReservedQuantities).not.toHaveBeenCalled();
  });

  it("CP-F-CAT-01-05 · camino 1,2,3,5,7,9,10,12,13,15,17,19,F · Paso 10 = NO, Paso 12 = SI → con sesión iniciada su propio carrito no se descuenta", async () => {
    findMany.mockResolvedValue([
      filaProductoPrisma({ id: "prd_001", stockQuantity: 10 }),
      filaProductoPrisma({ id: "prd_002", stockQuantity: 4 }),
    ]);                                                               // fuerza Paso 10 = NO
    carritos.findByUserId.mockResolvedValue(carrito({ id: "cart_001" }));
    carritos.getReservedQuantities.mockResolvedValue({ prd_001: 3, prd_002: 0 });

    const salida = await caso.execute({}, "usr_001");                 // fuerza Paso 12 = SI

    // Nodo 13: se ubica el carrito del usuario y se excluye del cálculo.
    expect(carritos.findByUserId).toHaveBeenCalledWith("usr_001");
    expect(carritos.getReservedQuantities).toHaveBeenCalledWith("cart_001", ["prd_001", "prd_002"]);
    // Nodo 17: stockDinamico = max(0, stockFisico − reservado).
    expect(salida[0].stockQuantity).toBe(7);
    expect(salida[0].inStock).toBe(true);
    expect(salida[1].stockQuantity).toBe(4);
    // Nodo 19: la ficha conserva categoría y etiquetas del catálogo.
    expect(salida[0].categorySlug).toBe("pisos-ceramicas");
    expect(salida[0].tags).toEqual(["nuevo"]);
  });

  it("CP-F-CAT-01-06 · camino 1,2,3,5,7,9,10,12,14,16,18,F · Paso 10 = NO, Paso 12 = NO → visitante anónimo: se descuentan todas las reservas activas", async () => {
    findMany.mockResolvedValue([
      filaProductoPrisma({ id: "prd_001", stockQuantity: 10 }),
    ]);                                                               // fuerza Paso 10 = NO
    carritos.getReservedQuantities.mockResolvedValue({ prd_001: 4 });

    const salida = await caso.execute({});                            // sin userId: fuerza Paso 12 = NO

    // Nodo 14: excludeCartId = "" porque no hay carrito propio que preservar.
    expect(carritos.findByUserId).not.toHaveBeenCalled();
    expect(carritos.getReservedQuantities).toHaveBeenCalledWith("", ["prd_001"]);
    // Nodos 16 y 18: disponibilidad real entregada al visitante.
    expect(salida[0].stockQuantity).toBe(6);
    expect(salida[0].inStock).toBe(true);
  });

  it("CP-F-CAT-01-06b · valor límite sobre el camino anónimo: lo reservado supera las existencias", async () => {
    // Complementa el camino 6 en el nodo 16: Math.max(0, ...) nunca entrega stock negativo.
    findMany.mockResolvedValue([
      filaProductoPrisma({ id: "prd_001", stockQuantity: 2, inStock: true }),
    ]);
    carritos.getReservedQuantities.mockResolvedValue({ prd_001: 5 });

    const salida = await caso.execute({});

    expect(salida[0].stockQuantity).toBe(0);
    expect(salida[0].inStock).toBe(false);     // se marca agotado aunque en la BD figure disponible
  });

  it("CP-F-CAT-01-06c · valor límite: filtros presentes pero vacíos se tratan como ausentes", async () => {
    // Complementa los nodos 3, 5 y 7: la cadena vacía es falsy y no agrega condiciones.
    findMany.mockResolvedValue([]);

    await caso.execute({ categorySlug: "", query: "", tag: "" });

    expect(whereUsado()).toEqual({});
  });
});
