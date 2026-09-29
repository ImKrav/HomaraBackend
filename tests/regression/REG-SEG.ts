// REG-SEG · Regresión de seguridad: CORS por lista blanca
// Protege: b4d9ad4 fix(security): resolve CORS injection vulnerability (S8348)
//          53729d7 fix: restrict cors origins
//
// Antes de esos commits la API respondía `Access-Control-Allow-Origin: *` y
// después reflejaba el `Origin` que mandara el cliente. Estos casos fallan si
// alguno de los dos comportamientos vuelve.

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { vi, afterEach } from "vitest";
import { test, expect } from "../harness.js";
import app from "../../src/infrastructure/http/express-server.js";

const ORIGEN_FRONT = "http://localhost:3000";
const ORIGEN_AJENO = "https://atacante.example";

/** Levanta la app en un puerto libre, hace una petición y cierra el servidor. */
async function pedir(ruta: string, init: RequestInit): Promise<Response> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await fetch(`http://127.0.0.1:${port}${ruta}`, init);
  } finally {
    server.close();
  }
}

/** Reevalúa env.config con el entorno actual, sin leer un `.env` real. */
async function cargarEnvConfig() {
  vi.resetModules();
  vi.doMock("dotenv/config", () => ({}));
  return (await import("../../src/infrastructure/config/env.config.js")).envConfig;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("dotenv/config");
});

// --- Cabeceras CORS en la respuesta -------------------------------------

test("REG-SEG-01", "No refleja un Origin fuera de la lista blanca", async () => {
  // Arrange
  const init = { headers: { Origin: ORIGEN_AJENO } };

  // Act
  const res = await pedir("/", init);

  // Assert
  expect(res.status).toBe(200);
  expect(res.headers.get("access-control-allow-origin")).toBeNull();
});

test("REG-SEG-02", "Refleja exactamente el origen permitido, nunca el comodín *", async () => {
  // Arrange
  const init = { headers: { Origin: ORIGEN_FRONT } };

  // Act
  const res = await pedir("/", init);

  // Assert
  expect(res.headers.get("access-control-allow-origin")).toBe(ORIGEN_FRONT);
  expect(res.headers.get("access-control-allow-origin")).not.toBe("*");
  expect(res.headers.get("vary")).toContain("Origin");
});

test("REG-SEG-03", "El preflight de un origen ajeno no recibe permiso", async () => {
  // Arrange
  const init = {
    method: "OPTIONS",
    headers: { Origin: ORIGEN_AJENO, "Access-Control-Request-Method": "DELETE" },
  };

  // Act
  const res = await pedir("/api/v1/cart", init);

  // Assert
  expect(res.headers.get("access-control-allow-origin")).toBeNull();
});

// --- Construcción de la lista blanca (env.config) -------------------------

test("REG-SEG-04", "CORS_ORIGINS se separa por comas, recorta espacios y descarta vacíos", async () => {
  // Arrange
  vi.stubEnv("CORS_ORIGINS", " https://homara.co , ,https://admin.homara.co,");

  // Act
  const config = await cargarEnvConfig();

  // Assert
  expect(config.corsOrigins).toStrictEqual(["https://homara.co", "https://admin.homara.co"]);
});

test("REG-SEG-05", "En producción sin CORS_ORIGINS no se permite ningún origen", async () => {
  // Arrange
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CORS_ORIGINS", undefined);

  // Act
  const config = await cargarEnvConfig();

  // Assert
  expect(config.corsOrigins).toStrictEqual([]);
});

test("REG-SEG-06", "Fuera de producción sin CORS_ORIGINS solo se permite el front local", async () => {
  // Arrange
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("CORS_ORIGINS", undefined);

  // Act
  const config = await cargarEnvConfig();

  // Assert
  expect(config.corsOrigins).toStrictEqual(["http://localhost:3000", "http://127.0.0.1:3000"]);
  expect(config.corsOrigins).not.toContain("*");
});
