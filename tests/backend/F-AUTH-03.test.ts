import { describe, it, expect, beforeEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import { contextoExpress, errorDeNext, usuario } from "../test-helpers.js";

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

  it("CP-F-AUTH-03-01: Retorna 401 si no se provee cabecera Authorization", async () => {
    const { req, res, next } = contextoExpress();

    await requireAuth(req, res, next);

    const error = errorDeNext(next);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Token no provisto.");
    expect(findById).not.toHaveBeenCalled();
  });

  it("CP-F-AUTH-03-02: Retorna error cuando el token JWT ha caducado", async () => {
    const caducado = tokenDe({ id: "usr_001", email: "ana@homara.com", role: "CUSTOMER" }, { expiresIn: "-1s" });
    const { req, res, next } = contextoExpress(`Bearer ${caducado}`);

    await requireAuth(req, res, next);

    expect(errorDeNext(next)).toBeInstanceOf(jwt.TokenExpiredError);
    expect(findById).not.toHaveBeenCalled();
  });

  it("CP-F-AUTH-03-03: Retorna 401 si el usuario asociado al token no existe en la base de datos", async () => {
    findById.mockResolvedValue(null);
    const { req, res, next } = contextoExpress(
      `Bearer ${tokenDe({ id: "usr_borrado", email: "x@homara.com", role: "CUSTOMER" })}`
    );

    await requireAuth(req, res, next);

    const error = errorDeNext(next);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Usuario no encontrado o dado de baja.");
    expect(req.user).toBeUndefined();
  });

  it("CP-F-AUTH-03-04: Retorna 403 cuando un usuario cliente intenta acceder a rutas de administración", async () => {
    findById.mockResolvedValue(usuario({ role: "CUSTOMER" }));
    const { req, res, next } = contextoExpress(
      `Bearer ${tokenDe({ id: "usr_001", email: "ana@homara.com", role: "ADMIN" })}`
    );

    await requireAdmin(req, res, next);

    const error = errorDeNext(next);
    expect(error.statusCode).toBe(403);
    expect(error.message).toContain("permisos de administrador");
  });

  it("CP-F-AUTH-03-05: Permite el acceso cuando el usuario tiene rol ADMIN en base de datos", async () => {
    findById.mockResolvedValue(usuario({ role: "ADMIN" }));
    const { req, res, next } = contextoExpress(
      `Bearer ${tokenDe({ id: "usr_001", email: "ana@homara.com", role: "ADMIN" })}`
    );

    await requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({ id: "usr_001", role: "ADMIN" });
  });

  it("CP-F-AUTH-03-06: Traduce fallos internos no controlados a error 500", async () => {
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

  it("CP-F-AUTH-03-04b: Valida el rol real de base de datos ignorando el payload del token", async () => {
    findById.mockResolvedValue(usuario({ role: "CUSTOMER" }));
    const { req, res, next } = contextoExpress(
      `Bearer ${tokenDe({ id: "usr_001", email: "ana@homara.com", role: "ADMIN" })}`
    );

    await requireAdmin(req, res, next);

    expect(errorDeNext(next).statusCode).toBe(403);
  });
});
