// ============================================================================
// Pruebas de API en vivo — Carrito (/cart)
// ESC13 agregar al carrito · ESC16 totales · RN-024 acumula cantidad
// RN-029..032 subtotal/envío (gratis > 500.000 COP)
// ============================================================================

import { test, expect, describe } from "../harness.js";
import { pedir, registrarUsuario, unProductoId } from "./soporte-api.js";

describe("API · Carrito", () => {
  test("CP-API-CART-01", "ESC13 — carrito de visitante (sin token) vacío con totales en cero", async () => {
    // Act
    const res = await pedir("/cart");

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.subtotal).toBe(0);
    expect(res.body.data.total).toBe(0);
  });

  test("CP-API-CART-02", "ESC13/RN-063 — agregar al carrito exige sesión (401)", async () => {
    // Arrange
    const id = await unProductoId();

    // Act
    const res = await pedir("/cart/items", { method: "POST", body: { productId: id, quantity: 1 } });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("CP-API-CART-03", "ESC13/RN-063 — productId que no es CUID se rechaza (400)", async () => {
    // Arrange
    const sesion = await registrarUsuario();

    // Act
    const res = await pedir("/cart/items", {
      method: "POST",
      token: sesion.token,
      body: { productId: "no-es-cuid", quantity: 1 },
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("CP-API-CART-04", "ESC13 — agrega un producto al carrito (201)", async () => {
    // Arrange
    const sesion = await registrarUsuario();
    const id = await unProductoId();

    // Act
    const res = await pedir("/cart/items", {
      method: "POST",
      token: sesion.token,
      body: { productId: id, quantity: 2 },
    });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.data.productId).toBe(id);
    expect(res.body.data.quantity).toBe(2);
  });

  test("CP-API-CART-05", "RN-024 — agregar el mismo producto acumula la cantidad", async () => {
    // Arrange
    const sesion = await registrarUsuario();
    const id = await unProductoId();

    // Act
    await pedir("/cart/items", { method: "POST", token: sesion.token, body: { productId: id, quantity: 2 } });
    await pedir("/cart/items", { method: "POST", token: sesion.token, body: { productId: id, quantity: 3 } });
    const carrito = await pedir("/cart", { token: sesion.token });

    // Assert
    expect(carrito.body.data.items.length).toBe(1);
    expect(carrito.body.data.items[0].quantity).toBe(5);
  });

  test("CP-API-CART-06", "ESC16/RN-029..031 — calcula subtotal y cobra envío cuando subtotal <= 500.000", async () => {
    // Arrange
    const sesion = await registrarUsuario();
    const id = await unProductoId();
    const prod = await pedir(`/products/${id}`);
    const precio = prod.body.data.price;

    // Act
    await pedir("/cart/items", { method: "POST", token: sesion.token, body: { productId: id, quantity: 1 } });
    const carrito = await pedir("/cart", { token: sesion.token });

    // Assert
    const esperadoSubtotal = precio * 1;
    expect(carrito.body.data.subtotal).toBe(esperadoSubtotal);
    if (esperadoSubtotal <= 500000) {
      expect(carrito.body.data.shipping).toBe(25000);
    }
    expect(carrito.body.data.total).toBe(carrito.body.data.subtotal + carrito.body.data.shipping);
  });

  test("CP-API-CART-07", "ESC16/RN-032 — envío gratis cuando el subtotal supera 500.000", async () => {
    // Arrange: elegir un producto caro y cantidad suficiente para pasar 500.000
    const sesion = await registrarUsuario();
    const productos = await pedir("/products");
    const caro = [...productos.body.data].sort((a: any, b: any) => b.price - a.price)[0];
    const cantidad = Math.ceil(500001 / caro.price);

    // Act
    await pedir("/cart/items", { method: "POST", token: sesion.token, body: { productId: caro.id, quantity: cantidad } });
    const carrito = await pedir("/cart", { token: sesion.token });

    // Assert
    expect(carrito.body.data.subtotal).toBeGreaterThan(500000);
    expect(carrito.body.data.shipping).toBe(0);
  });

  test("CP-API-CART-08", "RN-011/ESC36 — actualizar un ítem inexistente responde 404", async () => {
    // Arrange
    const sesion = await registrarUsuario();

    // Act
    const res = await pedir("/cart/items/cnoexistexxxxxxxxxxxxxxx", {
      method: "PUT",
      token: sesion.token,
      body: { quantity: 2 },
    });

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test("CP-API-CART-09", "RN-011/ESC36 — un usuario no puede modificar el ítem de otro (403)", async () => {
    // Arrange: usuario A agrega un ítem; usuario B intenta modificarlo
    const a = await registrarUsuario();
    const b = await registrarUsuario();
    const id = await unProductoId();
    const add = await pedir("/cart/items", { method: "POST", token: a.token, body: { productId: id, quantity: 1 } });
    const itemId = add.body.data.id;

    // Act
    const res = await pedir(`/cart/items/${itemId}`, { method: "PUT", token: b.token, body: { quantity: 9 } });

    // Assert
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("CP-API-CART-10", "ESC13 — eliminar un ítem propio del carrito (200)", async () => {
    // Arrange
    const sesion = await registrarUsuario();
    const id = await unProductoId();
    const add = await pedir("/cart/items", { method: "POST", token: sesion.token, body: { productId: id, quantity: 1 } });

    // Act
    const res = await pedir(`/cart/items/${add.body.data.id}`, { method: "DELETE", token: sesion.token });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
