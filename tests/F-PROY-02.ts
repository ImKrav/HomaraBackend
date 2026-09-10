// F-PROY-02 · Calcular los materiales
// Unidad: calculateMaterials()  (src/domain/services/materialCalculator.ts)
//
// Función pura, sin dobles. Las aserciones de defecto usan `soft()` para que
// el caso siga corriendo y reporte todos los incumplimientos juntos.

import { test, is, eq, ok, has, hasNot, soft } from "./harness.js";
import { calculateMaterials } from "../src/domain/services/materialCalculator.js";

type Material = ReturnType<typeof calculateMaterials>[number];

const buscar = (m: Material[], frag: string) => m.find((x) => x.name.includes(frag));
const cantidad = (m: Material[], frag: string) => {
  const x = buscar(m, frag);
  return x ? Number.parseFloat(x.quantity) : Number.NaN;
};
const nombres = (m: Material[]) => m.map((x) => x.name);

// --- Área neta y desperdicio -------------------------------------------

test("CP-F-PROY-02-01", "Aplica 5% de desperdicio por defecto para proyectos de pintura", () => {
  const materiales = calculateMaterials({ type: "interior", area: 100, materialType: "pintura" });

  const pintura = buscar(materiales, "Pintura Premium")!;
  has(pintura.note!, "+5% desperdicio");
  is(pintura.quantity, "4 galón(es)");
  is(pintura.price, 500_000);
  is(pintura.productId, null);
  hasNot(nombres(materiales), "Crucetas 2mm");
  is(materiales.length, 4);
});

test("CP-F-PROY-02-02", "Prioriza porcentaje explícito de desperdicio sobre patrón de colocación", () => {
  const materiales = calculateMaterials({
    type: "integral",
    area: 100,
    materialType: "ceramica",
    tileFormat: "60x60",
    wastePercent: 20,
    layingPattern: "diagonal",
    deductDoors: 1,
    deductWindows: 2,
    selectedProduct: { id: "prd-esmalte", name: "Esmalte Sintético Blanco Galón", price: 89_000, unit: "galón" },
  });

  const esmalte = buscar(materiales, "Esmalte Sintético Blanco Galón")!;
  has(esmalte.note!, "+20% de desperdicio");
  is(esmalte.quantity, "4 galón");
  is(esmalte.price, 356_000);
  is(esmalte.productId, "prd-esmalte");

  // DEFECTO 4: el desperdicio no se propaga al pegante, la boquilla ni las crucetas
  soft(() => is(cantidad(materiales, "Pegante cerámico flexible"), 29));
  soft(() => is(cantidad(materiales, "Boquilla"), 15));
  soft(() => is(cantidad(materiales, "Crucetas"), 8));

  const pared = buscar(materiales, "Pared")!;
  is(pared.name, "Esmalte Sintético Blanco Galón Pared");
  // DEFECTO 2: la pared cotiza precio_galón × m²
  soft(() => is(pared.quantity, "3 galón"));
  soft(() => is(pared.price, 267_000));
  soft(() => ok(pared.price <= esmalte.price * 2));

  // DEFECTO 6: entrega herramientas de pintura en un proyecto de baldosa
  soft(() => has(nombres(materiales), "Llana metálica dentada 10x10mm"));
  soft(() => has(nombres(materiales), "Mazo de goma blanco anti-marca"));
});

test("CP-F-PROY-02-02b", "Respeta cota mínima de 0.1 m² cuando los descuentos superan el área", () => {
  const materiales = calculateMaterials({
    type: "residencial",
    area: 5,
    materialType: "ceramica",
    wastePercent: 20,
    deductDoors: 3,
  });

  is(buscar(materiales, "Cerámica")!.quantity, "1 m²");
  is(buscar(materiales, "Cerámica")!.price, 38_900);
  is(cantidad(materiales, "Pegante cerámico flexible"), 1);
  is(cantidad(materiales, "Boquilla"), 1);
  is(cantidad(materiales, "Crucetas"), 1);
});

test("CP-F-PROY-02-03", "Asigna 15% de desperdicio para colocación en diagonal", () => {
  const materiales = calculateMaterials({
    type: "residencial",
    area: 50,
    materialType: "porcelanato",
    layingPattern: "diagonal",
  });

  const porcelanato = buscar(materiales, "Porcelanato")!;
  is(porcelanato.note, "+15% de desperdicio por colocación");
  is(porcelanato.quantity, "58 m²");
  is(porcelanato.price, 2_662_200);
  is(cantidad(materiales, "Pegante cerámico flexible"), 13);
});

