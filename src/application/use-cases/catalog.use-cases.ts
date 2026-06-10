// ============================================
// Homara — Catalog Use Cases (TS)
// ============================================

import { ICategoryRepository } from "../../domain/repositories/category-repository.interface.js";
import { IProductRepository } from "../../domain/repositories/product-repository.interface.js";
import { IReviewRepository } from "../../domain/repositories/review-repository.interface.js";
import { ICartRepository } from "../../domain/repositories/cart-repository.interface.js";
import { Product } from "../../domain/entities/product.js";
import { AppError } from "../../shared/errors/AppError.js";


export class ListCategoriesUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute() {
    return await this.categoryRepository.findAll();
  }
}

export class ListProductsUseCase {
  constructor(
    private readonly productRepository: IProductRepository,
    private readonly cartRepository: ICartRepository
  ) {}

  async execute(filters?: { categorySlug?: string; query?: string; tag?: string }, userId?: string) {
    const products = await this.productRepository.findAll(filters);
    const productIds = products.map((p) => p.id);
    if (productIds.length === 0) return products;

    let excludeCartId = "";
    if (userId) {
      const cart = await this.cartRepository.findByUserId(userId);
      excludeCartId = cart.id;
    }

    const reservedQuantities = await this.cartRepository.getReservedQuantities(excludeCartId, productIds);

    return products.map((p) => {
      const reservedQty = reservedQuantities[p.id] || 0;
      const dynamicStock = Math.max(0, p.stockQuantity - reservedQty);
      return new Product(
        p.id,
        p.name,
        p.description,
        p.price,
        p.originalPrice,
        p.image,
        p.rating,
        p.reviewCount,
        dynamicStock > 0,
        dynamicStock,
        p.unit,
        p.categoryId,
        p.createdAt,
        p.updatedAt,
        p.tags,
        p.category,
        p.categorySlug
      );
    });
  }
}

export class GetProductDetailUseCase {
  constructor(
    private readonly productRepository: IProductRepository,
    private readonly cartRepository: ICartRepository
  ) {}

  async execute(id: string, userId?: string) {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new AppError("Producto no encontrado", 404);
    }

    let excludeCartId = "";
    if (userId) {
      const cart = await this.cartRepository.findByUserId(userId);
      excludeCartId = cart.id;
    }

    const reservedQuantities = await this.cartRepository.getReservedQuantities(excludeCartId, [id]);
    const reservedQty = reservedQuantities[id] || 0;
    const dynamicStock = Math.max(0, product.stockQuantity - reservedQty);

    return new Product(
      product.id,
      product.name,
      product.description,
      product.price,
      product.originalPrice,
      product.image,
      product.rating,
      product.reviewCount,
      dynamicStock > 0,
      dynamicStock,
      product.unit,
      product.categoryId,
      product.createdAt,
      product.updatedAt,
      product.tags,
      product.category,
      product.categorySlug
    );
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
    image?: string;
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

