import { Category } from "../entities/category.js";

export interface ICategoryRepository {
  findAll(): Promise<Category[]>;
  findBySlug(slug: string): Promise<Category | null>;
  create(category: Omit<Category, "id"> & { id?: string }): Promise<Category>;
}
