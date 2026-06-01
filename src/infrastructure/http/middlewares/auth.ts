import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../../../shared/utils/authHelper.js";
import { PrismaUserRepository } from "../../database/repositories/prisma-user.repository.js";

// Extender la interfaz de Request para incluir el usuario de sesión
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

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Acceso denegado. No autorizado. Token no provisto.",
      });
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = verifyToken(token);
      const user = await userRepository.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: "Usuario no encontrado o dado de baja.",
        });
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role!,
        firstName: user.firstName,
        lastName: user.lastName,
      };
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: "Token inválido, alterado o expirado.",
      });
    }
  } catch (error) {
    next(error);
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Acceso denegado. No autorizado. Token no provisto.",
      });
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = verifyToken(token);
      const user = await userRepository.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: "Usuario no encontrado o dado de baja.",
        });
      }

      if (user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          error: "Acceso denegado. Se requieren permisos de administrador.",
        });
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role!,
        firstName: user.firstName,
        lastName: user.lastName,
      };
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: "Token inválido, alterado o expirado.",
      });
    }
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
