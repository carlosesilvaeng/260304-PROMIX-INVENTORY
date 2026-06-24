export interface UnitDefinition {
  id: string;
  category_id: string;
  code: string;
  name_es?: string;
  name_en?: string;
  symbol: string;
  measurement_system?: string;
  factor_to_base: number | string;
  decimal_precision?: number;
  active?: boolean;
}

export interface MaterialConversionFactor {
  id: string;
  material_id?: string | null;
  plant_id?: string | null;
  from_unit_id: string;
  to_unit_id: string;
  factor: number | string;
  active?: boolean;
}

export interface CalibrationPoint {
  input_value?: number;
  output_value?: number;
  point_key?: number;
  point_value?: number;
}

export interface CalibrationCurveLike {
  id?: string;
  input_unit_id?: string | null;
  output_unit_id?: string | null;
  method?: 'table_interpolation' | 'linear' | 'polynomial' | string;
  points?: CalibrationPoint[];
  data_points?: Record<string, number>;
}

export interface MeasurementConfig {
  id: string;
  plant_id?: string | null;
  section_code?: string | null;
  inventory_type_id?: string | null;
  material_id?: string | null;
  equipment_id?: string | null;
  capture_unit_id: string;
  calculation_unit_id: string;
  display_unit_id: string;
  inventory_unit_id: string;
  material_conversion_factor_id?: string | null;
  calibration_curve_id?: string | null;
  active?: boolean;
}

export interface ResolveMeasurementConfigInput {
  plantId?: string | null;
  sectionCode?: string | null;
  inventoryTypeId?: string | null;
  materialId?: string | null;
  equipmentId?: string | null;
}

export interface EffectiveMeasurementConfig {
  config: MeasurementConfig | null;
  captureUnitId: string;
  calculationUnitId: string;
  displayUnitId: string;
  inventoryUnitId: string;
  captureLabel: string;
  calculationLabel: string;
  displayLabel: string;
  inventoryLabel: string;
  ruleLabel: string;
  ruleDetail: string;
  source: 'contextual' | 'legacy';
}

export interface ResolveEffectiveMeasurementConfigInput extends ResolveMeasurementConfigInput {
  units: UnitDefinition[];
  configs: MeasurementConfig[];
  fallbackCaptureUnitId?: string | null;
  fallbackCalculationUnitId?: string | null;
  fallbackDisplayUnitId?: string | null;
  fallbackInventoryUnitId?: string | null;
  fallbackRuleLabel?: string;
  fallbackRuleDetail?: string;
}

