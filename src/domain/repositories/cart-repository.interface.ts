import { Cart, CartItem } from "../entities/cart.js";

export interface ICartRepository {
  findByUserId(userId: string): Promise<Cart>;
  addItem(cartId: string, productId: string, quantity: number): Promise<CartItem>;
  updateItemQuantity(itemId: string, quantity: number): Promise<CartItem>;
  removeItem(itemId: string): Promise<void>;
  clear(cartId: string): Promise<void>;
}
