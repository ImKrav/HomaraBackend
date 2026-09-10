import "dotenv/config";

const developmentOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const configuredOrigins = process.env.CORS_ORIGINS
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const envConfig = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || "homara_jwt_secret_key_2026_secure",
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigins: configuredOrigins ?? (process.env.NODE_ENV === "production" ? [] : developmentOrigins),
};
