// F-CAT-03 · Publicar una reseña
// Unidad: CreateProductReviewUseCase.execute()  (POST /api/v1/products/:id/reviews)

import { test, is, ok, eq, grab } from "./harness.js";
import { fakeProductos, fakeResenas, producto, resena, datosResena, arg, calledWith, neverCalled } from "./helpers.js";
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
  const { productos, resenas } = montar();
  const cero = createReviewSchema.safeParse(datosResena({ rating: 0 }));
  const seis = createReviewSchema.safeParse(datosResena({ rating: 6 }));
  const decimal = createReviewSchema.safeParse(datosResena({ rating: 4.5 }));

  is(cero.success, false);
  is(seis.success, false);
  is(decimal.success, false);
  if (!cero.success) is(cero.error.issues[0].message, "La calificación mínima es 1 estrella.");
  if (!seis.success) is(seis.error.issues[0].message, "La calificación máxima es 5 estrellas.");
  if (!decimal.success) is(decimal.error.issues[0].message, "La calificación debe ser un número entero.");
  ok(neverCalled(productos.findById));
  ok(neverCalled(resenas.create));
});

test("CP-F-CAT-03-02", "Retorna 404 si el producto a calificar no existe", async () => {
  const { productos, resenas, caso } = montar();
  productos.findById.resolves(null);

  const error = await grab(caso.execute("usr_001", "prd_inexistente", 5, "Muy bueno"));
  ok(error instanceof AppError);
  is(error.statusCode, 404);
  is(error.message, "Producto no encontrado");
  ok(neverCalled(resenas.findByUserAndProduct));
  ok(neverCalled(resenas.create));
  ok(neverCalled(productos.updateProductRating));
});

test("CP-F-CAT-03-03", "Rechaza si el usuario ya había publicado una reseña previa para el producto", async () => {
  const { productos, resenas, caso } = montar();
  productos.findById.resolves(producto({ id: "prd_001" }));
  resenas.findByUserAndProduct.resolves(resena());

  const error = await grab(caso.execute("usr_001", "prd_001", 4, "Otra opinión"));
  ok(error instanceof AppError);
  is(error.statusCode, 400);
  is(error.message, "Ya has calificado este producto");
  ok(calledWith(resenas.findByUserAndProduct, "usr_001", "prd_001"));
  ok(neverCalled(resenas.create));
  ok(neverCalled(resenas.getAverageRatingAndCount));
  ok(neverCalled(productos.updateProductRating));
});

test("CP-F-CAT-03-04", "Guarda la reseña y actualiza el promedio de calificación del producto", async () => {
  const { productos, resenas, caso } = montar();
  productos.findById.resolves(producto({ id: "prd_001" }));
  resenas.findByUserAndProduct.resolves(null);
  resenas.create.does(async (d: any) => resena({ ...d, id: "rev_nueva" }));
  resenas.getAverageRatingAndCount.resolves({ avg: 4.6, count: 13 });

  const salida = await caso.execute("usr_001", "prd_001", 5, "Excelente producto.");

  ok(
    calledWith(resenas.create, {
      userId: "usr_001",
      productId: "prd_001",
      rating: 5,
      comment: "Excelente producto.",
    }),
  );
  ok(calledWith(resenas.getAverageRatingAndCount, "prd_001"));
  ok(calledWith(productos.updateProductRating, "prd_001", 4.6, 13));
  is(salida.id, "rev_nueva");
  is(salida.rating, 5);
});

test("CP-F-CAT-03-04b", "Valida límites de calificación (1 y 5) y longitud máxima de comentario (500)", async () => {
  is(createReviewSchema.safeParse(datosResena({ rating: 1 })).success, true);
  is(createReviewSchema.safeParse(datosResena({ rating: 5 })).success, true);
  is(createReviewSchema.safeParse(datosResena({ comment: "x".repeat(500) })).success, true);

  const excedido = createReviewSchema.safeParse(datosResena({ comment: "x".repeat(501) }));
  is(excedido.success, false);
  if (!excedido.success) {
    is(excedido.error.issues[0].message, "El comentario no puede exceder los 500 caracteres.");
  }

  const { productos, resenas, caso } = montar();
  productos.findById.resolves(producto({ id: "prd_001" }));
  resenas.findByUserAndProduct.resolves(null);
  resenas.create.does(async (d: any) => resena({ ...d, id: "rev_sin_texto" }));
  resenas.getAverageRatingAndCount.resolves({ avg: 1, count: 1 });

  await caso.execute("usr_001", "prd_001", 1);

  is(arg(resenas.create).comment, undefined);
  ok(calledWith(productos.updateProductRating, "prd_001", 1, 1));
});

test("CP-F-CAT-03-04c", "Rechaza calificación fuera de rango directamente en el caso de uso", async () => {
  const { productos, resenas, caso } = montar();
  productos.findById.resolves(producto({ id: "prd_001" }));
  resenas.findByUserAndProduct.resolves(null);
  resenas.create.does(async (d: any) => resena({ ...d, id: "rev_fuera_rango" }));
  resenas.getAverageRatingAndCount.resolves({ avg: 99, count: 1 });

  const error = await caso.execute("usr_001", "prd_001", 99).then((r: any) => r, (e: any) => e);

  // DEFECTO: CreateProductReviewUseCase.execute() no valida el rango de rating y acepta 99
  ok(error instanceof AppError);
  is(error.statusCode, 400);
  // DEFECTO: la reseña fuera de rango se persiste en lugar de rechazarse
  ok(neverCalled(resenas.create));
  // DEFECTO: el promedio del producto queda contaminado con la calificación 99
  ok(neverCalled(productos.updateProductRating));
});
