// ============================================
// Homara — Users & Auth HTTP Routes (TS)
// ============================================

import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { AuthController } from "../controllers/auth.controller.js";
import { validateZod } from "../middlewares/validateZod.js";
import { registerSchema, loginSchema, updateProfileSchema } from "../validators/auth.validator.js";
import { requireAuth } from "../middlewares/auth.js";
import { AppError } from "../../../shared/errors/AppError.js";

const router = Router();

// Fuerza bruta: 10 intentos FALLIDOS por IP y correo cada 15 min (los exitosos no cuentan).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}|${String(req.body?.email ?? "").toLowerCase().trim()}`,
  handler: (_req, _res, next) =>
    next(new AppError("Demasiados intentos de inicio de sesión. Intente de nuevo en 15 minutos.", 429)),
});

/**
 * @openapi
 * /users/register:
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
 * /users/login:
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
 *       429:
 *         description: Demasiados intentos fallidos (10 por IP y correo cada 15 min).
 */
router.post(
  "/login",
  loginLimiter,
  validateZod(loginSchema),
  AuthController.login
);

/**
 * @openapi
 * /users/me:
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
 * /users/{id}:
 *   get:
 *     tags:
 *       - Users
 *     summary: Obtener el perfil de un usuario por ID
 *     description: Retorna los datos de un usuario por su ID, con el conteo de sus proyectos y órdenes. Solo el propio usuario o un ADMIN. Admite "me".
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
 *         description: Perfil obtenido con éxito.
 *       401:
 *         description: No autenticado.
 *       403:
 *         description: El perfil pertenece a otro usuario.
 *       404:
 *         description: Usuario no encontrado.
 */
router.get("/:id", requireAuth, validateZod(z.object({ id: z.string().min(1, "ID es requerido") }), "params"), AuthController.getById);

/**
 * @openapi
 * /users/{id}:
 *   put:
 *     tags:
 *       - Users
 *     summary: Actualizar perfil de usuario
 *     description: Modifica la información personal del propio usuario (o de cualquiera, si es ADMIN). Nunca devuelve la contraseña.
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
 *         description: Usuario actualizado.
 *       400:
 *         description: Datos inválidos (p. ej. nombre vacío).
 *       403:
 *         description: El perfil pertenece a otro usuario.
 */
router.put(
  "/:id",
  requireAuth,
  validateZod(z.object({ id: z.string().min(1, "ID es requerido") }), "params"),
  validateZod(updateProfileSchema),
  AuthController.update
);

export default router;
