import { z } from "zod";

// Un dato de envío formado solo por espacios no es un dato (DEF-03 / ESC27).
const shippingField = (max: number, label: string) =>
  z.string().trim().min(1, `${label} no puede estar vacío`).max(max).optional();

export const createOrderSchema = z.object({
  paymentMethod: z.string().trim().min(1, "Método de pago es requerido").max(50),
  shippingAddress: shippingField(255, "La dirección"),
  shippingCity: shippingField(100, "La ciudad"),
  shippingState: shippingField(100, "El departamento"),
  shippingZip: z.string().trim().max(20).optional(),
  shippingNotes: z.string().trim().max(500).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["PENDIENTE", "PROCESANDO", "ENVIADO", "ENTREGADO", "CANCELADO"], { message: "Estado debe ser PENDIENTE, PROCESANDO, ENVIADO, ENTREGADO o CANCELADO" }),
});
