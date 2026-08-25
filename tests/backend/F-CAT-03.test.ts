import { describe, it, expect, beforeEach } from "vitest";
import { CreateProductReviewUseCase } from "../../src/application/use-cases/catalog.use-cases.js";
import { createReviewSchema } from "../../src/infrastructure/http/validators/catalog.validator.js";
import { AppError } from "../../src/shared/errors/AppError.js";
import {
  mockProductRepository,
  mockReviewRepository,
  producto,
  resena,
  datosResena,
} from "../test-helpers.js";

describe("F-CAT-03 · Publicar una reseña", () => {
  let productos: ReturnType<typeof mockProductRepository>;
  let resenas: ReturnType<typeof mockReviewRepository>;
  let caso: CreateProductReviewUseCase;

  beforeEach(() => {
    productos = mockProductRepository();
    resenas = mockReviewRepository();
    caso = new CreateProductReviewUseCase(productos, resenas);
  });

  it("CP-F-CAT-03-01: Rechaza calificación fuera del rango 1-5 o con decimales en validación de esquema", () => {
    const cero = createReviewSchema.safeParse(datosResena({ rating: 0 }));
    const seis = createReviewSchema.safeParse(datosResena({ rating: 6 }));
    const decimal = createReviewSchema.safeParse(datosResena({ rating: 4.5 }));

    expect(cero.success).toBe(false);
    expect(seis.success).toBe(false);
    expect(decimal.success).toBe(false);
    if (!cero.success) {
      expect(cero.error.issues[0].message).toBe("La calificación mínima es 1 estrella.");
    }
    if (!seis.success) {
      expect(seis.error.issues[0].message).toBe("La calificación máxima es 5 estrellas.");
    }
    if (!decimal.success) {
      expect(decimal.error.issues[0].message).toBe("La calificación debe ser un número entero.");
    }
    expect(productos.findById).not.toHaveBeenCalled();
    expect(resenas.create).not.toHaveBeenCalled();
  });

  it("CP-F-CAT-03-02: Retorna 404 si el producto a calificar no existe", async () => {
    productos.findById.mockResolvedValue(null);

    const error = await caso.execute("usr_001", "prd_inexistente", 5, "Muy bueno").catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Producto no encontrado");
    expect(resenas.findByUserAndProduct).not.toHaveBeenCalled();
    expect(resenas.create).not.toHaveBeenCalled();
    expect(productos.updateProductRating).not.toHaveBeenCalled();
  });

  it("CP-F-CAT-03-03: Rechaza si el usuario ya había publicado una reseña previa para el producto", async () => {
    productos.findById.mockResolvedValue(producto({ id: "prd_001" }));
    resenas.findByUserAndProduct.mockResolvedValue(resena());

    const error = await caso.execute("usr_001", "prd_001", 4, "Otra opinión").catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("Ya has calificado este producto");
    expect(resenas.findByUserAndProduct).toHaveBeenCalledWith("usr_001", "prd_001");
    expect(resenas.create).not.toHaveBeenCalled();
    expect(resenas.getAverageRatingAndCount).not.toHaveBeenCalled();
    expect(productos.updateProductRating).not.toHaveBeenCalled();
  });

  it("CP-F-CAT-03-04: Guarda la reseña y actualiza el promedio de calificación del producto", async () => {
    productos.findById.mockResolvedValue(producto({ id: "prd_001" }));
    resenas.findByUserAndProduct.mockResolvedValue(null);
    resenas.create.mockImplementation(async (d: any) => resena({ ...d, id: "rev_nueva" }));
    resenas.getAverageRatingAndCount.mockResolvedValue({ avg: 4.6, count: 13 });

    const salida = await caso.execute("usr_001", "prd_001", 5, "Excelente producto.");

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

  it("CP-F-CAT-03-04b: Valida límites de calificación (1 y 5) y longitud máxima de comentario (500)", async () => {
    expect(createReviewSchema.safeParse(datosResena({ rating: 1 })).success).toBe(true);
    expect(createReviewSchema.safeParse(datosResena({ rating: 5 })).success).toBe(true);
    expect(createReviewSchema.safeParse(datosResena({ comment: "x".repeat(500) })).success).toBe(true);

    const excedido = createReviewSchema.safeParse(datosResena({ comment: "x".repeat(501) }));
    expect(excedido.success).toBe(false);
    if (!excedido.success) {
      expect(excedido.error.issues[0].message).toBe(
        "El comentario no puede exceder los 500 caracteres."
      );
    }

    productos.findById.mockResolvedValue(producto({ id: "prd_001" }));
    resenas.findByUserAndProduct.mockResolvedValue(null);
    resenas.create.mockImplementation(async (d: any) => resena({ ...d, id: "rev_sin_texto" }));
    resenas.getAverageRatingAndCount.mockResolvedValue({ avg: 1, count: 1 });

    await caso.execute("usr_001", "prd_001", 1);

    expect(resenas.create.mock.calls[0][0].comment).toBeUndefined();
    expect(productos.updateProductRating).toHaveBeenCalledWith("prd_001", 1, 1);
  });

  it("CP-F-CAT-03-04c: Rechaza calificación fuera de rango directamente en el caso de uso", async () => {
    productos.findById.mockResolvedValue(producto({ id: "prd_001" }));
    resenas.findByUserAndProduct.mockResolvedValue(null);
    resenas.create.mockImplementation(async (d: any) => resena({ ...d, id: "rev_fuera_rango" }));
    resenas.getAverageRatingAndCount.mockResolvedValue({ avg: 99, count: 1 });

    const error = await caso.execute("usr_001", "prd_001", 99).catch((e) => e);

    // DEFECTO: CreateProductReviewUseCase.execute() no valida el rango de rating y acepta 99
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    // DEFECTO: la reseña fuera de rango se persiste en lugar de rechazarse
    expect(resenas.create).not.toHaveBeenCalled();
    // DEFECTO: el promedio del producto queda contaminado con la calificación 99
    expect(productos.updateProductRating).not.toHaveBeenCalled();
  });
});
