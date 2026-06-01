import { ICategoryRepository } from "../../../domain/repositories/category-repository.interface.js";
import { Category } from "../../../domain/entities/category.js";
import { prisma } from "../prisma-client.js";

export class PrismaCategoryRepository implements ICategoryRepository {
  async findAll(): Promise<Category[]> {
    const categories = await prisma.category.findMany();
    return categories.map((c: any) => new Category(c.id, c.name, c.slug, c.description, c.icon));
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const c = await prisma.category.findUnique({ where: { slug } });
    if (!c) return null;
    return new Category(c.id, c.name, c.slug, c.description, c.icon);
  }

  async create(data: Omit<Category, "id"> & { id?: string }): Promise<Category> {
    const c = await prisma.category.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        description: data.description,
        icon: data.icon
      }
    });
    return new Category(c.id, c.name, c.slug, c.description, c.icon);
  }
}
