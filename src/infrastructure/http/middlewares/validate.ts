import { Request, Response, NextFunction } from "express";
import { AppError } from "../../../shared/errors/AppError.js";

export function validateBody(requiredFields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing = requiredFields.filter(
      (field) => req.body[field] === undefined || req.body[field] === null
    );

    if (missing.length > 0) {
      throw new AppError(
        `Campos requeridos faltantes: ${missing.join(", ")}`,
        400
      );
    }

    next();
  };
}
