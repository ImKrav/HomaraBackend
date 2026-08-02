// ============================================
// Homara — Cart Use Cases (TS)
// ============================================

import { ICartRepository } from "../../domain/repositories/cart-repository.interface.js";
import { Product } from "../../domain/entities/product.js";
import { AppError } from "../../shared/errors/AppError.js";

type ProductWithRelations = Product & {
  category?: {
    name: string;
    slug: string;
  };
};

export class GetCartUseCase {
  constructor(private readonly cartRepository: ICartRepository) {}

  async execute(userId: string) {
    const cart = await this.cartRepository.findByUserId(userId);
    const productIds = (cart.items || []).map(item => item.productId);
    const reservedQuantities = productIds.length > 0
      ? await this.cartRepository.getReservedQuantities(cart.id, productIds)
      : {};
    
    // Formatear items del carrito de la forma que espera el frontend
    const items = (cart.items || []).map((item) => {
      const product = item.product as ProductWithRelations | undefined;
      const reservedQty = reservedQuantities[item.productId] || 0;
      const availableStock = Math.max(0, (product?.stockQuantity || 0) - reservedQty);
      const isBackorder = item.quantity > availableStock;
      const backorderQuantity = isBackorder ? item.quantity - availableStock : 0;

      return {
        id: item.id,
        quantity: item.quantity,
        availableStock,
        isBackorder,
        backorderQuantity,
        product: {
          id: product?.id,
          name: product?.name,
          description: product?.description,
          price: product?.price,
          originalPrice: product?.originalPrice,
          image: product?.image,
          category: product?.category?.name || "Sin Categoría",
          categorySlug: product?.category?.slug || "sin-categoria",
          rating: product?.rating,
          reviews: product?.reviewCount,
          inStock: product?.inStock,
          stockQuantity: product?.stockQuantity,
          unit: product?.unit,
          tags: product?.tags || [],
        },
      };
    });

    const subtotal = items.reduce(
      (sum, item) => sum + (item.product.price || 0) * item.quantity,
      0
    );
    const shipping = subtotal > 500000 ? 0 : 25000;
    const total = subtotal + shipping;

    return {
      id: cart.id,
      items,
      subtotal,
      shipping,
      total,
      itemCount: items.length,
    };
  }
}

export class AddCartItemUseCase {
  constructor(private readonly cartRepository: ICartRepository) {}

  async execute(userId: string, productId: string, quantity: number = 1) {
    const cart = await this.cartRepository.findByUserId(userId);
    return await this.cartRepository.addItem(cart.id, productId, quantity);
  }
}

export class UpdateCartItemQuantityUseCase {
  constructor(private readonly cartRepository: ICartRepository) {}

  async execute(itemId: string, userId: string, quantity: number) {
    if (quantity < 1) {
      throw new AppError("La cantidad debe ser al menos 1", 400);
    }

    const ownerId = await this.cartRepository.findItemOwner(itemId);
    if (!ownerId) {
      throw new AppError("Item del carrito no encontrado", 404);
    }

    if (ownerId !== userId) {
      throw new AppError("No tienes permiso para modificar este item del carrito.", 403);
    }

    return await this.cartRepository.updateItemQuantity(itemId, quantity);
  }
}

export class RemoveCartItemUseCase {
  constructor(private readonly cartRepository: ICartRepository) {}

  async execute(itemId: string, userId: string) {
    const ownerId = await this.cartRepository.findItemOwner(itemId);
    if (!ownerId) {
      throw new AppError("Item del carrito no encontrado", 404);
    }

    if (ownerId !== userId) {
      throw new AppError("No tienes permiso para eliminar este item del carrito.", 403);
    }

    await this.cartRepository.removeItem(itemId);
  }
}
