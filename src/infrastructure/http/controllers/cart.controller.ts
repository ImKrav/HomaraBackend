import { Request, Response, NextFunction } from "express";
import { PrismaCartRepository } from "../../database/repositories/prisma-cart.repository.js";
import { GetCartUseCase, AddCartItemUseCase, UpdateCartItemQuantityUseCase, RemoveCartItemUseCase } from "../../../application/use-cases/cart.use-cases.js";

import { ICartRepository } from "../../../domain/repositories/cart-repository.interface.js";

let cartRepository: ICartRepository = new PrismaCartRepository();

let getCartUseCase = new GetCartUseCase(cartRepository);
let addCartItemUseCase = new AddCartItemUseCase(cartRepository);
let updateCartItemQuantityUseCase = new UpdateCartItemQuantityUseCase(cartRepository);
let removeCartItemUseCase = new RemoveCartItemUseCase(cartRepository);

export function setCartRepositoryForTests(repo: ICartRepository) {
  cartRepository = repo;
  getCartUseCase = new GetCartUseCase(cartRepository);
  addCartItemUseCase = new AddCartItemUseCase(cartRepository);
  updateCartItemQuantityUseCase = new UpdateCartItemQuantityUseCase(cartRepository);
  removeCartItemUseCase = new RemoveCartItemUseCase(cartRepository);
}

export class CartController {
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || (req.query.userId as string);
      if (!userId) {
        return res.json({
          success: true,
          data: {
            id: "guest",
            items: [],
            subtotal: 0,
            shipping: 0,
            total: 0,
            itemCount: 0
          }
        });
      }
      const result = await getCartUseCase.execute(userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async addItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, quantity } = req.body;
      const userId = req.user!.id;
      const result = await addCartItemUseCase.execute(userId, productId, quantity);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async updateItemQuantity(req: Request, res: Response, next: NextFunction) {
    try {
      const { quantity } = req.body;
      const userId = req.user!.id;
      const result = await updateCartItemQuantityUseCase.execute(req.params.itemId as string, userId, quantity);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async removeItem(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      await removeCartItemUseCase.execute(req.params.itemId as string, userId);
      res.json({ success: true, message: "Item eliminado del carrito" });
    } catch (error) {
      next(error);
    }
  }
}
