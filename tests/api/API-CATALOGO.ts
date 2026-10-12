// ============================================================================
// Pruebas de API en vivo — Catálogo: categorías, productos y reseñas
// ESC08 listar productos · ESC09 buscar/filtrar · RN-016/017 búsqueda y filtros
// RN-020 una reseña por producto
// ============================================================================

import { test, expect, describe } from "../harness.js";
import { pedir, iniciarSesion, registrarUsuario, unProductoId, SEMILLA, sello } from "./soporte-api.js";

describe("API · Catálogo (categorías, productos, reseñas)", () => {
  test("CP-API-CAT-01", "ESC08 — GET /categories lista categorías (200, sobre {success,data})", async () => {
    // Act
    const res = await pedir("/categories");

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty("slug");
  });

  test("CP-API-CAT-02", "ESC08 — GET /products lista productos con forma esperada", async () => {
    // Act
    const res = await pedir("/products");

    // Assert
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const p = res.body.data[0];
    expect(p).toHaveProperty("id");
    expect(p).toHaveProperty("price");
    expect(p).toHaveProperty("stockQuantity");
    expect(typeof p.price).toBe("number");
  });

  test("CP-API-CAT-03", "ESC09/RN-016 — filtra por categoría (?category=slug)", async () => {
    // Arrange
    const cats = await pedir("/categories");
    const slug = cats.body.data[0].slug;

    // Act
    const res = await pedir(`/products?category=${slug}`);

    // Assert
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    for (const p of res.body.data) {
      expect(p.categorySlug).toBe(slug);
    }
  });

  test("CP-API-CAT-04", "ESC09/RN-016 — búsqueda de texto insensible a mayúsculas (?q=)", async () => {
    // Arrange: tomar una palabra del nombre de un producto
    const productos = await pedir("/products");
    const nombre: string = productos.body.data[0].name;
    const palabra = nombre.split(" ")[0];

    // Act
    const resMin = await pedir(`/products?q=${encodeURIComponent(palabra.toLowerCase())}`);
    const resMay = await pedir(`/products?q=${encodeURIComponent(palabra.toUpperCase())}`);

    // Assert
    expect(resMin.status).toBe(200);
    expect(resMin.body.data.length).toBeGreaterThan(0);
    expect(resMay.body.data.length).toBe(resMin.body.data.length);
  });

  test("CP-API-CAT-05", "ESC09/RN-017 — combina categoría y texto en un mismo filtro", async () => {
    // Arrange
    const productos = await pedir("/products");
    const p0 = productos.body.data[0];
    const palabra = p0.name.split(" ")[0];

    // Act
    const res = await pedir(`/products?category=${p0.categorySlug}&q=${encodeURIComponent(palabra)}`);

    // Assert
    expect(res.status).toBe(200);
    for (const p of res.body.data) {
      expect(p.categorySlug).toBe(p0.categorySlug);
    }
  });

  test("CP-API-CAT-06", "ESC08 — GET /products/:id devuelve el detalle del producto", async () => {
    // Arrange
    const id = await unProductoId();

    // Act
    const res = await pedir(`/products/${id}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data).toHaveProperty("description");
  });

  test("CP-API-CAT-07", "ESC08/RN-062 — producto inexistente responde 404 con sobre de error", async () => {
    // Act
    const res = await pedir("/products/cnoexistexxxxxxxxxxxxxxx");

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Producto no encontrado");
  });

  test("CP-API-CAT-08", "ESC08 — GET /products/storefront agrupa recomendados/ofertas/más vendidos", async () => {
    // Act
    const res = await pedir("/products/storefront");

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("recommended");
    expect(res.body.data).toHaveProperty("offers");
    expect(res.body.data).toHaveProperty("bestSellers");
  });

  test("CP-API-CAT-09", "RN-020 — GET /products/:id/reviews lista reseñas (array)", async () => {
    // Arrange
    const id = await unProductoId();

    // Act
    const res = await pedir(`/products/${id}/reviews`);

    // Assert
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test("CP-API-CAT-10", "RN-020 — crea una reseña y rechaza una segunda del mismo usuario", async () => {
    // Arrange: usuario nuevo + un producto nuevo (admin) para no chocar con reseñas sembradas
    const sesion = await registrarUsuario();
    const id = await unProductoId();

    // Act: primera reseña
    const primera = await pedir(`/products/${id}/reviews`, {
      method: "POST",
      token: sesion.token,
      body: { rating: 4, comment: `reseña qa ${sello()}` },
    });
    // Act: segunda reseña (debe rechazarse)
    const segunda = await pedir(`/products/${id}/reviews`, {
      method: "POST",
      token: sesion.token,
      body: { rating: 5, comment: "otra" },
    });

    // Assert
    expect(primera.status).toBe(201);
    expect(segunda.status).toBe(400);
    expect(segunda.body.error).toContain("calificado");
  });

  test("CP-API-CAT-11", "RN-063 — reseña con calificación fuera de rango se rechaza (400)", async () => {
    // Arrange
    const sesion = await registrarUsuario();
    const id = await unProductoId();

    // Act
    const res = await pedir(`/products/${id}/reviews`, {
      method: "POST",
      token: sesion.token,
      body: { rating: 99 },
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("CP-API-CAT-12", "ESC36 — crear reseña sin token es rechazado (401)", async () => {
    // Arrange
    const id = await unProductoId();

    // Act
    const res = await pedir(`/products/${id}/reviews`, { method: "POST", body: { rating: 4 } });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
