import { describe, it, expect } from "vitest";
import { calculateMaterials } from "../../../src/domain/services/materialCalculator.js";

describe("Material Calculator Service", () => {
  it("debe calcular correctamente los materiales para cerámica en Piso con desperdicio", () => {
    const area = 10;
    const result = calculateMaterials({
      type: "PISO",
      area,
      materialType: "ceramica",
      tileFormat: "60x60"
    });

    // 1. Recubrimiento principal: ceil(10 * 1.1) = 11 m²
    const mainCoverage = result.find(m => m.name.includes("Cerámica 60x60 cm"));
    expect(mainCoverage).toBeDefined();
    expect(mainCoverage?.quantity).toBe("11 m²");
    expect(mainCoverage?.price).toBe(11 * 38900); // 38900 COP/m²

    // 2. Pegante cerámico: ceil(10 / 4) = 3 bultos
    const pegante = result.find(m => m.name.includes("Pegante"));
    expect(pegante).toBeDefined();
    expect(pegante?.quantity).toBe("3 bultos");
    expect(pegante?.price).toBe(3 * 28500);

    // 3. Boquilla: ceil(10 / 8) = 2 kg
    const boquilla = result.find(m => m.name.includes("Boquilla"));
    expect(boquilla).toBeDefined();
    expect(boquilla?.quantity).toBe("2 kg");
    expect(boquilla?.price).toBe(2 * 12000);

    // 4. Crucetas: ceil(10 / 15) = 1 bolsa
    const crucetas = result.find(m => m.name.includes("Crucetas"));
    expect(crucetas).toBeDefined();
    expect(crucetas?.quantity).toBe("1 bolsas");
    expect(crucetas?.price).toBe(1 * 8500);

    // 5. Nivel de burbuja: 1 unidad
    const nivel = result.find(m => m.name.includes("Nivel"));
    expect(nivel).toBeDefined();
    expect(nivel?.quantity).toBe("1 unidad");
    expect(nivel?.price).toBe(35000);
  });

  it("debe calcular correctamente madera laminada con cinta underlayment", () => {
    const area = 30;
    const result = calculateMaterials({
      type: "PISO",
      area,
      materialType: "madera",
      tileFormat: "20x60"
    });

    // 1. Recubrimiento principal: ceil(30 * 1.1) = 33 m²
    const mainCoverage = result.find(m => m.name.includes("Madera laminada 20x60 cm"));
    expect(mainCoverage).toBeDefined();
    expect(mainCoverage?.quantity).toBe("33 m²");
    expect(mainCoverage?.price).toBe(33 * 49000); // 49000 COP/m²

    // 2. Cinta underlayment: ceil(30 / 20) = 2 rollos
    const cinta = result.find(m => m.name.includes("Cinta underlayment"));
    expect(cinta).toBeDefined();
    expect(cinta?.quantity).toBe("2 rollos");
    expect(cinta?.price).toBe(2 * 15000);

    // No debe incluir pegante, boquilla ni crucetas
    const pegante = result.find(m => m.name.includes("Pegante"));
    expect(pegante).toBeUndefined();
  });

  it("debe calcular correctamente vinilo con primer adhesivo", () => {
    const area = 25;
    const result = calculateMaterials({
      type: "PISO",
      area,
      materialType: "vinilo",
      tileFormat: "45x45"
    });

    // 1. Recubrimiento: ceil(25 * 1.1) = 28 m²
    const mainCoverage = result.find(m => m.name.includes("Vinilo 45x45 cm"));
    expect(mainCoverage).toBeDefined();
    expect(mainCoverage?.quantity).toBe("28 m²");
    expect(mainCoverage?.price).toBe(28 * 25000); // 25000 COP/m²

    // 2. Primer: ceil(25 / 15) = 2 galones
    const primer = result.find(m => m.name.includes("Primer"));
    expect(primer).toBeDefined();
    expect(primer?.quantity).toBe("2 galones");
    expect(primer?.price).toBe(2 * 45000);
  });

  it("debe agregar un estimado del 60% en paredes si es un proyecto INTEGRAL", () => {
    const area = 20;
    const result = calculateMaterials({
      type: "INTEGRAL",
      area,
      materialType: "ceramica",
      tileFormat: "60x60"
    });

    // 1. Recubrimiento Piso: 22 m²
    const floorCoverage = result.find(m => m.name === "Cerámica 60x60 cm");
    expect(floorCoverage).toBeDefined();
    expect(floorCoverage?.quantity).toBe("22 m²");

    // 2. Recubrimiento Pared: ceil(20 * 0.6) = 12 m² base -> ceil(12 * 1.1) = 14 m² total
    const wallCoverage = result.find(m => m.name === "Cerámica Pared 60x60 cm");
    expect(wallCoverage).toBeDefined();
    expect(wallCoverage?.quantity).toBe("14 m²");
    expect(wallCoverage?.price).toBe(14 * 38900);
  });
});
