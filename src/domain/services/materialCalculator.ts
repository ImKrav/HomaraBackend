// ============================================
// Homara — Domain Service: Material Calculator (TS)
// ============================================

interface CalculatorParams {
  type: string;
  area: number;
  materialType?: string;
  tileFormat?: string;
  
  // Nuevos parámetros de personalización
  wastePercent?: number;
  layingPattern?: string;
  deductDoors?: number;
  deductWindows?: number;
  customSubtractions?: number;
  includeAdhesive?: boolean;
  includeGrout?: boolean;
  includeSpacers?: boolean;
  includeTools?: boolean;
  selectedProduct?: {
    id: string;
    name: string;
    price: number;
    unit: string;
  };
}

interface CalculatedMaterial {
  name: string;
  quantity: string;
  note: string | null;
  icon: string;
  price: number;
  productId?: string | null;
}

const PRICES = {
  pegante: 28500,     // por bulto de 25kg
  boquilla: 12000,    // por kg
  crucetas: 8500,     // por bolsa de 100u
  nivel: 35000,       // unidad
  cinta: 15000,       // rollo
  primer: 45000,      // galón
  pintura: 125000,    // galón (precio base)
  rodillo: 34500,     // unidad
  brocha: 12000,      // unidad
  enmascarar: 9500,   // rollo
  llana: 18500,       // llana metálica para cerámica
  mazo: 14500,        // mazo de goma
};

const COVERAGE = {
  pegante: 4,         // m² por bulto
  boquilla: 8,        // m² por kg
  crucetas: 15,       // m² por bolsa
  pintura: 30,        // m² por galón con 2 manos
};

const TILE_PRICES: Record<string, Record<string, number>> = {
  ceramica: {
    "60x60": 38900,
    "45x45": 32000,
    "30x60": 35500,
    "20x60": 34000,
    "80x80": 42000,
    "100x100": 48000,
    "15x90": 36000,
    "30x30": 29000,
    "10x20": 31000,
  },
  porcelanato: {
    "60x60": 45900,
    "45x45": 39000,
    "30x60": 42000,
    "20x60": 41000,
    "80x80": 54000,
    "100x100": 65000,
    "15x90": 45000,
    "30x30": 36000,
    "10x20": 38000,
  },
  madera: {
    "60x60": 52000,
    "45x45": 48000,
    "30x60": 50000,
    "20x60": 49000,
    "80x80": 58000,
    "100x100": 68000,
    "15x90": 51000,
    "30x30": 42000,
    "10x20": 44000,
  },
  vinilo: {
    "60x60": 28000,
    "45x45": 25000,
    "30x60": 27000,
    "20x60": 26000,
    "80x80": 32000,
    "100x100": 38000,
    "15x90": 28000,
    "30x30": 22000,
    "10x20": 24000,
  },
};

const MATERIAL_NAMES: Record<string, string> = {
  ceramica: "Cerámica",
  porcelanato: "Porcelanato",
  madera: "Madera laminada",
  vinilo: "Vinilo",
  pintura: "Pintura Premium",
};

const FORMAT_LABELS: Record<string, string> = {
  "60x60": "60x60 cm",
  "45x45": "45x45 cm",
  "30x60": "30x60 cm",
  "20x60": "20x60 cm",
  "80x80": "80x80 cm",
  "100x100": "100x100 cm",
  "15x90": "15x90 cm",
  "30x30": "30x30 cm",
  "10x20": "10x20 cm",
};

