import { vi, beforeEach } from "vitest";
import { test, expect } from "./harness.js";
import { usuario, contextoExpress, errorDeNext } from "./helpers.js";
import { mockUsuarios, reiniciarRepositorios } from "./mocks/repositorios.js";
import jwt from "jsonwebtoken";
import { optionalAuth, requireAuth } from "../src/infrastructure/http/middlewares/auth.js";
import { AppError } from "../src/shared/errors/AppError.js";

// El middleware construye `new PrismaUserRepository()` al importarse; se mockea
// el módulo para que ese constructor devuelva el doble compartido.
vi.mock("../src/infrastructure/database/repositories/prisma-user.repository.js", async () => {
  const { mockUsuarios } = await import("./mocks/repositorios.js");
  return { PrismaUserRepository: vi.fn(() => mockUsuarios) };
});

beforeEach(reiniciarRepositorios);

const SECRETO = process.env.JWT_SECRET || "homara_jwt_secret_key_2026_secure";
const tokenDe = (payload: object, opciones: jwt.SignOptions = { expiresIn: "7d" }) =>
  jwt.sign(payload, SECRETO, opciones);

test("UNIT-AUTH-01", "optionalAuth pasa de largo si no hay cabecera Authorization", async () => {
  // Arrange
  const { req, res, next } = contextoExpress();

  // Act
  await optionalAuth(req, res, next);

  // Assert
  expect(req.user).toBe(undefined);
  expect(next.mock.calls.length).toBe(1);
  expect(next.mock.calls[0][0]).toBe(undefined);
});

test("UNIT-AUTH-02", "optionalAuth ignora cabeceras que no comienzan con Bearer", async () => {
  // Arrange
  const { req, res, next } = contextoExpress("Basic some-credentials");

  // Act
  await optionalAuth(req, res, next);

  // Assert
  expect(req.user).toBe(undefined);
  expect(next.mock.calls.length).toBe(1);
});

test("UNIT-AUTH-03", "optionalAuth autentica al usuario cuando el token es válido y existe", async () => {
  // Arrange
  const u = usuario({ id: "usr_opt", role: "CUSTOMER", firstName: "Maria", lastName: "Gomez" });
  mockUsuarios.findById.mockResolvedValue(u);
  const token = tokenDe({ id: "usr_opt", email: u.email, role: u.role });
  const { req, res, next } = contextoExpress(`Bearer ${token}`);

  // Act
  await optionalAuth(req, res, next);

  // Assert
  expect(next.mock.calls.length).toBe(1);
  expect(req.user?.id).toBe("usr_opt");
  expect(req.user?.email).toBe(u.email);
  expect(req.user?.role).toBe("CUSTOMER");
  expect(req.user?.firstName).toBe("Maria");
  expect(req.user?.lastName).toBe("Gomez");
});

test("UNIT-AUTH-04", "optionalAuth traga silenciosamente errores de JWT inválido o expirado", async () => {
  // Arrange
  const caducado = tokenDe({ id: "usr_exp" }, { expiresIn: "-1s" });
  const { req, res, next } = contextoExpress(`Bearer ${caducado}`);

  // Act
  await optionalAuth(req, res, next);

  // Assert
  expect(req.user).toBe(undefined);
  expect(next.mock.calls.length).toBe(1);
  expect(next.mock.calls[0][0]).toBe(undefined);
});

test("UNIT-AUTH-05", "optionalAuth no asigna usuario si findById devuelve null", async () => {
  // Arrange
  mockUsuarios.findById.mockResolvedValue(null);
  const token = tokenDe({ id: "usr_none", email: "none@homara.com" });
  const { req, res, next } = contextoExpress(`Bearer ${token}`);

  // Act
  await optionalAuth(req, res, next);

  // Assert
  expect(req.user).toBe(undefined);
  expect(next.mock.calls.length).toBe(1);
});

test("UNIT-AUTH-06", "forwardAuthError mapea errores inesperados a 500", async () => {
  // Arrange
  mockUsuarios.findById.mockRejectedValue(new Error("Conexión perdida con la base de datos"));
  const token = tokenDe({ id: "usr_crash", email: "crash@homara.com" });
  const { req, res, next } = contextoExpress(`Bearer ${token}`);

  // Act
  await requireAuth(req, res, next);

  // Assert
  const error = errorDeNext(next);
  expect(error).toBeInstanceOf(AppError);
  expect(error.statusCode).toBe(500);
  expect(error.message).toBe("Error durante la autenticación.");
});
