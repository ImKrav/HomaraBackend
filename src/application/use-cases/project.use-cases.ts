// ============================================
// Homara — Projects Use Cases (TS)
// ============================================

import { IProjectRepository } from "../../domain/repositories/project-repository.interface.js";
import { IProductRepository } from "../../domain/repositories/product-repository.interface.js";
import { calculateMaterials } from "../../domain/services/materialCalculator.js";
import { AppError } from "../../shared/errors/AppError.js";

const ALLOWED_MATERIAL_TYPES = new Set(["ceramica", "porcelanato", "madera", "vinilo", "pintura"]);
const ALLOWED_PRODUCT_CATEGORIES = new Set(["pisos-ceramicas", "pinturas", "materiales-construccion"]);

async function resolveSelectedProduct(
  productRepository: IProductRepository | undefined,
  productId: string | null | undefined,
  materialType: string
) {
  if (!productId || !productRepository) {
    return undefined;
  }

  const product = await productRepository.findById(productId);
  if (!product) {
    throw new AppError("El producto seleccionado no existe.", 404);
  }
  if (!product.categorySlug) {
    throw new AppError("El producto seleccionado no tiene una categoría válida.", 400);
  }
  if (!ALLOWED_PRODUCT_CATEGORIES.has(product.categorySlug)) {
    throw new AppError("Solo se pueden usar materiales de revestimiento (pisos, cerámicas o pinturas) o de construcción en un proyecto.", 400);
  }

  const normalizedMaterialType = materialType.toLowerCase();
  const productName = product.name.toLowerCase();
  const isConstructionMaterial =
    product.categorySlug === "materiales-construccion" ||
    ["pegante", "cemento", "adhesivo", "mortero", "yeso", "cal", "boquilla"]
      .some((term) => productName.includes(term));

  if (isConstructionMaterial) {
    if (product.categorySlug !== "materiales-construccion") {
      throw new AppError("El material de construcción seleccionado no pertenece a la categoría correcta.", 400);
    }
    if (normalizedMaterialType !== "ceramica" && normalizedMaterialType !== "porcelanato") {
      throw new AppError("Los materiales de construcción (pegante/boquilla) solo son compatibles con proyectos de cerámica o porcelanato.", 400);
    }
  } else if (
    (normalizedMaterialType === "pintura" && product.categorySlug !== "pinturas") ||
    (normalizedMaterialType !== "pintura" && product.categorySlug !== "pisos-ceramicas")
  ) {
    const message = normalizedMaterialType === "pintura"
      ? "Para proyectos de pintura, el producto seleccionado debe ser de la categoría de pinturas."
      : "Para proyectos de revestimiento físico, el producto seleccionado debe ser de la categoría de pisos y cerámicas.";
    throw new AppError(message, 400);
  }

  return {
    id: product.id,
    name: product.name,
    price: product.price,
    unit: product.unit,
  };
}

export async function resolveAndValidateProjectProduct(
  productRepository: IProductRepository,
  productId: string,
  materialType: string
) {
  const selectedProduct = await resolveSelectedProduct(productRepository, productId, materialType);
  if (!selectedProduct) {
    throw new AppError("El producto seleccionado no existe.", 404);
  }
  return selectedProduct;
}

export class ListUserProjectsUseCase {
  constructor(private readonly projectRepository: IProjectRepository) {}

  async execute(userId: string) {
    return this.projectRepository.findAllByUserId(userId);
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
    if (data.materialType && !ALLOWED_MATERIAL_TYPES.has(data.materialType.toLowerCase())) {
      throw new AppError("Tipo de material no soportado.", 400);
    }

    const selectedProduct = await resolveSelectedProduct(
      this.productRepository,
      data.selectedProductId,
      data.materialType ?? "ceramica"
    );

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

    return this.projectRepository.create({
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
      materials?: {
        name: string;
        quantity: string;
        note?: string | null;
        icon: string;
        price: number;
        productId?: string | null;
      }[];
    }
  ) {
    if (data.materialType && !ALLOWED_MATERIAL_TYPES.has(data.materialType.toLowerCase())) {
      throw new AppError("Tipo de material no soportado.", 400);
    }

    const existing = await this.projectRepository.findById(id);
    if (!existing) {
      throw new AppError("Proyecto no encontrado", 404);
    }

    if (existing.userId !== userId) {
      throw new AppError("No tienes permiso para modificar este proyecto.", 403);
    }

    const { materials: dataMaterials, ...restData } = data;
    const updateData: Writeable<Parameters<IProjectRepository["update"]>[1]> = { ...restData };

    // Si cambia algo relevante para el cálculo, recalculamos
    const calculationTriggerFields = [
      "area", "materialType", "tileFormat", "type",
      "wastePercent", "layingPattern", "deductDoors", "deductWindows",
      "customSubtractions", "includeAdhesive", "includeGrout", "includeSpacers",
      "includeTools", "selectedProductId"
    ];

    const needsRecalculation = calculationTriggerFields.some(
      (field) => (data as Record<string, unknown>)[field] !== undefined
    );

    if (needsRecalculation) {
      const calcArea = data.area ?? existing.area;
      const calcType = data.materialType ?? (existing.materialType ?? "ceramica");
      const calcFormat = data.tileFormat ?? (existing.tileFormat ?? "60x60");
      const calcProjectType = data.type ?? existing.type;

      // Nuevos campos
      const calcWaste = data.wastePercent ?? (existing.wastePercent ?? 10.0);
      const calcPattern = data.layingPattern ?? (existing.layingPattern ?? "directo");
      const calcDoors = data.deductDoors ?? (existing.deductDoors ?? 0);
      const calcWindows = data.deductWindows ?? (existing.deductWindows ?? 0);
      const calcCustomSub = data.customSubtractions ?? (existing.customSubtractions ?? 0.0);
      const calcAdhesive = data.includeAdhesive ?? (existing.includeAdhesive ?? true);
      const calcGrout = data.includeGrout ?? (existing.includeGrout ?? true);
      const calcSpacers = data.includeSpacers ?? (existing.includeSpacers ?? true);
      const calcTools = data.includeTools ?? (existing.includeTools ?? true);
      const calcSelectedProdId = data.selectedProductId ?? existing.selectedProductId;

      const selectedProduct = await resolveSelectedProduct(
        this.productRepository,
        calcSelectedProdId,
        calcType
      );

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
    } else if (dataMaterials !== undefined) {
      updateData.materials = dataMaterials.map((m) => ({
        name: m.name,
        quantity: m.quantity,
        note: m.note ?? null,
        icon: m.icon,
        price: m.price,
        productId: m.productId ?? null,
      }));
      updateData.estimatedCost = updateData.materials.reduce((sum, m) => sum + m.price, 0);
    }

    return this.projectRepository.update(id, updateData);
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
