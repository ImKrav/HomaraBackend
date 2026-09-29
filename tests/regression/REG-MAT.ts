// REG-MAT · Regresión del motor de materiales
// Protege: b4d9ad4 extracción de calculateAdhesiveSupply / calculateGroutSupply
//                  y paso de ALLOWED_MATERIAL_TYPES a Set
//          da2b147 refactor(materials): reduce cognitive complexity
//
// Además fija el vocabulario que el frontend traduce por texto literal
// (`translateMaterialName` / `translateMaterialNote` en HomaraFrontend/app/lib/utils.ts).
// Cambiar uno de estos textos deja la interfaz en inglés mostrando español;
// la contraparte está en HomaraFrontend/tests/regression/REG-I18N.test.mts.
//
// No se compara la lista completa de materiales para no fijar los defectos
// abiertos del calculador (ver la tabla en tests/README.md).

import { test, expect } from "../harness.js";
import { fakeProyectos, fakeProductos, datosProyecto } from "../helpers.js";
import { calculateMaterials } from "../../src/domain/services/materialCalculator.js";
import { CreateProjectUseCase } from "../../src/application/use-cases/project.use-cases.js";

type Material = ReturnType<typeof calculateMaterials>[number];
const buscar = (m: Material[], frag: string) => m.find((x) => x.name.includes(frag))!;

// --- Insumos vinculados sin peso en el nombre (ramas de respaldo) -----------

test("REG-MAT-01", "Pegante vinculado sin peso en el nombre usa 25kg → 1 bulto cada 4m²", () => {
  // Arrange
  const entrada = {
    type: "PISO",
    area: 20,
    materialType: "ceramica",
    selectedProduct: { id: "prd-peg", name: "Pegante Impermeable Gris", price: 30_000, unit: "" },
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  expect(buscar(materiales, "Pegante Impermeable Gris")).toStrictEqual({
    name: "Pegante Impermeable Gris",
    quantity: "5 bultos",
    note: "Pegante real vinculado: 1 bulto por cada 4m²",
    icon: "🧱",
    price: 150_000,
    productId: "prd-peg",
  });
});

test("REG-MAT-02", "Boquilla vinculada sin peso en el nombre usa 1kg → 1 unidad cada 8m²", () => {
  // Arrange
  const entrada = {
    type: "PISO",
    area: 20,
    materialType: "ceramica",
    selectedProduct: { id: "prd-boq", name: "Boquilla Sin Arena Blanca", price: 12_000, unit: "" },
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  expect(buscar(materiales, "Boquilla Sin Arena Blanca")).toStrictEqual({
    name: "Boquilla Sin Arena Blanca",
    quantity: "3 unidades",
    note: "Boquilla real vinculada: 1 kg por cada 8m²",
    icon: "🪣",
    price: 36_000,
    productId: "prd-boq",
  });
});

// --- Lista de tipos de material permitidos --------------------------------

test("REG-MAT-03", "El materialType se compara sin distinguir mayúsculas", async () => {
  // Arrange
  const proyectos = fakeProyectos();
  const caso = new CreateProjectUseCase(proyectos as any, fakeProductos() as any);

  // Act
  await caso.execute(datosProyecto({ materialType: "CERAMICA" }) as any);

  // Assert
  expect(proyectos.create).toHaveBeenCalledTimes(1);
  expect(proyectos.create.mock.calls[0][0].materials.length).toBeGreaterThan(0);
});

// --- Vocabulario que el frontend traduce -----------------------------------

test("REG-MAT-04", "Los nombres y notas fijos que traduce el frontend no cambian de texto", () => {
  // Arrange — un proyecto por tipo, con todos los insumos y herramientas.
  const nombresEsperados = [
    "Pegante cerámico flexible 25kg",
    "Boquilla",
    "Crucetas 2mm",
    "Cinta underlayment",
    "Primer para vinilo",
    "Kit Rodillo Antigoteo Profesional 23cm",
    "Nivel de burbuja profesional 60cm",
    "Llana metálica dentada 10x10mm",
    "Mazo de goma blanco anti-marca",
  ];
  const prefijosEsperados = ["Pintura Premium de Interior/Exterior", "Brocha de cerda fina", "Cinta de enmascarar"];
  const notasEsperadas = [
    "25kg c/u (Rendimiento: 4m²/bulto)",
    "Rendimiento: 8m²/kg",
    "100 unidades c/u (Rendimiento: 15m²/bolsa)",
    "20m² c/u (Aislamiento acústico y de humedad)",
    "15m² c/u (Adherencia óptima)",
    "Incluye bandeja y felpa de microfibra",
    "Para retoques y esquinas",
    "Para protección de bordes y zócalos",
    "Para alineación exacta de la superficie",
    "Para distribución correcta del pegante",
    "Para asentamiento de baldosas sin fracturas",
  ];
  const tipos = ["ceramica", "porcelanato", "madera", "vinilo", "pintura"];

  // Act
  const materiales = tipos.flatMap((materialType) => calculateMaterials({ type: "PISO", area: 30, materialType }));

  // Assert
  const nombres = materiales.map((m) => m.name);
  const notas = materiales.map((m) => m.note);
  for (const nombre of nombresEsperados) expect(nombres).toContain(nombre);
  for (const prefijo of prefijosEsperados) {
    expect(nombres.some((n) => n.startsWith(prefijo)), `prefijo: ${prefijo}`).toBe(true);
  }
  for (const nota of notasEsperadas) expect(notas).toContain(nota);
});

test("REG-MAT-05", "Las notas con % de desperdicio conservan el patrón que el frontend reconoce", () => {
  // Arrange
  const baldosa = { type: "PISO", area: 30, materialType: "ceramica", layingPattern: "diagonal" };
  const pintura = { type: "PARED", area: 30, materialType: "pintura" };
  const integral = { type: "INTEGRAL", area: 30, materialType: "ceramica" };

  // Act
  const notasBaldosa = calculateMaterials(baldosa).map((m) => m.note);
  const notasPintura = calculateMaterials(pintura).map((m) => m.note);
  const notasIntegral = calculateMaterials(integral).map((m) => m.note);

  // Assert
  expect(notasBaldosa).toContain("+15% de desperdicio por colocación");
  expect(notasPintura).toContain("Rendimiento aproximado de 30m² c/u con 2 manos (Incluye +5% desperdicio)");
  expect(notasIntegral).toContain("Paredes estimadas (+10% desperdicio)");
});
