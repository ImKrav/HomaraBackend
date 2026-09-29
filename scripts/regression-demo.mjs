// ============================================================================
// Demostración de la suite de regresión:  npm run test:regression:demo
//
// Introduce a propósito un error conocido en cada funcionalidad (uno por vez),
// corre `tests/regression` y comprueba que la suite lo detecta (queda en rojo).
// Después de cada cambio el archivo se restaura byte a byte, también si el
// proceso se interrumpe. Termina con código 1 si algún cambio pasa inadvertido.
// ============================================================================

import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MUTACIONES = [
  {
    modulo: "Autenticación",
    cambio: "El registro asigna rol ADMIN en vez de CUSTOMER",
    archivo: "src/application/use-cases/auth.use-cases.ts",
    buscar: 'role: "CUSTOMER",',
    poner: 'role: "ADMIN",',
  },
  {
    modulo: "Catálogo",
    cambio: "El listado ignora las reservas de otros carritos",
    archivo: "src/application/use-cases/catalog.use-cases.ts",
    buscar: "const dynamicStock = Math.max(0, p.stockQuantity - reservedQty);",
    poner: "const dynamicStock = p.stockQuantity;",
  },
  {
    modulo: "Catálogo",
    cambio: "Las reseñas de un producto dejan de listarse",
    archivo: "src/application/use-cases/catalog.use-cases.ts",
    buscar: "return await this.reviewRepository.findByProductId(productId);",
    poner: "return [];",
  },
  {
    modulo: "Carrito",
    cambio: "Un usuario puede modificar ítems de otro carrito",
    archivo: "src/application/use-cases/cart.use-cases.ts",
    buscar: 'throw new AppError("No tienes permiso para modificar este item del carrito.", 403);',
    poner: "/* sin control de dueño */",
  },
  {
    modulo: "Carrito",
    cambio: "Nunca se marca backorder",
    archivo: "src/application/use-cases/cart.use-cases.ts",
    buscar: "const isBackorder = item.quantity > availableStock;",
    poner: "const isBackorder = false;",
  },
  {
    modulo: "Pedidos",
    cambio: "Envío gratis desde 50.000 en vez de 500.000",
    archivo: "src/application/use-cases/order.use-cases.ts",
    buscar: "const shippingCost = subtotal > 500000 ? 0 : 25000;",
    poner: "const shippingCost = subtotal > 50000 ? 0 : 25000;",
  },
  {
    modulo: "Proyectos",
    cambio: "Cualquiera puede borrar un proyecto ajeno",
    archivo: "src/application/use-cases/project.use-cases.ts",
    buscar: 'throw new AppError("No tienes permiso para eliminar este proyecto.", 403);',
    poner: "/* sin control de dueño */",
  },
  {
    modulo: "Proyectos",
    cambio: "Cualquiera puede editar un proyecto ajeno",
    archivo: "src/application/use-cases/project.use-cases.ts",
    buscar: 'throw new AppError("No tienes permiso para modificar este proyecto.", 403);',
    poner: "/* sin control de dueño */",
  },
  {
    modulo: "Proyectos",
    cambio: "Cambia una nota del calculador que el frontend traduce",
    archivo: "src/domain/services/materialCalculator.ts",
    buscar: '"Pegante real vinculado: 1 bulto por cada 4m²"',
    poner: '"Pegante vinculado: 1 bulto cada 4 m²"',
  },
  {
    modulo: "Administración",
    cambio: "Un cliente entra a las rutas de administrador",
    archivo: "src/infrastructure/http/middlewares/auth.ts",
    buscar: 'if (req.user?.role !== "ADMIN") {',
    poner: "if (false) {",
  },
  {
    modulo: "Administración",
    cambio: "El umbral de stock bajo pasa de 50 a 5 unidades",
    archivo: "src/infrastructure/http/controllers/admin.controller.ts",
    buscar: 'if (stockQuantity < 50) return "stock_bajo";',
    poner: 'if (stockQuantity < 5) return "stock_bajo";',
  },
  {
    modulo: "Seguridad",
    cambio: "CORS refleja cualquier origen",
    archivo: "src/infrastructure/http/express-server.ts",
    buscar: "origin: envConfig.corsOrigins,",
    poner: "origin: true,",
  },
  {
    modulo: "API",
    cambio: "Se quita la compatibilidad /api/* → /api/v1/*",
    archivo: "src/infrastructure/http/express-server.ts",
    buscar: "req.url = `/v1${req.url}`;",
    poner: "/* sin reescritura */",
  },
  {
    modulo: "Validación",
    cambio: "El validador CUID acepta guiones (UUID)",
    archivo: "src/infrastructure/http/validators/common.validator.ts",
    buscar: String.raw`export const CUID_REGEX = /^c[^\s-]{8,}$/i;`,
    poner: String.raw`export const CUID_REGEX = /^c[^\s]{8,}$/i;`,
  },
];

const VITEST = join("node_modules", "vitest", "vitest.mjs");
const REPORTE = join(tmpdir(), `homara-regresion-${process.pid}.json`);

/** Corre la suite de regresión y devuelve los ids de los casos que fallaron. */
function correrSuite() {
  spawnSync(process.execPath, [VITEST, "run", "tests/regression", "--reporter=json", `--outputFile=${REPORTE}`], {
    stdio: "ignore",
  });
  const r = JSON.parse(readFileSync(REPORTE, "utf8"));
  const fallidos = r.testResults
    .flatMap((f) => f.assertionResults)
    .filter((t) => t.status === "failed")
    .map((t) => t.title.split(/\s+/)[0]);
  const archivosRotos = r.testResults.filter((f) => f.status === "failed" && f.assertionResults.length === 0).length;
  return { total: r.numTotalTests, fallidos, archivosRotos };
}

let pendiente = null; // { archivo, original } mientras hay una mutación aplicada
const restaurar = () => {
  if (pendiente) writeFileSync(pendiente.archivo, pendiente.original);
  pendiente = null;
};
for (const senal of ["SIGINT", "SIGTERM"]) process.on(senal, () => (restaurar(), process.exit(130)));
process.on("exit", restaurar);

console.log(`\nDemostración de regresión — ${MUTACIONES.length} errores introducidos a propósito\n`);

const base = correrSuite();
if (base.fallidos.length || base.archivosRotos) {
  console.error(`La línea base no está en verde (${base.fallidos.join(", ")}). Corrige eso antes de la demo.`);
  process.exit(1);
}
console.log(`Línea base: ${base.total}/${base.total} casos en verde\n`);

let detectados = 0;
for (const m of MUTACIONES) {
  const original = readFileSync(m.archivo, "utf8");
  if (!original.includes(m.buscar)) {
    console.error(`✖ ${m.modulo}: el fragmento a mutar ya no existe en ${m.archivo}. Actualiza el script.`);
    process.exitCode = 1;
    continue;
  }
  pendiente = { archivo: m.archivo, original };
  writeFileSync(m.archivo, original.replace(m.buscar, m.poner));
  const { fallidos, archivosRotos } = correrSuite();
  restaurar();

  const detectado = fallidos.length > 0 || archivosRotos > 0;
  if (detectado) detectados++;
  const marca = detectado ? "✔ detectado" : "✖ NO DETECTADO";
  const por = fallidos.length ? `→ ${fallidos.join(", ")}` : "";
  console.log(`${marca}  [${m.modulo}] ${m.cambio} ${por}`);
}

rmSync(REPORTE, { force: true });
console.log(`\nResultado: ${detectados}/${MUTACIONES.length} errores detectados por la suite. Código restaurado.\n`);
if (detectados !== MUTACIONES.length) process.exitCode = 1;
