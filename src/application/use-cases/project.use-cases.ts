// ============================================
// Homara — Projects Use Cases (TS)
// ============================================

import { IProjectRepository } from "../../domain/repositories/project-repository.interface.js";
import { IProductRepository } from "../../domain/repositories/product-repository.interface.js";
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
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly productRepository?: IProductRepository
  ) {}

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
    
    // Nuevos campos de personalización
    wastePercent?: number;
    layingPattern?: string;
    deductDoors?: number;
    deductWindows?: number;
    customSubtractions?: number;
    includeAdhesive?: boolean;
    includeGrout?: boolean;
    includeSpacers?: boolean;
    includeTools?: boolean;
    selectedProductId?: string;
  }) {
    let selectedProduct = undefined;
    if (data.selectedProductId && this.productRepository) {
      const prod = await this.productRepository.findById(data.selectedProductId);
      if (prod) {
        const allowedCategories = ["pisos-ceramicas", "pinturas", "materiales-construccion"];
        if (prod.categorySlug && !allowedCategories.includes(prod.categorySlug)) {
          throw new AppError("Solo se pueden usar materiales de revestimiento (pisos, cerámicas o pinturas) o de construcción en un proyecto.", 400);
        }
        selectedProduct = {
          id: prod.id,
          name: prod.name,
          price: prod.price,
          unit: prod.unit,
        };
      }
    }

    const materials = calculateMaterials({
      type: data.type,
      area: data.area,
      materialType: data.materialType,
      tileFormat: data.tileFormat,
      wastePercent: data.wastePercent,
      layingPattern: data.layingPattern,
      deductDoors: data.deductDoors,
      deductWindows: data.deductWindows,
      customSubtractions: data.customSubtractions,
      includeAdhesive: data.includeAdhesive,
      includeGrout: data.includeGrout,
      includeSpacers: data.includeSpacers,
      includeTools: data.includeTools,
      selectedProduct,
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
      
      // Nuevos campos
      wastePercent: data.wastePercent ?? 10.0,
      layingPattern: data.layingPattern ?? "directo",
      deductDoors: data.deductDoors ?? 0,
      deductWindows: data.deductWindows ?? 0,
      customSubtractions: data.customSubtractions ?? 0.0,
      includeAdhesive: data.includeAdhesive ?? true,
      includeGrout: data.includeGrout ?? true,
      includeSpacers: data.includeSpacers ?? true,
      includeTools: data.includeTools ?? true,
      selectedProductId: data.selectedProductId ?? null,
    });
  }
}

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

export class UpdateProjectUseCase {
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly productRepository?: IProductRepository
  ) {}

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
      
      // Nuevos campos de personalización
      wastePercent?: number;
      layingPattern?: string;
      deductDoors?: number;
      deductWindows?: number;
      customSubtractions?: number;
      includeAdhesive?: boolean;
      includeGrout?: boolean;
      includeSpacers?: boolean;
      includeTools?: boolean;
      selectedProductId?: string;
    }
  ) {
    const existing = await this.projectRepository.findById(id);
    if (!existing) {
      throw new AppError("Proyecto no encontrado", 404);
    }

    if (existing.userId !== userId) {
      throw new AppError("No tienes permiso para modificar este proyecto.", 403);
    }

    const updateData: Writeable<Parameters<IProjectRepository["update"]>[1]> = { ...data };

    // Si cambia algo relevante para el cálculo, recalculamos
    const calculationTriggerFields = [
      "area", "materialType", "tileFormat", "type",
      "wastePercent", "layingPattern", "deductDoors", "deductWindows",
      "customSubtractions", "includeAdhesive", "includeGrout", "includeSpacers",
      "includeTools", "selectedProductId"
    ];

    const needsRecalculation = calculationTriggerFields.some(
      (field) => (data as any)[field] !== undefined
    );

    if (needsRecalculation) {
      const calcArea = data.area !== undefined ? data.area : existing.area;
      const calcType = data.materialType !== undefined ? data.materialType : (existing.materialType ?? "ceramica");
      const calcFormat = data.tileFormat !== undefined ? data.tileFormat : (existing.tileFormat ?? "60x60");
      const calcProjectType = data.type !== undefined ? data.type : existing.type;

      // Nuevos campos
      const calcWaste = data.wastePercent !== undefined ? data.wastePercent : (existing.wastePercent ?? 10.0);
      const calcPattern = data.layingPattern !== undefined ? data.layingPattern : (existing.layingPattern ?? "directo");
      const calcDoors = data.deductDoors !== undefined ? data.deductDoors : (existing.deductDoors ?? 0);
      const calcWindows = data.deductWindows !== undefined ? data.deductWindows : (existing.deductWindows ?? 0);
      const calcCustomSub = data.customSubtractions !== undefined ? data.customSubtractions : (existing.customSubtractions ?? 0.0);
      const calcAdhesive = data.includeAdhesive !== undefined ? data.includeAdhesive : (existing.includeAdhesive ?? true);
      const calcGrout = data.includeGrout !== undefined ? data.includeGrout : (existing.includeGrout ?? true);
      const calcSpacers = data.includeSpacers !== undefined ? data.includeSpacers : (existing.includeSpacers ?? true);
      const calcTools = data.includeTools !== undefined ? data.includeTools : (existing.includeTools ?? true);
      const calcSelectedProdId = data.selectedProductId !== undefined ? data.selectedProductId : existing.selectedProductId;

      let selectedProduct = undefined;
      if (calcSelectedProdId && this.productRepository) {
        const prod = await this.productRepository.findById(calcSelectedProdId);
        if (prod) {
          const allowedCategories = ["pisos-ceramicas", "pinturas", "materiales-construccion"];
          if (prod.categorySlug && !allowedCategories.includes(prod.categorySlug)) {
            throw new AppError("Solo se pueden usar materiales de revestimiento (pisos, cerámicas o pinturas) o de construcción en un proyecto.", 400);
          }
          selectedProduct = {
            id: prod.id,
            name: prod.name,
            price: prod.price,
            unit: prod.unit,
          };
        }
      }

      const materials = calculateMaterials({
        type: calcProjectType,
        area: calcArea,
        materialType: calcType,
        tileFormat: calcFormat,
        wastePercent: calcWaste,
        layingPattern: calcPattern,
        deductDoors: calcDoors,
        deductWindows: calcWindows,
        customSubtractions: calcCustomSub,
        includeAdhesive: calcAdhesive,
        includeGrout: calcGrout,
        includeSpacers: calcSpacers,
        includeTools: calcTools,
        selectedProduct,
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
