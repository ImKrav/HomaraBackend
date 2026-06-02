import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Nombre del proyecto es requerido").max(200),
  type: z.enum(["PISO", "PARED", "TECHO", "INTEGRAL"], { message: "Tipo debe ser PISO, PARED, TECHO o INTEGRAL" }),
  area: z.number().positive("El área debe ser un número positivo").max(100000),
  length: z.number().positive("Longitud debe ser positiva").optional().nullable(),
  width: z.number().positive("Ancho debe ser positivo").optional().nullable(),
  height: z.number().positive("Altura debe ser positiva").optional().nullable(),
  materialType: z.string().max(100).optional().nullable(),
  tileFormat: z.string().max(100).optional().nullable(),
  
  // Nuevos campos de personalización opcionales
  wastePercent: z.number().min(0).max(100).optional().nullable(),
  layingPattern: z.string().max(100).optional().nullable(),
  deductDoors: z.number().nonnegative().optional().nullable(),
  deductWindows: z.number().nonnegative().optional().nullable(),
  customSubtractions: z.number().nonnegative().optional().nullable(),
  includeAdhesive: z.boolean().optional().nullable(),
  includeGrout: z.boolean().optional().nullable(),
  includeSpacers: z.boolean().optional().nullable(),
  includeTools: z.boolean().optional().nullable(),
  selectedProductId: z.string().optional().nullable(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, "Nombre del proyecto es requerido").max(200).optional(),
  type: z.enum(["PISO", "PARED", "TECHO", "INTEGRAL"], { message: "Tipo debe ser PISO, PARED, TECHO o INTEGRAL" }).optional(),
  area: z.number().positive("El área debe ser un número positivo").max(100000).optional(),
  length: z.number().positive("Longitud debe ser positiva").optional().nullable(),
  width: z.number().positive("Ancho debe ser positivo").optional().nullable(),
  height: z.number().positive("Altura debe ser positiva").optional().nullable(),
  materialType: z.string().max(100).optional().nullable(),
  tileFormat: z.string().max(100).optional().nullable(),
  status: z.enum(["EN_PROGRESO", "COMPLETADO", "PAUSADO"], { message: "Estado debe ser EN_PROGRESO, COMPLETADO o PAUSADO" }).optional(),
  
  // Nuevos campos de personalización opcionales
  wastePercent: z.number().min(0).max(100).optional().nullable(),
  layingPattern: z.string().max(100).optional().nullable(),
  deductDoors: z.number().nonnegative().optional().nullable(),
  deductWindows: z.number().nonnegative().optional().nullable(),
  customSubtractions: z.number().nonnegative().optional().nullable(),
  includeAdhesive: z.boolean().optional().nullable(),
  includeGrout: z.boolean().optional().nullable(),
  includeSpacers: z.boolean().optional().nullable(),
  includeTools: z.boolean().optional().nullable(),
  selectedProductId: z.string().optional().nullable(),
});
