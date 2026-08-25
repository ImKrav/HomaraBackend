// ============================================================================
// F-PROY-01 · Crear un proyecto — Backend
// Grafo:   13_F-PROY-01_BACKEND_Crear_un_proyecto.drawio
// Unidad:  CreateProjectUseCase.execute()  ·  POST /api/v1/projects
// Métrica: N=35  A=45  P=11  →  V(G) = 45 − 35 + 2 = 12
// Cobertura de ruta básica: 12 caminos independientes → 12 casos de prueba
// Trazabilidad: RF17 · HU26 · ESC17 · RF22–ESC22 (vinculación de producto)
// ============================================================================
//
// Decisión de diseño: calculateMaterials() NO se sustituye por un doble.
// Es una función pura del dominio (sin E/S ni dependencias externas), así que
// dejarla correr de verdad mantiene el arrange corto y permite comprobar que
// el nodo 32 (estimatedCost) suma exactamente los precios que ella devuelve.
// Los repositorios sí se mockean con vi.fn() porque son las fronteras de E/S.
// ============================================================================
import { describe, it, expect, beforeEach } from "vitest";
import { CreateProjectUseCase } from "../../src/application/use-cases/project.use-cases.js";
import { AppError } from "../../src/shared/errors/AppError.js";
import {
  mockProjectRepository,
  mockProductRepository,
  producto,
  datosProyecto,
  capturarError,
} from "../_ayudas.js";

