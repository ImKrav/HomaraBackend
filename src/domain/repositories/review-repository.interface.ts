import { Review } from "../entities/review.js";

export interface IReviewRepository {
  create(data: { userId: string; productId: string; rating: number; comment?: string }): Promise<Review>;
  findByUserAndProduct(userId: string, productId: string): Promise<Review | null>;
  findByProductId(productId: string): Promise<Review[]>;
  getAverageRatingAndCount(productId: string): Promise<{ avg: number; count: number }>;
}
