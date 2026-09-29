// F-CAT-03 · Publicar una reseña
// Unidad: CreateProductReviewUseCase.execute()  (POST /api/v1/products/:id/reviews)

import { test, grab, expect } from "./harness.js";
import { fakeProductos, fakeResenas, producto, resena, datosResena } from "./helpers.js";
import { CreateProductReviewUseCase } from "../src/application/use-cases/catalog.use-cases.js";
import { createReviewSchema } from "../src/infrastructure/http/validators/catalog.validator.js";
import { AppError } from "../src/shared/errors/AppError.js";

function montar() {
  const productos = fakeProductos();
  const resenas = fakeResenas();
  const caso = new CreateProductReviewUseCase(productos as any, resenas as any);
  return { productos, resenas, caso };
}

test("CP-F-CAT-03-01", "Rechaza calificación fuera del rango 1-5 o con decimales en validación de esquema", () => {
  // Arrange
  const { productos, resenas } = montar();
  const cero = createReviewSchema.safeParse(datosResena({ rating: 0 }));
  const seis = createReviewSchema.safeParse(datosResena({ rating: 6 }));

  // Act
  const decimal = createReviewSchema.safeParse(datosResena({ rating: 4.5 }));

  // Assert
  expect(cero.success).toBe(false);
  expect(seis.success).toBe(false);
  expect(decimal.success).toBe(false);
  if (!cero.success) expect(cero.error.issues[0].message).toBe("La calificación mínima es 1 estrella.");
  if (!seis.success) expect(seis.error.issues[0].message).toBe("La calificación máxima es 5 estrellas.");
  if (!decimal.success) expect(decimal.error.issues[0].message).toBe("La calificación debe ser un número entero.");
  expect(productos.findById).not.toHaveBeenCalled();
  expect(resenas.create).not.toHaveBeenCalled();
});

test("CP-F-CAT-03-02", "Retorna 404 si el producto a calificar no existe", async () => {
  // Arrange
  const { productos, resenas, caso } = montar();
  productos.findById.mockResolvedValue(null);

  // Act
  const error = await grab(caso.execute("usr_001", "prd_inexistente", 5, "Muy bueno"));

  // Assert
  expect(error).toBeInstanceOf(AppError);
  expect(error.statusCode).toBe(404);
  expect(error.message).toBe("Producto no encontrado");
  expect(resenas.findByUserAndProduct).not.toHaveBeenCalled();
  expect(resenas.create).not.toHaveBeenCalled();
  expect(productos.updateProductRating).not.toHaveBeenCalled();
});

test("CP-F-CAT-03-03", "Rechaza si el usuario ya había publicado una reseña previa para el producto", async () => {
  // Arrange
  const { productos, resenas, caso } = montar();
  productos.findById.mockResolvedValue(producto({ id: "prd_001" }));
  resenas.findByUserAndProduct.mockResolvedValue(resena());

  // Act
  const error = await grab(caso.execute("usr_001", "prd_001", 4, "Otra opinión"));

  // Assert
  expect(error).toBeInstanceOf(AppError);
  expect(error.statusCode).toBe(400);
  expect(error.message).toBe("Ya has calificado este producto");
  expect(resenas.findByUserAndProduct).toHaveBeenCalledWith("usr_001", "prd_001");
  expect(resenas.create).not.toHaveBeenCalled();
  expect(resenas.getAverageRatingAndCount).not.toHaveBeenCalled();
  expect(productos.updateProductRating).not.toHaveBeenCalled();
});

test("CP-F-CAT-03-04", "Guarda la reseña y actualiza el promedio de calificación del producto", async () => {
  // Arrange
  const { productos, resenas, caso } = montar();
  productos.findById.mockResolvedValue(producto({ id: "prd_001" }));
  resenas.findByUserAndProduct.mockResolvedValue(null);
  resenas.create.mockImplementation(async (d: any) => resena({ ...d, id: "rev_nueva" }));
  resenas.getAverageRatingAndCount.mockResolvedValue({ avg: 4.6, count: 13 });

  // Act
  const salida = await caso.execute("usr_001", "prd_001", 5, "Excelente producto.");

  // Assert
  expect(resenas.create).toHaveBeenCalledWith({
      userId: "usr_001",
      productId: "prd_001",
      rating: 5,
      comment: "Excelente producto.",
    });
  expect(resenas.getAverageRatingAndCount).toHaveBeenCalledWith("prd_001");
  expect(productos.updateProductRating).toHaveBeenCalledWith("prd_001", 4.6, 13);
  expect(salida.id).toBe("rev_nueva");
  expect(salida.rating).toBe(5);
});

test("CP-F-CAT-03-04b", "Valida límites de calificación (1 y 5) y longitud máxima de comentario (500)", async () => {
  // Arrange
  const { productos, resenas, caso } = montar();
  productos.findById.mockResolvedValue(producto({ id: "prd_001" }));
  resenas.findByUserAndProduct.mockResolvedValue(null);
  resenas.create.mockImplementation(async (d: any) => resena({ ...d, id: "rev_sin_texto" }));
  resenas.getAverageRatingAndCount.mockResolvedValue({ avg: 1, count: 1 });

  // Act
  const minimo = createReviewSchema.safeParse(datosResena({ rating: 1 }));
  const maximo = createReviewSchema.safeParse(datosResena({ rating: 5 }));
  const comentarioEnElLimite = createReviewSchema.safeParse(datosResena({ comment: "x".repeat(500) }));
  const comentarioExcedido = createReviewSchema.safeParse(datosResena({ comment: "x".repeat(501) }));
  await caso.execute("usr_001", "prd_001", 1);
  const creada = resenas.create.mock.calls[0][0];

  // Assert
  expect(minimo.success).toBe(true);
  expect(maximo.success).toBe(true);
  expect(comentarioEnElLimite.success).toBe(true);
  expect(comentarioExcedido.success).toBe(false);
  if (!comentarioExcedido.success) {
    expect(comentarioExcedido.error.issues[0].message).toBe("El comentario no puede exceder los 500 caracteres.");
  }
  expect(creada.comment).toBe(undefined);
  expect(productos.updateProductRating).toHaveBeenCalledWith("prd_001", 1, 1);
});

// Defecto abierto #8 (ver la tabla en tests/README.md): se espera que falle.
test.fails("CP-F-CAT-03-04c", "Rechaza calificación fuera de rango directamente en el caso de uso", async () => {
  // Arrange
  const { productos, resenas, caso } = montar();
  productos.findById.mockResolvedValue(producto({ id: "prd_001" }));
  resenas.findByUserAndProduct.mockResolvedValue(null);
  resenas.create.mockImplementation(async (d: any) => resena({ ...d, id: "rev_fuera_rango" }));
  resenas.getAverageRatingAndCount.mockResolvedValue({ avg: 99, count: 1 });

  // Act
  const error = await caso.execute("usr_001", "prd_001", 99).then((r: any) => r, (e: any) => e);

  // Assert
  // DEFECTO: CreateProductReviewUseCase.execute() no valida el rango de rating y acepta 99
  expect(error).toBeInstanceOf(AppError);
  expect(error.statusCode).toBe(400);
  // DEFECTO: la reseña fuera de rango se persiste en lugar de rechazarse
  expect(resenas.create).not.toHaveBeenCalled();
  // DEFECTO: el promedio del producto queda contaminado con la calificación 99
  expect(productos.updateProductRating).not.toHaveBeenCalled();
});
