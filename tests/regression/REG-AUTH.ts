// REG-AUTH · Regresión de autenticación y cuenta (/api/v1/users)
// Flujo protegido: registro → inicio de sesión → perfil autenticado.
// Recorre la app Express real por HTTP; solo los repositorios son dobles.

import { vi, beforeEach } from "vitest";
import { test, expect } from "../harness.js";
import { mockUsuarios, mockPrisma, reiniciarRepositorios } from "../mocks/repositorios.js";
import { usuario, datosRegistro } from "../helpers.js";
import { pedir, sesion } from "./soporte.js";
import { hashPassword, verifyToken } from "../../src/shared/utils/authHelper.js";

vi.mock("../../src/infrastructure/database/repositories/prisma-user.repository.js", async () => {
  const { mockUsuarios } = await import("../mocks/repositorios.js");
  return { PrismaUserRepository: vi.fn(() => mockUsuarios) };
});
vi.mock("../../src/infrastructure/database/prisma-client.js", async () => {
  const { mockPrisma } = await import("../mocks/repositorios.js");
  return { prisma: mockPrisma };
});

beforeEach(reiniciarRepositorios);

test("REG-AUTH-01", "El registro crea un CUSTOMER con la clave cifrada y devuelve un token válido", async () => {
  // Arrange
  mockUsuarios.findByEmail.mockResolvedValue(null);
  mockUsuarios.create.mockImplementation(async (d: any) => usuario({ ...d, id: "usr_nuevo" }));

  // Act
  const res = await pedir("POST", "/api/v1/users/register", { body: datosRegistro() });

  // Assert
  expect(res.status).toBe(201);
  const creado = mockUsuarios.create.mock.calls[0][0];
  expect(creado.role).toBe("CUSTOMER");
  expect(creado.password).not.toBe("ClaveSegura8");
  expect(creado.password).toMatch(/^\$2[aby]\$10\$/);
  expect(verifyToken(res.body.data.token)).toMatchObject({ id: "usr_nuevo", role: "CUSTOMER" });
  expect(res.body.data.user).not.toHaveProperty("password");
});

test("REG-AUTH-02", "El registro normaliza el correo y rechaza uno ya registrado", async () => {
  // Arrange
  mockUsuarios.findByEmail.mockResolvedValue(usuario());

  // Act
  const res = await pedir("POST", "/api/v1/users/register", { body: datosRegistro({ email: "ANA@Homara.COM" }) });

  // Assert
  expect(res.status).toBe(400);
  expect(res.body).toStrictEqual({ success: false, error: "El correo electrónico ya está registrado." });
  expect(mockUsuarios.findByEmail).toHaveBeenCalledWith("ana@homara.com");
  expect(mockUsuarios.create).not.toHaveBeenCalled();
});

test("REG-AUTH-03", "El login con la clave correcta devuelve un token del usuario", async () => {
  // Arrange
  const guardado = usuario({ password: await hashPassword("ClaveSegura8") });
  mockUsuarios.findByEmail.mockResolvedValue(guardado);

  // Act
  const res = await pedir("POST", "/api/v1/users/login", { body: { email: "ana@homara.com", password: "ClaveSegura8" } });

  // Assert
  expect(res.status).toBe(200);
  expect(verifyToken(res.body.data.token)).toMatchObject({ id: guardado.id, email: guardado.email });
  expect(res.body.data.user).not.toHaveProperty("password");
});

test("REG-AUTH-04", "El login con clave incorrecta responde 401 con mensaje genérico", async () => {
  // Arrange
  mockUsuarios.findByEmail.mockResolvedValue(usuario({ password: await hashPassword("ClaveSegura8") }));

  // Act
  const res = await pedir("POST", "/api/v1/users/login", { body: { email: "ana@homara.com", password: "otraClave99" } });

  // Assert
  expect(res.status).toBe(401);
  expect(res.body.error).toBe("Credenciales incorrectas. Verifique correo y contraseña.");
  expect(res.body).not.toHaveProperty("data");
});

test("REG-AUTH-05", "El perfil exige token y nunca expone la contraseña", async () => {
  // Arrange
  const { token } = sesion();
  mockPrisma.project.count.mockResolvedValue(2);
  mockPrisma.order.count.mockResolvedValue(3);

  // Act
  const sinToken = await pedir("GET", "/api/v1/users/me");
  const conToken = await pedir("GET", "/api/v1/users/me", { token });

  // Assert
  expect(sinToken.status).toBe(401);
  expect(sinToken.body.error).toBe("Token no provisto.");
  expect(conToken.status).toBe(200);
  expect(conToken.body.data).toMatchObject({ id: "usr_001", projectCount: 2, orderCount: 3 });
  expect(conToken.body.data).not.toHaveProperty("password");
});

test("REG-AUTH-07", "Editar el perfil solo cambia campos permitidos y no toca el rol", async () => {
  // Arrange
  const { token } = sesion();
  mockUsuarios.update.mockImplementation(async (id: string, d: any) => usuario({ id, ...d }));

  // Act
  const res = await pedir("PUT", "/api/v1/users/me", { token, body: { firstName: "Ana María", role: "ADMIN" } });

  // Assert
  expect(res.status).toBe(200);
  expect(mockUsuarios.update).toHaveBeenCalledWith("usr_001", expect.objectContaining({ firstName: "Ana María" }));
  expect(mockUsuarios.update.mock.calls[0][1]).not.toHaveProperty("role");
  expect(res.body.data.role).toBe("CUSTOMER");
});

// Defecto abierto #14 (ver la tabla en tests/README.md): se espera que falle.
test.fails("REG-AUTH-08", "La respuesta de editar el perfil no expone el hash de la contraseña", async () => {
  // Arrange
  const { token } = sesion();
  mockUsuarios.update.mockImplementation(async (id: string, d: any) => usuario({ id, ...d }));

  // Act
  const res = await pedir("PUT", "/api/v1/users/me", { token, body: { city: "Medellín" } });

  // Assert — DEFECTO: AuthController.update devuelve la entidad completa del repositorio.
  expect(res.status).toBe(200);
  expect(res.body.data).not.toHaveProperty("password");
});

test("REG-AUTH-06", "Un token de un usuario dado de baja deja de servir", async () => {
  // Arrange
  const { token } = sesion();
  mockUsuarios.findById.mockResolvedValue(null);

  // Act
  const res = await pedir("GET", "/api/v1/users/me", { token });

  // Assert
  expect(res.status).toBe(401);
  expect(res.body.error).toBe("Usuario no encontrado o dado de baja.");
});
