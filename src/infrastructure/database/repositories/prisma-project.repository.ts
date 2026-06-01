import { IProjectRepository } from "../../../domain/repositories/project-repository.interface.js";
import { Project, ProjectMaterial } from "../../../domain/entities/project.js";
import { prisma } from "../prisma-client.js";

export class PrismaProjectRepository implements IProjectRepository {
  async findAllByUserId(userId: string): Promise<Project[]> {
    const projects = await prisma.project.findMany({
      where: { userId },
      include: { materials: true },
      orderBy: { createdAt: "desc" }
    });

    return projects.map((p: any) => new Project(
      p.id,
      p.name,
      p.type as any,
      p.status as any,
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
      p.materials.map((m: any) => new ProjectMaterial(
        m.id,
        m.name,
        m.quantity,
        m.note,
        m.icon,
        m.price,
        m.projectId,
        m.productId
      ))
    ));
  }

  async findById(id: string): Promise<Project | null> {
    const p = await prisma.project.findUnique({
      where: { id },
      include: { materials: true }
    });
    if (!p) return null;

    return new Project(
      p.id,
      p.name,
      p.type as any,
      p.status as any,
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
      p.materials.map((m: any) => new ProjectMaterial(
        m.id,
        m.name,
        m.quantity,
        m.note,
        m.icon,
        m.price,
        m.projectId,
        m.productId
      ))
    );
  }

  async create(data: Omit<Project, "id" | "createdAt" | "updatedAt" | "materials"> & { id?: string; materials?: Omit<ProjectMaterial, "id" | "projectId">[] }): Promise<Project> {
    const p = await prisma.project.create({
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
        materials: {
          create: (data.materials || []).map((m: any) => ({
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

    return new Project(
      p.id,
      p.name,
      p.type as any,
      p.status as any,
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
      p.materials.map((m: any) => new ProjectMaterial(m.id, m.name, m.quantity, m.note, m.icon, m.price, m.projectId, m.productId))
    );
  }

  async update(id: string, data: Partial<Omit<Project, "id" | "createdAt" | "updatedAt" | "materials">> & { materials?: Omit<ProjectMaterial, "id" | "projectId">[] }): Promise<Project> {
    const updatePayload: any = {
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
      estimatedCost: data.estimatedCost
    };

    if (data.materials) {
      await prisma.projectMaterial.deleteMany({ where: { projectId: id } });
      updatePayload.materials = {
        create: data.materials.map((m: any) => ({
          name: m.name,
          quantity: m.quantity,
          note: m.note,
          icon: m.icon,
          price: m.price,
          productId: m.productId
        }))
      };
    }

    const p = await prisma.project.update({
      where: { id },
      data: updatePayload,
      include: { materials: true }
    });

    return new Project(
      p.id,
      p.name,
      p.type as any,
      p.status as any,
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
      p.materials.map((m: any) => new ProjectMaterial(m.id, m.name, m.quantity, m.note, m.icon, m.price, m.projectId, m.productId))
    );
  }

  async delete(id: string): Promise<void> {
    await prisma.project.delete({ where: { id } });
  }
}
