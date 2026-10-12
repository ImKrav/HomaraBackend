// Lógica compartida de las pruebas de rendimiento k6 para la API de Homara.
import http from "k6/http";
import { check } from "k6";
import { Trend } from "k6/metrics";

export const API = `${__ENV.API_URL || "http://host.docker.internal:5000"}/api/v1`;

// Trends por tipo de operación, para fijar umbrales independientes.
export const durLectura = new Trend("dur_lectura", true);
export const durLogin = new Trend("dur_login", true);
export const durAutenticado = new Trend("dur_autenticado", true);

// Umbrales = criterios de aceptación (ESC38 rendimiento bajo concurrencia).
export const umbrales = {
  http_req_failed: ["rate<0.01"], // menos del 1% de errores
  dur_lectura: ["p(95)<500"], // lecturas públicas p95 < 500 ms
  dur_login: ["p(95)<1000"], // login (bcrypt) p95 < 1000 ms
  dur_autenticado: ["p(95)<800"], // flujo autenticado p95 < 800 ms
};

const SEMILLA = { email: "juan@email.com", password: "123456" };

/** Recorre los endpoints públicos de lectura principales. */
export function flujoPublico() {
  const cats = http.get(`${API}/categories`, { tags: { tipo: "lectura" } });
  durLectura.add(cats.timings.duration);
  check(cats, { "categories 200": (r) => r.status === 200 });

  const prods = http.get(`${API}/products`, { tags: { tipo: "lectura" } });
  durLectura.add(prods.timings.duration);
  check(prods, { "products 200": (r) => r.status === 200 });

  const store = http.get(`${API}/products/storefront`, { tags: { tipo: "lectura" } });
  durLectura.add(store.timings.duration);
  check(store, { "storefront 200": (r) => r.status === 200 });

  // Detalle de un producto (si la lista trajo alguno).
  try {
    const lista = prods.json("data");
    if (Array.isArray(lista) && lista.length > 0) {
      const id = lista[0].id;
      const det = http.get(`${API}/products/${id}`, { tags: { tipo: "lectura" } });
      durLectura.add(det.timings.duration);
      check(det, { "product detail 200": (r) => r.status === 200 });
    }
  } catch (_e) {
    // ignorar parseo si la respuesta no fue JSON
  }
}

/** Inicia sesión (mide el costo de bcrypt) y devuelve el token, o null. */
export function flujoLogin() {
  const res = http.post(`${API}/users/login`, JSON.stringify(SEMILLA), {
    headers: { "Content-Type": "application/json" },
    tags: { tipo: "login" },
  });
  durLogin.add(res.timings.duration);
  check(res, { "login 200": (r) => r.status === 200 });
  try {
    return res.json("data").token;
  } catch (_e) {
    return null;
  }
}

/** Flujo autenticado de solo lectura: perfil + carrito. */
export function flujoAutenticado(token) {
  if (!token) return;
  const h = { headers: { Authorization: `Bearer ${token}` }, tags: { tipo: "autenticado" } };

  const me = http.get(`${API}/users/me`, h);
  durAutenticado.add(me.timings.duration);
  check(me, { "me 200": (r) => r.status === 200 });

  const cart = http.get(`${API}/cart`, h);
  durAutenticado.add(cart.timings.duration);
  check(cart, { "cart 200": (r) => r.status === 200 });
}
