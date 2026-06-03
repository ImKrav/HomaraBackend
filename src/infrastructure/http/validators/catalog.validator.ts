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
