import http from "node:http";
import { test, is, ok } from "./harness.js";
import app from "../src/infrastructure/http/express-server.js";
import { setCatalogRepositoriesForTests } from "../src/infrastructure/http/controllers/catalog.controller.js";

let server: http.Server | null = null;
let baseUrl = "";

async function getBaseUrl() {
  if (!server) {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const port = (server.address() as any).port;
    baseUrl = `http://localhost:${port}`;
  }
  return baseUrl;
}

test("UNIT-SRV-01", "express-server responde con mensaje y versión en GET /", async () => {
  const url = await getBaseUrl();
  const res = await fetch(`${url}/`);
  const data = await res.json();
  is(data.version, "1.0.0");
  is(data.message, "Homara API — Backend");
  ok(data.endpoints.products !== undefined);
});

test("UNIT-SRV-02", "express-server responde 204 a preflight OPTIONS y setea cabeceras CORS", async () => {
  const url = await getBaseUrl();
  const res = await fetch(`${url}/api/v1/products`, {
    method: "OPTIONS"
  });
  is(res.status, 204);
  is(res.headers.get("access-control-allow-origin"), "*");
  ok(res.headers.get("access-control-allow-methods")?.includes("GET"));
});

test("UNIT-SRV-03", "express-server reescribe /api/* a /api/v1/* de forma transparente", async () => {
  setCatalogRepositoriesForTests({
    categoryRepo: {
      findAll: async () => [{ id: "cat-1", name: "Pisos" }]
    } as any
  });

  const url = await getBaseUrl();
  const res = await fetch(`${url}/api/categories`);
  is(res.status, 200);
  const body = await res.json();
  is(body.success, true);
  is(body.data.length, 1);

  if (server) {
    const s = server;
    server = null;
    await new Promise<void>((resolve) => s.close(() => resolve()));
  }
});
