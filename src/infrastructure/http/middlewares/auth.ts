import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../../../shared/utils/authHelper.js";
import { PrismaUserRepository } from "../../database/repositories/prisma-user.repository.js";
import { AppError } from "../../../shared/errors/AppError.js";

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
    throw new AppError("Acceso denegado. No autorizado. Token no provisto.", 401);
  }
  return authHeader.split(" ")[1];
}

async function authenticateUser(req: Request, token: string) {
  try {
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
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Token inválido, alterado o expirado.", 401);
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req.headers.authorization);
    await authenticateUser(req, token);
    next();
  } catch (error) {
    next(error);
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
    next(error);
  }
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
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
      } catch (err) {
        // Ignorar para compatibilidad hacia atrás
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}
