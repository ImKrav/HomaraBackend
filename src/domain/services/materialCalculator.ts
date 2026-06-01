// ============================================
// Homara — Domain Service: Material Calculator (TS)
// ============================================

interface CalculatorParams {
  type: string;
  area: number;
  materialType?: string;
  tileFormat?: string;
}

interface CalculatedMaterial {
  name: string;
  quantity: string;
  note: string | null;
  icon: string;
  price: number;
}

const PRICES = {
  pegante: 28500,     // por bulto de 25kg
  boquilla: 12000,    // por kg
  crucetas: 8500,     // por bolsa de 100u
  nivel: 35000,       // unidad
  cinta: 15000,       // rollo
  primer: 45000,      // galón
};

const COVERAGE = {
  pegante: 4,         // m² por bulto
  boquilla: 8,        // m² por kg
  crucetas: 15,       // m² por bolsa
};

const TILE_PRICES: Record<string, Record<string, number>> = {
  ceramica: {
    "60x60": 38900,
    "45x45": 32000,
    "30x60": 35500,
    "20x60": 34000,
  },
  porcelanato: {
    "60x60": 45900,
    "45x45": 39000,
    "30x60": 42000,
    "20x60": 41000,
  },
  madera: {
    "60x60": 52000,
    "45x45": 48000,
    "30x60": 50000,
    "20x60": 49000,
  },
  vinilo: {
    "60x60": 28000,
    "45x45": 25000,
    "30x60": 27000,
    "20x60": 26000,
  },
};

const MATERIAL_NAMES: Record<string, string> = {
  ceramica: "Cerámica",
  porcelanato: "Porcelanato",
  madera: "Madera laminada",
  vinilo: "Vinilo",
};

const FORMAT_LABELS: Record<string, string> = {
  "60x60": "60x60 cm",
  "45x45": "45x45 cm",
  "30x60": "30x60 cm",
  "20x60": "20x60 cm",
};

export function calculateMaterials({
  type,
  area,
  materialType = "ceramica",
  tileFormat = "60x60",
}: CalculatorParams): CalculatedMaterial[] {
  const materials: CalculatedMaterial[] = [];
  const wastePercent = 0.10; // 10% desperdicio

  const totalArea = Math.ceil(area * (1 + wastePercent));

  const matName = MATERIAL_NAMES[materialType] || "Cerámica";
  const formatLabel = FORMAT_LABELS[tileFormat] || tileFormat;
  const pricePerM2 = TILE_PRICES[materialType]?.[tileFormat] || TILE_PRICES.ceramica["60x60"];

  // 1. Recubrimiento principal
  materials.push({
    name: `${matName} ${formatLabel}`,
    quantity: `${totalArea} m²`,
    note: "+10% de desperdicio",
    icon: "🏗️",
    price: pricePerM2 * totalArea,
  });

  // 2. Pegante cerámico (cerámica y porcelanato)
  if (materialType === "ceramica" || materialType === "porcelanato") {
    const bultos = Math.ceil(area / COVERAGE.pegante);
    materials.push({
      name: "Pegante cerámico flexible 25kg",
      quantity: `${bultos} bultos`,
      note: "25kg c/u",
      icon: "🧱",
      price: PRICES.pegante * bultos,
    });

    // 3. Boquilla
    const kgBoquilla = Math.ceil(area / COVERAGE.boquilla);
    materials.push({
      name: "Boquilla",
      quantity: `${kgBoquilla} kg`,
      note: null,
      icon: "🪣",
      price: PRICES.boquilla * kgBoquilla,
    });

    // 4. Crucetas
    const bolsasCrucetas = Math.ceil(area / COVERAGE.crucetas);
    materials.push({
      name: "Crucetas 2mm",
      quantity: `${bolsasCrucetas} bolsas`,
      note: "100 unidades c/u",
      icon: "➕",
      price: PRICES.crucetas * bolsasCrucetas,
    });
  }

  // Madera laminada
  if (materialType === "madera") {
    const rollos = Math.ceil(area / 20);
    materials.push({
      name: "Cinta underlayment",
      quantity: `${rollos} rollos`,
      note: "20m² c/u",
      icon: "📏",
      price: PRICES.cinta * rollos,
    });
  }

  // Vinilo
  if (materialType === "vinilo") {
    const galones = Math.ceil(area / 15);
    materials.push({
      name: "Primer para vinilo",
      quantity: `${galones} galones`,
      note: "15m² c/u",
      icon: "🪣",
      price: PRICES.primer * galones,
    });
  }

  // 5. Nivel de burbuja
  materials.push({
    name: "Nivel de burbuja 60cm",
    quantity: "1 unidad",
    note: null,
    icon: "📏",
    price: PRICES.nivel,
  });

  // Si es tipo integral, estimar paredes
  if (type.toLowerCase() === "integral") {
    const wallArea = Math.ceil(area * 0.6);
    const wallTotal = Math.ceil(wallArea * (1 + wastePercent));
    materials.push({
      name: `${matName} Pared ${formatLabel}`,
      quantity: `${wallTotal} m²`,
      note: "Paredes estimadas (+10% desperdicio)",
      icon: "🧱",
      price: pricePerM2 * wallTotal,
    });
  }

  return materials;
}
