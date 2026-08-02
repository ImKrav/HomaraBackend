import { IProductRepository } from "../../../domain/repositories/product-repository.interface.js";
import { Product } from "../../../domain/entities/product.js";
import { prisma } from "../prisma-client.js";
import { Prisma } from "../../../generated/prisma/client.js";

export class PrismaProductRepository implements IProductRepository {
  async findAll(filters?: { categorySlug?: string; query?: string; tag?: string }): Promise<Product[]> {
    const where: Prisma.ProductWhereInput = {};

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

    return products.map((p) => new Product(
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
      p.tags.map((t) => t.name),
      p.category?.name,
      p.category?.slug
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
      p.tags.map((t) => t.name),
      p.category?.name,
      p.category?.slug
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
          create: (data.tags || []).map((t) => ({ name: t }))
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
      p.tags.map((t) => t.name),
      undefined,
      undefined
    );
  }

  private mapToEntity(p: Prisma.ProductGetPayload<{ include: { tags: true; category: true } }>): Product {
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
      p.tags ? p.tags.map((t: { name: string } | string) => typeof t === "string" ? t : t.name) : [],
      p.category?.name,
      p.category?.slug
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

  async findStorefrontRecommended(): Promise<Product[]> {
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { tags: { some: { name: "nuevo" } } },
          { rating: { gte: 4.5 } }
        ]
      },
      include: { tags: true, category: true },
      orderBy: [
        { rating: "desc" },
        { reviewCount: "desc" },
        { createdAt: "desc" }
      ],
      take: 4
    });
    return products.map((p) => this.mapToEntity(p));
  }

  async findStorefrontOffers(): Promise<Product[]> {
    const products = await prisma.product.findMany({
      where: {
        originalPrice: { not: null }
      },
      include: { tags: true, category: true }
    });

    return products
      .filter((p) => p.originalPrice !== null && p.originalPrice > p.price)
      .sort((a, b) => {
        const discountA = (a.originalPrice! - a.price) / a.originalPrice!;
        const discountB = (b.originalPrice! - b.price) / b.originalPrice!;
        return discountB - discountA;
      })
      .slice(0, 4)
      .map((p) => this.mapToEntity(p));
  }

  async findStorefrontBestSellers(): Promise<Product[]> {
    const orderAggregates = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          status: {
            in: ["PROCESANDO", "ENVIADO", "ENTREGADO"]
          }
        }
      },
      _sum: {
        quantity: true
      },
      orderBy: {
        _sum: {
          quantity: "desc"
        }
      },
      take: 4
    });

    const bestSellerIds = orderAggregates.map((a) => a.productId);
    let bestSellers: Prisma.ProductGetPayload<{ include: { tags: true; category: true } }>[] = [];
    if (bestSellerIds.length > 0) {
      bestSellers = await prisma.product.findMany({
        where: {
          id: { in: bestSellerIds }
        },
        include: { tags: true, category: true }
      });
      bestSellers.sort((a, b) => bestSellerIds.indexOf(a.id) - bestSellerIds.indexOf(b.id));
    }

    if (bestSellers.length < 4) {
      const needed = 4 - bestSellers.length;
      const fallbacks = await prisma.product.findMany({
        where: {
          id: { notIn: bestSellerIds }
        },
        include: { tags: true, category: true },
        orderBy: [
          { reviewCount: "desc" },
          { rating: "desc" }
        ],
        take: needed
      });
      bestSellers = [...bestSellers, ...fallbacks];
    }

    return bestSellers.map((p) => this.mapToEntity(p));
  }

  async updateProductRating(id: string, rating: number, reviewCount: number): Promise<void> {
    await prisma.product.update({
      where: { id },
      data: {
        rating,
        reviewCount
      }
    });
  }

  async update(id: string, data: Partial<Omit<Product, "id" | "createdAt" | "updatedAt">> & { tags?: string[] }): Promise<Product> {
    const { tags, ...productData } = data;

    const updated = await prisma.$transaction(async (tx) => {
      if (tags !== undefined) {
        await tx.productTag.deleteMany({ where: { productId: id } });
        if (tags.length > 0) {
          await tx.productTag.createMany({
            data: tags.map((t) => ({ productId: id, name: t })),
          });
        }
      }

      const updateFields: Prisma.ProductUpdateInput = {};
      if (productData.name !== undefined) updateFields.name = productData.name;
      if (productData.description !== undefined) updateFields.description = productData.description;
      if (productData.price !== undefined) updateFields.price = productData.price;
      if (productData.originalPrice !== undefined) updateFields.originalPrice = productData.originalPrice;
      if (productData.image !== undefined) updateFields.image = productData.image;
      if (productData.stockQuantity !== undefined) {
        updateFields.stockQuantity = productData.stockQuantity;
        updateFields.inStock = productData.stockQuantity > 0;
      }
      if (productData.unit !== undefined) updateFields.unit = productData.unit;
      if (productData.categoryId !== undefined) {
        updateFields.category = { connect: { id: productData.categoryId } };
      }

      return await tx.product.update({
        where: { id },
        data: updateFields,
        include: { tags: true, category: true },
      });
    });

    return this.mapToEntity(updated as Prisma.ProductGetPayload<{ include: { tags: true; category: true } }>);
  }

  async delete(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 1. Eliminar ítems de carrito
      await tx.cartItem.deleteMany({ where: { productId: id } });
      
      // 2. Desvincular de materiales del proyecto (set null)
      await tx.projectMaterial.updateMany({
        where: { productId: id },
        data: { productId: null },
      });

      // 3. Eliminar el producto (cascada automática a tags y reviews en PostgreSQL)
      await tx.product.delete({
        where: { id },
      });
    });
  }
}

