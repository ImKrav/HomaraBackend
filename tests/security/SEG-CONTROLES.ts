// ============================================================================
// Revisión defensiva de seguridad — Controles que SÍ funcionan (casos en verde)
//
// ESC35 seguridad de credenciales · ESC36 autorización por recurso
// ESC06 control de acceso por rol · ESC41 manejo uniforme de errores
// RN-005 contraseña cifrada/nunca expuesta · RN-008 tokens rechazados
// RN-010 operaciones admin solo ADMIN · RN-012 no escalar rol · RN-062 error uniforme
//
// Proyecto propio del equipo; sólo se envían los datos mínimos para evidenciar
// cada control. Ver docs/pruebas/SEGURIDAD.md.
// ============================================================================

import { test, expect, describe } from "../harness.js";
import {
  pedir,
  iniciarSesion,
  registrarUsuario,
  firmarTokenConSecretoPorDefecto,
  SEMILLA,
  claveDePrueba,
  claveCorta,
} from "../api/soporte-api.js";

describe("Seguridad · Autenticación de rutas protegidas", () => {
  const protegidas: Array<{ nombre: string; method: string; ruta: string; body?: unknown }> = [
    { nombre: "GET /users/me", method: "GET", ruta: "/users/me" },
    { nombre: "POST /cart/items", method: "POST", ruta: "/cart/items", body: { productId: "cxxxxxxxxxxxxxxxxxxxxxxxx", quantity: 1 } },
    { nombre: "POST /orders", method: "POST", ruta: "/orders", body: { paymentMethod: "tarjeta" } },
    { nombre: "POST /projects", method: "POST", ruta: "/projects", body: { name: "x", type: "PISO", area: 10 } },
    { nombre: "GET /admin/metrics", method: "GET", ruta: "/admin/metrics" },
    { nombre: "GET /admin/inventory", method: "GET", ruta: "/admin/inventory" },
  ];

  for (const [i, caso] of protegidas.entries()) {
    test(
      `CP-SEG-AUT-${String(i + 1).padStart(2, "0")}`,
      `ESC36/RN-008 — ${caso.nombre} sin token responde 401`,
      async () => {
        // Act
        const res = await pedir(caso.ruta, { method: caso.method, body: caso.body });

        // Assert
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      },
    );
  }

  test("CP-SEG-AUT-07", "RN-008 — token malformado se rechaza (401)", async () => {
    // Act
    const res = await pedir("/users/me", { token: "esto.no.es.jwt" });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.error).toContain("inválido");
  });

  test("CP-SEG-AUT-08", "RN-008 — token expirado se rechaza (401)", async () => {
    // Arrange: firmado con el secreto por defecto pero ya expirado
    const expirado = await firmarTokenConSecretoPorDefecto(
      { id: SEMILLA.juan.id, email: SEMILLA.juan.email, role: "CUSTOMER" },
      -10,
    );

    // Act
    const res = await pedir("/users/me", { token: expirado });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.error).toContain("expirado");
  });

  test("CP-SEG-AUT-09", "RN-008 — token de usuario inexistente se rechaza (401)", async () => {
    // Arrange: firma válida pero el id no existe en la base
    const noUsuario = await firmarTokenConSecretoPorDefecto({
      id: "cxxxxxxxxxxxxxxxxxxxxxxxx",
      email: "fantasma@test.local",
      role: "ADMIN",
    });

    // Act
    const res = await pedir("/admin/metrics", { token: noUsuario });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("CP-SEG-AUT-10", "ESC06/RN-010 — un CUSTOMER no entra a las rutas de administrador (403)", async () => {
    // Arrange
    const cliente = await registrarUsuario();

    // Act
    const metrics = await pedir("/admin/metrics", { token: cliente.token });
    const inventory = await pedir("/admin/inventory", { token: cliente.token });

    // Assert
    expect(metrics.status).toBe(403);
    expect(inventory.status).toBe(403);
  });
});

