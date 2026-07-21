export const FEET_INCHES_UNIT_ID = 'ft-in';

export interface FeetInchesParts {
  feet: number;
  inches: number;
}

export function isFeetInchesUnit(unitId: string | null | undefined) {
  return unitId === FEET_INCHES_UNIT_ID;
}

export function feetInchesToDecimalFeet(feet: number, inches = 0) {
  return feet + inches / 12;
}

export function decimalFeetToFeetInchesParts(value: number | string | null | undefined): FeetInchesParts | null {
  if (value === null || value === undefined || value === '') return null;
  const decimalFeet = Number(value);
  if (!Number.isFinite(decimalFeet)) return null;

  const sign = decimalFeet < 0 ? -1 : 1;
  const absoluteFeet = Math.abs(decimalFeet);
  let feet = Math.floor(absoluteFeet);
  let inches = Number(((absoluteFeet - feet) * 12).toFixed(3));

  if (inches >= 12) {
    feet += 1;
    inches = 0;
  }

  return {
    feet: feet * sign,
    inches,
  };
}

export function formatFeetInches(value: number | string | null | undefined, fallback = '-') {
  const parts = decimalFeetToFeetInchesParts(value);
  if (!parts) return fallback;

  const inchesLabel = Number.isInteger(parts.inches)
    ? String(parts.inches)
    : String(Number(parts.inches.toFixed(3)));

  return `${parts.feet} ft ${inchesLabel} in`;
}
