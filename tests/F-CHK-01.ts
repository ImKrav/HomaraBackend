// F-CHK-01 · Agregar un producto al carrito
// Unidad: AddCartItemUseCase.execute()  (POST /api/v1/cart/items)

import { test, expect, vi } from "./harness.js";
import { contextoExpress, errorDeNext } from "./helpers.js";
import { AddCartItemUseCase } from "../src/application/use-cases/cart.use-cases.js";
import { PrismaCartRepository } from "../src/infrastructure/database/repositories/prisma-cart.repository.js";
import { addItemSchema } from "../src/infrastructure/http/validators/cart.validator.js";
import { requireAuth } from "../src/infrastructure/http/middlewares/auth.js";
import { AppError } from "../src/shared/errors/AppError.js";

const ID_PRODUCTO = "clx0000000000000000000001";
const ID_USUARIO = "usr_001";

const filaProducto = (o: Record<string, any> = {}) => ({
  id: ID_PRODUCTO,
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

const filaCarrito = (o: Record<string, any> = {}) => ({
  id: "cart_001",
  userId: ID_USUARIO,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  items: [],
  ...o,
});

const filaLinea = (o: Record<string, any> = {}) => ({
  id: "ci_001",
  quantity: 2,
  cartId: "cart_001",
  productId: ID_PRODUCTO,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...o,
});

/** Cliente Prisma falso + repo real + caso de uso. */
function montar() {
  const db = {
    cart: { findUnique: vi.fn(), create: vi.fn() },
    cartItem: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  };
  const repo = new PrismaCartRepository(db as any);
  const caso = new AddCartItemUseCase(repo);
  return { db, caso };
}

test("CP-F-CHK-01-01", "Retorna 401 sin sesión autenticada antes de modificar el carrito", async () => {
  // Arrange
  const { db } = montar();
  const { req, res, next } = contextoExpress();

  // Act
  await requireAuth(req, res, next);

  // Assert
  const error = errorDeNext(next);
  expect(error).toBeInstanceOf(AppError);
  expect(error.statusCode).toBe(401);
  expect(req.user).toBe(undefined);
  expect(db.cart.findUnique).not.toHaveBeenCalled();
  expect(db.cartItem.create).not.toHaveBeenCalled();
});

test("CP-F-CHK-01-02", "Valida esquema para cantidades (1..9999, enteros) y formato cuid de ID", () => {
  // Arrange
  const { db } = montar();

  // Act
  const cero = addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 0 });
  const sobreTope = addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 10000 });
  const decimal = addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 2.5 });
  const idMalo = addItemSchema.safeParse({ productId: "123", quantity: 1 });
  const minimo = addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 1 });
  const maximo = addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 9999 });
  const cantidadPorDefecto = addItemSchema.parse({ productId: ID_PRODUCTO }).quantity;

  // Assert
  expect(cero.success).toBe(false);
  if (!cero.success) expect(cero.error.issues[0].message).toContain("al menos 1");
  expect(sobreTope.success).toBe(false);
  expect(decimal.success).toBe(false);
  if (!decimal.success) expect(decimal.error.issues[0].message).toContain("entero");
  expect(idMalo.success).toBe(false);
  if (!idMalo.success) expect(idMalo.error.issues[0].message).toBe("ID de producto inválido");
  expect(minimo.success).toBe(true);
  expect(maximo.success).toBe(true);
  expect(cantidadPorDefecto).toBe(1);
  expect(db.cart.findUnique).not.toHaveBeenCalled();
});

test("CP-F-CHK-01-03", "Crea carrito si no existía y acumula cantidad si la línea ya existía", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(null);
  db.cart.create.mockResolvedValue(filaCarrito({ id: "cart_nuevo" }));
  db.cartItem.findUnique.mockResolvedValue(filaLinea({ cartId: "cart_nuevo", quantity: 2 }));
  db.cartItem.update.mockResolvedValue(filaLinea({ cartId: "cart_nuevo", quantity: 5, product: filaProducto() }));

  // Act
  const item = await caso.execute(ID_USUARIO, ID_PRODUCTO, 3);

  // Assert
  expect(db.cart.create.mock.calls.length).toBe(1);
  expect(db.cart.create.mock.calls[0][0].data).toStrictEqual({ userId: ID_USUARIO });
  expect(db.cartItem.create).not.toHaveBeenCalled();
  expect(db.cartItem.update.mock.calls.length).toBe(1);
  expect(db.cartItem.update.mock.calls[0][0].data).toStrictEqual({ quantity: 5 });
  expect(item.quantity).toBe(5);
  expect(item.productId).toBe(ID_PRODUCTO);
});

