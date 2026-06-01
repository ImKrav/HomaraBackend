// ============================================
// Homara — Cart Use Cases (TS)
// ============================================

import { ICartRepository } from "../../domain/repositories/cart-repository.interface.js";
import { AppError } from "../../shared/errors/AppError.js";

export class GetCartUseCase {
  constructor(private readonly cartRepository: ICartRepository) {}

  async execute(userId: string) {
    const cart = await this.cartRepository.findByUserId(userId);
    
    // Formatear items del carrito de la forma que espera el frontend
    const items = (cart.items || []).map((item) => ({
      id: item.id,
      quantity: item.quantity,
      product: {
        id: item.product?.id,
        name: item.product?.name,
        description: item.product?.description,
        price: item.product?.price,
        originalPrice: item.product?.originalPrice,
        image: item.product?.image,
        category: (item.product as any)?.category?.name || "Sin Categoría",
        categorySlug: (item.product as any)?.category?.slug || "sin-categoria",
        rating: item.product?.rating,
        reviews: item.product?.reviewCount,
        inStock: item.product?.inStock,
        stockQuantity: item.product?.stockQuantity,
        unit: item.product?.unit,
        tags: (item.product as any)?.tags?.map((t: any) => t.name) || [],
      },
    }));

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

  async execute(itemId: string, quantity: number) {
    if (quantity < 1) {
      throw new AppError("La cantidad debe ser al menos 1", 400);
    }
    return await this.cartRepository.updateItemQuantity(itemId, quantity);
  }
}

export class RemoveCartItemUseCase {
  constructor(private readonly cartRepository: ICartRepository) {}

  async execute(itemId: string) {
    await this.cartRepository.removeItem(itemId);
  }
}
