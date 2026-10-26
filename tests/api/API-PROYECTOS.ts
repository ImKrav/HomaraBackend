// ============================================================================
// Pruebas de API en vivo — Proyectos (/projects)
// ESC17 crear proyecto · ESC36 autorización por recurso · RN-011 propiedad
// ============================================================================

import { test, expect, describe } from "../harness.js";
import { pedir, registrarUsuario } from "./soporte-api.js";

/** Crea un proyecto de piso con área válida para el usuario dado. */
async function crearProyecto(token: string, nombre = "Proyecto QA") {
  return pedir("/projects", {
    method: "POST",
    token,
    body: { name: nombre, type: "PISO", area: 20 },
  });
}

describe("API · Proyectos", () => {
  test("CP-API-PROY-01", "ESC17 — crea un proyecto y calcula materiales (201)", async () => {
    // Arrange
    const sesion = await registrarUsuario();

    // Act
    const res = await crearProyecto(sesion.token);

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data).toHaveProperty("materials");
  });

  test("CP-API-PROY-02", "ESC17 — crear proyecto sin token se rechaza (401)", async () => {
    // Act
    const res = await pedir("/projects", { method: "POST", body: { name: "X", type: "PISO", area: 10 } });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("CP-API-PROY-03", "ESC17/RN-063 — tipo inválido se rechaza con 400", async () => {
    // Arrange
    const sesion = await registrarUsuario();

    // Act
    const res = await pedir("/projects", {
      method: "POST",
      token: sesion.token,
      body: { name: "X", type: "SUBSUELO", area: 10 },
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("CP-API-PROY-04", "ESC17/RN-063 — área no positiva se rechaza (400)", async () => {
    // Arrange
    const sesion = await registrarUsuario();

    // Act
    const res = await pedir("/projects", {
      method: "POST",
      token: sesion.token,
      body: { name: "X", type: "PISO", area: 0 },
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("CP-API-PROY-05", "ESC17 — el usuario lista solo sus proyectos", async () => {
    // Arrange
    const sesion = await registrarUsuario();
    const creado = await crearProyecto(sesion.token, "Mi Proyecto");

    // Act
    const lista = await pedir("/projects", { token: sesion.token });

    // Assert
    expect(lista.status).toBe(200);
    expect(lista.body.data.some((p: any) => p.id === creado.body.data.id)).toBe(true);
  });

  test("CP-API-PROY-06", "ESC17/RN-062 — proyecto inexistente responde 404", async () => {
    // Arrange (el detalle exige sesión desde la corrección de CP-SEG-DEF-07)
    const sesion = await registrarUsuario();

    // Act
    const res = await pedir("/projects/cnoexistexxxxxxxxxxxxxxx", { token: sesion.token });

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Proyecto no encontrado");
  });

  test("CP-API-PROY-07", "ESC36/RN-011 — un usuario no puede editar el proyecto de otro (403)", async () => {
    // Arrange
    const dueno = await registrarUsuario();
    const ajeno = await registrarUsuario();
    const creado = await crearProyecto(dueno.token);

    // Act
    const res = await pedir(`/projects/${creado.body.data.id}`, {
      method: "PUT",
      token: ajeno.token,
      body: { name: "Secuestrado" },
    });

    // Assert
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("CP-API-PROY-08", "ESC36/RN-011 — un usuario no puede borrar el proyecto de otro (403)", async () => {
    // Arrange
    const dueno = await registrarUsuario();
    const ajeno = await registrarUsuario();
    const creado = await crearProyecto(dueno.token);

    // Act
    const res = await pedir(`/projects/${creado.body.data.id}`, { method: "DELETE", token: ajeno.token });

    // Assert
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("CP-API-PROY-09", "ESC17/RN-011 — el dueño edita y borra su propio proyecto (200)", async () => {
    // Arrange
    const sesion = await registrarUsuario();
    const creado = await crearProyecto(sesion.token);

    // Act
    const edit = await pedir(`/projects/${creado.body.data.id}`, {
      method: "PUT",
      token: sesion.token,
      body: { name: "Renombrado QA" },
    });
    const del = await pedir(`/projects/${creado.body.data.id}`, { method: "DELETE", token: sesion.token });

    // Assert
    expect(edit.status).toBe(200);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);
  });
});
