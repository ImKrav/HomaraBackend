// ============================================
// Homara — Catalog Use Cases (TS)
// ============================================

import { ICategoryRepository } from "../../domain/repositories/category-repository.interface.js";
import { IProductRepository } from "../../domain/repositories/product-repository.interface.js";
import { AppError } from "../../shared/errors/AppError.js";

export class ListCategoriesUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute() {
    return await this.categoryRepository.findAll();
  }
}

export class ListProductsUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(filters?: { categorySlug?: string; query?: string; tag?: string }) {
    return await this.productRepository.findAll(filters);
  }
}

export class GetProductDetailUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(id: string) {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new AppError("Producto no encontrado", 404);
    }
    return product;
  }
}
