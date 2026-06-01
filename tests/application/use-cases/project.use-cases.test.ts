import { describe, it, expect, vi } from "vitest";
import { ListUserProjectsUseCase, GetProjectUseCase, CreateProjectUseCase, UpdateProjectUseCase, DeleteProjectUseCase } from "../../../src/application/use-cases/project.use-cases.js";
import { Project, ProjectMaterial } from "../../../src/domain/entities/project.js";
import { AppError } from "../../../src/shared/errors/AppError.js";

// Mock IProjectRepository
const mockProjectRepository = {
  findAllByUserId: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
};

describe("Project Use Cases", () => {
  describe("ListUserProjectsUseCase", () => {
    it("debe retornar los proyectos del usuario", async () => {
      const projects = [
        new Project("proj-1", "Mi Sala", "PISO", "EN_PROGRESO", 3, 4, null, 12, "ceramica", "60x60", "🏠", 100000, "user-123")
      ];
      mockProjectRepository.findAllByUserId.mockResolvedValue(projects);

      const useCase = new ListUserProjectsUseCase(mockProjectRepository);
      const result = await useCase.execute("user-123");

      expect(mockProjectRepository.findAllByUserId).toHaveBeenCalledWith("user-123");
      expect(result).toEqual(projects);
    });
  });

  describe("GetProjectUseCase", () => {
    it("debe retornar el proyecto si existe", async () => {
      const project = new Project("proj-1", "Mi Sala", "PISO", "EN_PROGRESO", 3, 4, null, 12, "ceramica", "60x60", "🏠", 100000, "user-123");
      mockProjectRepository.findById.mockResolvedValue(project);

      const useCase = new GetProjectUseCase(mockProjectRepository);
      const result = await useCase.execute("proj-1");

      expect(mockProjectRepository.findById).toHaveBeenCalledWith("proj-1");
      expect(result).toEqual(project);
    });

    it("debe lanzar AppError 404 si el proyecto no existe", async () => {
      mockProjectRepository.findById.mockResolvedValue(null);

      const useCase = new GetProjectUseCase(mockProjectRepository);

      await expect(useCase.execute("proj-999")).rejects.toThrowError(
        new AppError("Proyecto no encontrado", 404)
      );
    });
  });

  describe("CreateProjectUseCase", () => {
    it("debe calcular materiales, costo estimado y crear el proyecto exitosamente", async () => {
      const projectData = {
        name: "Proyecto Test",
        type: "PISO" as const,
        length: 5,
        width: 4,
        area: 20,
        materialType: "ceramica",
        tileFormat: "60x60",
        userId: "user-123"
      };

      const createdProject = new Project(
        "proj-1",
        projectData.name,
        projectData.type,
        "EN_PROGRESO",
        5,
        4,
        null,
        20,
        "ceramica",
        "60x60",
        "🏠",
        500000,
        "user-123"
      );
      mockProjectRepository.create.mockResolvedValue(createdProject);

      const useCase = new CreateProjectUseCase(mockProjectRepository);
      const result = await useCase.execute(projectData);

      expect(mockProjectRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Proyecto Test",
          type: "PISO",
          status: "EN_PROGRESO",
          length: 5,
          width: 4,
          area: 20,
          materialType: "ceramica",
          tileFormat: "60x60",
          userId: "user-123",
          materials: expect.any(Array),
          estimatedCost: expect.any(Number)
        })
      );
      expect(result).toEqual(createdProject);
    });
  });

  describe("UpdateProjectUseCase", () => {
    it("debe actualizar el proyecto y recalcular materiales si cambia el área", async () => {
      const existingProject = new Project(
        "proj-1",
        "Sala",
        "PISO",
        "EN_PROGRESO",
        3,
        4,
        null,
        12,
        "ceramica",
        "60x60",
        "🏠",
        150000,
        "user-123"
      );
      mockProjectRepository.findById.mockResolvedValue(existingProject);

      const updatedProject = new Project(
        "proj-1",
        "Sala Renovada",
        "PISO",
        "EN_PROGRESO",
        3,
        4,
        null,
        20, // Nuevo área
        "ceramica",
        "60x60",
        "🏠",
        450000,
        "user-123"
      );
      mockProjectRepository.update.mockResolvedValue(updatedProject);

      const useCase = new UpdateProjectUseCase(mockProjectRepository);
      const result = await useCase.execute("proj-1", {
        name: "Sala Renovada",
        area: 20
      });

      expect(mockProjectRepository.findById).toHaveBeenCalledWith("proj-1");
      expect(mockProjectRepository.update).toHaveBeenCalledWith(
        "proj-1",
        expect.objectContaining({
          name: "Sala Renovada",
          area: 20,
          materials: expect.any(Array),
          estimatedCost: expect.any(Number)
        })
      );
      expect(result).toEqual(updatedProject);
    });

    it("debe lanzar AppError 404 si el proyecto no existe", async () => {
      mockProjectRepository.findById.mockResolvedValue(null);

      const useCase = new UpdateProjectUseCase(mockProjectRepository);

      await expect(
        useCase.execute("proj-999", { name: "Nuevo Nombre" })
      ).rejects.toThrowError(
        new AppError("Proyecto no encontrado", 404)
      );
    });
  });

  describe("DeleteProjectUseCase", () => {
    it("debe eliminar el proyecto si existe", async () => {
      const project = new Project("proj-1", "Sala", "PISO", "EN_PROGRESO", 3, 4, null, 12, "ceramica", "60x60", "🏠", 150000, "user-123");
      mockProjectRepository.findById.mockResolvedValue(project);
      mockProjectRepository.delete.mockResolvedValue(undefined);

      const useCase = new DeleteProjectUseCase(mockProjectRepository);
      await useCase.execute("proj-1");

      expect(mockProjectRepository.findById).toHaveBeenCalledWith("proj-1");
      expect(mockProjectRepository.delete).toHaveBeenCalledWith("proj-1");
    });

    it("debe lanzar AppError 404 al intentar eliminar un proyecto que no existe", async () => {
      mockProjectRepository.findById.mockResolvedValue(null);

      const useCase = new DeleteProjectUseCase(mockProjectRepository);

      await expect(useCase.execute("proj-999")).rejects.toThrowError(
        new AppError("Proyecto no encontrado", 404)
      );
    });
  });
});
