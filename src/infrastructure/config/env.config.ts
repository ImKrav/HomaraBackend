import "dotenv/config";

const developmentOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

// Secreto que estuvo publicado en el repositorio: firmar con él permite forjar tokens (CP-SEG-DEF-01).
const LEAKED_JWT_SECRET = "homara_jwt_secret_key_2026_secure";

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret === LEAKED_JWT_SECRET) {
    throw new Error("JWT_SECRET no está definido o es el secreto público por defecto. Genere uno con `openssl rand -hex 32`.");
  }
  return secret;
}

const configuredOrigins = process.env.CORS_ORIGINS
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const envConfig = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: requireJwtSecret(),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigins: configuredOrigins ?? (process.env.NODE_ENV === "production" ? [] : developmentOrigins),
};