test("CP-F-PROY-02-04", "Asigna 12% de desperdicio para colocación en trabadura", () => {
  const materiales = calculateMaterials({
    type: "residencial",
    area: 50,
    materialType: "porcelanato",
    layingPattern: "trabadura",
  });

  const porcelanato = buscar(materiales, "Porcelanato")!;
  is(porcelanato.note, "+12% de desperdicio por colocación");
  is(porcelanato.quantity, "56 m²");
  is(porcelanato.price, 2_570_400);
});

test("CP-F-PROY-02-05", "Asigna 10% de desperdicio para colocación directa o por defecto", () => {
  const directo = calculateMaterials({
    type: "residencial",
    area: 50,
    materialType: "porcelanato",
    layingPattern: "directo",
  });

  const porcelanato = buscar(directo, "Porcelanato")!;
  is(porcelanato.note, "+10% de desperdicio por colocación");
  is(porcelanato.quantity, "55 m²");
  is(porcelanato.price, 2_524_500);

  const desconocido = calculateMaterials({
    type: "residencial",
    area: 50,
    materialType: "porcelanato",
    layingPattern: "espiga",
  });
  is(buscar(desconocido, "Porcelanato")!.quantity, "55 m²");
});

// --- Revestimiento principal ------------------------------------------

test("CP-F-PROY-02-06", "Mantiene pintura genérica si el producto vinculado es material de construcción", () => {
  const materiales = calculateMaterials({
    type: "interior",
    area: 90,
    materialType: "pintura",
    wastePercent: 8,
    deductWindows: 2,
    selectedProduct: { id: "prd-peg", name: "Pegante Cerámico Extrafuerte 25kg", price: 30_500, unit: "bultos" },
  });

  const pintura = buscar(materiales, "Pintura Premium de Interior/Exterior")!;
  is(pintura.quantity, "4 galón(es)");
  is(pintura.price, 500_000);
  has(pintura.note!, "+8% desperdicio");
  is(pintura.productId, null);

  // DEFECTO 5: el producto vinculado se pierde entre clasificaciones
  soft(() => has(nombres(materiales), "Pegante Cerámico Extrafuerte 25kg"));
  soft(() => is(buscar(materiales, "Pegante Cerámico Extrafuerte 25kg")?.productId, "prd-peg"));
});

test("CP-F-PROY-02-07", "Cotiza producto del catálogo por m² con desperdicio aplicado", () => {
  const materiales = calculateMaterials({
    type: "residencial",
    area: 64.5,
    materialType: "porcelanato",
    wastePercent: 10,
    selectedProduct: { id: "prd-porc", name: "Porcelanato Marfil Pulido 60x60", price: 52_900, unit: "m²" },
  });

  const porcelanato = buscar(materiales, "Porcelanato Marfil Pulido 60x60")!;
  is(porcelanato.quantity, "71 m²");
  is(porcelanato.price, 3_755_900);
  is(porcelanato.note, "Cálculo exacto con +10% de desperdicio");
  is(porcelanato.productId, "prd-porc");
  is(cantidad(materiales, "Pegante cerámico flexible"), 17);
  is(cantidad(materiales, "Boquilla"), 9);
  is(cantidad(materiales, "Crucetas"), 5);
  is(materiales.length, 7);
});

