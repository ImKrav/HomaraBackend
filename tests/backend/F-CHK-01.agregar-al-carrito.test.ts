// ============================================================================
// F-CHK-01 · Agregar un producto al carrito — Backend
// Grafo:   19_F-CHK-01_BACKEND_Agregar_un_producto_al_carrito.drawio
// Unidad:  AddCartItemUseCase.execute()  ·  POST /api/v1/cart/items
//          (con PrismaCartRepository.findByUserId/addItem sobre prisma simulado)
// Métrica: N=19  A=22  P=4  →  V(G) = 22 − 19 + 2 = 5
// Cobertura de ruta básica: 5 caminos independientes → 5 casos de prueba
// Trazabilidad: RF13 · HU14 · HU15 · ESC13 · BE-CHK-04
// ============================================================================
import { describe, it, expect, beforeEach, vi } from "vitest";
import { contextoExpress, errorDeNext } from "../_ayudas.js";

// ---------------------------------------------------------------------------
// El repositorio de carritos habla con prisma directamente: se sustituye el
// módulo para poder forzar los nodos 10 (¿ya tenía carrito?) y 14 (¿la línea
// del producto ya existía?), que viven dentro del adaptador de infraestructura.
// ---------------------------------------------------------------------------
const carritoBuscar = vi.fn();
const carritoCrear = vi.fn();
const lineaBuscar = vi.fn();
const lineaActualizar = vi.fn();
const lineaCrear = vi.fn();
const lineaBuscarVarias = vi.fn();

vi.mock("../../src/infrastructure/database/prisma-client.js", () => ({
  prisma: {
    cart: {
      findUnique: (...a: any[]) => carritoBuscar(...a),
      create: (...a: any[]) => carritoCrear(...a),
    },
    cartItem: {
      findUnique: (...a: any[]) => lineaBuscar(...a),
      update: (...a: any[]) => lineaActualizar(...a),
      create: (...a: any[]) => lineaCrear(...a),
      findMany: (...a: any[]) => lineaBuscarVarias(...a),
    },
  },
}));

// El middleware requireAuth (nodos 2 y 3) instancia PrismaUserRepository al cargar.
const usuarioBuscarPorId = vi.fn();
vi.mock("../../src/infrastructure/database/repositories/prisma-user.repository.js", () => ({
  PrismaUserRepository: class {
    findById = (...a: any[]) => usuarioBuscarPorId(...a);
  },
}));

const { AddCartItemUseCase } = await import("../../src/application/use-cases/cart.use-cases.js");
const { PrismaCartRepository } = await import(
  "../../src/infrastructure/database/repositories/prisma-cart.repository.js"
);
const { addItemSchema } = await import("../../src/infrastructure/http/validators/cart.validator.js");
const { requireAuth } = await import("../../src/infrastructure/http/middlewares/auth.js");
const { AppError } = await import("../../src/shared/errors/AppError.js");

// ---------------------------------------------------------------------------
// Datos de referencia del módulo CARRITO Y PAGO
// ---------------------------------------------------------------------------
/** Identificador con formato cuid, el único que acepta addItemSchema. */
const ID_PRODUCTO = "clx0000000000000000000001";
const ID_USUARIO = "usr_001";

/** Fila de producto tal como la devuelve prisma dentro de un include. */
function filaProducto(over: Record<string, any> = {}) {
  return {
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
    ...over,
  };
}

/** Fila de carrito tal como la devuelve prisma.cart.findUnique/create. */
function filaCarrito(over: Record<string, any> = {}) {
  return {
    id: "cart_001",
    userId: ID_USUARIO,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    items: [],
    ...over,
  };
}

/** Fila de línea del carrito tal como la devuelve prisma.cartItem.*. */
function filaLinea(over: Record<string, any> = {}) {
  return {
    id: "ci_001",
    quantity: 2,
    cartId: "cart_001",
    productId: ID_PRODUCTO,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...over,
  };
}

