// ============================================================================
// Arnés de pruebas manuales — sin framework, sin librería de mocks.
//
// Cada archivo `tests/F-*.ts` registra sus casos con `test(id, desc, fn)` y
// `tests/run-all.ts` los ejecuta con `run()`. Las aserciones son las de
// `node:assert/strict` envueltas en nombres cortos. No hay watch ni cobertura:
// se corre entero con `npm test` (o `npm test -- F-CHK` para filtrar por id).
// ============================================================================

import {
  deepStrictEqual,
  strictEqual,
  notStrictEqual,
  ok as nodeOk,
  match as nodeMatch,
} from "node:assert/strict";

export type TestFn = () => void | Promise<void>;
type Caso = { id: string; desc: string; fn: TestFn };

const casos: Caso[] = [];

let softErrors: string[] = [];

/**
 * Aserción "blanda": registra el fallo pero no aborta el caso, para poder
 * documentar varios defectos en un mismo test (equivale a `expect.soft`).
 * Al final del caso, si hubo alguno, el caso se marca como fallido.
 */
export function soft(fn: () => void): void {
  try {
    fn();
  } catch (e) {
    softErrors.push(e instanceof Error ? e.message : String(e));
  }
}

/** Registra un caso de prueba. El `id` es el identificador del plan (CP-F-...). */
export function test(id: string, desc: string, fn: TestFn): void {
  casos.push({ id, desc, fn });
}

/** Ejecuta los casos registrados. Filtro opcional por `process.argv[2]`. */
export async function run(): Promise<void> {
  const filtro = process.argv[2];
  const lista = filtro ? casos.filter((c) => c.id.includes(filtro)) : casos;

  let ok = 0;
  const fallos: string[] = [];

  for (const c of lista) {
    try {
      softErrors = [];
      await c.fn();
      if (softErrors.length) {
        throw new Error(softErrors.join("\n       ---\n"));
      }
      console.log(`[PASS] ${c.id}  ${c.desc}`);
      ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.stack ?? e.message : String(e);
      console.log(`[FAIL] ${c.id}  ${c.desc}`);
      console.log("       " + msg.replace(/\n/g, "\n       "));
      fallos.push(c.id);
    }
  }

  console.log(`\n${ok} passed, ${fallos.length} failed  (${lista.length} total)`);
  if (fallos.length) {
    console.log("Fallaron: " + fallos.join(", "));
    process.exit(1);
  }
}

// --- Aserciones -------------------------------------------------------------

/** Igualdad profunda (objetos, arrays, primitivos). */
export const eq = (actual: unknown, esperado: unknown, msg?: string) =>
  deepStrictEqual(actual, esperado, msg);

/** Igualdad estricta por referencia / primitivo (===). */
export const is = (actual: unknown, esperado: unknown, msg?: string) =>
  strictEqual(actual, esperado, msg);

/** Desigualdad estricta (!==). */
export const isNot = (actual: unknown, esperado: unknown, msg?: string) =>
  notStrictEqual(actual, esperado, msg);

/** El valor es truthy. */
export const ok = (valor: unknown, msg?: string) => nodeOk(valor, msg);

/** El string cumple la expresión regular. */
export const matches = (texto: string, re: RegExp, msg?: string) =>
  nodeMatch(texto, re, msg);

/** `contenedor` (string o array) incluye `parte`. */
export function has(contenedor: string | readonly unknown[], parte: unknown, msg?: string) {
  const dentro =
    typeof contenedor === "string"
      ? contenedor.includes(parte as string)
      : contenedor.includes(parte);
  nodeOk(dentro, msg ?? `Se esperaba encontrar ${rep(parte)} en ${rep(contenedor)}`);
}

/** `contenedor` (string o array) NO incluye `parte`. */
export function hasNot(contenedor: string | readonly unknown[], parte: unknown, msg?: string) {
  const dentro =
    typeof contenedor === "string"
      ? contenedor.includes(parte as string)
      : contenedor.includes(parte);
  nodeOk(!dentro, msg ?? `No se esperaba ${rep(parte)} en ${rep(contenedor)}`);
}

/** `actual` contiene al menos las claves/valores de `esperado` (match parcial). */
export function subset(actual: Record<string, unknown>, esperado: Record<string, unknown>, msg?: string) {
  for (const clave of Object.keys(esperado)) {
    deepStrictEqual(actual?.[clave], esperado[clave], msg ?? `Campo "${clave}"`);
  }
}

// --- Captura de errores ---------------------------------------------------

/** Espera que la promesa rechace y devuelve el error para inspeccionarlo. */
export async function grab(p: Promise<unknown>): Promise<any> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error("Se esperaba un error y la operación terminó bien.");
}

/** Espera que la función lance y devuelve el error para inspeccionarlo. */
export function grabSync(fn: () => unknown): any {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error("Se esperaba un error y la función no lanzó.");
}

function rep(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
