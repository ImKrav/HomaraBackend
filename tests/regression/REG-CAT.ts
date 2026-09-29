// REG-CAT · Regresión del catálogo (/api/v1/categories, /api/v1/products)
// Flujo protegido: listar y filtrar → ver ficha → reseñar.
// Regla clave: el stock visible descuenta las reservas de otros carritos (15 min).

import { vi, beforeEach } from "vitest";
import { test, expect } from "../harness.js";
import { mockProductos, mockCarritos, mockResenas, reiniciarRepositorios } from "../mocks/repositorios.js";
import { producto, carrito, resena } from "../helpers.js";
import { pedir, sesion, CUID } from "./soporte.js";

vi.mock("../../src/infrastructure/database/repositories/prisma-product.repository.js", async () => {
  const { mockProductos } = await import("../mocks/repositorios.js");
  return { PrismaProductRepository: vi.fn(() => mockProductos) };
});
vi.mock("../../src/infrastructure/database/repositories/prisma-cart.repository.js", async () => {
  const { mockCarritos } = await import("../mocks/repositorios.js");
  return { PrismaCartRepository: vi.fn(() => mockCarritos) };
});
vi.mock("../../src/infrastructure/database/repositories/prisma-review.repository.js", async () => {
  const { mockResenas } = await import("../mocks/repositorios.js");
  return { PrismaReviewRepository: vi.fn(() => mockResenas) };
});
vi.mock("../../src/infrastructure/database/repositories/prisma-user.repository.js", async () => {
  const { mockUsuarios } = await import("../mocks/repositorios.js");
  return { PrismaUserRepository: vi.fn(() => mockUsuarios) };
});

beforeEach(reiniciarRepositorios);

test("REG-CAT-01", "El listado traslada los filtros de la URL al repositorio", async () => {
  // Arrange
  mockProductos.findAll.mockResolvedValue([]);

  // Act
  const res = await pedir("GET", "/api/v1/products?category=pisos-ceramicas&q=beige&tag=oferta");

  // Assert
  expect(res.status).toBe(200);
  expect(res.body).toStrictEqual({ success: true, data: [] });
  expect(mockProductos.findAll).toHaveBeenCalledWith({ categorySlug: "pisos-ceramicas", query: "beige", tag: "oferta" });
});

test("REG-CAT-02", "El listado descuenta las reservas de otros carritos del stock visible", async () => {
  // Arrange
  mockProductos.findAll.mockResolvedValue([
    producto({ id: "prd_a", stockQuantity: 10 }),
    producto({ id: "prd_b", stockQuantity: 10 }),
  ]);
  mockCarritos.getReservedQuantities.mockResolvedValue({ prd_a: 10, prd_b: 4 });

  // Act
  const res = await pedir("GET", "/api/v1/products");

  // Assert
  const [agotado, disponible] = res.body.data;
  expect(agotado).toMatchObject({ id: "prd_a", stockQuantity: 0, inStock: false });
  expect(disponible).toMatchObject({ id: "prd_b", stockQuantity: 6, inStock: true });
});

test("REG-CAT-03", "Con sesión, las reservas del propio carrito no se descuentan", async () => {
  // Arrange
  const { token } = sesion();
  mockProductos.findById.mockResolvedValue(producto({ id: CUID.producto, stockQuantity: 10 }));
  mockCarritos.findByUserId.mockResolvedValue(carrito({ id: "cart_propio" }));
  mockCarritos.getReservedQuantities.mockResolvedValue({});

  // Act
  const res = await pedir("GET", `/api/v1/products/${CUID.producto}`, { token });

  // Assert
  expect(res.status).toBe(200);
  expect(res.body.data).toMatchObject({ id: CUID.producto, stockQuantity: 10, inStock: true });
  expect(mockCarritos.getReservedQuantities).toHaveBeenCalledWith("cart_propio", [CUID.producto]);
});

test("REG-CAT-04", "La ficha de un producto inexistente responde 404", async () => {
  // Arrange
  mockProductos.findById.mockResolvedValue(null);

  // Act
  const res = await pedir("GET", `/api/v1/products/${CUID.producto}`);

  // Assert
  expect(res.status).toBe(404);
  expect(res.body).toStrictEqual({ success: false, error: "Producto no encontrado" });
});

test("REG-CAT-05", "Reseñar recalcula el promedio del producto; una segunda reseña se rechaza", async () => {
  // Arrange
  const { token } = sesion();
  mockProductos.findById.mockResolvedValue(producto({ id: CUID.producto }));
  mockResenas.findByUserAndProduct.mockResolvedValueOnce(null).mockResolvedValueOnce(resena());
  mockResenas.create.mockResolvedValue(resena({ rating: 4 }));
  mockResenas.getAverageRatingAndCount.mockResolvedValue({ avg: 4.5, count: 2 });
  const ruta = `/api/v1/products/${CUID.producto}/reviews`;

  // Act
  const primera = await pedir("POST", ruta, { token, body: { rating: 4, comment: "Buen acabado" } });
  const segunda = await pedir("POST", ruta, { token, body: { rating: 5 } });

  // Assert
  expect(primera.status).toBe(201);
  expect(mockProductos.updateProductRating).toHaveBeenCalledWith(CUID.producto, 4.5, 2);
  expect(segunda.status).toBe(400);
  expect(segunda.body.error).toBe("Ya has calificado este producto");
  expect(mockResenas.create).toHaveBeenCalledTimes(1);
});

test("REG-CAT-06", "Una calificación fuera de 1..5 no llega al repositorio", async () => {
  // Arrange
  const { token } = sesion();

  // Act
  const res = await pedir("POST", `/api/v1/products/${CUID.producto}/reviews`, { token, body: { rating: 6 } });

  // Assert
  expect(res.status).toBe(400);
  expect(res.body.error).toContain("La calificación máxima es 5 estrellas.");
  expect(mockResenas.create).not.toHaveBeenCalled();
});

test("REG-CAT-07", "La vitrina devuelve recomendados, ofertas y más vendidos", async () => {
  // Arrange
  mockProductos.findStorefrontRecommended.mockResolvedValue([producto({ id: "r1" })]);
  mockProductos.findStorefrontOffers.mockResolvedValue([producto({ id: "o1" })]);
  mockProductos.findStorefrontBestSellers.mockResolvedValue([producto({ id: "b1" })]);

  // Act
  const res = await pedir("GET", "/api/v1/products/storefront");

  // Assert
  expect(res.status).toBe(200);
  expect(Object.keys(res.body.data)).toStrictEqual(["recommended", "offers", "bestSellers"]);
  expect(res.body.data.offers[0].id).toBe("o1");
});

test("REG-CAT-08", "Las reseñas de un producto se listan desde el repositorio", async () => {
  // Arrange
  mockResenas.findByProductId.mockResolvedValue([resena({ productId: CUID.producto, rating: 4 })]);

  // Act
  const res = await pedir("GET", `/api/v1/products/${CUID.producto}/reviews`);

  // Assert
  expect(res.status).toBe(200);
  expect(mockResenas.findByProductId).toHaveBeenCalledWith(CUID.producto);
  expect(res.body.data).toHaveLength(1);
  expect(res.body.data[0]).toMatchObject({ rating: 4, productId: CUID.producto });
});
