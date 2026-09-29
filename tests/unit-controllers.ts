import { vi, beforeEach } from "vitest";
import { test, expect } from "./harness.js";
import { contextoExpress } from "./helpers.js";
import {
  mockCarritos,
  mockPedidos,
  mockProductos,
  mockProyectos,
  mockCategorias,
  mockResenas,
  mockUsuarios,
  mockPrisma,
  reiniciarRepositorios,
} from "./mocks/repositorios.js";
import { CartController } from "../src/infrastructure/http/controllers/cart.controller.js";
import { OrderController } from "../src/infrastructure/http/controllers/order.controller.js";
import { ProjectController } from "../src/infrastructure/http/controllers/project.controller.js";
import { CatalogController } from "../src/infrastructure/http/controllers/catalog.controller.js";
import { AuthController } from "../src/infrastructure/http/controllers/auth.controller.js";
import { AdminController } from "../src/infrastructure/http/controllers/admin.controller.js";
import { AppError } from "../src/shared/errors/AppError.js";

// Los controladores construyen sus repositorios Prisma en el ámbito del módulo
// y se los pasan a los casos de uso al importarse. Mockeando cada módulo, esos
// constructores devuelven los dobles compartidos: no hace falta ninguna costura
// en el código de producción.
vi.mock("../src/infrastructure/database/repositories/prisma-cart.repository.js", async () => {
  const { mockCarritos } = await import("./mocks/repositorios.js");
  return { PrismaCartRepository: vi.fn(() => mockCarritos) };
});

vi.mock("../src/infrastructure/database/repositories/prisma-order.repository.js", async () => {
  const { mockPedidos } = await import("./mocks/repositorios.js");
  return { PrismaOrderRepository: vi.fn(() => mockPedidos) };
});

vi.mock("../src/infrastructure/database/repositories/prisma-product.repository.js", async () => {
  const { mockProductos } = await import("./mocks/repositorios.js");
  return { PrismaProductRepository: vi.fn(() => mockProductos) };
});

vi.mock("../src/infrastructure/database/repositories/prisma-project.repository.js", async () => {
  const { mockProyectos } = await import("./mocks/repositorios.js");
  return { PrismaProjectRepository: vi.fn(() => mockProyectos) };
});

vi.mock("../src/infrastructure/database/repositories/prisma-category.repository.js", async () => {
  const { mockCategorias } = await import("./mocks/repositorios.js");
  return { PrismaCategoryRepository: vi.fn(() => mockCategorias) };
});

vi.mock("../src/infrastructure/database/repositories/prisma-review.repository.js", async () => {
  const { mockResenas } = await import("./mocks/repositorios.js");
  return { PrismaReviewRepository: vi.fn(() => mockResenas) };
});

vi.mock("../src/infrastructure/database/repositories/prisma-user.repository.js", async () => {
  const { mockUsuarios } = await import("./mocks/repositorios.js");
  return { PrismaUserRepository: vi.fn(() => mockUsuarios) };
});

// `admin` y `auth` leen el cliente Prisma directamente.
vi.mock("../src/infrastructure/database/prisma-client.js", async () => {
  const { mockPrisma } = await import("./mocks/repositorios.js");
  return { prisma: mockPrisma };
});

beforeEach(reiniciarRepositorios);

// ============================================================================
// CartController Tests
// ============================================================================

test("UNIT-CTRL-CART-01", "CartController.get retorna carrito vacío si no hay usuario ni query param", async () => {
  // Arrange
  const { req, res, next } = contextoExpress();
  req.user = undefined;
  req.query = {};

  // Act
  await CartController.get(req, res, next);

  // Assert
  expect(res.body.success).toBe(true);
  expect(res.body.data.id).toBe("guest");
  expect(res.body.data.itemCount).toBe(0);
  expect(next.mock.calls.length).toBe(0);
});

test("UNIT-CTRL-CART-02", "CartController.get obtiene carrito si hay usuario autenticado", async () => {
  // Arrange
  mockCarritos.findByUserId.mockResolvedValue({ id: "cart-1", userId: "usr-1", items: [] });
  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };

  // Act
  await CartController.get(req, res, next);

  // Assert
  expect(res.body.success).toBe(true);
  expect(res.body.data.id).toBe("cart-1");
  expect(next.mock.calls.length).toBe(0);
});

