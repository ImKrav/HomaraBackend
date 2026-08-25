import { describe, it, expect, beforeEach } from "vitest";
import { GetProductDetailUseCase } from "../../src/application/use-cases/catalog.use-cases.js";
import { AppError } from "../../src/shared/errors/AppError.js";
import { mockProductRepository, mockCartRepository, producto, carrito } from "../_ayudas.js";

describe("F-CAT-02 · Ver el detalle de un producto", () => {
  let productos: ReturnType<typeof mockProductRepository>;
  let carritos: ReturnType<typeof mockCartRepository>;
  let caso: GetProductDetailUseCase;

  beforeEach(() => {
    productos = mockProductRepository();
    carritos = mockCartRepository();
    caso = new GetProductDetailUseCase(productos, carritos);
  });

  it("CP-F-CAT-02-01: Retorna 404 si el producto no existe", async () => {
    productos.findById.mockResolvedValue(null);

    const error = await caso.execute("prd_inexistente").catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Producto no encontrado");
    expect(carritos.findByUserId).not.toHaveBeenCalled();
    expect(carritos.getReservedQuantities).not.toHaveBeenCalled();
  });

  it("CP-F-CAT-02-02: Excluye la reserva propia del usuario autenticado al calcular stock disponible", async () => {
    productos.findById.mockResolvedValue(producto({ id: "prd_001", stockQuantity: 10 }));
    carritos.findByUserId.mockResolvedValue(carrito({ id: "cart_001" }));
    carritos.getReservedQuantities.mockResolvedValue({ prd_001: 4 });

    const ficha = await caso.execute("prd_001", "usr_001");

    expect(carritos.findByUserId).toHaveBeenCalledWith("usr_001");
    expect(carritos.getReservedQuantities).toHaveBeenCalledWith("cart_001", ["prd_001"]);
    expect(ficha.stockQuantity).toBe(6);
    expect(ficha.inStock).toBe(true);
    expect(ficha.price).toBe(38900);
    expect(ficha.originalPrice).toBeNull();
    expect(ficha.unit).toBe("m²");
    expect(ficha.category).toBe("Pisos y Ceramicas");
  });

  it("CP-F-CAT-02-03: Descuenta todas las reservas activas para usuario anónimo", async () => {
    productos.findById.mockResolvedValue(producto({ id: "prd_001", stockQuantity: 10 }));
    carritos.getReservedQuantities.mockResolvedValue({ prd_001: 4 });

    const ficha = await caso.execute("prd_001");

    expect(carritos.findByUserId).not.toHaveBeenCalled();
    expect(carritos.getReservedQuantities).toHaveBeenCalledWith("", ["prd_001"]);
    expect(ficha.stockQuantity).toBe(6);
    expect(ficha.inStock).toBe(true);
  });

  it("CP-F-CAT-02-03b: Marca producto como agotado si las reservas consumen todo el stock", async () => {
    productos.findById.mockResolvedValue(
      producto({ id: "prd_001", stockQuantity: 3, inStock: true })
    );
    carritos.getReservedQuantities.mockResolvedValue({ prd_001: 9 });

    const ficha = await caso.execute("prd_001");

    expect(ficha.stockQuantity).toBe(0);
    expect(ficha.inStock).toBe(false);
  });

  it("CP-F-CAT-02-03c: Mantiene stock físico intacto cuando no hay reservas activas", async () => {
    productos.findById.mockResolvedValue(producto({ id: "prd_001", stockQuantity: 7 }));
    carritos.getReservedQuantities.mockResolvedValue({});

    const ficha = await caso.execute("prd_001");

    expect(ficha.stockQuantity).toBe(7);
    expect(ficha.inStock).toBe(true);
  });
});
