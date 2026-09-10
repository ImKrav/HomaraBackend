import { IProjectRepository } from "../../../domain/repositories/project-repository.interface.js";
import { Project, ProjectMaterial } from "../../../domain/entities/project.js";
import { prisma } from "../prisma-client.js";
import { Prisma } from "../../../generated/prisma/client.js";

type ProjectType = "PISO" | "PARED" | "TECHO" | "INTEGRAL";
type ProjectStatus = "EN_PROGRESO" | "COMPLETADO" | "PAUSADO";

function mapToProjectEntity(p: any): Project {
  return new Project(
    p.id,
    p.name,
    p.type as ProjectType,
    p.status as ProjectStatus,
    p.length,
    p.width,
    p.height,
    p.area,
    p.materialType,
    p.tileFormat,
    p.thumbnail,
    p.estimatedCost,
    p.userId,
    p.createdAt,
    p.updatedAt,
    p.materials?.map((m: any) => new ProjectMaterial(
      m.id,
      m.name,
      m.quantity,
      m.note,
      m.icon,
      m.price,
      m.projectId,
      m.productId
    )) ?? [],
    p.wastePercent,
    p.layingPattern,
    p.deductDoors,
    p.deductWindows,
    p.customSubtractions,
    p.includeAdhesive,
    p.includeGrout,
    p.includeSpacers,
    p.includeTools,
    p.selectedProductId
  );
}

export class PrismaProjectRepository implements IProjectRepository {
  constructor(private readonly db = prisma) {}

  async findAllByUserId(userId: string): Promise<Project[]> {
    const projects = await this.db.project.findMany({
      where: { userId },
      include: { materials: true },
      orderBy: { createdAt: "desc" }
    });

    return projects.map(mapToProjectEntity);
  }

  async findById(id: string): Promise<Project | null> {
    const p = await this.db.project.findUnique({
      where: { id },
      include: { materials: true }
    });
    return p ? mapToProjectEntity(p) : null;
  }

  async create(data: Omit<Project, "id" | "createdAt" | "updatedAt" | "materials"> & { id?: string; materials?: Omit<ProjectMaterial, "id" | "projectId">[] }): Promise<Project> {
    const p = await this.db.project.create({
      data: {
        id: data.id,
        name: data.name,
        type: data.type,
        length: data.length,
        width: data.width,
        height: data.height,
        area: data.area,
        materialType: data.materialType,
        tileFormat: data.tileFormat,
        thumbnail: data.thumbnail,
        estimatedCost: data.estimatedCost,
        userId: data.userId,
        // Guardar nuevos campos
        wastePercent: data.wastePercent,
        layingPattern: data.layingPattern,
        deductDoors: data.deductDoors,
        deductWindows: data.deductWindows,
        customSubtractions: data.customSubtractions,
        includeAdhesive: data.includeAdhesive,
        includeGrout: data.includeGrout,
        includeSpacers: data.includeSpacers,
        includeTools: data.includeTools,
        selectedProductId: data.selectedProductId,
        materials: {
          create: (data.materials || []).map((m) => ({
            name: m.name,
            quantity: m.quantity,
            note: m.note,
            icon: m.icon,
            price: m.price,
            productId: m.productId
          }))
        }
      },
      include: { materials: true }
    });

    return mapToProjectEntity(p);
  }

  async update(id: string, data: Partial<Omit<Project, "id" | "createdAt" | "updatedAt" | "materials">> & { materials?: Omit<ProjectMaterial, "id" | "projectId">[] }): Promise<Project> {
    const updatePayload: Prisma.ProjectUncheckedUpdateInput = {
      name: data.name,
      type: data.type,
      status: data.status,
      length: data.length,
      width: data.width,
      height: data.height,
      area: data.area,
      materialType: data.materialType,
      tileFormat: data.tileFormat,
      thumbnail: data.thumbnail,
      estimatedCost: data.estimatedCost,
      // Actualizar nuevos campos
      wastePercent: data.wastePercent,
      layingPattern: data.layingPattern,
      deductDoors: data.deductDoors,
      deductWindows: data.deductWindows,
      customSubtractions: data.customSubtractions,
      includeAdhesive: data.includeAdhesive,
      includeGrout: data.includeGrout,
      includeSpacers: data.includeSpacers,
      includeTools: data.includeTools,
      selectedProductId: data.selectedProductId
    };

    if (data.materials) {
      await this.db.projectMaterial.deleteMany({ where: { projectId: id } });
      updatePayload.materials = {
        create: data.materials.map((m) => ({
          name: m.name,
          quantity: m.quantity,
          note: m.note,
          icon: m.icon,
          price: m.price,
          productId: m.productId
        }))
      };
    }

    const p = await this.db.project.update({
      where: { id },
      data: updatePayload,
      include: { materials: true }
    });

    return mapToProjectEntity(p);
  }

  async delete(id: string): Promise<void> {
    await this.db.project.delete({ where: { id } });
  }
}
