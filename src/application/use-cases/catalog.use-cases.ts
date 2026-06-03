// ============================================
// Homara — Catalog Use Cases (TS)
// ============================================

import { ICategoryRepository } from "../../domain/repositories/category-repository.interface.js";
import { IProductRepository } from "../../domain/repositories/product-repository.interface.js";
import { IReviewRepository } from "../../domain/repositories/review-repository.interface.js";
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

export class CreateProductReviewUseCase {
  constructor(
    private readonly productRepository: IProductRepository,
    private readonly reviewRepository: IReviewRepository
  ) {}

  async execute(userId: string, productId: string, rating: number, comment?: string) {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new AppError("Producto no encontrado", 404);
    }

    const existingReview = await this.reviewRepository.findByUserAndProduct(userId, productId);
    if (existingReview) {
      throw new AppError("Ya has calificado este producto", 400);
    }

    const review = await this.reviewRepository.create({
      userId,
      productId,
      rating,
      comment
    });

    const { avg, count } = await this.reviewRepository.getAverageRatingAndCount(productId);
    await this.productRepository.updateProductRating(productId, avg, count);

    return review;
  }
}

export class GetProductReviewsUseCase {
  constructor(private readonly reviewRepository: IReviewRepository) {}

  async execute(productId: string) {
    return await this.reviewRepository.findByProductId(productId);
  }
}

export class GetStorefrontProductsUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute() {
    const [recommended, offers, bestSellers] = await Promise.all([
      this.productRepository.findStorefrontRecommended(),
      this.productRepository.findStorefrontOffers(),
      this.productRepository.findStorefrontBestSellers()
    ]);

    return {
      recommended,
      offers,
      bestSellers
    };
  }
}

export class CreateProductUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(data: {
    name: string;
    description: string;
    price: number;
    originalPrice?: number | null;
    image: string;
    stockQuantity: number;
    unit: string;
    categoryId: string;
    tags?: string[];
  }) {
    return await this.productRepository.create({
      name: data.name,
      description: data.description,
      price: data.price,
      originalPrice: data.originalPrice ?? null,
      image: data.image || "/products/placeholder.jpg",
      rating: 0,
      reviewCount: 0,
      inStock: data.stockQuantity > 0,
      stockQuantity: data.stockQuantity,
      unit: data.unit,
      categoryId: data.categoryId,
      tags: data.tags || [],
    });
  }
}

export class UpdateProductUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(
    id: string,
    data: {
      name?: string;
      description?: string;
      price?: number;
      originalPrice?: number | null;
      image?: string;
      stockQuantity?: number;
      unit?: string;
      categoryId?: string;
      tags?: string[];
    }
  ) {
    const existing = await this.productRepository.findById(id);
    if (!existing) {
      throw new AppError("Producto no encontrado", 404);
    }

    return await this.productRepository.update(id, data);
  }
}

export class DeleteProductUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(id: string) {
    const existing = await this.productRepository.findById(id);
    if (!existing) {
      throw new AppError("Producto no encontrado", 404);
    }

    await this.productRepository.delete(id);
  }
}

