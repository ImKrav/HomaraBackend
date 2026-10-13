// ============================================================================
// Pruebas de API en vivo — Contrato de documentación (ESC42 / RN-064)
//
// Compara las rutas publicadas en /api-docs (el documento OpenAPI que sirve
// swagger-ui-express) contra las rutas realmente implementadas en el servidor.
//
// - Toda ruta documentada debe existir de verdad (no documentar rutas fantasma).
// - Toda ruta pública principal implementada debe estar documentada.
// - Se detectan rutas implementadas pero NO documentadas (hueco de documentación,
//   RN-064): quedan registradas como defecto conocido con `it.fails`.
// ============================================================================

import { test, expect, describe } from "../harness.js";
import { pedir, BASE_URL } from "./soporte-api.js";

/** Descarga el documento OpenAPI embebido en swagger-ui-init.js y lo parsea. */
async function obtenerOpenApi(): Promise<any> {
  const res = await fetch(`${BASE_URL}/api-docs/swagger-ui-init.js`);
  const texto = await res.text();
  const marca = '"swaggerDoc":';
  const inicio = texto.indexOf(marca);
  if (inicio === -1) throw new Error("No se encontró swaggerDoc en swagger-ui-init.js");
  // Recorte por balance de llaves a partir del primer '{' tras la marca.
  let i = texto.indexOf("{", inicio + marca.length);
  let nivel = 0;
  let fin = -1;
  for (let j = i; j < texto.length; j++) {
    if (texto[j] === "{") nivel++;
    else if (texto[j] === "}") {
      nivel--;
      if (nivel === 0) {
        fin = j + 1;
        break;
      }
    }
  }
  return JSON.parse(texto.slice(i, fin));
}

/** Lista (método, ruta) de cada operación documentada. */
function operacionesDocumentadas(doc: any): Array<{ method: string; path: string }> {
  const ops: Array<{ method: string; path: string }> = [];
  for (const [path, item] of Object.entries<any>(doc.paths || {})) {
    for (const method of Object.keys(item)) {
      ops.push({ method: method.toUpperCase(), path });
    }
  }
  return ops;
}

/** Sustituye {param} por un id ficticio para poder probar la existencia de la ruta. */
function rutaConcreta(path: string): string {
  return path.replace(/\{[^}]+\}/g, "cnoexistexxxxxxxxxxxxxxx");
}

/**
 * Una ruta "existe" si el servidor la atiende (devuelve el sobre JSON de la app,
 * aunque sea 400/401/403/404 de negocio). Si no existe, Express responde su 404
 * por defecto en HTML ("Cannot <METHOD> <ruta>"), sin la propiedad `success`.
 */
async function rutaExiste(method: string, path: string): Promise<boolean> {
  const concreta = rutaConcreta(path);
  const body = ["POST", "PUT", "PATCH"].includes(method) ? {} : undefined;
  const res = await pedir(concreta, { method, body });
  return typeof res.body === "object" && res.body !== null && "success" in res.body;
}

// Inventario de rutas realmente implementadas (derivado de routes/*.ts).
const IMPLEMENTADAS_PRINCIPALES: Array<{ method: string; path: string }> = [
  { method: "POST", path: "/users/register" },
  { method: "POST", path: "/users/login" },
  { method: "GET", path: "/users/me" },
  { method: "GET", path: "/users/{id}" },
  { method: "PUT", path: "/users/{id}" },
  { method: "GET", path: "/categories" },
  { method: "GET", path: "/products" },
  { method: "GET", path: "/products/{id}" },
  { method: "GET", path: "/cart" },
  { method: "POST", path: "/cart/items" },
  { method: "GET", path: "/orders" },
  { method: "POST", path: "/orders" },
  { method: "GET", path: "/orders/{id}" },
  { method: "GET", path: "/projects" },
  { method: "POST", path: "/projects" },
  { method: "GET", path: "/admin/metrics" },
  { method: "GET", path: "/admin/inventory" },
];

// Rutas implementadas que NO tienen bloque @openapi (hueco de documentación).
const IMPLEMENTADAS_SIN_DOCUMENTAR: Array<{ method: string; path: string }> = [
  { method: "GET", path: "/products/storefront" },
  { method: "GET", path: "/products/{id}/reviews" },
  { method: "POST", path: "/products/{id}/reviews" },
  { method: "POST", path: "/products" },
  { method: "PUT", path: "/products/{id}" },
  { method: "DELETE", path: "/products/{id}" },
];

describe("API · Contrato de documentación (Swagger vs. implementación)", () => {
  test("CP-API-DOC-01", "ESC42 — /api-docs expone un documento OpenAPI 3 con rutas", async () => {
    // Act
    const doc = await obtenerOpenApi();

    // Assert
    expect(doc.openapi).toMatch(/^3\./);
    expect(Object.keys(doc.paths || {}).length).toBeGreaterThan(0);
  });

  test("CP-API-DOC-02", "ESC42/RN-064 — toda ruta documentada existe de verdad (no hay rutas fantasma)", async () => {
    // Arrange
    const doc = await obtenerOpenApi();
    const ops = operacionesDocumentadas(doc);

    // Act
    const faltantes: string[] = [];
    for (const op of ops) {
      if (!(await rutaExiste(op.method, op.path))) {
        faltantes.push(`${op.method} ${op.path}`);
      }
    }

    // Assert
    expect(faltantes).toEqual([]);
  });

  test("CP-API-DOC-03", "ESC42 — las rutas públicas principales están documentadas", async () => {
    // Arrange
    const doc = await obtenerOpenApi();
    const documentadas = new Set(operacionesDocumentadas(doc).map((o) => `${o.method} ${o.path}`));

    // Act
    const sinDocumentar = IMPLEMENTADAS_PRINCIPALES.filter(
      (op) => !documentadas.has(`${op.method} ${op.path}`),
    );

    // Assert
    expect(sinDocumentar.map((o) => `${o.method} ${o.path}`)).toEqual([]);
  });

  test.fails(
    "CP-API-DOC-04",
    "ESC42/RN-064 — DEFECTO: hay rutas implementadas sin documentar en Swagger (storefront, reseñas, CRUD de productos)",
    async () => {
      // Arrange
      const doc = await obtenerOpenApi();
      const documentadas = new Set(operacionesDocumentadas(doc).map((o) => `${o.method} ${o.path}`));

      // Act
      const sinDocumentar = IMPLEMENTADAS_SIN_DOCUMENTAR.filter(
        (op) => !documentadas.has(`${op.method} ${op.path}`),
      );

      // Assert (comportamiento correcto esperado: deberían estar todas documentadas).
      // Mientras el defecto siga abierto, esta aserción falla y el caso queda en verde.
      expect(sinDocumentar).toEqual([]);
    },
  );
});
