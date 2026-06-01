import { Request, Response, NextFunction } from "express";
import { ZodTypeAny, ZodError } from "zod";
import { AppError } from "../../../shared/errors/AppError.js";

export function validateZod(schema: ZodTypeAny, target: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[target]);
      req[target] = data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        throw new AppError(`Validación fallida: ${messages}`, 400);
      }
      next(error);
    }
  };
}

