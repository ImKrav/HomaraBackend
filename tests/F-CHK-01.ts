// F-CHK-01 · Agregar un producto al carrito
// Unidad: AddCartItemUseCase.execute()  (POST /api/v1/cart/items)

import { test, is, eq, ok, has } from "./harness.js";
import { contextoExpress, errorDeNext, spy, arg, calledWith, neverCalled } from "./helpers.js";
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
    cart: { findUnique: spy(), create: spy() },
    cartItem: { findUnique: spy(), update: spy(), create: spy(), findMany: spy() },
  };
  const repo = new PrismaCartRepository(db as any);
  const caso = new AddCartItemUseCase(repo);
  return { db, caso };
}

test("CP-F-CHK-01-01", "Retorna 401 sin sesión autenticada antes de modificar el carrito", async () => {
  const { db } = montar();
  const { req, res, next } = contextoExpress();

  await requireAuth(req, res, next);

  const error = errorDeNext(next);
  ok(error instanceof AppError);
  is(error.statusCode, 401);
  is(req.user, undefined);
  ok(neverCalled(db.cart.findUnique));
  ok(neverCalled(db.cartItem.create));
});

test("CP-F-CHK-01-02", "Valida esquema para cantidades (1..9999, enteros) y formato cuid de ID", () => {
  const { db } = montar();

  const cero = addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 0 });
  is(cero.success, false);
  if (!cero.success) has(cero.error.issues[0].message, "al menos 1");

  is(addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 10000 }).success, false);

  const decimal = addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 2.5 });
  is(decimal.success, false);
  if (!decimal.success) has(decimal.error.issues[0].message, "entero");

  const idMalo = addItemSchema.safeParse({ productId: "123", quantity: 1 });
  is(idMalo.success, false);
  if (!idMalo.success) is(idMalo.error.issues[0].message, "ID de producto inválido");

  is(addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 1 }).success, true);
  is(addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 9999 }).success, true);
  is(addItemSchema.parse({ productId: ID_PRODUCTO }).quantity, 1);
  ok(neverCalled(db.cart.findUnique));
});

test("CP-F-CHK-01-03", "Crea carrito si no existía y acumula cantidad si la línea ya existía", async () => {
  const { db, caso } = montar();
  db.cart.findUnique.resolves(null);
  db.cart.create.resolves(filaCarrito({ id: "cart_nuevo" }));
  db.cartItem.findUnique.resolves(filaLinea({ cartId: "cart_nuevo", quantity: 2 }));
  db.cartItem.update.resolves(filaLinea({ cartId: "cart_nuevo", quantity: 5, product: filaProducto() }));

  const item = await caso.execute(ID_USUARIO, ID_PRODUCTO, 3);

  is(db.cart.create.calls.length, 1);
  eq(arg(db.cart.create).data, { userId: ID_USUARIO });
  ok(neverCalled(db.cartItem.create));
  is(db.cartItem.update.calls.length, 1);
  eq(arg(db.cartItem.update).data, { quantity: 5 });
  is(item.quantity, 5);
  is(item.productId, ID_PRODUCTO);
});

test("CP-F-CHK-01-04", "Acumula cantidades de producto existente en el carrito respetando tope", async () => {
  const { db, caso } = montar();
  db.cart.findUnique.resolves(filaCarrito());
  db.cartItem.findUnique.resolves(filaLinea({ quantity: 9997 }));
  db.cartItem.update.resolves(filaLinea({ quantity: 9999, product: filaProducto() }));

  const item = await caso.execute(ID_USUARIO, ID_PRODUCTO, 2);

  ok(neverCalled(db.cart.create));
  eq(arg(db.cartItem.findUnique).where, {
    cartId_productId: { cartId: "cart_001", productId: ID_PRODUCTO },
  });
  eq(arg(db.cartItem.update).data, { quantity: 9999 });
  is(item.quantity, 9999);

  db.cartItem.findUnique.resolves(filaLinea({ quantity: 9999 }));
  db.cartItem.update.resolves(filaLinea({ quantity: 19998, product: filaProducto() }));

  // DEFECTO: la acumulación supera el máximo de 9999 sin validación adicional
  const excedido = await caso.execute(ID_USUARIO, ID_PRODUCTO, 9999);
  ok(excedido.quantity <= 9999, `quantity=${excedido.quantity} supera el tope de 9999`);
});

test("CP-F-CHK-01-05", "Agrega una nueva línea de producto cuando no estaba en el carrito", async () => {
  const { db, caso } = montar();
  db.cart.findUnique.resolves(filaCarrito());
  db.cartItem.findUnique.resolves(null);
  db.cartItem.create.resolves(filaLinea({ id: "ci_nuevo", quantity: 1, product: filaProducto() }));

  const item = await caso.execute(ID_USUARIO, ID_PRODUCTO, 1);

  ok(neverCalled(db.cartItem.update));
  is(db.cartItem.create.calls.length, 1);
  eq(arg(db.cartItem.create).data, {
    cartId: "cart_001",
    productId: ID_PRODUCTO,
    quantity: 1,
  });
  is(item.id, "ci_nuevo");
  is(item.quantity, 1);
  is(item.product?.id, ID_PRODUCTO);
});
