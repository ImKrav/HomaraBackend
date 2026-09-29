// F-CHK-02 · Ver y modificar el carrito
// Unidad: GetCartUseCase.execute()  (GET /api/v1/cart)

import { test, expect, vi } from "./harness.js";
import { conRelojFijo } from "./helpers.js";
import { GetCartUseCase } from "../src/application/use-cases/cart.use-cases.js";
import { PrismaCartRepository } from "../src/infrastructure/database/repositories/prisma-cart.repository.js";

const ID_USUARIO = "usr_001";
const ID_A = "clx0000000000000000000001";
const ID_B = "clx0000000000000000000002";

const filaProducto = (o: Record<string, any> = {}) => ({
  id: ID_A,
  name: "Piso Ceramico Beige 60x60",
  description: "Piso ceramico para interiores",
  price: 38900,
  originalPrice: null,
  image: "piso.png",
  rating: 4.5,
  reviewCount: 10,
  inStock: true,
  stockQuantity: 100,
  unit: "m²",
  categoryId: "cat_001",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  tags: [{ name: "nuevo" }],
  category: { name: "Pisos y Ceramicas", slug: "pisos-ceramicas" },
  ...o,
});

const filaLinea = (o: Record<string, any> = {}) => {
  const p = o.product ?? filaProducto();
  return {
    id: "ci_001",
    quantity: 1,
    cartId: "cart_001",
    productId: p.id,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...o,
    product: p,
  };
};

const filaCarrito = (items: any[] = [], o: Record<string, any> = {}) => ({
  id: "cart_001",
  userId: ID_USUARIO,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  items,
  ...o,
});

function montar() {
  const db = {
    cart: { findUnique: vi.fn(), create: vi.fn() },
    cartItem: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  const caso = new GetCartUseCase(new PrismaCartRepository(db as any));
  return { db, caso };
}

test("CP-F-CHK-02-01", "Crea un carrito vacío cuando el usuario no tenía uno previo", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(null);
  db.cart.create.mockResolvedValue(filaCarrito([], { id: "cart_nuevo" }));

  // Act
  const salida = await caso.execute(ID_USUARIO);

  // Assert
  expect(db.cart.create.mock.calls.length).toBe(1);
  expect(db.cart.create.mock.calls[0][0].data).toStrictEqual({ userId: ID_USUARIO });
  expect(salida.id).toBe("cart_nuevo");
  expect(db.cartItem.findMany).not.toHaveBeenCalled();
  expect(salida.items).toStrictEqual([]);
  expect(salida.itemCount).toBe(0);
  expect(salida.subtotal).toBe(0);
  expect(salida.shipping).toBe(25000);
  expect(salida.total).toBe(25000);
});

test("CP-F-CHK-02-02", "Retorna estructura de carrito existente sin productos", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(filaCarrito([]));

  // Act
  const salida = await caso.execute(ID_USUARIO);

  // Assert
  expect(db.cart.create).not.toHaveBeenCalled();
  expect(db.cart.findUnique.mock.calls[0][0].where).toStrictEqual({ userId: ID_USUARIO });
  expect(db.cartItem.findMany).not.toHaveBeenCalled();
  expect(salida as any).toMatchObject({ subtotal: 0, shipping: 25000, total: 25000, itemCount: 0 });
});

