// ============================================
// Homara — Orders HTTP Routes (TS)
// ============================================

import { Router } from "express";
import { OrderController } from "../controllers/order.controller.js";
import { requireAuth, requireAdmin, optionalAuth } from "../middlewares/auth.js";
import { validateZod } from "../middlewares/validateZod.js";
import { createOrderSchema, updateOrderStatusSchema } from "../validators/order.validator.js";
import { cuidParamSchema, listOrdersQuerySchema } from "../validators/common.validator.js";

const router = Router();

/**
 * @openapi
 * /orders:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Listar pedidos
 *     description: Obtiene la lista de pedidos de un usuario, o todos si el usuario es administrador y pasa el query param ?admin=true.
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: admin
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Lista de pedidos obtenida exitosamente.
 */
router.get("/", optionalAuth, validateZod(listOrdersQuerySchema, "query"), OrderController.list);

/**
 * @openapi
 * /orders/{id}:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Detalles de un pedido
 *     description: Consigue la información detallada de una orden de compra por ID o por Número de Orden (ej. ORD-2024-001).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalle del pedido.
 *       404:
 *         description: Pedido no encontrado.
 */
router.get("/:id", OrderController.getDetail);

/**
 * @openapi
 * /orders:
 *   post:
 *     tags:
 *       - Orders
 *     summary: Crear un pedido (Checkout)
 *     description: Convierte los items en el carrito activo del usuario en una nueva orden de compra y la registra.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethod
 *             properties:
 *               paymentMethod:
 *                 type: string
 *     responses:
 *       201:
 *         description: Orden procesada y creada.
 */
router.post(
  "/",
  requireAuth,
  validateZod(createOrderSchema),
  OrderController.create
);

/**
 * @openapi
 * /orders/{id}/status:
 *   put:
 *     tags:
 *       - Orders
 *     summary: Actualizar estado de una orden
 *     description: Actualiza el estado de seguimiento de una orden.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Estado modificado y guardado transaccionalmente.
 */
router.put(
  "/:id/status",
  requireAdmin,
  validateZod(cuidParamSchema, "params"),
  validateZod(updateOrderStatusSchema, "body"),
  OrderController.updateStatus
);

export default router;
