export type SiloCalculationMethod = 'CALIBRATION_CURVE' | 'GEOMETRIC_CYLINDER_CONE';
export type CylinderHeightMode = 'FULL_H' | 'H_MINUS_24';
export type SlopeDivisorMode =
  | 'SLOPE_DIVISOR_H'
  | 'SLOPE_DIVISOR_H_MINUS_24'
  | 'SLOPE_DIVISOR_EFFECTIVE';
export type SiloReadingReference = 'FILLED_HEIGHT_INCHES' | 'EMPTY_HEIGHT_INCHES';

export interface SiloGeometryInput {
  diameter_in: number;
  total_height_in: number;
  cone_height_in: number;
  bottom_diameter_in: number;
  cylinder_height_mode: CylinderHeightMode;
  slope_divisor_mode: SlopeDivisorMode;
  reading_reference: SiloReadingReference;
  reading_in: number;
}

export interface SiloGeometryResult {
  cylinder_volume_ft3: number;
  cone_volume_ft3: number;
  total_volume_ft3: number;
  slope_ft3_per_in: number;
  slope_divisor_in: number;
  effective_cylinder_height_in: number;
  calculated_volume_ft3: number;
}

function finite(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} debe ser un número válido.`);
  return parsed;
}

export function calculateSiloGeometry(input: SiloGeometryInput): SiloGeometryResult {
  const diameter = finite(input.diameter_in, 'El diámetro superior');
  const height = finite(input.total_height_in, 'La altura total');
  const coneHeight = finite(input.cone_height_in, 'La altura del cono');
  const bottomDiameter = finite(input.bottom_diameter_in, 'El diámetro inferior');
  const reading = finite(input.reading_in, 'La lectura');

  if (diameter <= 0) throw new Error('El diámetro superior debe ser mayor que cero.');
  if (height <= 0) throw new Error('La altura total debe ser mayor que cero.');
  if (coneHeight < 0) throw new Error('La altura del cono no puede ser negativa.');
  if (bottomDiameter < 0) throw new Error('El diámetro inferior no puede ser negativo.');
  if (bottomDiameter > diameter) throw new Error('El diámetro inferior no puede exceder el diámetro superior.');
  if (reading < 0) throw new Error('La lectura no puede ser negativa.');

  const effectiveHeight = input.cylinder_height_mode === 'H_MINUS_24' ? height - 24 : height;
  if (effectiveHeight <= 0) {
    throw new Error('La altura debe ser mayor de 24 pulgadas cuando se usa H_MINUS_24.');
  }

  let divisor = effectiveHeight;
  if (input.slope_divisor_mode === 'SLOPE_DIVISOR_H') divisor = height;
  if (input.slope_divisor_mode === 'SLOPE_DIVISOR_H_MINUS_24') divisor = height - 24;
  if (divisor <= 0) {
    throw new Error('El divisor de pendiente debe ser mayor que cero.');
  }
  if (reading > divisor) {
    throw new Error(`La lectura no puede exceder ${divisor} pulgadas para esta configuración.`);
  }

  const radiusFt = diameter / 24;
  const bottomRadiusFt = bottomDiameter / 24;
  const cylinderVolume = Math.PI * radiusFt ** 2 * (effectiveHeight / 12);
  const coneVolume = Math.PI * (coneHeight / 12)
    * (radiusFt ** 2 + radiusFt * bottomRadiusFt + bottomRadiusFt ** 2) / 3;
  const totalVolume = cylinderVolume + coneVolume;
  const slope = cylinderVolume / divisor;
  const referencedVolume = coneVolume + slope * reading;
  const rawAvailable = input.reading_reference === 'EMPTY_HEIGHT_INCHES'
    ? totalVolume - referencedVolume
    : referencedVolume;
  const available = Math.max(0, Math.min(totalVolume, rawAvailable));

  return {
    cylinder_volume_ft3: cylinderVolume,
    cone_volume_ft3: coneVolume,
    total_volume_ft3: totalVolume,
    slope_ft3_per_in: slope,
    slope_divisor_in: divisor,
    effective_cylinder_height_in: effectiveHeight,
    calculated_volume_ft3: available,
  };
}

export function roundSiloResult(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
