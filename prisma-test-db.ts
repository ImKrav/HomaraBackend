// ============================================
// Homara — Database Testing & Validation Script
// ============================================

import "dotenv/config";
import { prisma } from "./src/infrastructure/database/prisma-client.js";

async function runPrismaORMTests() {
  console.log("🚀 Starting Prisma ORM Integration Tests...");
  
  try {
    // 1. Test connection & basic query
    console.log("\n🔍 1. Querying total users and categories count...");
    const userCount = await prisma.user.count();
    const categoryCount = await prisma.category.count();
    console.log(`✅ Connection Success! Found ${userCount} users and ${categoryCount} categories in PostgreSQL.`);

    // 2. Query relation loading
    console.log("\n🔍 2. Fetching categories with related products...");
    const categories = await prisma.category.findMany({
      include: {
        products: {
          take: 2
        }
      }
    });

    categories.forEach(cat => {
      console.log(`   - Category: ${cat.name} (${cat.slug}) | Sub-products: ${cat.products.length}`);
      cat.products.forEach(p => {
        console.log(`     * Product: ${p.name} - Price: $${p.price.toLocaleString("es-CO")}`);
      });
    });

    // 3. Test insert operation (Write test)
    console.log("\n🔍 3. Testing write transactions (inserting temporary product)...");
    const firstCategory = await prisma.category.findFirst();
    if (!firstCategory) {
      throw new Error("No categories found to attach a test product.");
    }

    const testProduct = await prisma.product.create({
      data: {
        name: "TEMPORARY TEST PRODUCT (PRISMA)",
        description: "This is a temporary product inserted via automated ORM verification tests.",
        price: 99900,
        originalPrice: 120000,
        image: "test_image.jpg",
        rating: 4.8,
        reviewCount: 1,
        inStock: true,
        stockQuantity: 10,
        unit: "unidad",
        categoryId: firstCategory.id
      }
    });
    console.log(`✅ Write transaction successful! Created product ID: ${testProduct.id}`);

    // 4. Test delete operation (Cleanup test)
    console.log("\n🔍 4. Testing cleanup transactions (deleting temporary product)...");
    await prisma.product.delete({
      where: { id: testProduct.id }
    });
    console.log("✅ Cleanup complete! Product deleted successfully.");
    console.log("\n🌟 All Prisma ORM Integration Tests passed flawlessly!");
    
  } catch (error) {
    console.error("❌ Prisma ORM Test Failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPrismaORMTests();
