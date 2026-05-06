export type CalibrationTable = Record<string, number>;

export interface CalibrationInterpolationResult {
  value: number;
  mode: 'empty' | 'clamped_min' | 'clamped_max' | 'exact' | 'interpolated';
  lowerReading: number | null;
  upperReading: number | null;
}

function roundTo(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeCalibrationPoints(conversionTable: CalibrationTable | null | undefined) {
  const pointsByReading = new Map<number, number>();

  Object.entries(conversionTable || {}).forEach(([readingKey, rawValue]) => {
    const reading = Number(readingKey);
    const value = Number(rawValue);
    if (!Number.isFinite(reading) || !Number.isFinite(value)) return;
    pointsByReading.set(reading, value);
  });

  return Array.from(pointsByReading.entries())
    .map(([reading, value]) => ({ reading, value }))
    .sort((left, right) => left.reading - right.reading);
}

export function hasCalibrationPoints(conversionTable: CalibrationTable | null | undefined) {
  return normalizeCalibrationPoints(conversionTable).length > 0;
}

export function interpolateCalibrationTable(
  reading: number,
  conversionTable: CalibrationTable | null | undefined,
  decimals = 2,
): CalibrationInterpolationResult {
  const readingValue = Number(reading);
  const points = normalizeCalibrationPoints(conversionTable);

  if (!Number.isFinite(readingValue) || points.length === 0) {
    return {
      value: 0,
      mode: 'empty',
      lowerReading: null,
      upperReading: null,
    };
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  if (readingValue <= firstPoint.reading) {
    return {
      value: roundTo(firstPoint.value, decimals),
      mode: readingValue === firstPoint.reading ? 'exact' : 'clamped_min',
      lowerReading: firstPoint.reading,
      upperReading: firstPoint.reading,
    };
  }

  if (readingValue >= lastPoint.reading) {
    return {
      value: roundTo(lastPoint.value, decimals),
      mode: readingValue === lastPoint.reading ? 'exact' : 'clamped_max',
      lowerReading: lastPoint.reading,
      upperReading: lastPoint.reading,
    };
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const lowerPoint = points[index];
    const upperPoint = points[index + 1];

    if (readingValue === lowerPoint.reading) {
      return {
        value: roundTo(lowerPoint.value, decimals),
        mode: 'exact',
        lowerReading: lowerPoint.reading,
        upperReading: lowerPoint.reading,
      };
    }

    if (readingValue >= lowerPoint.reading && readingValue <= upperPoint.reading) {
      const ratio = (readingValue - lowerPoint.reading) / (upperPoint.reading - lowerPoint.reading);
      const value = lowerPoint.value + (upperPoint.value - lowerPoint.value) * ratio;
      return {
        value: roundTo(value, decimals),
        mode: readingValue === upperPoint.reading ? 'exact' : 'interpolated',
        lowerReading: lowerPoint.reading,
        upperReading: upperPoint.reading,
      };
    }
  }

  return {
    value: roundTo(lastPoint.value, decimals),
    mode: 'clamped_max',
    lowerReading: lastPoint.reading,
    upperReading: lastPoint.reading,
  };
}

export function convertReadingToVolume(
  reading: number,
  conversionTable: CalibrationTable
): number {
  return interpolateCalibrationTable(reading, conversionTable).value;
}
