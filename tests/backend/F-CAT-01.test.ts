import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockCartRepository, filaProductoPrisma, carrito } from "../test-helpers.js";

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

  it("CP-F-CAT-01-01: Filtra por categoría, término de búsqueda y etiqueta simultáneamente", async () => {
    findMany.mockResolvedValue([]);

    const salida = await caso.execute(
      { categorySlug: "cementos", query: "gris", tag: "oferta" },
      undefined
    );

    const where = whereUsado();
    expect(where.category).toEqual({ slug: "cementos" });
    expect(where.OR).toEqual([
      { name: { contains: "gris", mode: "insensitive" } },
      { description: { contains: "gris", mode: "insensitive" } },
    ]);
    expect(where.tags).toEqual({ some: { name: "oferta" } });
    expect(salida).toEqual([]);
    expect(carritos.getReservedQuantities).not.toHaveBeenCalled();
    expect(carritos.findByUserId).not.toHaveBeenCalled();
  });

  it("CP-F-CAT-01-02: Filtra por texto y etiqueta sin categoría", async () => {
    findMany.mockResolvedValue([]);

    const salida = await caso.execute({ query: "estuco", tag: "oferta" });

    const where = whereUsado();
    expect(where.category).toBeUndefined();
    expect(where.OR).toHaveLength(2);
    expect(where.tags).toEqual({ some: { name: "oferta" } });
    expect(salida).toEqual([]);
    expect(carritos.getReservedQuantities).not.toHaveBeenCalled();
  });

  it("CP-F-CAT-01-03: Filtra únicamente por etiqueta", async () => {
    findMany.mockResolvedValue([]);

    const salida = await caso.execute({ tag: "inexistente" });

    const where = whereUsado();
    expect(where.category).toBeUndefined();
    expect(where.OR).toBeUndefined();
    expect(where.tags).toEqual({ some: { name: "inexistente" } });
    expect(salida).toEqual([]);
  });

  it("CP-F-CAT-01-04: Lista catálogo sin filtros aplicados", async () => {
    findMany.mockResolvedValue([]);

    const salida = await caso.execute();

    expect(whereUsado()).toEqual({});
    expect(salida).toEqual([]);
    expect(carritos.getReservedQuantities).not.toHaveBeenCalled();
  });

  it("CP-F-CAT-01-05: Excluye reservas del propio carrito para usuario autenticado", async () => {
    findMany.mockResolvedValue([
      filaProductoPrisma({ id: "prd_001", stockQuantity: 10 }),
      filaProductoPrisma({ id: "prd_002", stockQuantity: 5 }),
    ]);
    carritos.findByUserId.mockResolvedValue(carrito({ id: "cart_001" }));
    carritos.getReservedQuantities.mockResolvedValue({ prd_001: 3, prd_002: 5 });

    const salida = await caso.execute(undefined, "usr_001");

    expect(carritos.findByUserId).toHaveBeenCalledWith("usr_001");
    expect(carritos.getReservedQuantities).toHaveBeenCalledWith("cart_001", ["prd_001", "prd_002"]);
    expect(salida).toHaveLength(2);
    expect(salida[0].stockQuantity).toBe(7);
    expect(salida[0].inStock).toBe(true);
    expect(salida[1].stockQuantity).toBe(0);
    expect(salida[1].inStock).toBe(false);
  });

  it("CP-F-CAT-01-06: Descuenta todas las reservas activas para visitante anónimo", async () => {
    findMany.mockResolvedValue([filaProductoPrisma({ id: "prd_001", stockQuantity: 10 })]);
    carritos.getReservedQuantities.mockResolvedValue({ prd_001: 4 });

    const salida = await caso.execute();

    expect(carritos.findByUserId).not.toHaveBeenCalled();
    expect(carritos.getReservedQuantities).toHaveBeenCalledWith("", ["prd_001"]);
    expect(salida[0].stockQuantity).toBe(6);
    expect(salida[0].inStock).toBe(true);
  });

  it("CP-F-CAT-01-05b: Evita stock negativo cuando las reservas superan el inventario físico", async () => {
    findMany.mockResolvedValue([filaProductoPrisma({ id: "prd_001", stockQuantity: 2 })]);
    carritos.getReservedQuantities.mockResolvedValue({ prd_001: 5 });

    const salida = await caso.execute();

    expect(salida[0].stockQuantity).toBe(0);
    expect(salida[0].inStock).toBe(false);
  });

  it("CP-F-CAT-01-06c: Trata filtros con cadenas vacías como filtros ausentes", async () => {
    findMany.mockResolvedValue([]);

    await caso.execute({ categorySlug: "", query: "", tag: "" });

    expect(whereUsado()).toEqual({});
  });
});
