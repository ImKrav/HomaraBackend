import { IOrderRepository } from "../../../domain/repositories/order-repository.interface.js";
import { Order, OrderItem } from "../../../domain/entities/order.js";
import { Product } from "../../../domain/entities/product.js";
import { prisma } from "../prisma-client.js";
import { Prisma } from "../../../generated/prisma/client.js";

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

    return orders.map((o) => new Order(
      o.id,
      o.orderNumber,
      o.status as "PENDIENTE" | "PROCESANDO" | "ENVIADO" | "ENTREGADO" | "CANCELADO",
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
      o.items.map((item) => new OrderItem(item.id, item.quantity, item.unitPrice, item.total, item.orderId, item.productId, undefined, item.isBackorder, item.backorderQuantity)),
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
      o.status as "PENDIENTE" | "PROCESANDO" | "ENVIADO" | "ENTREGADO" | "CANCELADO",
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
      o.items.map((item) => new OrderItem(
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
          item.product.updatedAt,
          undefined,
          item.product.category.name,
          item.product.category.slug
        ),
        item.isBackorder,
        item.backorderQuantity
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
    const createdOrder = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // A. Load cart to get excludeCartId
      const cart = await tx.cart.findUnique({ where: { userId: data.userId } });
      const excludeCartId = cart?.id || "";

      // B. Load products and active reservations by other users
      const productIds = data.items.map(item => item.productId);
      const productsList = await tx.product.findMany({
        where: { id: { in: productIds } }
      });
      const prodMap = new Map(productsList.map(p => [p.id, p]));

      const timeLimit = new Date(Date.now() - 15 * 60 * 1000);
      const reservations = await tx.cartItem.findMany({
        where: {
          productId: { in: productIds },
          cartId: excludeCartId ? { not: excludeCartId } : undefined,
          updatedAt: { gte: timeLimit }
        },
        select: {
          productId: true,
          quantity: true
        }
      });

      const reservedQtyMap: Record<string, number> = {};
      for (const resItem of reservations) {
        reservedQtyMap[resItem.productId] = (reservedQtyMap[resItem.productId] || 0) + resItem.quantity;
      }

      // C. Process each item to calculate backorder state
      const processedItems = data.items.map((item) => {
        const prod = prodMap.get(item.productId);
        const physicalStock = prod ? prod.stockQuantity : 0;
        const reservedQty = reservedQtyMap[item.productId] || 0;
        const availableStock = Math.max(0, physicalStock - reservedQty);
        
        const isBackorder = item.quantity > availableStock;
        const backorderQuantity = isBackorder ? item.quantity - availableStock : 0;

        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          isBackorder,
          backorderQuantity
        };
      });

      // D. Crear Orden
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
            create: processedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              isBackorder: item.isBackorder,
              backorderQuantity: item.backorderQuantity
            }))
          }
        },
        include: {
          items: true,
          user: { select: { firstName: true, lastName: true } }
        }
      });

      // E. Decrementar stock e inStock de productos (allowing to go negative)
      for (const item of processedItems) {
        const prod = prodMap.get(item.productId);
        if (prod) {
          const newQty = prod.stockQuantity - item.quantity;
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: newQty,
              inStock: newQty > 0
            }
          });
        }
      }

      // F. Vaciar carrito del usuario
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      }

      return order;
    });

    return new Order(
      createdOrder.id,
      createdOrder.orderNumber,
      createdOrder.status as "PENDIENTE" | "PROCESANDO" | "ENVIADO" | "ENTREGADO" | "CANCELADO",
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
      createdOrder.items.map((item) => new OrderItem(item.id, item.quantity, item.unitPrice, item.total, item.orderId, item.productId, undefined, item.isBackorder, item.backorderQuantity)),
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
      o.status as "PENDIENTE" | "PROCESANDO" | "ENVIADO" | "ENTREGADO" | "CANCELADO",
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
      o.items.map((item) => new OrderItem(item.id, item.quantity, item.unitPrice, item.total, item.orderId, item.productId, undefined, item.isBackorder, item.backorderQuantity)),
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
