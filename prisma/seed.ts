// ============================================
// Homara — Seed Script (TypeScript - Expanded)
// ============================================

import "dotenv/config";
import { PrismaClient, ProjectType, ProjectStatus, OrderStatus, Category, Product } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding Homara database with extreme data (TS)...\n");

  // ─── Check if already seeded ──────────────
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log("✅ Database already contains data. Skipping seed to prevent data loss.");
    return;
  }

  // ─── Users ──────────────────────────────────
  console.log("👤 Creating 18 users...");

  const defaultPasswordHash = await bcrypt.hash("123456", 10);

  // Demo user
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

  const usersData = [
    { id: "user-carlos", email: "carlos@email.com", password: defaultPasswordHash, firstName: "Carlos", lastName: "Martínez", phone: "310 987 6543", address: "Transversal 5 # 78-90", city: "Medellín", state: "Antioquia", zipCode: "050010", role: "CUSTOMER" },
    { id: "user-maria", email: "maria@email.com", password: defaultPasswordHash, firstName: "María", lastName: "López", phone: "315 456 7890", address: "Avenida 3N # 12-34", city: "Cali", state: "Valle del Cauca", zipCode: "760001", role: "CUSTOMER" },
    { id: "user-juan-r", email: "juanr@email.com", password: defaultPasswordHash, firstName: "Juan", lastName: "Rodríguez", phone: "320 111 2222", address: "Carrera 15 # 100-20", city: "Bogotá", state: "Cundinamarca", zipCode: "110221", role: "CUSTOMER" },
    { id: "user-ana", email: "ana@email.com", password: defaultPasswordHash, firstName: "Ana", lastName: "García", phone: "301 333 4444", address: "Calle 72 # 45-12", city: "Barranquilla", state: "Atlántico", zipCode: "080001", role: "CUSTOMER" },
    { id: "user-pedro", email: "pedro@email.com", password: defaultPasswordHash, firstName: "Pedro", lastName: "Sánchez", phone: "305 555 6666", address: "Calle del Tablón # 34-12", city: "Cartagena", state: "Bolívar", zipCode: "130001", role: "CUSTOMER" },
    { id: "user-lucia", email: "lucia@email.com", password: defaultPasswordHash, firstName: "Lucía", lastName: "Hernández", phone: "312 777 8888", address: "Carrera 27 # 36-45", city: "Bucaramanga", state: "Santander", zipCode: "680002", role: "CUSTOMER" },
    { id: "user-andres", email: "andres@email.com", password: defaultPasswordHash, firstName: "Andrés", lastName: "Castro", phone: "318 888 9999", address: "Carrera 7 # 14-25", city: "Pereira", state: "Risaralda", zipCode: "660001", role: "CUSTOMER" },
    { id: "user-sofia", email: "sofia@email.com", password: defaultPasswordHash, firstName: "Sofía", lastName: "Gómez", phone: "316 222 3333", address: "Calle 50 # 23-10", city: "Manizales", state: "Caldas", zipCode: "170001", role: "CUSTOMER" },
    { id: "user-mateo", email: "mateo@email.com", password: defaultPasswordHash, firstName: "Mateo", lastName: "Herrera", phone: "317 444 5555", address: "Carrera 5 # 32-15", city: "Ibagué", state: "Tolima", zipCode: "730001", role: "CUSTOMER" },
    { id: "user-valentina", email: "valentina@email.com", password: defaultPasswordHash, firstName: "Valentina", lastName: "Ruiz", phone: "311 666 7777", address: "Calle 19 # 24-50", city: "Pasto", state: "Nariño", zipCode: "520001", role: "CUSTOMER" },
    { id: "user-daniel", email: "daniel@email.com", password: defaultPasswordHash, firstName: "Daniel", lastName: "Díaz", phone: "302 888 1111", address: "Avenida 0 # 11-20", city: "Cúcuta", state: "Norte de Santander", zipCode: "540001", role: "CUSTOMER" },
    { id: "user-camila", email: "camila@email.com", password: defaultPasswordHash, firstName: "Camila", lastName: "Silva", phone: "304 999 2222", address: "Carrera 6 # 8-40", city: "Neiva", state: "Huila", zipCode: "410001", role: "CUSTOMER" },
    { id: "user-alejandro", email: "alejandro@email.com", password: defaultPasswordHash, firstName: "Alejandro", lastName: "Muñoz", phone: "313 123 7890", address: "Calle 22 # 4-50", city: "Santa Marta", state: "Magdalena", zipCode: "470001", role: "CUSTOMER" },
    { id: "user-isabella", email: "isabella@email.com", password: defaultPasswordHash, firstName: "Isabella", lastName: "Torres", phone: "321 456 1234", address: "Calle 15 # 33B-20", city: "Villavicencio", state: "Meta", zipCode: "500001", role: "CUSTOMER" },
    { id: "user-nicolas", email: "nicolas@email.com", password: defaultPasswordHash, firstName: "Nicolás", lastName: "Rojas", phone: "322 789 4561", address: "Carrera 9 # 12-40", city: "Valledupar", state: "Cesar", zipCode: "200001", role: "CUSTOMER" },
    { id: "user-gloria", email: "gloria@email.com", password: defaultPasswordHash, firstName: "Gloria", lastName: "Ospina", phone: "323 111 9999", address: "Avenida Bolívar # 10N-40", city: "Armenia", state: "Quindío", zipCode: "630001", role: "CUSTOMER" },
    { id: "admin-001", email: "admin@homara.co", password: defaultPasswordHash, firstName: "Admin", lastName: "Homara", phone: "300 000 0000", address: "Oficinas Centrales Homara", city: "Bogotá", state: "Cundinamarca", zipCode: "110111", role: "ADMIN" },
  ];

  const customers: Record<string, any> = {};
  customers[demoUser.id] = demoUser;
  for (const u of usersData) {
    const user = await prisma.user.create({ data: u });
    customers[user.id] = user;
  }
  const customerIds = Object.keys(customers).filter(id => customers[id].role === "CUSTOMER");

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

  const categories: Record<string, Category> = {};
  for (const cat of categoriesData) {
    categories[cat.slug] = await prisma.category.create({ data: cat });
  }

  // ─── Products ───────────────────────────────
  console.log("🏷️ Creating 65 products...");

  const productsData = [
    // --- PISOS Y CERÁMICAS (16) ---
    { name: "Porcelanato Mármol Carrara 60x60", description: "Acabado pulido brillante ideal para salas y cocinas residenciales.", price: 45900, originalPrice: 52000, image: "/products/porcelanato.jpg", categorySlug: "pisos-ceramicas", rating: 4.8, reviewCount: 234, inStock: true, stockQuantity: 1250, unit: "m²", tags: ["oferta", "popular"] },
    { name: "Cerámica Rústica Terracota 45x45", description: "Especial para exteriores, terrazas y balcones. Textura rugosa.", price: 32000, originalPrice: 36000, image: "/products/rustico.jpg", categorySlug: "pisos-ceramicas", rating: 4.5, reviewCount: 88, inStock: true, stockQuantity: 550, unit: "m²", tags: ["oferta"] },
    { name: "Cerámica Hidráulica Decorativa Flor 30x30", description: "Patrón floral vintage para acentos decorativos en baños y cocinas.", price: 29000, originalPrice: null, image: "/products/hidraulica.jpg", categorySlug: "pisos-ceramicas", rating: 4.6, reviewCount: 64, inStock: true, stockQuantity: 320, unit: "m²", tags: ["nuevo"] },
    { name: "Cerámica Subterráneo Blanco Metro 10x20", description: "Clásica baldosa de cerámica Subway brillante para salpicaderos.", price: 31000, originalPrice: null, image: "/products/metro.jpg", categorySlug: "pisos-ceramicas", rating: 4.9, reviewCount: 198, inStock: true, stockQuantity: 1200, unit: "m²", tags: ["popular"] },
    { name: "Porcelanato Pulido Beige 80x80", description: "Porcelanato rectificado de gran formato. Aporta amplitud y elegancia.", price: 54000, originalPrice: 62000, image: "/products/porcelanato-beige.jpg", categorySlug: "pisos-ceramicas", rating: 4.7, reviewCount: 112, inStock: true, stockQuantity: 750, unit: "m²", tags: ["popular"] },
    { name: "Porcelanato Gris Oxford 100x100", description: "Súper gran formato rectificado con acabado mate texturizado tipo piedra.", price: 65000, originalPrice: null, image: "/products/porcelanato-gris.jpg", categorySlug: "pisos-ceramicas", rating: 4.8, reviewCount: 57, inStock: true, stockQuantity: 400, unit: "m²", tags: ["nuevo"] },
    { name: "Porcelanato Negro Absoluto Satinado 60x60", description: "Acabado negro satinado de alta elegancia para interiores de lujo.", price: 45900, originalPrice: null, image: "/products/porcelanato-negro.jpg", categorySlug: "pisos-ceramicas", rating: 4.4, reviewCount: 42, inStock: true, stockQuantity: 180, unit: "m²", tags: [] },
    { name: "Piso Laminado Madera Nogal Alemán 15x90", description: "Madera laminada de alta densidad con vetas de nogal natural.", price: 51000, originalPrice: 58000, image: "/products/madera-nogal.jpg", categorySlug: "pisos-ceramicas", rating: 4.8, reviewCount: 146, inStock: true, stockQuantity: 620, unit: "m²", tags: ["popular"] },
    { name: "Piso Laminado Teka Resistente al Agua 15x90", description: "Tecnología hidrófuga avanzada para resistir derrames superficiales.", price: 53500, originalPrice: null, image: "/products/madera-teka.jpg", categorySlug: "pisos-ceramicas", rating: 4.6, reviewCount: 78, inStock: true, stockQuantity: 450, unit: "m²", tags: ["nuevo"] },
    { name: "Piso Laminado Haya Clic Acústico 20x60", description: "Madera clara de Haya con sistema Clic y base aislante integrada.", price: 49000, originalPrice: null, image: "/products/madera-haya.jpg", categorySlug: "pisos-ceramicas", rating: 4.5, reviewCount: 39, inStock: true, stockQuantity: 280, unit: "m²", tags: [] },
    { name: "Piso Vinílico SPC Clic Roble Miel 15x90", description: "Vinilo SPC rígido 100% impermeable, ideal para cocinas y áreas húmedas.", price: 28000, originalPrice: 32000, image: "/products/vinilo-roble.jpg", categorySlug: "pisos-ceramicas", rating: 4.7, reviewCount: 95, inStock: true, stockQuantity: 880, unit: "m²", tags: ["popular"] },
    { name: "Piso Vinílico Autoadhesivo Gris Cenizo 20x60", description: "Lamas autoadhesivas de fácil instalación para renovación rápida.", price: 26000, originalPrice: null, image: "/products/vinilo-gris.jpg", categorySlug: "pisos-ceramicas", rating: 4.3, reviewCount: 110, inStock: true, stockQuantity: 950, unit: "m²", tags: ["oferta"] },
    { name: "Porcelanato Líquido Epóxico Cristalino 1 Galón", description: "Recubrimiento epóxico autonivelante ultra brillante y transparente.", price: 185000, originalPrice: 210000, image: "/products/epoxico.jpg", categorySlug: "pisos-ceramicas", rating: 4.8, reviewCount: 42, inStock: true, stockQuantity: 95, unit: "unidad", tags: ["oferta"] },
    { name: "Cerámica Fachaleta Piedra Gris 30x60", description: "Revestimiento cerámico estructurado tipo fachaleta de piedra natural.", price: 34900, originalPrice: null, image: "/products/fachaleta.jpg", categorySlug: "pisos-ceramicas", rating: 4.5, reviewCount: 29, inStock: true, stockQuantity: 480, unit: "m²", tags: ["nuevo"] },
    { name: "Zócalo Poliestireno Blanco 7cm x 2.4m", description: "Guardaescobas de poliestireno expandido, 100% resistente al agua.", price: 29900, originalPrice: null, image: "/products/zocalo.html", categorySlug: "pisos-ceramicas", rating: 4.6, reviewCount: 68, inStock: true, stockQuantity: 340, unit: "unidad", tags: [] },
    { name: "Piso Laminado Roble Gris Oscuro 8mm", description: "Madera laminada con bisel perimetral de alta resistencia al tráfico doméstico.", price: 48900, originalPrice: 54000, image: "/products/laminado-gris.jpg", categorySlug: "pisos-ceramicas", rating: 4.4, reviewCount: 51, inStock: true, stockQuantity: 390, unit: "m²", tags: ["oferta"] },
    { name: "Porcelanato Esmaltado Gris 60x60", description: "Porcelanato esmaltado mate en color gris neutro para tráficos moderados.", price: 42900, originalPrice: null, image: "/products/porcelanato-esm-gris.jpg", categorySlug: "pisos-ceramicas", rating: 4.5, reviewCount: 22, inStock: true, stockQuantity: 500, unit: "m²", tags: [] },
    { name: "Cerámica Antideslizante Piedra 33x33", description: "Baldosa rústica antideslizante para parqueaderos y patios.", price: 29900, originalPrice: 34000, image: "/products/baldosa-antides.jpg", categorySlug: "pisos-ceramicas", rating: 4.6, reviewCount: 33, inStock: true, stockQuantity: 650, unit: "m²", tags: ["oferta"] },
    { name: "Porcelanato Rectificado Caoba 20x120", description: "Gran formato en listones que imita perfectamente la madera de caoba.", price: 59900, originalPrice: null, image: "/products/porcelanato-caoba.jpg", categorySlug: "pisos-ceramicas", rating: 4.8, reviewCount: 19, inStock: true, stockQuantity: 420, unit: "m²", tags: ["nuevo"] },

    // --- HERRAMIENTAS (11) ---
    { name: "Taladro Percutor Inalámbrico 20V", description: "Motor brushless, incluye 2 baterías de litio, cargador y maletín.", price: 289000, originalPrice: null, image: "/products/taladro.jpg", categorySlug: "herramientas", rating: 4.9, reviewCount: 567, inStock: true, stockQuantity: 89, unit: "unidad", tags: ["popular", "nuevo"] },
    { name: "Rodillo de Pintura Antigoteo 23cm", description: "Felpa de microfibra, sistema antigoteo y mango ergonómico extensible.", price: 34500, originalPrice: null, image: "/products/rodillo.jpg", categorySlug: "herramientas", rating: 4.2, reviewCount: 256, inStock: true, stockQuantity: 678, unit: "unidad", tags: [] },
    { name: "Sierra Circular 7-1/4\" 1800W", description: "Sierra profesional con guía láser y ajuste de profundidad.", price: 375000, originalPrice: null, image: "/products/sierra.jpg", categorySlug: "herramientas", rating: 4.8, reviewCount: 203, inStock: true, stockQuantity: 34, unit: "unidad", tags: ["popular"] },
    { name: "Taladro DeWalt 1/2' 800W Cable", description: "Taladro percutor Dewalt con cable, mandril metálico y velocidad variable.", price: 425000, originalPrice: 489000, image: "/products/taladro-dewalt.jpg", categorySlug: "herramientas", rating: 4.9, reviewCount: 178, inStock: true, stockQuantity: 45, unit: "unidad", tags: ["oferta", "popular"] },
    { name: "Cortadora de Baldosa Rubí 60cm", description: "Guías de acero macizo y rodel de carburo de tungsteno para cortes rectos.", price: 179000, originalPrice: null, image: "/products/cortadora.jpg", categorySlug: "herramientas", rating: 4.7, reviewCount: 38, inStock: true, stockQuantity: 28, unit: "unidad", tags: [] },
    { name: "Nivel Láser Autonivelante 3 Líneas", description: "Líneas cruzadas verdes de alta visibilidad, rango de hasta 30m.", price: 345000, originalPrice: 399000, image: "/products/nivel-laser.jpg", categorySlug: "herramientas", rating: 4.8, reviewCount: 46, inStock: true, stockQuantity: 22, unit: "unidad", tags: ["oferta", "nuevo"] },
    { name: "Destornilladores Tramontina 6 Pzas", description: "Acero cromo vanadio, mangos ergonómicos. Puntas de estrella y planas.", price: 24900, originalPrice: null, image: "/products/destornilladores.jpg", categorySlug: "herramientas", rating: 4.3, reviewCount: 104, inStock: true, stockQuantity: 150, unit: "unidad", tags: [] },
    { name: "Llana Metálica Dentada 10x10mm", description: "Llana de acero dentada ideal para aplicar pegante cerámico flexible.", price: 14500, originalPrice: null, image: "/products/llana.jpg", categorySlug: "herramientas", rating: 4.5, reviewCount: 112, inStock: true, stockQuantity: 300, unit: "unidad", tags: ["popular"] },
    { name: "Mazo de Goma Blanca 16oz Enchapes", description: "No mancha ni raya las baldosas durante la nivelación y asentamiento.", price: 18900, originalPrice: null, image: "/products/mazo.jpg", categorySlug: "herramientas", rating: 4.6, reviewCount: 84, inStock: true, stockQuantity: 120, unit: "unidad", tags: [] },
    { name: "Esmeriladora Angular 4-1/2\" 800W", description: "Ideal para corte y desbaste de metal y baldosas cerámicas.", price: 189000, originalPrice: 219000, image: "/products/esmeriladora.jpg", categorySlug: "herramientas", rating: 4.6, reviewCount: 51, inStock: true, stockQuantity: 60, unit: "unidad", tags: ["oferta"] },
    { name: "Martillo de Uña 16oz Fibra Vidrio", description: "Cabeza de acero forjado y mango amortiguador de golpes en fibra de vidrio.", price: 28900, originalPrice: null, image: "/products/martillo.jpg", categorySlug: "herramientas", rating: 4.4, reviewCount: 92, inStock: true, stockQuantity: 180, unit: "unidad", tags: [] },

    // --- PINTURAS (10) ---
    { name: "Pintura Interior Premium Blanco 5L", description: "Mate, máximo cubrimiento y lavabilidad. Bajo olor, secado rápido.", price: 125000, originalPrice: 148000, image: "/products/pintura.jpg", categorySlug: "pinturas", rating: 4.6, reviewCount: 189, inStock: true, stockQuantity: 340, unit: "galón", tags: ["oferta"] },
    { name: "Pintura Exterior Gris Fósil 5L", description: "Máxima resistencia a la intemperie, tecnología antihongos y protección UV.", price: 135000, originalPrice: null, image: "/products/pintura-gris.jpg", categorySlug: "pinturas", rating: 4.7, reviewCount: 75, inStock: true, stockQuantity: 180, unit: "galón", tags: [] },
    { name: "Pintura Satinada Beige Arena 5L", description: "Acabado satinado lavable para eliminar manchas con un paño húmedo.", price: 128000, originalPrice: 145000, image: "/products/pintura-beige.jpg", categorySlug: "pinturas", rating: 4.5, reviewCount: 92, inStock: true, stockQuantity: 240, unit: "galón", tags: ["oferta"] },
    { name: "Pintura Koraza Caneca 5 Galones", description: "Pintura para exteriores impermeabilizante, marca Pintuco de alto rendimiento.", price: 549000, originalPrice: 629000, image: "/products/koraza-caneca.jpg", categorySlug: "pinturas", rating: 4.9, reviewCount: 135, inStock: true, stockQuantity: 65, unit: "unidad", tags: ["oferta", "popular"] },
    { name: "Esmalte Sintético Corona Blanco 1G", description: "Protección anticorrosiva y decorativa para superficies de metal y madera.", price: 56900, originalPrice: null, image: "/products/esmalte.jpg", categorySlug: "pinturas", rating: 4.4, reviewCount: 47, inStock: true, stockQuantity: 140, unit: "galón", tags: [] },
    { name: "Imprimante Sellador de Muros 1G", description: "Disminuye la absorción de muros nuevos y optimiza el rendimiento de la pintura.", price: 45000, originalPrice: null, image: "/products/imprimante.jpg", categorySlug: "pinturas", rating: 4.5, reviewCount: 32, inStock: true, stockQuantity: 90, unit: "galón", tags: ["nuevo"] },
    { name: "Pintura de Tablero Negro Tiza 1G", description: "Convierte cualquier pared en un tablero lavable para escribir con tiza.", price: 62000, originalPrice: null, image: "/products/pintura-tablero.jpg", categorySlug: "pinturas", rating: 4.6, reviewCount: 19, inStock: true, stockQuantity: 40, unit: "galón", tags: [] },
    { name: "Pintura Epóxica para Pisos Caneca 1G", description: "Alta resistencia al desgaste e hidrocarburos. Ideal para garajes y talleres.", price: 149000, originalPrice: 169000, image: "/products/pintura-epoxica.jpg", categorySlug: "pinturas", rating: 4.7, reviewCount: 14, inStock: true, stockQuantity: 30, unit: "galón", tags: ["oferta"] },
    { name: "Brocha Profesional Natural 3\"", description: "Cerdas naturales extra suaves para acabados finos y aplicación uniforme.", price: 12900, originalPrice: null, image: "/products/brocha-3.jpg", categorySlug: "pinturas", rating: 4.3, reviewCount: 102, inStock: true, stockQuantity: 400, unit: "unidad", tags: ["popular"] },
    { name: "Cinta de Enmascarar Pintor 1\" x 50m", description: "Cinta de papel kraft autoadhesiva, remoción limpia sin dejar residuos.", price: 8900, originalPrice: null, image: "/products/cinta-enmascarar.jpg", categorySlug: "pinturas", rating: 4.4, reviewCount: 77, inStock: true, stockQuantity: 800, unit: "unidad", tags: [] },

    // --- MUEBLES (8) ---
    { name: "Escritorio Nórdico Madera Natural", description: "Madera de pino con acabado natural y patas metálicas negras. Estilo minimalista.", price: 459000, originalPrice: null, image: "/products/escritorio.jpg", categorySlug: "muebles", rating: 4.7, reviewCount: 98, inStock: true, stockQuantity: 24, unit: "unidad", tags: ["nuevo"] },
    { name: "Estantería Metálica 5 Niveles", description: "Capacidad de 175kg por nivel, acabado en negro. Ensamble sin herramientas.", price: 219000, originalPrice: null, image: "/products/estanteria.jpg", categorySlug: "muebles", rating: 4.5, reviewCount: 134, inStock: false, stockQuantity: 0, unit: "unidad", tags: [] },
    { name: "Gabinete Espejo de Baño Blanco", description: "Organizador flotante con repisas interiores. Inmune a la humedad y vapor.", price: 159000, originalPrice: 189000, image: "/products/gabinete-espejo.jpg", categorySlug: "muebles", rating: 4.7, reviewCount: 88, inStock: true, stockQuantity: 34, unit: "unidad", tags: ["oferta"] },
    { name: "Mesa Auxiliar de Baño Con Cajón", description: "Madera lacada blanca, cuenta con un cajón y repisas inferiores amplias.", price: 189000, originalPrice: null, image: "/products/mesa-auxiliar.jpg", categorySlug: "muebles", rating: 4.3, reviewCount: 22, inStock: true, stockQuantity: 15, unit: "unidad", tags: ["nuevo"] },
    { name: "Organizador Modular Herramientas", description: "Caja organizadora con gavetas plásticas transparentes. Apilable y colgable.", price: 89000, originalPrice: null, image: "/products/organizador.jpg", categorySlug: "muebles", rating: 4.4, reviewCount: 54, inStock: true, stockQuantity: 75, unit: "unidad", tags: [] },
    { name: "Mueble Lavamanos Flotante 60cm", description: "Gabinete moderno en melamina RH resistente al agua, incluye lavamanos de cerámica.", price: 329000, originalPrice: 379000, image: "/products/mueble-lavamanos.jpg", categorySlug: "muebles", rating: 4.6, reviewCount: 41, inStock: true, stockQuantity: 18, unit: "unidad", tags: ["oferta"] },
    { name: "Alacena Auxiliar de Cocina Blanca", description: "Diseño vertical con múltiples compartimientos y espacio para microondas.", price: 419000, originalPrice: null, image: "/products/alacena.jpg", categorySlug: "muebles", rating: 4.5, reviewCount: 30, inStock: true, stockQuantity: 10, unit: "unidad", tags: [] },
    { name: "Silla de Escritorio Ergonómica", description: "Apoyabrazos ajustables, soporte lumbar, malla antitranspirante y ruedas de nylon.", price: 249000, originalPrice: 289000, image: "/products/silla-ergo.jpg", categorySlug: "muebles", rating: 4.7, reviewCount: 84, inStock: true, stockQuantity: 25, unit: "unidad", tags: ["oferta", "popular"] },

    // --- ILUMINACIÓN (8) ---
    { name: "Panel LED Slim 60x60 40W Luz Día", description: "Panel LED ultradelgado empotrable. Ideal para oficinas y cocinas.", price: 89000, originalPrice: null, image: "/products/panel-led.jpg", categorySlug: "iluminacion", rating: 4.5, reviewCount: 145, inStock: true, stockQuantity: 567, unit: "unidad", tags: [] },
    { name: "Lámpara Colgante Industrial Negro", description: "Lámpara de estilo industrial, cable ajustable 1.5m. Boquilla E27.", price: 145000, originalPrice: 175000, image: "/products/lampara.jpg", categorySlug: "iluminacion", rating: 4.6, reviewCount: 67, inStock: true, stockQuantity: 45, unit: "unidad", tags: ["oferta"] },
    { name: "Bombillo LED Inteligente RGB 9W", description: "Conexión Wi-Fi, control por voz compatible con Alexa y Google Home.", price: 39900, originalPrice: null, image: "/products/bombillo-rgb.jpg", categorySlug: "iluminacion", rating: 4.8, reviewCount: 120, inStock: true, stockQuantity: 310, unit: "unidad", tags: ["popular"] },
    { name: "Reflector LED Exterior 50W IP65", description: "Reflector de luz fría hermético contra lluvia y polvo con soporte metálico.", price: 58900, originalPrice: 69900, image: "/products/reflector.jpg", categorySlug: "iluminacion", rating: 4.6, reviewCount: 85, inStock: true, stockQuantity: 190, unit: "unidad", tags: ["oferta"] },
    { name: "Cinta LED Adhesiva RGB 5 Metros", description: "Cinta LED flexible con control remoto, transformador y adhesivo 3M.", price: 49900, originalPrice: null, image: "/products/cinta-led.jpg", categorySlug: "iluminacion", rating: 4.5, reviewCount: 165, inStock: true, stockQuantity: 250, unit: "unidad", tags: ["nuevo"] },
    { name: "Plafón LED 24W Redondo Sobreponer", description: "Luz blanca fría 6500K, fácil instalación en techos de concreto o drywall.", price: 49900, originalPrice: null, image: "/products/plafon-led.jpg", categorySlug: "iluminacion", rating: 4.6, reviewCount: 99, inStock: true, stockQuantity: 320, unit: "unidad", tags: [] },
    { name: "Aplique Exterior Bidireccional Negro", description: "Luminaria de pared con doble salida de luz superior e inferior. Resistente a lluvia.", price: 65000, originalPrice: 79900, image: "/products/aplique-ext.jpg", categorySlug: "iluminacion", rating: 4.5, reviewCount: 43, inStock: true, stockQuantity: 110, unit: "unidad", tags: ["oferta"] },
    { name: "Sensor Movimiento Infrarrojo Techo", description: "Ahorra energía encendiendo las luces únicamente al detectar presencia. Rango 360°.", price: 34900, originalPrice: null, image: "/products/sensor.jpg", categorySlug: "iluminacion", rating: 4.4, reviewCount: 28, inStock: true, stockQuantity: 150, unit: "unidad", tags: ["nuevo"] },

    // --- MATERIALES DE CONSTRUCCIÓN (12) ---
    { name: "Cemento Gris General 50kg", description: "Cemento Portland de alta resistencia y fraguado uniforme para obras estructuradas.", price: 32000, originalPrice: null, image: "/products/cemento.jpg", categorySlug: "materiales-construccion", rating: 4.4, reviewCount: 890, inStock: true, stockQuantity: 2340, unit: "bulto", tags: ["popular"] },
    { name: "Pegante Cerámico Flexible 25kg", description: "Pegante de alta adherencia y flexibilidad para cerámicas y porcelanatos.", price: 28500, originalPrice: null, image: "/products/pegante.jpg", categorySlug: "materiales-construccion", rating: 4.3, reviewCount: 412, inStock: true, stockQuantity: 1890, unit: "bulto", tags: [] },
    { name: "Cemento Blanco Argos 40kg", description: "Cemento blanco de alta blancura para acabados estéticos y morteros decorativos.", price: 49900, originalPrice: null, image: "/products/cemento-blanco.jpg", categorySlug: "materiales-construccion", rating: 4.7, reviewCount: 220, inStock: true, stockQuantity: 650, unit: "bulto", tags: ["popular"] },
    { name: "Boquilla Impermeable Gris 2kg", description: "Boquilla cementicia con aditivo de látex antihongos para juntas de 1 a 6mm.", price: 15500, originalPrice: null, image: "/products/boquilla.jpg", categorySlug: "materiales-construccion", rating: 4.5, reviewCount: 310, inStock: true, stockQuantity: 1400, unit: "unidad", tags: ["popular"] },
    { name: "Bolsa Crucetas Niveladoras 2mm", description: "Separadores plásticos para juntas simétricas y nivelación perfecta (100 und).", price: 9900, originalPrice: null, image: "/products/crucetas.jpg", categorySlug: "materiales-construccion", rating: 4.6, reviewCount: 420, inStock: true, stockQuantity: 2800, unit: "unidad", tags: [] },
    { name: "Yeso Fraguado Rápido 10kg", description: "Yeso para revoques interiores, resanes y molduras decorativas. Secado rápido.", price: 14900, originalPrice: null, image: "/products/yeso.jpg", categorySlug: "materiales-construccion", rating: 4.3, reviewCount: 98, inStock: true, stockQuantity: 340, unit: "unidad", tags: [] },
    { name: "Alambre de Amarre Negro 1 kg", description: "Alambre calibre 18 de acero recocido para amarre de armaduras de refuerzo.", price: 12500, originalPrice: null, image: "/products/alambre.jpg", categorySlug: "materiales-construccion", rating: 4.2, reviewCount: 145, inStock: true, stockQuantity: 800, unit: "unidad", tags: [] },
    { name: "Cal Hidratada de Obra 10kg", description: "Cal fina de alta pureza para preparación de morteros, revoques y estabilización.", price: 8900, originalPrice: null, image: "/products/cal-hidratada.jpg", categorySlug: "materiales-construccion", rating: 4.2, reviewCount: 54, inStock: true, stockQuantity: 400, unit: "unidad", tags: [] },
    { name: "Mezcla Lista Concreto Seco 40kg", description: "Preparado de cemento y agregados dosificados. Solo agregue agua y mezcle.", price: 19900, originalPrice: null, image: "/products/concreto-seco.jpg", categorySlug: "materiales-construccion", rating: 4.4, reviewCount: 72, inStock: true, stockQuantity: 900, unit: "unidad", tags: [] },
    { name: "Varilla Corrugada Acero 1/2\" x 6m", description: "Refuerzo de acero corrugado de alta resistencia para estructuras de concreto.", price: 24900, originalPrice: 28000, image: "/products/varilla-acero.jpg", categorySlug: "materiales-construccion", rating: 4.5, reviewCount: 115, inStock: true, stockQuantity: 1200, unit: "unidad", tags: ["oferta"] },
    { name: "Arena Lavada Bolsa 25kg", description: "Arena de río lavada y clasificada para mezclas de concreto y pega de ladrillos.", price: 7900, originalPrice: null, image: "/products/arena.jpg", categorySlug: "materiales-construccion", rating: 4.3, reviewCount: 88, inStock: true, stockQuantity: 1500, unit: "unidad", tags: [] },
    { name: "Grava de Construcción 25kg", description: "Triturado gris clasificado de 1/2 pulgada para preparación de concreto estructural.", price: 8500, originalPrice: null, image: "/products/grava.jpg", categorySlug: "materiales-construccion", rating: 4.4, reviewCount: 65, inStock: true, stockQuantity: 1100, unit: "unidad", tags: [] }
  ];

  const products: Record<string, Product> = {};
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
  console.log("📐 Creating 12 projects...");

  const projectsData = [
    { userId: "user-carlos", name: "Remodelación Sala Principal", type: "PISO", status: "EN_PROGRESO", area: 35, createdAt: new Date("2026-03-15"), thumbnail: "🏠", materials: [
        { name: "Porcelanato Carrara 60x60", quantity: "39 m²", note: "+10% de desperdicio", icon: "🏗️", price: 45900 * 39 },
        { name: "Pegante cerámico flexible", quantity: "8 bultos", note: "25kg c/u", icon: "🧱", price: 28500 * 8 },
        { name: "Boquilla Impermeable", quantity: "4 kg", note: null, icon: "🪣", price: 15500 * 2 },
        { name: "Crucetas 2mm", quantity: "2 bolsas", note: "100 unidades c/u", icon: "➕", price: 9900 * 2 },
      ]
    },
    { userId: "user-maria", name: "Baño Master - Enchape completo", type: "PARED", status: "COMPLETADO", area: 18, createdAt: new Date("2026-02-20"), thumbnail: "🚿", materials: [
        { name: "Cerámica Subway Blanco Metro", quantity: "20 m²", note: "+10% de desperdicio", icon: "🏗️", price: 31000 * 20 },
        { name: "Pegante cerámico flexible", quantity: "5 bultos", note: "25kg c/u", icon: "🧱", price: 28500 * 5 },
        { name: "Boquilla Impermeable", quantity: "3 kg", note: null, icon: "🪣", price: 15500 * 2 },
        { name: "Crucetas 2mm", quantity: "2 bolsas", note: "100 unidades c/u", icon: "➕", price: 9900 * 2 },
      ]
    },
    { userId: "user-juan-r", name: "Cocina Integral - Piso nuevo", type: "PISO", status: "EN_PROGRESO", area: 22, createdAt: new Date("2026-04-01"), thumbnail: "🍳", materials: [
        { name: "Porcelanato Pulido Beige 80x80", quantity: "25 m²", note: "+10% de desperdicio", icon: "🏗️", price: 54000 * 25 },
        { name: "Pegante cerámico", quantity: "6 bultos", note: "25kg c/u", icon: "🧱", price: 28500 * 6 },
        { name: "Boquilla Impermeable", quantity: "3 kg", note: null, icon: "🪣", price: 15500 * 2 },
      ]
    },
    { userId: "user-pedro", name: "Terraza - Recubrimiento exterior", type: "PISO", status: "PAUSADO", area: 40, createdAt: new Date("2026-01-10"), thumbnail: "🌿", materials: [
        { name: "Cerámica Rústica Terracota 45x45", quantity: "44 m²", note: "+10% de desperdicio", icon: "🏗️", price: 32000 * 44 },
        { name: "Pegante cerámico", quantity: "10 bultos", note: "25kg c/u", icon: "🧱", price: 28500 * 10 },
        { name: "Crucetas 2mm", quantity: "3 bolsas", note: "100 unidades c/u", icon: "➕", price: 9900 * 3 },
      ]
    },
    { userId: "user-ana", name: "Pintura Fachada Principal", type: "PARED", status: "EN_PROGRESO", area: 45, createdAt: new Date("2026-05-18"), thumbnail: "🎨", materials: [
        { name: "Pintura Koraza 5 Galones", quantity: "2 unidades", note: "Alto rendimiento exterior", icon: "🎨", price: 549000 * 2 },
        { name: "Rodillo Antigoteo 23cm", quantity: "2 unidades", note: null, icon: "🖌️", price: 34500 * 2 },
        { name: "Cinta de Enmascarar 1\"", quantity: "3 unidades", note: null, icon: "🎗️", price: 8900 * 3 },
      ]
    },
    { userId: "user-lucia", name: "Habitación Principal - Piso Laminado", type: "PISO", status: "COMPLETADO", area: 20, createdAt: new Date("2026-04-10"), thumbnail: "🛏️", materials: [
        { name: "Piso Laminado Madera Nogal", quantity: "22 m²", note: "+10% desperdicio", icon: "🏗️", price: 51000 * 22 },
        { name: "Zócalo Poliestireno Blanco", quantity: "10 unidades", note: "Tiras de 2.4m", icon: "📐", price: 29900 * 10 },
      ]
    },
    { userId: "user-andres", name: "Estudio - Iluminación y Pintura", type: "INTEGRAL", status: "PAUSADO", area: 15, createdAt: new Date("2026-03-20"), thumbnail: "📚", materials: [
        { name: "Pintura Interior Premium Blanco 5L", quantity: "1 galón", note: null, icon: "🎨", price: 125000 },
        { name: "Panel LED Slim Luz Día", quantity: "4 unidades", note: null, icon: "💡", price: 89000 * 4 },
        { name: "Cinta LED RGB 5 Metros", quantity: "1 unidad", note: null, icon: "💡", price: 49900 },
      ]
    },
    { userId: "user-sofia", name: "Techo Local Comercial", type: "TECHO", status: "EN_PROGRESO", area: 80, createdAt: new Date("2026-05-02"), thumbnail: "🏢", materials: [
        { name: "Plafón LED 24W Redondo", quantity: "16 unidades", note: null, icon: "💡", price: 49900 * 16 },
        { name: "Yeso Fraguado Rápido", quantity: "4 unidades", note: null, icon: "🧱", price: 14900 * 4 },
      ]
    },
    { userId: "user-mateo", name: "Muros Patio Trasero", type: "PARED", status: "EN_PROGRESO", area: 25, createdAt: new Date("2026-05-20"), thumbnail: "🧱", materials: [
        { name: "Cemento Blanco Argos 40kg", quantity: "5 bultos", note: null, icon: "🧱", price: 49900 * 5 },
        { name: "Grava de Construcción 25kg", quantity: "10 unidades", note: null, icon: "🧱", price: 8500 * 10 },
      ]
    },
    { userId: "user-valentina", name: "Remodelación Apartamento", type: "INTEGRAL", status: "EN_PROGRESO", area: 65, createdAt: new Date("2026-05-24"), thumbnail: "🏢", materials: [
        { name: "Porcelanato Carrara 60x60", quantity: "72 m²", note: null, icon: "🏗️", price: 45900 * 72 },
        { name: "Pegante Cerámico Flexible", quantity: "18 bultos", note: null, icon: "🧱", price: 28500 * 18 },
      ]
    },
    { userId: "user-daniel", name: "Estacionamiento Residencial", type: "PISO", status: "COMPLETADO", area: 50, createdAt: new Date("2026-04-12"), thumbnail: "🚗", materials: [
        { name: "Cerámica Antideslizante Piedra", quantity: "55 m²", note: null, icon: "🏗️", price: 29900 * 55 },
        { name: "Cemento Gris General 50kg", quantity: "12 bultos", note: null, icon: "🧱", price: 32000 * 12 },
      ]
    },
    { userId: "user-camila", name: "Salón de Reuniones", type: "TECHO", status: "PAUSADO", area: 38, createdAt: new Date("2026-05-30"), thumbnail: "🚪", materials: [
        { name: "Panel LED Slim 40W", quantity: "8 unidades", note: null, icon: "💡", price: 89000 * 8 },
      ]
    }
  ];

  for (const proj of projectsData) {
    const estimatedCost = proj.materials.reduce((sum, m) => sum + m.price, 0);
    await prisma.project.create({
      data: {
        name: proj.name,
        type: proj.type as ProjectType,
        status: proj.status as ProjectStatus,
        area: proj.area,
        createdAt: proj.createdAt,
        thumbnail: proj.thumbnail,
        estimatedCost,
        userId: proj.userId,
        materials: {
          create: proj.materials,
        },
      },
    });
  }

  // ─── Carts ───────────────────────────────────
  console.log("🛒 Creating active carts...");
  const cartOwners = ["demo-user-001", "user-carlos", "user-maria", "user-juan-r", "user-ana"];
  for (const ownerId of cartOwners) {
    const idx1 = Math.floor(Math.random() * productList.length);
    let idx2 = Math.floor(Math.random() * productList.length);
    while (idx2 === idx1) {
      idx2 = Math.floor(Math.random() * productList.length);
    }
    await prisma.cart.create({
      data: {
        userId: ownerId,
        items: {
          create: [
            { productId: productList[idx1].id, quantity: Math.floor(Math.random() * 5) + 1 },
            { productId: productList[idx2].id, quantity: Math.floor(Math.random() * 2) + 1 },
          ]
        }
      }
    });
  }

  // ─── Orders ─────────────────────────────────
  console.log("📦 Creating 36 orders distributed across 2026...");

  // We define 36 orders distributed by date.
  // Month 0: Enero
  // Month 1: Febrero
  // Month 2: Marzo
  // Month 3: Abril
  // Month 4: Mayo
  // Month 5: Junio
  const ordersData = [
    // --- ENERO (3 Entregas = ~$2.5M) ---
    {
      orderNumber: "ORD-2026-001", status: "ENTREGADO", userId: "user-carlos",
      subtotal: 918000, shippingCost: 0, total: 918000, createdAt: new Date("2026-01-10"),
      items: [{ productId: products["Escritorio Nórdico Madera Natural"].id, quantity: 2, unitPrice: 459000, total: 918000 }]
    },
    {
      orderNumber: "ORD-2026-002", status: "ENTREGADO", userId: "user-maria",
      subtotal: 750000, shippingCost: 50000, total: 800000, createdAt: new Date("2026-01-15"),
      items: [{ productId: products["Sierra Circular 7-1/4\" 1800W"].id, quantity: 2, unitPrice: 375000, total: 750000 }]
    },
    {
      orderNumber: "ORD-2026-003", status: "ENTREGADO", userId: "user-juan-r",
      subtotal: 782000, shippingCost: 0, total: 782000, createdAt: new Date("2026-01-22"),
      items: [
        { productId: products["Taladro DeWalt 1/2' 800W Cable"].id, quantity: 1, unitPrice: 425000, total: 425000 },
        { productId: products["Nivel Láser Autonivelante 3 Líneas"].id, quantity: 1, unitPrice: 345000, total: 345000 },
        { productId: products["Mazo de Goma Blanca 16oz Enchapes"].id, quantity: 1, unitPrice: 18900, total: 18900 }
      ]
    },

    // --- FEBRERO (3 Entregas = ~$3.8M) ---
    {
      orderNumber: "ORD-2026-004", status: "ENTREGADO", userId: "user-ana",
      subtotal: 1377000, shippingCost: 23000, total: 1400000, createdAt: new Date("2026-02-05"),
      items: [{ productId: products["Porcelanato Mármol Carrara 60x60"].id, quantity: 30, unitPrice: 45900, total: 1377000 }]
    },
    {
      orderNumber: "ORD-2026-005", status: "ENTREGADO", userId: "user-pedro",
      subtotal: 1125000, shippingCost: 0, total: 1125000, createdAt: new Date("2026-02-14"),
      items: [{ productId: products["Sierra Circular 7-1/4\" 1800W"].id, quantity: 3, unitPrice: 375000, total: 1125000 }]
    },
    {
      orderNumber: "ORD-2026-006", status: "ENTREGADO", userId: "user-lucia",
      subtotal: 1250000, shippingCost: 25000, total: 1275000, createdAt: new Date("2026-02-23"),
      items: [
        { productId: products["Pintura Interior Premium Blanco 5L"].id, quantity: 6, unitPrice: 125000, total: 750000 },
        { productId: products["Pintura Satinada Beige Arena 5L"].id, quantity: 3, unitPrice: 128000, total: 384000 },
        { productId: products["Cinta de Enmascarar Pintor 1\" x 50m"].id, quantity: 10, unitPrice: 8900, total: 89000 }
      ]
    },

    // --- MARZO (3 Entregas = ~$3.0M + 2 Cancelados) ---
    {
      orderNumber: "ORD-2026-007", status: "ENTREGADO", userId: "user-andres",
      subtotal: 1080000, shippingCost: 0, total: 1080000, createdAt: new Date("2026-03-04"),
      items: [{ productId: products["Porcelanato Pulido Beige 80x80"].id, quantity: 20, unitPrice: 54000, total: 1080000 }]
    },
    {
      orderNumber: "ORD-2026-008", status: "ENTREGADO", userId: "user-sofia",
      subtotal: 998000, shippingCost: 20000, total: 1018000, createdAt: new Date("2026-03-12"),
      items: [
        { productId: products["Alacena Auxiliar de Cocina Blanca"].id, quantity: 2, unitPrice: 419000, total: 838000 },
        { productId: products["Gabinete Espejo de Baño Blanco"].id, quantity: 1, unitPrice: 159000, total: 159000 }
      ]
    },
    {
      orderNumber: "ORD-2026-009", status: "ENTREGADO", userId: "user-mateo",
      subtotal: 890000, shippingCost: 10000, total: 900000, createdAt: new Date("2026-03-18"),
      items: [{ productId: products["Panel LED Slim 60x60 40W Luz Día"].id, quantity: 10, unitPrice: 89000, total: 890000 }]
    },
    {
      orderNumber: "ORD-2026-010", status: "CANCELADO", userId: "user-valentina",
      subtotal: 375000, shippingCost: 0, total: 375000, createdAt: new Date("2026-03-20"),
      items: [{ productId: products["Sierra Circular 7-1/4\" 1800W"].id, quantity: 1, unitPrice: 375000, total: 375000 }]
    },
    {
      orderNumber: "ORD-2026-011", status: "CANCELADO", userId: "user-daniel",
      subtotal: 459000, shippingCost: 0, total: 459000, createdAt: new Date("2026-03-25"),
      items: [{ productId: products["Escritorio Nórdico Madera Natural"].id, quantity: 1, unitPrice: 459000, total: 459000 }]
    },

    // --- ABRIL (4 Entregas = ~$4.5M + 1 Pendiente) ---
    {
      orderNumber: "ORD-2026-012", status: "ENTREGADO", userId: "user-camila",
      subtotal: 1377000, shippingCost: 23000, total: 1400000, createdAt: new Date("2026-04-03"),
      items: [{ productId: products["Porcelanato Mármol Carrara 60x60"].id, quantity: 30, unitPrice: 45900, total: 1377000 }]
    },
    {
      orderNumber: "ORD-2026-013", status: "ENTREGADO", userId: "user-alejandro",
      subtotal: 1098000, shippingCost: 0, total: 1098000, createdAt: new Date("2026-04-10"),
      items: [
        { productId: products["Piso Laminado Madera Nogal Alemán 15x90"].id, quantity: 20, unitPrice: 51000, total: 1020000 },
        { productId: products["Zócalo Poliestireno Blanco 7cm x 2.4m"].id, quantity: 2, unitPrice: 29900, total: 59800 }
      ]
    },
    {
      orderNumber: "ORD-2026-014", status: "ENTREGADO", userId: "user-isabella",
      subtotal: 1098000, shippingCost: 20000, total: 1118000, createdAt: new Date("2026-04-18"),
      items: [
        { productId: products["Pintura Koraza Caneca 5 Galones"].id, quantity: 2, unitPrice: 549000, total: 1098000 }
      ]
    },
    {
      orderNumber: "ORD-2026-015", status: "ENTREGADO", userId: "user-nicolas",
      subtotal: 867000, shippingCost: 15000, total: 882000, createdAt: new Date("2026-04-24"),
      items: [
        { productId: products["Taladro Percutor Inalámbrico 20V"].id, quantity: 3, unitPrice: 289000, total: 867000 }
      ]
    },
    {
      orderNumber: "ORD-2026-016", status: "PENDIENTE", userId: "user-gloria",
      subtotal: 459000, shippingCost: 25000, total: 484000, createdAt: new Date("2026-04-28"),
      items: [{ productId: products["Escritorio Nórdico Madera Natural"].id, quantity: 1, unitPrice: 459000, total: 459000 }]
    },

    // --- MAYO (4 Entregas = ~$5.2M + 2 Procesando + 1 Cancelado) ---
    {
      orderNumber: "ORD-2026-017", status: "ENTREGADO", userId: "user-carlos",
      subtotal: 1836000, shippingCost: 14000, total: 1850000, createdAt: new Date("2026-05-02"),
      items: [{ productId: products["Escritorio Nórdico Madera Natural"].id, quantity: 4, unitPrice: 459000, total: 1836000 }]
    },
    {
      orderNumber: "ORD-2026-018", status: "ENTREGADO", userId: "user-maria",
      subtotal: 1500000, shippingCost: 0, total: 1500000, createdAt: new Date("2026-05-08"),
      items: [{ productId: products["Sierra Circular 7-1/4\" 1800W"].id, quantity: 4, unitPrice: 375000, total: 1500000 }]
    },
    {
      orderNumber: "ORD-2026-019", status: "ENTREGADO", userId: "user-juan-r",
      subtotal: 1098000, shippingCost: 0, total: 1098000, createdAt: new Date("2026-05-15"),
      items: [{ productId: products["Pintura Koraza Caneca 5 Galones"].id, quantity: 2, unitPrice: 549000, total: 1098000 }]
    },
    {
      orderNumber: "ORD-2026-020", status: "ENTREGADO", userId: "user-ana",
      subtotal: 735000, shippingCost: 15000, total: 750000, createdAt: new Date("2026-05-22"),
      items: [
        { productId: products["Taladro Percutor Inalámbrico 20V"].id, quantity: 2, unitPrice: 289000, total: 578000 },
        { productId: products["Lámpara Colgante Industrial Negro"].id, quantity: 1, unitPrice: 145000, total: 145000 }
      ]
    },
    {
      orderNumber: "ORD-2026-021", status: "PROCESANDO", userId: "user-pedro",
      subtotal: 329000, shippingCost: 20000, total: 349000, createdAt: new Date("2026-05-24"),
      items: [{ productId: products["Mueble Lavamanos Flotante 60cm"].id, quantity: 1, unitPrice: 329000, total: 329000 }]
    },
    {
      orderNumber: "ORD-2026-022", status: "PROCESANDO", userId: "user-lucia",
      subtotal: 419000, shippingCost: 0, total: 419000, createdAt: new Date("2026-05-27"),
      items: [{ productId: products["Alacena Auxiliar de Cocina Blanca"].id, quantity: 1, unitPrice: 419000, total: 419000 }]
    },
    {
      orderNumber: "ORD-2026-023", status: "CANCELADO", userId: "user-andres",
      subtotal: 549000, shippingCost: 0, total: 549000, createdAt: new Date("2026-05-29"),
      items: [{ productId: products["Pintura Koraza Caneca 5 Galones"].id, quantity: 1, unitPrice: 549000, total: 549000 }]
    },

    // --- JUNIO (5 Entregas = ~$4.2M + 2 Enviados/Procesando + 2 Cancelados + 3 Pendientes) ---
    {
      orderNumber: "ORD-2026-024", status: "ENTREGADO", userId: "user-sofia",
      subtotal: 1377000, shippingCost: 23000, total: 1400000, createdAt: new Date("2026-06-01"),
      items: [{ productId: products["Porcelanato Mármol Carrara 60x60"].id, quantity: 30, unitPrice: 45900, total: 1377000 }]
    },
    {
      orderNumber: "ORD-2026-025", status: "ENTREGADO", userId: "user-mateo",
      subtotal: 1080000, shippingCost: 0, total: 1080000, createdAt: new Date("2026-06-01"),
      items: [{ productId: products["Porcelanato Pulido Beige 80x80"].id, quantity: 20, unitPrice: 54000, total: 1080000 }]
    },
    {
      orderNumber: "ORD-2026-026", status: "ENTREGADO", userId: "user-valentina",
      subtotal: 867000, shippingCost: 15000, total: 882000, createdAt: new Date("2026-06-02"),
      items: [{ productId: products["Taladro Percutor Inalámbrico 20V"].id, quantity: 3, unitPrice: 289000, total: 867000 }]
    },
    {
      orderNumber: "ORD-2026-027", status: "ENTREGADO", userId: "user-daniel",
      subtotal: 510000, shippingCost: 10000, total: 520000, createdAt: new Date("2026-06-02"),
      items: [{ productId: products["Piso Laminado Madera Nogal Alemán 15x90"].id, quantity: 10, unitPrice: 51000, total: 510000 }]
    },
    {
      orderNumber: "ORD-2026-028", status: "ENTREGADO", userId: "user-camila",
      subtotal: 310000, shippingCost: 8000, total: 318000, createdAt: new Date("2026-06-03"),
      items: [{ productId: products["Cerámica Subterráneo Blanco Metro 10x20"].id, quantity: 10, unitPrice: 31000, total: 310000 }]
    },
    {
      orderNumber: "ORD-2026-029", status: "ENVIADO", userId: "user-alejandro",
      subtotal: 289000, shippingCost: 20000, total: 309000, createdAt: new Date("2026-06-03"),
      items: [{ productId: products["Taladro Percutor Inalámbrico 20V"].id, quantity: 1, unitPrice: 289000, total: 289000 }]
    },
    {
      orderNumber: "ORD-2026-030", status: "PROCESANDO", userId: "user-isabella",
      subtotal: 459000, shippingCost: 0, total: 459000, createdAt: new Date("2026-06-03"),
      items: [{ productId: products["Escritorio Nórdico Madera Natural"].id, quantity: 1, unitPrice: 459000, total: 459000 }]
    },
    {
      orderNumber: "ORD-2026-031", status: "CANCELADO", userId: "user-nicolas",
      subtotal: 375000, shippingCost: 0, total: 375000, createdAt: new Date("2026-06-03"),
      items: [{ productId: products["Sierra Circular 7-1/4\" 1800W"].id, quantity: 1, unitPrice: 375000, total: 375000 }]
    },
    {
      orderNumber: "ORD-2026-032", status: "CANCELADO", userId: "user-gloria",
      subtotal: 125000, shippingCost: 0, total: 125000, createdAt: new Date("2026-06-03"),
      items: [{ productId: products["Pintura Interior Premium Blanco 5L"].id, quantity: 1, unitPrice: 125000, total: 125000 }]
    },
    {
      orderNumber: "ORD-2026-033", status: "PENDIENTE", userId: "user-carlos",
      subtotal: 219000, shippingCost: 15000, total: 234000, createdAt: new Date("2026-06-03"),
      items: [{ productId: products["Estantería Metálica 5 Niveles"].id, quantity: 1, unitPrice: 219000, total: 219000 }]
    },
    {
      orderNumber: "ORD-2026-034", status: "PENDIENTE", userId: "user-maria",
      subtotal: 145000, shippingCost: 20000, total: 165000, createdAt: new Date("2026-06-03"),
      items: [{ productId: products["Lámpara Colgante Industrial Negro"].id, quantity: 1, unitPrice: 145000, total: 145000 }]
    },
    {
      orderNumber: "ORD-2026-035", status: "PENDIENTE", userId: "user-juan-r",
      subtotal: 249000, shippingCost: 0, total: 249000, createdAt: new Date("2026-06-03"),
      items: [{ productId: products["Silla de Escritorio Ergonómica"].id, quantity: 1, unitPrice: 249000, total: 249000 }]
    },
    {
      orderNumber: "ORD-2026-036", status: "PROCESANDO", userId: "user-ana",
      subtotal: 39900, shippingCost: 15000, total: 54900, createdAt: new Date("2026-06-03"),
      items: [{ productId: products["Bombillo LED Inteligente RGB 9W"].id, quantity: 1, unitPrice: 39900, total: 39900 }]
    }
  ];

  for (const orderData of ordersData) {
    const { items, ...orderFields } = orderData;
    await prisma.order.create({
      data: {
        ...orderFields,
        status: orderFields.status as OrderStatus,
        items: {
          create: items,
        },
      },
    });
  }

  // ─── Product Reviews ─────────────────────────
  console.log("⭐ Seeding between 180 and 250 product reviews...");

  const comments = [
    "Excelente calidad, superó mis expectativas.",
    "El producto es bueno, pero el empaque llegó un poco maltratado.",
    "Muy resistente y duradero. Lo recomiendo al 100%.",
    "Fácil de instalar y con muy buenos acabados.",
    "Relación calidad-precio inmejorable. Volvería a comprar.",
    "Cumple con su función perfectamente para el proyecto de obra.",
    "El material se siente premium y resistente.",
    "El color es exactamente igual al de la foto. Muy conforme.",
    "Herramienta muy potente, indispensable para mi trabajo.",
    "Un poco costoso pero vale totalmente la pena.",
    "Rendimiento excepcional en superficies difíciles.",
    "Muy satisfecho con la compra, envío rápido.",
    "La boquilla y fraguado son excelentes.",
    "El cemento fraguó rápido y con muy buena dureza.",
    "Buen producto, consistente con la descripción.",
    "No es excelente pero por el precio está muy bien.",
    "Excelente atención y despacho rápido por Homara.",
    "Muy práctico y útil en mi proyecto de hogar.",
    "La iluminación es perfecta, muy eficiente.",
    "El mueble tiene acabados hermosos y elegantes."
  ];

  let reviewCountSeeded = 0;

  for (const product of productList) {
    // 90% de probabilidad de tener reviews para robustecer
    if (Math.random() > 0.1) {
      // Entre 2 y 5 calificaciones
      const numReviews = Math.floor(Math.random() * 4) + 2;
      const shuffledReviewers = [...customerIds].sort(() => Math.random() - 0.5);
      const selectedReviewers = shuffledReviewers.slice(0, numReviews);

      const ratings: number[] = [];

      for (const userId of selectedReviewers) {
        const rand = Math.random();
        // Mayormente 4 y 5 estrellas
        const rating = rand < 0.05 ? 1 : rand < 0.1 ? 2 : rand < 0.25 ? 3 : rand < 0.6 ? 4 : 5;
        ratings.push(rating);

        const comment = Math.random() > 0.4 ? comments[Math.floor(Math.random() * comments.length)] : null;

        await prisma.review.create({
          data: {
            userId,
            productId: product.id,
            rating,
            comment
          }
        });
        reviewCountSeeded++;
      }

      const avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      await prisma.product.update({
        where: { id: product.id },
        data: {
          rating: parseFloat(avgRating.toFixed(1)),
          reviewCount: ratings.length
        }
      });
    } else {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          rating: 0,
          reviewCount: 0
        }
      });
    }
  }

  // ─── Summary ────────────────────────────────
  console.log("\n✅ Expanded Seed completed successfully!");
  console.log(`   👤 ${customerIds.length + 1} users created`);
  console.log(`   📂 ${categoriesData.length} categories created`);
  console.log(`   🏷️ ${productList.length} products created`);
  console.log(`   ⭐ ${reviewCountSeeded} reviews seeded`);
  console.log(`   📐 ${projectsData.length} projects created`);
  console.log(`   🛒 ${cartOwners.length} carts created`);
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