test("UNIT-CTRL-CART-03", "CartController.get delega errores a next", async () => {
  // Arrange
  mockCarritos.findByUserId.mockRejectedValue(new Error("DB Down"));
  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };

  // Act
  await CartController.get(req, res, next);

  // Assert
  expect(next.mock.calls.length).toBe(1);
  expect(next.mock.calls[0][0].message).toBe("DB Down");
});

test("UNIT-CTRL-CART-04", "CartController.addItem agrega producto y responde 201", async () => {
  // Arrange
  mockCarritos.findByUserId.mockResolvedValue({ id: "cart-1", userId: "usr-1", items: [] });
  mockCarritos.addItem.mockResolvedValue({ id: "cart-1", userId: "usr-1", items: [{ id: "item-1", productId: "prd-1", quantity: 2 }] });
  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.body = { productId: "prd-1", quantity: 2 };

  // Act
  await CartController.addItem(req, res, next);

  // Assert
  expect(res.statusCode).toBe(201);
  expect(res.body.success).toBe(true);
  expect(next.mock.calls.length).toBe(0);
});

test("UNIT-CTRL-CART-05", "CartController.addItem delega errores a next", async () => {
  // Arrange
  mockCarritos.findByUserId.mockRejectedValue(new Error("Error agregando"));
  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.body = { productId: "prd-1", quantity: 2 };

  // Act
  await CartController.addItem(req, res, next);

  // Assert
  expect(next.mock.calls.length).toBe(1);
  expect(next.mock.calls[0][0].message).toBe("Error agregando");
});

test("UNIT-CTRL-CART-06", "CartController.updateItemQuantity actualiza cantidad y responde 200", async () => {
  // Arrange
  mockCarritos.findItemOwner.mockResolvedValue("usr-1");
  mockCarritos.updateItemQuantity.mockResolvedValue({ id: "cart-1", userId: "usr-1", items: [{ id: "item-1", quantity: 5 }] });
  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.params = { itemId: "item-1" };
  req.body = { quantity: 5 };

  // Act
  await CartController.updateItemQuantity(req, res, next);

  // Assert
  expect(res.body.success).toBe(true);
  expect(next.mock.calls.length).toBe(0);
});

test("UNIT-CTRL-CART-07", "CartController.updateItemQuantity delega error a next", async () => {
  // Arrange
  mockCarritos.findItemOwner.mockRejectedValue(new Error("Error"));
  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.params = { itemId: "item-1" };
  req.body = { quantity: 5 };

  // Act
  await CartController.updateItemQuantity(req, res, next);

  // Assert
  expect(next.mock.calls.length).toBe(1);
});

test("UNIT-CTRL-CART-08", "CartController.removeItem remueve item y responde 200", async () => {
  // Arrange
  mockCarritos.findItemOwner.mockResolvedValue("usr-1");
  mockCarritos.removeItem.mockResolvedValue({ id: "cart-1", userId: "usr-1", items: [] });
  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.params = { itemId: "item-1" };

  // Act
  await CartController.removeItem(req, res, next);

  // Assert
  expect(res.body.success).toBe(true);
  expect(next.mock.calls.length).toBe(0);
});

test("UNIT-CTRL-CART-09", "CartController.removeItem delega error a next", async () => {
  // Arrange
  mockCarritos.findItemOwner.mockRejectedValue(new Error("Error"));
  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.params = { itemId: "item-1" };

  // Act
  await CartController.removeItem(req, res, next);

  // Assert
  expect(next.mock.calls.length).toBe(1);
});

// ============================================================================
// OrderController Tests
// ============================================================================

test("UNIT-CTRL-ORD-01", "OrderController.list retorna vacío si no hay userId", async () => {
  // Arrange
  const { req, res, next } = contextoExpress();
  req.user = undefined;
  req.query = {};

  // Act
  await OrderController.list(req, res, next);

  // Assert
  expect(res.body.success).toBe(true);
  expect(res.body.data).toStrictEqual([]);
  expect(next.mock.calls.length).toBe(0);
});

test("UNIT-CTRL-ORD-02", "OrderController.list lista pedidos para usuario autenticado", async () => {
  // Arrange
  mockPedidos.findAll.mockResolvedValue([{ id: "ord-1", orderNumber: "ORD-1", status: "PENDIENTE", total: 100000, createdAt: new Date() }]);
  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.query = { admin: "false" };

  // Act
  await OrderController.list(req, res, next);

  // Assert
  expect(res.body.success).toBe(true);
  expect(res.body.data.length).toBe(1);
  expect(next.mock.calls.length).toBe(0);
});

