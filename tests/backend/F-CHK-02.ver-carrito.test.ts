// ============================================================================
// F-CHK-02 · Ver y modificar el carrito — Backend
// Grafo:   21_F-CHK-02_BACKEND_Ver_y_modificar_el_carrito.drawio
// Unidad:  GetCartUseCase.execute()  ·  GET /api/v1/cart
//          (sobre PrismaCartRepository real con prisma simulado, para cubrir
//           el nodo 3 —creación implícita— y el nodo 8 —reserva de 15 minutos—)
// Métrica: N=23  A=27  P=5  →  V(G) = 27 − 23 + 2 = 6
// Cobertura de ruta básica: 6 caminos independientes → 6 casos de prueba
// Trazabilidad: RF16 · HU19 · ESC16 · RF25 · HU35 · ESC25 · RF26 · ESC26 · BE-CHK-01
// ============================================================================
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Doble de prisma: permite forzar el nodo 3 (¿ya tenía carrito?) y observar la
// consulta de reservas del nodo 8 (ventana de 15 minutos, otros carritos).
// ---------------------------------------------------------------------------
const carritoBuscar = vi.fn();
const carritoCrear = vi.fn();
const lineaBuscarVarias = vi.fn();

vi.mock("../../src/infrastructure/database/prisma-client.js", () => ({
  prisma: {
    cart: {
      findUnique: (...a: any[]) => carritoBuscar(...a),
      create: (...a: any[]) => carritoCrear(...a),
    },
    cartItem: {
      findMany: (...a: any[]) => lineaBuscarVarias(...a),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const { GetCartUseCase } = await import("../../src/application/use-cases/cart.use-cases.js");
const { PrismaCartRepository } = await import(
  "../../src/infrastructure/database/repositories/prisma-cart.repository.js"
);

const ID_USUARIO = "usr_001";
const ID_A = "clx0000000000000000000001";
const ID_B = "clx0000000000000000000002";
const QUINCE_MINUTOS_MS = 15 * 60 * 1000;

/** Fila de producto tal como la devuelve prisma dentro del include del carrito. */
function filaProducto(over: Record<string, any> = {}) {
  return {
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
    ...over,
  };
}

/** Fila de línea del carrito con su producto ya incluido. */
function filaLinea(over: Record<string, any> = {}) {
  const producto = over.product ?? filaProducto();
  return {
    id: "ci_001",
    quantity: 1,
    cartId: "cart_001",
    productId: producto.id,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...over,
    product: producto,
  };
}

/** Fila de carrito tal como la devuelve prisma.cart.findUnique/create. */
function filaCarrito(items: any[] = [], over: Record<string, any> = {}) {
  return {
    id: "cart_001",
    userId: ID_USUARIO,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    items,
    ...over,
  };
}

describe("F-CHK-02 · Ver y modificar el carrito", () => {
  let caso: InstanceType<typeof GetCartUseCase>;

  beforeEach(() => {
    [carritoBuscar, carritoCrear, lineaBuscarVarias].forEach((m) => m.mockReset());
    lineaBuscarVarias.mockResolvedValue([]);
    caso = new GetCartUseCase(new PrismaCartRepository());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("CP-F-CHK-02-01 · camino 1,2,3,4,5,6,7,15,16,17,19,21,23 · Paso 3 = NO, Paso 6 = NO → se crea un carrito vacío y no se consultan reservas", async () => {
    // Nodo 3 = NO: el cliente abre el carrito por primera vez.
    carritoBuscar.mockResolvedValue(null);
    carritoCrear.mockResolvedValue(filaCarrito([], { id: "cart_nuevo" }));

    const salida = await caso.execute(ID_USUARIO);

    // Nodo 4: HU14 — el carrito vacío se crea y queda asociado al usuario.
    expect(carritoCrear).toHaveBeenCalledTimes(1);
    expect(carritoCrear.mock.calls[0][0].data).toEqual({ userId: ID_USUARIO });
    expect(salida.id).toBe("cart_nuevo");
    // Nodo 7: sin items no se consulta la base de datos por reservas ajenas.
    expect(lineaBuscarVarias).not.toHaveBeenCalled();
    expect(salida.items).toEqual([]);
    expect(salida.itemCount).toBe(0);
    // HALLAZGO (grafo, no código): este camino declara "Paso 16 = SI", pero con
    // el carrito vacío el subtotal es 0 y el Paso 16 sólo puede ser NO. Se
    // documenta el comportamiento real: envío de 25.000 sobre un subtotal de 0.
    expect(salida.subtotal).toBe(0);
    expect(salida.shipping).toBe(25000);
    expect(salida.total).toBe(25000);
  });

  it("CP-F-CHK-02-02 · camino 1,2,3,5,6,7,15,16,17,19,21,23 · Paso 3 = SI, Paso 6 = NO → carrito existente sin productos", async () => {
    // Nodo 3 = SI: el carrito ya existía, el nodo 4 se salta.
    carritoBuscar.mockResolvedValue(filaCarrito([]));

    const salida = await caso.execute(ID_USUARIO);

    expect(carritoCrear).not.toHaveBeenCalled();
    expect(carritoBuscar.mock.calls[0][0].where).toEqual({ userId: ID_USUARIO });
    // Nodo 7: la rama sin items evita por completo getReservedQuantities.
    expect(lineaBuscarVarias).not.toHaveBeenCalled();
    // Misma observación que en CP-01: el Paso 16 sólo puede resolverse en NO.
    expect(salida).toMatchObject({ subtotal: 0, shipping: 25000, total: 25000, itemCount: 0 });
  });

  it("CP-F-CHK-02-03 · camino 1,2,3,5,6,8,9,10,11,12,14,15,16,17,19,21,23 · Paso 11 = SI, Paso 14 = NO, Paso 16 = SI → pedido pendiente con envío gratis", async () => {
    // Reloj fijo para comprobar la ventana de reserva del nodo 8 con exactitud.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-25T12:00:00.000Z"));

    // Nodo 3 = SI y nodo 6 = SI: un único producto en el carrito.
    carritoBuscar.mockResolvedValue(
      filaCarrito([filaLinea({ quantity: 3, product: filaProducto({ price: 200000, stockQuantity: 10 }) })])
    );
    // Nodo 8: RF25 — otro cliente tiene 8 unidades reservadas.
    lineaBuscarVarias.mockResolvedValue([{ productId: ID_A, quantity: 8 }]);

    const salida = await caso.execute(ID_USUARIO);

    // Nodo 8: la consulta excluye el carrito propio y sólo mira los últimos 15 minutos.
    const filtro = lineaBuscarVarias.mock.calls[0][0].where;
    expect(filtro.productId).toEqual({ in: [ID_A] });
    expect(filtro.cartId).toEqual({ not: "cart_001" });
    expect(filtro.updatedAt.gte).toEqual(new Date(Date.now() - QUINCE_MINUTOS_MS));
    expect(filtro.updatedAt.gte).toEqual(new Date("2026-08-25T11:45:00.000Z"));

    // Nodo 10: disponible = 10 físicas − 8 reservadas = 2.
    expect(salida.items[0].availableStock).toBe(2);
    // Nodos 11 y 12: RF26 — 3 pedidas > 2 disponibles → pedido pendiente de 1.
    expect(salida.items[0].isBackorder).toBe(true);
    expect(salida.items[0].backorderQuantity).toBe(1);
    // Nodo 14 = NO: un solo item. Nodos 15-17: 200.000 × 3 = 600.000 > 500.000.
    expect(salida.subtotal).toBe(600000);
    expect(salida.shipping).toBe(0);
    expect(salida.total).toBe(600000);
    expect(salida.itemCount).toBe(1);
  });

  it("CP-F-CHK-02-04 · camino 1,2,3,5,6,8,9,10,11,13,14,15,16,17,19,21,23 · Paso 11 = NO, Paso 16 = SI → disponible completo y valor límite 500001", async () => {
    // Nodo 6 = SI con stock suficiente y sin reservas de terceros.
    carritoBuscar.mockResolvedValue(
      filaCarrito([filaLinea({ quantity: 1, product: filaProducto({ price: 500001, stockQuantity: 10 }) })])
    );
    lineaBuscarVarias.mockResolvedValue([]);

    const salida = await caso.execute(ID_USUARIO);

    // Nodo 10: nadie reservó nada, el disponible es el stock físico.
    expect(salida.items[0].availableStock).toBe(10);
    // Nodo 13: 1 pedida ≤ 10 disponibles → sin pedido pendiente.
    expect(salida.items[0].isBackorder).toBe(false);
    expect(salida.items[0].backorderQuantity).toBe(0);
    // Nodos 16 y 17: RF16 — valor límite inferior del envío gratis (500001 > 500000).
    expect(salida.subtotal).toBe(500001);
    expect(salida.shipping).toBe(0);
    expect(salida.total).toBe(500001);
    // El nodo 8 sí se consultó porque el carrito tenía al menos un producto.
    expect(lineaBuscarVarias).toHaveBeenCalledTimes(1);
  });

  it("CP-F-CHK-02-05 · camino 1,2,3,5,6,8,9,10,11,12,14,9,…,15,16,17,19,21,23 · Paso 14 = SI → el bucle recorre varios productos", async () => {
    // Segunda instancia del camino 3 con retorno del bucle (arista 14→9):
    // dos productos, uno en pedido pendiente y otro disponible completo.
    carritoBuscar.mockResolvedValue(
      filaCarrito([
        filaLinea({ id: "ci_a", quantity: 5, product: filaProducto({ price: 100000, stockQuantity: 4 }) }),
        filaLinea({ id: "ci_b", quantity: 2, product: filaProducto({ id: ID_B, price: 150000, stockQuantity: 50 }) }),
      ])
    );
    // Nodo 8: sólo el primer producto tiene reservas ajenas vigentes.
    lineaBuscarVarias.mockResolvedValue([{ productId: ID_A, quantity: 2 }]);

    const salida = await caso.execute(ID_USUARIO);

    // El nodo 8 pide las reservas de los dos productos en una sola consulta.
    expect(lineaBuscarVarias.mock.calls[0][0].where.productId).toEqual({ in: [ID_A, ID_B] });
    // Primera vuelta del bucle: disponible = 4 − 2 = 2; 5 pedidas → faltan 3.
    expect(salida.items[0].availableStock).toBe(2);
    expect(salida.items[0].isBackorder).toBe(true);
    expect(salida.items[0].backorderQuantity).toBe(3);
    // Segunda vuelta (nodo 14 = SI → nodo 9): 50 disponibles, 2 pedidas.
    expect(salida.items[1].availableStock).toBe(50);
    expect(salida.items[1].isBackorder).toBe(false);
    expect(salida.items[1].backorderQuantity).toBe(0);
    // Nodos 15-19: 100.000×5 + 150.000×2 = 800.000 > 500.000 → envío gratis.
    expect(salida.subtotal).toBe(800000);
    expect(salida.shipping).toBe(0);
    expect(salida.total).toBe(800000);
    expect(salida.itemCount).toBe(2);
  });

  it("CP-F-CHK-02-06 · camino 1,2,3,5,6,7,15,16,18,20,22,23 · Paso 16 = NO → el envío cuesta 25.000 y con 500.000 exactos debería ser gratuito", async () => {
    // Acto 1 — el camino tal como lo declara el grafo: carrito existente y vacío.
    carritoBuscar.mockResolvedValue(filaCarrito([]));

    const vacio = await caso.execute(ID_USUARIO);

    // Nodos 18, 20 y 22: subtotal 0 → rama NO del nodo 16.
    expect(vacio.subtotal).toBe(0);
    expect(vacio.shipping).toBe(25000);
    expect(vacio.total).toBe(25000);

    // Acto 2 — valor límite exacto del nodo 16 con el carrito cargado.
    carritoBuscar.mockResolvedValue(
      filaCarrito([filaLinea({ quantity: 2, product: filaProducto({ price: 250000, stockQuantity: 10 }) })])
    );
    lineaBuscarVarias.mockResolvedValue([]);

    const limite = await caso.execute(ID_USUARIO);

    // Nodo 15: el subtotal se calcula bien (250.000 × 2 = 500.000 exactos).
    expect(limite.subtotal).toBe(500000);

    // DEFECTO: con 500.000 exactos el envío no es gratuito.
    // HU19 exige "Dado un subtotal igual o mayor a 500.000 COP, cuando se
    // calcule el envío, entonces el sistema debe aplicar envío gratuito", pero
    // el nodo 16 está implementado como `subtotal > 500000` y cobra los 25.000.
    // Contradice a HU19 y coincide con RF16 ("cuando el subtotal SUPERE los
    // 500.000"): el umbral estricto o inclusivo es una decisión de negocio
    // pendiente (RF16 · HU19 · ESC16).
    expect(limite.shipping).toBe(0);
    expect(limite.total).toBe(500000);
  });
});