describe("Seguridad · Credenciales y datos sensibles", () => {
  test("CP-SEG-CRED-01", "ESC35/RN-005 — login no devuelve la contraseña ni su hash", async () => {
    // Act
    const res = await pedir("/users/login", {
      method: "POST",
      body: { email: SEMILLA.juan.email, password: SEMILLA.juan.password },
    });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data.user).not.toHaveProperty("password");
    expect(JSON.stringify(res.body)).not.toContain("$2"); // prefijo de hash bcrypt
  });

  test("CP-SEG-CRED-02", "ESC35/RN-006 — el error de login es genérico (no revela si el correo existe)", async () => {
    // Act
    const existe = await pedir("/users/login", { method: "POST", body: { email: SEMILLA.juan.email, password: claveDePrueba() } });
    const noExiste = await pedir("/users/login", { method: "POST", body: { email: "nadie@test.local", password: claveDePrueba() } });

    // Assert
    expect(existe.status).toBe(401);
    expect(noExiste.status).toBe(401);
    expect(existe.body.error).toBe(noExiste.body.error);
  });

  test("CP-SEG-CRED-03", "ESC35/RN-005 — GET /users/me nunca incluye la contraseña", async () => {
    // Arrange
    const sesion = await iniciarSesion(SEMILLA.juan.email, SEMILLA.juan.password);

    // Act
    const res = await pedir("/users/me", { token: sesion.token });

    // Assert
    expect(res.body.data).not.toHaveProperty("password");
  });

  test("CP-SEG-CRED-04", "RN-012 — PUT /users/:id no permite escalar el rol a ADMIN", async () => {
    // Arrange
    const sesion = await registrarUsuario();

    // Act: intenta auto-promoverse a ADMIN
    const res = await pedir(`/users/${sesion.userId}`, {
      method: "PUT",
      token: sesion.token,
      body: { firstName: "Hacker", role: "ADMIN" },
    });
    const perfil = await pedir("/users/me", { token: sesion.token });

    // Assert: el rol sigue siendo CUSTOMER
    expect(res.status).toBe(200);
    expect(perfil.body.data.role).toBe("CUSTOMER");
  });

  test("CP-SEG-CRED-05", "ESC36/RN-011 — un usuario no puede editar el perfil de otro (403)", async () => {
    // Arrange
    const a = await registrarUsuario();
    const b = await registrarUsuario();

    // Act
    const res = await pedir(`/users/${b.userId}`, { method: "PUT", token: a.token, body: { city: "Hackeada" } });

    // Assert
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

describe("Seguridad · Manejo uniforme de errores y configuración", () => {
  test("CP-SEG-ERR-01", "ESC41/RN-062 — los errores usan el sobre {success:false,error}", async () => {
    // Act
    const res = await pedir("/products/cnoexistexxxxxxxxxxxxxxx");

    // Assert
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("success", false);
    expect(typeof res.body.error).toBe("string");
  });

  test("CP-SEG-ERR-02", "ESC41 — en producción las respuestas de error NO filtran el stack trace", async () => {
    // Act: provoca un error de validación (400)
    const res = await pedir("/users/register", {
      method: "POST",
      body: { email: "no-es-correo", password: claveCorta() },
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).not.toHaveProperty("stack");
    expect(JSON.stringify(res.body)).not.toMatch(/\.ts:\d+|at\s+\w+\s+\(/);
  });

  test("CP-SEG-ERR-03", "ESC41/RN-063 — JSON malformado se maneja con el sobre uniforme (400)", async () => {
    // Act: cuerpo que no es JSON válido
    const res = await fetch(`${(process.env.API_URL || "http://localhost:5000").replace(/\/$/, "")}/api/v1/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"email": roto',
    });
    const cuerpo = await res.json();

    // Assert
    expect(res.status).toBe(400);
    expect(cuerpo).toHaveProperty("success", false);
  });

  test("CP-SEG-CFG-01", "Config — no se expone la cabecera X-Powered-By", async () => {
    // Act
    const res = await pedir("/categories");

    // Assert
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  test("CP-SEG-CFG-02", "Config — existe un límite de tamaño de cuerpo (payload grande = 413)", async () => {
    // Arrange: ~1.5 MB de JSON, por encima del límite por defecto de Express (100 kb)
    const grande = "a".repeat(1_500_000);

    // Act
    const res = await pedir("/users/login", { method: "POST", body: { email: "a@b.co", password: grande } });

    // Assert: el límite existe (no es un defecto); se rechaza antes de procesar
    expect(res.status).toBe(413);
  });

  test("CP-SEG-CORS-01", "ESC36 — CORS refleja exactamente el origen permitido, nunca el comodín *", async () => {
    // Act
    const res = await fetch(`${(process.env.API_URL || "http://localhost:5000").replace(/\/$/, "")}/api/v1/categories`, {
      headers: { Origin: "http://localhost:3000" },
    });

    // Assert
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(res.headers.get("access-control-allow-origin")).not.toBe("*");
  });

  test("CP-SEG-CORS-02", "ESC36 — CORS no refleja un origen ajeno a la lista blanca", async () => {
    // Act
    const res = await fetch(`${(process.env.API_URL || "http://localhost:5000").replace(/\/$/, "")}/api/v1/categories`, {
      headers: { Origin: "https://atacante.example" },
    });

    // Assert
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
