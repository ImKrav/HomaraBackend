// F-CAT-01 · Listar y filtrar el catálogo
// Unidad: ListProductsUseCase.execute() + PrismaProductRepository.findAll()  (GET /api/v1/products)

import { test, is, eq, ok } from "./harness.js";
import { fakeCarritos, filaProductoPrisma, carrito, spy, arg, calledWith, neverCalled } from "./helpers.js";
import { PrismaProductRepository } from "../src/infrastructure/database/repositories/prisma-product.repository.js";
import { ListProductsUseCase } from "../src/application/use-cases/catalog.use-cases.js";

/** Repo Prisma real conectado a un cliente `db` falso; devuelve también el spy de findMany. */
function montar() {
  const findMany = spy();
  const productos = new PrismaProductRepository({ product: { findMany } } as any);
  const carritos = fakeCarritos();
  const caso = new ListProductsUseCase(productos as any, carritos as any);
  const where = () => arg(findMany).where;
  return { findMany, carritos, caso, where };
}

test("CP-F-CAT-01-01", "Filtra por categoría, término de búsqueda y etiqueta simultáneamente", async () => {
  const { findMany, carritos, caso, where } = montar();
  findMany.resolves([]);

  const salida = await caso.execute({ categorySlug: "cementos", query: "gris", tag: "oferta" }, undefined);

  eq(where().category, { slug: "cementos" });
  eq(where().OR, [
    { name: { contains: "gris", mode: "insensitive" } },
    { description: { contains: "gris", mode: "insensitive" } },
  ]);
  eq(where().tags, { some: { name: "oferta" } });
  eq(salida, []);
  ok(neverCalled(carritos.getReservedQuantities));
  ok(neverCalled(carritos.findByUserId));
});

test("CP-F-CAT-01-02", "Filtra por texto y etiqueta sin categoría", async () => {
  const { findMany, carritos, caso, where } = montar();
  findMany.resolves([]);

  const salida = await caso.execute({ query: "estuco", tag: "oferta" });

  is(where().category, undefined);
  is(where().OR.length, 2);
  eq(where().tags, { some: { name: "oferta" } });
  eq(salida, []);
  ok(neverCalled(carritos.getReservedQuantities));
});

test("CP-F-CAT-01-03", "Filtra únicamente por etiqueta", async () => {
  const { findMany, caso, where } = montar();
  findMany.resolves([]);

  const salida = await caso.execute({ tag: "inexistente" });

  is(where().category, undefined);
  is(where().OR, undefined);
  eq(where().tags, { some: { name: "inexistente" } });
  eq(salida, []);
});

test("CP-F-CAT-01-04", "Lista catálogo sin filtros aplicados", async () => {
  const { findMany, carritos, caso, where } = montar();
  findMany.resolves([]);

  const salida = await caso.execute();

  eq(where(), {});
  eq(salida, []);
  ok(neverCalled(carritos.getReservedQuantities));
});

test("CP-F-CAT-01-05", "Excluye reservas del propio carrito para usuario autenticado", async () => {
  const { findMany, carritos, caso } = montar();
  findMany.resolves([
    filaProductoPrisma({ id: "prd_001", stockQuantity: 10 }),
    filaProductoPrisma({ id: "prd_002", stockQuantity: 5 }),
  ]);
  carritos.findByUserId.resolves(carrito({ id: "cart_001" }));
  carritos.getReservedQuantities.resolves({ prd_001: 3, prd_002: 5 });

  const salida = await caso.execute(undefined, "usr_001");

  ok(calledWith(carritos.findByUserId, "usr_001"));
  ok(calledWith(carritos.getReservedQuantities, "cart_001", ["prd_001", "prd_002"]));
  is(salida.length, 2);
  is(salida[0].stockQuantity, 7);
  is(salida[0].inStock, true);
  is(salida[1].stockQuantity, 0);
  is(salida[1].inStock, false);
});

test("CP-F-CAT-01-06", "Descuenta todas las reservas activas para visitante anónimo", async () => {
  const { findMany, carritos, caso } = montar();
  findMany.resolves([filaProductoPrisma({ id: "prd_001", stockQuantity: 10 })]);
  carritos.getReservedQuantities.resolves({ prd_001: 4 });

  const salida = await caso.execute();

  ok(neverCalled(carritos.findByUserId));
  ok(calledWith(carritos.getReservedQuantities, "", ["prd_001"]));
  is(salida[0].stockQuantity, 6);
  is(salida[0].inStock, true);
});

test("CP-F-CAT-01-05b", "Evita stock negativo cuando las reservas superan el inventario físico", async () => {
  const { findMany, carritos, caso } = montar();
  findMany.resolves([filaProductoPrisma({ id: "prd_001", stockQuantity: 2 })]);
  carritos.getReservedQuantities.resolves({ prd_001: 5 });

  const salida = await caso.execute();

  is(salida[0].stockQuantity, 0);
  is(salida[0].inStock, false);
});

test("CP-F-CAT-01-06c", "Trata filtros con cadenas vacías como filtros ausentes", async () => {
  const { findMany, caso, where } = montar();
  findMany.resolves([]);

  await caso.execute({ categorySlug: "", query: "", tag: "" });

  eq(where(), {});
});