export function calculateMaterials({
  type,
  area,
  materialType = "ceramica",
  tileFormat = "60x60",
  wastePercent,
  layingPattern = "directo",
  deductDoors = 0,
  deductWindows = 0,
  customSubtractions = 0,
  includeAdhesive = true,
  includeGrout = true,
  includeSpacers = true,
  includeTools = true,
  selectedProduct,
}: CalculatorParams): CalculatedMaterial[] {
  const materials: CalculatedMaterial[] = [];

  // 1. Cálculo del Área Neta considerando deducciones
  const doorsDeduction = deductDoors * 2.0; // 2 m² por puerta
  const windowsDeduction = deductWindows * 1.5; // 1.5 m² por ventana
  const totalDeductions = doorsDeduction + windowsDeduction + customSubtractions;
  
  // El área neta no puede ser menor a 0.1 m²
  const netArea = Math.max(0.1, area - totalDeductions);

  // 2. Cálculo de Desperdicio según selección o patrón
  let actualWastePercent = wastePercent;
  if (actualWastePercent === undefined || actualWastePercent === null) {
    if (materialType === "pintura") {
      actualWastePercent = 5; // pintura usualmente tiene 5% desperdicio
    } else {
      switch (layingPattern) {
        case "diagonal":
          actualWastePercent = 15;
          break;
        case "trabadura":
          actualWastePercent = 12;
          break;
        case "directo":
        default:
          actualWastePercent = 10;
          break;
      }
    }
  }

  const wasteMultiplier = 1 + (actualWastePercent / 100);
  const totalArea = Math.ceil(netArea * wasteMultiplier);

  // 3. Inclusión del material de revestimiento principal
  if (selectedProduct) {
    // Si el usuario eligió un producto real del catálogo, calculamos con base en él
    const qtyUnit = selectedProduct.unit || "m²";
    const isPaintProduct = qtyUnit === "galón" || qtyUnit === "galones" || materialType === "pintura";

    if (isPaintProduct) {
      // Un galón rinde aproximadamente 30 m² con 2 manos (incluyendo desperdicio)
      const galones = Math.ceil(totalArea / 30);
      materials.push({
        name: selectedProduct.name,
        quantity: `${galones} ${qtyUnit}`,
        note: `Cálculo exacto: 1 galón por cada 30m² (Incluye +${actualWastePercent}% de desperdicio)`,
        icon: "🎨",
        price: selectedProduct.price * galones,
        productId: selectedProduct.id,
      });
    } else {
      // Para recubrimientos sólidos en m²
      materials.push({
        name: selectedProduct.name,
        quantity: `${totalArea} ${qtyUnit}`,
        note: `Cálculo exacto con +${actualWastePercent}% de desperdicio`,
        icon: "🏗️",
        price: selectedProduct.price * totalArea,
        productId: selectedProduct.id,
      });
    }
  } else if (materialType === "pintura") {
    // Si eligió pintura genérica, calculamos con base en el rendimiento de un galón
    const galones = Math.ceil(totalArea / COVERAGE.pintura);
    materials.push({
      name: "Pintura Premium de Interior/Exterior",
      quantity: `${galones} galón(es)`,
      note: `Rendimiento aproximado de 30m² c/u con 2 manos (Incluye +${actualWastePercent}% desperdicio)`,
      icon: "🎨",
      price: PRICES.pintura * galones,
      productId: null,
    });
  } else {
    // Cálculo genérico de baldosas/madera/vinilo si no hay producto específico
    const matName = MATERIAL_NAMES[materialType] || "Cerámica";
    const formatLabel = FORMAT_LABELS[tileFormat] || tileFormat;
    const pricePerM2 = TILE_PRICES[materialType]?.[tileFormat] || TILE_PRICES.ceramica["60x60"];

    materials.push({
      name: `${matName} ${formatLabel}`,
      quantity: `${totalArea} m²`,
      note: `+${actualWastePercent}% de desperdicio por colocación`,
      icon: "🏗️",
      price: pricePerM2 * totalArea,
      productId: null,
    });
  }

  // 4. Insumos para baldosas (cerámica y porcelanato)
  const isTile = materialType === "ceramica" || materialType === "porcelanato";
  
  if (isTile && !selectedProduct || (selectedProduct && (selectedProduct.name.toLowerCase().includes("ceramica") || selectedProduct.name.toLowerCase().includes("porcelanato") || selectedProduct.name.toLowerCase().includes("baldosa")))) {
    // Pegante
    if (includeAdhesive) {
      const bultos = Math.ceil(netArea / COVERAGE.pegante);
      materials.push({
        name: "Pegante cerámico flexible 25kg",
        quantity: `${bultos} bultos`,
        note: "25kg c/u (Rendimiento: 4m²/bulto)",
        icon: "🧱",
        price: PRICES.pegante * bultos,
        productId: null,
      });
    }

    // Boquilla
    if (includeGrout) {
      const kgBoquilla = Math.ceil(netArea / COVERAGE.boquilla);
      materials.push({
        name: "Boquilla",
        quantity: `${kgBoquilla} kg`,
        note: "Rendimiento: 8m²/kg",
        icon: "🪣",
        price: PRICES.boquilla * kgBoquilla,
        productId: null,
      });
    }

    // Crucetas
    if (includeSpacers) {
      const bolsasCrucetas = Math.ceil(netArea / COVERAGE.crucetas);
      materials.push({
        name: "Crucetas 2mm",
        quantity: `${bolsasCrucetas} bolsas`,
        note: "100 unidades c/u (Rendimiento: 15m²/bolsa)",
        icon: "➕",
        price: PRICES.crucetas * bolsasCrucetas,
        productId: null,
      });
    }
  }

  // Insumos para Madera laminada
  if (materialType === "madera" || (selectedProduct && selectedProduct.name.toLowerCase().includes("madera"))) {
    if (includeAdhesive) { // Reutilizamos adhesive como el aislante subsuelo (underlayment)
      const rollos = Math.ceil(netArea / 20);
      materials.push({
        name: "Cinta underlayment",
        quantity: `${rollos} rollos`,
        note: "20m² c/u (Aislamiento acústico y de humedad)",
        icon: "📏",
        price: PRICES.cinta * rollos,
        productId: null,
      });
    }
  }

  // Insumos para Vinilo
  if (materialType === "vinilo" || (selectedProduct && selectedProduct.name.toLowerCase().includes("vinilo"))) {
    if (includeAdhesive) { // Reutilizamos adhesive como el primer adhesivo de vinilo
      const galones = Math.ceil(netArea / 15);
      materials.push({
        name: "Primer para vinilo",
        quantity: `${galones} galones`,
        note: "15m² c/u (Adherencia óptima)",
        icon: "🪣",
        price: PRICES.primer * galones,
        productId: null,
      });
    }
  }

  // 5. Inclusión de Herramientas y Kits Profesionales
  if (includeTools) {
    if (materialType === "pintura" || (selectedProduct && selectedProduct.unit === "galón")) {
      // Insumos de pintura
      materials.push({
        name: "Kit Rodillo Antigoteo Profesional 23cm",
        quantity: "1 unidad",
        note: "Incluye bandeja y felpa de microfibra",
        icon: "🖌️",
        price: PRICES.rodillo,
        productId: null,
      });
      materials.push({
        name: "Brocha de cerda fina 2.5\"",
        quantity: "1 unidad",
        note: "Para retoques y esquinas",
        icon: "🖌️",
        price: PRICES.brocha,
        productId: null,
      });
      materials.push({
        name: "Cinta de enmascarar premium 1\"",
        quantity: "2 rollos",
        note: "Para protección de bordes y zócalos",
        icon: "📏",
        price: PRICES.enmascarar * 2,
        productId: null,
      });
    } else {
      // Insumos para instalación física de baldosas/revestimiento
      materials.push({
        name: "Nivel de burbuja profesional 60cm",
        quantity: "1 unidad",
        note: "Para alineación exacta de la superficie",
        icon: "📏",
        price: PRICES.nivel,
        productId: null,
      });
      
      if (isTile) {
        materials.push({
          name: "Llana metálica dentada 10x10mm",
          quantity: "1 unidad",
          note: "Para distribución correcta del pegante",
          icon: "🛠️",
          price: PRICES.llana,
          productId: null,
        });
        materials.push({
          name: "Mazo de goma blanco anti-marca",
          quantity: "1 unidad",
          note: "Para asentamiento de baldosas sin fracturas",
          icon: "🔨",
          price: PRICES.mazo,
          productId: null,
        });
      }
    }
  }

  // Estimación de paredes si es de tipo integral y no es pintura pura
  if (type.toLowerCase() === "integral" && materialType !== "pintura") {
    const wallArea = Math.ceil(netArea * 0.6);
    const wallTotal = Math.ceil(wallArea * wasteMultiplier);
    const matName = selectedProduct ? selectedProduct.name : (MATERIAL_NAMES[materialType] || "Cerámica");
    const formatLabel = selectedProduct ? "" : (FORMAT_LABELS[tileFormat] || tileFormat);
    const pricePerM2 = selectedProduct ? selectedProduct.price : (TILE_PRICES[materialType]?.[tileFormat] || TILE_PRICES.ceramica["60x60"]);

    materials.push({
      name: `${matName} Pared ${formatLabel}`.trim(),
      quantity: `${wallTotal} m²`,
      note: `Paredes estimadas (+${actualWastePercent}% desperdicio)`,
      icon: "🧱",
      price: pricePerM2 * wallTotal,
      productId: selectedProduct ? selectedProduct.id : null,
    });
  }

  return materials;
}
