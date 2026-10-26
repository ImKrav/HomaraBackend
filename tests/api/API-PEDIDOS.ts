// ============================================================================
// Pruebas de API en vivo — Pedidos (/orders)
// ESC28 generar pedido · ESC34 gestionar pedidos admin · ESC37 integridad
// RN-036 número ORD-YYYY-NNN · RN-038 carrito vacío tras pedido
// RN-042 estado inicial PENDIENTE · RN-043 estados válidos · RN-010 solo ADMIN
// ============================================================================

import { test, expect, describe } from "../harness.js";
import { pedir, iniciarSesion, registrarUsuario, unProductoId, SEMILLA } from "./soporte-api.js";

/** Crea un usuario con un ítem en el carrito y genera un pedido. Devuelve {sesion, pedido}. */
async function generarPedido() {
  const sesion = await registrarUsuario();
  const id = await unProductoId();
  await pedir("/cart/items", { method: "POST", token: sesion.token, body: { productId: id, quantity: 1 } });
  const res = await pedir("/orders", { method: "POST", token: sesion.token, body: { paymentMethod: "tarjeta" } });
  return { sesion, res };
}

describe("API · Pedidos", () => {
  test("CP-API-ORD-01", "ESC28/RN-036/RN-042 — checkout genera pedido PENDIENTE con número ORD-YYYY-NNN (201)", async () => {
    // Act
    const { res } = await generarPedido();

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("PENDIENTE");
    expect(res.body.data.orderNumber).toMatch(/^ORD-\d{4}-\d{3,}$/);
  });

  test("CP-API-ORD-02", "ESC28/RN-038 — el carrito queda vacío después de generar el pedido", async () => {
    // Arrange
    const { sesion } = await generarPedido();

    // Act
    const carrito = await pedir("/cart", { token: sesion.token });

    // Assert
    expect(carrito.body.data.items).toEqual([]);
    expect(carrito.body.data.subtotal).toBe(0);
  });

  test("CP-API-ORD-03", "ESC28/RN-063 — checkout con carrito vacío se rechaza (400)", async () => {
    // Arrange
    const sesion = await registrarUsuario();

    // Act
    const res = await pedir("/orders", { method: "POST", token: sesion.token, body: { paymentMethod: "tarjeta" } });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("carrito");
  });

  test("CP-API-ORD-04", "ESC28 — checkout sin token se rechaza (401)", async () => {
    // Act
    const res = await pedir("/orders", { method: "POST", body: { paymentMethod: "tarjeta" } });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("CP-API-ORD-05", "ESC28/RN-063 — método de pago obligatorio (400)", async () => {
    // Arrange
    const sesion = await registrarUsuario();
    const id = await unProductoId();
    await pedir("/cart/items", { method: "POST", token: sesion.token, body: { productId: id, quantity: 1 } });

    // Act
    const res = await pedir("/orders", { method: "POST", token: sesion.token, body: {} });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("CP-API-ORD-06", "ESC28 — el cliente lista sus propios pedidos y ve el recién creado", async () => {
    // Arrange
    const { sesion, res } = await generarPedido();
    const numero = res.body.data.orderNumber;

    // Act
    const lista = await pedir("/orders", { token: sesion.token });

    // Assert
    expect(lista.status).toBe(200);
    expect(Array.isArray(lista.body.data)).toBe(true);
    expect(lista.body.data.some((o: any) => o.id === numero)).toBe(true);
  });

  test("CP-API-ORD-07", "ESC28 — detalle del pedido por número (GET /orders/:id)", async () => {
    // Arrange
    const { sesion, res } = await generarPedido();
    const numero = res.body.data.orderNumber;

    // Act
    const detalle = await pedir(`/orders/${numero}`, { token: sesion.token });

    // Assert
    expect(detalle.status).toBe(200);
    expect(detalle.body.data.id).toBe(numero);
    expect(Array.isArray(detalle.body.data.items)).toBe(true);
  });

  test("CP-API-ORD-08", "ESC28/RN-062 — pedido inexistente responde 404", async () => {
    // Arrange
    const sesion = await registrarUsuario();

    // Act
    const res = await pedir("/orders/ORD-1900-999", { token: sesion.token });

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Pedido no encontrado");
  });

  test("CP-API-ORD-09", "ESC34/RN-010 — un CUSTOMER no puede cambiar el estado de un pedido (403)", async () => {
    // Arrange
    const { sesion, res } = await generarPedido();
    const detalle = await pedir(`/orders/${res.body.data.orderNumber}`, { token: sesion.token });
    const dbId = detalle.body.data.dbId;

    // Act
    const upd = await pedir(`/orders/${dbId}/status`, {
      method: "PUT",
      token: sesion.token,
      body: { status: "ENVIADO" },
    });

    // Assert
    expect(upd.status).toBe(403);
    expect(upd.body.success).toBe(false);
  });

  test("CP-API-ORD-10", "ESC34/RN-043 — un ADMIN cambia el estado de MI pedido a uno válido (200)", async () => {
    // Arrange: creamos un pedido propio para no tocar los pedidos sembrados
    const { sesion, res } = await generarPedido();
    const detalle = await pedir(`/orders/${res.body.data.orderNumber}`, { token: sesion.token });
    const dbId = detalle.body.data.dbId;
    const admin = await iniciarSesion(SEMILLA.admin.email, SEMILLA.admin.password);

    // Act
    const upd = await pedir(`/orders/${dbId}/status`, {
      method: "PUT",
      token: admin.token,
      body: { status: "PROCESANDO" },
    });

    // Assert
    expect(upd.status).toBe(200);
    expect(upd.body.success).toBe(true);
  });

  test("CP-API-ORD-11", "ESC34/RN-043 — estado fuera del catálogo se rechaza (400)", async () => {
    // Arrange
    const { sesion, res } = await generarPedido();
    const detalle = await pedir(`/orders/${res.body.data.orderNumber}`, { token: sesion.token });
    const dbId = detalle.body.data.dbId;
    const admin = await iniciarSesion(SEMILLA.admin.email, SEMILLA.admin.password);

    // Act
    const upd = await pedir(`/orders/${dbId}/status`, {
      method: "PUT",
      token: admin.token,
      body: { status: "VOLANDO" },
    });

    // Assert
    expect(upd.status).toBe(400);
    expect(upd.body.success).toBe(false);
  });
});
