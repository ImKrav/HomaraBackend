// ============================================================================
// Pruebas de API en vivo — Administración (/admin, CRUD de productos)
// ESC06 control de acceso por rol · ESC32 gestionar productos admin
// RN-010 operaciones admin solo ADMIN
//
// Los productos creados aquí llevan nombre con sello de tiempo y se borran al
// final de cada caso (el enunciado permite que los productos creados por admin
// sean borrados por quien los crea).
// ============================================================================

import { test, expect, describe } from "../harness.js";
import { pedir, iniciarSesion, registrarUsuario, unaCategoriaId, SEMILLA, sello } from "./soporte-api.js";

async function sesionAdmin() {
  return iniciarSesion(SEMILLA.admin.email, SEMILLA.admin.password);
}

describe("API · Administración", () => {
  test("CP-API-ADM-01", "ESC06/RN-010 — /admin/metrics sin token se rechaza (401)", async () => {
    // Act
    const res = await pedir("/admin/metrics");

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("CP-API-ADM-02", "ESC06/RN-010 — un CUSTOMER no entra a /admin/metrics (403)", async () => {
    // Arrange
    const cliente = await registrarUsuario();

    // Act
    const res = await pedir("/admin/metrics", { token: cliente.token });

    // Assert
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("administrador");
  });

  test("CP-API-ADM-03", "ESC06 — un ADMIN obtiene métricas del dashboard (200)", async () => {
    // Arrange
    const admin = await sesionAdmin();

    // Act
    const res = await pedir("/admin/metrics", { token: admin.token });

    // Assert
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty("charts");
  });

  test("CP-API-ADM-04", "ESC06 — un ADMIN obtiene el reporte de inventario (200)", async () => {
    // Arrange
    const admin = await sesionAdmin();

    // Act
    const res = await pedir("/admin/inventory", { token: admin.token });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("stats");
    expect(res.body.data).toHaveProperty("products");
    expect(res.body.data.stats).toHaveProperty("lowStockCount");
  });

  test("CP-API-ADM-05", "ESC32/RN-010 — un CUSTOMER no puede crear productos (403)", async () => {
    // Arrange
    const cliente = await registrarUsuario();
    const categoryId = await unaCategoriaId();

    // Act
    const res = await pedir("/products", {
      method: "POST",
      token: cliente.token,
      body: {
        name: `Prod QA ${sello()}`,
        description: "prueba",
        price: 1000,
        stockQuantity: 10,
        unit: "u",
        categoryId,
      },
    });

    // Assert
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("CP-API-ADM-06", "ESC32 — un ADMIN crea, edita y borra un producto (ciclo completo)", async () => {
    // Arrange
    const admin = await sesionAdmin();
    const categoryId = await unaCategoriaId();

    // Act: crear
    const crear = await pedir("/products", {
      method: "POST",
      token: admin.token,
      body: {
        name: `Prod QA ${sello()}`,
        description: "producto de prueba automatizada",
        price: 12345,
        stockQuantity: 7,
        unit: "u",
        categoryId,
      },
    });
    const id = crear.body?.data?.id;
    // Act: editar
    const editar = await pedir(`/products/${id}`, {
      method: "PUT",
      token: admin.token,
      body: { price: 23456 },
    });
    // Act: borrar (limpieza)
    const borrar = await pedir(`/products/${id}`, { method: "DELETE", token: admin.token });

    // Assert
    expect(crear.status).toBe(201);
    expect(crear.body.data.price).toBe(12345);
    expect(editar.status).toBe(200);
    expect(editar.body.data.price).toBe(23456);
    expect(borrar.status).toBe(200);
  });

  test("CP-API-ADM-07", "ESC32/RN-063 — crear producto con precio negativo se rechaza (400)", async () => {
    // Arrange
    const admin = await sesionAdmin();
    const categoryId = await unaCategoriaId();

    // Act
    const res = await pedir("/products", {
      method: "POST",
      token: admin.token,
      body: {
        name: `Prod QA ${sello()}`,
        description: "precio negativo",
        price: -100,
        stockQuantity: 5,
        unit: "u",
        categoryId,
      },
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
