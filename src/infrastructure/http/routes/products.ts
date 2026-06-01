// ============================================
// Homara — Products HTTP Routes (TS)
// ============================================

import { Router } from "express";
import { CatalogController } from "../controllers/catalog.controller.js";

const router = Router();

/**
 * @openapi
 * /api/products:
 *   get:
 *     tags:
 *       - Products
 *     summary: Buscar y filtrar productos
 *     description: Retorna la lista de productos filtrando opcionalmente por categoría (?category=slug), búsqueda de texto (?q=nombre) o tag (?tag=oferta).
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de productos filtrada obtenida con éxito.
 */
router.get("/", CatalogController.listProducts);

/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     tags:
 *       - Products
 *     summary: Detalles del producto
 *     description: Obtiene la información técnica y de precio completa de un artículo específico por su ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Producto obtenido.
 *       404:
 *         description: Producto no encontrado.
 */
router.get("/:id", CatalogController.getProductDetail);

export default router;