test("UNIT-CTRL-ORD-03", "OrderController.list delega errores a next", async () => {
  // Arrange
  mockPedidos.findAll.mockRejectedValue(new Error("DB Error"));
  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.query = {};

  // Act
  await OrderController.list(req, res, next);

  // Assert
  expect(next.mock.calls.length).toBe(1);
});

test("UNIT-CTRL-ORD-04", "OrderController.getDetail retorna detalle de pedido", async () => {
  // Arrange
  mockPedidos.findByIdOrNumber.mockResolvedValue({
    id: "ord-1",
    orderNumber: "ORD-2026-001",
    status: "PENDIENTE",
    subtotal: 100000,
    shippingCost: 0,
    total: 100000,
    paymentMethod: "TARJETA",
    shippingAddress: "A",
    shippingCity: "B",
    shippingState: "C",
    shippingZip: "D",
    shippingNotes: null,
    createdAt: new Date()
  });
  const { req, res, next } = contextoExpress();
  req.params = { id: "ord-1" };

  // Act
  await OrderController.getDetail(req, res, next);

  // Assert
  expect(res.body.success).toBe(true);
  expect(res.body.data.id).toBe("ORD-2026-001");
  expect(next.mock.calls.length).toBe(0);
});

test("UNIT-CTRL-ORD-05", "OrderController.getDetail delega error a next", async () => {
  // Arrange
  mockPedidos.findByIdOrNumber.mockRejectedValue(new Error("No encontrado"));
  const { req, res, next } = contextoExpress();
  req.params = { id: "ord-none" };

  // Act
  await OrderController.getDetail(req, res, next);

  // Assert
  expect(next.mock.calls.length).toBe(1);
});

test("UNIT-CTRL-ORD-06", "OrderController.create crea orden y responde 201", async () => {
  // Arrange
  mockCarritos.findByUserId.mockResolvedValue({
    id: "cart-1",
    userId: "usr-1",
    items: [{ id: "ci-1", productId: "prd-1", quantity: 1, unitPrice: 50000, total: 50000 }]
  });
  mockProductos.findById.mockResolvedValue({ id: "prd-1", price: 50000, inStock: true, stockQuantity: 10 });
  mockCarritos.getReservedQuantities.mockResolvedValue({});
  mockPedidos.create.mockResolvedValue({ id: "ord-1", orderNumber: "ORD-2026-001", total: 75000 });
  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.body = {
    paymentMethod: "TARJETA",
    shippingAddress: "Calle 10 #20-30",
    shippingCity: "Bogotá",
    shippingState: "Cundinamarca",
    shippingZip: "110111"
  };

  // Act
  await OrderController.create(req, res, next);

  // Assert
  expect(res.statusCode).toBe(201);
  expect(res.body.success).toBe(true);
  expect(next.mock.calls.length).toBe(0);
});

test("UNIT-CTRL-ORD-07", "OrderController.create delega error a next", async () => {
  // Arrange
  mockCarritos.findByUserId.mockRejectedValue(new Error("Cart error"));
  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.body = {};

  // Act
  await OrderController.create(req, res, next);

  // Assert
  expect(next.mock.calls.length).toBe(1);
});

test("UNIT-CTRL-ORD-08", "OrderController.updateStatus actualiza estado y responde 200", async () => {
  // Arrange
  mockPedidos.updateStatus.mockResolvedValue({ id: "ord-1", status: "ENVIADO" });
  const { req, res, next } = contextoExpress();
  req.params = { id: "ord-1" };
  req.body = { status: "ENVIADO" };

  // Act
  await OrderController.updateStatus(req, res, next);

  // Assert
  expect(res.body.success).toBe(true);
  expect(res.body.data.status).toBe("ENVIADO");
  expect(next.mock.calls.length).toBe(0);
});

test("UNIT-CTRL-ORD-09", "OrderController.updateStatus delega error a next", async () => {
  // Arrange
  mockPedidos.updateStatus.mockRejectedValue(new Error("Invalid status"));
  const { req, res, next } = contextoExpress();
  req.params = { id: "ord-1" };
  req.body = { status: "INVALID" };

  // Act
  await OrderController.updateStatus(req, res, next);

  // Assert
  expect(next.mock.calls.length).toBe(1);
});

// ============================================================================
// ProjectController Tests
// ============================================================================

test("UNIT-CTRL-PROY-01", "ProjectController.list retorna vacío si no hay userId", async () => {
  // Arrange
  const { req, res, next } = contextoExpress();
  req.user = undefined;
  req.query = {};

  // Act
  await ProjectController.list(req, res, next);

  // Assert
  expect(res.body.success).toBe(true);
  expect(res.body.data).toStrictEqual([]);
  expect(next.mock.calls.length).toBe(0);
});

