// F-PROY-02 · Calcular los materiales
// Unidad: calculateMaterials()  (src/domain/services/materialCalculator.ts)
//
// Función pura, sin dobles. Las aserciones de defecto usan `expect.soft()` para que
// el caso siga corriendo y reporte todos los incumplimientos juntos.

import { test, expect } from "./harness.js";
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
  // Arrange
  const entrada = { type: "interior", area: 100, materialType: "pintura" };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  const pintura = buscar(materiales, "Pintura Premium")!;
  expect(pintura.note!).toContain("+5% desperdicio");
  expect(pintura.quantity).toBe("4 galón(es)");
  expect(pintura.price).toBe(500_000);
  expect(pintura.productId).toBe(null);
  expect(nombres(materiales)).not.toContain("Crucetas 2mm");
  expect(materiales.length).toBe(4);
});

// Defecto abierto #2 (ver la tabla en tests/README.md): se espera que falle.
test.fails("CP-F-PROY-02-02", "Prioriza porcentaje explícito de desperdicio sobre patrón de colocación", () => {
  // Arrange
  const entrada = {
    type: "integral",
    area: 100,
    materialType: "ceramica",
    tileFormat: "60x60",
    wastePercent: 20,
    layingPattern: "diagonal",
    deductDoors: 1,
    deductWindows: 2,
    selectedProduct: { id: "prd-esmalte", name: "Esmalte Sintético Blanco Galón", price: 89_000, unit: "galón" },
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  const esmalte = buscar(materiales, "Esmalte Sintético Blanco Galón")!;
  expect(esmalte.note!).toContain("+20% de desperdicio");
  expect(esmalte.quantity).toBe("4 galón");
  expect(esmalte.price).toBe(356_000);
  expect(esmalte.productId).toBe("prd-esmalte");

  // DEFECTO 4: el desperdicio no se propaga al pegante, la boquilla ni las crucetas
  expect.soft(cantidad(materiales, "Pegante cerámico flexible")).toBe(29);
  expect.soft(cantidad(materiales, "Boquilla")).toBe(15);
  expect.soft(cantidad(materiales, "Crucetas")).toBe(8);

  const pared = buscar(materiales, "Pared")!;
  expect(pared.name).toBe("Esmalte Sintético Blanco Galón Pared");
  // DEFECTO 2: la pared cotiza precio_galón × m²
  expect.soft(pared.quantity).toBe("3 galón");
  expect.soft(pared.price).toBe(267_000);
  expect.soft(pared.price).toBeLessThanOrEqual(esmalte.price * 2);

  // DEFECTO 6: entrega herramientas de pintura en un proyecto de baldosa
  expect.soft(nombres(materiales)).toContain("Llana metálica dentada 10x10mm");
  expect.soft(nombres(materiales)).toContain("Mazo de goma blanco anti-marca");
});

test("CP-F-PROY-02-02b", "Respeta cota mínima de 0.1 m² cuando los descuentos superan el área", () => {
  // Arrange
  const entrada = {
    type: "residencial",
    area: 5,
    materialType: "ceramica",
    wastePercent: 20,
    deductDoors: 3,
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  expect(buscar(materiales, "Cerámica")!.quantity).toBe("1 m²");
  expect(buscar(materiales, "Cerámica")!.price).toBe(38_900);
  expect(cantidad(materiales, "Pegante cerámico flexible")).toBe(1);
  expect(cantidad(materiales, "Boquilla")).toBe(1);
  expect(cantidad(materiales, "Crucetas")).toBe(1);
});

test("CP-F-PROY-02-03", "Asigna 15% de desperdicio para colocación en diagonal", () => {
  // Arrange
  const entrada = {
    type: "residencial",
    area: 50,
    materialType: "porcelanato",
    layingPattern: "diagonal",
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  const porcelanato = buscar(materiales, "Porcelanato")!;
  expect(porcelanato.note).toBe("+15% de desperdicio por colocación");
  expect(porcelanato.quantity).toBe("58 m²");
  expect(porcelanato.price).toBe(2_662_200);
  expect(cantidad(materiales, "Pegante cerámico flexible")).toBe(13);
});

test("CP-F-PROY-02-04", "Asigna 12% de desperdicio para colocación en trabadura", () => {
  // Arrange
  const entrada = {
    type: "residencial",
    area: 50,
    materialType: "porcelanato",
    layingPattern: "trabadura",
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  const porcelanato = buscar(materiales, "Porcelanato")!;
  expect(porcelanato.note).toBe("+12% de desperdicio por colocación");
  expect(porcelanato.quantity).toBe("56 m²");
  expect(porcelanato.price).toBe(2_570_400);
});

test("CP-F-PROY-02-05", "Asigna 10% de desperdicio para colocación directa o por defecto", () => {
  // Arrange — mismo proyecto con patrón explícito 'directo' y con uno no reconocido.
  const base = { type: "residencial", area: 50, materialType: "porcelanato" };

  // Act
  const directo = calculateMaterials({ ...base, layingPattern: "directo" });
  const desconocido = calculateMaterials({ ...base, layingPattern: "espiga" });

  // Assert
  const porcelanato = buscar(directo, "Porcelanato")!;
  expect(porcelanato.note).toBe("+10% de desperdicio por colocación");
  expect(porcelanato.quantity).toBe("55 m²");
  expect(porcelanato.price).toBe(2_524_500);
  expect(buscar(desconocido, "Porcelanato")!.quantity).toBe("55 m²");
});

// --- Revestimiento principal ------------------------------------------

// Defecto abierto #5 (ver la tabla en tests/README.md): se espera que falle.
test.fails("CP-F-PROY-02-06", "Mantiene pintura genérica si el producto vinculado es material de construcción", () => {
  // Arrange
  const entrada = {
    type: "interior",
    area: 90,
    materialType: "pintura",
    wastePercent: 8,
    deductWindows: 2,
    selectedProduct: { id: "prd-peg", name: "Pegante Cerámico Extrafuerte 25kg", price: 30_500, unit: "bultos" },
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  const pintura = buscar(materiales, "Pintura Premium de Interior/Exterior")!;
  expect(pintura.quantity).toBe("4 galón(es)");
  expect(pintura.price).toBe(500_000);
  expect(pintura.note!).toContain("+8% desperdicio");
  expect(pintura.productId).toBe(null);

  // DEFECTO 5: el producto vinculado se pierde entre clasificaciones
  expect.soft(nombres(materiales)).toContain("Pegante Cerámico Extrafuerte 25kg");
  expect.soft(buscar(materiales, "Pegante Cerámico Extrafuerte 25kg")?.productId).toBe("prd-peg");
});

test("CP-F-PROY-02-07", "Cotiza producto del catálogo por m² con desperdicio aplicado", () => {
  // Arrange
  const entrada = {
    type: "residencial",
    area: 64.5,
    materialType: "porcelanato",
    wastePercent: 10,
    selectedProduct: { id: "prd-porc", name: "Porcelanato Marfil Pulido 60x60", price: 52_900, unit: "m²" },
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  const porcelanato = buscar(materiales, "Porcelanato Marfil Pulido 60x60")!;
  expect(porcelanato.quantity).toBe("71 m²");
  expect(porcelanato.price).toBe(3_755_900);
  expect(porcelanato.note).toBe("Cálculo exacto con +10% de desperdicio");
  expect(porcelanato.productId).toBe("prd-porc");
  expect(cantidad(materiales, "Pegante cerámico flexible")).toBe(17);
  expect(cantidad(materiales, "Boquilla")).toBe(9);
  expect(cantidad(materiales, "Crucetas")).toBe(5);
  expect(materiales.length).toBe(7);
});

// Defecto abierto #1 (ver la tabla en tests/README.md): se espera que falle.
test.fails("CP-F-PROY-02-08", "Asigna baldosa genérica y calcula pegante vinculado por rendimiento de peso", () => {
  // Arrange — mismo proyecto vinculando primero un pegante y luego un revestimiento.
  const base = {
    type: "residencial",
    area: 40,
    materialType: "ceramica",
    tileFormat: "30x30",
    wastePercent: 10,
  };
  const peganteVinculado = { id: "prd-peg-10", name: "Pegante Blanco Porcelanato 10kg", price: 21_500, unit: "bultos" };
  const revestimientoVinculado = { id: "prd-cal", name: "Porcelanato Calacatta Gold 60x60", price: 71_000, unit: "m²" };
  const conPegante = { ...base, selectedProduct: peganteVinculado };
  const conRevestimiento = { ...base, selectedProduct: revestimientoVinculado };

  // Act
  const materiales = calculateMaterials(conPegante);
  const calacatta = calculateMaterials(conRevestimiento);

  // Assert
  const ceramica = buscar(materiales, "Cerámica 30x30 cm")!;
  expect(ceramica.quantity).toBe("44 m²");
  expect(ceramica.price).toBe(1_276_000);
  expect(ceramica.productId).toBe(null);

  const pegante = buscar(materiales, "Pegante Blanco Porcelanato 10kg")!;
  expect(pegante.quantity).toBe("25 bultos");
  expect(pegante.price).toBe(537_500);
  expect(pegante.note).toBe("Pegante real vinculado: 1 unidad de 10kg por cada 1.6m²");
  expect(pegante.productId).toBe("prd-peg-10");

  const acabado = buscar(calacatta, "Porcelanato Calacatta Gold 60x60")!;
  // DEFECTO 1: la subcadena 'cal' clasifica revestimiento legítimo como pegante
  expect.soft(acabado.note!).not.toContain("Pegante");
  expect.soft(acabado.note).toBe("Cálculo exacto con +10% de desperdicio");
  expect.soft(acabado.quantity).toBe("44 m²");
  expect.soft(acabado.price).toBe(3_124_000);
  expect.soft(acabado.icon).toBe("🏗️");
  expect.soft(buscar(calacatta, "Cerámica 30x30 cm")).toBe(undefined);
  expect.soft(nombres(calacatta)).toContain("Pegante cerámico flexible 25kg");
});

// --- Insumos de baldosa ----------------------------------------------

test("CP-F-PROY-02-09", "Excluye insumos de baldosa (pegante, boquilla, crucetas) en proyectos de madera", () => {
  // Arrange
  const entrada = { type: "residencial", area: 30, materialType: "madera", wastePercent: 10 };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  expect(buscar(materiales, "Madera laminada 60x60 cm")!.quantity).toBe("33 m²");
  expect(buscar(materiales, "Madera laminada 60x60 cm")!.price).toBe(1_716_000);
  const lista = nombres(materiales);
  expect(lista).not.toContain("Pegante cerámico flexible 25kg");
  expect(lista).not.toContain("Boquilla");
  expect(lista).not.toContain("Crucetas 2mm");
  expect(lista).not.toContain("Llana metálica dentada 10x10mm");
  expect(materiales.length).toBe(3);
});

test("CP-F-PROY-02-10", "Cotiza boquilla real vinculada y omite pegante si se desactiva includeAdhesive", () => {
  // Arrange
  const entrada = {
    type: "residencial",
    area: 60,
    materialType: "ceramica",
    wastePercent: 10,
    includeAdhesive: false,
    selectedProduct: { id: "prd-boq-2", name: "Boquilla Premium Antihongos 2kg", price: 18_900, unit: "unidades" },
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  expect(nombres(materiales)).not.toContain("Pegante cerámico flexible 25kg");
  const boquilla = buscar(materiales, "Boquilla Premium Antihongos 2kg")!;
  expect(boquilla.quantity).toBe("4 unidades");
  expect(boquilla.price).toBe(75_600);
  expect(boquilla.note).toBe("Boquilla real vinculada: 1 unidad de 2kg por cada 16m²");
  expect(cantidad(materiales, "Crucetas")).toBe(4);
  expect(materiales.length).toBe(6);
});

test("CP-F-PROY-02-11", "Asigna pegante genérico de 25kg cuando el producto vinculado no es adhesivo", () => {
  // Arrange
  const entrada = {
    type: "residencial",
    area: 37,
    materialType: "ceramica",
    wastePercent: 10,
    selectedProduct: { id: "prd-imp", name: "Impermeabilizante Acrílico Blanco", price: 78_000, unit: "galón" },
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  const pegante = buscar(materiales, "Pegante cerámico flexible 25kg")!;
  expect(pegante.quantity).toBe("10 bultos");
  expect(pegante.price).toBe(285_000);
  expect(pegante.note).toBe("25kg c/u (Rendimiento: 4m²/bulto)");
  expect(pegante.productId).toBe(null);
  expect(buscar(materiales, "Impermeabilizante")!.quantity).toBe("2 galón");
  expect(buscar(materiales, "Impermeabilizante")!.price).toBe(156_000);
});

test("CP-F-PROY-02-12", "Mantiene crucetas cuando se omiten pegante y boquilla", () => {
  // Arrange
  const entrada = {
    type: "residencial",
    area: 45,
    materialType: "ceramica",
    wastePercent: 10,
    includeAdhesive: false,
    includeGrout: false,
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  const lista = nombres(materiales);
  expect(lista).not.toContain("Pegante cerámico flexible 25kg");
  expect(lista).not.toContain("Boquilla");
  expect(buscar(materiales, "Crucetas 2mm")!.quantity).toBe("3 bolsas");
  expect(buscar(materiales, "Crucetas 2mm")!.price).toBe(25_500);
  expect(buscar(materiales, "Cerámica 60x60 cm")!.quantity).toBe("50 m²");
  expect(materiales.length).toBe(5);
});

test("CP-F-PROY-02-13", "Calcula boquilla genérica a rendimiento de 8 m² por kilo", () => {
  // Arrange
  const entrada = {
    type: "residencial",
    area: 45,
    materialType: "porcelanato",
    wastePercent: 10,
    includeAdhesive: false,
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  const boquilla = buscar(materiales, "Boquilla")!;
  expect(boquilla.quantity).toBe("6 kg");
  expect(boquilla.price).toBe(72_000);
  expect(boquilla.note).toBe("Rendimiento: 8m²/kg");
  expect(boquilla.productId).toBe(null);
  expect(buscar(materiales, "Porcelanato 60x60 cm")!.price).toBe(2_295_000);
  expect(materiales.length).toBe(6);
});

test("CP-F-PROY-02-14", "Excluye insumos de baldosa pero preserva herramientas correspondientes", () => {
  // Arrange
  const entrada = {
    type: "residencial",
    area: 45,
    materialType: "ceramica",
    wastePercent: 10,
    includeAdhesive: false,
    includeGrout: false,
    includeSpacers: false,
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  expect(nombres(materiales)).not.toContain("Crucetas 2mm");
  expect(buscar(materiales, "Cerámica 60x60 cm")!.quantity).toBe("50 m²");
  expect(buscar(materiales, "Cerámica 60x60 cm")!.price).toBe(1_945_000);
  expect(nombres(materiales)).toStrictEqual([
    "Cerámica 60x60 cm",
    "Nivel de burbuja profesional 60cm",
    "Llana metálica dentada 10x10mm",
    "Mazo de goma blanco anti-marca",
  ]);
});

// --- Insumos de madera y vinilo -------------------------------------

test("CP-F-PROY-02-15", "Calcula primer para vinilo y excluye cinta underlayment", () => {
  // Arrange
  const entrada = {
    type: "residencial",
    area: 28,
    materialType: "vinilo",
    tileFormat: "45x45",
    wastePercent: 10,
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  expect(nombres(materiales)).not.toContain("Cinta underlayment");
  expect(buscar(materiales, "Vinilo 45x45 cm")!.quantity).toBe("31 m²");
  expect(buscar(materiales, "Vinilo 45x45 cm")!.price).toBe(775_000);
  const primer = buscar(materiales, "Primer para vinilo")!;
  expect(primer.quantity).toBe("2 galones");
  expect(primer.price).toBe(90_000);
  expect(materiales.length).toBe(3);
});

test("CP-F-PROY-02-16", "Omite cinta underlayment para madera cuando includeAdhesive es false", () => {
  // Arrange
  const entrada = {
    type: "residencial",
    area: 30,
    materialType: "madera",
    wastePercent: 10,
    includeAdhesive: false,
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  expect(nombres(materiales)).not.toContain("Cinta underlayment");
  expect(buscar(materiales, "Madera laminada 60x60 cm")!.quantity).toBe("33 m²");
  expect(buscar(materiales, "Madera laminada 60x60 cm")!.price).toBe(1_716_000);
  expect(nombres(materiales)).toStrictEqual(["Madera laminada 60x60 cm", "Nivel de burbuja profesional 60cm"]);
});

test("CP-F-PROY-02-17", "Omite insumos específicos ante materialType desconocido cotizando producto galón", () => {
  // Arrange
  const entrada = {
    type: "residencial",
    area: 45,
    materialType: "piedra",
    tileFormat: "80x80",
    wastePercent: 10,
    selectedProduct: { id: "prd-sell", name: "Sellador Poliuretano Transparente", price: 96_000, unit: "galón" },
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  const lista = nombres(materiales);
  expect(lista).not.toContain("Primer para vinilo");
  expect(lista).not.toContain("Cinta underlayment");
  expect(lista).not.toContain("Nivel de burbuja profesional 60cm");
  expect(buscar(materiales, "Sellador Poliuretano Transparente")!.quantity).toBe("2 galón");
  expect(buscar(materiales, "Sellador Poliuretano Transparente")!.price).toBe(192_000);
  expect(materiales.length).toBe(4);
});

test("CP-F-PROY-02-18", "Omite primer para vinilo si includeAdhesive está desactivado", () => {
  // Arrange
  const entrada = {
    type: "residencial",
    area: 28,
    materialType: "vinilo",
    tileFormat: "45x45",
    wastePercent: 10,
    includeAdhesive: false,
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  expect(nombres(materiales)).not.toContain("Primer para vinilo");
  expect(buscar(materiales, "Vinilo 45x45 cm")!.quantity).toBe("31 m²");
  expect(buscar(materiales, "Vinilo 45x45 cm")!.price).toBe(775_000);
  expect(nombres(materiales)).toStrictEqual(["Vinilo 45x45 cm", "Nivel de burbuja profesional 60cm"]);
});

// --- Herramientas y paredes ---------------------------------------

// Defecto abierto #3 (ver la tabla en tests/README.md): se espera que falle.
test.fails("CP-F-PROY-02-19", "Cotiza paredes en proyecto integral aunque includeTools sea false", () => {
  // Arrange
  const entrada = {
    type: "integral",
    area: 20,
    materialType: "granito",
    tileFormat: "80x80",
    wastePercent: 10,
    includeTools: false,
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  expect(materiales.length).toBe(2);
  const pared = buscar(materiales, "Pared")!;
  expect(pared.name).toBe("Cerámica Pared 80x80 cm");
  expect(pared.quantity).toBe("14 m²");
  expect(pared.note).toBe("Paredes estimadas (+10% desperdicio)");

  const piso = buscar(materiales, "Cerámica 80x80 cm")!;
  expect(piso.quantity).toBe("22 m²");
  // DEFECTO 3: etiqueta 80x80 cotizada al precio del formato 60x60
  expect.soft(piso.price).toBe(924_000);
  expect.soft(pared.price).toBe(588_000);
});

test("CP-F-PROY-02-20", "Incluye kit de herramientas de baldosa (nivel, llana y mazo)", () => {
  // Arrange
  const entrada = {
    type: "residencial",
    area: 12,
    materialType: "ceramica",
    wastePercent: 10,
    includeAdhesive: false,
    includeGrout: false,
    includeSpacers: false,
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  const nivel = buscar(materiales, "Nivel de burbuja profesional 60cm")!;
  const llana = buscar(materiales, "Llana metálica dentada 10x10mm")!;
  const mazo = buscar(materiales, "Mazo de goma blanco anti-marca")!;
  expect(nivel.price).toBe(35_000);
  expect(llana.price).toBe(18_500);
  expect(mazo.price).toBe(14_500);
  expect([nivel, llana, mazo].map((m) => m.quantity)).toStrictEqual(["1 unidad", "1 unidad", "1 unidad"]);
  expect(nombres(materiales)).not.toContain("Kit Rodillo Antigoteo Profesional 23cm");
  expect(buscar(materiales, "Cerámica 60x60 cm")!.quantity).toBe("14 m²");
  expect(materiales.length).toBe(4);
});

test("CP-F-PROY-02-21", "Incluye solo nivel en herramientas para proyectos sin baldosa", () => {
  // Arrange
  const entrada = {
    type: "residencial",
    area: 12,
    materialType: "madera",
    wastePercent: 10,
    includeAdhesive: false,
  };

  // Act
  const materiales = calculateMaterials(entrada);

  // Assert
  expect(nombres(materiales)).toStrictEqual(["Madera laminada 60x60 cm", "Nivel de burbuja profesional 60cm"]);
  expect(buscar(materiales, "Nivel de burbuja")!.price).toBe(35_000);
  expect(buscar(materiales, "Madera laminada 60x60 cm")!.quantity).toBe("14 m²");
  expect(buscar(materiales, "Madera laminada 60x60 cm")!.price).toBe(728_000);
});

test("CP-F-PROY-02-22", "Omite estimación de paredes para pintura o cuando el tipo no es integral", () => {
  // Arrange — un integral de pintura y un residencial de cerámica.
  const integralDePintura = { type: "integral", area: 80, materialType: "pintura", wastePercent: 10 };
  const residencialDeCeramica = { type: "residencial", area: 80, materialType: "ceramica", wastePercent: 10 };

  // Act
  const integralPintura = calculateMaterials(integralDePintura);
  const soloPiso = calculateMaterials(residencialDeCeramica);

  // Assert
  expect(integralPintura.some((m) => m.name.includes("Pared"))).toBe(false);
  expect(buscar(integralPintura, "Pintura Premium")!.quantity).toBe("3 galón(es)");
  expect(buscar(integralPintura, "Pintura Premium")!.price).toBe(375_000);
  expect(integralPintura.length).toBe(4);

  expect(soloPiso.some((m) => m.name.includes("Pared"))).toBe(false);
  expect(buscar(soloPiso, "Cerámica 60x60 cm")!.quantity).toBe("88 m²");
  expect(buscar(soloPiso, "Cerámica 60x60 cm")!.price).toBe(3_423_200);
  expect(soloPiso.length).toBe(7);
});