test("CP-F-PROY-02-08", "Asigna baldosa genérica y calcula pegante vinculado por rendimiento de peso", () => {
  const materiales = calculateMaterials({
    type: "residencial",
    area: 40,
    materialType: "ceramica",
    tileFormat: "30x30",
    wastePercent: 10,
    selectedProduct: { id: "prd-peg-10", name: "Pegante Blanco Porcelanato 10kg", price: 21_500, unit: "bultos" },
  });

  const ceramica = buscar(materiales, "Cerámica 30x30 cm")!;
  is(ceramica.quantity, "44 m²");
  is(ceramica.price, 1_276_000);
  is(ceramica.productId, null);

  const pegante = buscar(materiales, "Pegante Blanco Porcelanato 10kg")!;
  is(pegante.quantity, "25 bultos");
  is(pegante.price, 537_500);
  is(pegante.note, "Pegante real vinculado: 1 unidad de 10kg por cada 1.6m²");
  is(pegante.productId, "prd-peg-10");

  const calacatta = calculateMaterials({
    type: "residencial",
    area: 40,
    materialType: "ceramica",
    tileFormat: "30x30",
    wastePercent: 10,
    selectedProduct: { id: "prd-cal", name: "Porcelanato Calacatta Gold 60x60", price: 71_000, unit: "m²" },
  });
  const acabado = buscar(calacatta, "Porcelanato Calacatta Gold 60x60")!;
  // DEFECTO 1: la subcadena 'cal' clasifica revestimiento legítimo como pegante
  soft(() => hasNot(acabado.note!, "Pegante"));
  soft(() => is(acabado.note, "Cálculo exacto con +10% de desperdicio"));
  soft(() => is(acabado.quantity, "44 m²"));
  soft(() => is(acabado.price, 3_124_000));
  soft(() => is(acabado.icon, "🏗️"));
  soft(() => is(buscar(calacatta, "Cerámica 30x30 cm"), undefined));
  soft(() => has(nombres(calacatta), "Pegante cerámico flexible 25kg"));
});

// --- Insumos de baldosa ----------------------------------------------

test("CP-F-PROY-02-09", "Excluye insumos de baldosa (pegante, boquilla, crucetas) en proyectos de madera", () => {
  const materiales = calculateMaterials({ type: "residencial", area: 30, materialType: "madera", wastePercent: 10 });

  is(buscar(materiales, "Madera laminada 60x60 cm")!.quantity, "33 m²");
  is(buscar(materiales, "Madera laminada 60x60 cm")!.price, 1_716_000);
  const lista = nombres(materiales);
  hasNot(lista, "Pegante cerámico flexible 25kg");
  hasNot(lista, "Boquilla");
  hasNot(lista, "Crucetas 2mm");
  hasNot(lista, "Llana metálica dentada 10x10mm");
  is(materiales.length, 3);
});

test("CP-F-PROY-02-10", "Cotiza boquilla real vinculada y omite pegante si se desactiva includeAdhesive", () => {
  const materiales = calculateMaterials({
    type: "residencial",
    area: 60,
    materialType: "ceramica",
    wastePercent: 10,
    includeAdhesive: false,
    selectedProduct: { id: "prd-boq-2", name: "Boquilla Premium Antihongos 2kg", price: 18_900, unit: "unidades" },
  });

  hasNot(nombres(materiales), "Pegante cerámico flexible 25kg");
  const boquilla = buscar(materiales, "Boquilla Premium Antihongos 2kg")!;
  is(boquilla.quantity, "4 unidades");
  is(boquilla.price, 75_600);
  is(boquilla.note, "Boquilla real vinculada: 1 unidad de 2kg por cada 16m²");
  is(cantidad(materiales, "Crucetas"), 4);
  is(materiales.length, 6);
});

test("CP-F-PROY-02-11", "Asigna pegante genérico de 25kg cuando el producto vinculado no es adhesivo", () => {
  const materiales = calculateMaterials({
    type: "residencial",
    area: 37,
    materialType: "ceramica",
    wastePercent: 10,
    selectedProduct: { id: "prd-imp", name: "Impermeabilizante Acrílico Blanco", price: 78_000, unit: "galón" },
  });

  const pegante = buscar(materiales, "Pegante cerámico flexible 25kg")!;
  is(pegante.quantity, "10 bultos");
  is(pegante.price, 285_000);
  is(pegante.note, "25kg c/u (Rendimiento: 4m²/bulto)");
  is(pegante.productId, null);
  is(buscar(materiales, "Impermeabilizante")!.quantity, "2 galón");
  is(buscar(materiales, "Impermeabilizante")!.price, 156_000);
});

