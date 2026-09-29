// F-PROY-01 · Crear un proyecto
// Unidad: CreateProjectUseCase.execute()  (POST /api/v1/projects)

import { test, grab, expect } from "./harness.js";
import { fakeProyectos, fakeProductos, producto, datosProyecto } from "./helpers.js";
import { CreateProjectUseCase } from "../src/application/use-cases/project.use-cases.js";
import { AppError } from "../src/shared/errors/AppError.js";

function montar() {
  const proyectos = fakeProyectos();
  const productos = fakeProductos();
  const caso = new CreateProjectUseCase(proyectos as any, productos as any);
  const guardado = () => proyectos.create.mock.calls[0][0];
  return { proyectos, productos, caso, guardado };
}

test("CP-F-PROY-01-01", "Rechaza materialType no soportado antes de consultar catálogo", async () => {
  // Arrange
  const { proyectos, productos, caso } = montar();

  // Act
  const error = await grab(caso.execute(datosProyecto({ materialType: "marmol" }) as any));

  // Assert
  expect(error).toBeInstanceOf(AppError);
  expect(error.message).toBe("Tipo de material no soportado.");
  expect(error.statusCode).toBe(400);
  expect(productos.findById).not.toHaveBeenCalled();
  expect(proyectos.create).not.toHaveBeenCalled();
});

test("CP-F-PROY-01-02", "Retorna 404 si el selectedProductId no existe en el catálogo", async () => {
  // Arrange
  const { proyectos, productos, caso } = montar();
  productos.findById.mockResolvedValue(null);

  // Act
  const error = await grab(caso.execute(datosProyecto({ selectedProductId: "prd_borrado" }) as any));

  // Assert
  expect(error).toBeInstanceOf(AppError);
  expect(error.message).toBe("El producto seleccionado no existe.");
  expect(error.statusCode).toBe(404);
  expect(productos.findById).toHaveBeenCalledWith("prd_borrado");
  expect(proyectos.create).not.toHaveBeenCalled();
});

test("CP-F-PROY-01-03", "Crea proyecto con materiales genéricos cuando no se vincula producto", async () => {
  // Arrange
  const { productos, caso, guardado } = montar();

  // Act
  const salida = await caso.execute(datosProyecto() as any);

  // Assert
  expect(productos.findById).not.toHaveBeenCalled();
  const g = guardado();
  expect(g.status).toBe("EN_PROGRESO");
  expect(g.selectedProductId).toBe(null);
  expect(g.thumbnail).toBe("🏠");
  expect(g.wastePercent).toBe(10.0);
  expect(g.materials[0].name).toBe("Cerámica 60x60 cm");
  expect(g.materials.every((m: any) => m.productId === null)).toBeTruthy();
  expect(g.estimatedCost).toBe(g.materials.reduce((s: number, m: any) => s + m.price, 0));
  expect(salida.id).toBe("proy_001");
});

test("CP-F-PROY-01-04", "Rechaza producto sin categoría válida asignada", async () => {
  // Arrange
  const { proyectos, productos, caso } = montar();
  productos.findById.mockResolvedValue(producto({ categorySlug: undefined }));

  // Act
  const error = await grab(caso.execute(datosProyecto({ selectedProductId: "prd_001" }) as any));

  // Assert
  expect(error).toBeInstanceOf(AppError);
  expect(error.message).toBe("El producto seleccionado no tiene una categoría válida.");
  expect(error.statusCode).toBe(400);
  expect(proyectos.create).not.toHaveBeenCalled();
});

test("CP-F-PROY-01-05", "Rechaza categorías no permitidas para proyectos (ej. herramientas)", async () => {
  // Arrange
  const { proyectos, productos, caso } = montar();
  productos.findById.mockResolvedValue(producto({ name: "Taladro Percutor 750W", categorySlug: "herramientas" }));

  // Act
  const error = await grab(caso.execute(datosProyecto({ selectedProductId: "prd_001" }) as any));

  // Assert
  expect(error).toBeInstanceOf(AppError);
  expect(error.message).toBe("Solo se pueden usar materiales de revestimiento (pisos, cerámicas o pinturas) o de construcción en un proyecto.");
  expect(error.statusCode).toBe(400);
  expect(proyectos.create).not.toHaveBeenCalled();
});

// Defecto abierto #1 (ver la tabla en tests/README.md): se espera que falle.
test.fails("CP-F-PROY-01-06", "Valida correspondencia entre nombre de insumo y su categoría", async () => {
  // Arrange
  const { proyectos, productos, caso } = montar();
  productos.findById.mockResolvedValue(producto({ name: "Pegante Ceramico Gris 25kg", categorySlug: "pisos-ceramicas" }));

  // Act — 2º escenario: un piso legítimo cuyo nombre contiene la subcadena 'cal'.
  const error = await grab(caso.execute(datosProyecto({ selectedProductId: "prd_001" }) as any));
  const creadosTrasElRechazo = proyectos.create.mock.calls.length;

  productos.findById.mockResolvedValue(
    producto({ id: "prd_calacatta", name: "Piso Calacatta Blanco 60x60", categorySlug: "pisos-ceramicas" }),
  );
  const resultado = await caso
    .execute(datosProyecto({ selectedProductId: "prd_calacatta" }) as any)
    .then((p: any) => p, (e: any) => e);

  // Assert
  expect(error).toBeInstanceOf(AppError);
  expect(error.message).toBe("El material de construcción seleccionado no pertenece a la categoría correcta.");
  expect(error.statusCode).toBe(400);
  expect(creadosTrasElRechazo).toBe(0);
  const observado = resultado instanceof AppError ? resultado.message : "proyecto creado";
  // DEFECTO: la subcadena 'cal' dentro de 'Calacatta' clasifica erróneamente un piso como material de construcción
  expect(observado).toBe("proyecto creado");
  expect(proyectos.create.mock.calls.length).toBe(1);
});