test("UNIT-CTRL-PROY-02", "ProjectController.list lista proyectos de usuario", async () => {
  // Arrange
  mockProyectos.findAllByUserId.mockResolvedValue([{ id: "p-1", name: "Baño" }]);
  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };

  // Act
  await ProjectController.list(req, res, next);

  // Assert
  expect(res.body.success).toBe(true);
  expect(res.body.data.length).toBe(1);
});

test("UNIT-CTRL-PROY-03", "ProjectController.list delega error a next", async () => {
  // Arrange
  mockProyectos.findAllByUserId.mockRejectedValue(new Error("Error"));
  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };

  // Act
  await ProjectController.list(req, res, next);

  // Assert
  expect(next.mock.calls.length).toBe(1);
});

test("UNIT-CTRL-PROY-04", "ProjectController.getDetail retorna proyecto y maneja error", async () => {
  // Arrange
  mockProyectos.findById.mockResolvedValue({ id: "p-1", name: "Cocina" });

  const { req, res, next } = contextoExpress();
  req.params = { id: "p-1" };
  const ctxErr = contextoExpress();
  ctxErr.req.params = { id: "p-none" };

  // Act
  await ProjectController.getDetail(req, res, next);

  // Error case
  mockProyectos.findById.mockRejectedValue(new Error("No encontrado"));
  await ProjectController.getDetail(ctxErr.req, ctxErr.res, ctxErr.next);

  // Assert
  expect(res.body.success).toBe(true);
  expect(res.body.data.id).toBe("p-1");
  expect(ctxErr.next.mock.calls.length).toBe(1);
});

test("UNIT-CTRL-PROY-05", "ProjectController.create crea proyecto y responde 201", async () => {
  // Arrange
  mockProyectos.create.mockResolvedValue({ id: "p-new", name: "Sala", userId: "usr-1" });

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.body = { name: "Sala", type: "PISO", area: 25, materialType: "ceramica", tileFormat: "60x60" };
  const ctxErr = contextoExpress();
  ctxErr.req.user = { id: "usr-1" };
  ctxErr.req.body = req.body;

  // Act
  await ProjectController.create(req, res, next);

  // Error delegation
  mockProyectos.create.mockRejectedValue(new Error("Creation failed"));
  await ProjectController.create(ctxErr.req, ctxErr.res, ctxErr.next);

  // Assert
  expect(res.statusCode).toBe(201);
  expect(res.body.success).toBe(true);
  expect(ctxErr.next.mock.calls.length).toBe(1);
});

test("UNIT-CTRL-PROY-06", "ProjectController.update actualiza proyecto y delega error", async () => {
  // Arrange
  mockProyectos.findById.mockResolvedValue({ id: "p-1", userId: "usr-1", name: "Sala" });
  mockProyectos.update.mockResolvedValue({ id: "p-1", name: "Sala Grande" });

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.params = { id: "p-1" };
  req.body = { name: "Sala Grande" };
  const ctxErr = contextoExpress();
  ctxErr.req.user = { id: "usr-1" };
  ctxErr.req.params = { id: "p-1" };
  ctxErr.req.body = { name: "Fail" };

  // Act
  await ProjectController.update(req, res, next);

  // Error case
  mockProyectos.findById.mockRejectedValue(new Error("Fail"));
  await ProjectController.update(ctxErr.req, ctxErr.res, ctxErr.next);

  // Assert
  expect(res.body.success).toBe(true);
  expect(res.body.data.name).toBe("Sala Grande");
  expect(ctxErr.next.mock.calls.length).toBe(1);
});

test("UNIT-CTRL-PROY-07", "ProjectController.delete borra proyecto y delega error", async () => {
  // Arrange
  mockProyectos.findById.mockResolvedValue({ id: "p-1", userId: "usr-1" });
  mockProyectos.delete.mockResolvedValue();

  const { req, res, next } = contextoExpress();
  req.user = { id: "usr-1" };
  req.params = { id: "p-1" };
  const ctxErr = contextoExpress();
  ctxErr.req.user = { id: "usr-1" };
  ctxErr.req.params = { id: "p-1" };

  // Act
  await ProjectController.delete(req, res, next);

  // Error case
  mockProyectos.findById.mockRejectedValue(new Error("Error borrando"));
  await ProjectController.delete(ctxErr.req, ctxErr.res, ctxErr.next);

  // Assert
  expect(res.body.success).toBe(true);
  expect(ctxErr.next.mock.calls.length).toBe(1);
});

