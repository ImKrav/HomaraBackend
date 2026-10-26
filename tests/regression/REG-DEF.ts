// REG-DEF · Regresión de las correcciones de los defectos hallados en las pruebas
// de API, seguridad y E2E (docs/pruebas/SEGURIDAD.md y el informe Cypress del frontend).
// Recorre la app Express real por HTTP; solo los repositorios son dobles.

import { vi, beforeEach } from "vitest";
import { test, expect } from "../harness.js";
import { mockUsuarios, mockPedidos, mockCarritos, mockPrisma, reiniciarRepositorios } from "../mocks/repositorios.js";
import { usuario } from "../helpers.js";
import { pedir, sesion } from "./soporte.js";
import { calculateShipping } from "../../src/domain/services/shipping.js";
import { hashPassword } from "../../src/shared/utils/authHelper.js";

vi.mock("../../src/infrastructure/database/repositories/prisma-user.repository.js", async () => {
  const { mockUsuarios } = await import("../mocks/repositorios.js");
  return { PrismaUserRepository: vi.fn(() => mockUsuarios) };
});
vi.mock("../../src/infrastructure/database/repositories/prisma-order.repository.js", async () => {
  const { mockPedidos } = await import("../mocks/repositorios.js");
  return { PrismaOrderRepository: vi.fn(() => mockPedidos) };
});
vi.mock("../../src/infrastructure/database/repositories/prisma-cart.repository.js", async () => {
  const { mockCarritos } = await import("../mocks/repositorios.js");
  return { PrismaCartRepository: vi.fn(() => mockCarritos) };
});
vi.mock("../../src/infrastructure/database/prisma-client.js", async () => {
  const { mockPrisma } = await import("../mocks/repositorios.js");
  return { prisma: mockPrisma };
});

beforeEach(reiniciarRepositorios);

test("REG-DEF-01", "CP-SEG-DEF-10: la API responde con cabeceras de seguridad (helmet)", async () => {
  // Act
  const res = await pedir("GET", "/");

  // Assert
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'self'");
  expect(res.headers.get("x-powered-by")).toBe(null);
});

test("REG-DEF-02", "CP-SEG-DEF-11: el login bloquea tras 10 fallos por IP y correo, sin afectar a otro correo", async () => {
  // Arrange
  mockUsuarios.findByEmail.mockResolvedValue(null);
  const intento = (email: string) =>
    pedir("POST", "/api/v1/users/login", { body: { email, password: "incorrecta" } });

  // Act
  const estados: number[] = [];
  for (let i = 0; i < 11; i++) estados.push((await intento("victima@homara.com")).status);
  const otroCorreo = await intento("otra@homara.com");

  // Assert
  expect(estados.slice(0, 10)).toStrictEqual(Array(10).fill(401));
  expect(estados[10]).toBe(429);
  expect(otroCorreo.status).toBe(401);
});

test("REG-DEF-03", "CP-SEG-DEF-02/03: los pedidos salen del token; userId y admin=true de un cliente se ignoran, no los de un ADMIN", async () => {
  // Arrange
  const { token } = sesion();
  mockPedidos.findAll.mockResolvedValue([]);

  // Act
  const sinSesion = await pedir("GET", "/api/v1/orders?userId=cusr0000000000000000000a1");
  const cliente = await pedir("GET", "/api/v1/orders?admin=true&userId=cusr0000000000000000000a1", { token });

  const admin = sesion({ id: "usr_admin", role: "ADMIN" });
  const comoAdmin = await pedir("GET", "/api/v1/orders?admin=true", { token: admin.token });

  // Assert
  expect(sinSesion.body.data).toStrictEqual([]);
  expect(mockPedidos.findAll).toHaveBeenCalledTimes(2);
  expect(mockPedidos.findAll).toHaveBeenNthCalledWith(1, { userId: "usr_001", admin: false });
  expect(cliente.status).toBe(200);
  // …pero un ADMIN sí obtiene el listado completo
  expect(mockPedidos.findAll).toHaveBeenNthCalledWith(2, { userId: "usr_admin", admin: true });
  expect(comoAdmin.status).toBe(200);
});

test("REG-DEF-04", "CP-SEG-DEF-05: sin sesión, GET /cart?userId=<ajeno> devuelve un carrito de visitante", async () => {
  // Act
  const res = await pedir("GET", "/api/v1/cart?userId=usr_001");

  // Assert
  expect(res.body.data).toMatchObject({ id: "guest", items: [], total: 0 });
  expect(mockCarritos.findByUserId).not.toHaveBeenCalled();
});

test("REG-DEF-05", "CP-SEG-DEF-08: GET /users/:id exige sesión y solo entrega el perfil propio", async () => {
  // Arrange
  const { token } = sesion();

  // Act
  const sinSesion = await pedir("GET", "/api/v1/users/usr_002");
  const ajeno = await pedir("GET", "/api/v1/users/usr_002", { token });

  // Assert
  expect(sinSesion.status).toBe(401);
  expect(ajeno.status).toBe(403);
});

