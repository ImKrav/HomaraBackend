// ============================================
// Homara — Prisma Client Singleton (TS)
// ============================================

import { PrismaClient } from "../../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;

// Determinar si la base de datos está hosteada en la nube y requiere TLS/SSL seguro
const requiresSSL = !!(
  connectionString &&
  (connectionString.includes("neon.tech") ||
    connectionString.includes("supabase.co") ||
    connectionString.includes("rds.amazonaws.com") ||
    connectionString.includes("sslmode=require") ||
    connectionString.includes("sslmode=prefer") ||
    process.env.DB_SSL === "true")
);

const pool = new pg.Pool({
  connectionString,
  ...(requiresSSL && {
    ssl: {
      rejectUnauthorized: false, // Permite conexiones seguras sin fallar por certificados auto-firmados en PaaS
    },
  }),
});

const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

