// ============================================
// Homara — Categories HTTP Routes (TS)
// ============================================

import { Router } from "express";
import { CatalogController } from "../controllers/catalog.controller.js";

const router = Router();

/**
 * @openapi
 * /api/categories:
 *   get:
 *     tags:
 *       - Categories
 *     summary: Listar todas las categorías
 *     description: Retorna la lista de todas las categorías disponibles para agrupar productos.
 *     responses:
 *       200:
 *         description: Lista de categorías obtenida con éxito.
 */
router.get("/", CatalogController.listCategories);

export default router;
