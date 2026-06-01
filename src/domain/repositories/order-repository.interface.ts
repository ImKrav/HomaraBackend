import { Order, OrderItem } from "../entities/order.js";

export interface IOrderRepository {
  findAll(filters?: { userId?: string; admin?: boolean }): Promise<Order[]>;
  findByIdOrNumber(idOrNumber: string): Promise<Order | null>;
  create(
    order: Omit<Order, "id" | "createdAt" | "updatedAt" | "items" | "orderNumber" | "user"> & {
      items: Omit<OrderItem, "id" | "orderId" | "product">[];
    }
  ): Promise<Order>;
  updateStatus(id: string, status: "PENDIENTE" | "PROCESANDO" | "ENVIADO" | "ENTREGADO" | "CANCELADO"): Promise<Order>;
  countByYear(year: number): Promise<number>;
}
