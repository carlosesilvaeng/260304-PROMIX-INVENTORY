export const DEFAULT_CEMENT_SACK_WEIGHT_LBS = 94;

export interface SiloMaterialConversionFactor {
  id: string;
  material_id?: string | null;
  plant_id?: string | null;
  from_unit_id: string;
  to_unit_id: string;
  factor: number | string;
  active?: boolean;
  material?: { id?: string; nombre?: string | null } | null;
}

export interface ResolveSiloFactorInput {
  factors: SiloMaterialConversionFactor[];
  plantId?: string | null;
  productName: string;
  explicitFactorId?: string | null;
  materialId?: string | null;
}

function normalizeProductName(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function resolveSiloProductFactor(input: ResolveSiloFactorInput) {
  const eligible = (input.factors || []).filter((factor) => (
    factor.active !== false &&
    factor.from_unit_id === 'ft3' &&
    factor.to_unit_id === 'lb' &&
    Number(factor.factor) > 0
  ));

  if (input.explicitFactorId) {
    return eligible.find((factor) => (
      factor.id === input.explicitFactorId &&
      (!factor.plant_id || factor.plant_id === input.plantId)
    )) || null;
  }

  const normalizedProduct = normalizeProductName(input.productName);
  const productMatches = eligible.filter((factor) => {
    if (input.materialId && factor.material_id === input.materialId) return true;
    return normalizeProductName(factor.material?.nombre) === normalizedProduct;
  });

  return productMatches.find((factor) => factor.plant_id === input.plantId) ||
    productMatches.find((factor) => !factor.plant_id) ||
    null;
}

export function calculateSiloInventoryPresentation(
  volumeFt3: number,
  factor: SiloMaterialConversionFactor,
  sackWeightLbs = DEFAULT_CEMENT_SACK_WEIGHT_LBS,
) {
  const normalizedVolume = Number(volumeFt3);
  const densityFactor = Number(factor?.factor);
  const normalizedSackWeight = Number(sackWeightLbs);

  if (!Number.isFinite(normalizedVolume) || normalizedVolume < 0) {
    throw new Error('El volumen técnico del silo no es válido.');
  }
  if (!Number.isFinite(densityFactor) || densityFactor <= 0) {
    throw new Error('El factor del producto debe ser mayor que cero.');
  }
  if (!Number.isFinite(normalizedSackWeight) || normalizedSackWeight <= 0) {
    throw new Error('El peso por saco debe ser mayor que cero.');
  }

  const pounds = normalizedVolume * densityFactor;
  return {
    volumeFt3: normalizedVolume,
    pounds,
    sacks: pounds / normalizedSackWeight,
    sackWeightLbs: normalizedSackWeight,
    densityLbsPerFt3: densityFactor,
  };
}
