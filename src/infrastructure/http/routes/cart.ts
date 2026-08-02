// ============================================
// Homara — Cart HTTP Routes (TS)
// ============================================

import { Router } from "express";
import { CartController } from "../controllers/cart.controller.js";
import { requireAuth, optionalAuth } from "../middlewares/auth.js";
import { validateZod } from "../middlewares/validateZod.js";
import { addItemSchema, updateItemQuantitySchema } from "../validators/cart.validator.js";
import { itemIdParamSchema } from "../validators/common.validator.js";

const router = Router();

/**
 * @openapi
 * /cart:
 *   get:
 *     tags:
 *       - Cart
 *     summary: Obtener el carrito
 *     description: Devuelve el carrito activo del usuario actual, calculando subtotal, envío y total.
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: false
 *     responses:
 *       200:
 *         description: Carrito retornado.
 */
router.get("/", optionalAuth, CartController.get);

/**
 * @openapi
 * /cart/items:
 *   post:
 *     tags:
 *       - Cart
 *     summary: Agregar item al carrito
 *     description: Añade un producto al carrito del usuario o incrementa su cantidad si ya se encuentra agregado.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *               userId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Item agregado al carrito.
 */
router.post(
  "/items",
  requireAuth,
  validateZod(addItemSchema),
  CartController.addItem
);

/**
 * @openapi
 * /cart/items/{itemId}:
 *   put:
 *     tags:
 *       - Cart
 *     summary: Actualizar cantidad de un item
 *     description: Sobreescribe la cantidad de un producto específico en el carrito.
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cantidad actualizada exitosamente.
 */
router.put(
  "/items/:itemId",
  requireAuth,
  validateZod(itemIdParamSchema, "params"),
  validateZod(updateItemQuantitySchema, "body"),
  CartController.updateItemQuantity
);

/**
 * @openapi
 * /cart/items/{itemId}:
 *   delete:
 *     tags:
 *       - Cart
 *     summary: Eliminar item
 *     description: Remueve por completo un producto del carrito.
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item removido exitosamente.
 */
router.delete(
  "/items/:itemId",
  requireAuth,
  validateZod(itemIdParamSchema, "params"),
  CartController.removeItem
);

export default router;
