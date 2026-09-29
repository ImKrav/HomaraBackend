// REG-CART · Regresión del carrito (/api/v1/cart)
// Flujo protegido: ver carrito → agregar → cambiar cantidad → quitar.
// Reglas clave: backorder cuando se pide más de lo disponible, envío gratis
// solo con subtotal > 500.000 y nadie toca ítems de otro carrito.

import { vi, beforeEach } from "vitest";
import { test, expect } from "../harness.js";
import { mockCarritos, reiniciarRepositorios } from "../mocks/repositorios.js";
import { producto, carrito } from "../helpers.js";
import { pedir, sesion, CUID } from "./soporte.js";

vi.mock("../../src/infrastructure/database/repositories/prisma-cart.repository.js", async () => {
  const { mockCarritos } = await import("../mocks/repositorios.js");
  return { PrismaCartRepository: vi.fn(() => mockCarritos) };
});
vi.mock("../../src/infrastructure/database/repositories/prisma-user.repository.js", async () => {
  const { mockUsuarios } = await import("../mocks/repositorios.js");
  return { PrismaUserRepository: vi.fn(() => mockUsuarios) };
});

beforeEach(reiniciarRepositorios);

const item = (id: string, cantidad: number, prod: Record<string, any>) => ({
  id,
  productId: prod.id,
  quantity: cantidad,
  product: producto(prod),
});

test("REG-CART-01", "Un visitante sin sesión recibe un carrito vacío sin tocar la base", async () => {
  // Arrange — sin token.

  // Act
  const res = await pedir("GET", "/api/v1/cart");

  // Assert
  expect(res.status).toBe(200);
  expect(res.body.data).toStrictEqual({ id: "guest", items: [], subtotal: 0, shipping: 0, total: 0, itemCount: 0 });
  expect(mockCarritos.findByUserId).not.toHaveBeenCalled();
});

test("REG-CART-02", "Calcula subtotal, envío y backorder a partir del stock disponible", async () => {
  // Arrange — pide 5 de un producto con 3 disponibles (8 en bodega, 5 reservados).
  const { token } = sesion();
  mockCarritos.findByUserId.mockResolvedValue(
    carrito({ items: [item("itm_1", 5, { id: "prd_a", price: 40_000, stockQuantity: 8 })] }),
  );
  mockCarritos.getReservedQuantities.mockResolvedValue({ prd_a: 5 });

  // Act
  const res = await pedir("GET", "/api/v1/cart", { token });

  // Assert
  expect(res.body.data).toMatchObject({ subtotal: 200_000, shipping: 25_000, total: 225_000, itemCount: 1 });
  expect(res.body.data.items[0]).toMatchObject({ quantity: 5, availableStock: 3, isBackorder: true, backorderQuantity: 2 });
});

test("REG-CART-03", "El envío es gratis cuando el subtotal supera 500.000", async () => {
  // Arrange
  const { token } = sesion();
  mockCarritos.findByUserId.mockResolvedValue(
    carrito({ items: [item("itm_1", 2, { id: "prd_a", price: 250_001, stockQuantity: 50 })] }),
  );
  mockCarritos.getReservedQuantities.mockResolvedValue({});

  // Act
  const res = await pedir("GET", "/api/v1/cart", { token });

  // Assert
  expect(res.body.data).toMatchObject({ subtotal: 500_002, shipping: 0, total: 500_002 });
});

test("REG-CART-04", "Agregar exige sesión y un productId CUID", async () => {
  // Arrange
  const { token } = sesion();

  // Act
  const sinSesion = await pedir("POST", "/api/v1/cart/items", { body: { productId: CUID.producto, quantity: 1 } });
  const idInvalido = await pedir("POST", "/api/v1/cart/items", { token, body: { productId: "123", quantity: 1 } });

  // Assert
  expect(sinSesion.status).toBe(401);
  expect(idInvalido.status).toBe(400);
  expect(idInvalido.body.error).toContain("ID de producto inválido");
  expect(mockCarritos.addItem).not.toHaveBeenCalled();
});

test("REG-CART-05", "Agregar un producto lo suma al carrito del usuario autenticado", async () => {
  // Arrange
  const { token } = sesion();
  mockCarritos.findByUserId.mockResolvedValue(carrito({ id: "cart_ana" }));
  mockCarritos.addItem.mockResolvedValue({ id: "itm_1", quantity: 3 });

  // Act
  const res = await pedir("POST", "/api/v1/cart/items", { token, body: { productId: CUID.producto, quantity: 3 } });

  // Assert
  expect(res.status).toBe(201);
  expect(mockCarritos.findByUserId).toHaveBeenCalledWith("usr_001");
  expect(mockCarritos.addItem).toHaveBeenCalledWith("cart_ana", CUID.producto, 3);
});

test("REG-CART-06", "Cambiar la cantidad de un ítem ajeno responde 403 y no lo modifica", async () => {
  // Arrange
  const { token } = sesion();
  mockCarritos.findItemOwner.mockResolvedValue("usr_otro");

  // Act
  const res = await pedir("PUT", `/api/v1/cart/items/${CUID.item}`, { token, body: { quantity: 2 } });

  // Assert
  expect(res.status).toBe(403);
  expect(res.body.error).toBe("No tienes permiso para modificar este item del carrito.");
  expect(mockCarritos.updateItemQuantity).not.toHaveBeenCalled();
});

test("REG-CART-07", "Actualiza y elimina ítems propios", async () => {
  // Arrange
  const { token } = sesion();
  mockCarritos.findItemOwner.mockResolvedValue("usr_001");
  mockCarritos.updateItemQuantity.mockResolvedValue({ id: CUID.item, quantity: 4 });
  const ruta = `/api/v1/cart/items/${CUID.item}`;

  // Act
  const actualizado = await pedir("PUT", ruta, { token, body: { quantity: 4 } });
  const eliminado = await pedir("DELETE", ruta, { token });

  // Assert
  expect(actualizado.status).toBe(200);
  expect(mockCarritos.updateItemQuantity).toHaveBeenCalledWith(CUID.item, 4);
  expect(eliminado.body).toStrictEqual({ success: true, message: "Item eliminado del carrito" });
  expect(mockCarritos.removeItem).toHaveBeenCalledWith(CUID.item);
});
