import { describe, it, expect, vi } from "vitest";
import {
  ListCategoriesUseCase,
  GetProductDetailUseCase,
  CreateProductReviewUseCase,
  GetProductReviewsUseCase,
  GetStorefrontProductsUseCase
} from "../../../src/application/use-cases/catalog.use-cases.js";
import { Category } from "../../../src/domain/entities/category.js";
import { Product } from "../../../src/domain/entities/product.js";
import { Review } from "../../../src/domain/entities/review.js";
import { AppError } from "../../../src/shared/errors/AppError.js";

// Mock para ICategoryRepository
const mockCategoryRepository = {
  findAll: vi.fn(),
  findBySlug: vi.fn(),
  create: vi.fn()
};

// Mock para IProductRepository
const mockProductRepository = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updateStock: vi.fn(),
  findStorefrontRecommended: vi.fn(),
  findStorefrontOffers: vi.fn(),
  findStorefrontBestSellers: vi.fn(),
  updateProductRating: vi.fn()
};

// Mock para IReviewRepository
const mockReviewRepository = {
  create: vi.fn(),
  findByUserAndProduct: vi.fn(),
  findByProductId: vi.fn(),
  getAverageRatingAndCount: vi.fn()
};


describe("Catalog Use Cases", () => {
  it("ListCategoriesUseCase debe retornar todas las categorías del repositorio", async () => {
    const categories = [
      new Category("1", "Pisos", "pisos", "Pisos de todo tipo", "🏗️"),
      new Category("2", "Pinturas", "pinturas", "Pinturas premium", "🎨")
    ];
    mockCategoryRepository.findAll.mockResolvedValue(categories);

    const useCase = new ListCategoriesUseCase(mockCategoryRepository);
    const result = await useCase.execute();

    expect(result).toEqual(categories);
    expect(mockCategoryRepository.findAll).toHaveBeenCalledTimes(1);
  });

  it("GetProductDetailUseCase debe retornar el detalle de un producto si existe", async () => {
    const product = new Product(
      "1",
      "Porcelanato",
      "Porcelanato premium",
      45000,
      50000,
      "image.jpg",
      4.5,
      10,
      true,
      100,
      "m²",
      "cat1",
      new Date(),
      new Date(),
      ["nuevo"]
    );
    mockProductRepository.findById.mockResolvedValue(product);

    const useCase = new GetProductDetailUseCase(mockProductRepository);
    const result = await useCase.execute("1");

    expect(result).toEqual(product);
    expect(mockProductRepository.findById).toHaveBeenCalledWith("1");
  });

  it("GetProductDetailUseCase debe lanzar AppError 404 si el producto no existe", async () => {
    mockProductRepository.findById.mockResolvedValue(null);

    const useCase = new GetProductDetailUseCase(mockProductRepository);

    await expect(useCase.execute("999")).rejects.toThrowError(
      new AppError("Producto no encontrado", 404)
    );
  });

  it("CreateProductReviewUseCase debe crear reseña y actualizar rating del producto", async () => {
    const product = new Product("prod1", "Producto Test", "Desc", 100, null, "img.jpg", 0, 0, true, 10, "unidad", "cat1");
    mockProductRepository.findById.mockResolvedValue(product);
    mockReviewRepository.findByUserAndProduct.mockResolvedValue(null);
    
    const review = new Review("rev1", 5, "Comentario", new Date(), "user1", "prod1");
    mockReviewRepository.create.mockResolvedValue(review);
    mockReviewRepository.getAverageRatingAndCount.mockResolvedValue({ avg: 5.0, count: 1 });

    const useCase = new CreateProductReviewUseCase(mockProductRepository, mockReviewRepository);
    const result = await useCase.execute("user1", "prod1", 5, "Comentario");

    expect(result).toEqual(review);
    expect(mockProductRepository.findById).toHaveBeenCalledWith("prod1");
    expect(mockReviewRepository.findByUserAndProduct).toHaveBeenCalledWith("user1", "prod1");
    expect(mockReviewRepository.create).toHaveBeenCalledWith({
      userId: "user1",
      productId: "prod1",
      rating: 5,
      comment: "Comentario"
    });
    expect(mockProductRepository.updateProductRating).toHaveBeenCalledWith("prod1", 5.0, 1);
  });

  it("CreateProductReviewUseCase debe lanzar error si el usuario ya calificó el producto", async () => {
    const product = new Product("prod1", "Producto Test", "Desc", 100, null, "img.jpg", 0, 0, true, 10, "unidad", "cat1");
    mockProductRepository.findById.mockResolvedValue(product);
    
    const existingReview = new Review("rev1", 4, "Viejo", new Date(), "user1", "prod1");
    mockReviewRepository.findByUserAndProduct.mockResolvedValue(existingReview);

    const useCase = new CreateProductReviewUseCase(mockProductRepository, mockReviewRepository);
    
    await expect(useCase.execute("user1", "prod1", 5, "Comentario")).rejects.toThrowError(
      new AppError("Ya has calificado este producto", 400)
    );
  });

  it("GetProductReviewsUseCase debe retornar reseñas del producto", async () => {
    const reviews = [new Review("rev1", 5, "Buenisimo", new Date(), "user1", "prod1")];
    mockReviewRepository.findByProductId.mockResolvedValue(reviews);

    const useCase = new GetProductReviewsUseCase(mockReviewRepository);
    const result = await useCase.execute("prod1");

    expect(result).toEqual(reviews);
    expect(mockReviewRepository.findByProductId).toHaveBeenCalledWith("prod1");
  });

  it("GetStorefrontProductsUseCase debe retornar recomendados, ofertas y más vendidos", async () => {
    const recommended = [new Product("p1", "Novedad", "Desc", 100, null, "img.jpg", 5, 1, true, 10, "unidad", "cat1")];
    const offers = [new Product("p2", "Oferta", "Desc", 80, 100, "img.jpg", 4.5, 2, true, 10, "unidad", "cat1")];
    const bestSellers = [new Product("p3", "Top", "Desc", 120, null, "img.jpg", 4.8, 5, true, 10, "unidad", "cat1")];

    mockProductRepository.findStorefrontRecommended.mockResolvedValue(recommended);
    mockProductRepository.findStorefrontOffers.mockResolvedValue(offers);
    mockProductRepository.findStorefrontBestSellers.mockResolvedValue(bestSellers);

    const useCase = new GetStorefrontProductsUseCase(mockProductRepository);
    const result = await useCase.execute();

    expect(result).toEqual({ recommended, offers, bestSellers });
    expect(mockProductRepository.findStorefrontRecommended).toHaveBeenCalled();
    expect(mockProductRepository.findStorefrontOffers).toHaveBeenCalled();
    expect(mockProductRepository.findStorefrontBestSellers).toHaveBeenCalled();
  });
});

