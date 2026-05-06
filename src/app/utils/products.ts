import { interpolateCalibrationTable } from './calibration';

export type ProductMeasureMode =
  | 'TANK_READING'
  | 'DRUM'
  | 'PAIL'
  | 'COUNT';

export interface ProductCalibrationTable {
  [reading: string]: number;
}

export function convertProductReadingToQuantity(
  reading: number,
  calibrationTable: ProductCalibrationTable | null | undefined
): number {
  return interpolateCalibrationTable(reading, calibrationTable).value;
}

export function getProductInputLabel(
  measureMode: ProductMeasureMode,
  readingUom?: string | null,
  uom?: string | null
): string {
  switch (measureMode) {
    case 'TANK_READING':
      return `Lectura (${readingUom || 'units'})`;
    case 'DRUM':
      return 'Cantidad de Tambores';
    case 'PAIL':
      return 'Cantidad de Pailas';
    case 'COUNT':
      return `Cantidad (${uom || 'units'})`;
    default:
      return 'Cantidad';
  }
}

export function getProductCalculatedLabel(
  measureMode: ProductMeasureMode,
  uom?: string | null
): string {
  switch (measureMode) {
    case 'TANK_READING':
      return `Volumen Calculado (${uom || 'units'})`;
    case 'DRUM':
    case 'PAIL':
    case 'COUNT':
      return `Total (${uom || 'units'})`;
    default:
      return `Total (${uom || 'units'})`;
  }
}
