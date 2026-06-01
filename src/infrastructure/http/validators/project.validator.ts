import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Nombre del proyecto es requerido").max(200),
  type: z.enum(["PISO", "PARED", "TECHO", "INTEGRAL"], { message: "Tipo debe ser PISO, PARED, TECHO o INTEGRAL" }),
  area: z.number().positive("El área debe ser un número positivo").max(100000),
  length: z.number().positive("Longitud debe ser positiva").optional(),
  width: z.number().positive("Ancho debe ser positivo").optional(),
  height: z.number().positive("Altura debe ser positiva").optional(),
  materialType: z.string().max(100).optional(),
  tileFormat: z.string().max(100).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(["PISO", "PARED", "TECHO", "INTEGRAL"]).optional(),
  area: z.number().positive().max(100000).optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  materialType: z.string().max(100).optional(),
  tileFormat: z.string().max(100).optional(),
  status: z.enum(["EN_PROGRESO", "COMPLETADO", "PAUSADO"]).optional(),
});
