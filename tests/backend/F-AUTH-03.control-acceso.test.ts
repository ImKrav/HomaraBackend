// ============================================================================
// F-AUTH-03 · Control de acceso por rol — Backend
// Grafo:   05_F-AUTH-03_BACKEND_Control_de_acceso_por_rol.drawio
// Unidad:  requireAuth / requireAdmin (middlewares de autorización)
// Métrica: N=20  A=24  P=5  →  V(G) = 24 − 20 + 2 = 6
// Cobertura de ruta básica: 6 caminos independientes → 6 casos de prueba
// Trazabilidad: RF03 · HU3 · ESC03 · RNF03–ESC38
// ============================================================================
import { describe, it, expect, beforeEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import { contextoExpress, errorDeNext, usuario } from "../_ayudas.js";

// El middleware instancia PrismaUserRepository al cargar el módulo: se sustituye.
const findById = vi.fn();
vi.mock("../../src/infrastructure/database/repositories/prisma-user.repository.js", () => ({
  PrismaUserRepository: class {
    findById = (...a: any[]) => findById(...a);
  },
}));

const { requireAuth, requireAdmin } = await import(
  "../../src/infrastructure/http/middlewares/auth.js"
);
const { AppError } = await import("../../src/shared/errors/AppError.js");

const SECRETO = process.env.JWT_SECRET || "homara_jwt_secret_key_2026_secure";
const tokenDe = (payload: object, opciones: jwt.SignOptions = { expiresIn: "7d" }) =>
  jwt.sign(payload, SECRETO, opciones);

describe("F-AUTH-03 · Control de acceso por rol", () => {
  beforeEach(() => {
    findById.mockReset();
  });

  it("CP-F-AUTH-03-01 · camino 1,2,3,15,16,18,F · Paso 2 = NO → sin cabecera Authorization se corta en 401", async () => {
    const { req, res, next } = contextoExpress();          // sin cabecera

    await requireAuth(req, res, next);

    const error = errorDeNext(next);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Token no provisto.");
    expect(findById).not.toHaveBeenCalled();               // no se consulta la base de datos
  });

  it("CP-F-AUTH-03-02 · camino 1,2,4,5,6,7,15,16,18,F · Paso 6 = NO → credencial caducada", async () => {
    const caducado = tokenDe({ id: "usr_001", email: "ana@homara.com", role: "CUSTOMER" }, { expiresIn: "-1s" });
    const { req, res, next } = contextoExpress(`Bearer ${caducado}`);

    await requireAuth(req, res, next);

    expect(errorDeNext(next)).toBeInstanceOf(jwt.TokenExpiredError);
    expect(findById).not.toHaveBeenCalled();
  });

  it("CP-F-AUTH-03-03 · camino 1,2,4,5,6,8,9,10,15,16,18,F · Paso 6 = SI, Paso 9 = NO → el usuario ya no existe", async () => {
    findById.mockResolvedValue(null);                      // fuerza Paso 9 = NO
    const { req, res, next } = contextoExpress(
      `Bearer ${tokenDe({ id: "usr_borrado", email: "x@homara.com", role: "CUSTOMER" })}`
    );

    await requireAuth(req, res, next);

    const error = errorDeNext(next);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Usuario no encontrado o dado de baja.");
    expect(req.user).toBeUndefined();
  });

  it("CP-F-AUTH-03-04 · camino 1,2,4,5,6,8,9,11,12,13,15,16,18,F · Paso 12 = NO → cliente sin permisos recibe 403", async () => {
    findById.mockResolvedValue(usuario({ role: "CUSTOMER" }));
    const { req, res, next } = contextoExpress(
      `Bearer ${tokenDe({ id: "usr_001", email: "ana@homara.com", role: "ADMIN" })}`
    );

    await requireAdmin(req, res, next);

    const error = errorDeNext(next);
    expect(error.statusCode).toBe(403);
    expect(error.message).toContain("permisos de administrador");
  });

  it("CP-F-AUTH-03-05 · camino 1,2,4,5,6,8,9,11,12,14,F · Paso 12 = SI → el administrador pasa al controlador", async () => {
    findById.mockResolvedValue(usuario({ role: "ADMIN" }));
    const { req, res, next } = contextoExpress(
      `Bearer ${tokenDe({ id: "usr_001", email: "ana@homara.com", role: "ADMIN" })}`
    );

    await requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith();                   // next() sin error
    expect(req.user).toMatchObject({ id: "usr_001", role: "ADMIN" });
  });

  it("CP-F-AUTH-03-06 · arista 15→17 · Paso 15 = NO → un fallo ajeno a la sesión se traduce a 500", async () => {
    // Rama NO del nodo 15: el error no es AppError ni de JWT, así que se envuelve en un 500.
    findById.mockRejectedValue(new TypeError("la base de datos no responde"));
    const { req, res, next } = contextoExpress(
      `Bearer ${tokenDe({ id: "usr_001", email: "ana@homara.com", role: "CUSTOMER" })}`
    );

    await requireAuth(req, res, next);

    const error = errorDeNext(next);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(500);
    expect(error.message).toBe("Error durante la autenticación.");
  });

  it("CP-F-AUTH-03-04b · el rol que manda es el de la base de datos, no el de la credencial", async () => {
    // Una credencial manipulada que dice ADMIN no basta: el nodo 12 lee req.user, que viene del nodo 8.
    findById.mockResolvedValue(usuario({ role: "CUSTOMER" }));
    const { req, res, next } = contextoExpress(
      `Bearer ${tokenDe({ id: "usr_001", email: "ana@homara.com", role: "ADMIN" })}`
    );

    await requireAdmin(req, res, next);

    expect(errorDeNext(next).statusCode).toBe(403);
  });
});