function asNumber(value: number | string | null | undefined, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function buildUnitMap(units: UnitDefinition[]) {
  return new Map(units.map((unit) => [unit.id, unit]));
}

export function validateCompatibleUnits(
  units: UnitDefinition[],
  fromUnitId: string,
  toUnitId: string,
) {
  const unitMap = buildUnitMap(units);
  const fromUnit = unitMap.get(fromUnitId);
  const toUnit = unitMap.get(toUnitId);

  if (!fromUnit) throw new Error(`Unidad origen no encontrada: ${fromUnitId}`);
  if (!toUnit) throw new Error(`Unidad destino no encontrada: ${toUnitId}`);
  if (fromUnit.category_id !== toUnit.category_id) {
    throw new Error(`No se puede convertir ${fromUnit.code} a ${toUnit.code}: categorias incompatibles.`);
  }

  return { fromUnit, toUnit };
}

export function convertUnit(
  value: number,
  fromUnitId: string,
  toUnitId: string,
  units: UnitDefinition[],
) {
  const { fromUnit, toUnit } = validateCompatibleUnits(units, fromUnitId, toUnitId);
  const baseValue = asNumber(value) * asNumber(fromUnit.factor_to_base, 1);
  return baseValue / asNumber(toUnit.factor_to_base, 1);
}

export function convertWithMaterialFactor(
  value: number,
  fromUnitId: string,
  toUnitId: string,
  factor: MaterialConversionFactor | null | undefined,
) {
  if (!factor || factor.active === false) {
    throw new Error('Se requiere un factor activo de material para convertir entre estas unidades.');
  }

  const requestedForward = factor.from_unit_id === fromUnitId && factor.to_unit_id === toUnitId;
  const requestedReverse = factor.from_unit_id === toUnitId && factor.to_unit_id === fromUnitId;
  const numericFactor = asNumber(factor.factor);

  if (!numericFactor || (!requestedForward && !requestedReverse)) {
    throw new Error('El factor de material no corresponde a las unidades solicitadas.');
  }

  return requestedForward ? asNumber(value) * numericFactor : asNumber(value) / numericFactor;
}

function normalizeCurvePoints(curve: CalibrationCurveLike | null | undefined) {
  const points = new Map<number, number>();

  Object.entries(curve?.data_points || {}).forEach(([inputKey, rawOutput]) => {
    const input = Number(inputKey);
    const output = Number(rawOutput);
    if (Number.isFinite(input) && Number.isFinite(output)) points.set(input, output);
  });

  (curve?.points || []).forEach((point) => {
    const input = Number(point.input_value ?? point.point_key);
    const output = Number(point.output_value ?? point.point_value);
    if (Number.isFinite(input) && Number.isFinite(output)) points.set(input, output);
  });

  return Array.from(points.entries())
    .map(([input, output]) => ({ input, output }))
    .sort((left, right) => left.input - right.input);
}

export function convertWithCalibrationCurve(
  value: number,
  fromUnitId: string,
  toUnitId: string,
  curve: CalibrationCurveLike | null | undefined,
) {
  if (!curve) throw new Error('Se requiere una curva de calibracion para esta conversion.');
  if (curve.input_unit_id && curve.input_unit_id !== fromUnitId) {
    throw new Error('La unidad de entrada no coincide con la curva de calibracion.');
  }
  if (curve.output_unit_id && curve.output_unit_id !== toUnitId) {
    throw new Error('La unidad de salida no coincide con la curva de calibracion.');
  }

  const points = normalizeCurvePoints(curve);
  const inputValue = asNumber(value);
  if (points.length === 0) throw new Error('La curva de calibracion no tiene puntos validos.');

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  if (inputValue <= firstPoint.input) return firstPoint.output;
  if (inputValue >= lastPoint.input) return lastPoint.output;

  for (let index = 0; index < points.length - 1; index += 1) {
    const lowerPoint = points[index];
    const upperPoint = points[index + 1];
    if (inputValue === lowerPoint.input) return lowerPoint.output;
    if (inputValue >= lowerPoint.input && inputValue <= upperPoint.input) {
      const ratio = (inputValue - lowerPoint.input) / (upperPoint.input - lowerPoint.input);
      return lowerPoint.output + (upperPoint.output - lowerPoint.output) * ratio;
    }
  }

  return lastPoint.output;
}

function scoreConfig(config: MeasurementConfig, input: ResolveMeasurementConfigInput) {
  if (config.active === false) return -1;
  if (config.plant_id && config.plant_id !== input.plantId) return -1;
  if (config.section_code && config.section_code !== input.sectionCode) return -1;
  if (config.inventory_type_id && config.inventory_type_id !== input.inventoryTypeId) return -1;
  if (config.material_id && config.material_id !== input.materialId) return -1;
  if (config.equipment_id && config.equipment_id !== input.equipmentId) return -1;

  let score = 0;
  if (config.plant_id && input.plantId) score += 16;
  if (config.section_code && input.sectionCode) score += 8;
  if (config.material_id && input.materialId) score += 4;
  if (config.equipment_id && input.equipmentId) score += 4;
  if (config.inventory_type_id && input.inventoryTypeId) score += 2;
  return score;
}

export function resolveMeasurementConfig(
  configs: MeasurementConfig[],
  input: ResolveMeasurementConfigInput,
) {
  return (configs || [])
    .map((config) => ({ config, score: scoreConfig(config, input) }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score)[0]?.config || null;
}

export function getUnitSymbol(units: UnitDefinition[], unitId: string | null | undefined, fallback = '') {
  if (!unitId) return fallback;
  return units.find((unit) => unit.id === unitId)?.symbol || fallback || unitId;
}

export function getUnitDisplay(
  units: UnitDefinition[],
  unitId: string | null | undefined,
  fallback = '',
) {
  if (!unitId) return fallback;
  const unit = units.find((candidate) => candidate.id === unitId || candidate.code === unitId);
  return unit?.symbol || fallback || unitId;
}

export function findUnitBySymbolOrId(
  units: UnitDefinition[],
  unitIdOrSymbol: string | null | undefined,
) {
  if (!unitIdOrSymbol) return null;
  const normalized = unitIdOrSymbol.toLowerCase();
  return units.find((unit) => (
    unit.id.toLowerCase() === normalized ||
    unit.code.toLowerCase() === normalized ||
    unit.symbol.toLowerCase() === normalized
  )) || null;
}

export function describeEffectiveRule(
  units: UnitDefinition[],
  config: MeasurementConfig | null,
  fallbackRuleLabel = 'Configuracion legacy',
  fallbackRuleDetail = 'Usa la unidad guardada en la configuracion del modulo.',
) {
  if (!config) {
    return { ruleLabel: fallbackRuleLabel, ruleDetail: fallbackRuleDetail };
  }

  const captureUnit = findUnitBySymbolOrId(units, config.capture_unit_id);
  const calculationUnit = findUnitBySymbolOrId(units, config.calculation_unit_id);
  const inventoryUnit = findUnitBySymbolOrId(units, config.inventory_unit_id);
  const crossesCaptureCategory = captureUnit?.category_id && calculationUnit?.category_id && captureUnit.category_id !== calculationUnit.category_id;
  const crossesInventoryCategory = calculationUnit?.category_id && inventoryUnit?.category_id && calculationUnit.category_id !== inventoryUnit.category_id;

  if (config.calibration_curve_id || crossesCaptureCategory) {
    return {
      ruleLabel: config.calibration_curve_id ? 'Curva de calibracion' : 'Curva legacy',
      ruleDetail: 'La lectura se convierte con la tabla/curva configurada para el equipo.',
    };
  }

  if (config.material_conversion_factor_id || crossesInventoryCategory) {
    return {
      ruleLabel: config.material_conversion_factor_id ? 'Factor por material' : 'Factor requerido',
      ruleDetail: 'La unidad de inventario cruza categoria y requiere factor por material.',
    };
  }

  return {
    ruleLabel: 'Conversion estandar',
    ruleDetail: 'Las unidades pertenecen a la misma categoria fisica.',
  };
}

export function resolveEffectiveMeasurementConfig(input: ResolveEffectiveMeasurementConfigInput): EffectiveMeasurementConfig {
  const config = resolveMeasurementConfig(input.configs, input);
  const captureUnitId = config?.capture_unit_id || input.fallbackCaptureUnitId || '';
  const calculationUnitId = config?.calculation_unit_id || input.fallbackCalculationUnitId || captureUnitId;
  const displayUnitId = config?.display_unit_id || input.fallbackDisplayUnitId || calculationUnitId;
  const inventoryUnitId = config?.inventory_unit_id || input.fallbackInventoryUnitId || displayUnitId;
  const rule = describeEffectiveRule(
    input.units,
    config,
    input.fallbackRuleLabel,
    input.fallbackRuleDetail,
  );

  return {
    config,
    captureUnitId,
    calculationUnitId,
    displayUnitId,
    inventoryUnitId,
    captureLabel: getUnitDisplay(input.units, captureUnitId, input.fallbackCaptureUnitId || ''),
    calculationLabel: getUnitDisplay(input.units, calculationUnitId, input.fallbackCalculationUnitId || ''),
    displayLabel: getUnitDisplay(input.units, displayUnitId, input.fallbackDisplayUnitId || ''),
    inventoryLabel: getUnitDisplay(input.units, inventoryUnitId, input.fallbackInventoryUnitId || ''),
    ruleLabel: rule.ruleLabel,
    ruleDetail: rule.ruleDetail,
    source: config ? 'contextual' : 'legacy',
  };
}

export function convertForCaptureToCalculation(
  value: number,
  effectiveConfig: EffectiveMeasurementConfig,
  units: UnitDefinition[],
  curve?: CalibrationCurveLike | null,
) {
  if (effectiveConfig.captureUnitId === effectiveConfig.calculationUnitId) return value;
  try {
    return convertUnit(value, effectiveConfig.captureUnitId, effectiveConfig.calculationUnitId, units);
  } catch (standardError) {
    if (curve) return convertWithCalibrationCurve(value, effectiveConfig.captureUnitId, effectiveConfig.calculationUnitId, curve);
    throw standardError;
  }
}

export function convertForCalculationToDisplay(
  value: number,
  effectiveConfig: EffectiveMeasurementConfig,
  units: UnitDefinition[],
) {
  if (effectiveConfig.calculationUnitId === effectiveConfig.displayUnitId) return value;
  return convertUnit(value, effectiveConfig.calculationUnitId, effectiveConfig.displayUnitId, units);
}

export function convertForCalculationToInventory(
  value: number,
  effectiveConfig: EffectiveMeasurementConfig,
  units: UnitDefinition[],
  factor?: MaterialConversionFactor | null,
) {
  if (effectiveConfig.calculationUnitId === effectiveConfig.inventoryUnitId) return value;
  try {
    return convertUnit(value, effectiveConfig.calculationUnitId, effectiveConfig.inventoryUnitId, units);
  } catch (standardError) {
    if (factor) return convertWithMaterialFactor(value, effectiveConfig.calculationUnitId, effectiveConfig.inventoryUnitId, factor);
    throw standardError;
  }
}
