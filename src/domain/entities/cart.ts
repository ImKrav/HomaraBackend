import { Product } from "./product.js";

export class CartItem {
  constructor(
    public readonly id: string,
    public readonly quantity: number,
    public readonly cartId: string,
    public readonly productId: string,
    public readonly product?: Product
  ) {}
}

export class Cart {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
    public readonly items?: CartItem[]
  ) {}
}
