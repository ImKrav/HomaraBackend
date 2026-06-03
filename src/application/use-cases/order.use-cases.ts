// ============================================
// Homara — Orders Use Cases (TS)
// ============================================

import { IOrderRepository } from "../../domain/repositories/order-repository.interface.js";
import { ICartRepository } from "../../domain/repositories/cart-repository.interface.js";
import { IProductRepository } from "../../domain/repositories/product-repository.interface.js";
import { Order, OrderItem } from "../../domain/entities/order.js";
import { Product } from "../../domain/entities/product.js";
import { AppError } from "../../shared/errors/AppError.js";

type ProductWithCategory = Product & {
  category?: {
    name: string;
  };
};

export class ListOrdersUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(filters?: { userId?: string; admin?: boolean }) {
    const orders = await this.orderRepository.findAll(filters);
    return orders.map((o) => ({
      id: o.orderNumber,
      date: o.createdAt?.toISOString().split("T")[0],
      status: o.status.toLowerCase(),
      items: o.items?.length || 0,
      total: o.total,
      customer: o.user ? `${o.user.firstName} ${o.user.lastName}` : "Usuario Desconocido",
    }));
  }
}

export class GetOrderDetailUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(idOrNumber: string) {
    const order = await this.orderRepository.findByIdOrNumber(idOrNumber);
    if (!order) {
      throw new AppError("Pedido no encontrado", 404);
    }

    return {
      id: order.orderNumber,
      status: order.status.toLowerCase(),
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      total: order.total,
      paymentMethod: order.paymentMethod,
      shippingAddress: order.shippingAddress,
      shippingCity: order.shippingCity,
      shippingState: order.shippingState,
      shippingZip: order.shippingZip,
      shippingNotes: order.shippingNotes,
      createdAt: order.createdAt,
      customer: order.user ? {
        name: `${order.user.firstName} ${order.user.lastName}`,
        email: order.user.email,
      } : null,
      items: (order.items || []).map((item) => ({
        id: item.id,
        productName: item.product?.name || "Producto desconocido",
        productImage: item.product?.image || "",
        category: typeof item.product?.category === "object" ? (item.product.category as unknown as { name: string })?.name : (item.product?.category || "General"),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
    };
  }
}

export class CreateOrderUseCase {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly cartRepository: ICartRepository,
    private readonly productRepository: IProductRepository
  ) {}

  async execute(
    userId: string,
    data: {
      paymentMethod: string;
      shippingAddress?: string;
      shippingCity?: string;
      shippingState?: string;
      shippingZip?: string;
      shippingNotes?: string;
    }
  ) {
    // 1. Obtener carrito del usuario
    const cart = await this.cartRepository.findByUserId(userId);
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new AppError("El carrito está vacío", 400);
    }

    // 2. Calcular subtotales
    const subtotal = cart.items.reduce(
      (sum, item) => sum + (item.product?.price || 0) * item.quantity,
      0
    );
    const shippingCost = subtotal > 500000 ? 0 : 25000;
    const total = subtotal + shippingCost;

    // 3. Crear items de la orden
    const items = cart.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.product?.price || 0,
      total: (item.product?.price || 0) * item.quantity,
    }));

    // 4. Crear orden transaccionalmente (la persistencia real se maneja en el Adaptador de Infraestructura)
    // El repositorio se encargará de realizar el checkout y vaciar el carrito de forma atómica
    const order = await this.orderRepository.create({
      status: "PENDIENTE",
      subtotal,
      shippingCost,
      total,
      paymentMethod: data.paymentMethod,
      shippingAddress: data.shippingAddress ?? null,
      shippingCity: data.shippingCity ?? null,
      shippingState: data.shippingState ?? null,
      shippingZip: data.shippingZip ?? null,
      shippingNotes: data.shippingNotes ?? null,
      userId,
      items,
    });

    return order;
  }
}

export class UpdateOrderStatusUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(id: string, status: string) {
    const validStatuses = ["PENDIENTE", "PROCESANDO", "ENVIADO", "ENTREGADO", "CANCELADO"];
    const upperStatus = status?.toUpperCase();

    if (!validStatuses.includes(upperStatus)) {
      throw new AppError(
        `Estado inválido. Valores válidos: ${validStatuses.join(", ")}`,
        400
      );
    }

    return await this.orderRepository.updateStatus(id, upperStatus as "PENDIENTE" | "PROCESANDO" | "ENVIADO" | "ENTREGADO" | "CANCELADO");
  }
}
