import { Request, Response, NextFunction } from "express";
import { PrismaCategoryRepository } from "../../database/repositories/prisma-category.repository.js";
import { PrismaProductRepository } from "../../database/repositories/prisma-product.repository.js";
import { ListCategoriesUseCase, ListProductsUseCase, GetProductDetailUseCase } from "../../../application/use-cases/catalog.use-cases.js";

const categoryRepository = new PrismaCategoryRepository();
const productRepository = new PrismaProductRepository();

const listCategoriesUseCase = new ListCategoriesUseCase(categoryRepository);
const listProductsUseCase = new ListProductsUseCase(productRepository);
const getProductDetailUseCase = new GetProductDetailUseCase(productRepository);

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
}
