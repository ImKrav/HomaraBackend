// ============================================
// Homara — Seed Script (TypeScript)
// ============================================

import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding Homara database (TS)...\n");

  // ─── Check if already seeded ──────────────
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log("✅ Database already contains data. Skipping seed to prevent data loss.");
    return;
  }

  // ─── Clean existing data ────────────────────
  console.log("🧹 Cleaning existing data...");
  await prisma.review.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.projectMaterial.deleteMany();
  await prisma.project.deleteMany();
  await prisma.productTag.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // ─── Users ──────────────────────────────────
  console.log("👤 Creating users...");

  const defaultPasswordHash = await bcrypt.hash("123456", 10);

  const demoUser = await prisma.user.create({
    data: {
      id: "demo-user-001",
      email: "juan@email.com",
      password: defaultPasswordHash,
      firstName: "Juan",
      lastName: "Pérez",
      phone: "300 123 4567",
      address: "Calle 123 # 45-67",
      city: "Bogotá",
      state: "Cundinamarca",
      zipCode: "110111",
      role: "CUSTOMER",
    },
  });

  const users = await Promise.all([
    prisma.user.create({
      data: {
        id: "user-carlos",
        email: "carlos@email.com",
        password: defaultPasswordHash,
        firstName: "Carlos",
        lastName: "Martínez",
        city: "Medellín",
        state: "Antioquia",
        role: "CUSTOMER",
      },
    }),
    prisma.user.create({
      data: {
        id: "user-maria",
        email: "maria@email.com",
        password: defaultPasswordHash,
        firstName: "María",
        lastName: "López",
        city: "Cali",
        state: "Valle del Cauca",
        role: "CUSTOMER",
      },
    }),
    prisma.user.create({
      data: {
        id: "user-juan-r",
        email: "juanr@email.com",
        password: defaultPasswordHash,
        firstName: "Juan",
        lastName: "Rodríguez",
        city: "Bogotá",
        state: "Cundinamarca",
        role: "CUSTOMER",
      },
    }),
    prisma.user.create({
      data: {
        id: "user-ana",
        email: "ana@email.com",
        password: defaultPasswordHash,
        firstName: "Ana",
        lastName: "García",
        city: "Barranquilla",
        state: "Atlántico",
        role: "CUSTOMER",
      },
    }),
    prisma.user.create({
      data: {
        id: "user-pedro",
        email: "pedro@email.com",
        password: defaultPasswordHash,
        firstName: "Pedro",
        lastName: "Sánchez",
        city: "Cartagena",
        state: "Bolívar",
        role: "CUSTOMER",
      },
    }),
    prisma.user.create({
      data: {
        id: "user-lucia",
        email: "lucia@email.com",
        password: defaultPasswordHash,
        firstName: "Lucía",
        lastName: "Hernández",
        city: "Bucaramanga",
        state: "Santander",
        role: "CUSTOMER",
      },
    }),
    prisma.user.create({
      data: {
        id: "admin-001",
        email: "admin@homara.co",
        password: defaultPasswordHash,
        firstName: "Admin",
        lastName: "Homara",
        role: "ADMIN",
      },
    }),
  ]);

  // ─── Categories ─────────────────────────────
  console.log("📂 Creating categories...");

  const categoriesData = [
    { name: "Pisos y Cerámicas", slug: "pisos-ceramicas", description: "Baldosas, porcelanatos y cerámicas para todo tipo de superficies", icon: "🏗️" },
    { name: "Herramientas", slug: "herramientas", description: "Herramientas manuales y eléctricas para todo profesional", icon: "🔧" },
    { name: "Pinturas", slug: "pinturas", description: "Pinturas de interior, exterior y acabados especiales", icon: "🎨" },
    { name: "Muebles", slug: "muebles", description: "Muebles modernos y funcionales para amueblar cada espacio", icon: "🪑" },
    { name: "Iluminación", slug: "iluminacion", description: "Lámparas, focos y sistemas de iluminación LED", icon: "💡" },
    { name: "Materiales de Construcción", slug: "materiales-construccion", description: "Cemento, bloques, arena y todo material de obra", icon: "🧱" },
  ];

  const categories: Record<string, any> = {};
  for (const cat of categoriesData) {
    categories[cat.slug] = await prisma.category.create({ data: cat });
  }

  // ─── Products ───────────────────────────────
  console.log("🏷️ Creating products...");

  const productsData = [
    {
      name: "Porcelanato Mármol Carrara 60x60",
      description: "Porcelanato de alta calidad con acabado mármol Carrara. Resistente al tráfico pesado, ideal para salas y cocinas. Superficie antideslizante con brillo natural.",
      price: 45900, originalPrice: 52000, image: "/products/porcelanato.jpg",
      categorySlug: "pisos-ceramicas", rating: 4.8, reviewCount: 234,
      inStock: true, stockQuantity: 1250, unit: "m²", tags: ["oferta", "popular"],
    },
    {
      name: "Taladro Percutor Inalámbrico 20V",
      description: "Taladro percutor de alto rendimiento con batería de litio de 20V. Incluye 2 baterías, cargador rápido y maletín. Motor brushless de larga duración.",
      price: 289000, originalPrice: null, image: "/products/taladro.jpg",
      categorySlug: "herramientas", rating: 4.9, reviewCount: 567,
      inStock: true, stockQuantity: 89, unit: "unidad", tags: ["popular", "nuevo"],
    },
    {
      name: "Pintura Interior Premium Blanco 5L",
      description: "Pintura acrílica de máxima cubrimiento con acabado mate aterciopelado. Lavable, bajo olor y secado rápido. Rendimiento: 12m² por litro.",
      price: 125000, originalPrice: 148000, image: "/products/pintura.jpg",
      categorySlug: "pinturas", rating: 4.6, reviewCount: 189,
      inStock: true, stockQuantity: 340, unit: "galón", tags: ["oferta"],
    },
    {
      name: "Escritorio Nórdico Madera Natural 120cm",
      description: "Escritorio minimalista de estilo nórdico fabricado en madera de pino con acabado natural. Patas metálicas negras. Incluye pasacables y organizador.",
      price: 459000, originalPrice: null, image: "/products/escritorio.jpg",
      categorySlug: "muebles", rating: 4.7, reviewCount: 98,
      inStock: true, stockQuantity: 24, unit: "unidad", tags: ["nuevo"],
    },
    {
      name: "Panel LED Slim 60x60 40W Luz Día",
      description: "Panel LED ultradelgado para instalación empotrada o superficial. Luz día 6500K con alto índice de reproducción cromática. Ideal para oficinas y comercios.",
      price: 89000, originalPrice: null, image: "/products/panel-led.jpg",
      categorySlug: "iluminacion", rating: 4.5, reviewCount: 145,
      inStock: true, stockQuantity: 567, unit: "unidad", tags: [],
    },
    {
      name: "Cemento Gris Uso General 50kg",
      description: "Cemento portland tipo I para uso general en construcción. Alta resistencia y fraguado uniforme. Ideal para cimentaciones, columnas y losas.",
      price: 32000, originalPrice: null, image: "/products/cemento.jpg",
      categorySlug: "materiales-construccion", rating: 4.4, reviewCount: 890,
      inStock: true, stockQuantity: 2340, unit: "bulto", tags: ["popular"],
    },
    {
      name: "Pegante Cerámico Flexible 25kg",
      description: "Pegante cementicio flexible de alta adherencia para instalación de cerámica y porcelanato en pisos y paredes. Resistente a la humedad.",
      price: 28500, originalPrice: null, image: "/products/pegante.jpg",
      categorySlug: "materiales-construccion", rating: 4.3, reviewCount: 412,
      inStock: true, stockQuantity: 1890, unit: "bulto", tags: [],
    },
    {
      name: "Lámpara Colgante Industrial Negro",
      description: "Lámpara colgante de estilo industrial con acabado negro mate. Cable ajustable hasta 1.5m. Compatible con bombillo E27. Perfecta para comedores y barras.",
      price: 145000, originalPrice: 175000, image: "/products/lampara.jpg",
      categorySlug: "iluminacion", rating: 4.6, reviewCount: 67,
      inStock: true, stockQuantity: 45, unit: "unidad", tags: ["oferta"],
    },
    {
      name: 'Sierra Circular 7-1/4" 1800W',
      description: 'Sierra circular profesional de alto rendimiento con disco de 7-1/4 pulgadas. Motor de 1800W, guía láser y ajuste de profundidad. Incluye adaptador de extracción de polvo.',
      price: 375000, originalPrice: null, image: "/products/sierra.jpg",
      categorySlug: "herramientas", rating: 4.8, reviewCount: 203,
      inStock: true, stockQuantity: 34, unit: "unidad", tags: ["popular"],
    },
    {
      name: "Baldosa Cerámica Madera Roble 20x60",
      description: "Baldosa cerámica con efecto madera de roble natural. Resistente al desgaste y fácil mantenimiento. Ideal para habitaciones y salas.",
      price: 38900, originalPrice: null, image: "/products/baldosa-madera.jpg",
      categorySlug: "pisos-ceramicas", rating: 4.7, reviewCount: 178,
      inStock: true, stockQuantity: 980, unit: "m²", tags: ["nuevo"],
    },
    {
      name: "Estantería Metálica Industrial 5 Niveles",
      description: "Estantería metálica de 5 niveles con acabado negro. Estructura reforzada con capacidad de 175kg por nivel. Fácil ensamble sin herramientas.",
      price: 219000, originalPrice: null, image: "/products/estanteria.jpg",
      categorySlug: "muebles", rating: 4.5, reviewCount: 134,
      inStock: false, stockQuantity: 0, unit: "unidad", tags: [],
    },
    {
      name: "Rodillo de Pintura Antigoteo 23cm",
      description: "Rodillo profesional con sistema antigoteo y mango ergonómico extensible. Felpa de microfibra para acabado perfecto. Incluye bandeja.",
      price: 34500, originalPrice: null, image: "/products/rodillo.jpg",
      categorySlug: "herramientas", rating: 4.2, reviewCount: 256,
      inStock: true, stockQuantity: 678, unit: "unidad", tags: [],
    },
    
    // --- NUEVAS CERÁMICAS ---
    {
      name: "Cerámica Rústica Terracota 45x45",
      description: "Cerámica rústica de alta resistencia para exteriores, balcones y terrazas. Hermoso acabado terracota natural antideslizante.",
      price: 32000, originalPrice: 36000, image: "/products/rustico.jpg",
      categorySlug: "pisos-ceramicas", rating: 4.5, reviewCount: 88,
      inStock: true, stockQuantity: 550, unit: "m²", tags: ["oferta"],
    },
    {
      name: "Cerámica Hidráulica Decorativa Flor 30x30",
      description: "Baldosas de cerámica hidráulica decorativa con patrón floral vintage. Perfectas para acentos decorativos en baños y cocinas.",
      price: 29000, originalPrice: null, image: "/products/hidraulica.jpg",
      categorySlug: "pisos-ceramicas", rating: 4.6, reviewCount: 64,
      inStock: true, stockQuantity: 320, unit: "m²", tags: ["nuevo"],
    },
    {
      name: "Cerámica Subterráneo Blanco Metro 10x20",
      description: "Clásica baldosa de cerámica tipo Subway o Metro en formato rectangular. Acabado brillante ideal para salpicaderos de cocina y paredes de baño.",
      price: 31000, originalPrice: null, image: "/products/metro.jpg",
      categorySlug: "pisos-ceramicas", rating: 4.9, reviewCount: 198,
      inStock: true, stockQuantity: 1200, unit: "m²", tags: ["popular"],
    },
    
    // --- NUEVOS PORCELANATOS ---
    {
      name: "Porcelanato Pulido Rectificado Beige 80x80",
      description: "Porcelanato pulido rectificado de gran formato en tono beige neutro. Aporta amplitud, elegancia y un brillo tipo espejo a tu sala o comedor.",
      price: 54000, originalPrice: 62000, image: "/products/porcelanato-beige.jpg",
      categorySlug: "pisos-ceramicas", rating: 4.7, reviewCount: 112,
      inStock: true, stockQuantity: 750, unit: "m²", tags: ["popular"],
    },
    {
      name: "Porcelanato Súper Formato Gris Oxford 100x100",
      description: "Porcelanato de súper gran formato rectificado con acabado mate texturizado tipo piedra. Máxima sofisticación para interiores residenciales.",
      price: 65000, originalPrice: null, image: "/products/porcelanato-gris.jpg",
      categorySlug: "pisos-ceramicas", rating: 4.8, reviewCount: 57,
      inStock: true, stockQuantity: 400, unit: "m²", tags: ["nuevo"],
    },
    {
      name: "Porcelanato Negro Absoluto Satinado 60x60",
      description: "Porcelanato con acabado negro satinado de alta elegancia. Apto para tráfico medio-alto en interiores y salpicaderos de lujo.",
      price: 45900, originalPrice: null, image: "/products/porcelanato-negro.jpg",
      categorySlug: "pisos-ceramicas", rating: 4.4, reviewCount: 42,
      inStock: true, stockQuantity: 180, unit: "m²", tags: [],
    },
    
    // --- NUEVAS MADERAS LAMINADAS ---
    {
      name: "Piso Laminado Madera Nogal Alemán 15x90",
      description: "Piso de madera laminada alemana de alta densidad. Aspecto nogal natural con vetas marcadas. Aporta calidez extrema a dormitorios y estudios.",
      price: 51000, originalPrice: 58000, image: "/products/madera-nogal.jpg",
      categorySlug: "pisos-ceramicas", rating: 4.8, reviewCount: 146,
      inStock: true, stockQuantity: 620, unit: "m²", tags: ["popular"],
    },
    {
      name: "Piso Laminado Teka Resistente al Agua 15x90",
      description: "Piso laminado con tecnología hidrófuga avanzada para resistir derrames superficiales. Textura táctil de madera de teca real.",
      price: 53500, originalPrice: null, image: "/products/madera-teka.jpg",
      categorySlug: "pisos-ceramicas", rating: 4.6, reviewCount: 78,
      inStock: true, stockQuantity: 450, unit: "m²", tags: ["nuevo"],
    },
    {
      name: "Piso Laminado Haya Clic Acústico 20x60",
      description: "Piso laminado de madera clara de Haya con sistema Clic fácil de instalar. Incluye base de aislamiento acústico integrada.",
      price: 49000, originalPrice: null, image: "/products/madera-haya.jpg",
      categorySlug: "pisos-ceramicas", rating: 4.5, reviewCount: 39,
      inStock: true, stockQuantity: 280, unit: "m²", tags: [],
    },
    
    // --- NUEVOS VINILOS (PISO PVC) ---
    {
      name: "Piso Vinílico SPC Clic Roble Miel 15x90",
      description: "Piso de vinilo SPC rígido de alta gama. 100% impermeable al agua, ideal para cocinas y áreas húmedas. Sistema clic de instalación flotante.",
      price: 28000, originalPrice: 32000, image: "/products/vinilo-roble.jpg",
      categorySlug: "pisos-ceramicas", rating: 4.7, reviewCount: 95,
      inStock: true, stockQuantity: 880, unit: "m²", tags: ["popular"],
    },
    {
      name: "Piso Vinílico Autoadhesivo Gris Cenizo 20x60",
      description: "Lamas de vinilo autoadhesivo de fácil instalación para renovación rápida de ambientes residenciales. Acabado gris cenizo texturizado.",
      price: 26000, originalPrice: null, image: "/products/vinilo-gris.jpg",
      categorySlug: "pisos-ceramicas", rating: 4.3, reviewCount: 110,
      inStock: true, stockQuantity: 950, unit: "m²", tags: ["oferta"],
    },
    
    // --- NUEVAS PINTURAS ---
    {
      name: "Pintura Exterior Ultra Resistente Gris Fósil 5L",
      description: "Pintura para exteriores de máxima durabilidad y resistencia al sol y lluvia. Tecnología antihumedad y antihongos en hermoso tono Gris Fósil.",
      price: 135000, originalPrice: null, image: "/products/pintura-gris.jpg",
      categorySlug: "pinturas", rating: 4.7, reviewCount: 75,
      inStock: true, stockQuantity: 180, unit: "galón", tags: [],
    },
    {
      name: "Pintura Acrílica Satinada Lavable Beige Arena 5L",
      description: "Pintura de interior satinada con excelente lavabilidad. Remueve manchas comunes con un paño húmedo. Acabado elegante tono Beige Arena.",
      price: 128000, originalPrice: 145000, image: "/products/pintura-beige.jpg",
      categorySlug: "pinturas", rating: 4.5, reviewCount: 92,
      inStock: true, stockQuantity: 240, unit: "galón", tags: ["oferta"],
    },
  ];

  const products: Record<string, any> = {};
  for (const pData of productsData) {
    const { tags, categorySlug, ...productFields } = pData;
    const product = await prisma.product.create({
      data: {
        ...productFields,
        categoryId: categories[categorySlug].id,
        tags: {
          create: tags.map((t) => ({ name: t })),
        },
      },
    });
    products[product.name] = product;
  }

  const productList = Object.values(products);

  // ─── Projects ───────────────────────────────
  console.log("📐 Creating projects...");

  const projectsData = [
    {
      name: "Remodelación Sala Principal",
      type: "PISO", status: "EN_PROGRESO", area: 35,
      createdAt: new Date("2026-03-15"), thumbnail: "🏠",
      materials: [
        { name: "Porcelanato 60x60", quantity: "39 m²", note: "+10% de desperdicio", icon: "🏗️", price: 45900 * 39 },
        { name: "Pegante cerámico", quantity: "8 bultos", note: "25kg c/u", icon: "🧱", price: 28500 * 8 },
        { name: "Boquilla", quantity: "4 kg", note: null, icon: "🪣", price: 12000 * 4 },
        { name: "Crucetas 2mm", quantity: "2 bolsas", note: "100 unidades c/u", icon: "➕", price: 8500 * 2 },
        { name: "Nivel de burbuja 60cm", quantity: "1 unidad", note: null, icon: "📏", price: 35000 },
      ],
    },
    {
      name: "Baño Master - Enchape completo",
      type: "PARED", status: "COMPLETADO", area: 18,
      createdAt: new Date("2026-02-20"), thumbnail: "🚿",
      materials: [
        { name: "Cerámica 30x60", quantity: "20 m²", note: "+10% de desperdicio", icon: "🏗️", price: 35500 * 20 },
        { name: "Pegante cerámico", quantity: "5 bultos", note: "25kg c/u", icon: "🧱", price: 28500 * 5 },
        { name: "Boquilla", quantity: "3 kg", note: null, icon: "🪣", price: 12000 * 3 },
        { name: "Crucetas 2mm", quantity: "2 bolsas", note: "100 unidades c/u", icon: "➕", price: 8500 * 2 },
        { name: "Nivel de burbuja 60cm", quantity: "1 unidad", note: null, icon: "📏", price: 35000 },
      ],
    },
    {
      name: "Cocina Integral - Piso nuevo",
      type: "PISO", status: "EN_PROGRESO", area: 22,
      createdAt: new Date("2026-04-01"), thumbnail: "🍳",
      materials: [
        { name: "Porcelanato 45x45", quantity: "25 m²", note: "+10% de desperdicio", icon: "🏗️", price: 39000 * 25 },
        { name: "Pegante cerámico", quantity: "6 bultos", note: "25kg c/u", icon: "🧱", price: 28500 * 6 },
        { name: "Boquilla", quantity: "3 kg", note: null, icon: "🪣", price: 12000 * 3 },
        { name: "Crucetas 2mm", quantity: "2 bolsas", note: "100 unidades c/u", icon: "➕", price: 8500 * 2 },
        { name: "Nivel de burbuja 60cm", quantity: "1 unidad", note: null, icon: "📏", price: 35000 },
      ],
    },
    {
      name: "Terraza - Recubrimiento exterior",
      type: "PISO", status: "PAUSADO", area: 40,
      createdAt: new Date("2026-01-10"), thumbnail: "🌿",
      materials: [
        { name: "Cerámica exterior 60x60", quantity: "44 m²", note: "+10% de desperdicio", icon: "🏗️", price: 38900 * 44 },
        { name: "Pegante cerámico", quantity: "10 bultos", note: "25kg c/u", icon: "🧱", price: 28500 * 10 },
        { name: "Boquilla", quantity: "5 kg", note: null, icon: "🪣", price: 12000 * 5 },
        { name: "Crucetas 2mm", quantity: "3 bolsas", note: "100 unidades c/u", icon: "➕", price: 8500 * 3 },
        { name: "Nivel de burbuja 60cm", quantity: "1 unidad", note: null, icon: "📏", price: 35000 },
      ],
    },
  ];

  for (const proj of projectsData) {
    const estimatedCost = proj.materials.reduce((sum, m) => sum + m.price, 0);
    await prisma.project.create({
      data: {
        name: proj.name,
        type: proj.type as any,
        status: proj.status as any,
        area: proj.area,
        createdAt: proj.createdAt,
        thumbnail: proj.thumbnail,
        estimatedCost,
        userId: demoUser.id,
        materials: {
          create: proj.materials,
        },
      },
    });
  }

  // ─── Cart ───────────────────────────────────
  console.log("🛒 Creating demo cart...");

  await prisma.cart.create({
    data: {
      userId: demoUser.id,
      items: {
        create: [
          { productId: productList[0].id, quantity: 4 },  // Porcelanato
          { productId: productList[1].id, quantity: 1 },  // Taladro
          { productId: productList[6].id, quantity: 3 },  // Pegante
        ],
      },
    },
  });

  // ─── Orders ─────────────────────────────────
  console.log("📦 Creating orders...");

  const ordersData = [
    {
      orderNumber: "ORD-2026-001", status: "ENVIADO", userId: "user-carlos",
      subtotal: 860000, shippingCost: 0, total: 892000,
      createdAt: new Date("2026-04-12"),
      items: [
        { productId: productList[0].id, quantity: 10, unitPrice: 45900, total: 459000 },
        { productId: productList[6].id, quantity: 5, unitPrice: 28500, total: 142500 },
        { productId: productList[5].id, quantity: 3, unitPrice: 32000, total: 96000 },
      ],
    },
    {
      orderNumber: "ORD-2026-002", status: "PROCESANDO", userId: "user-maria",
      subtotal: 431000, shippingCost: 25000, total: 456000,
      createdAt: new Date("2026-04-11"),
      items: [
        { productId: productList[2].id, quantity: 2, unitPrice: 125000, total: 250000 },
        { productId: productList[11].id, quantity: 1, unitPrice: 34500, total: 34500 },
      ],
    },
    {
      orderNumber: "ORD-2026-003", status: "ENTREGADO", userId: "user-juan-r",
      subtotal: 1234000, shippingCost: 0, total: 1234000,
      createdAt: new Date("2026-04-10"),
      items: [
        { productId: productList[3].id, quantity: 1, unitPrice: 459000, total: 459000 },
        { productId: productList[8].id, quantity: 1, unitPrice: 375000, total: 375000 },
        { productId: productList[1].id, quantity: 1, unitPrice: 289000, total: 289000 },
      ],
    },
    {
      orderNumber: "ORD-2026-004", status: "PENDIENTE", userId: "user-ana",
      subtotal: 153000, shippingCost: 25000, total: 178000,
      createdAt: new Date("2026-04-09"),
      items: [
        { productId: productList[4].id, quantity: 1, unitPrice: 89000, total: 89000 },
        { productId: productList[5].id, quantity: 2, unitPrice: 32000, total: 64000 },
      ],
    },
    {
      orderNumber: "ORD-2026-005", status: "ENTREGADO", userId: "user-pedro",
      subtotal: 2100000, shippingCost: 0, total: 2100000,
      createdAt: new Date("2026-04-08"),
      items: [
        { productId: productList[0].id, quantity: 30, unitPrice: 45900, total: 1377000 },
        { productId: productList[6].id, quantity: 15, unitPrice: 28500, total: 427500 },
        { productId: productList[5].id, quantity: 5, unitPrice: 32000, total: 160000 },
      ],
    },
    {
      orderNumber: "ORD-2026-006", status: "CANCELADO", userId: "user-lucia",
      subtotal: 89000, shippingCost: 0, total: 89000,
      createdAt: new Date("2026-04-07"),
      items: [
        { productId: productList[4].id, quantity: 1, unitPrice: 89000, total: 89000 },
      ],
    },
  ];

  for (const orderData of ordersData) {
    const { items, ...orderFields } = orderData;
    await prisma.order.create({
      data: {
        ...orderFields,
        status: orderFields.status as any,
        items: {
          create: items,
        },
      },
    });
  }

  // ─── Summary ────────────────────────────────
  console.log("\n✅ Seed completed successfully!");
  console.log(`   👤 ${8} users created`);
  console.log(`   📂 ${categoriesData.length} categories created`);
  console.log(`   🏷️ ${productsData.length} products created`);
  console.log(`   📐 ${projectsData.length} projects created`);
  console.log(`   🛒 1 cart with 3 items created`);
  console.log(`   📦 ${ordersData.length} orders created`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
