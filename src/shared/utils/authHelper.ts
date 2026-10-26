// ============================================
// Homara — Authentication Helper Utilities (TS)
// ============================================

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { envConfig } from "../../infrastructure/config/env.config.js";

const JWT_SECRET = envConfig.jwtSecret;

interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

/**
 * Encripta una contraseña plana utilizando bcryptjs
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

/**
 * Compara una contraseña plana con una contraseña encriptada (hash)
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Genera un token JWT para un usuario
 */
export function generateToken(user: TokenPayload): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

/**
 * Verifica un token JWT
 */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