// ============================================================================
// CatalogController Tests
// ============================================================================

test("UNIT-CTRL-CAT-01", "CatalogController.listCategories y listProducts funcionan y delegan errores", async () => {
  // Arrange
  mockCategorias.findAll.mockResolvedValue([{ id: "cat-1", name: "Pisos" }]);

  mockProductos.findAll.mockResolvedValue([{ id: "prd-1", name: "Piso Blanco" }]);
  mockCarritos.getReservedQuantities.mockResolvedValue({});

  // listCategories
  const ctxCat = contextoExpress();
  const ctxCatErr = contextoExpress();

  // listProducts
  const ctxProd = contextoExpress();
  ctxProd.req.query = { category: "pisos", q: "blanco" };
  const ctxProdErr = contextoExpress();
  ctxProdErr.req.query = {};

  // Act
  await CatalogController.listCategories(ctxCat.req, ctxCat.res, ctxCat.next);

  // listCategories error
  mockCategorias.findAll.mockRejectedValue(new Error("Cat err"));
  await CatalogController.listCategories(ctxCatErr.req, ctxCatErr.res, ctxCatErr.next);
  await CatalogController.listProducts(ctxProd.req, ctxProd.res, ctxProd.next);

  // listProducts error
  mockProductos.findAll.mockRejectedValue(new Error("Prod err"));
  await CatalogController.listProducts(ctxProdErr.req, ctxProdErr.res, ctxProdErr.next);

  // Assert
  expect(ctxCat.res.body.success).toBe(true);
  expect(ctxCat.res.body.data.length).toBe(1);
  expect(ctxCatErr.next.mock.calls.length).toBe(1);
  expect(ctxProd.res.body.success).toBe(true);
  expect(ctxProd.res.body.data.length).toBe(1);
  expect(ctxProdErr.next.mock.calls.length).toBe(1);
});

test("UNIT-CTRL-CAT-02", "CatalogController.getProductDetail y getStorefrontProducts", async () => {
  // Arrange
  mockProductos.findById.mockResolvedValue({ id: "prd-1", name: "Piso" });
  mockCarritos.getReservedQuantities.mockResolvedValue({});
  mockProductos.findStorefrontRecommended.mockResolvedValue([{ id: "r1" }]);
  mockProductos.findStorefrontOffers.mockResolvedValue([{ id: "o1" }]);
  mockProductos.findStorefrontBestSellers.mockResolvedValue([{ id: "b1" }]);

  // getProductDetail
  const ctxDet = contextoExpress();
  ctxDet.req.params = { id: "prd-1" };
  const ctxDetErr = contextoExpress();
  ctxDetErr.req.params = { id: "prd-none" };

  // getStorefrontProducts
  const ctxStore = contextoExpress();
  const ctxStoreErr = contextoExpress();

  // Act
  await CatalogController.getProductDetail(ctxDet.req, ctxDet.res, ctxDet.next);

  // getProductDetail error
  mockProductos.findById.mockRejectedValue(new Error("Det err"));
  await CatalogController.getProductDetail(ctxDetErr.req, ctxDetErr.res, ctxDetErr.next);
  await CatalogController.getStorefrontProducts(ctxStore.req, ctxStore.res, ctxStore.next);

  // getStorefrontProducts error
  mockProductos.findStorefrontRecommended.mockRejectedValue(new Error("Store err"));
  await CatalogController.getStorefrontProducts(ctxStoreErr.req, ctxStoreErr.res, ctxStoreErr.next);

  // Assert
  expect(ctxDet.res.body.success).toBe(true);
  expect(ctxDet.res.body.data.id).toBe("prd-1");
  expect(ctxDetErr.next.mock.calls.length).toBe(1);
  expect(ctxStore.res.body.success).toBe(true);
  expect(ctxStore.res.body.data.recommended.length).toBe(1);
  expect(ctxStoreErr.next.mock.calls.length).toBe(1);
});

