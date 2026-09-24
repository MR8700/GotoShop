/**
 * salesEngine.js
 * Central Polymorphic Sales, Quantities, Units, Measurements and Pricing Engine for GotoShop.
 * 
 * Guarantees that "quantity = 1" is NEVER assumed to be universal.
 * Supports:
 * - Pagnes (0.5, 1, 1.5, 2, 2.5...)
 * - Fabrics by the meter (0.5m, 1m, 2.35m...)
 * - Weight (0.25kg, 1kg, 2.5kg...)
 * - Volume (0.5L, 1L...)
 * - Pairs (shoes, sandals)
 * - Time & Services (1h, 2h, sessions)
 * - Packs & Cartons
 * - Custom measurements (curtains, tailored clothes)
 */

export const MEASUREMENT_TYPES = {
  COUNT: "COUNT",
  LENGTH: "LENGTH",
  WEIGHT: "WEIGHT",
  VOLUME: "VOLUME",
  TIME: "TIME",
  AREA: "AREA",
  CUSTOM: "CUSTOM",
};

export const PRICING_MODELS = {
  FIXED_PER_UNIT: "FIXED_PER_UNIT",
  PER_MEASUREMENT: "PER_MEASUREMENT",
  TIERED: "TIERED",
  PACK: "PACK",
  CUSTOM_QUOTE: "CUSTOM_QUOTE",
};

export const STANDARD_SALES_PRESETS = [
  {
    id: "PIECE",
    label: "À la pièce (Téléphone, vêtement, objet)",
    unit: "PIECE",
    unit_label: "pièce",
    measurement_type: "COUNT",
    pricing_model: "FIXED_PER_UNIT",
    min_quantity: 1,
    quantity_step: 1,
    quantity_precision: 0,
    quick_chips: [1, 2, 3, 5, 10],
  },
  {
    id: "PAGNE_DEMI",
    label: "Au pagne (Demi-pagne 0,5 autorisé)",
    unit: "PAGNE",
    unit_label: "pagne",
    measurement_type: "COUNT",
    pricing_model: "FIXED_PER_UNIT",
    min_quantity: 0.5,
    quantity_step: 0.5,
    quantity_precision: 1,
    quick_chips: [0.5, 1, 1.5, 2, 2.5, 3, 4],
  },
  {
    id: "PAGNE_ENTIER",
    label: "Au pagne entier (Pas de 1 pagne)",
    unit: "PAGNE",
    unit_label: "pagne",
    measurement_type: "COUNT",
    pricing_model: "FIXED_PER_UNIT",
    min_quantity: 1,
    quantity_step: 1,
    quantity_precision: 0,
    quick_chips: [1, 2, 3, 4, 5, 6],
  },
  {
    id: "TISSU_METRE",
    label: "Au mètre (Tissu, coupe linéaire - pas 0,5 m)",
    unit: "METER",
    unit_label: "m",
    measurement_type: "LENGTH",
    pricing_model: "FIXED_PER_UNIT",
    min_quantity: 0.5,
    quantity_step: 0.5,
    quantity_precision: 2,
    quick_chips: [1, 2, 2.5, 3, 4, 5, 6],
  },
  {
    id: "TISSU_METRE_LIBRE",
    label: "Au centimètre / mesure exacte (pas 0,01 m)",
    unit: "METER",
    unit_label: "m",
    measurement_type: "LENGTH",
    pricing_model: "FIXED_PER_UNIT",
    min_quantity: 0.25,
    quantity_step: 0.01,
    quantity_precision: 2,
    quick_chips: [1, 1.5, 2, 2.5, 3, 3.5, 4],
  },
  {
    id: "CHAUSSURE_PAIRE",
    label: "À la paire (Chaussures, sandales, boucles)",
    unit: "PAIR",
    unit_label: "paire",
    measurement_type: "COUNT",
    pricing_model: "FIXED_PER_UNIT",
    min_quantity: 1,
    quantity_step: 1,
    quantity_precision: 0,
    quick_chips: [1, 2, 3, 4],
  },
  {
    id: "POIDS_KG",
    label: "Au poids (Kilogramme - pas 0,25 kg)",
    unit: "KILOGRAM",
    unit_label: "kg",
    measurement_type: "WEIGHT",
    pricing_model: "FIXED_PER_UNIT",
    min_quantity: 0.25,
    quantity_step: 0.25,
    quantity_precision: 2,
    quick_chips: [0.5, 1, 1.5, 2, 2.5, 5],
  },
  {
    id: "VOLUME_LITRE",
    label: "Au volume (Litre - pas 0,5 L)",
    unit: "LITER",
    unit_label: "L",
    measurement_type: "VOLUME",
    pricing_model: "FIXED_PER_UNIT",
    min_quantity: 0.5,
    quantity_step: 0.5,
    quantity_precision: 1,
    quick_chips: [0.5, 1, 1.5, 2, 3, 5],
  },
  {
    id: "SERVICE_HEURE",
    label: "À l'heure (Prestation, retouche, consultation)",
    unit: "HOUR",
    unit_label: "h",
    measurement_type: "TIME",
    pricing_model: "FIXED_PER_UNIT",
    min_quantity: 1,
    quantity_step: 1,
    quantity_precision: 0,
    quick_chips: [1, 2, 3, 4, 8],
  },
  {
    id: "SERVICE_SEANCE",
    label: "À la séance / forfait",
    unit: "SESSION",
    unit_label: "séance",
    measurement_type: "COUNT",
    pricing_model: "FIXED_PER_UNIT",
    min_quantity: 1,
    quantity_step: 1,
    quantity_precision: 0,
    quick_chips: [1, 2, 3, 5],
  },
  {
    id: "CARTON_GROS",
    label: "Au carton / Vente en gros",
    unit: "CARTON",
    unit_label: "carton",
    measurement_type: "COUNT",
    pricing_model: "FIXED_PER_UNIT",
    min_quantity: 1,
    quantity_step: 1,
    quantity_precision: 0,
    quick_chips: [1, 2, 5, 10, 20],
  },
  {
    id: "SUR_MESURE",
    label: "Sur mesure / Devis personnalisé",
    unit: "CUSTOM",
    unit_label: "confection",
    measurement_type: "CUSTOM",
    pricing_model: "CUSTOM_QUOTE",
    min_quantity: 1,
    quantity_step: 1,
    quantity_precision: 0,
    allow_custom_measurements: true,
    quick_chips: [1],
  },
];

