import { Request, Response, NextFunction } from "express";
import { PrismaCategoryRepository } from "../../database/repositories/prisma-category.repository.js";
import { PrismaProductRepository } from "../../database/repositories/prisma-product.repository.js";
import { PrismaReviewRepository } from "../../database/repositories/prisma-review.repository.js";
import {
  ListCategoriesUseCase,
  ListProductsUseCase,
  GetProductDetailUseCase,
  CreateProductReviewUseCase,
  GetProductReviewsUseCase,
  GetStorefrontProductsUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
  DeleteProductUseCase
} from "../../../application/use-cases/catalog.use-cases.js";

const categoryRepository = new PrismaCategoryRepository();
const productRepository = new PrismaProductRepository();
const reviewRepository = new PrismaReviewRepository();

const listCategoriesUseCase = new ListCategoriesUseCase(categoryRepository);
const listProductsUseCase = new ListProductsUseCase(productRepository);
const getProductDetailUseCase = new GetProductDetailUseCase(productRepository);
const createProductReviewUseCase = new CreateProductReviewUseCase(productRepository, reviewRepository);
const getProductReviewsUseCase = new GetProductReviewsUseCase(reviewRepository);
const getStorefrontProductsUseCase = new GetStorefrontProductsUseCase(productRepository);
const createProductUseCase = new CreateProductUseCase(productRepository);
const updateProductUseCase = new UpdateProductUseCase(productRepository);
const deleteProductUseCase = new DeleteProductUseCase(productRepository);

export class CatalogController {
  static async listCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await listCategoriesUseCase.execute();
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async listProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { category, q, tag } = req.query;
      const result = await listProductsUseCase.execute({
        categorySlug: category as string,
        query: q as string,
        tag: tag as string
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getProductDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await getProductDetailUseCase.execute(req.params.id as string);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getStorefrontProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await getStorefrontProductsUseCase.execute();
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async createReview(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const productId = req.params.id as string;
      const { rating, comment } = req.body;
      const result = await createProductReviewUseCase.execute(userId, productId, rating, comment);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getProductReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const productId = req.params.id as string;
      const result = await getProductReviewsUseCase.execute(productId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await createProductUseCase.execute(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await updateProductUseCase.execute(req.params.id as string, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      await deleteProductUseCase.execute(req.params.id as string);
      res.json({ success: true, message: "Producto eliminado exitosamente" });
    } catch (error) {
      next(error);
    }
  }
}