test("UNIT-CTRL-CAT-03", "CatalogController CRUD productos y reseñas de catálogo", async () => {
  // Arrange

  mockResenas.findByProductId.mockResolvedValue([{ id: "rev-1", rating: 5 }]);
  mockResenas.findByUserAndProduct.mockResolvedValue(null);
  mockProductos.findById.mockResolvedValue({ id: "prd-1", name: "Piso" });
  mockResenas.create.mockResolvedValue({ id: "rev-1", rating: 5, comment: "Buenisimo" });
  mockResenas.getAverageRatingAndCount.mockResolvedValue({ average: 5, count: 1 });
  mockProductos.updateProductRating.mockResolvedValue();
  mockProductos.create.mockResolvedValue({ id: "prd-new", name: "Nuevo" });
  mockProductos.update.mockResolvedValue({ id: "prd-1", name: "Modificado" });
  mockProductos.delete.mockResolvedValue();

  // getProductReviews
  const ctxRevList = contextoExpress();
  ctxRevList.req.params = { id: "prd-1" };

  // createReview
  const ctxRevCreate = contextoExpress();
  ctxRevCreate.req.params = { id: "prd-1" };
  ctxRevCreate.req.user = { id: "usr-1" };
  ctxRevCreate.req.body = { rating: 5, comment: "Buenisimo" };

  // createProduct
  const ctxProdCreate = contextoExpress();
  ctxProdCreate.req.body = { name: "Nuevo", price: 10000 };

  // updateProduct
  const ctxProdUpd = contextoExpress();
  ctxProdUpd.req.params = { id: "prd-1" };
  ctxProdUpd.req.body = { name: "Modificado" };

  // deleteProduct
  const ctxProdDel = contextoExpress();
  ctxProdDel.req.params = { id: "prd-1" };
  const ctxDelErr = contextoExpress();
  ctxDelErr.req.params = { id: "prd-1" };
  const ctxRevErr = contextoExpress();
  ctxRevErr.req.params = { id: "prd-1" };
  ctxRevErr.req.user = { id: "usr-1" };
  ctxRevErr.req.body = { rating: 5 };
  const ctxRevListErr = contextoExpress();
  ctxRevListErr.req.params = { id: "prd-1" };
  const ctxProdCreateErr = contextoExpress();
  ctxProdCreateErr.req.body = { name: "Nuevo" };
  const ctxProdUpdErr = contextoExpress();
  ctxProdUpdErr.req.params = { id: "prd-1" };
  ctxProdUpdErr.req.body = { name: "Modificado" };

  // Act
  await CatalogController.getProductReviews(ctxRevList.req, ctxRevList.res, ctxRevList.next);
  await CatalogController.createReview(ctxRevCreate.req, ctxRevCreate.res, ctxRevCreate.next);
  await CatalogController.createProduct(ctxProdCreate.req, ctxProdCreate.res, ctxProdCreate.next);
  await CatalogController.updateProduct(ctxProdUpd.req, ctxProdUpd.res, ctxProdUpd.next);
  await CatalogController.deleteProduct(ctxProdDel.req, ctxProdDel.res, ctxProdDel.next);

  // Delega errores a next en delete
  mockProductos.delete.mockRejectedValue(new Error("Del err"));
  await CatalogController.deleteProduct(ctxDelErr.req, ctxDelErr.res, ctxDelErr.next);

  // Delega errores en createReview
  mockResenas.findByUserAndProduct.mockRejectedValue(new Error("Rev err"));
  await CatalogController.createReview(ctxRevErr.req, ctxRevErr.res, ctxRevErr.next);

  // Delega errores en getProductReviews
  mockResenas.findByProductId.mockRejectedValue(new Error("Rev list err"));
  await CatalogController.getProductReviews(ctxRevListErr.req, ctxRevListErr.res, ctxRevListErr.next);

  // Delega errores en createProduct
  mockProductos.create.mockRejectedValue(new Error("Create prod err"));
  await CatalogController.createProduct(ctxProdCreateErr.req, ctxProdCreateErr.res, ctxProdCreateErr.next);

  // Delega errores en updateProduct
  mockProductos.update.mockRejectedValue(new Error("Update prod err"));
  await CatalogController.updateProduct(ctxProdUpdErr.req, ctxProdUpdErr.res, ctxProdUpdErr.next);

  // Assert
  expect(ctxRevList.res.body.success).toBe(true);
  expect(ctxRevCreate.res.statusCode).toBe(201);
  expect(ctxProdCreate.res.statusCode).toBe(201);
  expect(ctxProdUpd.res.body.success).toBe(true);
  expect(ctxProdDel.res.body.success).toBe(true);
  expect(ctxDelErr.next.mock.calls.length).toBe(1);
  expect(ctxRevErr.next.mock.calls.length).toBe(1);
  expect(ctxRevListErr.next.mock.calls.length).toBe(1);
  expect(ctxProdCreateErr.next.mock.calls.length).toBe(1);
  expect(ctxProdUpdErr.next.mock.calls.length).toBe(1);
});

