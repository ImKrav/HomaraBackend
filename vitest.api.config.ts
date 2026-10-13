import { defineConfig } from "vitest/config";

// ============================================================================
// Config de las pruebas de API en vivo (HTTP real contra el stack levantado).
//
// Estas pruebas NO usan mocks: golpean la API real en API_URL
// (por defecto http://localhost:5000) con fetch nativo de Node. Por eso viven
// fuera del `vitest run` por defecto (que corre con CI sin servidor) y se
// ejecutan con `npm run test:api`.
// ============================================================================
export default defineConfig({
  test: {
    include: ["tests/api/**/*.ts"],
    exclude: ["tests/api/soporte-api.ts"],
    // Secuencial: las pruebas crean/borran datos propios y comparten el stack
    // con otras pruebas; evitamos carreras entre archivos.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: ["verbose"],
  },
});
