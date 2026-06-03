import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const { TokenExpiredError, JsonWebTokenError } = jwt;
import { Prisma } from "../../../generated/prisma/client.js";

export function errorHandler(err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Error interno del servidor";

  // Manejar errores específicos de JWT (TokenExpiredError extends JsonWebTokenError)
  if (err instanceof TokenExpiredError) {
    statusCode = 401;
    message = "Token expirado. Por favor, inicia sesión nuevamente.";
  } else if (err instanceof JsonWebTokenError) {
    statusCode = 401;
    message = "Token inválido o malformado.";
  }
  // Manejar errores de Prisma ORM
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": // Unique constraint violation
        statusCode = 409;
        const targets = (err.meta?.target as string[]) || [];
        message = `El registro ya existe. Campo duplicado: ${targets.join(", ")}`;
        break;
      case "P2025": // Record not found
        statusCode = 404;
        message = "El recurso solicitado no fue encontrado o no tienes permisos para acceder a él.";
        break;
      case "P2003": // Foreign key constraint violation
        statusCode = 400;
        message = "Error de integridad de datos. La entidad referenciada no existe.";
        break;
      default:
        statusCode = 400;
        message = `Error en base de datos (${err.code}): ${err.message}`;
        break;
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = "Los datos proporcionados no coinciden con la estructura requerida.";
  }

  // Client errors (4xx) — log without stack trace
  if (statusCode < 500) {
    console.warn(`[${statusCode}] ${message}`);
  } else {
    // Server errors (5xx) — full logging
    console.error("❌ Error:", err.message);
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