/**
 * Format quantity into human-readable string with localized unit label.
 * E.g.
 * - (2.5, "pagne") -> "2,5 pagnes"
 * - (1, "pagne") -> "1 pagne"
 * - (0.5, "pagne") -> "0,5 pagne"
 * - (3.5, "m") -> "3,50 m"
 * - (2, "paire") -> "2 paires"
 * - (2, "h") -> "2 heures"
 */
export function formatSalesQuantity(quantity, unitLabel, precision = null) {
  const q = Number(quantity);
  if (isNaN(q)) return `${quantity}`;

  let qFormatted = "";
  if (precision !== null && precision !== undefined) {
    qFormatted = q.toFixed(precision).replace(".", ",");
    // strip unnecessary trailing zeros if decimal e.g. 3,50 -> 3,5
    if (precision > 0 && qFormatted.endsWith("0")) {
      qFormatted = qFormatted.replace(/0+$/, "").replace(/,$/, "");
    }
  } else if (Number.isInteger(q)) {
    qFormatted = `${q}`;
  } else {
    qFormatted = `${q}`.replace(".", ",");
  }

  const label = (unitLabel || "").trim().toLowerCase();
  if (!label || label === "pièce" || label === "pcs") {
    return q > 1 ? `${qFormatted} pièces` : `${qFormatted} pièce`;
  }

  // Handle specific abbreviations and units
  if (label === "m") return `${qFormatted} m`;
  if (label === "cm") return `${qFormatted} cm`;
  if (label === "kg") return `${qFormatted} kg`;
  if (label === "g") return `${qFormatted} g`;
  if (label === "l") return `${qFormatted} L`;
  if (label === "ml") return `${qFormatted} ml`;
  if (label === "h") return q > 1 ? `${qFormatted} heures` : `${qFormatted} heure`;
  if (label === "j") return q > 1 ? `${qFormatted} jours` : `${qFormatted} jour`;

  // Pluralization for words (pagne -> pagnes, paire -> paires, carton -> cartons)
  if (q > 1 && !label.endsWith("s") && !label.endsWith("x")) {
    return `${qFormatted} ${label}s`;
  }
  return `${qFormatted} ${label}`;
}

