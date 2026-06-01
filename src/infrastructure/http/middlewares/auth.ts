import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../../../shared/utils/authHelper.js";
import { PrismaUserRepository } from "../../database/repositories/prisma-user.repository.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { TokenExpiredError, JsonWebTokenError } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        firstName?: string;
        lastName?: string;
      };
    }
  }
}

const userRepository = new PrismaUserRepository();

function extractToken(authHeader: string | undefined): string {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("Token no provisto.", 401);
  }
  return authHeader.split(" ")[1];
}

async function authenticateUser(req: Request, token: string) {
  const decoded = verifyToken(token);
  const user = await userRepository.findById(decoded.id);

  if (!user) {
    throw new AppError("Usuario no encontrado o dado de baja.", 401);
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role!,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req.headers.authorization);
    await authenticateUser(req, token);
    next();
  } catch (error) {
    if (error instanceof AppError || error instanceof TokenExpiredError || error instanceof JsonWebTokenError) {
      next(error);
      return;
    }
    next(new AppError("Error durante la autenticación.", 500));
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req.headers.authorization);
    await authenticateUser(req, token);

    if (req.user?.role !== "ADMIN") {
      throw new AppError("Acceso denegado. Se requieren permisos de administrador.", 403);
    }

    next();
  } catch (error) {
    if (error instanceof AppError || error instanceof TokenExpiredError || error instanceof JsonWebTokenError) {
      next(error);
      return;
    }
    next(new AppError("Error durante la autenticación.", 500));
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = verifyToken(token);
      const user = await userRepository.findById(decoded.id);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role!,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      }
    } catch {
      // Ignorar errores — autenticación opcional
    }
  }
  next();
}
