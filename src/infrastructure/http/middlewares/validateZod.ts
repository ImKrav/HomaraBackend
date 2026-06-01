import { Request, Response, NextFunction } from "express";
import { ZodTypeAny, ZodError } from "zod";
import { AppError } from "../../../shared/errors/AppError.js";

export function validateZod(schema: ZodTypeAny, target: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[target]);
      
      if (target === "query") {
        // En Express 5, req.query tiene solo getter y no se puede reasignar.
        // Mutamos el objeto existente para preservar el casteo de tipos de Zod.
        for (const key in req.query) {
          if (Object.prototype.hasOwnProperty.call(req.query, key)) {
            delete req.query[key];
          }
        }
        Object.assign(req.query, data);
      } else if (target === "params") {
        // En caso de que req.params también sea read-only
        for (const key in req.params) {
          if (Object.prototype.hasOwnProperty.call(req.params, key)) {
            delete req.params[key];
          }
        }
        Object.assign(req.params, data);
      } else {
        req[target] = data;
      }
      
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

