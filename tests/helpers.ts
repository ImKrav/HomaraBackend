// ============================================================================
// Dobles de prueba hechos a mano + fábricas de datos.
//
// Sustituye al viejo `test-helpers.ts` basado en Vitest. En vez de `vi.fn()`
// hay un `spy()` de ~20 líneas: registra llamadas y deja configurar el valor
// de retorno. Los repositorios "falsos" son objetos planos de spies.
// ============================================================================

import { deepStrictEqual } from "node:assert/strict";

// --- Spy artesanal --------------------------------------------------------

export interface Spy {
  (...args: any[]): any;
  calls: any[][];
  /** Devuelve `v` de forma síncrona. */
  returns(v: any): Spy;
  /** Devuelve `Promise.resolve(v)`. */
  resolves(v: any): Spy;
  /** Devuelve una promesa rechazada con `e`. */
  rejects(e: any): Spy;
  /** Ejecuta `f` con los argumentos recibidos. */
  does(f: (...a: any[]) => any): Spy;
  /** Encola un valor resuelto para la próxima llamada (se consume una vez). */
  resolvesOnce(v: any): Spy;
  /** Limpia llamadas y comportamiento. */
  reset(): Spy;
}

export function spy(impl?: (...a: any[]) => any): Spy {
  const cola: Array<(...a: any[]) => any> = [];
  let base = impl;

  const s = ((...args: any[]) => {
    s.calls.push(args);
    const fn = cola.length ? cola.shift()! : base;
    return fn ? fn(...args) : undefined;
  }) as Spy;

  s.calls = [];
  s.returns = (v) => ((base = () => v), s);
  s.resolves = (v) => ((base = async () => v), s);
  s.rejects = (e) => ((base = async () => { throw e; }), s);
  s.does = (f) => ((base = f), s);
  s.resolvesOnce = (v) => (cola.push(async () => v), s);
  s.reset = () => ((s.calls = []), (cola.length = 0), (base = impl), s);
  return s;
}

/** Primer argumento de la llamada `n` (por defecto la primera). */
export const arg = (s: Spy, llamada = 0, pos = 0) => s.calls[llamada]?.[pos];

/** ¿Se llamó al spy alguna vez con exactamente estos argumentos? */
export function calledWith(s: Spy, ...esperados: any[]): boolean {
  return s.calls.some((c) => {
    try {
      deepStrictEqual(c, esperados);
      return true;
    } catch {
      return false;
    }
  });
}

/** ¿Nunca se llamó? */
export const neverCalled = (s: Spy) => s.calls.length === 0;

// --- Repositorios falsos (objetos de spies) ------------------------------

export const fakeUsuarios = () => ({
  findById: spy(),
  findByEmail: spy(),
  create: spy(),
  update: spy(),
});

export const fakeProyectos = () => ({
  findAllByUserId: spy(),
  findById: spy(),
  create: spy(async (p: any) => proyecto(p)),
  update: spy(async (id: string, d: any) => proyecto({ id, ...d })),
  delete: spy(),
});

export const fakeProductos = () => ({
  findAll: spy(),
  findById: spy(),
  create: spy(),
  updateStock: spy(),
  findStorefrontRecommended: spy(),
  findStorefrontOffers: spy(),
  findStorefrontBestSellers: spy(),
  updateProductRating: spy(),
  update: spy(),
  delete: spy(),
});

export const fakeCarritos = () => ({
  findByUserId: spy(),
  addItem: spy(),
  updateItemQuantity: spy(),
  removeItem: spy(),
  clear: spy(),
  findItemOwner: spy(),
  getReservedQuantities: spy(),
});

export const fakeResenas = () => ({
  create: spy(),
  findByUserAndProduct: spy(),
  findByProductId: spy(),
  getAverageRatingAndCount: spy(),
});

export const fakePedidos = () => ({
  findAll: spy(),
  findByIdOrNumber: spy(),
  create: spy(),
  updateStatus: spy(),
  countByYear: spy(),
});

export const fakePrismaAdmin = () => ({
  order: { findMany: spy(), count: spy() },
  orderItem: { findMany: spy() },
  product: { count: spy(), findMany: spy() },
  user: { count: spy() },
});

// --- Entidades y fábricas de datos (idénticas al viejo helper) ----------

