import { describe, it, expect, vi } from "vitest";
import { ListOrdersUseCase, GetOrderDetailUseCase, CreateOrderUseCase, UpdateOrderStatusUseCase } from "../../../src/application/use-cases/order.use-cases.js";
import { Order, OrderItem } from "../../../src/domain/entities/order.js";
import { Cart, CartItem } from "../../../src/domain/entities/cart.js";
import { Product } from "../../../src/domain/entities/product.js";
import { AppError } from "../../../src/shared/errors/AppError.js";

type MutableProductCategory = {
  category?: { name: string };
};

// Mocks
const mockOrderRepository = {
  findAll: vi.fn(),
  findByIdOrNumber: vi.fn(),
  create: vi.fn(),
  updateStatus: vi.fn(),
  countByYear: vi.fn()
};

const mockCartRepository = {
  findByUserId: vi.fn(),
  addItem: vi.fn(),
  updateItemQuantity: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

const mockProductRepository = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updateStock: vi.fn()
};

describe("Order Use Cases", () => {
  describe("ListOrdersUseCase", () => {
    it("debe listar y formatear correctamente las órdenes", async () => {
      const order = new Order(
        "ord-123",
        "HOM-2026-0001",
        "PROCESANDO",
        150000,
        25000,
        175000,
        "tarjeta",
        "Calle 123",
        "Bogota",
        "DC",
        "110111",
        null,
        "user-456",
        new Date("2026-05-23T12:00:00Z"),
        new Date("2026-05-23T12:00:00Z"),
        [new OrderItem("item-1", 1, 150000, 150000, "ord-123", "prod-1")],
        { firstName: "Alejo", lastName: "Kravs", email: "alejo@homara.com" }
      );

      mockOrderRepository.findAll.mockResolvedValue([order]);

      const useCase = new ListOrdersUseCase(mockOrderRepository);
      const result = await useCase.execute({ userId: "user-456" });

      expect(mockOrderRepository.findAll).toHaveBeenCalledWith({ userId: "user-456" });
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0]).toEqual({
        id: "HOM-2026-0001",
        dbId: "ord-123",
        date: "2026-05-23",
        status: "procesando",
        items: 1,
        total: 175000,
        customer: "Alejo Kravs"
      });
    });
  });

  describe("GetOrderDetailUseCase", () => {
    it("debe retornar los detalles formateados de la orden si existe", async () => {
      const product = new Product(
        "prod-1",
        "Porcelanato",
        "Porcelanato premium",
        150000,
        null,
        "image.jpg",
        4.5,
        1,
        true,
        50,
        "m²",
        "cat-1"
      );
      
      const orderItem = new OrderItem("item-1", 2, 150000, 300000, "ord-123", "prod-1", product);
      const productWithCategory = orderItem.product as unknown as MutableProductCategory;
      productWithCategory.category = { name: "Pisos" };

      const order = new Order(
        "ord-123",
        "HOM-2026-0001",
        "PENDIENTE",
        300000,
        25000,
        325000,
        "pse",
        "Calle 123",
        "Bogota",
        "DC",
        "110111",
        "Entregar por la tarde",
        "user-456",
        new Date("2026-05-23T12:00:00Z"),
        new Date("2026-05-23T12:00:00Z"),
        [orderItem],
        { firstName: "Alejo", lastName: "Kravs", email: "alejo@homara.com" }
      );

      mockOrderRepository.findByIdOrNumber.mockResolvedValue(order);

      const useCase = new GetOrderDetailUseCase(mockOrderRepository);
      const result = await useCase.execute("HOM-2026-0001");

      expect(mockOrderRepository.findByIdOrNumber).toHaveBeenCalledWith("HOM-2026-0001");
      expect(result).toBeDefined();
      expect(result.id).toBe("HOM-2026-0001");
      expect(result.status).toBe("pendiente");
      expect(result.customer).toEqual({
        name: "Alejo Kravs",
        email: "alejo@homara.com"
      });
      expect(result.items.length).toBe(1);
      expect(result.items[0]).toEqual({
        id: "item-1",
        productName: "Porcelanato",
        productImage: "image.jpg",
        category: "Pisos",
        quantity: 2,
        unitPrice: 150000,
        total: 300000
      });
    });

    it("debe lanzar AppError 404 si la orden no existe", async () => {
      mockOrderRepository.findByIdOrNumber.mockResolvedValue(null);

      const useCase = new GetOrderDetailUseCase(mockOrderRepository);

      await expect(useCase.execute("HOM-NOT-FOUND")).rejects.toThrowError(
        new AppError("Pedido no encontrado", 404)
      );
    });
  });

  describe("CreateOrderUseCase", () => {
    it("debe crear exitosamente una orden a partir del carrito del usuario", async () => {
      const product = new Product(
        "prod-1",
        "Porcelanato",
        "Premium",
        100000,
        null,
        "img.jpg",
        5,
        1,
        true,
        10,
        "m²",
        "cat-1"
      );
      
      const cartItem = new CartItem("citem-1", 3, "cart-123", "prod-1", product);
      const cart = new Cart("cart-123", "user-123", new Date(), new Date(), [cartItem]);
      mockCartRepository.findByUserId.mockResolvedValue(cart);

      const createdOrder = new Order(
        "ord-new",
        "HOM-2026-0002",
        "PENDIENTE",
        300000,
        25000,
        325000,
        "tarjeta",
        "Calle 456",
        "Bogota",
        "DC",
        "110111",
        null,
        "user-123"
      );
      mockOrderRepository.create.mockResolvedValue(createdOrder);

      const useCase = new CreateOrderUseCase(
        mockOrderRepository,
        mockCartRepository,
        mockProductRepository
      );

      const result = await useCase.execute("user-123", {
        paymentMethod: "tarjeta",
        shippingAddress: "Calle 456",
        shippingCity: "Bogota",
        shippingState: "DC",
        shippingZip: "110111"
      });

      expect(mockCartRepository.findByUserId).toHaveBeenCalledWith("user-123");
      expect(mockOrderRepository.create).toHaveBeenCalledWith({
        status: "PENDIENTE",
        subtotal: 300000, // 100000 * 3
        shippingCost: 25000, // subtotal < 500000
        total: 325000,
        paymentMethod: "tarjeta",
        shippingAddress: "Calle 456",
        shippingCity: "Bogota",
        shippingState: "DC",
        shippingZip: "110111",
        shippingNotes: null,
        userId: "user-123",
        items: [
          {
            productId: "prod-1",
            quantity: 3,
            unitPrice: 100000,
            total: 300000
          }
        ]
      });
      expect(result).toEqual(createdOrder);
    });

    it("debe lanzar AppError 400 si el carrito está vacío", async () => {
      const cart = new Cart("cart-123", "user-123", new Date(), new Date(), []);
      mockCartRepository.findByUserId.mockResolvedValue(cart);

      const useCase = new CreateOrderUseCase(
        mockOrderRepository,
        mockCartRepository,
        mockProductRepository
      );

      await expect(
        useCase.execute("user-123", { paymentMethod: "tarjeta" })
      ).rejects.toThrowError(
        new AppError("El carrito está vacío", 400)
      );
    });
  });

  describe("UpdateOrderStatusUseCase", () => {
    it("debe actualizar el estado de la orden si es un estado válido", async () => {
      const updatedOrder = new Order(
        "ord-123",
        "HOM-2026-0001",
        "ENVIADO",
        150000,
        25000,
        175000,
        "tarjeta",
        "Calle 123",
        null,
        null,
        null,
        null,
        "user-456"
      );
      mockOrderRepository.updateStatus.mockResolvedValue(updatedOrder);

      const useCase = new UpdateOrderStatusUseCase(mockOrderRepository);
      const result = await useCase.execute("ord-123", "enviado"); // Caso insensible a mayúsculas/minúsculas

      expect(mockOrderRepository.updateStatus).toHaveBeenCalledWith("ord-123", "ENVIADO");
      expect(result).toEqual(updatedOrder);
    });

    it("debe lanzar AppError 400 si el estado es inválido", async () => {
      const useCase = new UpdateOrderStatusUseCase(mockOrderRepository);

      await expect(
        useCase.execute("ord-123", "INVALIDO")
      ).rejects.toThrowError(
        /Estado inválido. Valores válidos:/
      );
    });
  });
});
