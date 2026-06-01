// ============================================
// Homara — Projects Use Cases (TS)
// ============================================

import { IProjectRepository } from "../../domain/repositories/project-repository.interface.js";
import { Project } from "../../domain/entities/project.js";
import { calculateMaterials } from "../../domain/services/materialCalculator.js";
import { AppError } from "../../shared/errors/AppError.js";

export class ListUserProjectsUseCase {
  constructor(private readonly projectRepository: IProjectRepository) {}

  async execute(userId: string) {
    return await this.projectRepository.findAllByUserId(userId);
  }
}

export class GetProjectUseCase {
  constructor(private readonly projectRepository: IProjectRepository) {}

  async execute(id: string) {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new AppError("Proyecto no encontrado", 404);
    }
    return project;
  }
}

export class CreateProjectUseCase {
  constructor(private readonly projectRepository: IProjectRepository) {}

  async execute(data: {
    name: string;
    type: "PISO" | "PARED" | "TECHO" | "INTEGRAL";
    length?: number;
    width?: number;
    height?: number;
    area: number;
    materialType?: string;
    tileFormat?: string;
    thumbnail?: string;
    userId: string;
  }) {
    const materials = calculateMaterials({
      type: data.type,
      area: data.area,
      materialType: data.materialType,
      tileFormat: data.tileFormat,
    });

    const estimatedCost = materials.reduce((sum, m) => sum + m.price, 0);

    return await this.projectRepository.create({
      name: data.name,
      type: data.type,
      status: "EN_PROGRESO",
      length: data.length ?? null,
      width: data.width ?? null,
      height: data.height ?? null,
      area: data.area,
      materialType: data.materialType ?? "ceramica",
      tileFormat: data.tileFormat ?? "60x60",
      thumbnail: data.thumbnail ?? "🏠",
      estimatedCost,
      userId: data.userId,
      materials,
    });
  }
}

export class UpdateProjectUseCase {
  constructor(private readonly projectRepository: IProjectRepository) {}

  async execute(
    id: string,
    userId: string,
    data: {
      name?: string;
      type?: "PISO" | "PARED" | "TECHO" | "INTEGRAL";
      length?: number;
      width?: number;
      height?: number;
      area?: number;
      materialType?: string;
      tileFormat?: string;
      status?: "EN_PROGRESO" | "COMPLETADO" | "PAUSADO";
      thumbnail?: string;
    }
  ) {
    const existing = await this.projectRepository.findById(id);
    if (!existing) {
      throw new AppError("Proyecto no encontrado", 404);
    }

    if (existing.userId !== userId) {
      throw new AppError("No tienes permiso para modificar este proyecto.", 403);
    }

    const updateData: any = { ...data };

    if (
      data.area !== undefined ||
      data.materialType !== undefined ||
      data.tileFormat !== undefined ||
      data.type !== undefined
    ) {
      const calcArea = data.area !== undefined ? data.area : existing.area;
      const calcType = data.materialType !== undefined ? data.materialType : (existing.materialType ?? "ceramica");
      const calcFormat = data.tileFormat !== undefined ? data.tileFormat : (existing.tileFormat ?? "60x60");
      const calcProjectType = data.type !== undefined ? data.type : existing.type;

      const materials = calculateMaterials({
        type: calcProjectType,
        area: calcArea,
        materialType: calcType,
        tileFormat: calcFormat,
      });

      updateData.estimatedCost = materials.reduce((sum, m) => sum + m.price, 0);
      updateData.materials = materials;
    }

    return await this.projectRepository.update(id, updateData);
  }
}

export class DeleteProjectUseCase {
  constructor(private readonly projectRepository: IProjectRepository) {}

  async execute(id: string, userId: string) {
    const existing = await this.projectRepository.findById(id);
    if (!existing) {
      throw new AppError("Proyecto no encontrado", 404);
    }

    if (existing.userId !== userId) {
      throw new AppError("No tienes permiso para eliminar este proyecto.", 403);
    }

    await this.projectRepository.delete(id);
  }
}
