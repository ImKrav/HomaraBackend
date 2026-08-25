// ============================================================================
// F-PROY-03 · Asignar un producto al proyecto — Backend
// Grafo:   17_F-PROY-03_BACKEND_Asignar_un_producto_al_proyecto.drawio
// Unidad:  UpdateProjectUseCase.execute()  ·  PUT /api/v1/projects/:id
// Métrica: N=31  A=37  P=7  →  V(G) = 37 − 31 + 2 = 8
// Cobertura de ruta básica: 8 caminos independientes → 8 casos de prueba
// Trazabilidad: RF22 · HU30 · ESC22 · RF23–ESC23 (editar proyecto)
// ============================================================================
//
// Decisión de diseño: igual que en F-PROY-01, calculateMaterials() se deja
// correr de verdad por ser una función pura del dominio; así los nodos 26-27
// (recálculo y nuevo estimatedCost) se comprueban sobre valores reales.
// Los dos repositorios del constructor se sustituyen con vi.fn().
// ============================================================================
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
} from "../_ayudas.js";

describe("F-PROY-03 · Asignar un producto al proyecto", () => {
  let repoProyectos: ReturnType<typeof mockProjectRepository>;
  let repoProductos: ReturnType<typeof mockProductRepository>;
  let caso: UpdateProjectUseCase;

  beforeEach(() => {
    repoProyectos = mockProjectRepository();
    repoProductos = mockProductRepository();
    caso = new UpdateProjectUseCase(repoProyectos, repoProductos);
  });

  /** Datos con los que el caso de uso llamó a projectRepository.update() (nodos 19/21/29). */
  const loActualizado = () => repoProyectos.update.mock.calls[0][1];

  it("CP-F-PROY-03-01 · camino 1,2,3,6,F · Paso 2 = NO → el material enviado no está entre los permitidos", async () => {
    // Nodo 2: se valida antes de siquiera buscar el proyecto.
    const error = await capturarError(
      caso.execute("proy_001", "usr_001", { materialType: "marmol" } as any)
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe("Tipo de material no soportado.");
    expect(error.statusCode).toBe(400);
    expect(repoProyectos.findById).not.toHaveBeenCalled();
    expect(repoProyectos.update).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-03-02 · camino 1,2,4,5,7,11,F · Paso 2 = SI, Paso 5 = NO → el proyecto no existe", async () => {
    repoProyectos.findById.mockResolvedValue(null);              // fuerza Paso 5 = NO

    const error = await capturarError(
      caso.execute("proy_fantasma", "usr_001", { name: "Cocina" } as any)
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe("Proyecto no encontrado");
    expect(error.statusCode).toBe(404);
    expect(repoProyectos.findById).toHaveBeenCalledWith("proy_fantasma");
    expect(repoProyectos.update).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-03-03 · camino 1,2,4,5,8,9,13,F · Paso 5 = SI, Paso 8 = NO → el proyecto es de otro usuario", async () => {
    // Nodo 8: el proyecto pertenece a usr_002 y lo intenta modificar usr_001.
    repoProyectos.findById.mockResolvedValue(proyecto({ userId: "usr_002" }));

    const error = await capturarError(
      caso.execute("proy_001", "usr_001", { name: "Cocina ajena" } as any)
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe("No tienes permiso para modificar este proyecto.");
    expect(error.statusCode).toBe(403);
    expect(repoProyectos.update).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-03-04 · camino 1,2,4,5,8,10,12,14,15,17,20,23,25,28,F · Paso 14 = SI, Paso 17 = SI, Paso 23 = NO → el producto no es compatible con el proyecto", async () => {
    repoProyectos.findById.mockResolvedValue(proyecto({ materialType: "ceramica" }));
    // Nodo 20: el producto existe y tiene categoría, pero es de pinturas.
    repoProductos.findById.mockResolvedValue(
      producto({ id: "prd_pin", name: "Pintura Vinilo Tipo 1 Blanco", categorySlug: "pinturas", unit: "galón" })
    );

    // Nodo 12: selectedProductId dispara el recálculo (Paso 14 = SI).
    const error = await capturarError(
      caso.execute("proy_001", "usr_001", { selectedProductId: "prd_pin" } as any)
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe(
      "Para proyectos de revestimiento físico, el producto seleccionado debe ser de la categoría de pisos y cerámicas."
    );
    expect(error.statusCode).toBe(400);
    // Salida esperada: no se guarda nada del proyecto.
    expect(repoProyectos.update).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-03-05 · camino 1,2,4,5,8,10,12,14,16,18,21,24,F · Paso 14 = NO, Paso 16 = SI → se guarda la lista de materiales enviada por el cliente", async () => {
    repoProyectos.findById.mockResolvedValue(proyecto());

    // Ningún campo de los 14 que disparan recálculo (nodo 12); sí llega 'materials'.
    await caso.execute("proy_001", "usr_001", {
      name: "Cocina con lista propia",
      materials: [materialManual({ price: 100000 }), materialManual({ name: "Boquilla propia", price: 20000 })],
    } as any);

    const actualizado = loActualizado();
    // Nodo 18: la lista se normaliza (note y productId quedan explícitos en null).
    expect(actualizado.materials).toHaveLength(2);
    expect(actualizado.materials[0].note).toBeNull();
    expect(actualizado.materials[0].productId).toBeNull();
    // Nodo 18: el presupuesto se recalcula a partir de esa lista.
    expect(actualizado.estimatedCost).toBe(120000);
    expect(actualizado.name).toBe("Cocina con lista propia");
    // No se consultó el catálogo porque no hubo recálculo.
    expect(repoProductos.findById).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-03-06 · camino 1,2,4,5,8,10,12,14,16,19,22,F · Paso 14 = NO, Paso 16 = NO → sólo se guardan los campos descriptivos", async () => {
    repoProyectos.findById.mockResolvedValue(proyecto());

    await caso.execute("proy_001", "usr_001", {
      name: "Cocina terminada",
      status: "COMPLETADO",
    } as any);

    const actualizado = loActualizado();
    // Nodo 19: se guarda tal cual, sin tocar materiales ni presupuesto.
    expect(actualizado).toEqual({ name: "Cocina terminada", status: "COMPLETADO" });
    expect(actualizado.materials).toBeUndefined();
    expect(actualizado.estimatedCost).toBeUndefined();
    expect(repoProductos.findById).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-03-07 · camino 1,2,4,5,8,10,12,14,15,17,26,27,29,30,F · Paso 14 = SI, Paso 17 = NO → se recalcula sin producto del catálogo", async () => {
    // El proyecto guardado no tiene producto vinculado (Paso 17 = NO).
    repoProyectos.findById.mockResolvedValue(proyecto({ area: 20, selectedProductId: null }));

    // Nodo 12: 'area' dispara el recálculo (Paso 14 = SI).
    await caso.execute("proy_001", "usr_001", { area: 30 } as any);

    expect(repoProductos.findById).not.toHaveBeenCalled();
    const actualizado = loActualizado();
    // Nodos 15 y 26: el área viene del cambio y el resto del proyecto existente
    // (30 m² + 10% de desperdicio = 33 m² de cerámica genérica 60x60).
    expect(actualizado.materials[0].name).toBe("Cerámica 60x60 cm");
    expect(actualizado.materials[0].quantity).toBe("33 m²");
    expect(actualizado.materials.every((m: any) => m.productId === null)).toBe(true);
    // Nodo 27: el presupuesto es la suma de la lista recalculada.
    const suma = actualizado.materials.reduce((s: number, m: any) => s + m.price, 0);
    expect(actualizado.estimatedCost).toBe(suma);

    // ---- Comportamiento esperado ante una lista manual en conflicto ------
    // Enviar 'materials' junto con un campo que dispara el recálculo (nodos
    // 14-16-18) es una orden ambigua: el sistema debe respetar la lista del
    // cliente o avisarle del conflicto, pero nunca descartarla en silencio.
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

    // DEFECTO: la lista manual enviada junto a un campo de recálculo se descarta
    // sin aviso (la rama del nodo 18 es un 'else if' del bloque de recálculo).
    expect(comportamiento).not.toBe("descarta la lista manual en silencio");
  });

  it("CP-F-PROY-03-08 · camino 1,2,4,5,8,10,12,14,15,17,20,23,26,27,29,30,F · Paso 23 = SI → el producto compatible queda vinculado y se recalcula", async () => {
    repoProyectos.findById.mockResolvedValue(
      proyecto({ area: 20, materialType: "ceramica", selectedProductId: null })
    );
    // Nodo 20: producto de pisos y cerámicas, compatible con un proyecto de cerámica.
    repoProductos.findById.mockResolvedValue(producto({ id: "prd_piso", price: 38900 }));

    await caso.execute("proy_001", "usr_001", { selectedProductId: "prd_piso" } as any);

    expect(repoProductos.findById).toHaveBeenCalledWith("prd_piso");
    const actualizado = loActualizado();
    // Nodo 26: 20 m² + 10% de desperdicio = 22 m² del producto real ($38.900/m²).
    expect(actualizado.materials[0].name).toBe("Piso Ceramico Beige 60x60");
    expect(actualizado.materials[0].quantity).toBe("22 m²");
    expect(actualizado.materials[0].price).toBe(855800);
    expect(actualizado.materials[0].productId).toBe("prd_piso");
    // Nodos 27 y 29: se guarda el vínculo y el presupuesto recalculado.
    expect(actualizado.selectedProductId).toBe("prd_piso");
    const suma = actualizado.materials.reduce((s: number, m: any) => s + m.price, 0);
    expect(actualizado.estimatedCost).toBe(suma);
  });
});
