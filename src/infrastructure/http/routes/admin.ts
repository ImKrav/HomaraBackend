// ============================================
// Homara — Admin HTTP Routes (TS)
// ============================================

import { Router } from "express";
import { AdminController } from "../controllers/admin.controller.js";

const router = Router();

/**
 * @openapi
 * /api/admin/metrics:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Obtener métricas del dashboard
 *     description: Retorna métricas generales como ventas del mes, pedidos activos, total de productos y clientes nuevos.
 *     responses:
 *       200:
 *         description: Métricas obtenidas con éxito.
 */
router.get("/metrics", AdminController.getMetrics);

/**
 * @openapi
 * /api/admin/inventory:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Reporte de Inventario
 *     description: Lista todos los productos y calcula alertas de stock bajo y sin stock.
 *     responses:
 *       200:
 *         description: Reporte de inventario obtenido con éxito.
 */
router.get("/inventory", AdminController.getInventoryReport);

export default router;
