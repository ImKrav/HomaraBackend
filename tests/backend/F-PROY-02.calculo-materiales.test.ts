// ============================================================================
// F-PROY-02 · Calcular los materiales — Backend
// Grafo:   15_F-PROY-02_BACKEND_Calcular_los_materiales.drawio
// Unidad:  calculateMaterials()  ·  src/domain/services/materialCalculator.ts
// Métrica: N=46  A=66  P=21  →  V(G) = 66 − 46 + 2 = 22
// Cobertura de ruta básica: 22 caminos independientes → 22 casos de prueba
// Trazabilidad: RF08 · HU8 · ESC08 · BE-PROY-02
// ----------------------------------------------------------------------------
// La unidad es una función de dominio PURA: no hay repositorios ni mocks, sólo
// entradas y aserciones exactas sobre la lista de materiales devuelta.
//
// Nota de diseño: el grafo enumera cada camino como «camino base + una decisión
// invertida». Algunas decisiones del grafo son mutuamente excluyentes dentro del
// código real (p. ej. el paso 5 «¿es pintura?» = SI vuelve imposible el paso 21
// «¿lleva baldosa?» = SI, porque isTile sólo es cierto con cerámica o
// porcelanato). En esos casos la entrada se elige para forzar sin ambigüedad la
// DECISIÓN BAJO PRUEBA del camino, y el resto del recorrido se deja en el valor
// que el código permite; cada caso lo indica en sus comentarios.
// ----------------------------------------------------------------------------
// ESTADO DE EJECUCIÓN — etapa de verificación
//
// Las aserciones marcadas con `// DEFECTO:` afirman lo que el sistema DEBERÍA
// hacer, no lo que hace hoy. Están en rojo a propósito: cada fallo es un defecto
// encontrado sobre calculateMaterials(). La corrección del código queda fuera
// del alcance de este plan de pruebas.
//
// Se usa expect.soft() en esos puntos para que un caso que evidencia varios
// defectos los reporte todos en la misma ejecución, en lugar de detenerse en el
// primero. Ningún caso está marcado con it.skip ni it.fails: los 23 se ejecutan.
//
//   DEFECTO 1 · CP-08 · La clasificación por subcadena "cal" convierte un
//               revestimiento legítimo («Calacatta») en pegante.
//   DEFECTO 2 · CP-02 · La línea de pared cotiza precio_galón × m² de pared.
//   DEFECTO 3 · CP-19 · materialType desconocido: etiqueta 80x80 con precio 60x60.
//   DEFECTO 4 · CP-02 · El desperdicio no llega a pegante, boquilla ni crucetas.
//   DEFECTO 5 · CP-06 · El producto vinculado desaparece de la cotización.
//   DEFECTO 6 · CP-02 · Herramientas de pintura en un proyecto de baldosa.
// ============================================================================
import { describe, it, expect } from "vitest";
import { calculateMaterials } from "../../src/domain/services/materialCalculator.js";

type Material = ReturnType<typeof calculateMaterials>[number];

/** Devuelve el primer material cuyo nombre contiene el fragmento indicado. */
function buscar(materiales: Material[], fragmento: string): Material | undefined {
  return materiales.find((m) => m.name.includes(fragmento));
}

/** Parte numérica de la cantidad («24 bultos» → 24). */
function cantidad(materiales: Material[], fragmento: string): number {
  const m = buscar(materiales, fragmento);
  return m ? Number.parseFloat(m.quantity) : Number.NaN;
}

/** Lista de nombres, útil para aserciones de ausencia y de tamaño. */
function nombres(materiales: Material[]): string[] {
  return materiales.map((m) => m.name);
}

