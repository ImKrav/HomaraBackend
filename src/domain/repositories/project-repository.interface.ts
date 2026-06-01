import { Project, ProjectMaterial } from "../entities/project.js";

export interface IProjectRepository {
  findAllByUserId(userId: string): Promise<Project[]>;
  findById(id: string): Promise<Project | null>;
  create(
    project: Omit<Project, "id" | "createdAt" | "updatedAt" | "materials"> & { 
      id?: string; 
      materials?: Omit<ProjectMaterial, "id" | "projectId">[];
    }
  ): Promise<Project>;
  update(
    id: string,
    data: Partial<Omit<Project, "id" | "createdAt" | "updatedAt" | "materials">> & {
      materials?: Omit<ProjectMaterial, "id" | "projectId">[];
    }
  ): Promise<Project>;
  delete(id: string): Promise<void>;
}
