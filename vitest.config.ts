import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Las fuentes son ESM NodeNext: importan "./x.js" apuntando a "./x.ts".
    // Vite no hace esa traducción sola, así que se le quita la extensión.
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: "$1" }],
  },
  test: {
    include: ["tests/**/*.ts"],
    // Las suites tests/api y tests/security son pruebas en vivo (HTTP real contra
    // el stack levantado). CI no tiene servidor corriendo, así que se excluyen del
    // `vitest run` por defecto; se ejecutan con sus propios configs (test:api / test:security).
    exclude: [
      "tests/harness.ts",
      "tests/helpers.ts",
      "tests/mocks/**",
      "tests/regression/soporte.ts",
      "tests/api/**",
      "tests/security/**",
    ],
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**"],
      exclude: [
        "src/generated/**",
        "src/domain/repositories/**",
        "src/infrastructure/entrypoints/**",
      ],
      reporter: ["text", "lcov"],
    },
  },
});
