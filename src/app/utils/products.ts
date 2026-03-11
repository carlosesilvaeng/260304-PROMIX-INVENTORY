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
  if (!calibrationTable) return 0;

  const exactValue = calibrationTable[reading.toString()];
  if (exactValue !== undefined) return exactValue;

  const readings = Object.keys(calibrationTable).map(Number).sort((a, b) => a - b);
  if (readings.length === 0) return 0;

  if (reading <= readings[0]) {
    return calibrationTable[readings[0].toString()] ?? 0;
  }

  const maxReading = readings[readings.length - 1];
  if (reading >= maxReading) {
    return calibrationTable[maxReading.toString()] ?? 0;
  }

  let lowerReading = readings[0];
  let upperReading = readings[1];

  for (let index = 0; index < readings.length - 1; index += 1) {
    if (reading >= readings[index] && reading <= readings[index + 1]) {
      lowerReading = readings[index];
      upperReading = readings[index + 1];
      break;
    }
  }

  const lowerQuantity = calibrationTable[lowerReading.toString()] ?? 0;
  const upperQuantity = calibrationTable[upperReading.toString()] ?? lowerQuantity;
  const ratio = (reading - lowerReading) / (upperReading - lowerReading);

  return Math.round((lowerQuantity + ratio * (upperQuantity - lowerQuantity)) * 100) / 100;
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
