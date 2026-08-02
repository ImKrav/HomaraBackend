import { IReviewRepository } from "../../../domain/repositories/review-repository.interface.js";
import { Review } from "../../../domain/entities/review.js";
import { prisma } from "../prisma-client.js";

export class PrismaReviewRepository implements IReviewRepository {
  async create(data: { userId: string; productId: string; rating: number; comment?: string }): Promise<Review> {
    const r = await prisma.review.create({
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

  async findByUserAndProduct(userId: string, productId: string): Promise<Review | null> {
    const r = await prisma.review.findUnique({
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

  async findByProductId(productId: string): Promise<Review[]> {
    const reviews = await prisma.review.findMany({
      where: { productId },
      include: {
        user: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return reviews.map((r) => new Review(
      r.id,
      r.rating,
      r.comment,
      r.createdAt,
      r.userId,
      r.productId,
      r.user?.firstName,
      r.user?.lastName
    ));
  }

  async getAverageRatingAndCount(productId: string): Promise<{ avg: number; count: number }> {
    const aggregates = await prisma.review.aggregate({
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
