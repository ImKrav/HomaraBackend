import { describe, it, expect, vi } from "vitest";
import { ListCategoriesUseCase, GetProductDetailUseCase } from "../../../src/application/use-cases/catalog.use-cases.js";
import { Category } from "../../../src/domain/entities/category.js";
import { Product } from "../../../src/domain/entities/product.js";
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
  updateStock: vi.fn()
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
});
