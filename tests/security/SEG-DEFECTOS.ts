// ============================================================================
// Revisión defensiva de seguridad — DEFECTOS CONOCIDOS (ESC36/ESC35/ESC06)
//
// Cada caso AFIRMA el comportamiento SEGURO esperado y está marcado con
// `test.fails(...)`: mientras el defecto siga abierto el caso queda en VERDE
// (se espera que falle). El día que se corrija el código, el caso se pondrá
// ROJO con «expected to fail, but passed» → señal de devolverlo a `test(...)`.
//
// Severidad y recomendación de corrección: ver docs/pruebas/SEGURIDAD.md.
// ============================================================================

import { test, expect, describe } from "../harness.js";
import {
  pedir,
  iniciarSesion,
  registrarUsuario,
  unProductoId,
  firmarTokenConSecretoPorDefecto,
  SEMILLA,
  claveDePrueba,
} from "../api/soporte-api.js";

/** Registra una víctima con un pedido y un proyecto propios; devuelve sus ids. */
async function victimaConRecursos() {
  const v = await registrarUsuario();
  const pid = await unProductoId();
  await pedir("/cart/items", { method: "POST", token: v.token, body: { productId: pid, quantity: 1 } });
  const orden = await pedir("/orders", { method: "POST", token: v.token, body: { paymentMethod: "tarjeta" } });
  const proyecto = await pedir("/projects", { method: "POST", token: v.token, body: { name: "Privado", type: "PISO", area: 15 } });
  const detalle = await pedir(`/orders/${orden.body.data.orderNumber}`);
  return {
    sesion: v,
    orderNumber: orden.body.data.orderNumber,
    orderDbId: detalle.body.data.dbId,
    projectId: proyecto.body.data.id,
  };
}