test("CP-F-CHK-02-03", "Calcula backorder y aplica envío gratuito cuando subtotal supera 500000", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(
    filaCarrito([filaLinea({ quantity: 3, product: filaProducto({ price: 200000, stockQuantity: 10 }) })]),
  );
  db.cartItem.findMany.mockResolvedValue([{ productId: ID_A, quantity: 8 }]);

  // Act
  const salida = await conRelojFijo("2026-08-25T12:00:00.000Z", () => caso.execute(ID_USUARIO));

  // Assert
  const filtro = db.cartItem.findMany.mock.calls[0][0].where;
  expect(filtro.productId).toStrictEqual({ in: [ID_A] });
  expect(filtro.cartId).toStrictEqual({ not: "cart_001" });
  expect(filtro.updatedAt.gte).toStrictEqual(new Date("2026-08-25T11:45:00.000Z"));
  expect(salida.items[0].availableStock).toBe(2);
  expect(salida.items[0].isBackorder).toBe(true);
  expect(salida.items[0].backorderQuantity).toBe(1);
  expect(salida.subtotal).toBe(600000);
  expect(salida.shipping).toBe(0);
  expect(salida.total).toBe(600000);
  expect(salida.itemCount).toBe(1);
});

test("CP-F-CHK-02-04", "Muestra disponibilidad total sin backorder con stock suficiente", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(
    filaCarrito([filaLinea({ quantity: 1, product: filaProducto({ price: 500001, stockQuantity: 10 }) })]),
  );
  db.cartItem.findMany.mockResolvedValue([]);

  // Act
  const salida = await caso.execute(ID_USUARIO);

  // Assert
  expect(salida.items[0].availableStock).toBe(10);
  expect(salida.items[0].isBackorder).toBe(false);
  expect(salida.items[0].backorderQuantity).toBe(0);
  expect(salida.subtotal).toBe(500001);
  expect(salida.shipping).toBe(0);
  expect(salida.total).toBe(500001);
  expect(db.cartItem.findMany.mock.calls.length).toBe(1);
});

test("CP-F-CHK-02-05", "Itera múltiples líneas combinando disponibles y pedidos pendientes", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(
    filaCarrito([
      filaLinea({ id: "ci_a", quantity: 5, product: filaProducto({ price: 100000, stockQuantity: 4 }) }),
      filaLinea({ id: "ci_b", quantity: 2, product: filaProducto({ id: ID_B, price: 150000, stockQuantity: 50 }) }),
    ]),
  );
  db.cartItem.findMany.mockResolvedValue([{ productId: ID_A, quantity: 2 }]);

  // Act
  const salida = await caso.execute(ID_USUARIO);

  // Assert
  expect(db.cartItem.findMany.mock.calls[0][0].where.productId).toStrictEqual({ in: [ID_A, ID_B] });
  expect(salida.items[0].availableStock).toBe(2);
  expect(salida.items[0].isBackorder).toBe(true);
  expect(salida.items[0].backorderQuantity).toBe(3);
  expect(salida.items[1].availableStock).toBe(50);
  expect(salida.items[1].isBackorder).toBe(false);
  expect(salida.items[1].backorderQuantity).toBe(0);
  expect(salida.subtotal).toBe(800000);
  expect(salida.shipping).toBe(0);
  expect(salida.total).toBe(800000);
  expect(salida.itemCount).toBe(2);
});

// Defecto abierto #10 (ver la tabla en tests/README.md): se espera que falle.
test.fails("CP-F-CHK-02-06", "Cobra tarifa de envío con subtotal inferior al umbral y evalúa umbral de 500000", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(filaCarrito([]));

  // Act — 2º escenario: carrito con subtotal de 500.000 exactos.
  const vacio = await caso.execute(ID_USUARIO);

  db.cart.findUnique.mockResolvedValue(
    filaCarrito([filaLinea({ quantity: 2, product: filaProducto({ price: 250000, stockQuantity: 10 }) })]),
  );
  db.cartItem.findMany.mockResolvedValue([]);
  const limite = await caso.execute(ID_USUARIO);

  // Assert
  expect(vacio.subtotal).toBe(0);
  expect(vacio.shipping).toBe(25000);
  expect(vacio.total).toBe(25000);
  expect(limite.subtotal).toBe(500000);
  // DEFECTO: con 500.000 exactos el envío no es gratuito según HU19 (RF16 vs HU19)
  expect(limite.shipping).toBe(0);
  expect(limite.total).toBe(500000);
});
