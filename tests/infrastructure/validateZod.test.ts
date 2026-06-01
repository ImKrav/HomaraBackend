// ============================================
// Homara — validateZod Middleware Unit Tests (TS)
// ============================================

import { describe, it, expect, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validateZod } from "../../src/infrastructure/http/middlewares/validateZod.js";
import { AppError } from "../../src/shared/errors/AppError.js";

describe("validateZod Middleware", () => {
  const dummySchema = z.object({
    email: z.string().email("Formato de email inválido"),
    age: z.number().min(18, "Debes ser mayor de edad"),
  });

  const mockResponse = {} as Response;
  const mockNext = vi.fn() as unknown as NextFunction;

  it("should validate and parse body successfully if request is valid", () => {
    const mockRequest = {
      body: {
        email: "test@homara.com",
        age: 25,
      },
    } as Request;

    const nextSpy = vi.fn();
    const middleware = validateZod(dummySchema, "body");
    middleware(mockRequest, mockResponse, nextSpy);

    expect(nextSpy).toHaveBeenCalledWith();
    expect(mockRequest.body).toEqual({
      email: "test@homara.com",
      age: 25,
    });
  });

  it("should validate query parameters successfully if requested", () => {
    const mockRequest = {
      query: {
        email: "test@homara.com",
        age: 30,
      },
    } as unknown as Request;

    const nextSpy = vi.fn();
    const middleware = validateZod(dummySchema, "query");
    middleware(mockRequest, mockResponse, nextSpy);

    expect(nextSpy).toHaveBeenCalledWith();
    expect(mockRequest.query).toEqual({
      email: "test@homara.com",
      age: 30,
    });
  });

  it("should throw AppError 400 if validation fails with validation details", () => {
    const mockRequest = {
      body: {
        email: "not-an-email",
        age: 15,
      },
    } as Request;

    const nextSpy = vi.fn();
    const middleware = validateZod(dummySchema, "body");

    expect(() => middleware(mockRequest, mockResponse, nextSpy)).toThrowError(AppError);
    
    try {
      middleware(mockRequest, mockResponse, nextSpy);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appErr = error as AppError;
      expect(appErr.statusCode).toBe(400);
      expect(appErr.message).toContain("Validación fallida");
      expect(appErr.message).toContain("email: Formato de email inválido");
      expect(appErr.message).toContain("age: Debes ser mayor de edad");
    }
    expect(nextSpy).not.toHaveBeenCalled();
  });
});
