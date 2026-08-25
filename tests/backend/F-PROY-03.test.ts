import { describe, it, expect, beforeEach } from "vitest";
import { UpdateProjectUseCase } from "../../src/application/use-cases/project.use-cases.js";
import { AppError } from "../../src/shared/errors/AppError.js";
import {
  mockProjectRepository,
  mockProductRepository,
  producto,
  proyecto,
  materialManual,
  capturarError,
} from "../test-helpers.js";

describe("F-PROY-03 · Asignar un producto al proyecto", () => {
  let repoProyectos: ReturnType<typeof mockProjectRepository>;
  let repoProductos: ReturnType<typeof mockProductRepository>;
  let caso: UpdateProjectUseCase;

  beforeEach(() => {
    repoProyectos = mockProjectRepository();
    repoProductos = mockProductRepository();
    caso = new UpdateProjectUseCase(repoProyectos, repoProductos);
  });

  const loActualizado = () => repoProyectos.update.mock.calls[0][1];

  it("CP-F-PROY-03-01: Rechaza materialType no soportado", async () => {
    const error = await capturarError(
      caso.execute("proy_001", "usr_001", { materialType: "marmol" } as any)
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe("Tipo de material no soportado.");
    expect(error.statusCode).toBe(400);
    expect(repoProyectos.findById).not.toHaveBeenCalled();
    expect(repoProyectos.update).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-03-02: Retorna 404 si el proyecto no existe", async () => {
    repoProyectos.findById.mockResolvedValue(null);

    const error = await capturarError(
      caso.execute("proy_fantasma", "usr_001", { name: "Cocina" } as any)
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe("Proyecto no encontrado");
    expect(error.statusCode).toBe(404);
    expect(repoProyectos.findById).toHaveBeenCalledWith("proy_fantasma");
    expect(repoProyectos.update).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-03-03: Retorna 403 si el proyecto pertenece a otro usuario", async () => {
    repoProyectos.findById.mockResolvedValue(proyecto({ userId: "usr_002" }));

    const error = await capturarError(
      caso.execute("proy_001", "usr_001", { name: "Cocina ajena" } as any)
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe("No tienes permiso para modificar este proyecto.");
    expect(error.statusCode).toBe(403);
    expect(repoProyectos.update).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-03-04: Rechaza vincular producto incompatible con el tipo de proyecto", async () => {
    repoProyectos.findById.mockResolvedValue(proyecto({ materialType: "ceramica" }));
    repoProductos.findById.mockResolvedValue(
      producto({ id: "prd_pin", name: "Pintura Vinilo Tipo 1 Blanco", categorySlug: "pinturas", unit: "galón" })
    );

    const error = await capturarError(
      caso.execute("proy_001", "usr_001", { selectedProductId: "prd_pin" } as any)
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe(
      "Para proyectos de revestimiento físico, el producto seleccionado debe ser de la categoría de pisos y cerámicas."
    );
    expect(error.statusCode).toBe(400);
    expect(repoProyectos.update).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-03-05: Guarda lista manual de materiales enviada por el cliente y recalcula presupuesto", async () => {
    repoProyectos.findById.mockResolvedValue(proyecto());

    await caso.execute("proy_001", "usr_001", {
      name: "Cocina con lista propia",
      materials: [materialManual({ price: 100000 }), materialManual({ name: "Boquilla propia", price: 20000 })],
    } as any);

    const actualizado = loActualizado();
    expect(actualizado.materials).toHaveLength(2);
    expect(actualizado.materials[0].note).toBeNull();
    expect(actualizado.materials[0].productId).toBeNull();
    expect(actualizado.estimatedCost).toBe(120000);
    expect(actualizado.name).toBe("Cocina con lista propia");
    expect(repoProductos.findById).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-03-06: Actualiza únicamente campos descriptivos sin alterar materiales", async () => {
    repoProyectos.findById.mockResolvedValue(proyecto());

    await caso.execute("proy_001", "usr_001", {
      name: "Cocina terminada",
      status: "COMPLETADO",
    } as any);

    const actualizado = loActualizado();
    expect(actualizado).toEqual({ name: "Cocina terminada", status: "COMPLETADO" });
    expect(actualizado.materials).toBeUndefined();
    expect(actualizado.estimatedCost).toBeUndefined();
    expect(repoProductos.findById).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-03-07: Recalcula materiales genéricos al cambiar área", async () => {
    repoProyectos.findById.mockResolvedValue(proyecto({ area: 20, selectedProductId: null }));

    await caso.execute("proy_001", "usr_001", { area: 30 } as any);

    expect(repoProductos.findById).not.toHaveBeenCalled();
    const actualizado = loActualizado();
    expect(actualizado.materials[0].name).toBe("Cerámica 60x60 cm");
    expect(actualizado.materials[0].quantity).toBe("33 m²");
    expect(actualizado.materials.every((m: any) => m.productId === null)).toBe(true);

    const suma = actualizado.materials.reduce((s: number, m: any) => s + m.price, 0);
    expect(actualizado.estimatedCost).toBe(suma);

    repoProyectos.update.mockClear();
    const resultado = await caso
      .execute("proy_001", "usr_001", {
        area: 30,
        materials: [materialManual({ name: "Lista manual del cliente", price: 999999 })],
      } as any)
      .then((p: any) => p, (e: any) => e);

    const guardadoTrasConflicto = repoProyectos.update.mock.calls[0]?.[1];
    const respetaLaListaManual = (guardadoTrasConflicto?.materials ?? []).some(
      (m: any) => m.name === "Lista manual del cliente"
    );
    const avisaDelConflicto = resultado instanceof AppError;
    const comportamiento = respetaLaListaManual
      ? "respeta la lista manual"
      : avisaDelConflicto
        ? "avisa del conflicto"
        : "descarta la lista manual en silencio";

    // DEFECTO: la lista manual enviada junto a un campo de recálculo se descarta en silencio
    expect(comportamiento).not.toBe("descarta la lista manual en silencio");
  });

  it("CP-F-PROY-03-08: Vincula producto compatible y recalcula materiales y presupuesto", async () => {
    repoProyectos.findById.mockResolvedValue(
      proyecto({ area: 20, materialType: "ceramica", selectedProductId: null })
    );
    repoProductos.findById.mockResolvedValue(producto({ id: "prd_piso", price: 38900 }));

    await caso.execute("proy_001", "usr_001", { selectedProductId: "prd_piso" } as any);

    expect(repoProductos.findById).toHaveBeenCalledWith("prd_piso");
    const actualizado = loActualizado();
    expect(actualizado.materials[0].name).toBe("Piso Ceramico Beige 60x60");
    expect(actualizado.materials[0].quantity).toBe("22 m²");
    expect(actualizado.materials[0].price).toBe(855800);
    expect(actualizado.materials[0].productId).toBe("prd_piso");
    expect(actualizado.selectedProductId).toBe("prd_piso");

    const suma = actualizado.materials.reduce((s: number, m: any) => s + m.price, 0);
    expect(actualizado.estimatedCost).toBe(suma);
  });
});
