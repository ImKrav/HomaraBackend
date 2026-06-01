// ============================================
// Homara — Prisma connection validator (TS)
// ============================================

import "dotenv/config";
import { prisma } from "./src/infrastructure/database/prisma-client.js";

async function main() {
  console.log("Comprobando conexión con Prisma...");
  try {
    const usersCount = await prisma.user.count();
    const productsCount = await prisma.product.count();
    const categoriesCount = await prisma.category.count();
    const projectsCount = await prisma.project.count();

    console.log("✅ Prisma está conectado y funcionando correctamente.");
    console.log("Resumen de la base de datos:");
    console.log(`- Usuarios: ${usersCount}`);
    console.log(`- Categorías: ${categoriesCount}`);
    console.log(`- Productos: ${productsCount}`);
    console.log(`- Proyectos: ${projectsCount}`);
  } catch (error) {
    console.error("❌ Error al conectar con Prisma:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