test("CP-F-PROY-02-12", "Mantiene crucetas cuando se omiten pegante y boquilla", () => {
  const materiales = calculateMaterials({
    type: "residencial",
    area: 45,
    materialType: "ceramica",
    wastePercent: 10,
    includeAdhesive: false,
    includeGrout: false,
  });

  const lista = nombres(materiales);
  hasNot(lista, "Pegante cerámico flexible 25kg");
  hasNot(lista, "Boquilla");
  is(buscar(materiales, "Crucetas 2mm")!.quantity, "3 bolsas");
  is(buscar(materiales, "Crucetas 2mm")!.price, 25_500);
  is(buscar(materiales, "Cerámica 60x60 cm")!.quantity, "50 m²");
  is(materiales.length, 5);
});

test("CP-F-PROY-02-13", "Calcula boquilla genérica a rendimiento de 8 m² por kilo", () => {
  const materiales = calculateMaterials({
    type: "residencial",
    area: 45,
    materialType: "porcelanato",
    wastePercent: 10,
    includeAdhesive: false,
  });

  const boquilla = buscar(materiales, "Boquilla")!;
  is(boquilla.quantity, "6 kg");
  is(boquilla.price, 72_000);
  is(boquilla.note, "Rendimiento: 8m²/kg");
  is(boquilla.productId, null);
  is(buscar(materiales, "Porcelanato 60x60 cm")!.price, 2_295_000);
  is(materiales.length, 6);
});

test("CP-F-PROY-02-14", "Excluye insumos de baldosa pero preserva herramientas correspondientes", () => {
  const materiales = calculateMaterials({
    type: "residencial",
    area: 45,
    materialType: "ceramica",
    wastePercent: 10,
    includeAdhesive: false,
    includeGrout: false,
    includeSpacers: false,
  });

  hasNot(nombres(materiales), "Crucetas 2mm");
  is(buscar(materiales, "Cerámica 60x60 cm")!.quantity, "50 m²");
  is(buscar(materiales, "Cerámica 60x60 cm")!.price, 1_945_000);
  eq(nombres(materiales), [
    "Cerámica 60x60 cm",
    "Nivel de burbuja profesional 60cm",
    "Llana metálica dentada 10x10mm",
    "Mazo de goma blanco anti-marca",
  ]);
});

// --- Insumos de madera y vinilo -------------------------------------

test("CP-F-PROY-02-15", "Calcula primer para vinilo y excluye cinta underlayment", () => {
  const materiales = calculateMaterials({
    type: "residencial",
    area: 28,
    materialType: "vinilo",
    tileFormat: "45x45",
    wastePercent: 10,
  });

  hasNot(nombres(materiales), "Cinta underlayment");
  is(buscar(materiales, "Vinilo 45x45 cm")!.quantity, "31 m²");
  is(buscar(materiales, "Vinilo 45x45 cm")!.price, 775_000);
  const primer = buscar(materiales, "Primer para vinilo")!;
  is(primer.quantity, "2 galones");
  is(primer.price, 90_000);
  is(materiales.length, 3);
});

test("CP-F-PROY-02-16", "Omite cinta underlayment para madera cuando includeAdhesive es false", () => {
  const materiales = calculateMaterials({
    type: "residencial",
    area: 30,
    materialType: "madera",
    wastePercent: 10,
    includeAdhesive: false,
  });

  hasNot(nombres(materiales), "Cinta underlayment");
  is(buscar(materiales, "Madera laminada 60x60 cm")!.quantity, "33 m²");
  is(buscar(materiales, "Madera laminada 60x60 cm")!.price, 1_716_000);
  eq(nombres(materiales), ["Madera laminada 60x60 cm", "Nivel de burbuja profesional 60cm"]);
});

test("CP-F-PROY-02-17", "Omite insumos específicos ante materialType desconocido cotizando producto galón", () => {
  const materiales = calculateMaterials({
    type: "residencial",
    area: 45,
    materialType: "piedra",
    tileFormat: "80x80",
    wastePercent: 10,
    selectedProduct: { id: "prd-sell", name: "Sellador Poliuretano Transparente", price: 96_000, unit: "galón" },
  });

  const lista = nombres(materiales);
  hasNot(lista, "Primer para vinilo");
  hasNot(lista, "Cinta underlayment");
  hasNot(lista, "Nivel de burbuja profesional 60cm");
  is(buscar(materiales, "Sellador Poliuretano Transparente")!.quantity, "2 galón");
  is(buscar(materiales, "Sellador Poliuretano Transparente")!.price, 192_000);
  is(materiales.length, 4);
});