describe("F-CHK-01 · Agregar un producto al carrito", () => {
  let repo: InstanceType<typeof PrismaCartRepository>;
  let caso: InstanceType<typeof AddCartItemUseCase>;

  beforeEach(() => {
    [carritoBuscar, carritoCrear, lineaBuscar, lineaActualizar, lineaCrear,
     lineaBuscarVarias, usuarioBuscarPorId].forEach((m) => m.mockReset());
    repo = new PrismaCartRepository();
    caso = new AddCartItemUseCase(repo);
  });

  it("CP-F-CHK-01-01 · camino 1,2,3,4,7,19 · Paso 3 = NO → sin sesión iniciada no se toca el carrito", async () => {
    // Nodo 3: req.user nunca queda definido porque no llega la cabecera Authorization.
    const { req, res, next } = contextoExpress();

    await requireAuth(req, res, next);

    // Nodo 4: el flujo sale por el 401 y el nodo 7 lo entrega al usuario.
    const error = errorDeNext(next);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
    expect(req.user).toBeUndefined();
    // Salida esperada: el caso de uso ni siquiera se invoca.
    expect(carritoBuscar).not.toHaveBeenCalled();
    expect(lineaCrear).not.toHaveBeenCalled();
  });

  it("CP-F-CHK-01-02 · camino 1,2,3,5,6,8,11,19 · Paso 3 = SI, Paso 6 = NO → cantidad fuera del rango 1..9999", async () => {
    // Nodo 5: validateZod(addItemSchema) corre antes del caso de uso.
    // Rama NO del nodo 6 — cantidad por debajo del mínimo.
    const cero = addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 0 });
    expect(cero.success).toBe(false);
    if (!cero.success) expect(cero.error.issues[0].message).toContain("al menos 1");

    // Rama NO del nodo 6 — cantidad por encima del máximo.
    expect(addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 10000 }).success).toBe(false);

    // Rama NO del nodo 6 — cantidad no entera.
    const decimal = addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 2.5 });
    expect(decimal.success).toBe(false);
    if (!decimal.success) expect(decimal.error.issues[0].message).toContain("entero");

    // Rama NO del nodo 6 — identificador que no es un cuid.
    const idMalo = addItemSchema.safeParse({ productId: "123", quantity: 1 });
    expect(idMalo.success).toBe(false);
    if (!idMalo.success) expect(idMalo.error.issues[0].message).toBe("ID de producto inválido");

    // Valores límite que SÍ deben pasar el nodo 6 (RF13: rechazar <1 y >9999).
    expect(addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 1 }).success).toBe(true);
    expect(addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 9999 }).success).toBe(true);
    // Sin cantidad, el esquema aplica el valor por omisión 1.
    expect(addItemSchema.parse({ productId: ID_PRODUCTO }).quantity).toBe(1);

    // Salida esperada (nodos 8 y 11): la base de datos no se consulta.
    expect(carritoBuscar).not.toHaveBeenCalled();
  });

  it("CP-F-CHK-01-03 · camino 1,2,3,5,6,9,10,12,13,14,15,17,19 · Paso 10 = NO, Paso 14 = SI → se crea el carrito y se acumula la cantidad", async () => {
    // Nodo 10 = NO: el usuario no tenía carrito, así que el nodo 12 lo crea vacío.
    carritoBuscar.mockResolvedValue(null);
    carritoCrear.mockResolvedValue(filaCarrito({ id: "cart_nuevo" }));
    // Nodo 14 = SI: se fuerza que la línea ya exista (combinación que el grafo
    // exige para la independencia del camino aunque en producción no se dé).
    lineaBuscar.mockResolvedValue(filaLinea({ cartId: "cart_nuevo", quantity: 2 }));
    lineaActualizar.mockResolvedValue(
      filaLinea({ cartId: "cart_nuevo", quantity: 5, product: filaProducto() })
    );

    const item = await caso.execute(ID_USUARIO, ID_PRODUCTO, 3);

    // Nodo 12: HU14 — creación implícita del carrito al agregar el primer producto.
    expect(carritoCrear).toHaveBeenCalledTimes(1);
    expect(carritoCrear.mock.calls[0][0].data).toEqual({ userId: ID_USUARIO });
    // Nodo 15: HU15 — la cantidad nueva se suma a la que ya había (2 + 3 = 5).
    expect(lineaCrear).not.toHaveBeenCalled();
    expect(lineaActualizar).toHaveBeenCalledTimes(1);
    expect(lineaActualizar.mock.calls[0][0].data).toEqual({ quantity: 5 });
    // Nodo 17: se confirma la línea resultante.
    expect(item.quantity).toBe(5);
    expect(item.productId).toBe(ID_PRODUCTO);
  });

  it("CP-F-CHK-01-04 · camino 1,2,3,5,6,9,10,13,14,15,17,19 · Paso 10 = SI, Paso 14 = SI → el producto ya estaba y se acumula", async () => {
    // Nodo 10 = SI: el carrito existe, el nodo 12 se salta.
    carritoBuscar.mockResolvedValue(filaCarrito());
    // Nodo 14 = SI.
    lineaBuscar.mockResolvedValue(filaLinea({ quantity: 9997 }));
    lineaActualizar.mockResolvedValue(filaLinea({ quantity: 9999, product: filaProducto() }));

    const item = await caso.execute(ID_USUARIO, ID_PRODUCTO, 2);

    expect(carritoCrear).not.toHaveBeenCalled();
    // Nodo 13: la búsqueda se hace por la clave compuesta cartId+productId.
    expect(lineaBuscar.mock.calls[0][0].where).toEqual({
      cartId_productId: { cartId: "cart_001", productId: ID_PRODUCTO },
    });
    // Nodo 15: acumulación en el valor límite superior del rango (9997 + 2 = 9999).
    expect(lineaActualizar.mock.calls[0][0].data).toEqual({ quantity: 9999 });
    expect(item.quantity).toBe(9999);

    // ---------------------------------------------------------------------
    // Comportamiento esperado por RF13: "El sistema debe rechazar cantidades
    // menores a uno o superiores a 9999." El tope debe seguir valiendo después
    // de la acumulación del nodo 15, no sólo sobre la cantidad enviada.
    // ---------------------------------------------------------------------
    lineaBuscar.mockResolvedValue(filaLinea({ quantity: 9999 }));
    lineaActualizar.mockResolvedValue(filaLinea({ quantity: 19998, product: filaProducto() }));

    // DEFECTO: la acumulación del nodo 15 supera el máximo de 9999 sin rechazo.
    // addItemSchema sólo valida la cantidad ENVIADA; PrismaCartRepository.addItem
    // ejecuta `existing.quantity + quantity` sin volver a comprobar el tope, de
    // modo que 9999 en el carrito + 9999 enviadas quedan como 19998 (RF13 · HU15).
    const excedido = await caso.execute(ID_USUARIO, ID_PRODUCTO, 9999);
    expect(excedido.quantity).toBeLessThanOrEqual(9999);
  });

  it("CP-F-CHK-01-05 · camino 1,2,3,5,6,9,10,13,14,16,18,19 · Paso 10 = SI, Paso 14 = NO → se crea la línea del producto", async () => {
    // Nodo 10 = SI.
    carritoBuscar.mockResolvedValue(filaCarrito());
    // Nodo 14 = NO: el producto todavía no estaba en el carrito.
    lineaBuscar.mockResolvedValue(null);
    lineaCrear.mockResolvedValue(filaLinea({ id: "ci_nuevo", quantity: 1, product: filaProducto() }));

    const item = await caso.execute(ID_USUARIO, ID_PRODUCTO, 1);

    // Nodo 16: se agrega la línea nueva con la cantidad solicitada.
    expect(lineaActualizar).not.toHaveBeenCalled();
    expect(lineaCrear).toHaveBeenCalledTimes(1);
    expect(lineaCrear.mock.calls[0][0].data).toEqual({
      cartId: "cart_001",
      productId: ID_PRODUCTO,
      quantity: 1,
    });
    // Nodo 18: se confirma la línea creada.
    expect(item.id).toBe("ci_nuevo");
    expect(item.quantity).toBe(1);
    expect(item.product?.id).toBe(ID_PRODUCTO);
  });
});
