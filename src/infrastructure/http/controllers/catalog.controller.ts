import { Request, Response, NextFunction } from "express";
import { PrismaCategoryRepository } from "../../database/repositories/prisma-category.repository.js";
import { PrismaProductRepository } from "../../database/repositories/prisma-product.repository.js";
import { PrismaReviewRepository } from "../../database/repositories/prisma-review.repository.js";
import { PrismaCartRepository } from "../../database/repositories/prisma-cart.repository.js";
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

import { ICategoryRepository } from "../../../domain/repositories/category-repository.interface.js";
import { IProductRepository } from "../../../domain/repositories/product-repository.interface.js";
import { IReviewRepository } from "../../../domain/repositories/review-repository.interface.js";
import { ICartRepository } from "../../../domain/repositories/cart-repository.interface.js";

let categoryRepository: ICategoryRepository = new PrismaCategoryRepository();
let productRepository: IProductRepository = new PrismaProductRepository();
let reviewRepository: IReviewRepository = new PrismaReviewRepository();
let cartRepository: ICartRepository = new PrismaCartRepository();

let listCategoriesUseCase = new ListCategoriesUseCase(categoryRepository);
let listProductsUseCase = new ListProductsUseCase(productRepository, cartRepository);
let getProductDetailUseCase = new GetProductDetailUseCase(productRepository, cartRepository);
let createProductReviewUseCase = new CreateProductReviewUseCase(productRepository, reviewRepository);
let getProductReviewsUseCase = new GetProductReviewsUseCase(reviewRepository);
let getStorefrontProductsUseCase = new GetStorefrontProductsUseCase(productRepository);
let createProductUseCase = new CreateProductUseCase(productRepository);
let updateProductUseCase = new UpdateProductUseCase(productRepository);
let deleteProductUseCase = new DeleteProductUseCase(productRepository);

export function setCatalogRepositoriesForTests(repos: {
  categoryRepo?: ICategoryRepository;
  productRepo?: IProductRepository;
  reviewRepo?: IReviewRepository;
  cartRepo?: ICartRepository;
}) {
  if (repos.categoryRepo) categoryRepository = repos.categoryRepo;
  if (repos.productRepo) productRepository = repos.productRepo;
  if (repos.reviewRepo) reviewRepository = repos.reviewRepo;
  if (repos.cartRepo) cartRepository = repos.cartRepo;
  listCategoriesUseCase = new ListCategoriesUseCase(categoryRepository);
  listProductsUseCase = new ListProductsUseCase(productRepository, cartRepository);
  getProductDetailUseCase = new GetProductDetailUseCase(productRepository, cartRepository);
  createProductReviewUseCase = new CreateProductReviewUseCase(productRepository, reviewRepository);
  getProductReviewsUseCase = new GetProductReviewsUseCase(reviewRepository);
  getStorefrontProductsUseCase = new GetStorefrontProductsUseCase(productRepository);
  createProductUseCase = new CreateProductUseCase(productRepository);
  updateProductUseCase = new UpdateProductUseCase(productRepository);
  deleteProductUseCase = new DeleteProductUseCase(productRepository);
}

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
      }, req.user?.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getProductDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await getProductDetailUseCase.execute(req.params.id as string, req.user?.id);
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

