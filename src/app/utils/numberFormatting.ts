export function formatNumber(
  value: number | string | null | undefined,
  fractionDigits = 2,
  fallback = '0.00',
) {
  const numericValue = typeof value === 'string' ? Number(value) : value;

  if (numericValue === null || numericValue === undefined || !Number.isFinite(numericValue)) {
    return fallback;
  }

  return numericValue.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatOptionalNumber(
  value: number | string | null | undefined,
  fractionDigits = 2,
  fallback = '-',
) {
  return formatNumber(value, fractionDigits, fallback);
}
