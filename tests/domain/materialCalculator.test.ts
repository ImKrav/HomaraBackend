// ============================================
// Homara — Extreme Domain Tests: Material Calculator
// ============================================

import { describe, it, expect } from "vitest";
import { calculateMaterials } from "../../src/domain/services/materialCalculator.js";

describe("Material Calculator (Extreme/Critical Cases)", () => {
  it("should apply safeguard (minimum 0.1 m²) when deductions exceed the total area", () => {
    const result = calculateMaterials({
      type: "piso",
      area: 2.0, // Área pequeña
      materialType: "ceramica",
      tileFormat: "60x60",
      deductDoors: 2, // 2 puertas * 2.0 = 4.0 m² deducción
      deductWindows: 2, // 2 ventanas * 1.5 = 3.0 m² deducción
      customSubtractions: 1.0, // 1.0 m² adicional
      wastePercent: 10,
    });

    // Net area calculada debería ser: max(0.1, 2.0 - 8.0) = 0.1
    // Total area con desperdicio = Math.ceil(0.1 * 1.1) = 1 m²
    const mainMaterial = result.find((m) => m.name.includes("Cerámica"));
    expect(mainMaterial).toBeDefined();
    expect(mainMaterial?.quantity).toBe("1 m²");
  });

  it("should handle asymmetric behavior: Paint uses 5% waste ignoring laying patterns, Tile respects 15% diagonal waste", () => {
    // Escenario A: Pintura con patrón "diagonal" (no debería importar el patrón)
    const paintResult = calculateMaterials({
      type: "pared",
      area: 100, // 100 m²
      materialType: "pintura",
      layingPattern: "diagonal", // Irrelevante para pintura
      wastePercent: undefined, // Fuerza a que la función asigne el desperdicio por defecto
    });

    // Net = 100, Waste para pintura = 5% -> 105 m² / 30 m² por galón = 3.5 -> Math.ceil = 4 galones
    const paintMaterial = paintResult.find((m) => m.name.includes("Pintura"));
    expect(paintMaterial).toBeDefined();
    expect(paintMaterial?.quantity).toBe("4 galón(es)");
    expect(paintMaterial?.note).toContain("+5% desperdicio");

    // Escenario B: Cerámica con patrón "diagonal" (15%)
    const tileResult = calculateMaterials({
      type: "piso",
      area: 100, // 100 m²
      materialType: "ceramica",
      layingPattern: "diagonal",
      wastePercent: undefined, // Asigna 15% por "diagonal"
    });

    // Net = 100, Waste = 15% -> 115 m²
    const tileMaterial = tileResult.find((m) => m.name.includes("Cerámica"));
    expect(tileMaterial).toBeDefined();
    expect(tileMaterial?.quantity).toBe("115 m²");
    expect(tileMaterial?.note).toContain("+15% de desperdicio");
  });

  it("should override Integral projects with real product details correctly", () => {
    const selectedProduct = {
      id: "real-prod-123",
      name: "Porcelanato Premium",
      price: 50000,
      unit: "cajas",
    };

    const result = calculateMaterials({
      type: "integral",
      area: 50, // 50 m² base
      wastePercent: 10,
      selectedProduct,
    });

    // Base area = 50 * 1.1 = 55 cajas (del producto real)
    const mainMaterial = result.find((m) => m.productId === "real-prod-123" && !m.name.includes("Pared"));
    expect(mainMaterial).toBeDefined();
    expect(mainMaterial?.quantity).toBe("55 cajas");
    expect(mainMaterial?.price).toBe(50000 * 55);

    // Pared area estimada = Math.ceil(50 * 0.6) = 30
    // Pared total = Math.ceil(30 * 1.1) = 33 cajas
    const wallMaterial = result.find((m) => m.productId === "real-prod-123" && m.name.includes("Pared"));
    expect(wallMaterial).toBeDefined();
    expect(wallMaterial?.name).toBe("Porcelanato Premium Pared");
    expect(wallMaterial?.quantity).toBe("33 m²"); // Las paredes se estiman en m² pero usan el precio unitario del producto real
    expect(wallMaterial?.price).toBe(50000 * 33);
  });

  it("should be resilient to extreme numerical inputs (0 waste, huge area, large custom deductions)", () => {
    const result = calculateMaterials({
      type: "techo",
      area: 5000000.5, // 5 millones de m²
      materialType: "vinilo",
      wastePercent: 0, // 0% desperdicio
      customSubtractions: 1000000.5, // Restar 1 millón de m²
      includeAdhesive: true,
      includeTools: false,
      includeGrout: false,
      includeSpacers: false,
    });

    // Net area = 4000000
    // Total area (0% waste) = 4000000
    const mainMaterial = result.find((m) => m.name.includes("Vinilo"));
    expect(mainMaterial).toBeDefined();
    expect(mainMaterial?.quantity).toBe("4000000 m²");

    // Adhesivo / Primer de vinilo: 1 galón por cada 15m²
    // 4000000 / 15 = 266666.66 -> Math.ceil = 266667 galones
    const primerMaterial = result.find((m) => m.name.includes("Primer"));
    expect(primerMaterial).toBeDefined();
    expect(primerMaterial?.quantity).toBe("266667 galones");
  });

  it("should dynamically scale pegante packages when weight is specified in the name", () => {
    // Pegante de 5kg. Cobertura: 5 * 0.16 = 0.8 m² por unidad.
    // Para area = 10m², necesitamos Math.ceil(10 / 0.8) = 13 bultos.
    const result = calculateMaterials({
      type: "piso",
      area: 10.0,
      materialType: "ceramica",
      tileFormat: "60x60",
      includeAdhesive: true,
      includeGrout: false,
      includeSpacers: false,
      includeTools: false,
      selectedProduct: {
        id: "pegante-5kg",
        name: "Pegante cerámico flexible 5kg",
        price: 8000,
        unit: "bultos"
      }
    });

    const pegante = result.find((m) => m.productId === "pegante-5kg");
    expect(pegante).toBeDefined();
    expect(pegante?.quantity).toBe("13 bultos");
    expect(pegante?.note).toContain("1 unidad de 5kg por cada 0.8m²");
    expect(pegante?.price).toBe(8000 * 13);
  });

  it("should dynamically scale boquilla packages when weight in grams is specified in the name", () => {
    // Boquilla de 500g (0.5kg). Cobertura: 0.5 * 8 = 4 m² por unidad.
    // Para area = 10m², necesitamos Math.ceil(10 / 4) = 3 bolsas.
    const result = calculateMaterials({
      type: "piso",
      area: 10.0,
      materialType: "ceramica",
      tileFormat: "60x60",
      includeAdhesive: false,
      includeGrout: true,
      includeSpacers: false,
      includeTools: false,
      selectedProduct: {
        id: "boquilla-500g",
        name: "Boquilla blanca 500g anti-hongos",
        price: 6000,
        unit: "bolsas"
      }
    });

    const boquilla = result.find((m) => m.productId === "boquilla-500g");
    expect(boquilla).toBeDefined();
    expect(boquilla?.quantity).toBe("3 bolsas");
    expect(boquilla?.note).toContain("1 unidad de 0.5kg por cada 4m²");
    expect(boquilla?.price).toBe(6000 * 3);
  });

  it("should fallback to default package sizes when product name has no parseable weight", () => {
    // Pegante sin peso especificado en el nombre. Fallback a 25kg (cubre 4m²).
    // Para area = 10m², necesitamos Math.ceil(10 / 4) = 3 bultos.
    const result = calculateMaterials({
      type: "piso",
      area: 10.0,
      materialType: "ceramica",
      tileFormat: "60x60",
      includeAdhesive: true,
      includeGrout: false,
      includeSpacers: false,
      includeTools: false,
      selectedProduct: {
        id: "pegante-generico",
        name: "Pegante cerámico premium sin indicación de peso",
        price: 25000,
        unit: "bultos"
      }
    });

    const pegante = result.find((m) => m.productId === "pegante-generico");
    expect(pegante).toBeDefined();
    expect(pegante?.quantity).toBe("3 bultos");
    expect(pegante?.note).toBe("Pegante real vinculado: 1 bulto por cada 4m²");
  });
});

