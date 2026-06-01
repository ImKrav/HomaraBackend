// ============================================
// Homara — Users & Auth HTTP Routes (TS)
// ============================================

import { Router } from "express";
import { z } from "zod";
import { AuthController } from "../controllers/auth.controller.js";
import { validateZod } from "../middlewares/validateZod.js";
import { registerSchema, loginSchema } from "../validators/auth.validator.js";
import { requireAuth, optionalAuth } from "../middlewares/auth.js";

const router = Router();

/**
 * @openapi
 * /api/users/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Registrar un nuevo usuario
 *     description: Crea una cuenta de usuario, inicializa su carrito y genera un token JWT.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               zipCode:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario registrado con éxito.
 *       400:
 *         description: Datos inválidos o correo ya registrado.
 */
router.post(
  "/register",
  validateZod(registerSchema),
  AuthController.register
);

/**
 * @openapi
 * /api/users/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Iniciar sesión
 *     description: Autentica al usuario por email y contraseña, retornando un token JWT.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Autenticación exitosa.
 *       401:
 *         description: Credenciales incorrectas.
 */
router.post(
  "/login",
  validateZod(loginSchema),
  AuthController.login
);

/**
 * @openapi
 * /api/users/me:
 *   get:
 *     tags:
 *       - Users
 *     summary: Obtener perfil del usuario autenticado
 *     description: Retorna la información del perfil del usuario actualmente autenticado.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario obtenido con éxito.
 *       401:
 *         description: No autorizado.
 */
router.get("/me", requireAuth, AuthController.getMe);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags:
 *       - Users
 *     summary: Obtener el perfil de un usuario por ID
 *     description: Retorna los datos de un usuario por su ID, con el conteo de sus proyectos y órdenes. Admite "me" para el usuario activo (demo o autenticado).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Perfil obtenido con éxito.
 *       404:
 *         description: Usuario no encontrado.
 */
router.get("/:id", optionalAuth, validateZod(z.object({ id: z.string().min(1, "ID es requerido") }), "params"), AuthController.getById);

/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     tags:
 *       - Users
 *     summary: Actualizar perfil de usuario
 *     description: Modifica los campos que componen la información personal de un usuario.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuario actualizado.
 */
router.put("/:id", requireAuth, validateZod(z.object({ id: z.string().min(1, "ID es requerido") }), "params"), AuthController.update);

export default router;