test("CP-F-PROY-01-07", "Rechaza producto de pisos en proyecto configurado como pintura", async () => {
  // Arrange
  const { proyectos, productos, caso } = montar();
  productos.findById.mockResolvedValue(producto());

  // Act
  const error = await grab(
    caso.execute(datosProyecto({ materialType: "pintura", selectedProductId: "prd_001" }) as any),
  );

  // Assert
  expect(error).toBeInstanceOf(AppError);
  expect(error.message).toBe("Para proyectos de pintura, el producto seleccionado debe ser de la categoría de pinturas.");
  expect(error.statusCode).toBe(400);
  expect(proyectos.create).not.toHaveBeenCalled();
});

test("CP-F-PROY-01-08", "Rechaza vincular pegante en proyecto de madera", async () => {
  // Arrange
  const { proyectos, productos, caso } = montar();
  productos.findById.mockResolvedValue(
    producto({ name: "Pegante Ceramico Gris 25kg", categorySlug: "materiales-construccion" }),
  );

  // Act
  const error = await grab(
    caso.execute(datosProyecto({ materialType: "madera", selectedProductId: "prd_001" }) as any),
  );

  // Assert
  expect(error).toBeInstanceOf(AppError);
  expect(error.message).toBe("Los materiales de construcción (pegante/boquilla) solo son compatibles con proyectos de cerámica o porcelanato.");
  expect(error.statusCode).toBe(400);
  expect(proyectos.create).not.toHaveBeenCalled();
});

test("CP-F-PROY-01-09", "Rechaza pintura en proyecto de madera", async () => {
  // Arrange
  const { proyectos, productos, caso } = montar();
  productos.findById.mockResolvedValue(
    producto({ name: "Esmalte Sintetico Blanco", categorySlug: "pinturas", unit: "galón" }),
  );

  // Act
  const error = await grab(
    caso.execute(datosProyecto({ materialType: "madera", selectedProductId: "prd_001" }) as any),
  );

  // Assert
  expect(error).toBeInstanceOf(AppError);
  expect(error.message).toBe("Para proyectos de revestimiento físico, el producto seleccionado debe ser de la categoría de pisos y cerámicas.");
  expect(error.statusCode).toBe(400);
  expect(proyectos.create).not.toHaveBeenCalled();
});

test("CP-F-PROY-01-10", "Asigna pegante real del catálogo en proyecto de cerámica", async () => {
  // Arrange
  const { productos, caso, guardado } = montar();
  productos.findById.mockResolvedValue(
    producto({
      id: "prd_peg",
      name: "Pegante Ceramico Gris 25kg",
      categorySlug: "materiales-construccion",
      price: 30000,
      unit: "bultos",
    }),
  );

  // Act
  await caso.execute(
    datosProyecto({ materialType: "ceramica", selectedProductId: "prd_peg", area: 20 }) as any,
  );

  // Assert
  const g = guardado();
  const pegante = g.materials.find((m: any) => m.productId === "prd_peg");
  expect(pegante).toBeDefined();
  expect(pegante.quantity).toBe("5 bultos");
  expect(pegante.price).toBe(150000);
  expect(g.materials[0].name).toBe("Cerámica 60x60 cm");
  expect(g.selectedProductId).toBe("prd_peg");
  expect(g.estimatedCost).toBe(g.materials.reduce((s: number, m: any) => s + m.price, 0));
});

test("CP-F-PROY-01-11", "Asigna pintura real del catálogo en proyecto de pintura", async () => {
  // Arrange
  const { productos, caso, guardado } = montar();
  productos.findById.mockResolvedValue(
    producto({
      id: "prd_pin",
      name: "Pintura Vinilo Tipo 1 Blanco",
      categorySlug: "pinturas",
      unit: "galón",
      price: 120000,
    }),
  );

  // Act
  await caso.execute(
    datosProyecto({ materialType: "pintura", selectedProductId: "prd_pin", area: 20 }) as any,
  );

  // Assert
  const g = guardado();
  expect(g.materials[0].name).toBe("Pintura Vinilo Tipo 1 Blanco");
  expect(g.materials[0].productId).toBe("prd_pin");
  expect(g.materials[0].quantity).toContain("galón");
  expect(g.materialType).toBe("pintura");
  expect(g.estimatedCost).toBe(g.materials.reduce((s: number, m: any) => s + m.price, 0));
});

test("CP-F-PROY-01-12", "Asigna producto de pisos del catálogo calculando desperdicio y costo", async () => {
  // Arrange
  const { productos, caso, guardado } = montar();
  productos.findById.mockResolvedValue(producto({ id: "prd_piso", price: 40000, unit: "m²" }));

  // Act
  await caso.execute(
    datosProyecto({ materialType: "ceramica", selectedProductId: "prd_piso", area: 20 }) as any,
  );

  // Assert
  const g = guardado();
  expect(g.materials[0].name).toBe("Piso Ceramico Beige 60x60");
  expect(g.materials[0].quantity).toBe("22 m²");
  expect(g.materials[0].price).toBe(880000);
  expect(g.materials[0].productId).toBe("prd_piso");
  expect(g.selectedProductId).toBe("prd_piso");
  expect(g.estimatedCost).toBe(g.materials.reduce((s: number, m: any) => s + m.price, 0));
});