test("REG-DEF-06", "DEF-08: editar el perfil rechaza un nombre vacío en el servidor", async () => {
  // Arrange
  const { token } = sesion();

  // Act
  const res = await pedir("PUT", "/api/v1/users/me", { token, body: { firstName: "" } });

  // Assert
  expect(res.status).toBe(400);
  expect(mockUsuarios.update).not.toHaveBeenCalled();
});

test("REG-DEF-07", "DEF-03 (ESC27): el checkout rechaza datos de envío formados solo por espacios", async () => {
  // Arrange
  const { token } = sesion();

  // Act
  const res = await pedir("POST", "/api/v1/orders", {
    token,
    body: { paymentMethod: "card", shippingAddress: "   ", shippingCity: "   ", shippingState: "   " },
  });

  // Assert
  expect(res.status).toBe(400);
  expect(res.body.error).toContain("La dirección no puede estar vacío");
  expect(mockPedidos.create).not.toHaveBeenCalled();
});

test("REG-DEF-08", "RN-031 / DEF-03: envío gratis desde 500.000 inclusive y sin envío para un carrito vacío", () => {
  // Act
  const resultados = [0, 1, 499_999, 500_000, 500_001].map(calculateShipping);

  // Assert
  expect(resultados).toStrictEqual([0, 25_000, 25_000, 0, 0]);
});

test("REG-DEF-09", "CP-SEG-DEF-09: la edición del perfil responde con la proyección pública", async () => {
  // Arrange
  const { token } = sesion();
  mockUsuarios.update.mockImplementation(async (id: string, d: any) => usuario({ id, ...d }));
  mockPrisma.project.count.mockResolvedValue(2);
  mockPrisma.order.count.mockResolvedValue(1);

  // Act
  const res = await pedir("PUT", "/api/v1/users/me", { token, body: { city: "Cali" } });

  // Assert
  expect(res.status).toBe(200);
  expect(Object.keys(res.body.data)).not.toContain("password");
  expect(res.body.data).toMatchObject({ projectCount: 2, orderCount: 1 });
});

test("REG-DEF-10", "CP-SEG-DEF-06 / DEF-10: un cliente no lee el detalle del pedido de otro; un ADMIN sí", async () => {
  // Arrange
  const pedidoAjeno = {
    id: "ord_1", orderNumber: "ORD-2026-001", status: "PENDIENTE", subtotal: 0, shippingCost: 0, total: 0,
    userId: "usr_otro", items: [], user: { firstName: "Otra", lastName: "Persona", email: "otra@homara.com" },
  };
  mockPedidos.findByIdOrNumber.mockResolvedValue(pedidoAjeno);
  const cliente = sesion();

  // Act
  const comoCliente = await pedir("GET", "/api/v1/orders/ORD-2026-001", { token: cliente.token });
  const admin = sesion({ id: "usr_admin", role: "ADMIN" });
  const comoAdmin = await pedir("GET", "/api/v1/orders/ORD-2026-001", { token: admin.token });

  // Assert
  expect(comoCliente.status).toBe(403);
  expect(comoCliente.body).not.toHaveProperty("data");
  expect(comoAdmin.status).toBe(200);
  expect(comoAdmin.body.data.customer.email).toBe("otra@homara.com");
});

test("REG-DEF-11", "DEF-SEG-FE-02: la sesión del navegador viaja en una cookie HttpOnly que el logout borra", async () => {
  // Arrange
  const clave = `Clave${"9".repeat(4)}`; // generada: un literal dispara falsos positivos de los escáneres de secretos
  const guardado = usuario({ password: await hashPassword(clave) });
  mockUsuarios.findByEmail.mockResolvedValue(guardado);
  mockUsuarios.findById.mockResolvedValue(guardado);
  mockPrisma.project.count.mockResolvedValue(0);
  mockPrisma.order.count.mockResolvedValue(0);

  // Act
  const login = await pedir("POST", "/api/v1/users/login", { body: { email: guardado.email, password: clave } });
  const setCookie = login.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  const perfil = await pedir("GET", "/api/v1/users/me", { cookie });
  const conSesion = await pedir("GET", "/api/v1/users/session", { cookie });
  const sinSesion = await pedir("GET", "/api/v1/users/session");
  const cookieManipulada = await pedir("GET", "/api/v1/users/session", { cookie: "homara_session=token.manipulado" });
  const logout = await pedir("POST", "/api/v1/users/logout", { cookie });

  // Assert
  expect(cookie).toBe(`homara_session=${login.body.data.token}`);
  expect(setCookie).toMatch(/HttpOnly/i);
  expect(setCookie).toMatch(/SameSite=Strict/i);
  expect(setCookie).toMatch(/Path=\//);
  expect(perfil.status).toBe(200);
  expect(conSesion.body.data.email).toBe(guardado.email);
  expect(sinSesion.status).toBe(200);
  expect(sinSesion.body.data).toBeNull();
  expect(sinSesion.headers.get("set-cookie")).toBeNull();
  expect(cookieManipulada.body.data).toBeNull();
  expect(cookieManipulada.headers.get("set-cookie")).toMatch(/homara_session=;/);
  expect(logout.headers.get("set-cookie")).toMatch(/homara_session=;.*Expires=Thu, 01 Jan 1970/i);
});