test("CP-F-PROY-02-18", "Omite primer para vinilo si includeAdhesive está desactivado", () => {
  const materiales = calculateMaterials({
    type: "residencial",
    area: 28,
    materialType: "vinilo",
    tileFormat: "45x45",
    wastePercent: 10,
    includeAdhesive: false,
  });

  hasNot(nombres(materiales), "Primer para vinilo");
  is(buscar(materiales, "Vinilo 45x45 cm")!.quantity, "31 m²");
  is(buscar(materiales, "Vinilo 45x45 cm")!.price, 775_000);
  eq(nombres(materiales), ["Vinilo 45x45 cm", "Nivel de burbuja profesional 60cm"]);
});

// --- Herramientas y paredes ---------------------------------------

test("CP-F-PROY-02-19", "Cotiza paredes en proyecto integral aunque includeTools sea false", () => {
  const materiales = calculateMaterials({
    type: "integral",
    area: 20,
    materialType: "granito",
    tileFormat: "80x80",
    wastePercent: 10,
    includeTools: false,
  });

  is(materiales.length, 2);
  const pared = buscar(materiales, "Pared")!;
  is(pared.name, "Cerámica Pared 80x80 cm");
  is(pared.quantity, "14 m²");
  is(pared.note, "Paredes estimadas (+10% desperdicio)");

  const piso = buscar(materiales, "Cerámica 80x80 cm")!;
  is(piso.quantity, "22 m²");
  // DEFECTO 3: etiqueta 80x80 cotizada al precio del formato 60x60
  soft(() => is(piso.price, 924_000));
  soft(() => is(pared.price, 588_000));
});

test("CP-F-PROY-02-20", "Incluye kit de herramientas de baldosa (nivel, llana y mazo)", () => {
  const materiales = calculateMaterials({
    type: "residencial",
    area: 12,
    materialType: "ceramica",
    wastePercent: 10,
    includeAdhesive: false,
    includeGrout: false,
    includeSpacers: false,
  });

  const nivel = buscar(materiales, "Nivel de burbuja profesional 60cm")!;
  const llana = buscar(materiales, "Llana metálica dentada 10x10mm")!;
  const mazo = buscar(materiales, "Mazo de goma blanco anti-marca")!;
  is(nivel.price, 35_000);
  is(llana.price, 18_500);
  is(mazo.price, 14_500);
  ok([nivel, llana, mazo].every((m) => m.quantity === "1 unidad"));
  hasNot(nombres(materiales), "Kit Rodillo Antigoteo Profesional 23cm");
  is(buscar(materiales, "Cerámica 60x60 cm")!.quantity, "14 m²");
  is(materiales.length, 4);
});

test("CP-F-PROY-02-21", "Incluye solo nivel en herramientas para proyectos sin baldosa", () => {
  const materiales = calculateMaterials({
    type: "residencial",
    area: 12,
    materialType: "madera",
    wastePercent: 10,
    includeAdhesive: false,
  });

  eq(nombres(materiales), ["Madera laminada 60x60 cm", "Nivel de burbuja profesional 60cm"]);
  is(buscar(materiales, "Nivel de burbuja")!.price, 35_000);
  is(buscar(materiales, "Madera laminada 60x60 cm")!.quantity, "14 m²");
  is(buscar(materiales, "Madera laminada 60x60 cm")!.price, 728_000);
});

test("CP-F-PROY-02-22", "Omite estimación de paredes para pintura o cuando el tipo no es integral", () => {
  const integralPintura = calculateMaterials({
    type: "integral",
    area: 80,
    materialType: "pintura",
    wastePercent: 10,
  });
  is(integralPintura.some((m) => m.name.includes("Pared")), false);
  is(buscar(integralPintura, "Pintura Premium")!.quantity, "3 galón(es)");
  is(buscar(integralPintura, "Pintura Premium")!.price, 375_000);
  is(integralPintura.length, 4);

  const soloPiso = calculateMaterials({
    type: "residencial",
    area: 80,
    materialType: "ceramica",
    wastePercent: 10,
  });
  is(soloPiso.some((m) => m.name.includes("Pared")), false);
  is(buscar(soloPiso, "Cerámica 60x60 cm")!.quantity, "88 m²");
  is(buscar(soloPiso, "Cerámica 60x60 cm")!.price, 3_423_200);
  is(soloPiso.length, 7);
});
