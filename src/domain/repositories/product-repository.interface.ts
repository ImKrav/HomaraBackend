import { Product } from "../entities/product.js";

export interface IProductRepository {
  findAll(filters?: { categorySlug?: string; query?: string; tag?: string }): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  create(product: Omit<Product, "id" | "createdAt" | "updatedAt" | "tags"> & { id?: string; tags?: string[] }): Promise<Product>;
  updateStock(id: string, quantityChange: number): Promise<void>;
}
