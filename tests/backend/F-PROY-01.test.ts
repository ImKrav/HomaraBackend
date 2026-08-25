import { describe, it, expect, beforeEach } from "vitest";
import { CreateProjectUseCase } from "../../src/application/use-cases/project.use-cases.js";
import { AppError } from "../../src/shared/errors/AppError.js";
import {
  mockProjectRepository,
  mockProductRepository,
  producto,
  datosProyecto,
  capturarError,
} from "../test-helpers.js";

describe("F-PROY-01 · Crear un proyecto", () => {
  let repoProyectos: ReturnType<typeof mockProjectRepository>;
  let repoProductos: ReturnType<typeof mockProductRepository>;
  let caso: CreateProjectUseCase;

  beforeEach(() => {
    repoProyectos = mockProjectRepository();
    repoProductos = mockProductRepository();
    caso = new CreateProjectUseCase(repoProyectos, repoProductos);
  });

  const loGuardado = () => repoProyectos.create.mock.calls[0][0];

  it("CP-F-PROY-01-01: Rechaza materialType no soportado antes de consultar catálogo", async () => {
    const error = await capturarError(caso.execute(datosProyecto({ materialType: "marmol" }) as any));

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe("Tipo de material no soportado.");
    expect(error.statusCode).toBe(400);
    expect(repoProductos.findById).not.toHaveBeenCalled();
    expect(repoProyectos.create).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-01-02: Retorna 404 si el selectedProductId no existe en el catálogo", async () => {
    repoProductos.findById.mockResolvedValue(null);

    const error = await capturarError(
      caso.execute(datosProyecto({ selectedProductId: "prd_borrado" }) as any)
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe("El producto seleccionado no existe.");
    expect(error.statusCode).toBe(404);
    expect(repoProductos.findById).toHaveBeenCalledWith("prd_borrado");
    expect(repoProyectos.create).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-01-03: Crea proyecto con materiales genéricos cuando no se vincula producto", async () => {
    const salida = await caso.execute(datosProyecto() as any);

    expect(repoProductos.findById).not.toHaveBeenCalled();
    const guardado = loGuardado();
    expect(guardado.status).toBe("EN_PROGRESO");
    expect(guardado.selectedProductId).toBeNull();
    expect(guardado.thumbnail).toBe("🏠");
    expect(guardado.wastePercent).toBe(10.0);
    expect(guardado.materials[0].name).toBe("Cerámica 60x60 cm");
    expect(guardado.materials.every((m: any) => m.productId === null)).toBe(true);

    const suma = guardado.materials.reduce((s: number, m: any) => s + m.price, 0);
    expect(guardado.estimatedCost).toBe(suma);
    expect(salida.id).toBe("proy_001");
  });

  it("CP-F-PROY-01-04: Rechaza producto sin categoría válida asignada", async () => {
    repoProductos.findById.mockResolvedValue(producto({ categorySlug: undefined }));

    const error = await capturarError(
      caso.execute(datosProyecto({ selectedProductId: "prd_001" }) as any)
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe("El producto seleccionado no tiene una categoría válida.");
    expect(error.statusCode).toBe(400);
    expect(repoProyectos.create).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-01-05: Rechaza categorías no permitidas para proyectos (ej. herramientas)", async () => {
    repoProductos.findById.mockResolvedValue(
      producto({ name: "Taladro Percutor 750W", categorySlug: "herramientas" })
    );

    const error = await capturarError(
      caso.execute(datosProyecto({ selectedProductId: "prd_001" }) as any)
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe(
      "Solo se pueden usar materiales de revestimiento (pisos, cerámicas o pinturas) o de construcción en un proyecto."
    );
    expect(error.statusCode).toBe(400);
    expect(repoProyectos.create).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-01-06: Valida correspondencia entre nombre de insumo y su categoría", async () => {
    repoProductos.findById.mockResolvedValue(
      producto({ name: "Pegante Ceramico Gris 25kg", categorySlug: "pisos-ceramicas" })
    );

    const error = await capturarError(
      caso.execute(datosProyecto({ selectedProductId: "prd_001" }) as any)
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe(
      "El material de construcción seleccionado no pertenece a la categoría correcta."
    );
    expect(error.statusCode).toBe(400);
    expect(repoProyectos.create).not.toHaveBeenCalled();

    repoProductos.findById.mockResolvedValue(
      producto({ id: "prd_calacatta", name: "Piso Calacatta Blanco 60x60", categorySlug: "pisos-ceramicas" })
    );

    const resultado = await caso
      .execute(datosProyecto({ selectedProductId: "prd_calacatta" }) as any)
      .then((p: any) => p, (e: any) => e);
    const observado = resultado instanceof AppError ? resultado.message : "proyecto creado";

    // DEFECTO: la subcadena 'cal' dentro de 'Calacatta' clasifica erróneamente un piso como material de construcción
    expect(observado).toBe("proyecto creado");
    expect(repoProyectos.create).toHaveBeenCalledTimes(1);
  });

  it("CP-F-PROY-01-07: Rechaza producto de pisos en proyecto configurado como pintura", async () => {
    repoProductos.findById.mockResolvedValue(producto());

    const error = await capturarError(
      caso.execute(
        datosProyecto({ materialType: "pintura", selectedProductId: "prd_001" }) as any
      )
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe(
      "Para proyectos de pintura, el producto seleccionado debe ser de la categoría de pinturas."
    );
    expect(error.statusCode).toBe(400);
    expect(repoProyectos.create).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-01-08: Rechaza vincular pegante en proyecto de madera", async () => {
    repoProductos.findById.mockResolvedValue(
      producto({ name: "Pegante Ceramico Gris 25kg", categorySlug: "materiales-construccion" })
    );

    const error = await capturarError(
      caso.execute(
        datosProyecto({ materialType: "madera", selectedProductId: "prd_001" }) as any
      )
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe(
      "Los materiales de construcción (pegante/boquilla) solo son compatibles con proyectos de cerámica o porcelanato."
    );
    expect(error.statusCode).toBe(400);
    expect(repoProyectos.create).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-01-09: Rechaza pintura en proyecto de madera", async () => {
    repoProductos.findById.mockResolvedValue(
      producto({ name: "Esmalte Sintetico Blanco", categorySlug: "pinturas", unit: "galón" })
    );

    const error = await capturarError(
      caso.execute(
        datosProyecto({ materialType: "madera", selectedProductId: "prd_001" }) as any
      )
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe(
      "Para proyectos de revestimiento físico, el producto seleccionado debe ser de la categoría de pisos y cerámicas."
    );
    expect(error.statusCode).toBe(400);
    expect(repoProyectos.create).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-01-10: Asigna pegante real del catálogo en proyecto de cerámica", async () => {
    repoProductos.findById.mockResolvedValue(
      producto({
        id: "prd_peg",
        name: "Pegante Ceramico Gris 25kg",
        categorySlug: "materiales-construccion",
        price: 30000,
        unit: "bultos",
      })
    );

    await caso.execute(
      datosProyecto({ materialType: "ceramica", selectedProductId: "prd_peg", area: 20 }) as any
    );

    const guardado = loGuardado();
    const pegante = guardado.materials.find((m: any) => m.productId === "prd_peg");
    expect(pegante).toBeDefined();
    expect(pegante.quantity).toBe("5 bultos");
    expect(pegante.price).toBe(150000);
    expect(guardado.materials[0].name).toBe("Cerámica 60x60 cm");
    expect(guardado.selectedProductId).toBe("prd_peg");

    const suma = guardado.materials.reduce((s: number, m: any) => s + m.price, 0);
    expect(guardado.estimatedCost).toBe(suma);
  });

  it("CP-F-PROY-01-11: Asigna pintura real del catálogo en proyecto de pintura", async () => {
    repoProductos.findById.mockResolvedValue(
      producto({
        id: "prd_pin",
        name: "Pintura Vinilo Tipo 1 Blanco",
        categorySlug: "pinturas",
        unit: "galón",
        price: 120000,
      })
    );

    await caso.execute(
      datosProyecto({ materialType: "pintura", selectedProductId: "prd_pin", area: 20 }) as any
    );

    const guardado = loGuardado();
    expect(guardado.materials[0].name).toBe("Pintura Vinilo Tipo 1 Blanco");
    expect(guardado.materials[0].productId).toBe("prd_pin");
    expect(guardado.materials[0].quantity).toContain("galón");
    expect(guardado.materialType).toBe("pintura");

    const suma = guardado.materials.reduce((s: number, m: any) => s + m.price, 0);
    expect(guardado.estimatedCost).toBe(suma);
  });

  it("CP-F-PROY-01-12: Asigna producto de pisos del catálogo calculando desperdicio y costo", async () => {
    repoProductos.findById.mockResolvedValue(
      producto({ id: "prd_piso", price: 40000, unit: "m²" })
    );

    await caso.execute(
      datosProyecto({ materialType: "ceramica", selectedProductId: "prd_piso", area: 20 }) as any
    );

    const guardado = loGuardado();
    expect(guardado.materials[0].name).toBe("Piso Ceramico Beige 60x60");
    expect(guardado.materials[0].quantity).toBe("22 m²");
    expect(guardado.materials[0].price).toBe(880000);
    expect(guardado.materials[0].productId).toBe("prd_piso");
    expect(guardado.selectedProductId).toBe("prd_piso");

    const suma = guardado.materials.reduce((s: number, m: any) => s + m.price, 0);
    expect(guardado.estimatedCost).toBe(suma);
  });
});
