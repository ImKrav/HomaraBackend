import { Request, Response, NextFunction } from "express";
import { TokenExpiredError, JsonWebTokenError } from "jsonwebtoken";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error("❌ Error:", err.message);
  console.error(err.stack);

  let statusCode = err.statusCode || 500;
  let message = err.message || "Error interno del servidor";

  // Manejar errores específicos de JWT
  if (err instanceof TokenExpiredError) {
    statusCode = 401;
    message = "Token expirado. Por favor, inicia sesión nuevamente.";
  } else if (err instanceof JsonWebTokenError) {
    statusCode = 401;
    message = "Token inválido o malformado.";
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}