describe("Seguridad · Defectos conocidos (afirman el comportamiento seguro)", () => {
  // ── DEF-SEG-01 · Secreto JWT embebido ─────────────────────────────────────
  test.fails(
    "CP-SEG-DEF-01",
    "ESC35 (Alta) — un token de ADMIN forjado con el secreto por defecto NO debe ser aceptado",
    async () => {
      // Arrange: token firmado a mano con el secreto embebido en authHelper.ts
      const forjado = await firmarTokenConSecretoPorDefecto({
        id: SEMILLA.admin.id,
        email: SEMILLA.admin.email,
        role: "ADMIN",
      });

      // Act
      const res = await pedir("/admin/metrics", { token: forjado });

      // Assert (seguro): debería rechazarse; hoy responde 200 porque el secreto es conocido.
      expect(res.status).toBe(401);
    },
  );

  // ── DEF-SEG-02 · ?admin=true honrado para cualquier autenticado ───────────
  test.fails(
    "CP-SEG-DEF-02",
    "ESC36 (Alta) — ?admin=true NO debe listar todos los pedidos a un CUSTOMER",
    async () => {
      // Arrange
      const cliente = await registrarUsuario();

      // Act
      const res = await pedir("/orders?admin=true", { token: cliente.token });

      // Assert (seguro): un cliente sólo debería ver SUS pedidos (0 recién registrado).
      // Hoy devuelve TODOS los pedidos del sistema.
      expect(res.body.data.length).toBe(0);
    },
  );

  // ── DEF-SEG-03 · /orders?userId=X sin token ───────────────────────────────
  test.fails(
    "CP-SEG-DEF-03",
    "ESC36 (Alta) — GET /orders?userId=<ajeno> sin token NO debe filtrar pedidos de otro usuario",
    async () => {
      // Arrange
      const victima = await victimaConRecursos();

      // Act: sin ningún token, pidiendo por el userId de la víctima
      const res = await pedir(`/orders?userId=${victima.sesion.userId}`);

      // Assert (seguro): sin sesión no debería devolver pedidos ajenos.
      expect(res.body.data.length).toBe(0);
    },
  );

  // ── DEF-SEG-04 · /projects?userId=X sin token ─────────────────────────────
  test.fails(
    "CP-SEG-DEF-04",
    "ESC36 (Alta) — GET /projects?userId=<ajeno> sin token NO debe filtrar proyectos de otro usuario",
    async () => {
      // Arrange
      const victima = await victimaConRecursos();

      // Act
      const res = await pedir(`/projects?userId=${victima.sesion.userId}`);

      // Assert (seguro)
      expect(res.body.data.length).toBe(0);
    },
  );

  // ── DEF-SEG-05 · /cart?userId=X sin token ─────────────────────────────────
  test.fails(
    "CP-SEG-DEF-05",
    "ESC36 (Media) — GET /cart?userId=<ajeno> sin token NO debe exponer el carrito de otro usuario",
    async () => {
      // Arrange: víctima con un ítem en el carrito, SIN hacer checkout
      const v = await registrarUsuario();
      const pid = await unProductoId();
      await pedir("/cart/items", { method: "POST", token: v.token, body: { productId: pid, quantity: 2 } });

      // Act
      const res = await pedir(`/cart?userId=${v.userId}`);

      // Assert (seguro): sin sesión no debería ver el carrito ajeno.
      expect(res.body.data.items.length).toBe(0);
    },
  );

  // ── DEF-SEG-06 · GET /orders/:id sin auth ni propiedad ────────────────────
  test.fails(
    "CP-SEG-DEF-06",
    "ESC36 (Alta) — GET /orders/:id sin token NO debe exponer el detalle ni el PII del cliente",
    async () => {
      // Arrange
      const victima = await victimaConRecursos();

      // Act: cualquiera lee el pedido por su id, sin token
      const res = await pedir(`/orders/${victima.orderDbId}`);

      // Assert (seguro): debería exigir sesión/propiedad.
      expect(res.status).toBe(401);
    },
  );

  // ── DEF-SEG-07 · GET /projects/:id sin auth ni propiedad ──────────────────
  test.fails(
    "CP-SEG-DEF-07",
    "ESC36 (Alta) — GET /projects/:id sin token NO debe exponer el proyecto de otro usuario",
    async () => {
      // Arrange
      const victima = await victimaConRecursos();

      // Act
      const res = await pedir(`/projects/${victima.projectId}`);

      // Assert (seguro)
      expect(res.status).toBe(401);
    },
  );

  // ── DEF-SEG-08 · GET /users/:id expone PII sin propiedad ──────────────────
  test.fails(
    "CP-SEG-DEF-08",
    "ESC36 (Alta) — GET /users/:id NO debe exponer el PII (teléfono/dirección) de otro usuario",
    async () => {
      // Arrange: víctima registrada con teléfono
      const victima = await registrarUsuario({ phone: "300 111 2222" });
      // Atacante autenticado como otro usuario cualquiera
      const atacante = await iniciarSesion(SEMILLA.juan.email, SEMILLA.juan.password);

      // Act
      const res = await pedir(`/users/${victima.userId}`, { token: atacante.token });

      // Assert (seguro): no debería entregar el perfil ajeno (403) ni su teléfono.
      expect(res.status).toBe(403);
    },
  );

  // ── DEF-SEG-09 · PUT /users/:id devuelve el hash de la contraseña ─────────
  test.fails(
    "CP-SEG-DEF-09",
    "ESC35 (Alta) — PUT /users/:id NO debe devolver la entidad con el hash de la contraseña",
    async () => {
      // Arrange
      const sesion = await registrarUsuario();

      // Act
      const res = await pedir(`/users/${sesion.userId}`, {
        method: "PUT",
        token: sesion.token,
        body: { city: "Cali" },
      });

      // Assert (seguro): la respuesta no debería contener el campo password.
      expect(res.body.data).not.toHaveProperty("password");
    },
  );

  // ── DEF-SEG-10 · Sin cabeceras de seguridad (helmet) ──────────────────────
  test.fails(
    "CP-SEG-DEF-10",
    "ESC35 (Media) — deberían existir cabeceras de seguridad (p. ej. X-Content-Type-Options)",
    async () => {
      // Act
      const res = await pedir("/categories");

      // Assert (seguro): helmet añadiría nosniff; hoy no está presente.
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    },
  );

  // ── DEF-SEG-11 · Sin límite de intentos en el login ───────────────────────
  test.fails(
    "CP-SEG-DEF-11",
    "ESC35 (Media) — el login debería limitar intentos (rate limiting) tras muchos fallos",
    async () => {
      // Arrange: 25 intentos fallidos rápidos
      const intentos = 25;

      // Act
      let huboBloqueo = false;
      for (let i = 0; i < intentos; i++) {
        const res = await pedir("/users/login", {
          method: "POST",
          body: { email: SEMILLA.juan.email, password: claveDePrueba() },
        });
        if (res.status === 429) {
          huboBloqueo = true;
          break;
        }
      }

      // Assert (seguro): alguno debería haber sido bloqueado con 429.
      expect(huboBloqueo).toBe(true);
    },
  );
});