export function usuario(over: Record<string, any> = {}) {
  return {
    id: "usr_001",
    email: "ana@homara.com",
    password: "$2b$10$hashDeEjemplo",
    firstName: "Ana",
    lastName: "Rojas",
    phone: "3001234567",
    address: "Calle 1 #2-3",
    city: "Bogotá",
    state: "Cundinamarca",
    zipCode: "110111",
    role: "CUSTOMER",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...over,
  };
}

export function datosRegistro(over: Record<string, any> = {}) {
  return {
    email: "ana@homara.com",
    password: "ClaveSegura8",
    firstName: "Ana",
    lastName: "Rojas",
    ...over,
  };
}

export function producto(over: Record<string, any> = {}) {
  return {
    id: "prd_001",
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
    category: "Pisos y Ceramicas",
    categorySlug: "pisos-ceramicas",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    tags: [],
    ...over,
  };
}

export function filaProductoPrisma(over: Record<string, any> = {}) {
  return {
    id: "prd_001",
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

export function proyecto(over: Record<string, any> = {}) {
  return {
    id: "proy_001",
    name: "Cocina",
    type: "PISO",
    status: "EN_PROGRESO",
    length: null,
    width: null,
    height: null,
    area: 20,
    materialType: "ceramica",
    tileFormat: "60x60",
    thumbnail: "🏠",
    estimatedCost: 0,
    userId: "usr_001",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    materials: [],
    wastePercent: 10,
    layingPattern: "directo",
    deductDoors: 0,
    deductWindows: 0,
    customSubtractions: 0,
    includeAdhesive: true,
    includeGrout: true,
    includeSpacers: true,
    includeTools: true,
    selectedProductId: null,
    ...over,
  };
}

export function datosProyecto(over: Record<string, any> = {}) {
  return {
    name: "Cocina",
    type: "PISO",
    area: 20,
    materialType: "ceramica",
    tileFormat: "60x60",
    userId: "usr_001",
    ...over,
  };
}

export function materialManual(over: Record<string, any> = {}) {
  return {
    name: "Ceramica traida por el cliente",
    quantity: "22 m²",
    icon: "🏗️",
    price: 100000,
    ...over,
  };
}

export function carrito(over: Record<string, any> = {}) {
  return { id: "cart_001", userId: "usr_001", items: [], ...over };
}

export function resena(over: Record<string, any> = {}) {
  return {
    id: "rev_001",
    rating: 5,
    comment: "Excelente producto.",
    createdAt: new Date("2026-02-01"),
    userId: "usr_001",
    productId: "prd_001",
    ...over,
  };
}

export function datosResena(over: Record<string, any> = {}) {
  return { rating: 5, comment: "Excelente producto.", ...over };
}

export function datosProducto(over: Record<string, any> = {}) {
  return {
    name: "Cemento Gris 50 kg",
    description: "Cemento de uso estructural",
    price: 32000,
    stockQuantity: 120,
    unit: "bulto",
    categoryId: "cat_002",
    ...over,
  };
}

export function ordenEntregada(over: Record<string, any> = {}) {
  return { total: 100000, createdAt: new Date(2026, 0, 15), ...over };
}

export function itemVendido(total: number, categoria = "Pisos y Ceramicas") {
  return { total, product: { category: { name: categoria } } };
}

/** Programa las 3 llamadas secuenciales a `order.findMany` del tablero admin. */
export function programarOrdenes(
  p: ReturnType<typeof fakePrismaAdmin>,
  o: { actual?: any[]; anterior?: any[]; anio?: any[] } = {},
) {
  p.order.findMany
    .resolvesOnce(o.actual ?? [])
    .resolvesOnce(o.anterior ?? [])
    .resolvesOnce(o.anio ?? []);
}

// --- Utilidades HTTP y Express -----------------------------------------

export function contextoExpress(authHeader?: string) {
  const req: any = { headers: authHeader ? { authorization: authHeader } : {} };
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
  };
  const next = spy();
  return { req, res, next };
}

/** El error pasado a `next(err)` en el primer llamado. */
export function errorDeNext(next: Spy) {
  return next.calls[0]?.[0];
}

/** Ejecuta `fn` con `Date.now()` congelado en `iso` (reemplaza a los fake timers). */
export async function conRelojFijo<T>(iso: string, fn: () => T | Promise<T>): Promise<T> {
  const real = Date.now;
  Date.now = () => new Date(iso).getTime();
  try {
    return await fn();
  } finally {
    Date.now = real;
  }
}
