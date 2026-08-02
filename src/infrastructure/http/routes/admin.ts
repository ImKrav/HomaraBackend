// ============================================
// Homara — Admin HTTP Routes (TS)
// ============================================

import { Router } from "express";
import { AdminController } from "../controllers/admin.controller.js";
import { requireAdmin } from "../middlewares/auth.js";

const router = Router();

/**
 * @openapi
 * /admin/metrics:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Obtener métricas del dashboard
 *     description: Retorna métricas generales como ventas del mes, pedidos activos, total de productos y clientes nuevos.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métricas obtenidas con éxito.
 *       401:
 *         description: No autorizado.
 *       403:
 *         description: Se requieren permisos de administrador.
 */
router.get("/metrics", requireAdmin, AdminController.getMetrics);

/**
 * @openapi
 * /admin/inventory:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Reporte de Inventario
 *     description: Lista todos los productos y calcula alertas de stock bajo y sin stock.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reporte de inventario obtenido con éxito.
 *       401:
 *         description: No autorizado.
 *       403:
 *         description: Se requieren permisos de administrador.
 */
router.get("/inventory", requireAdmin, AdminController.getInventoryReport);

export default router;
