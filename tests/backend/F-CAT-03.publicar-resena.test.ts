// ============================================================================
// F-CAT-03 · Publicar una reseña — Backend
// Grafo:   11_F-CAT-03_BACKEND_Publicar_una_resena.drawio
// Unidad:  CreateProductReviewUseCase.execute()
//          · POST /api/v1/products/:id/reviews  (requireAuth + validateZod)
// Métrica: N=17  A=19  P=3  →  V(G) = 19 − 17 + 2 = 4
// Cobertura de ruta básica: 4 caminos independientes → 4 casos de prueba
// Trazabilidad: RF30 · HU13 · ESC30 (CP-209 · DEF-001) · BE-CAT-03
// ============================================================================
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
} from "../_ayudas.js";

describe("F-CAT-03 · Publicar una reseña", () => {
  let productos: ReturnType<typeof mockProductRepository>;
  let resenas: ReturnType<typeof mockReviewRepository>;
  let caso: CreateProductReviewUseCase;

  beforeEach(() => {
    productos = mockProductRepository();
    resenas = mockReviewRepository();
    caso = new CreateProductReviewUseCase(productos, resenas);
  });

  it("CP-F-CAT-03-01 · camino 1,2,3,6,F · Paso 2 = NO → una calificación fuera de rango se rechaza antes de tocar la base de datos", () => {
    // El paso 2 se evalúa en validateZod(createReviewSchema), antes del caso de uso.
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
    // Nodos 3 y 6: el flujo termina en el errorHandler; los repositorios nunca se consultan.
    expect(productos.findById).not.toHaveBeenCalled();
    expect(resenas.create).not.toHaveBeenCalled();
  });

  it("CP-F-CAT-03-02 · camino 1,2,4,5,7,10,F · Paso 2 = SI, Paso 5 = NO → el producto calificado no existe", async () => {
    productos.findById.mockResolvedValue(null);              // fuerza Paso 5 = NO

    // Nodo 7: AppError 404; el nodo 10 lo entrega con su código HTTP.
    const error = await caso.execute("usr_001", "prd_inexistente", 5, "Muy bueno").catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Producto no encontrado");
    // Salida esperada: no se revisa el historial ni se guarda nada.
    expect(resenas.findByUserAndProduct).not.toHaveBeenCalled();
    expect(resenas.create).not.toHaveBeenCalled();
    expect(productos.updateProductRating).not.toHaveBeenCalled();
  });

  it("CP-F-CAT-03-03 · camino 1,2,4,5,8,9,11,14,F · Paso 2 = SI, Paso 5 = SI, Paso 9 = SI → el cliente ya había calificado este producto", async () => {
    productos.findById.mockResolvedValue(producto({ id: "prd_001" }));
    resenas.findByUserAndProduct.mockResolvedValue(resena());   // fuerza Paso 9 = SI

    // Nodo 11: AppError 400; el nodo 14 lo entrega con su código HTTP.
    const error = await caso.execute("usr_001", "prd_001", 4, "Otra opinión").catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("Ya has calificado este producto");
    // Nodo 8: se consultó el historial con el par usuario/producto correcto.
    expect(resenas.findByUserAndProduct).toHaveBeenCalledWith("usr_001", "prd_001");
    // Salida esperada: la reseña no se duplica ni se recalcula el promedio.
    expect(resenas.create).not.toHaveBeenCalled();
    expect(resenas.getAverageRatingAndCount).not.toHaveBeenCalled();
    expect(productos.updateProductRating).not.toHaveBeenCalled();
  });

  it("CP-F-CAT-03-04 · camino 1,2,4,5,8,9,12,13,15,16,F · Paso 2 = SI, Paso 5 = SI, Paso 9 = NO → la reseña se publica y el promedio se recalcula", async () => {
    productos.findById.mockResolvedValue(producto({ id: "prd_001" }));
    resenas.findByUserAndProduct.mockResolvedValue(null);        // fuerza Paso 9 = NO
    resenas.create.mockImplementation(async (d: any) => resena({ ...d, id: "rev_nueva" }));
    resenas.getAverageRatingAndCount.mockResolvedValue({ avg: 4.6, count: 13 });

    const salida = await caso.execute("usr_001", "prd_001", 5, "Excelente producto.");

    // Nodo 12: se guarda con el autor, el producto, la calificación y el comentario.
    expect(resenas.create).toHaveBeenCalledWith({
      userId: "usr_001",
      productId: "prd_001",
      rating: 5,
      comment: "Excelente producto.",
    });
    // Nodo 13: se recalcula el promedio y el número de reseñas del producto.
    expect(resenas.getAverageRatingAndCount).toHaveBeenCalledWith("prd_001");
    // Nodo 15: el producto queda actualizado con el promedio y el conteo nuevos.
    expect(productos.updateProductRating).toHaveBeenCalledWith("prd_001", 4.6, 13);
    // Nodo 16: se confirma la reseña creada.
    expect(salida.id).toBe("rev_nueva");
    expect(salida.rating).toBe(5);
  });

  it("CP-F-CAT-03-04b · valores límite sobre el camino exitoso: 1 y 5 estrellas y comentario de 500 caracteres", async () => {
    // Complementa el nodo 2: los extremos válidos del rango sí superan la validación.
    expect(createReviewSchema.safeParse(datosResena({ rating: 1 })).success).toBe(true);
    expect(createReviewSchema.safeParse(datosResena({ rating: 5 })).success).toBe(true);
    // DEF-001: el comentario ya está acotado a 500 caracteres en el servidor.
    expect(createReviewSchema.safeParse(datosResena({ comment: "x".repeat(500) })).success).toBe(true);
    const excedido = createReviewSchema.safeParse(datosResena({ comment: "x".repeat(501) }));
    expect(excedido.success).toBe(false);
    if (!excedido.success) {
      expect(excedido.error.issues[0].message).toBe(
        "El comentario no puede exceder los 500 caracteres."
      );
    }
    // El comentario es opcional: la reseña puede publicarse solo con la calificación.
    productos.findById.mockResolvedValue(producto({ id: "prd_001" }));
    resenas.findByUserAndProduct.mockResolvedValue(null);
    resenas.create.mockImplementation(async (d: any) => resena({ ...d, id: "rev_sin_texto" }));
    resenas.getAverageRatingAndCount.mockResolvedValue({ avg: 1, count: 1 });

    await caso.execute("usr_001", "prd_001", 1);

    expect(resenas.create.mock.calls[0][0].comment).toBeUndefined();
    expect(productos.updateProductRating).toHaveBeenCalledWith("prd_001", 1, 1);
  });

  it("CP-F-CAT-03-04c · una calificación fuera del rango 1–5 debe rechazarse en el caso de uso", async () => {
    // Regla de negocio (nodo 2 del grafo): la calificación es un entero de 1 a 5.
    // El caso de uso es la frontera que protege la integridad del promedio del
    // producto, así que debe hacer valer la regla por sí mismo y no delegarla
    // por completo al middleware validateZod(createReviewSchema) de la ruta HTTP.
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
