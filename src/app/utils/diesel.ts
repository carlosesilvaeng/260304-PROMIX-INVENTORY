export interface DieselCalibrationTable {
  [reading: string]: number;
}

export function convertDieselReadingToGallons(
  reading: number,
  calibrationTable: DieselCalibrationTable | null | undefined
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

  const lowerGallons = calibrationTable[lowerReading.toString()] ?? 0;
  const upperGallons = calibrationTable[upperReading.toString()] ?? lowerGallons;
  const ratio = (reading - lowerReading) / (upperReading - lowerReading);

  return Math.round((lowerGallons + ratio * (upperGallons - lowerGallons)) * 100) / 100;
}

export function calculateDieselConsumption(
  beginningInventory: number,
  purchases: number,
  endingInventory: number
): number {
  return Math.round((beginningInventory + purchases - endingInventory) * 100) / 100;
}
