import { Request, Response, NextFunction } from "express";
import { PrismaOrderRepository } from "../../database/repositories/prisma-order.repository.js";
import { PrismaCartRepository } from "../../database/repositories/prisma-cart.repository.js";
import { PrismaProductRepository } from "../../database/repositories/prisma-product.repository.js";
import { ListOrdersUseCase, GetOrderDetailUseCase, CreateOrderUseCase, UpdateOrderStatusUseCase } from "../../../application/use-cases/order.use-cases.js";

const orderRepository = new PrismaOrderRepository();
const cartRepository = new PrismaCartRepository();
const productRepository = new PrismaProductRepository();

const listOrdersUseCase = new ListOrdersUseCase(orderRepository);
const getOrderDetailUseCase = new GetOrderDetailUseCase(orderRepository);
const createOrderUseCase = new CreateOrderUseCase(orderRepository, cartRepository, productRepository);
const updateOrderStatusUseCase = new UpdateOrderStatusUseCase(orderRepository);

const DEMO_USER_ID = "demo-user-001";

export class OrderController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || (req.query.userId as string) || DEMO_USER_ID;
      const isAdmin = req.query.admin === "true";
      const result = await listOrdersUseCase.execute({ userId, admin: isAdmin });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await getOrderDetailUseCase.execute(req.params.id as string);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || req.body.userId || DEMO_USER_ID;
      const result = await createOrderUseCase.execute(userId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const result = await updateOrderStatusUseCase.execute(req.params.id as string, status);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
