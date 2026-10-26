// ============================================================================
// Soporte compartido para las pruebas en vivo (API y seguridad).
//
// No hay mocks: todo golpea la API real en API_URL (por defecto
// http://localhost:5000) con el fetch nativo de Node. Este archivo queda fuera
// del `include` de Vitest (no es *.test ni empieza por un id de caso; además los
// configs sólo incluyen tests/api/**/*.ts y tests/security/**/*.ts, y Vitest no
// lo ejecuta como suite porque no registra ningún caso).
//
// Convenciones del proyecto: patrón AAA, aserciones fluidas de Vitest, y los ids
// de caso/escenario (ESC/RN) van en el nombre de cada prueba.
// ============================================================================

import { randomUUID } from "node:crypto";

export const BASE_URL = (process.env.API_URL || "http://localhost:5000").replace(/\/$/, "");
export const API = `${BASE_URL}/api/v1`;

/**
 * Contraseñas de prueba generadas en tiempo de ejecución: el código de las pruebas
 * no contiene credenciales fijas (evita falsos positivos de los escáneres de secretos).
 */
export const claveDePrueba = (): string => `Qa-${randomUUID()}`; // válida (>= 8 caracteres)
export const claveCorta = (): string => randomUUID().slice(0, 3); // viola RN-002 (< 8)

/** Sello de tiempo único para no colisionar con datos sembrados ni de otras ejecuciones. */
export function sello(): string {
  return `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export interface RespuestaHttp<T = any> {
  status: number;
  ok: boolean;
  body: T;
  headers: Headers;
}

interface OpcionesPeticion {
  method?: string;
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Si es true, no se parsea el cuerpo como JSON (para texto/errores de Express). */
  raw?: boolean;
}

/** Realiza una petición HTTP a la API y normaliza la respuesta. */
export async function pedir<T = any>(ruta: string, opciones: OpcionesPeticion = {}): Promise<RespuestaHttp<T>> {
  const { method = "GET", token, body, headers = {}, raw = false } = opciones;
  const h: Record<string, string> = { ...headers };
  if (token) h["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) h["Content-Type"] = "application/json";

  const url = ruta.startsWith("http") ? ruta : `${API}${ruta}`;
  const res = await fetch(url, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let parsed: any = null;
  const texto = await res.text();
  if (!raw && texto) {
    try {
      parsed = JSON.parse(texto);
    } catch {
      parsed = texto;
    }
  } else {
    parsed = texto;
  }

  return { status: res.status, ok: res.ok, body: parsed as T, headers: res.headers };
}

/** Datos de los usuarios sembrados (todos con clave 123456). */
export const SEMILLA = {
  admin: { email: "admin@homara.co", password: "123456", id: "admin-001" },
  juan: { email: "juan@email.com", password: "123456", id: "demo-user-001" },
  carlos: { email: "carlos@email.com", password: "123456", id: "user-carlos" },
  maria: { email: "maria@email.com", password: "123456", id: "user-maria" },
};

export interface Sesion {
  token: string;
  userId: string;
  email: string;
  role: string;
}

/** Inicia sesión con un usuario sembrado y devuelve token + datos. */
export async function iniciarSesion(email: string, password: string): Promise<Sesion> {
  const res = await pedir("/users/login", { method: "POST", body: { email, password } });
  if (res.status !== 200) {
    throw new Error(`No se pudo iniciar sesión como ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    token: res.body.data.token,
    userId: res.body.data.user.id,
    email: res.body.data.user.email,
    role: res.body.data.user.role,
  };
}

/** Registra un usuario CUSTOMER nuevo con correo único y devuelve su sesión. */
export async function registrarUsuario(
  extra: Partial<{ firstName: string; lastName: string; phone: string }> = {},
): Promise<Sesion & { email: string }> {
  const email = `qa_${sello()}@test.local`;
  const res = await pedir("/users/register", {
    method: "POST",
    body: {
      email,
      password: claveDePrueba(),
      firstName: extra.firstName ?? "QA",
      lastName: extra.lastName ?? "Tester",
      ...(extra.phone ? { phone: extra.phone } : {}),
    },
  });
  if (res.status !== 201) {
    throw new Error(`No se pudo registrar usuario de prueba: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    email,
    token: res.body.data.token,
    userId: res.body.data.user.id,
    role: res.body.data.user.role,
  };
}

/** Devuelve el id de un producto cualquiera del catálogo (para carrito/reseñas). */
export async function unProductoId(): Promise<string> {
  const res = await pedir("/products");
  return res.body.data[0].id;
}

/** Devuelve el id de una categoría (para crear productos admin). */
export async function unaCategoriaId(): Promise<string> {
  const res = await pedir("/categories");
  return res.body.data[0].id;
}

/**
 * Secreto con el que firma el backend bajo prueba. Desde la refactorización no
 * hay valor por defecto: las pruebas que necesitan una firma VÁLIDA (token
 * expirado, usuario inexistente) lo leen del entorno, igual que el servidor.
 */
export function secretoDelServidor(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("Defina JWT_SECRET con el mismo valor que usa el backend.");
  return s;
}

/**
 * Firma un JWT HS256 a mano con el secreto por defecto (ya revocado), sin
 * dependencias. Se usa SÓLO en la revisión de seguridad para demostrar, de forma
 * defensiva sobre el propio stack del equipo, el riesgo del secreto embebido.
 */
export async function firmarTokenConSecretoPorDefecto(
  payload: Record<string, unknown>,
  expSegundos = 7 * 24 * 60 * 60,
  secreto = "homara_jwt_secret_key_2026_secure",
): Promise<string> {
  const { createHmac } = await import("node:crypto");
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo = { ...payload, iat: ahora, exp: ahora + expSegundos };
  const datos = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(cuerpo)}`;
  const firma = createHmac("sha256", secreto).update(datos).digest("base64url");
  return `${datos}.${firma}`;
}
