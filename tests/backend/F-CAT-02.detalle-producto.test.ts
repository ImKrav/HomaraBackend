// ============================================================================
// F-CAT-02 · Ver el detalle de un producto — Backend
// Grafo:   09_F-CAT-02_BACKEND_Ver_el_detalle_de_un_producto.drawio
// Unidad:  GetProductDetailUseCase.execute()  ·  GET /api/v1/products/:id
// Métrica: N=14  A=15  P=2  →  V(G) = 15 − 14 + 2 = 3
// Cobertura de ruta básica: 3 caminos independientes → 3 casos de prueba
// Trazabilidad: RF10 · HU10 · ESC10 (CP-045–CP-048) · BE-CAT-02
// ============================================================================
import { describe, it, expect, beforeEach } from "vitest";
import { GetProductDetailUseCase } from "../../src/application/use-cases/catalog.use-cases.js";
import { AppError } from "../../src/shared/errors/AppError.js";
import {
  mockProductRepository,
  mockCartRepository,
  producto,
  carrito,
} from "../_ayudas.js";

describe("F-CAT-02 · Ver el detalle de un producto", () => {
  let productos: ReturnType<typeof mockProductRepository>;
  let carritos: ReturnType<typeof mockCartRepository>;
  let caso: GetProductDetailUseCase;

  beforeEach(() => {
    productos = mockProductRepository();
    carritos = mockCartRepository();
    caso = new GetProductDetailUseCase(productos, carritos);
  });

  it("CP-F-CAT-02-01 · camino 1,2,3,4,8,F · Paso 3 = NO → el producto no existe y se responde 404", async () => {
    productos.findById.mockResolvedValue(null);            // fuerza Paso 3 = NO

    // Nodo 4: se lanza AppError 404; el nodo 8 lo traduce a la respuesta HTTP.
    const error = await caso.execute("prd_inexistente").catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Producto no encontrado");
    // Salida esperada: el cálculo de reservas nunca se ejecuta.
    expect(carritos.findByUserId).not.toHaveBeenCalled();
    expect(carritos.getReservedQuantities).not.toHaveBeenCalled();
  });

  it("CP-F-CAT-02-02 · camino 1,2,3,5,6,9,10,11,12,13,F · Paso 3 = SI, Paso 5 = SI → con sesión iniciada su propia reserva no se descuenta", async () => {
    productos.findById.mockResolvedValue(producto({ id: "prd_001", stockQuantity: 10 }));
    carritos.findByUserId.mockResolvedValue(carrito({ id: "cart_001" })); // fuerza Paso 5 = SI
    carritos.getReservedQuantities.mockResolvedValue({ prd_001: 4 });

    const ficha = await caso.execute("prd_001", "usr_001");

    // Nodo 6: el carrito propio se excluye del cálculo (excludeCartId = cart.id).
    expect(carritos.findByUserId).toHaveBeenCalledWith("usr_001");
    // Nodo 9: solo se consultan las reservas del producto consultado.
    expect(carritos.getReservedQuantities).toHaveBeenCalledWith("cart_001", ["prd_001"]);
    // Nodos 10, 11 y 12: reservado = 4 → stockDinamico = 6 → inStock = true.
    expect(ficha.stockQuantity).toBe(6);
    expect(ficha.inStock).toBe(true);
    // Nodo 13: la ficha entrega precio, precio original, unidad y categoría.
    expect(ficha.price).toBe(38900);
    expect(ficha.originalPrice).toBeNull();
    expect(ficha.unit).toBe("m²");
    expect(ficha.category).toBe("Pisos y Ceramicas");
  });

  it("CP-F-CAT-02-03 · camino 1,2,3,5,7,9,10,11,12,13,F · Paso 3 = SI, Paso 5 = NO → visitante anónimo: se descuentan todas las reservas activas", async () => {
    productos.findById.mockResolvedValue(producto({ id: "prd_001", stockQuantity: 10 }));
    carritos.getReservedQuantities.mockResolvedValue({ prd_001: 4 });

    const ficha = await caso.execute("prd_001");           // sin userId: fuerza Paso 5 = NO

    // Nodo 7: excludeCartId = "" porque el visitante no tiene carrito propio.
    expect(carritos.findByUserId).not.toHaveBeenCalled();
    expect(carritos.getReservedQuantities).toHaveBeenCalledWith("", ["prd_001"]);
    expect(ficha.stockQuantity).toBe(6);
    expect(ficha.inStock).toBe(true);
  });

  it("CP-F-CAT-02-03b · valor límite sobre el camino anónimo: lo reservado agota el producto", async () => {
    // Complementa los nodos 11 y 12: Math.max(0, ...) evita existencias negativas
    // y el producto se marca agotado aunque en la base de datos figure disponible.
    productos.findById.mockResolvedValue(
      producto({ id: "prd_001", stockQuantity: 3, inStock: true })
    );
    carritos.getReservedQuantities.mockResolvedValue({ prd_001: 9 });

    const ficha = await caso.execute("prd_001");

    expect(ficha.stockQuantity).toBe(0);
    expect(ficha.inStock).toBe(false);
  });

  it("CP-F-CAT-02-03c · valor límite: sin reservas registradas el stock físico se entrega íntegro", async () => {
    // Complementa el nodo 10: reservedQuantities[id] ausente ⇒ se toma 0.
    productos.findById.mockResolvedValue(producto({ id: "prd_001", stockQuantity: 7 }));
    carritos.getReservedQuantities.mockResolvedValue({});   // el mapa no trae la clave

    const ficha = await caso.execute("prd_001");

    expect(ficha.stockQuantity).toBe(7);
    expect(ficha.inStock).toBe(true);
  });
});
