import { interpolateCalibrationTable } from './calibration';

export interface DieselCalibrationTable {
  [reading: string]: number;
}

export function convertDieselReadingToGallons(
  reading: number,
  calibrationTable: DieselCalibrationTable | null | undefined
): number {
  return interpolateCalibrationTable(reading, calibrationTable).value;
}

export function calculateDieselConsumption(
  beginningInventory: number,
  purchases: number,
  endingInventory: number
): number {
  return Math.round((beginningInventory + purchases - endingInventory) * 100) / 100;
}
