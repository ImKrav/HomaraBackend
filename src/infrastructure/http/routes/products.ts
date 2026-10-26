// ============================================
// Homara — Products HTTP Routes (TS)
// ============================================

import { Router } from "express";
import { CatalogController } from "../controllers/catalog.controller.js";
import { requireAuth, requireAdmin, optionalAuth } from "../middlewares/auth.js";
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
router.get("/", optionalAuth, CatalogController.listProducts);

/**
 * @openapi
 * /products/storefront:
 *   get:
 *     tags:
 *       - Products
 *     summary: Vitrina de la portada
 *     description: Productos recomendados, en oferta y más vendidos.
 *     responses:
 *       200:
 *         description: Secciones recommended, offers y bestSellers.
 */
router.get("/storefront", CatalogController.getStorefrontProducts);

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
router.get("/:id", optionalAuth, CatalogController.getProductDetail);

/**
 * @openapi
 * /products/{id}/reviews:
 *   get:
 *     tags:
 *       - Products
 *     summary: Reseñas de un producto
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de reseñas.
 *   post:
 *     tags:
 *       - Products
 *     summary: Calificar un producto
 *     description: Una reseña por usuario y producto; calificación entera de 1 a 5.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Reseña creada.
 *       400:
 *         description: Calificación fuera de rango o reseña repetida.
 *       401:
 *         description: No autenticado.
 */
router.get("/:id/reviews", CatalogController.getProductReviews);
router.post("/:id/reviews", requireAuth, validateZod(createReviewSchema), CatalogController.createReview);

// Rutas de administración de catálogo

/**
 * @openapi
 * /products:
 *   post:
 *     tags:
 *       - Products
 *     summary: Crear producto (ADMIN)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, description, price, stockQuantity, unit, categoryId]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               price: { type: integer, minimum: 1 }
 *               originalPrice: { type: integer, nullable: true }
 *               image: { type: string }
 *               stockQuantity: { type: integer, minimum: 0 }
 *               unit: { type: string }
 *               categoryId: { type: string }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Producto creado.
 *       400:
 *         description: Datos inválidos (precio debe ser mayor a 0).
 *       403:
 *         description: Requiere rol ADMIN.
 */
router.post("/", requireAdmin, validateZod(createProductSchema), CatalogController.createProduct);

/**
 * @openapi
 * /products/{id}:
 *   put:
 *     tags:
 *       - Products
 *     summary: Editar producto (ADMIN)
 *     description: Parche parcial; si cambia stockQuantity se recalcula inStock.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Producto actualizado.
 *       403:
 *         description: Requiere rol ADMIN.
 *       404:
 *         description: Producto no encontrado.
 *   delete:
 *     tags:
 *       - Products
 *     summary: Eliminar producto (ADMIN)
 *     description: Un producto con pedidos no se puede eliminar (400) para conservar el historial.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Producto eliminado.
 *       400:
 *         description: El producto está referenciado por pedidos.
 *       403:
 *         description: Requiere rol ADMIN.
 *       404:
 *         description: Producto no encontrado.
 */
router.put("/:id", requireAdmin, validateZod(updateProductSchema), CatalogController.updateProduct);
router.delete("/:id", requireAdmin, CatalogController.deleteProduct);

export default router;

