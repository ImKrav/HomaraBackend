import { z } from "zod";

export const createReviewSchema = z.object({
  rating: z
    .number({ message: "La calificación es obligatoria." })
    .int({ message: "La calificación debe ser un número entero." })
    .min(1, { message: "La calificación mínima es 1 estrella." })
    .max(5, { message: "La calificación máxima es 5 estrellas." }),
  comment: z
    .string()
    .max(500, { message: "El comentario no puede exceder los 500 caracteres." })
    .optional()
    .nullable(),
});

export const createProductSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio y no puede estar vacío."),
  description: z.string().min(1, "La descripción es obligatoria y no puede estar vacía."),
  price: z.number().int().nonnegative("El precio no puede ser negativo."),
  originalPrice: z.number().int().nonnegative().nullable().optional(),
  image: z.string().optional(),
  stockQuantity: z.number().int().nonnegative("El stock no puede ser negativo."),
  unit: z.string().min(1, "La unidad es obligatoria."),
  categoryId: z.string().min(1, "La categoría es obligatoria."),
  tags: z.array(z.string()).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  price: z.number().int().nonnegative().optional(),
  originalPrice: z.number().int().nonnegative().nullable().optional(),
  image: z.string().optional(),
  stockQuantity: z.number().int().nonnegative().optional(),
  unit: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});
