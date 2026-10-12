// ============================================================================
// Pruebas de API en vivo — Autenticación y usuarios (/users, /auth)
// ESC01 registrar usuario · ESC02 iniciar sesión · ESC35 seguridad credenciales
// ============================================================================

import { test, expect, describe } from "../harness.js";
import { pedir, iniciarSesion, registrarUsuario, sello, SEMILLA, claveDePrueba, claveCorta } from "./soporte-api.js";

describe("API · Autenticación y usuarios", () => {
  test("CP-API-AUTH-01", "ESC01 · RN-001 · RN-002 — registro válido responde 201 con la sesión del usuario", async () => {
    // Arrange
    const email = `qa_${sello()}@test.local`;

    // Act
    const res = await pedir("/users/register", {
      method: "POST",
      body: { email, password: claveDePrueba(), firstName: "Nora", lastName: "QA" },
    });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.role).toBe("CUSTOMER");
  });

  test("CP-API-AUTH-02", "ESC01/RN-005 — el registro nunca devuelve la contraseña", async () => {
    // Arrange
    const email = `qa_${sello()}@test.local`;
    const clave = claveDePrueba();

    // Act
    const res = await pedir("/users/register", {
      method: "POST",
      body: { email, password: clave, firstName: "Nora", lastName: "QA" },
    });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.data.user).not.toHaveProperty("password");
    expect(JSON.stringify(res.body)).not.toContain(clave);
  });

  test("CP-API-AUTH-03", "ESC01/RN-004 — el correo se normaliza a minúsculas", async () => {
    // Arrange
    const base = `qa_${sello()}@test.local`;
    const email = base.toUpperCase();

    // Act
    const res = await pedir("/users/register", {
      method: "POST",
      body: { email, password: claveDePrueba(), firstName: "Nora", lastName: "QA" },
    });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(base.toLowerCase());
  });

  test("CP-API-AUTH-04", "ESC01 · RN-002 · RN-063 — rechaza clave de menos de 8 caracteres con 400", async () => {
    // Arrange
    const email = `qa_${sello()}@test.local`;

    // Act
    const res = await pedir("/users/register", {
      method: "POST",
      body: { email, password: claveCorta(), firstName: "Nora", lastName: "QA" },
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("contraseña");
  });

  test("CP-API-AUTH-05", "ESC01/RN-001 — rechaza correo con formato inválido (400)", async () => {
    // Act
    const res = await pedir("/users/register", {
      method: "POST",
      body: { email: "no-es-correo", password: claveDePrueba(), firstName: "N", lastName: "Q" },
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("CP-API-AUTH-06", "ESC01/RN-003 — rechaza correo duplicado (400)", async () => {
    // Arrange
    const sesion = await registrarUsuario();

    // Act
    const res = await pedir("/users/register", {
      method: "POST",
      body: { email: sesion.email, password: claveDePrueba(), firstName: "Dup", lastName: "Q" },
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.toLowerCase()).toContain("registrado");
  });

  test("CP-API-AUTH-07", "ESC02 — inicia sesión con credenciales correctas (200)", async () => {
    // Act
    const res = await pedir("/users/login", {
      method: "POST",
      body: { email: SEMILLA.juan.email, password: SEMILLA.juan.password },
    });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.user).not.toHaveProperty("password");
  });

  test("CP-API-AUTH-08", "ESC02/RN-006 — error genérico con contraseña incorrecta (401)", async () => {
    // Act
    const res = await pedir("/users/login", {
      method: "POST",
      body: { email: SEMILLA.juan.email, password: claveDePrueba() },
    });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Credenciales incorrectas. Verifique correo y contraseña.");
  });

  test("CP-API-AUTH-09", "ESC02/RN-006 — mismo error genérico con correo inexistente (401)", async () => {
    // Act
    const res = await pedir("/users/login", {
      method: "POST",
      body: { email: `nadie_${sello()}@test.local`, password: claveDePrueba() },
    });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Credenciales incorrectas. Verifique correo y contraseña.");
  });

  test("CP-API-AUTH-10", "ESC02 — GET /users/me devuelve el perfil del usuario autenticado", async () => {
    // Arrange
    const sesion = await iniciarSesion(SEMILLA.juan.email, SEMILLA.juan.password);

    // Act
    const res = await pedir("/users/me", { token: sesion.token });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(SEMILLA.juan.id);
    expect(res.body.data).not.toHaveProperty("password");
    expect(res.body.data).toHaveProperty("projectCount");
    expect(res.body.data).toHaveProperty("orderCount");
  });

  test("CP-API-AUTH-11", "RN-007 — el token expira a 7 días (campo exp del JWT)", async () => {
    // Arrange
    const sesion = await iniciarSesion(SEMILLA.juan.email, SEMILLA.juan.password);

    // Act
    const [, payloadB64] = sesion.token.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());

    // Assert
    const dias = (payload.exp - payload.iat) / 86400;
    expect(dias).toBe(7);
  });

  test("CP-API-AUTH-12", "ESC36/RN-011 — un usuario puede editar su propio perfil (200)", async () => {
    // Arrange
    const sesion = await registrarUsuario();

    // Act
    const res = await pedir(`/users/${sesion.userId}`, {
      method: "PUT",
      token: sesion.token,
      body: { city: "Medellín" },
    });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
