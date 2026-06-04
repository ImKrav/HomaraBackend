// ============================================
// Homara — Products HTTP Routes (TS)
// ============================================

import { Router } from "express";
import { CatalogController } from "../controllers/catalog.controller.js";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { validateZod } from "../middlewares/validateZod.js";
import { createReviewSchema, createProductSchema, updateProductSchema } from "../validators/catalog.validator.js";

const router = Router();


/**
 * @openapi
 * /products:
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
router.get("/storefront", CatalogController.getStorefrontProducts);
router.get("/", CatalogController.listProducts);

/**
 * @openapi
 * /products/{id}:
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

router.get("/:id/reviews", CatalogController.getProductReviews);
router.post("/:id/reviews", requireAuth, validateZod(createReviewSchema), CatalogController.createReview);

// Rutas de administración de catálogo
router.post("/", requireAdmin, validateZod(createProductSchema), CatalogController.createProduct);
router.put("/:id", requireAdmin, validateZod(updateProductSchema), CatalogController.updateProduct);
router.delete("/:id", requireAdmin, CatalogController.deleteProduct);

export default router;

