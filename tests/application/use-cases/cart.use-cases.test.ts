import { describe, it, expect, vi } from "vitest";
import { GetCartUseCase, AddCartItemUseCase, UpdateCartItemQuantityUseCase, RemoveCartItemUseCase } from "../../../src/application/use-cases/cart.use-cases.js";
import { Cart, CartItem } from "../../../src/domain/entities/cart.js";
import { Product } from "../../../src/domain/entities/product.js";
import { AppError } from "../../../src/shared/errors/AppError.js";

type MutableProductRelations = {
  category?: { name: string; slug: string };
  tags?: string[];
};

// Mock ICartRepository
const mockCartRepository = {
  findByUserId: vi.fn(),
  addItem: vi.fn(),
  updateItemQuantity: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  findItemOwner: vi.fn().mockResolvedValue("user-123"),
  getReservedQuantities: vi.fn()
};

describe("Cart Use Cases", () => {
  describe("GetCartUseCase", () => {
    it("debe retornar el carrito formateado con envío cobrado si subtotal <= 500.000 COP", async () => {
      const product = new Product(
        "prod-1",
        "Porcelanato",
        "Porcelanato premium",
        45000,
        50000,
        "image.jpg",
        4.5,
        10,
        true,
        100,
        "m²",
        "cat-1",
        new Date(),
        new Date()
      );
      
      const cartItem = new CartItem("item-1", 2, "cart-123", "prod-1", product);
      const productWithRelations = cartItem.product as unknown as MutableProductRelations;
      productWithRelations.category = { name: "Pisos", slug: "pisos" };
      productWithRelations.tags = ["nuevo"];

      const cart = new Cart("cart-123", "user-123", new Date(), new Date(), [cartItem]);
      mockCartRepository.findByUserId.mockResolvedValue(cart);
      mockCartRepository.getReservedQuantities.mockResolvedValue({ "prod-1": 0 });

      const useCase = new GetCartUseCase(mockCartRepository);
      const result = await useCase.execute("user-123");

      expect(mockCartRepository.findByUserId).toHaveBeenCalledWith("user-123");
      expect(result).toBeDefined();
      expect(result.id).toBe("cart-123");
      expect(result.subtotal).toBe(90000); // 45000 * 2
      expect(result.shipping).toBe(25000); // subtotal <= 500000
      expect(result.total).toBe(115000); // 90000 + 25000
      expect(result.itemCount).toBe(1);
      expect(result.items[0].product.name).toBe("Porcelanato");
      expect(result.items[0].product.category).toBe("Pisos");
      expect(result.items[0].product.tags).toEqual(["nuevo"]);
    });

    it("debe retornar el carrito con envío gratis (0 COP) si subtotal > 500.000 COP", async () => {
      const product = new Product(
        "prod-2",
        "Mueble de baño",
        "Mueble de madera premium",
        300000,
        350000,
        "mueble.jpg",
        4.8,
        5,
        true,
        10,
        "unidad",
        "cat-2",
        new Date(),
        new Date()
      );
      
      const cartItem = new CartItem("item-2", 2, "cart-123", "prod-2", product);
      const productWithRelations = cartItem.product as unknown as MutableProductRelations;
      productWithRelations.category = { name: "Baño", slug: "banio" };
      productWithRelations.tags = ["popular"];

      const cart = new Cart("cart-123", "user-123", new Date(), new Date(), [cartItem]);
      mockCartRepository.findByUserId.mockResolvedValue(cart);
      mockCartRepository.getReservedQuantities.mockResolvedValue({ "prod-2": 0 });

      const useCase = new GetCartUseCase(mockCartRepository);
      const result = await useCase.execute("user-123");

      expect(result.subtotal).toBe(600000); // 300000 * 2
      expect(result.shipping).toBe(0); // subtotal > 500000
      expect(result.total).toBe(600000);
      expect(result.itemCount).toBe(1);
    });
  });

  describe("AddCartItemUseCase", () => {
    it("debe agregar un item al carrito llamando al repositorio con el ID correcto del carrito", async () => {
      const cart = new Cart("cart-123", "user-123", new Date(), new Date(), []);
      mockCartRepository.findByUserId.mockResolvedValue(cart);

      const cartItem = new CartItem("item-created", 3, "cart-123", "prod-1");
      mockCartRepository.addItem.mockResolvedValue(cartItem);

      const useCase = new AddCartItemUseCase(mockCartRepository);
      const result = await useCase.execute("user-123", "prod-1", 3);

      expect(mockCartRepository.findByUserId).toHaveBeenCalledWith("user-123");
      expect(mockCartRepository.addItem).toHaveBeenCalledWith("cart-123", "prod-1", 3);
      expect(result).toEqual(cartItem);
    });
  });

  describe("UpdateCartItemQuantityUseCase", () => {
    it("debe actualizar la cantidad si es al menos 1 y el usuario es el dueño", async () => {
      const updatedItem = new CartItem("item-1", 5, "cart-123", "prod-1");
      mockCartRepository.updateItemQuantity.mockResolvedValue(updatedItem);
      mockCartRepository.findItemOwner.mockResolvedValue("user-123");

      const useCase = new UpdateCartItemQuantityUseCase(mockCartRepository);
      const result = await useCase.execute("item-1", "user-123", 5);

      expect(mockCartRepository.findItemOwner).toHaveBeenCalledWith("item-1");
      expect(mockCartRepository.updateItemQuantity).toHaveBeenCalledWith("item-1", 5);
      expect(result).toEqual(updatedItem);
    });

    it("debe lanzar AppError 400 si la cantidad es menor a 1", async () => {
      const useCase = new UpdateCartItemQuantityUseCase(mockCartRepository);

      await expect(useCase.execute("item-1", "user-123", 0)).rejects.toThrowError(
        new AppError("La cantidad debe ser al menos 1", 400)
      );
    });

    it("debe lanzar AppError 404 si el item no existe", async () => {
      mockCartRepository.findItemOwner.mockResolvedValue(null);

      const useCase = new UpdateCartItemQuantityUseCase(mockCartRepository);

      await expect(useCase.execute("item-nonexistent", "user-123", 5)).rejects.toThrowError(
        new AppError("Item del carrito no encontrado", 404)
      );
    });

    it("debe lanzar AppError 403 si el usuario no es el dueño del item", async () => {
      mockCartRepository.findItemOwner.mockResolvedValue("other-user");

      const useCase = new UpdateCartItemQuantityUseCase(mockCartRepository);

      await expect(useCase.execute("item-1", "user-123", 5)).rejects.toThrowError(
        new AppError("No tienes permiso para modificar este item del carrito.", 403)
      );
    });
  });

  describe("RemoveCartItemUseCase", () => {
    it("debe eliminar el item llamando al repositorio si el usuario es el dueño", async () => {
      mockCartRepository.removeItem.mockResolvedValue(undefined);
      mockCartRepository.findItemOwner.mockResolvedValue("user-123");

      const useCase = new RemoveCartItemUseCase(mockCartRepository);
      await useCase.execute("item-1", "user-123");

      expect(mockCartRepository.findItemOwner).toHaveBeenCalledWith("item-1");
      expect(mockCartRepository.removeItem).toHaveBeenCalledWith("item-1");
    });

    it("debe lanzar AppError 404 si el item no existe", async () => {
      mockCartRepository.findItemOwner.mockResolvedValue(null);

      const useCase = new RemoveCartItemUseCase(mockCartRepository);

      await expect(useCase.execute("item-nonexistent", "user-123")).rejects.toThrowError(
        new AppError("Item del carrito no encontrado", 404)
      );
    });

    it("debe lanzar AppError 403 si el usuario no es el dueño del item", async () => {
      mockCartRepository.findItemOwner.mockResolvedValue("other-user");

      const useCase = new RemoveCartItemUseCase(mockCartRepository);

      await expect(useCase.execute("item-1", "user-123")).rejects.toThrowError(
        new AppError("No tienes permiso para eliminar este item del carrito.", 403)
      );
    });
  });
});
