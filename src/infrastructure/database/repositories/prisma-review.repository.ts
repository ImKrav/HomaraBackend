import { IReviewRepository } from "../../../domain/repositories/review-repository.interface.js";
import { Review } from "../../../domain/entities/review.js";
import { prisma } from "../prisma-client.js";

export class PrismaReviewRepository implements IReviewRepository {
  constructor(private readonly db = prisma) {}

  private toEntity(r: any): Review {
    return new Review(
      r.id,
      r.rating,
      r.comment,
      r.createdAt,
      r.userId,
      r.productId,
      r.user?.firstName,
      r.user?.lastName
    );
  }

  async create(data: { userId: string; productId: string; rating: number; comment?: string }): Promise<Review> {
    const r = await this.db.review.create({
      data: {
        userId: data.userId,
        productId: data.productId,
        rating: data.rating,
        comment: data.comment ?? null
      },
      include: {
        user: true
      }
    });

    return this.toEntity(r);
  }

  async findByUserAndProduct(userId: string, productId: string): Promise<Review | null> {
    const r = await this.db.review.findUnique({
      where: {
        userId_productId: {
          userId,
          productId
        }
      },
      include: {
        user: true
      }
    });

    if (!r) return null;
    return this.toEntity(r);
  }

  async findByProductId(productId: string): Promise<Review[]> {
    const reviews = await this.db.review.findMany({
      where: { productId },
      include: {
        user: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return reviews.map((r) => this.toEntity(r));
  }

  async getAverageRatingAndCount(productId: string): Promise<{ avg: number; count: number }> {
    const aggregates = await this.db.review.aggregate({
      where: { productId },
      _avg: {
        rating: true
      },
      _count: {
        rating: true
      }
    });

    return {
      avg: aggregates._avg.rating || 0,
      count: aggregates._count.rating || 0
    };
  }
}
