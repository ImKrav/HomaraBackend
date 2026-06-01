// ============================================
// Homara — global errorHandler Unit Tests (TS)
// ============================================

import { describe, it, expect, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { TokenExpiredError, JsonWebTokenError } from "jsonwebtoken";
import { Prisma } from "../../generated/prisma/client.js";
import { errorHandler } from "../../src/infrastructure/http/middlewares/errorHandler.js";
import { AppError } from "../../src/shared/errors/AppError.js";

describe("Global Error Handler Middleware", () => {
  const createMockResponse = () => {
    const res = {} as Response;
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  const mockRequest = {} as Request;
  const mockNext = vi.fn() as unknown as NextFunction;

  it("should handle TokenExpiredError and return 401", () => {
    const res = createMockResponse();
    const error = new TokenExpiredError("jwt expired", new Date());

    errorHandler(error, mockRequest, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Token expirado. Por favor, inicia sesión nuevamente.",
      })
    );
  });

  it("should handle JsonWebTokenError and return 401", () => {
    const res = createMockResponse();
    const error = new JsonWebTokenError("invalid token");

    errorHandler(error, mockRequest, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Token inválido o malformado.",
      })
    );
  });

  it("should handle Prisma P2002 (Unique Constraint) and return 409", () => {
    const res = createMockResponse();
    const error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "7.8.0",
      meta: { target: ["email"] },
    });

    errorHandler(error, mockRequest, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "El registro ya existe. Campo duplicado: email",
      })
    );
  });

  it("should handle Prisma P2025 (Record Not Found) and return 404", () => {
    const res = createMockResponse();
    const error = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "7.8.0",
    });

    errorHandler(error, mockRequest, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "El recurso solicitado no fue encontrado o no tienes permisos para acceder a él.",
      })
    );
  });

  it("should handle Prisma P2003 (Foreign Key Constraint Failed) and return 400", () => {
    const res = createMockResponse();
    const error = new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
      code: "P2003",
      clientVersion: "7.8.0",
    });

    errorHandler(error, mockRequest, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Error de integridad de datos. La entidad referenciada no existe.",
      })
    );
  });

  it("should handle PrismaClientValidationError and return 400", () => {
    const res = createMockResponse();
    const error = new Prisma.PrismaClientValidationError("Validation failed", { clientVersion: "7.8.0" });

    errorHandler(error, mockRequest, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Los datos proporcionados no coinciden con la estructura requerida.",
      })
    );
  });

  it("should handle custom AppError and return specified statusCode", () => {
    const res = createMockResponse();
    const error = new AppError("Acceso denegado.", 403);

    errorHandler(error, mockRequest, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Acceso denegado.",
      })
    );
  });

  it("should fallback to 500 for generic unhandled server errors", () => {
    const res = createMockResponse();
    const error = new Error("Generic unhandled crash");

    errorHandler(error, mockRequest, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Generic unhandled crash",
      })
    );
  });
});
