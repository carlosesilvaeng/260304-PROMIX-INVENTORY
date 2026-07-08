export type AdditiveMeasurementMethod =
  | 'MANUAL'
  | 'CURVE'
  | 'CYLINDER_VERTICAL'
  | 'RECTANGULAR_IBC';

export interface AdditiveMeasurementConfig {
  method: string;
  conversion_table?: Record<string, number> | null;
  diameter?: number | null;
  length?: number | null;
  width?: number | null;
  total_height?: number | null;
  capacity?: number | null;
  dimension_factor_to_base?: number | null;
  calculation_volume_factor_to_base?: number | null;
  capacity_volume_factor_to_base?: number | null;
}

export interface AdditiveMeasurementInput {
  reading?: number | null;
  quantity?: number | null;
}

export interface AdditiveMeasurementResult {
  method: AdditiveMeasurementMethod;
  calculated_volume: number;
  inventory_percentage: number | null;
  uncapped_volume: number;
}

export function normalizeAdditiveMeasurementMethod(method: unknown): AdditiveMeasurementMethod {
  const normalized = String(method || '').trim().toUpperCase();
  if (['TANK', 'TANK_LEVEL', 'CALIBRATION_CURVE', 'CURVE'].includes(normalized)) return 'CURVE';
  if (['MANUAL', 'MANUAL_QUANTITY'].includes(normalized)) return 'MANUAL';
  if (normalized === 'CYLINDER_VERTICAL') return 'CYLINDER_VERTICAL';
  if (normalized === 'RECTANGULAR_IBC') return 'RECTANGULAR_IBC';
  throw new Error(`Método de medición de aditivo no soportado: ${method || '(vacío)'}.`);
}

function finite(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} debe ser un número válido.`);
  return parsed;
}

function positive(value: unknown, label: string) {
  const parsed = finite(value, label);
  if (parsed <= 0) throw new Error(`${label} debe ser mayor que cero.`);
  return parsed;
}

export function interpolateAdditiveCurve(
  reading: number,
  conversionTable: Record<string, number> | null | undefined,
) {
  const points = Object.entries(conversionTable || {})
    .map(([key, value]) => ({ input: Number(key), output: Number(value) }))
    .filter((point) => Number.isFinite(point.input) && Number.isFinite(point.output))
    .sort((left, right) => left.input - right.input);

  if (points.length === 0) throw new Error('La curva de calibración no tiene puntos válidos.');
  if (reading <= points[0].input) return points[0].output;
  if (reading >= points[points.length - 1].input) return points[points.length - 1].output;

  for (let index = 0; index < points.length - 1; index += 1) {
    const lower = points[index];
    const upper = points[index + 1];
    if (reading === lower.input) return lower.output;
    if (reading >= lower.input && reading <= upper.input) {
      const ratio = (reading - lower.input) / (upper.input - lower.input);
      return lower.output + (upper.output - lower.output) * ratio;
    }
  }

  return points[points.length - 1].output;
}

function calculateGeometricVolume(
  method: 'CYLINDER_VERTICAL' | 'RECTANGULAR_IBC',
  config: AdditiveMeasurementConfig,
  reading: number,
) {
  const totalHeight = positive(config.total_height, 'La altura total');
  if (reading < 0) throw new Error('La altura del líquido no puede ser negativa.');
  if (reading > totalHeight) {
    throw new Error(`La altura del líquido no puede exceder la altura total (${totalHeight}).`);
  }

  const dimensionFactor = positive(config.dimension_factor_to_base, 'El factor de la unidad dimensional');
  const calculationFactor = positive(
    config.calculation_volume_factor_to_base,
    'El factor de la unidad de cálculo',
  );
  const capacityFactor = positive(
    config.capacity_volume_factor_to_base,
    'El factor de la unidad de capacidad',
  );
  const capacity = positive(config.capacity, 'La capacidad nominal');

  const liquidHeightBase = reading * dimensionFactor;
  let baseVolume: number;
  if (method === 'CYLINDER_VERTICAL') {
    const radiusBase = positive(config.diameter, 'El diámetro') * dimensionFactor / 2;
    baseVolume = Math.PI * radiusBase ** 2 * liquidHeightBase;
  } else {
    const lengthBase = positive(config.length, 'El largo') * dimensionFactor;
    const widthBase = positive(config.width, 'El ancho') * dimensionFactor;
    baseVolume = lengthBase * widthBase * liquidHeightBase;
  }

  const uncappedVolume = baseVolume / calculationFactor;
  const capacityInCalculationUnit = capacity * capacityFactor / calculationFactor;
  const calculatedVolume = Math.min(uncappedVolume, capacityInCalculationUnit);
  const percentage = capacityInCalculationUnit > 0
    ? Math.min(100, Math.max(0, calculatedVolume / capacityInCalculationUnit * 100))
    : 0;

  return { calculatedVolume, uncappedVolume, percentage };
}

export function calculateAdditiveMeasurement(
  config: AdditiveMeasurementConfig,
  input: AdditiveMeasurementInput,
): AdditiveMeasurementResult {
  const method = normalizeAdditiveMeasurementMethod(config.method);
  if (method === 'MANUAL') {
    const quantity = finite(input.quantity, 'La cantidad');
    if (quantity < 0) throw new Error('La cantidad no puede ser negativa.');
    return {
      method,
      calculated_volume: quantity,
      inventory_percentage: null,
      uncapped_volume: quantity,
    };
  }

  const reading = finite(input.reading, method === 'CURVE' ? 'La lectura' : 'La altura del líquido');
  if (reading < 0) throw new Error('La lectura no puede ser negativa.');

  if (method === 'CURVE') {
    const volume = interpolateAdditiveCurve(reading, config.conversion_table);
    return {
      method,
      calculated_volume: volume,
      inventory_percentage: null,
      uncapped_volume: volume,
    };
  }

  const geometry = calculateGeometricVolume(method, config, reading);
  return {
    method,
    calculated_volume: geometry.calculatedVolume,
    inventory_percentage: geometry.percentage,
    uncapped_volume: geometry.uncappedVolume,
  };
}

export function roundAdditiveMeasurement(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
