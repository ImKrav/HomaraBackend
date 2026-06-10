import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateProjectUseCase, UpdateProjectUseCase } from "../../../src/application/use-cases/project.use-cases.js";
import { Project } from "../../../src/domain/entities/project.js";
import { AppError } from "../../../src/shared/errors/AppError.js";

const mockProjectRepository = {
  findAllByUserId: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
};

const mockProductRepository = {
  findAll: vi.fn(),
  findById: vi.fn(),
  findManyByIds: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
};

describe("Project Use Cases - Strict Validations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("CreateProjectUseCase Validation", () => {
    it("debe lanzar AppError 400 si materialType no está soportado", async () => {
      const useCase = new CreateProjectUseCase(mockProjectRepository, mockProductRepository);
      
      const payload = {
        name: "Proyecto Invalido",
        type: "PISO" as const,
        area: 20,
        materialType: "marmol-exotico", // No soportado
        userId: "user-123"
      };

      await expect(useCase.execute(payload)).rejects.toThrowError(
        new AppError("Tipo de material no soportado.", 400)
      );
    });

    it("debe lanzar AppError 404 si el producto seleccionado no existe", async () => {
      mockProductRepository.findById.mockResolvedValue(null);
      const useCase = new CreateProjectUseCase(mockProjectRepository, mockProductRepository);

      const payload = {
        name: "Proyecto Invalido",
        type: "PISO" as const,
        area: 20,
        materialType: "ceramica",
        selectedProductId: "invalid-prod-id",
        userId: "user-123"
      };

      await expect(useCase.execute(payload)).rejects.toThrowError(
        new AppError("El producto seleccionado no existe.", 404)
      );
    });

    it("debe lanzar AppError 400 si el producto seleccionado no tiene categorySlug", async () => {
      const product = {
        id: "prod-1",
        name: "Nevera",
        price: 100000,
        unit: "unidad",
        categorySlug: null // Sin slug de categoría
      };
      mockProductRepository.findById.mockResolvedValue(product);
      const useCase = new CreateProjectUseCase(mockProjectRepository, mockProductRepository);

      const payload = {
        name: "Proyecto Invalido",
        type: "PISO" as const,
        area: 20,
        materialType: "ceramica",
        selectedProductId: "prod-1",
        userId: "user-123"
      };

      await expect(useCase.execute(payload)).rejects.toThrowError(
        new AppError("El producto seleccionado no tiene una categoría válida.", 400)
      );
    });

    it("debe lanzar AppError 400 si se vincula un producto de pintura a un proyecto de cerámica", async () => {
      const product = {
        id: "prod-paint",
        name: "Pintura Azul Premium",
        price: 125000,
        unit: "galón",
        categorySlug: "pinturas"
      };
      mockProductRepository.findById.mockResolvedValue(product);
      const useCase = new CreateProjectUseCase(mockProjectRepository, mockProductRepository);

      const payload = {
        name: "Proyecto Ceramica",
        type: "PISO" as const,
        area: 20,
        materialType: "ceramica",
        selectedProductId: "prod-paint",
        userId: "user-123"
      };

      await expect(useCase.execute(payload)).rejects.toThrowError(
        new AppError("Para proyectos de revestimiento físico, el producto seleccionado debe ser de la categoría de pisos y cerámicas.", 400)
      );
    });

    it("debe lanzar AppError 400 si se vincula un producto de cerámica a un proyecto de pintura", async () => {
      const product = {
        id: "prod-tile",
        name: "Porcelanato 60x60",
        price: 45000,
        unit: "m²",
        categorySlug: "pisos-ceramicas"
      };
      mockProductRepository.findById.mockResolvedValue(product);
      const useCase = new CreateProjectUseCase(mockProjectRepository, mockProductRepository);

      const payload = {
        name: "Proyecto Pintura",
        type: "PARED" as const,
        area: 20,
        materialType: "pintura",
        selectedProductId: "prod-tile",
        userId: "user-123"
      };

      await expect(useCase.execute(payload)).rejects.toThrowError(
        new AppError("Para proyectos de pintura, el producto seleccionado debe ser de la categoría de pinturas.", 400)
      );
    });

    it("debe lanzar AppError 400 si se vincula un pegante a un proyecto de pintura", async () => {
      const product = {
        id: "prod-pegante",
        name: "Pegante Cerámico Bulto 25kg",
        price: 28500,
        unit: "bulto",
        categorySlug: "materiales-construccion"
      };
      mockProductRepository.findById.mockResolvedValue(product);
      const useCase = new CreateProjectUseCase(mockProjectRepository, mockProductRepository);

      const payload = {
        name: "Proyecto Pintura con Pegante",
        type: "PARED" as const,
        area: 20,
        materialType: "pintura",
        selectedProductId: "prod-pegante",
        userId: "user-123"
      };

      await expect(useCase.execute(payload)).rejects.toThrowError(
        new AppError("Los materiales de construcción (pegante/boquilla) solo son compatibles con proyectos de cerámica o porcelanato.", 400)
      );
    });
  });

  describe("UpdateProjectUseCase Validation", () => {
    it("debe lanzar AppError 400 si materialType actualizado no está soportado", async () => {
      const existingProject = new Project("proj-1", "Sala", "PISO", "EN_PROGRESO", 3, 4, null, 12, "ceramica", "60x60", "🏠", 150000, "user-123");
      mockProjectRepository.findById.mockResolvedValue(existingProject);

      const useCase = new UpdateProjectUseCase(mockProjectRepository, mockProductRepository);

      await expect(
        useCase.execute("proj-1", "user-123", { materialType: "madera-exotica" })
      ).rejects.toThrowError(
        new AppError("Tipo de material no soportado.", 400)
      );
    });

    it("debe lanzar AppError 400 si se actualiza a un producto de pintura incompatible con el materialType existente del proyecto (cerámica)", async () => {
      const existingProject = new Project("proj-1", "Sala", "PISO", "EN_PROGRESO", 3, 4, null, 12, "ceramica", "60x60", "🏠", 150000, "user-123");
      mockProjectRepository.findById.mockResolvedValue(existingProject);

      const product = {
        id: "prod-paint",
        name: "Pintura Azul",
        price: 120000,
        unit: "galón",
        categorySlug: "pinturas"
      };
      mockProductRepository.findById.mockResolvedValue(product);

      const useCase = new UpdateProjectUseCase(mockProjectRepository, mockProductRepository);

      await expect(
        useCase.execute("proj-1", "user-123", { selectedProductId: "prod-paint" })
      ).rejects.toThrowError(
        new AppError("Para proyectos de revestimiento físico, el producto seleccionado debe ser de la categoría de pisos y cerámicas.", 400)
      );
    });
  });
});
