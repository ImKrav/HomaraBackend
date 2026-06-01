import { z } from "zod";

export const createOrderSchema = z.object({
  paymentMethod: z.string().min(1, "Método de pago es requerido").max(50),
  shippingAddress: z.string().max(255).optional(),
  shippingCity: z.string().max(100).optional(),
  shippingState: z.string().max(100).optional(),
  shippingZip: z.string().max(20).optional(),
  shippingNotes: z.string().max(500).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"], { message: "Estado debe ser PENDING, CONFIRMED, SHIPPED, DELIVERED o CANCELLED" }),
});
