import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { AppError } from "../../../shared/errors/AppError.js";

function replaceObjectProperties(targetObj: Record<string, any>, sourceObj: Record<string, any>) {
  for (const key of Object.keys(targetObj)) {
    delete targetObj[key];
  }
  Object.assign(targetObj, sourceObj);
}

export function validateZod(schema: z.ZodType<any>, target: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[target]);

      if (target === "query" || target === "params") {
        replaceObjectProperties(req[target] as Record<string, any>, data as Record<string, any>);
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

