export type CalibrationTable = Record<string, number>;

export function convertReadingToVolume(
  reading: number,
  conversionTable: CalibrationTable
): number {
  const exactValue = conversionTable[reading.toString()];
  if (exactValue !== undefined) {
    return exactValue;
  }

  const readings = Object.keys(conversionTable).map(Number).sort((a, b) => a - b);
  if (readings.length === 0) return 0;

  if (reading <= readings[0]) {
    return conversionTable[readings[0].toString()];
  }

  if (reading >= readings[readings.length - 1]) {
    return conversionTable[readings[readings.length - 1].toString()];
  }

  let lowerReading = readings[0];
  let upperReading = readings[1];

  for (let i = 0; i < readings.length - 1; i++) {
    if (reading >= readings[i] && reading <= readings[i + 1]) {
      lowerReading = readings[i];
      upperReading = readings[i + 1];
      break;
    }
  }

  const lowerVolume = conversionTable[lowerReading.toString()];
  const upperVolume = conversionTable[upperReading.toString()];
  const ratio = (reading - lowerReading) / (upperReading - lowerReading);

  return lowerVolume + (upperVolume - lowerVolume) * ratio;
}
