// ============================================================================
// Arnés sobre Vitest.
//
// Los archivos `tests/F-*.ts` y `tests/unit-*.ts` siguen registrando casos con
// `test(id, desc, fn)`; acá eso se delega a `it()` de Vitest, que además provee
// el runner (paralelo por archivo), watch, filtros y cobertura.
//
//   npx vitest                      # watch
//   npm test                        # run completo
//   npm test -- tests/F-CHK-01.ts   # un archivo
//   npm test -- -t CP-F-AUTH-01-02  # un caso por id
//
// Las aserciones son fluidas (fluent assertions) con el `expect` de Vitest:
//
//   expect(total).toBe(38_900)
//   expect(error).toBeInstanceOf(AppError)
//   expect(nombres).not.toContain("Boquilla")
//   expect.soft(valor).toBe(x)   // no aborta el caso; lo marca fallido al final
//
// Acá solo quedan `test` y los capturadores `grab`/`grabSync`, que se usan en
// el Act para que el Assert inspeccione el error con `expect`.
// ============================================================================

import { it } from "vitest";

export { expect, vi, describe, beforeEach, afterEach, beforeAll, afterAll } from "vitest";

export type TestFn = () => void | Promise<void>;

interface RegistrarCaso {
  /** Registra un caso en Vitest. El `id` es el identificador del plan (CP-F-...). */
  (id: string, desc: string, fn: TestFn): void;
  /**
   * Caso que documenta un **defecto abierto**: se espera que falle, así que la
   * suite queda en verde mientras el defecto siga ahí (ver la tabla de defectos
   * en `tests/README.md`).
   *
   * Ojo con la inversión: el día que alguien corrija el defecto, este caso se
   * pone **rojo** — es la señal de que hay que devolverlo a `test(...)` normal.
   */
  fails(id: string, desc: string, fn: TestFn): void;
}

export const test: RegistrarCaso = Object.assign(
  (id: string, desc: string, fn: TestFn): void => {
    it(`${id}  ${desc}`, fn);
  },
  {
    fails(id: string, desc: string, fn: TestFn): void {
      it.fails(`${id}  ${desc}`, fn);
    },
  },
);

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