// Defecto abierto #9 (ver la tabla en tests/README.md): se espera que falle.
test.fails("CP-F-CHK-01-04", "Acumula cantidades de producto existente en el carrito respetando tope", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(filaCarrito());
  db.cartItem.findUnique.mockResolvedValue(filaLinea({ quantity: 9997 }));
  db.cartItem.update.mockResolvedValue(filaLinea({ quantity: 9999, product: filaProducto() }));

  // Act — 2º escenario: la línea ya está en el tope y se intenta sumar 9999 más.
  const item = await caso.execute(ID_USUARIO, ID_PRODUCTO, 2);
  const busqueda = db.cartItem.findUnique.mock.calls[0][0];
  const actualizacion = db.cartItem.update.mock.calls[0][0];

  db.cartItem.findUnique.mockResolvedValue(filaLinea({ quantity: 9999 }));
  db.cartItem.update.mockResolvedValue(filaLinea({ quantity: 19998, product: filaProducto() }));
  const excedido = await caso.execute(ID_USUARIO, ID_PRODUCTO, 9999);

  // Assert
  expect(db.cart.create).not.toHaveBeenCalled();
  expect(busqueda.where).toStrictEqual({
    cartId_productId: { cartId: "cart_001", productId: ID_PRODUCTO },
  });
  expect(actualizacion.data).toStrictEqual({ quantity: 9999 });
  expect(item.quantity).toBe(9999);
  // DEFECTO: la acumulación supera el máximo de 9999 sin validación adicional
  expect(excedido.quantity, `quantity=${excedido.quantity} supera el tope de 9999`).toBeLessThanOrEqual(9999);
});

test("CP-F-CHK-01-05", "Agrega una nueva línea de producto cuando no estaba en el carrito", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(filaCarrito());
  db.cartItem.findUnique.mockResolvedValue(null);
  db.cartItem.create.mockResolvedValue(filaLinea({ id: "ci_nuevo", quantity: 1, product: filaProducto() }));

  // Act
  const item = await caso.execute(ID_USUARIO, ID_PRODUCTO, 1);

  // Assert
  expect(db.cartItem.update).not.toHaveBeenCalled();
  expect(db.cartItem.create.mock.calls.length).toBe(1);
  expect(db.cartItem.create.mock.calls[0][0].data).toStrictEqual({
    cartId: "cart_001",
    productId: ID_PRODUCTO,
    quantity: 1,
  });
  expect(item.id).toBe("ci_nuevo");
  expect(item.quantity).toBe(1);
  expect(item.product?.id).toBe(ID_PRODUCTO);
});


test("CP-F-CHK-01-06", "Enviar materiales carrito (RF24): Permite iterar la adici�n para trasladar una lista de materiales al carrito", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(filaCarrito());
  db.cartItem.findUnique.mockResolvedValue(null);
  db.cartItem.create.mockImplementation((args: any) => filaLinea({ id: "ci_mock", quantity: args.data.quantity, product: filaProducto() }));

  // Act - Simulamos un loop del frontend agregando varios materiales (RF24)
  const materiales = [
    { productId: "prd_1", quantity: 5 },
    { productId: "prd_2", quantity: 2 },
  ];
  
  for (const mat of materiales) {
    await caso.execute(ID_USUARIO, mat.productId, mat.quantity);
  }

  // Assert
  expect(db.cartItem.create.mock.calls.length).toBe(2);
  expect(db.cartItem.create.mock.calls[0][0].data.productId).toBe("prd_1");
  expect(db.cartItem.create.mock.calls[1][0].data.productId).toBe("prd_2");
});

