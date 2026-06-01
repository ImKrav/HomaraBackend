import "dotenv/config";

export const envConfig = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || "homara_jwt_secret_key_2026_secure",
  nodeEnv: process.env.NODE_ENV || "development",
};
