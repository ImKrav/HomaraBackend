import { Product } from "../entities/product.js";

export interface IProductRepository {
  findAll(filters?: { categorySlug?: string; query?: string; tag?: string }): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  create(product: Omit<Product, "id" | "createdAt" | "updatedAt" | "tags"> & { id?: string; tags?: string[] }): Promise<Product>;
  updateStock(id: string, quantityChange: number): Promise<void>;
  findStorefrontRecommended(): Promise<Product[]>;
  findStorefrontOffers(): Promise<Product[]>;
  findStorefrontBestSellers(): Promise<Product[]>;
  updateProductRating(id: string, rating: number, reviewCount: number): Promise<void>;
  update(id: string, product: Partial<Omit<Product, "id" | "createdAt" | "updatedAt">> & { tags?: string[] }): Promise<Product>;
  delete(id: string): Promise<void>;
}