describe("F-PROY-01 · Crear un proyecto", () => {
  let repoProyectos: ReturnType<typeof mockProjectRepository>;
  let repoProductos: ReturnType<typeof mockProductRepository>;
  let caso: CreateProjectUseCase;

  beforeEach(() => {
    repoProyectos = mockProjectRepository();
    repoProductos = mockProductRepository();
    caso = new CreateProjectUseCase(repoProyectos, repoProductos);
  });

  /** Datos con los que el caso de uso llamó a projectRepository.create() (nodo 33). */
  const loGuardado = () => repoProyectos.create.mock.calls[0][0];

  it("CP-F-PROY-01-01 · camino 1,2,3,6,35 · Paso 2 = NO → el tipo de material no está entre los permitidos", async () => {
    // Nodo 2: 'marmol' no pertenece a [ceramica, porcelanato, madera, vinilo, pintura].
    const error = await capturarError(caso.execute(datosProyecto({ materialType: "marmol" }) as any));

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe("Tipo de material no soportado.");
    expect(error.statusCode).toBe(400);
    // Salida esperada: se corta antes de tocar el catálogo y antes de guardar.
    expect(repoProductos.findById).not.toHaveBeenCalled();
    expect(repoProyectos.create).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-01-02 · camino 1,2,4,5,7,8,12,35 · Paso 4 = SI, Paso 7 = NO → el producto elegido no existe en el catálogo", async () => {
    repoProductos.findById.mockResolvedValue(null);              // fuerza Paso 7 = NO

    const error = await capturarError(
      caso.execute(datosProyecto({ selectedProductId: "prd_borrado" }) as any)
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe("El producto seleccionado no existe.");
    expect(error.statusCode).toBe(404);
    // Nodo 5: se consultó el catálogo con el identificador recibido.
    expect(repoProductos.findById).toHaveBeenCalledWith("prd_borrado");
    expect(repoProyectos.create).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-01-03 · camino 1,2,4,28,32,33,34,35 · Paso 4 = NO → el proyecto se crea con materiales genéricos", async () => {
    // Sin selectedProductId (Paso 4 = NO) toda la validación de catálogo se omite.
    const salida = await caso.execute(datosProyecto() as any);

    expect(repoProductos.findById).not.toHaveBeenCalled();
    const guardado = loGuardado();
    // Nodo 33: valores por defecto del proyecto nuevo.
    expect(guardado.status).toBe("EN_PROGRESO");
    expect(guardado.selectedProductId).toBeNull();
    expect(guardado.thumbnail).toBe("🏠");
    expect(guardado.wastePercent).toBe(10.0);
    // Nodo 28: material genérico (no viene del catálogo).
    expect(guardado.materials[0].name).toBe("Cerámica 60x60 cm");
    expect(guardado.materials.every((m: any) => m.productId === null)).toBe(true);
    // Nodo 32: el costo estimado es la suma exacta de los precios calculados.
    const suma = guardado.materials.reduce((s: number, m: any) => s + m.price, 0);
    expect(guardado.estimatedCost).toBe(suma);
    expect(salida.id).toBe("proy_001");
  });

  it("CP-F-PROY-01-04 · camino 1,2,4,5,7,9,10,15,35 · Paso 7 = SI, Paso 9 = NO → el producto no tiene categoría asignada", async () => {
    repoProductos.findById.mockResolvedValue(producto({ categorySlug: undefined })); // fuerza Paso 9 = NO

    const error = await capturarError(
      caso.execute(datosProyecto({ selectedProductId: "prd_001" }) as any)
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe("El producto seleccionado no tiene una categoría válida.");
    expect(error.statusCode).toBe(400);
    expect(repoProyectos.create).not.toHaveBeenCalled();
  });

  it("CP-F-PROY-01-05 · camino 1,2,4,5,7,9,11,13,18,35 · Paso 9 = SI, Paso 11 = NO → la categoría del producto no sirve para un proyecto", async () => {
    // Nodo 11: 'herramientas' no está en [pisos-ceramicas, pinturas, materiales-construccion].
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

  it("CP-F-PROY-01-06 · camino 1,2,4,5,7,9,11,14,16,19,27,35 · Paso 14 = SI, Paso 16 = NO → material de construcción fuera de su categoría", async () => {
    // Nodo 14: el nombre contiene 'pegante' → se clasifica como material de construcción.
    // Nodo 16: pero su categoría es 'pisos-ceramicas', no 'materiales-construccion'.
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

    // ---- Comportamiento esperado sobre este mismo nodo 14 ----------------
    // El nodo 14 clasifica con includes() sobre el nombre, y la subcadena 'cal'
    // aparece dentro de palabras legítimas. 'Piso Calacatta Blanco 60x60' en la
    // categoría 'pisos-ceramicas' es un piso real y debe poder usarse: el
    // proyecto tiene que crearse igual que en CP-F-PROY-01-12.
    repoProductos.findById.mockResolvedValue(
      producto({ id: "prd_calacatta", name: "Piso Calacatta Blanco 60x60", categorySlug: "pisos-ceramicas" })
    );

    const resultado = await caso
      .execute(datosProyecto({ selectedProductId: "prd_calacatta" }) as any)
      .then((p: any) => p, (e: any) => e);
    const observado = resultado instanceof AppError ? resultado.message : "proyecto creado";

    // DEFECTO: la subcadena 'cal' dentro de 'Calacatta' hace que un piso legítimo
    // se clasifique como material de construcción y se rechace con 400.
    expect(observado).toBe("proyecto creado");
    expect(repoProyectos.create).toHaveBeenCalledTimes(1);
  });

  it("CP-F-PROY-01-07 · camino 1,2,4,5,7,9,11,14,17,21,24,30,35 · Paso 17 = SI, Paso 21 = NO → proyecto de pintura con un producto que no es pintura", async () => {
    repoProductos.findById.mockResolvedValue(producto());        // pisos-ceramicas, Paso 21 = NO

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

  it("CP-F-PROY-01-08 · camino 1,2,4,5,7,9,11,14,16,20,23,29,35 · Paso 16 = SI, Paso 20 = NO → pegante en un proyecto que no es de cerámica ni porcelanato", async () => {
    repoProductos.findById.mockResolvedValue(
      producto({ name: "Pegante Ceramico Gris 25kg", categorySlug: "materiales-construccion" })
    );

    // Nodo 20: el proyecto es de madera, no de cerámica ni porcelanato.
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

  it("CP-F-PROY-01-09 · camino 1,2,4,5,7,9,11,14,17,22,25,31,35 · Paso 17 = NO, Paso 22 = NO → revestimiento físico con un producto que no es de pisos", async () => {
    // Nodo 22: el producto es de 'pinturas' y el proyecto es de madera.
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

  it("CP-F-PROY-01-10 · camino 1,2,4,5,7,9,11,14,16,20,26,28,32,33,34,35 · Paso 20 = SI → pegante compatible: el proyecto se crea con el pegante real", async () => {
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
    // Nodo 26 + 28: el pegante del catálogo reemplaza al pegante genérico
    // (20 m² ÷ 4 m² por bulto de 25kg = 5 bultos × $30.000).
    const pegante = guardado.materials.find((m: any) => m.productId === "prd_peg");
    expect(pegante).toBeDefined();
    expect(pegante.quantity).toBe("5 bultos");
    expect(pegante.price).toBe(150000);
    // El revestimiento principal sigue siendo genérico: el pegante no es revestimiento.
    expect(guardado.materials[0].name).toBe("Cerámica 60x60 cm");
    expect(guardado.selectedProductId).toBe("prd_peg");
    const suma = guardado.materials.reduce((s: number, m: any) => s + m.price, 0);
    expect(guardado.estimatedCost).toBe(suma);
  });

  it("CP-F-PROY-01-11 · camino 1,2,4,5,7,9,11,14,17,21,26,28,32,33,34,35 · Paso 21 = SI → proyecto de pintura con un producto de pinturas", async () => {
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
    // Nodo 26: se usan el precio y la unidad del producto del catálogo.
    expect(guardado.materials[0].name).toBe("Pintura Vinilo Tipo 1 Blanco");
    expect(guardado.materials[0].productId).toBe("prd_pin");
    expect(guardado.materials[0].quantity).toContain("galón");
    expect(guardado.materialType).toBe("pintura");
    // Nodo 32.
    const suma = guardado.materials.reduce((s: number, m: any) => s + m.price, 0);
    expect(guardado.estimatedCost).toBe(suma);
  });

  it("CP-F-PROY-01-12 · camino 1,2,4,5,7,9,11,14,17,22,26,28,32,33,34,35 · Paso 22 = SI → proyecto de cerámica con un producto de pisos y cerámicas", async () => {
    repoProductos.findById.mockResolvedValue(
      producto({ id: "prd_piso", price: 40000, unit: "m²" })   // pisos-ceramicas, Paso 22 = SI
    );

    await caso.execute(
      datosProyecto({ materialType: "ceramica", selectedProductId: "prd_piso", area: 20 }) as any
    );

    const guardado = loGuardado();
    // Nodo 26 + 28: 20 m² + 10% de desperdicio = 22 m² × $40.000.
    expect(guardado.materials[0].name).toBe("Piso Ceramico Beige 60x60");
    expect(guardado.materials[0].quantity).toBe("22 m²");
    expect(guardado.materials[0].price).toBe(880000);
    expect(guardado.materials[0].productId).toBe("prd_piso");
    // Nodos 32-33: se guarda el vínculo con el producto y el costo total.
    expect(guardado.selectedProductId).toBe("prd_piso");
    const suma = guardado.materials.reduce((s: number, m: any) => s + m.price, 0);
    expect(guardado.estimatedCost).toBe(suma);
  });
});
