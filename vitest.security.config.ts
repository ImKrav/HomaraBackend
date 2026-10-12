import { defineConfig } from "vitest/config";

// ============================================================================
// Config de las pruebas de seguridad en vivo (revisión defensiva del propio
// proyecto del equipo). Golpean la API real en API_URL (por defecto
// http://localhost:5000) con fetch nativo. Fuera del `vitest run` por defecto;
// se ejecutan con `npm run test:security`.
//
// Los casos que documentan una debilidad real afirman el comportamiento SEGURO
// esperado y están marcados con `it.fails` (defecto conocido), de modo que la
// suite queda en verde mientras documenta el defecto. Ver docs/pruebas/SEGURIDAD.md.
// ============================================================================
export default defineConfig({
  test: {
    include: ["tests/security/**/*.ts"],
    exclude: ["tests/security/soporte-*.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: ["verbose"],
  },
});
