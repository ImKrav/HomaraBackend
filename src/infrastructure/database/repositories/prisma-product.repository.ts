import { IProductRepository } from "../../../domain/repositories/product-repository.interface.js";
import { Product } from "../../../domain/entities/product.js";
import { prisma } from "../prisma-client.js";

export class PrismaProductRepository implements IProductRepository {
  async findAll(filters?: { categorySlug?: string; query?: string; tag?: string }): Promise<Product[]> {
    const where: any = {};

    if (filters?.categorySlug) {
      where.category = { slug: filters.categorySlug };
    }

    if (filters?.query) {
      where.OR = [
        { name: { contains: filters.query, mode: "insensitive" } },
        { description: { contains: filters.query, mode: "insensitive" } }
      ];
    }

    if (filters?.tag) {
      where.tags = { some: { name: filters.tag } };
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        tags: true
      }
    });

    return products.map((p: any) => new Product(
      p.id,
      p.name,
      p.description,
      p.price,
      p.originalPrice,
      p.image,
      p.rating,
      p.reviewCount,
      p.inStock,
      p.stockQuantity,
      p.unit,
      p.categoryId,
      p.createdAt,
      p.updatedAt,
      p.tags.map((t: any) => t.name)
    ));
  }

  async findById(id: string): Promise<Product | null> {
    const p = await prisma.product.findUnique({
      where: { id },
      include: { category: true, tags: true }
    });
    if (!p) return null;

    return new Product(
      p.id,
      p.name,
      p.description,
      p.price,
      p.originalPrice,
      p.image,
      p.rating,
      p.reviewCount,
      p.inStock,
      p.stockQuantity,
      p.unit,
      p.categoryId,
      p.createdAt,
      p.updatedAt,
      p.tags.map((t: any) => t.name)
    );
  }

  async create(data: Omit<Product, "id" | "createdAt" | "updatedAt" | "tags"> & { id?: string; tags?: string[] }): Promise<Product> {
    const p = await prisma.product.create({
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
        price: data.price,
        originalPrice: data.originalPrice,
        image: data.image,
        rating: data.rating,
        reviewCount: data.reviewCount,
        inStock: data.inStock,
        stockQuantity: data.stockQuantity,
        unit: data.unit,
        categoryId: data.categoryId,
        tags: {
          create: (data.tags || []).map((t: any) => ({ name: t }))
        }
      },
      include: { tags: true }
    });

    return new Product(
      p.id,
      p.name,
      p.description,
      p.price,
      p.originalPrice,
      p.image,
      p.rating,
      p.reviewCount,
      p.inStock,
      p.stockQuantity,
      p.unit,
      p.categoryId,
      p.createdAt,
      p.updatedAt,
      p.tags.map((t: any) => t.name)
    );
  }

  async updateStock(id: string, quantityChange: number): Promise<void> {
    const p = await prisma.product.findUnique({ where: { id } });
    if (!p) return;

    const newStock = Math.max(0, p.stockQuantity + quantityChange);
    await prisma.product.update({
      where: { id },
      data: {
        stockQuantity: newStock,
        inStock: newStock > 0
      }
    });
  }
}
