// Soporte de la suite de regresión HTTP (no contiene casos; excluido del include).
//
// Cada archivo REG-* mockea los repositorios Prisma con `vi.mock()` (tiene que
// ir en el propio archivo de pruebas para que Vitest lo eleve) y usa estas
// funciones para hablar con la app Express real por HTTP.

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import app from "../../src/infrastructure/http/express-server.js";
import { generateToken } from "../../src/shared/utils/authHelper.js";
import { mockUsuarios } from "../mocks/repositorios.js";
import { usuario } from "../helpers.js";

export interface Respuesta {
  status: number;
  body: any;
}

/** Levanta la app en un puerto libre, hace una petición JSON y cierra el servidor. */
export async function pedir(
  metodo: "GET" | "POST" | "PUT" | "DELETE",
  ruta: string,
  { token, body }: { token?: string; body?: unknown } = {},
): Promise<Respuesta> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`http://127.0.0.1:${port}${ruta}`, {
      method: metodo,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

/**
 * Prepara una sesión: firma un JWT real y programa el repositorio de usuarios
 * para que el middleware de auth (que siempre relee al usuario) lo encuentre.
 */
export function sesion(over: Record<string, any> = {}): { token: string; user: ReturnType<typeof usuario> } {
  const user = usuario(over);
  mockUsuarios.findById.mockImplementation(async (id: string) => (id === user.id ? user : null));
  return { token: generateToken({ id: user.id, email: user.email, role: user.role }), user };
}

/** IDs con formato CUID válido para las rutas que lo validan. */
export const CUID = {
  producto: "cprd0000000000000000000a1",
  producto2: "cprd0000000000000000000b2",
  item: "citm0000000000000000000a1",
  pedido: "cped0000000000000000000a1",
  proyecto: "cpry0000000000000000000a1",
};
