// F-PROY-03 · Asignar un producto al proyecto
// Unidad: UpdateProjectUseCase.execute()  (PUT /api/v1/projects/:id)

import { test, is, eq, ok, isNot, grab } from "./harness.js";
import { fakeProyectos, fakeProductos, producto, proyecto, materialManual, calledWith, neverCalled } from "./helpers.js";
import { UpdateProjectUseCase } from "../src/application/use-cases/project.use-cases.js";
import { AppError } from "../src/shared/errors/AppError.js";

function montar() {
  const proyectos = fakeProyectos();
  const productos = fakeProductos();
  const caso = new UpdateProjectUseCase(proyectos as any, productos as any);
  const actualizado = () => proyectos.update.calls[0]?.[1];
  return { proyectos, productos, caso, actualizado };
}

test("CP-F-PROY-03-01", "Rechaza materialType no soportado", async () => {
  const { proyectos, caso } = montar();
  const error = await grab(caso.execute("proy_001", "usr_001", { materialType: "marmol" } as any));

  ok(error instanceof AppError);
  is(error.message, "Tipo de material no soportado.");
  is(error.statusCode, 400);
  ok(neverCalled(proyectos.findById));
  ok(neverCalled(proyectos.update));
});

test("CP-F-PROY-03-02", "Retorna 404 si el proyecto no existe", async () => {
  const { proyectos, caso } = montar();
  proyectos.findById.resolves(null);

  const error = await grab(caso.execute("proy_fantasma", "usr_001", { name: "Cocina" } as any));

  ok(error instanceof AppError);
  is(error.message, "Proyecto no encontrado");
  is(error.statusCode, 404);
  ok(calledWith(proyectos.findById, "proy_fantasma"));
  ok(neverCalled(proyectos.update));
});

test("CP-F-PROY-03-03", "Retorna 403 si el proyecto pertenece a otro usuario", async () => {
  const { proyectos, caso } = montar();
  proyectos.findById.resolves(proyecto({ userId: "usr_002" }));

  const error = await grab(caso.execute("proy_001", "usr_001", { name: "Cocina ajena" } as any));

  ok(error instanceof AppError);
  is(error.message, "No tienes permiso para modificar este proyecto.");
  is(error.statusCode, 403);
  ok(neverCalled(proyectos.update));
});

test("CP-F-PROY-03-04", "Rechaza vincular producto incompatible con el tipo de proyecto", async () => {
  const { proyectos, productos, caso } = montar();
  proyectos.findById.resolves(proyecto({ materialType: "ceramica" }));
  productos.findById.resolves(
    producto({ id: "prd_pin", name: "Pintura Vinilo Tipo 1 Blanco", categorySlug: "pinturas", unit: "galón" }),
  );

  const error = await grab(caso.execute("proy_001", "usr_001", { selectedProductId: "prd_pin" } as any));

  ok(error instanceof AppError);
  is(
    error.message,
    "Para proyectos de revestimiento físico, el producto seleccionado debe ser de la categoría de pisos y cerámicas.",
  );
  is(error.statusCode, 400);
  ok(neverCalled(proyectos.update));
});

test("CP-F-PROY-03-05", "Guarda lista manual de materiales enviada por el cliente y recalcula presupuesto", async () => {
  const { proyectos, productos, caso, actualizado } = montar();
  proyectos.findById.resolves(proyecto());

  await caso.execute("proy_001", "usr_001", {
    name: "Cocina con lista propia",
    materials: [materialManual({ price: 100000 }), materialManual({ name: "Boquilla propia", price: 20000 })],
  } as any);

  const a = actualizado();
  is(a.materials.length, 2);
  is(a.materials[0].note, null);
  is(a.materials[0].productId, null);
  is(a.estimatedCost, 120000);
  is(a.name, "Cocina con lista propia");
  ok(neverCalled(productos.findById));
});

test("CP-F-PROY-03-06", "Actualiza únicamente campos descriptivos sin alterar materiales", async () => {
  const { proyectos, productos, caso, actualizado } = montar();
  proyectos.findById.resolves(proyecto());

  await caso.execute("proy_001", "usr_001", { name: "Cocina terminada", status: "COMPLETADO" } as any);

  const a = actualizado();
  eq(a, { name: "Cocina terminada", status: "COMPLETADO" });
  is(a.materials, undefined);
  is(a.estimatedCost, undefined);
  ok(neverCalled(productos.findById));
});

test("CP-F-PROY-03-07", "Recalcula materiales genéricos al cambiar área", async () => {
  const { proyectos, productos, caso, actualizado } = montar();
  proyectos.findById.resolves(proyecto({ area: 20, selectedProductId: null }));

  await caso.execute("proy_001", "usr_001", { area: 30 } as any);

  ok(neverCalled(productos.findById));
  const a = actualizado();
  is(a.materials[0].name, "Cerámica 60x60 cm");
  is(a.materials[0].quantity, "33 m²");
  ok(a.materials.every((m: any) => m.productId === null));

  const suma = a.materials.reduce((s: number, m: any) => s + m.price, 0);
  is(a.estimatedCost, suma);

  proyectos.update.reset();
  const resultado = await caso
    .execute("proy_001", "usr_001", {
      area: 30,
      materials: [materialManual({ name: "Lista manual del cliente", price: 999999 })],
    } as any)
    .then((p: any) => p, (e: any) => e);

  const guardadoTrasConflicto = proyectos.update.calls[0]?.[1];
  const respetaLaListaManual = (guardadoTrasConflicto?.materials ?? []).some(
    (m: any) => m.name === "Lista manual del cliente",
  );
  const avisaDelConflicto = resultado instanceof AppError;
  const comportamiento = respetaLaListaManual
    ? "respeta la lista manual"
    : avisaDelConflicto
      ? "avisa del conflicto"
      : "descarta la lista manual en silencio";

  // DEFECTO: la lista manual enviada junto a un campo de recálculo se descarta en silencio
  isNot(comportamiento, "descarta la lista manual en silencio");
});

test("CP-F-PROY-03-08", "Vincula producto compatible y recalcula materiales y presupuesto", async () => {
  const { proyectos, productos, caso, actualizado } = montar();
  proyectos.findById.resolves(proyecto({ area: 20, materialType: "ceramica", selectedProductId: null }));
  productos.findById.resolves(producto({ id: "prd_piso", price: 38900 }));

  await caso.execute("proy_001", "usr_001", { selectedProductId: "prd_piso" } as any);

  ok(calledWith(productos.findById, "prd_piso"));
  const a = actualizado();
  is(a.materials[0].name, "Piso Ceramico Beige 60x60");
  is(a.materials[0].quantity, "22 m²");
  is(a.materials[0].price, 855800);
  is(a.materials[0].productId, "prd_piso");
  is(a.selectedProductId, "prd_piso");

  const suma = a.materials.reduce((s: number, m: any) => s + m.price, 0);
  is(a.estimatedCost, suma);
});
