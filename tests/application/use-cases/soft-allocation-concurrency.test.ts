import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "dotenv/config";
import { prisma } from "../../../src/infrastructure/database/prisma-client.js";
import { PrismaOrderRepository } from "../../../src/infrastructure/database/repositories/prisma-order.repository.js";
import { PrismaCartRepository } from "../../../src/infrastructure/database/repositories/prisma-cart.repository.js";
import { PrismaProductRepository } from "../../../src/infrastructure/database/repositories/prisma-product.repository.js";
import { CreateOrderUseCase } from "../../../src/application/use-cases/order.use-cases.js";
import { GetProductDetailUseCase } from "../../../src/application/use-cases/catalog.use-cases.js";

describe("Soft Allocation & Concurrency Integration Tests", () => {
  const orderRepo = new PrismaOrderRepository();
  const cartRepo = new PrismaCartRepository();
  const productRepo = new PrismaProductRepository();

  const createOrderUseCase = new CreateOrderUseCase(orderRepo, cartRepo, productRepo);
  const getProductDetailUseCase = new GetProductDetailUseCase(productRepo, cartRepo);

  // Test data IDs
  const categoryId = "test-cat-concurrency";
  const productId = "test-prod-concurrency";
  const userAId = "test-user-a";
  const userBId = "test-user-b";

  beforeAll(async () => {
    // 1. Cleanup residues from previous failures if any
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: [userAId, userBId] } } } });
    await prisma.order.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.cartItem.deleteMany({ where: { cart: { userId: { in: [userAId, userBId] } } } });
    await prisma.cart.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });

    // 2. Create test records
    await prisma.category.create({
      data: {
        id: categoryId,
        name: "Test Pisos",
        slug: "test-pisos",
        description: "Test description",
        icon: "🏗️"
      }
    });

    await prisma.product.create({
      data: {
        id: productId,
        name: "Test Concurrency Tile",
        description: "Premium Tile for concurrency testing",
        price: 100000,
        originalPrice: 120000,
        image: "test-tile.jpg",
        rating: 4.8,
        reviewCount: 2,
        inStock: true,
        stockQuantity: 5, // Starts with 5 units
        unit: "m²",
        categoryId: categoryId
      }
    });

    await prisma.user.createMany({
      data: [
        {
          id: userAId,
          email: "usera@test.com",
          password: "dummy-password",
          firstName: "User",
          lastName: "A",
          phone: "123",
          address: "Address A",
          city: "Bogota",
          state: "DC",
          zipCode: "110111",
          role: "CUSTOMER"
        },
        {
          id: userBId,
          email: "userb@test.com",
          password: "dummy-password",
          firstName: "User",
          lastName: "B",
          phone: "456",
          address: "Address B",
          city: "Bogota",
          state: "DC",
          zipCode: "110111",
          role: "CUSTOMER"
        }
      ]
    });

    // Create carts
    await prisma.cart.createMany({
      data: [
        { id: "cart-a", userId: userAId },
        { id: "cart-b", userId: userBId }
      ]
    });
  });

  afterAll(async () => {
    // Final cleanup of test records
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: [userAId, userBId] } } } });
    await prisma.order.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.cartItem.deleteMany({ where: { cart: { userId: { in: [userAId, userBId] } } } });
    await prisma.cart.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.$disconnect();
  });

  it("debe validar Soft Allocation: el stock en el carrito de un usuario reduce el stock visible para otros, y expira a los 15 minutos", async () => {
    // 1. User B checks stock when both carts are empty. Stock should be 5.
    let prodDetail = await getProductDetailUseCase.execute(productId, undefined);
    expect(prodDetail.stockQuantity).toBe(5);
    expect(prodDetail.inStock).toBe(true);

    // 2. User A adds 2 units to their cart (soft reservation)
    await cartRepo.addItem("cart-a", productId, 2);

    // 3. User B (anonymous or other user) checks stock. Stock should now be 3.
    prodDetail = await getProductDetailUseCase.execute(productId, userBId);
    expect(prodDetail.stockQuantity).toBe(3);
    expect(prodDetail.inStock).toBe(true);

    // 4. User A checks stock. User A's own reservation should not be deducted from User A's view. Stock should be 5.
    prodDetail = await getProductDetailUseCase.execute(productId, userAId);
    expect(prodDetail.stockQuantity).toBe(5);

    // 5. Expire the reservation by manually setting updatedAt of User A's hold to 20 minutes ago in the DB
    const expiredTime = new Date(Date.now() - 20 * 60 * 1000);
    await prisma.cartItem.updateMany({
      where: { cartId: "cart-a", productId },
      data: { updatedAt: expiredTime }
    });

    // 6. User B checks stock again. The reservation should be ignored, restoring the visible stock to 5.
    prodDetail = await getProductDetailUseCase.execute(productId, userBId);
    expect(prodDetail.stockQuantity).toBe(5);

    // Clean up cart item
    await prisma.cartItem.deleteMany({ where: { cartId: "cart-a" } });
  });

  it("debe validar concurrencia extrema: dos checkouts paralelos que compran el mismo producto serializan correctamente sus compras", async () => {
    // 1. Reset product stock to 5
    await prisma.product.update({
      where: { id: productId },
      data: { stockQuantity: 5, inStock: true }
    });

    // 2. Add items to both carts:
    // User A has 3 units in cart (will buy stock)
    // User B has 4 units in cart (will trigger backorder)
    await cartRepo.addItem("cart-a", productId, 3);
    await cartRepo.addItem("cart-b", productId, 4);

    // Expire these reservations so they do not logically block each other during available stock checks
    const expiredTime = new Date(Date.now() - 20 * 60 * 1000);
    await prisma.cartItem.updateMany({
      where: { productId },
      data: { updatedAt: expiredTime }
    });

    // 3. Run checkouts concurrently using Promise.all
    const results = await Promise.all([
      createOrderUseCase.execute(userAId, { paymentMethod: "tarjeta" }),
      createOrderUseCase.execute(userBId, { paymentMethod: "tarjeta" })
    ]);

    // 4. Verify that both checkouts completed successfully
    expect(results.length).toBe(2);
    expect(results[0]).toBeDefined();
    expect(results[1]).toBeDefined();

    // 5. Verify the product's final stock quantity is exactly 5 - 3 - 4 = -2
    const finalProduct = await prisma.product.findUnique({ where: { id: productId } });
    expect(finalProduct).toBeDefined();
    expect(finalProduct?.stockQuantity).toBe(-2);
    expect(finalProduct?.inStock).toBe(false);

    // 6. Verify one order had regular items, and the other had backordered items
    const orderItems = await prisma.orderItem.findMany({
      where: { productId },
      include: { order: true }
    });

    // Total requested quantity is 7 units
    const totalQty = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    expect(totalQty).toBe(7);

    // Check backorders
    const orderA = orderItems.find(item => item.order.userId === userAId);
    const orderB = orderItems.find(item => item.order.userId === userBId);

    expect(orderA).toBeDefined();
    expect(orderB).toBeDefined();

    // Since they executed concurrently, one will have hit the DB first (due to FOR UPDATE serialization).
    // The first transaction reads stock 5, takes 3 units. Remaining stock is 2. (isBackorder = false)
    // The second transaction reads stock 2, takes 4 units. Remaining stock is -2. (isBackorder = true, backorderQuantity = 2)
    // Let's assert these properties:
    const firstOrder = orderA?.order.createdAt.getTime()! < orderB?.order.createdAt.getTime()! ? orderA : orderB;
    const secondOrder = firstOrder === orderA ? orderB : orderA;

    // The first buyer gets it fully in stock
    expect(firstOrder?.isBackorder).toBe(false);
    expect(firstOrder?.backorderQuantity).toBe(0);

    // The second buyer gets 2 units in stock, and 2 units in backorder
    expect(secondOrder?.isBackorder).toBe(true);
    expect(secondOrder?.backorderQuantity).toBe(2); // Since remaining stock was 2, and they wanted 4, 4 - 2 = 2 backordered units.
  });
});