// ============================================================================
// AuthController Tests
// ============================================================================

test("UNIT-CTRL-AUTH-01", "AuthController.register y login exitosos", async () => {
  // Arrange
  mockUsuarios.findByEmail.mockResolvedValue(null);
  mockUsuarios.create.mockResolvedValue({ id: "usr-new", email: "new@homara.co", role: "CUSTOMER" });

  // Register
  const ctxReg = contextoExpress();
  ctxReg.req.body = { email: "new@homara.co", password: "Password123!", firstName: "Ana", lastName: "Rojas" };
  const ctxRegErr = contextoExpress();
  ctxRegErr.req.body = ctxReg.req.body;

  // Act
  await AuthController.register(ctxReg.req, ctxReg.res, ctxReg.next);

  // Register error delegation
  mockUsuarios.findByEmail.mockRejectedValue(new Error("Reg err"));
  await AuthController.register(ctxRegErr.req, ctxRegErr.res, ctxRegErr.next);

  // Assert
  expect(ctxReg.res.statusCode).toBe(201);
  expect(ctxReg.res.body.success).toBe(true);
  expect(ctxRegErr.next.mock.calls.length).toBe(1);
});

test("UNIT-CTRL-AUTH-02", "AuthController.getMe y getById formatean perfil", async () => {
  // Arrange
  mockPrisma.project.count.mockResolvedValue(3);
  mockPrisma.order.count.mockResolvedValue(5);

  mockUsuarios.findById.mockResolvedValue({
    id: "usr-1",
    email: "user@homara.co",
    firstName: "Carlos",
    lastName: "Perez",
    role: "CUSTOMER",
    createdAt: new Date()
  });

  // getMe
  const ctxMe = contextoExpress();
  ctxMe.req.user = { id: "usr-1" };

  // getById ("me")
  const ctxByIdMe = contextoExpress();
  ctxByIdMe.req.user = { id: "usr-1" };
  ctxByIdMe.req.params = { id: "me" };

  // getById ("other")
  const ctxByIdOther = contextoExpress();
  ctxByIdOther.req.params = { id: "usr-2" };
  const ctxErr = contextoExpress();
  ctxErr.req.params = { id: "me" };
  ctxErr.req.user = { id: "usr-1" };

  // Act
  await AuthController.getMe(ctxMe.req, ctxMe.res, ctxMe.next);
  await AuthController.getById(ctxByIdMe.req, ctxByIdMe.res, ctxByIdMe.next);
  await AuthController.getById(ctxByIdOther.req, ctxByIdOther.res, ctxByIdOther.next);

  // getById error delegation
  mockUsuarios.findById.mockRejectedValue(new Error("Find err"));
  await AuthController.getById(ctxErr.req, ctxErr.res, ctxErr.next);

  // Assert
  expect(ctxMe.res.body.success).toBe(true);
  expect(ctxMe.res.body.data.projectCount).toBe(3);
  expect(ctxMe.res.body.data.orderCount).toBe(5);
  expect(ctxByIdMe.res.body.success).toBe(true);
  expect(ctxByIdMe.res.body.data.id).toBe("usr-1");
  expect(ctxByIdOther.res.body.success).toBe(true);
  expect(ctxErr.next.mock.calls.length).toBe(1);
});

test("UNIT-CTRL-AUTH-03", "AuthController.update restringe acceso y actualiza campos permitidos", async () => {
  // Arrange
  mockUsuarios.update.mockResolvedValue({ id: "usr-1", firstName: "NuevoNombre" });

  // No autorizado (intenta modificar otro perfil sin ser admin)
  const ctxForbidden = contextoExpress();
  ctxForbidden.req.user = { id: "usr-1", role: "CUSTOMER" };
  ctxForbidden.req.params = { id: "usr-other" };
  ctxForbidden.req.body = { firstName: "Hacker" };

  // Autorizado (modifica su propio perfil "me")
  const ctxOk = contextoExpress();
  ctxOk.req.user = { id: "usr-1", role: "CUSTOMER" };
  ctxOk.req.params = { id: "me" };
  ctxOk.req.body = { firstName: "NuevoNombre" };

  // Autorizado con cambio de contraseña
  const ctxPass = contextoExpress();
  ctxPass.req.user = { id: "usr-1", role: "CUSTOMER" };
  ctxPass.req.params = { id: "usr-1" };
  ctxPass.req.body = { password: "NewPassword123" };

  // Act
  await AuthController.update(ctxForbidden.req, ctxForbidden.res, ctxForbidden.next);
  await AuthController.update(ctxOk.req, ctxOk.res, ctxOk.next);
  await AuthController.update(ctxPass.req, ctxPass.res, ctxPass.next);

  // Assert
  expect(ctxForbidden.next.mock.calls.length).toBe(1);
  const err = ctxForbidden.next.mock.calls[0][0];
  expect(err).toBeInstanceOf(AppError);
  expect(err.statusCode).toBe(403);
  expect(ctxOk.res.body.success).toBe(true);
  expect(ctxOk.res.body.data.firstName).toBe("NuevoNombre");
  expect(ctxPass.res.body.success).toBe(true);
});

