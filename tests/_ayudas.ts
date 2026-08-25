// ============================================================================
// Utilidades compartidas por las pruebas de cobertura de ruta básica
// ============================================================================
import { vi } from "vitest";
import type { IUserRepository } from "../src/domain/repositories/user-repository.interface.js";

/** Doble de prueba del repositorio de usuarios. */
export function mockUserRepository(): IUserRepository & Record<string, any> {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  } as any;
}

/** Usuario válido de referencia. */
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

/** Datos de registro que superan el esquema del servidor. */
export function datosRegistro(over: Record<string, any> = {}) {
  return {
    email: "ana@homara.com",
    password: "ClaveSegura8",
    firstName: "Ana",
    lastName: "Rojas",
    ...over,
  };
}

/** Triple (req, res, next) mínimo para probar middlewares de Express. */
export function contextoExpress(authHeader?: string) {
  const req: any = { headers: authHeader ? { authorization: authHeader } : {} };
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(c: number) { this.statusCode = c; return this; },
    json(b: unknown) { this.body = b; return this; },
  };
  const next = vi.fn();
  return { req, res, next };
}

/** Recupera el error que el middleware pasó a next(). */
export function errorDeNext(next: any) {
  return next.mock.calls[0]?.[0];
}

// ----------------------------------------------------------------------------
// Ayudas para los grafos de PROYECTOS (F-PROY-01 · F-PROY-03)
// ----------------------------------------------------------------------------
import type { IProjectRepository } from "../src/domain/repositories/project-repository.interface.js";
import type { IProductRepository } from "../src/domain/repositories/product-repository.interface.js";

/** Doble de prueba del repositorio de proyectos. */
export function mockProjectRepository(): IProjectRepository & Record<string, any> {
  return {
    findAllByUserId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(async (p: any) => proyecto(p)),
    update: vi.fn(async (id: string, d: any) => proyecto({ id, ...d })),
    delete: vi.fn(),
  } as any;
}

/** Doble de prueba del repositorio de productos del catálogo. */
export function mockProductRepository(): IProductRepository & Record<string, any> {
  return {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    updateStock: vi.fn(),
    findStorefrontRecommended: vi.fn(),
    findStorefrontOffers: vi.fn(),
    findStorefrontBestSellers: vi.fn(),
    updateProductRating: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as any;
}

/** Producto del catálogo de referencia (por defecto, un piso cerámico válido). */
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

/** Proyecto guardado de referencia (el dueño es usr_001). */
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

/** Datos mínimos válidos para crear un proyecto (F-PROY-01). */
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

/** Material manual que el cliente puede enviar en una actualización (F-PROY-03). */
export function materialManual(over: Record<string, any> = {}) {
  return {
    name: "Ceramica traida por el cliente",
    quantity: "22 m²",
    icon: "🏗️",
    price: 100000,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Dobles y datos de referencia del módulo CATÁLOGO (F-CAT-01 · F-CAT-02 · F-CAT-03)
// (reutiliza mockProductRepository() y producto() declarados más arriba)
// ---------------------------------------------------------------------------
import type { ICartRepository } from "../src/domain/repositories/cart-repository.interface.js";
import type { IReviewRepository } from "../src/domain/repositories/review-repository.interface.js";

/** Doble de prueba del repositorio de carritos. */
export function mockCartRepository(): ICartRepository & Record<string, any> {
  return {
    findByUserId: vi.fn(),
    addItem: vi.fn(),
    updateItemQuantity: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    findItemOwner: vi.fn(),
    getReservedQuantities: vi.fn(),
  } as any;
}

/** Doble de prueba del repositorio de reseñas. */
export function mockReviewRepository(): IReviewRepository & Record<string, any> {
  return {
    create: vi.fn(),
    findByUserAndProduct: vi.fn(),
    findByProductId: vi.fn(),
    getAverageRatingAndCount: vi.fn(),
  } as any;
}

/** Fila cruda tal como la devuelve prisma.product.findMany/findUnique (con include). */
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

/** Carrito de referencia del usuario que consulta el catálogo. */
export function carrito(over: Record<string, any> = {}) {
  return { id: "cart_001", userId: "usr_001", items: [], ...over };
}

/** Reseña de referencia ya persistida. */
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

/** Datos de una reseña que superan el esquema del servidor (createReviewSchema). */
export function datosResena(over: Record<string, any> = {}) {
  return { rating: 5, comment: "Excelente producto.", ...over };
}

/** Ejecuta una promesa y devuelve el error lanzado (para inspeccionar mensaje y statusCode). */
export async function capturarError(promesa: Promise<unknown>): Promise<any> {
  return await promesa.then(
    () => { throw new Error("Se esperaba un error y la operación terminó bien."); },
    (e) => e
  );
}

// ---------------------------------------------------------------------------
// Dobles y datos de referencia del módulo ADMINISTRACIÓN (F-ADM-01 · F-ADM-02 · F-ADM-03)
// (reutiliza mockProductRepository(), producto() y filaProductoPrisma() de más arriba)
// ---------------------------------------------------------------------------

/**
 * Doble del cliente Prisma que usa AdminController.
 * Solo declara los modelos y métodos que el controlador consulta.
 */
export function mockPrismaAdmin() {
  return {
    order: { findMany: vi.fn(), count: vi.fn() },
    orderItem: { findMany: vi.fn() },
    product: { count: vi.fn(), findMany: vi.fn() },
    user: { count: vi.fn() },
  } as any;
}

/** Orden ENTREGADO tal como la devuelve prisma.order.findMany (solo total y fecha). */
export function ordenEntregada(over: Record<string, any> = {}) {
  return { total: 100000, createdAt: new Date(2026, 0, 15), ...over };
}

/** Línea de pedido con su producto y categoría, tal como la devuelve prisma.orderItem.findMany. */
export function itemVendido(total: number, categoria = "Pisos y Ceramicas") {
  return { total, product: { category: { name: categoria } } };
}

/**
 * Programa las tres llamadas seguidas a prisma.order.findMany de getMetrics():
 * 1) mes actual, 2) mes anterior, 3) año en curso.
 */
export function programarOrdenes(
  p: any,
  o: { actual?: any[]; anterior?: any[]; anio?: any[] } = {}
) {
  p.order.findMany
    .mockResolvedValueOnce(o.actual ?? [])
    .mockResolvedValueOnce(o.anterior ?? [])
    .mockResolvedValueOnce(o.anio ?? []);
}

/** Datos mínimos válidos para crear un producto (createProductSchema). */
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