/**
 * Format unit price tag.
 * E.g.
 * - (15000, "pagne") -> "15 000 FCFA / pagne"
 * - (3500, "m") -> "3 500 FCFA / m"
 * - (5000, "h") -> "5 000 FCFA / heure"
 */
export function formatSalesUnitPrice(price, unitLabel, currency = "FCFA") {
  if (!price && price !== 0) return "";
  const pFormatted = Number(price).toLocaleString("fr-FR");
  const label = (unitLabel || "").trim().toLowerCase();

  let suffix = "";
  if (!label || label === "pièce" || label === "pcs") {
    suffix = "";
  } else if (label === "h") {
    suffix = "/ heure";
  } else if (label === "m") {
    suffix = "/ mètre";
  } else if (label === "kg") {
    suffix = "/ kg";
  } else if (label === "l") {
    suffix = "/ L";
  } else {
    suffix = `/ ${label}`;
  }

  return `${pFormatted} ${currency} ${suffix}`.trim();
}

/**
 * Extract sales configuration parameters from a product object with safe defaults.
 */
export function getProductSalesConfig(product) {
  if (!product) {
    return {
      unit: "PIECE",
      unitLabel: "pièce",
      measurementType: "COUNT",
      pricingModel: "FIXED_PER_UNIT",
      minQuantity: 1,
      maxQuantity: 9999,
      quantityStep: 1,
      precision: 0,
      allowCustomMeasurements: false,
      quickChips: [1, 2, 3, 5, 10],
    };
  }

  const unit = product.sales_unit || "PIECE";
  const unitLabel = product.sales_unit_label || (unit === "PAGNE" ? "pagne" : unit === "METER" ? "m" : "pièce");
  const measurementType = product.measurement_type || "COUNT";
  const pricingModel = product.pricing_model || "FIXED_PER_UNIT";
  const minQuantity = product.min_quantity !== undefined && product.min_quantity !== null ? Number(product.min_quantity) : 1;
  const maxQuantity = product.max_quantity ? Number(product.max_quantity) : 9999;
  const quantityStep = product.quantity_step ? Number(product.quantity_step) : 1;
  const precision = product.quantity_precision !== undefined && product.quantity_precision !== null
    ? Number(product.quantity_precision)
    : (quantityStep % 1 !== 0 ? 1 : 0);
  const allowCustomMeasurements = Boolean(product.allow_custom_measurements);

  // Generate quick pills / chips based on step & min
  let quickChips = [];
  if (quantityStep === 0.5) {
    quickChips = [0.5, 1, 1.5, 2, 2.5, 3, 4];
  } else if (quantityStep === 0.25) {
    quickChips = [0.25, 0.5, 0.75, 1, 1.5, 2];
  } else if (quantityStep === 0.01) {
    quickChips = [1, 1.5, 2, 2.5, 3, 3.5, 4];
  } else if (quantityStep === 1) {
    quickChips = [1, 2, 3, 4, 5, 10];
  } else {
    quickChips = [minQuantity, minQuantity + quantityStep, minQuantity + quantityStep * 2];
  }

  return {
    unit,
    unitLabel,
    measurementType,
    pricingModel,
    minQuantity,
    maxQuantity,
    quantityStep,
    precision,
    allowCustomMeasurements,
    quickChips,
  };
}

/**
 * Validate given quantity against product rules.
 */
export function validateSalesQuantity(quantity, config) {
  const q = Number(quantity);
  if (isNaN(q) || q <= 0) {
    return { valid: false, message: "Veuillez renseigner une quantité valide." };
  }
  if (config.minQuantity && q < config.minQuantity) {
    return {
      valid: false,
      message: `La quantité minimale est de ${formatSalesQuantity(config.minQuantity, config.unitLabel)}.`,
    };
  }
  if (config.maxQuantity && q > config.maxQuantity) {
    return {
      valid: false,
      message: `La quantité maximale est de ${formatSalesQuantity(config.maxQuantity, config.unitLabel)}.`,
    };
  }
  const quotient = q / config.quantityStep;
  if (Math.abs(quotient - Math.round(quotient)) > 0.001) {
    return {
      valid: false,
      message: `La quantité doit être un multiple de ${config.quantityStep} ${config.unitLabel}.`,
    };
  }
  return { valid: true };
}