// ============================================================================
// AdminController Tests
// ============================================================================

test("UNIT-CTRL-ADM-01", "AdminController.getMetrics calcula métricas y delega errores a next", async () => {
  // Arrange
  mockPrisma.order.findMany
    .mockResolvedValueOnce([{ total: 100000, status: "ENTREGADO" }])
    .mockResolvedValueOnce([{ total: 80000, status: "ENTREGADO" }])
    .mockResolvedValueOnce([{ total: 100000, createdAt: new Date() }]);
  mockPrisma.order.count.mockResolvedValue(5);
  mockPrisma.orderItem.findMany.mockResolvedValue([
    { total: 50000, product: { category: { name: "Pisos" } } },
  ]);
  mockPrisma.product.count.mockResolvedValue(40);
  mockPrisma.user.count.mockResolvedValue(12);

  // Success
  const ctx = contextoExpress();
  const ctxErr = contextoExpress();

  // Act
  await AdminController.getMetrics(ctx.req, ctx.res, ctx.next);

  // Error delegation
  mockPrisma.order.findMany.mockRejectedValue(new Error("Metrics DB Err"));
  await AdminController.getMetrics(ctxErr.req, ctxErr.res, ctxErr.next);

  // Assert
  expect(ctx.res.body.success).toBe(true);
  expect(Array.isArray(ctx.res.body.data)).toBe(true);
  expect(ctx.res.body.data[0].label).toBe("Ventas del Mes");
  expect(ctx.res.body.data[1].label).toBe("Pedidos Activos");
  expect(ctx.res.body.charts.topCategories.length).toBe(1);
  expect(ctx.next.mock.calls.length).toBe(0);
  expect(ctxErr.next.mock.calls.length).toBe(1);
  expect(ctxErr.next.mock.calls[0][0].message).toBe("Metrics DB Err");
});

test("UNIT-CTRL-ADM-02", "AdminController.getInventoryReport genera estadísticas de inventario y delega errores", async () => {
  // Arrange
  mockPrisma.product.findMany.mockResolvedValue([
    { id: "p1", name: "Piso", category: { name: "Pisos" }, stockQuantity: 60, unit: "m²", price: 50000, inStock: true },
    { id: "p2", name: "Pintura", category: { name: "Pinturas" }, stockQuantity: 20, unit: "galon", price: 30000, inStock: true },
    { id: "p3", name: "Tornillos", category: { name: "Fijaciones" }, stockQuantity: 0, unit: "caja", price: 5000, inStock: false },
    { id: "p4", name: "Defectuoso", category: { name: "Varios" }, stockQuantity: -2, unit: "u", price: 1000, inStock: false },
  ]);

  // Success
  const ctx = contextoExpress();
  const ctxErr = contextoExpress();

  // Act
  await AdminController.getInventoryReport(ctx.req, ctx.res, ctx.next);

  // Error delegation
  mockPrisma.product.findMany.mockRejectedValue(new Error("Inventory DB Err"));
  await AdminController.getInventoryReport(ctxErr.req, ctxErr.res, ctxErr.next);

  // Assert
  expect(ctx.res.body.success).toBe(true);
  const stats = ctx.res.body.data.stats;
  expect(stats.totalProducts).toBe(4);
  expect(stats.totalUnits).toBe(78);
  expect(stats.lowStockCount).toBe(1);
  expect(stats.outOfStockCount).toBe(1);
  expect(stats.negativeStockCount).toBe(1);
  expect(ctx.next.mock.calls.length).toBe(0);
  expect(ctxErr.next.mock.calls.length).toBe(1);
  expect(ctxErr.next.mock.calls[0][0].message).toBe("Inventory DB Err");
});
