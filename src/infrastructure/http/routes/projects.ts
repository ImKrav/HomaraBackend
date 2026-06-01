// ============================================
// Homara — Projects HTTP Routes (TS)
// ============================================

import { Router } from "express";
import { ProjectController } from "../controllers/project.controller.js";
import { requireAuth, optionalAuth } from "../middlewares/auth.js";
import { validateZod } from "../middlewares/validateZod.js";
import { createProjectSchema, updateProjectSchema } from "../validators/project.validator.js";
import { cuidParamSchema, listProjectsQuerySchema } from "../validators/common.validator.js";

const router = Router();

/**
 * @openapi
 * /api/projects:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Listar proyectos del usuario
 *     description: Lista todos los proyectos del usuario especificado.
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: false
 *     responses:
 *       200:
 *         description: Lista de proyectos obtenida.
 */
router.get("/", optionalAuth, validateZod(listProjectsQuerySchema, "query"), ProjectController.list);

/**
 * @openapi
 * /api/projects/{id}:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Detalles de un proyecto
 *     description: Retorna los detalles de un proyecto calculado junto a su lista de materiales.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proyecto encontrado.
 *       404:
 *         description: Proyecto no encontrado.
 */
router.get("/:id", validateZod(cuidParamSchema, "params"), ProjectController.getDetail);

/**
 * @openapi
 * /api/projects:
 *   post:
 *     tags:
 *       - Projects
 *     summary: Crear un proyecto
 *     description: Crea un nuevo proyecto y calcula automáticamente los materiales necesarios basados en el área.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - area
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *               length:
 *                 type: number
 *               width:
 *                 type: number
 *               height:
 *                 type: number
 *               area:
 *                 type: number
 *               materialType:
 *                 type: string
 *               tileFormat:
 *                 type: string
 *               userId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Proyecto creado exitosamente.
 */
router.post(
  "/",
  requireAuth,
  validateZod(createProjectSchema),
  ProjectController.create
);

/**
 * @openapi
 * /api/projects/{id}:
 *   put:
 *     tags:
 *       - Projects
 *     summary: Actualizar proyecto
 *     description: Actualiza información de un proyecto. Si cambian las dimensiones, recalcula los materiales automáticamente.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proyecto actualizado.
 */
router.put(
  "/:id",
  requireAuth,
  validateZod(cuidParamSchema, "params"),
  validateZod(updateProjectSchema, "body"),
  ProjectController.update
);

/**
 * @openapi
 * /api/projects/{id}:
 *   delete:
 *     tags:
 *       - Projects
 *     summary: Eliminar proyecto
 *     description: Elimina un proyecto por ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proyecto eliminado.
 */
router.delete(
  "/:id",
  requireAuth,
  validateZod(cuidParamSchema, "params"),
  ProjectController.delete
);

export default router;