describe("F-PROY-02 · Calcular los materiales", () => {

  // ==========================================================================
  // Área neta y porcentaje de desperdicio — nodos 2 a 11
  // ==========================================================================
  describe("Área neta y desperdicio (nodos 2–11)", () => {

    it("CP-F-PROY-02-01 · camino 1,2,3,4,5,6,11,...,46 · Paso 4 = NO, Paso 5 = SI → la pintura sin porcentaje indicado usa 5 % de desperdicio", () => {
      // Nodo 4 = NO: no se envía wastePercent. Nodo 5 = SI: materialType es pintura.
      const materiales = calculateMaterials({
        type: "interior",
        area: 100,
        materialType: "pintura",
      });

      // Nodo 6: desperdicio fijo del 5 % para pintura.
      const pintura = buscar(materiales, "Pintura Premium")!;
      expect(pintura.note).toContain("+5% desperdicio");
      // Nodo 11: totalArea = ceil(100 × 1.05) = 105 m².
      // Nodo 18: galones = ceil(105 / 30) = 4  →  4 × $125.000 = $500.000.
      expect(pintura.quantity).toBe("4 galón(es)");
      expect(pintura.price).toBe(500_000);
      expect(pintura.productId).toBeNull();
      // Nodo 21 = NO (la pintura nunca es baldosa): no hay insumos de baldosa.
      expect(nombres(materiales)).not.toContain("Crucetas 2mm");
      expect(materiales).toHaveLength(4); // pintura + rodillo + brocha + cinta
    });

    it("CP-F-PROY-02-02 · camino 1,2,3,4,11,...,45,46 · Paso 4 = SI → el porcentaje indicado por el cliente manda sobre el patrón de instalación", () => {
      // Nodo 4 = SI: se envía wastePercent = 20 aunque el patrón «diagonal»
      // habría dado 15 % por el nodo 8. El valor explícito debe ganar.
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

      // Nodos 2 y 3: 1 puerta × 2,0 + 2 ventanas × 1,5 = 5 m² → netArea = 95 m².
      // Nodo 11: totalArea = ceil(95 × 1,20) = 114 m².
      // Nodos 13 y 14 = SI (producto de acabado vendido por galón) → nodo 16.
      const esmalte = buscar(materiales, "Esmalte Sintético Blanco Galón")!;
      expect(esmalte.note).toContain("+20% de desperdicio");
      expect(esmalte.quantity).toBe("4 galón");        // ceil(114 / 30) = 4
      expect(esmalte.price).toBe(356_000);             // 4 × $89.000
      expect(esmalte.productId).toBe("prd-esmalte");

      // Nodos 25, 29 y 31: los insumos deben cubrir la superficie que realmente
      // se instala, es decir los 114 m² con desperdicio, no los 95 m² netos.
      // Hoy se calculan sobre netArea: se compran 114 m² de revestimiento con
      // pegante que sólo alcanza para 96 m² (24 bultos × 4 m²), y la obra se
      // queda corta de material justo por el desperdicio que se acaba de sumar.
      // DEFECTO 4: el desperdicio no se propaga al pegante, la boquilla ni las crucetas.
      expect.soft(cantidad(materiales, "Pegante cerámico flexible")).toBe(29); // ceil(114/4), hoy 24
      expect.soft(cantidad(materiales, "Boquilla")).toBe(15);                  // ceil(114/8), hoy 12
      expect.soft(cantidad(materiales, "Crucetas")).toBe(8);                   // ceil(114/15), hoy 7

      // Nodo 45: paredes = ceil(ceil(95 × 0,6) × 1,20) = ceil(57 × 1,20) = 69 m².
      const pared = buscar(materiales, "Pared")!;
      expect(pared.name).toBe("Esmalte Sintético Blanco Galón Pared");
      // El nodo 45 reutiliza el producto seleccionado sin mirar su unidad de
      // venta: un esmalte que se vende por galón debe cotizarse en galones para
      // los 69 m² de pared —ceil(69/30) = 3 galones × $89.000 = $267.000—, no
      // multiplicando el precio del galón por metros cuadrados.
      // DEFECTO 2: la pared cotiza precio_galón × m², dando $6.141.000 por 69 m².
      expect.soft(pared.quantity).toBe("3 galón");
      expect.soft(pared.price).toBe(267_000);
      // Cota de cordura sobre el mismo defecto: la pared no puede costar más que
      // los 114 m² de revestimiento del piso que la contiene.
      expect.soft(pared.price).toBeLessThanOrEqual(esmalte.price * 2);

      // Nodos 39 a 43: el proyecto instala cerámica, así que la caja de
      // herramientas debe traer nivel, llana y mazo. Hoy el nodo 39 mira sólo la
      // unidad del producto y entrega herramientas de pintura sobre una obra de
      // baldosa que sí cotiza pegante, boquilla y crucetas.
      // DEFECTO 6: herramientas de pintura en un proyecto de baldosa.
      expect.soft(nombres(materiales)).toContain("Llana metálica dentada 10x10mm");
      expect.soft(nombres(materiales)).toContain("Mazo de goma blanco anti-marca");
    });

    it("CP-F-PROY-02-02b · valor límite del área neta sobre el camino base", () => {
      // Nodo 3: el área neta nunca baja de 0,1 m² aunque los descuentos superen
      // al área declarada (5 m² − 3 puertas × 2,0 m² = −1 m²).
      const materiales = calculateMaterials({
        type: "residencial",
        area: 5,
        materialType: "ceramica",
        wastePercent: 20,
        deductDoors: 3,
      });

      // Nodo 11: totalArea = ceil(0,1 × 1,20) = ceil(0,12) = 1 m².
      expect(buscar(materiales, "Cerámica")!.quantity).toBe("1 m²");
      expect(buscar(materiales, "Cerámica")!.price).toBe(38_900);
      // Cada insumo se redondea hacia arriba a la unidad mínima vendible.
      expect(cantidad(materiales, "Pegante cerámico flexible")).toBe(1);
      expect(cantidad(materiales, "Boquilla")).toBe(1);
      expect(cantidad(materiales, "Crucetas")).toBe(1);
    });

    it("CP-F-PROY-02-03 · camino 1,2,3,4,5,7,8,11,...,46 · Paso 4 = NO, Paso 5 = NO, Paso 7 = diagonal → 15 % de desperdicio", () => {
      // Nodo 7 → nodo 8: la instalación en diagonal es la que más recorta baldosa.
      const materiales = calculateMaterials({
        type: "residencial",
        area: 50,
        materialType: "porcelanato",
        layingPattern: "diagonal",
      });

      const porcelanato = buscar(materiales, "Porcelanato")!;
      expect(porcelanato.note).toBe("+15% de desperdicio por colocación");
      // Nodo 11: totalArea = ceil(50 × 1,15) = ceil(57,5) = 58 m².
      expect(porcelanato.quantity).toBe("58 m²");
      expect(porcelanato.price).toBe(2_662_200);   // 58 × $45.900 (porcelanato 60x60)
      // Los insumos siguen usando el área neta de 50 m², sin desperdicio.
      expect(cantidad(materiales, "Pegante cerámico flexible")).toBe(13); // ceil(50/4)
    });

    it("CP-F-PROY-02-04 · camino 1,2,3,4,5,7,9,11,...,46 · Paso 4 = NO, Paso 5 = NO, Paso 7 = trabadura → 12 % de desperdicio", () => {
      // Nodo 7 → nodo 9: la colocación a media junta recorta menos que la diagonal.
      const materiales = calculateMaterials({
        type: "residencial",
        area: 50,
        materialType: "porcelanato",
        layingPattern: "trabadura",
      });

      const porcelanato = buscar(materiales, "Porcelanato")!;
      expect(porcelanato.note).toBe("+12% de desperdicio por colocación");
      // Nodo 11: 50 × 1,12 = 56 exactos; el toFixed(4) evita que el error de
      // coma flotante (56,00000000000001) haga subir el ceil a 57.
      expect(porcelanato.quantity).toBe("56 m²");
      expect(porcelanato.price).toBe(2_570_400);   // 56 × $45.900
    });

    it("CP-F-PROY-02-05 · camino 1,2,3,4,5,7,10,11,...,46 · Paso 4 = NO, Paso 5 = NO, Paso 7 = directo → 10 % de desperdicio", () => {
      // Nodo 7 → nodo 10: la colocación recta es la opción habitual y por defecto.
      const directo = calculateMaterials({
        type: "residencial",
        area: 50,
        materialType: "porcelanato",
        layingPattern: "directo",
      });

      const porcelanato = buscar(directo, "Porcelanato")!;
      expect(porcelanato.note).toBe("+10% de desperdicio por colocación");
      expect(porcelanato.quantity).toBe("55 m²");  // ceil(50 × 1,10)
      expect(porcelanato.price).toBe(2_524_500);   // 55 × $45.900

      // El nodo 10 es además la rama por defecto del switch: un patrón que no
      // está en el catálogo cae también en el 10 %.
      const desconocido = calculateMaterials({
        type: "residencial",
        area: 50,
        materialType: "porcelanato",
        layingPattern: "espiga",
      });
      expect(buscar(desconocido, "Porcelanato")!.quantity).toBe("55 m²");
    });
  });

  // ==========================================================================
  // Elección del revestimiento principal — nodos 12 a 19
  // ==========================================================================
  describe("Revestimiento principal (nodos 12–19)", () => {

    it("CP-F-PROY-02-06 · camino 1,2,3,4,11,12,13,15,18,...,46 · Paso 13 = NO, Paso 15 = SI → con un pegante vinculado se cotiza pintura genérica", () => {
      // Nodo 12: el nombre contiene «pegante» → isConstructionMaterial = true,
      // por lo que el nodo 13 sale por NO aunque sí haya producto seleccionado.
      const materiales = calculateMaterials({
        type: "interior",
        area: 90,
        materialType: "pintura",
        wastePercent: 8,
        deductWindows: 2,
        selectedProduct: { id: "prd-peg", name: "Pegante Cerámico Extrafuerte 25kg", price: 30_500, unit: "bultos" },
      });

      // Nodos 2 y 3: 2 ventanas × 1,5 = 3 m² → netArea = 87 m².
      // Nodo 11: totalArea = ceil(87 × 1,08) = ceil(93,96) = 94 m².
      // Nodo 18: galones = ceil(94 / 30) = 4 → 4 × $125.000.
      const pintura = buscar(materiales, "Pintura Premium de Interior/Exterior")!;
      expect(pintura.quantity).toBe("4 galón(es)");
      expect(pintura.price).toBe(500_000);
      expect(pintura.note).toContain("+8% desperdicio");
      expect(pintura.productId).toBeNull();

      // Un producto que el usuario eligió a mano debe llegar a la cotización de
      // alguna forma. Aquí cae en un hueco del grafo: el nodo 13 lo descarta por
      // ser material de construcción y el nodo 21 lo descarta por no haber
      // baldosa, así que desaparece en silencio y sin aviso alguno.
      // DEFECTO 5: el producto vinculado se pierde entre los nodos 13 y 21.
      expect.soft(nombres(materiales)).toContain("Pegante Cerámico Extrafuerte 25kg");
      expect.soft(buscar(materiales, "Pegante Cerámico Extrafuerte 25kg")?.productId).toBe("prd-peg");
    });

    it("CP-F-PROY-02-07 · camino 1,2,3,4,11,12,13,14,17,...,46 · Paso 13 = SI, Paso 14 = NO → el producto del catálogo se cotiza por metro cuadrado", () => {
      // Nodo 14 = NO: la unidad es m² y el materialType no es pintura → nodo 17.
      const materiales = calculateMaterials({
        type: "residencial",
        area: 64.5,
        materialType: "porcelanato",
        wastePercent: 10,
        selectedProduct: { id: "prd-porc", name: "Porcelanato Marfil Pulido 60x60", price: 52_900, unit: "m²" },
      });

      // Nodo 11: totalArea = ceil(64,5 × 1,10) = ceil(70,95) = 71 m².
      const porcelanato = buscar(materiales, "Porcelanato Marfil Pulido 60x60")!;
      expect(porcelanato.quantity).toBe("71 m²");
      expect(porcelanato.price).toBe(3_755_900);   // 71 × $52.900
      expect(porcelanato.note).toBe("Cálculo exacto con +10% de desperdicio");
      expect(porcelanato.productId).toBe("prd-porc");

      // Insumos sobre el área neta de 64,5 m².
      expect(cantidad(materiales, "Pegante cerámico flexible")).toBe(17); // ceil(64,5/4)
      expect(cantidad(materiales, "Boquilla")).toBe(9);                   // ceil(64,5/8)
      expect(cantidad(materiales, "Crucetas")).toBe(5);                   // ceil(64,5/15)
      expect(materiales).toHaveLength(7);
    });

    it("CP-F-PROY-02-08 · camino 1,2,3,4,11,12,13,15,19,...,46 · Paso 13 = NO, Paso 15 = NO → baldosa genérica del catálogo interno y pegante real vinculado", () => {
      // Nodo 12: «Pegante …» marca isPeganteProduct → nodo 13 = NO y nodo 23 = SI.
      const materiales = calculateMaterials({
        type: "residencial",
        area: 40,
        materialType: "ceramica",
        tileFormat: "30x30",
        wastePercent: 10,
        selectedProduct: { id: "prd-peg-10", name: "Pegante Blanco Porcelanato 10kg", price: 21_500, unit: "bultos" },
      });

      // Nodo 19: TILE_PRICES.ceramica["30x30"] = $29.000 y totalArea = ceil(44) = 44.
      const ceramica = buscar(materiales, "Cerámica 30x30 cm")!;
      expect(ceramica.quantity).toBe("44 m²");
      expect(ceramica.price).toBe(1_276_000);      // 44 × $29.000
      expect(ceramica.productId).toBeNull();

      // Nodo 24: peso leído del nombre = 10 kg → rendimiento 10 × 0,16 = 1,6 m²
      // por bulto → bultos = ceil(40 / 1,6) = 25.
      const pegante = buscar(materiales, "Pegante Blanco Porcelanato 10kg")!;
      expect(pegante.quantity).toBe("25 bultos");
      expect(pegante.price).toBe(537_500);         // 25 × $21.500
      expect(pegante.note).toBe("Pegante real vinculado: 1 unidad de 10kg por cada 1.6m²");
      expect(pegante.productId).toBe("prd-peg-10");

      // El nodo 12 clasifica el producto por subcadena, y «cal» aparece dentro de
      // nombres comerciales legítimos. Un porcelanato «Calacatta» —vendido por
      // m², de la familia de acabados— debe recorrer el nodo 13 = SI y cotizarse
      // como revestimiento principal: 44 m² × $71.000 = $3.124.000. Hoy el
      // nodo 13 sale por NO, el revestimiento se sustituye por cerámica genérica
      // y el porcelanato aparece en la lista como si fuera el pegante.
      const calacatta = calculateMaterials({
        type: "residencial",
        area: 40,
        materialType: "ceramica",
        tileFormat: "30x30",
        wastePercent: 10,
        selectedProduct: { id: "prd-cal", name: "Porcelanato Calacatta Gold 60x60", price: 71_000, unit: "m²" },
      });
      const acabado = buscar(calacatta, "Porcelanato Calacatta Gold 60x60")!;
      // DEFECTO 1: la subcadena "cal" convierte el revestimiento elegido en pegante.
      expect.soft(acabado.note).not.toContain("Pegante");
      expect.soft(acabado.note).toBe("Cálculo exacto con +10% de desperdicio");
      expect.soft(acabado.quantity).toBe("44 m²");   // hoy "10 m²", como si fueran bultos
      expect.soft(acabado.price).toBe(3_124_000);    // hoy $710.000
      expect.soft(acabado.icon).toBe("🏗️");          // hoy 🧱, el icono del pegante
      // Al reconocerlo como acabado, deja de aparecer la cerámica genérica que
      // hoy lo suplanta, y el pegante vuelve a ser el genérico de 25 kg.
      expect.soft(buscar(calacatta, "Cerámica 30x30 cm")).toBeUndefined();
      expect.soft(nombres(calacatta)).toContain("Pegante cerámico flexible 25kg");
    });
  });

  // ==========================================================================
  // Insumos de baldosa — nodos 20 a 31
  // ==========================================================================
  describe("Insumos de baldosa (nodos 20–31)", () => {

    it("CP-F-PROY-02-09 · camino 1,2,3,4,11,12,13,...,20,21,32,...,46 · Paso 21 = NO → sin baldosa no se cotizan pegante, boquilla ni crucetas", () => {
      // Nodo 20: isTile sólo es cierto con cerámica o porcelanato; la madera
      // hace que el nodo 21 salga por NO y se salte todo el bloque 22–31.
      const materiales = calculateMaterials({
        type: "residencial",
        area: 30,
        materialType: "madera",
        wastePercent: 10,
      });

      expect(buscar(materiales, "Madera laminada 60x60 cm")!.quantity).toBe("33 m²");
      expect(buscar(materiales, "Madera laminada 60x60 cm")!.price).toBe(1_716_000); // 33 × $52.000
      const lista = nombres(materiales);
      expect(lista).not.toContain("Pegante cerámico flexible 25kg");
      expect(lista).not.toContain("Boquilla");
      expect(lista).not.toContain("Crucetas 2mm");
      // Nodo 42 = NO: tampoco entran la llana ni el mazo, propios de la baldosa.
      expect(lista).not.toContain("Llana metálica dentada 10x10mm");
      expect(materiales).toHaveLength(3); // madera + cinta underlayment + nivel
    });

    it("CP-F-PROY-02-10 · camino 1,2,3,4,11,...,21,22,26,27,28,30,31,...,46 · Paso 22 = NO → sin pegante, con boquilla real del catálogo", () => {
      // Nodo 22 = NO: includeAdhesive desactivado.
      // Nodo 27 = SI: el producto vinculado es una boquilla real.
      const materiales = calculateMaterials({
        type: "residencial",
        area: 60,
        materialType: "ceramica",
        wastePercent: 10,
        includeAdhesive: false,
        selectedProduct: { id: "prd-boq-2", name: "Boquilla Premium Antihongos 2kg", price: 18_900, unit: "unidades" },
      });

      expect(nombres(materiales)).not.toContain("Pegante cerámico flexible 25kg");
      // Nodo 28: 2 kg × 8 m²/kg = 16 m² por envase → ceil(60 / 16) = 4 unidades.
      const boquilla = buscar(materiales, "Boquilla Premium Antihongos 2kg")!;
      expect(boquilla.quantity).toBe("4 unidades");
      expect(boquilla.price).toBe(75_600);         // 4 × $18.900
      expect(boquilla.note).toBe("Boquilla real vinculada: 1 unidad de 2kg por cada 16m²");
      // Nodo 31: crucetas = ceil(60 / 15) = 4 bolsas.
      expect(cantidad(materiales, "Crucetas")).toBe(4);
      expect(materiales).toHaveLength(6);
    });

    it("CP-F-PROY-02-11 · camino 1,2,3,4,11,...,22,23,25,26,...,46 · Paso 23 = NO → pegante cerámico genérico de 25 kg", () => {
      // Nodo 23 = NO: hay producto seleccionado pero es de acabado, no un pegante.
      const materiales = calculateMaterials({
        type: "residencial",
        area: 37,
        materialType: "ceramica",
        wastePercent: 10,
        selectedProduct: { id: "prd-imp", name: "Impermeabilizante Acrílico Blanco", price: 78_000, unit: "galón" },
      });

      // Nodo 25: bultos = ceil(37 / 4) = ceil(9,25) = 10.
      const pegante = buscar(materiales, "Pegante cerámico flexible 25kg")!;
      expect(pegante.quantity).toBe("10 bultos");
      expect(pegante.price).toBe(285_000);         // 10 × $28.500
      expect(pegante.note).toBe("25kg c/u (Rendimiento: 4m²/bulto)");
      expect(pegante.productId).toBeNull();
      // Nodos 13 y 14 = SI: el impermeabilizante se cotiza por galones,
      // totalArea = ceil(37 × 1,10) = 41 → ceil(41 / 30) = 2 galones.
      expect(buscar(materiales, "Impermeabilizante")!.quantity).toBe("2 galón");
      expect(buscar(materiales, "Impermeabilizante")!.price).toBe(156_000);
    });

    it("CP-F-PROY-02-12 · camino 1,2,3,4,11,...,22,26,30,31,...,46 · Paso 26 = NO → sin boquilla, las crucetas se mantienen", () => {
      // Nodo 22 = NO y nodo 26 = NO: el cliente pone su propio pegante y su
      // propia boquilla, pero sí compra crucetas.
      const materiales = calculateMaterials({
        type: "residencial",
        area: 45,
        materialType: "ceramica",
        wastePercent: 10,
        includeAdhesive: false,
        includeGrout: false,
      });

      const lista = nombres(materiales);
      expect(lista).not.toContain("Pegante cerámico flexible 25kg");
      expect(lista).not.toContain("Boquilla");
      // Nodo 31: ceil(45 / 15) = 3 bolsas → 3 × $8.500.
      expect(buscar(materiales, "Crucetas 2mm")!.quantity).toBe("3 bolsas");
      expect(buscar(materiales, "Crucetas 2mm")!.price).toBe(25_500);
      expect(buscar(materiales, "Cerámica 60x60 cm")!.quantity).toBe("50 m²"); // ceil(45 × 1,10)
      expect(materiales).toHaveLength(5);
    });

    it("CP-F-PROY-02-13 · camino 1,2,3,4,11,...,26,27,29,30,31,...,46 · Paso 27 = NO → boquilla genérica a 8 m² por kilo", () => {
      // Nodo 27 = NO: no hay boquilla vinculada, se usa la genérica del nodo 29.
      const materiales = calculateMaterials({
        type: "residencial",
        area: 45,
        materialType: "porcelanato",
        wastePercent: 10,
        includeAdhesive: false,
      });

      // Nodo 29: kg = ceil(45 / 8) = ceil(5,625) = 6 → 6 × $12.000.
      const boquilla = buscar(materiales, "Boquilla")!;
      expect(boquilla.quantity).toBe("6 kg");
      expect(boquilla.price).toBe(72_000);
      expect(boquilla.note).toBe("Rendimiento: 8m²/kg");
      expect(boquilla.productId).toBeNull();
      expect(buscar(materiales, "Porcelanato 60x60 cm")!.price).toBe(2_295_000); // 50 × $45.900
      expect(materiales).toHaveLength(6);
    });

    it("CP-F-PROY-02-14 · camino 1,2,3,4,11,...,22,26,30,32,...,46 · Paso 30 = NO → sin crucetas queda sólo el revestimiento y las herramientas", () => {
      // Nodos 22, 26 y 30 = NO: los tres insumos de baldosa quedan fuera.
      const materiales = calculateMaterials({
        type: "residencial",
        area: 45,
        materialType: "ceramica",
        wastePercent: 10,
        includeAdhesive: false,
        includeGrout: false,
        includeSpacers: false,
      });

      expect(nombres(materiales)).not.toContain("Crucetas 2mm");
      expect(buscar(materiales, "Cerámica 60x60 cm")!.quantity).toBe("50 m²");
      expect(buscar(materiales, "Cerámica 60x60 cm")!.price).toBe(1_945_000); // 50 × $38.900
      // Nodos 41 y 43: aunque no haya insumos, las herramientas de baldosa siguen.
      expect(nombres(materiales)).toEqual([
        "Cerámica 60x60 cm",
        "Nivel de burbuja profesional 60cm",
        "Llana metálica dentada 10x10mm",
        "Mazo de goma blanco anti-marca",
      ]);
    });
  });

  // ==========================================================================
  // Insumos de madera y de vinilo — nodos 32 a 37
  // ==========================================================================
  describe("Insumos de madera y vinilo (nodos 32–37)", () => {

    it("CP-F-PROY-02-15 · camino 1,2,3,4,11,...,21,32,35,36,37,...,46 · Paso 32 = NO → el vinilo no lleva cinta underlayment", () => {
      // Nodo 32 = NO (no es madera) y nodo 35 = SI (es vinilo).
      const materiales = calculateMaterials({
        type: "residencial",
        area: 28,
        materialType: "vinilo",
        tileFormat: "45x45",
        wastePercent: 10,
      });

      expect(nombres(materiales)).not.toContain("Cinta underlayment");
      // Nodo 19: totalArea = ceil(28 × 1,10) = ceil(30,8) = 31 m² × $25.000.
      expect(buscar(materiales, "Vinilo 45x45 cm")!.quantity).toBe("31 m²");
      expect(buscar(materiales, "Vinilo 45x45 cm")!.price).toBe(775_000);
      // Nodo 37: galones = ceil(28 / 15) = 2 → 2 × $45.000.
      const primer = buscar(materiales, "Primer para vinilo")!;
      expect(primer.quantity).toBe("2 galones");
      expect(primer.price).toBe(90_000);
      expect(materiales).toHaveLength(3);
    });

    it("CP-F-PROY-02-16 · camino 1,2,3,4,11,...,32,33,35,...,46 · Paso 33 = NO → la madera sin base aislante no suma rollos de cinta", () => {
      // Nodo 32 = SI (madera) pero nodo 33 = NO: includeAdhesive desactivado.
      const materiales = calculateMaterials({
        type: "residencial",
        area: 30,
        materialType: "madera",
        wastePercent: 10,
        includeAdhesive: false,
      });

      expect(nombres(materiales)).not.toContain("Cinta underlayment");
      expect(buscar(materiales, "Madera laminada 60x60 cm")!.quantity).toBe("33 m²");
      expect(buscar(materiales, "Madera laminada 60x60 cm")!.price).toBe(1_716_000);
      expect(nombres(materiales)).toEqual([
        "Madera laminada 60x60 cm",
        "Nivel de burbuja profesional 60cm",
      ]);
    });

    it("CP-F-PROY-02-17 · camino 1,2,3,4,11,...,21,32,35,38,39,40,...,46 · Paso 35 = NO → sin vinilo no hay primer y el material desconocido cae en el precio por defecto", () => {
      // Nodos 21, 32 y 35 = NO: el materialType no es baldosa, ni madera, ni vinilo.
      const materiales = calculateMaterials({
        type: "residencial",
        area: 45,
        materialType: "piedra",
        tileFormat: "80x80",
        wastePercent: 10,
        selectedProduct: { id: "prd-sell", name: "Sellador Poliuretano Transparente", price: 96_000, unit: "galón" },
      });

      const lista = nombres(materiales);
      expect(lista).not.toContain("Primer para vinilo");
      expect(lista).not.toContain("Cinta underlayment");
      expect(lista).not.toContain("Nivel de burbuja profesional 60cm");
      // Nodos 13 y 14 = SI: totalArea = ceil(45 × 1,10) = 50 → ceil(50/30) = 2 galones.
      expect(buscar(materiales, "Sellador Poliuretano Transparente")!.quantity).toBe("2 galón");
      expect(buscar(materiales, "Sellador Poliuretano Transparente")!.price).toBe(192_000);
      expect(materiales).toHaveLength(4);
    });

    it("CP-F-PROY-02-18 · camino 1,2,3,4,11,...,32,35,36,38,...,46 · Paso 36 = NO → el vinilo sin adhesivo queda sin primer", () => {
      // Nodo 35 = SI pero nodo 36 = NO: includeAdhesive desactivado.
      const materiales = calculateMaterials({
        type: "residencial",
        area: 28,
        materialType: "vinilo",
        tileFormat: "45x45",
        wastePercent: 10,
        includeAdhesive: false,
      });

      expect(nombres(materiales)).not.toContain("Primer para vinilo");
      expect(buscar(materiales, "Vinilo 45x45 cm")!.quantity).toBe("31 m²");
      expect(buscar(materiales, "Vinilo 45x45 cm")!.price).toBe(775_000);
      expect(nombres(materiales)).toEqual([
        "Vinilo 45x45 cm",
        "Nivel de burbuja profesional 60cm",
      ]);
    });
  });

  // ==========================================================================
  // Herramientas y estimación de paredes — nodos 38 a 45
  // ==========================================================================
  describe("Herramientas y paredes (nodos 38–45)", () => {

    it("CP-F-PROY-02-19 · camino 1,2,3,4,11,...,38,44,45,46 · Paso 38 = NO → sin herramientas, pero el proyecto integral sí cotiza paredes", () => {
      // Nodo 38 = NO: includeTools desactivado. Nodo 44 = SI: type integral.
      const materiales = calculateMaterials({
        type: "integral",
        area: 20,
        materialType: "granito",
        tileFormat: "80x80",
        wastePercent: 10,
        includeTools: false,
      });

      expect(materiales).toHaveLength(2);
      // Nodo 45: wallArea = ceil(20 × 0,6) = 12; wallTotal = ceil(12 × 1,10) = 14 m².
      const pared = buscar(materiales, "Pared")!;
      expect(pared.name).toBe("Cerámica Pared 80x80 cm");
      expect(pared.quantity).toBe("14 m²");
      expect(pared.note).toBe("Paredes estimadas (+10% desperdicio)");

      // «granito» no existe en MATERIAL_NAMES ni en TILE_PRICES, así que el
      // nodo 19 lo degrada a «Cerámica». Si el sistema decide etiquetar la línea
      // como cerámica de 80x80 cm, el precio que cobra tiene que ser el de ese
      // formato: TILE_PRICES.ceramica["80x80"] = $42.000/m². Hoy cae al precio
      // del 60x60 ($38.900/m²) y el cliente ve un formato y paga otro.
      const piso = buscar(materiales, "Cerámica 80x80 cm")!;
      expect(piso.quantity).toBe("22 m²");         // ceil(20 × 1,10)
      // DEFECTO 3: etiqueta 80x80 cotizada al precio del formato 60x60.
      expect.soft(piso.price).toBe(924_000);       // 22 × $42.000, hoy $855.800
      expect.soft(pared.price).toBe(588_000);      // 14 × $42.000, hoy $544.600
    });

    it("CP-F-PROY-02-20 · camino 1,2,3,4,11,...,38,39,41,42,43,44,45,46 · Paso 39 = NO, Paso 42 = SI → herramientas de baldosa: nivel, llana y mazo", () => {
      // Nodo 39 = NO: no es pintura ni el producto se vende por galón.
      // Nodo 42 = SI: el proyecto lleva cerámica.
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
      expect(nivel.price).toBe(35_000);
      expect(llana.price).toBe(18_500);
      expect(mazo.price).toBe(14_500);
      expect([nivel, llana, mazo].every((m) => m.quantity === "1 unidad")).toBe(true);
      // Nodo 40 = NO: no aparecen los insumos de pintura.
      expect(nombres(materiales)).not.toContain("Kit Rodillo Antigoteo Profesional 23cm");
      expect(buscar(materiales, "Cerámica 60x60 cm")!.quantity).toBe("14 m²"); // ceil(12 × 1,10 = 13,2)
      expect(materiales).toHaveLength(4);
    });

    it("CP-F-PROY-02-21 · camino 1,2,3,4,11,...,38,39,41,42,44,45,46 · Paso 42 = NO → sin baldosa la caja de herramientas se reduce al nivel", () => {
      // Nodo 41 se ejecuta siempre en esta rama; el nodo 42 = NO deja fuera el 43.
      const materiales = calculateMaterials({
        type: "residencial",
        area: 12,
        materialType: "madera",
        wastePercent: 10,
        includeAdhesive: false,
      });

      expect(nombres(materiales)).toEqual([
        "Madera laminada 60x60 cm",
        "Nivel de burbuja profesional 60cm",
      ]);
      expect(buscar(materiales, "Nivel de burbuja")!.price).toBe(35_000);
      expect(buscar(materiales, "Madera laminada 60x60 cm")!.quantity).toBe("14 m²");
      expect(buscar(materiales, "Madera laminada 60x60 cm")!.price).toBe(728_000); // 14 × $52.000
    });

    it("CP-F-PROY-02-22 · camino 1,2,3,4,11,...,38,44,46 · Paso 44 = NO → no se estiman paredes y el cálculo termina", () => {
      // El nodo 44 exige las DOS condiciones: type integral Y materialType
      // distinto de pintura. Aquí falla la segunda pese a ser integral.
      const integralPintura = calculateMaterials({
        type: "integral",
        area: 80,
        materialType: "pintura",
        wastePercent: 10,
      });
      expect(integralPintura.some((m) => m.name.includes("Pared"))).toBe(false);
      // Nodo 18: totalArea = ceil(80 × 1,10) = 88 → ceil(88 / 30) = 3 galones.
      expect(buscar(integralPintura, "Pintura Premium")!.quantity).toBe("3 galón(es)");
      expect(buscar(integralPintura, "Pintura Premium")!.price).toBe(375_000);
      expect(integralPintura).toHaveLength(4);

      // Y falla la primera cuando el proyecto no es integral.
      const soloPiso = calculateMaterials({
        type: "residencial",
        area: 80,
        materialType: "ceramica",
        wastePercent: 10,
      });
      expect(soloPiso.some((m) => m.name.includes("Pared"))).toBe(false);
      expect(buscar(soloPiso, "Cerámica 60x60 cm")!.quantity).toBe("88 m²");
      expect(buscar(soloPiso, "Cerámica 60x60 cm")!.price).toBe(3_423_200); // 88 × $38.900
      expect(soloPiso).toHaveLength(7);
    });
  });
});
