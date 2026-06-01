import { IOrderRepository } from "../../../domain/repositories/order-repository.interface.js";
import { Order, OrderItem } from "../../../domain/entities/order.js";
import { Product } from "../../../domain/entities/product.js";
import { prisma } from "../prisma-client.js";

export class PrismaOrderRepository implements IOrderRepository {
  async findAll(filters?: { userId?: string; admin?: boolean }): Promise<Order[]> {
    const userId = filters?.userId;
    const isAdmin = filters?.admin === true;

    const where = isAdmin ? {} : { userId };

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true } },
        items: true
      },
      orderBy: { createdAt: "desc" }
    });

    return orders.map((o: any) => new Order(
      o.id,
      o.orderNumber,
      o.status as any,
      o.subtotal,
      o.shippingCost,
      o.total,
      o.paymentMethod,
      o.shippingAddress,
      o.shippingCity,
      o.shippingState,
      o.shippingZip,
      o.shippingNotes,
      o.userId,
      o.createdAt,
      o.updatedAt,
      o.items.map((item: any) => new OrderItem(item.id, item.quantity, item.unitPrice, item.total, item.orderId, item.productId)),
      { firstName: o.user.firstName, lastName: o.user.lastName }
    ));
  }

  async findByIdOrNumber(idOrNumber: string): Promise<Order | null> {
    const o = await prisma.order.findFirst({
      where: {
        OR: [
          { id: idOrNumber },
          { orderNumber: idOrNumber }
        ]
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        items: {
          include: {
            product: { include: { category: true } }
          }
        }
      }
    });

    if (!o) return null;

    return new Order(
      o.id,
      o.orderNumber,
      o.status as any,
      o.subtotal,
      o.shippingCost,
      o.total,
      o.paymentMethod,
      o.shippingAddress,
      o.shippingCity,
      o.shippingState,
      o.shippingZip,
      o.shippingNotes,
      o.userId,
      o.createdAt,
      o.updatedAt,
      o.items.map((item: any) => new OrderItem(
        item.id,
        item.quantity,
        item.unitPrice,
        item.total,
        item.orderId,
        item.productId,
        new Product(
          item.product.id,
          item.product.name,
          item.product.description,
          item.product.price,
          item.product.originalPrice,
          item.product.image,
          item.product.rating,
          item.product.reviewCount,
          item.product.inStock,
          item.product.stockQuantity,
          item.product.unit,
          item.product.categoryId,
          item.product.createdAt,
          item.product.updatedAt
        )
      )),
      { firstName: o.user.firstName, lastName: o.user.lastName, email: o.user.email }
    );
  }

  async create(data: Omit<Order, "id" | "createdAt" | "updatedAt" | "items" | "orderNumber" | "user"> & { items: Omit<OrderItem, "id" | "orderId" | "product">[] }): Promise<Order> {
    const year = new Date().getFullYear();
    const count = await prisma.order.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`)
        }
      }
    });
    const orderNumber = `ORD-${year}-${String(count + 1).padStart(3, "0")}`;

    // Ejecutar transaccionalmente el checkout completo
    const createdOrder = await prisma.$transaction(async (tx: any) => {
      // 1. Crear Orden
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: data.userId,
          subtotal: data.subtotal,
          shippingCost: data.shippingCost,
          total: data.total,
          paymentMethod: data.paymentMethod,
          shippingAddress: data.shippingAddress,
          shippingCity: data.shippingCity,
          shippingState: data.shippingState,
          shippingZip: data.shippingZip,
          shippingNotes: data.shippingNotes,
          items: {
            create: data.items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total
            }))
          }
        },
        include: {
          items: true,
          user: { select: { firstName: true, lastName: true } }
        }
      });

      // 2. Decrementar stock e inStock de productos
      for (const item of data.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (prod) {
          const newQty = Math.max(0, prod.stockQuantity - item.quantity);
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: newQty,
              inStock: newQty > 0
            }
          });
        }
      }

      // 3. Vaciar carrito del usuario
      const cart = await tx.cart.findUnique({ where: { userId: data.userId } });
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      }

      return order;
    });

    return new Order(
      createdOrder.id,
      createdOrder.orderNumber,
      createdOrder.status as any,
      createdOrder.subtotal,
      createdOrder.shippingCost,
      createdOrder.total,
      createdOrder.paymentMethod,
      createdOrder.shippingAddress,
      createdOrder.shippingCity,
      createdOrder.shippingState,
      createdOrder.shippingZip,
      createdOrder.shippingNotes,
      createdOrder.userId,
      createdOrder.createdAt,
      createdOrder.updatedAt,
      createdOrder.items.map((item: any) => new OrderItem(item.id, item.quantity, item.unitPrice, item.total, item.orderId, item.productId)),
      { firstName: createdOrder.user.firstName, lastName: createdOrder.user.lastName }
    );
  }

  async updateStatus(id: string, status: "PENDIENTE" | "PROCESANDO" | "ENVIADO" | "ENTREGADO" | "CANCELADO"): Promise<Order> {
    const o = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        user: { select: { firstName: true, lastName: true } },
        items: true
      }
    });

    return new Order(
      o.id,
      o.orderNumber,
      o.status as any,
      o.subtotal,
      o.shippingCost,
      o.total,
      o.paymentMethod,
      o.shippingAddress,
      o.shippingCity,
      o.shippingState,
      o.shippingZip,
      o.shippingNotes,
      o.userId,
      o.createdAt,
      o.updatedAt,
      o.items.map((item: any) => new OrderItem(item.id, item.quantity, item.unitPrice, item.total, item.orderId, item.productId)),
      { firstName: o.user.firstName, lastName: o.user.lastName }
    );
  }

  async countByYear(year: number): Promise<number> {
    return await prisma.order.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`)
        }
      }
    });
  }
}
