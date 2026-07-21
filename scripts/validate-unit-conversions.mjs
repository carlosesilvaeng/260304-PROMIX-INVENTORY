const units = [
  { id: 'm', category_id: 'length', factor_to_base: 1 },
  { id: 'ft', category_id: 'length', factor_to_base: 0.3048 },
  { id: 'ft-in', category_id: 'length', factor_to_base: 0.3048 },
  { id: 'in', category_id: 'length', factor_to_base: 0.0254 },
  { id: 'm3', category_id: 'volume', factor_to_base: 1 },
  { id: 'ft3', category_id: 'volume', factor_to_base: 0.028316846592 },
  { id: 'gal_us', category_id: 'capacity', factor_to_base: 1 },
  { id: 'liter', category_id: 'capacity', factor_to_base: 0.264172052358 },
  { id: 'lb', category_id: 'mass', factor_to_base: 1 },
  { id: 'short_ton', category_id: 'mass', factor_to_base: 2000 },
  { id: 'metric_ton', category_id: 'mass', factor_to_base: 2204.6226218 },
];

function convertUnit(value, fromUnitId, toUnitId) {
  const from = units.find((unit) => unit.id === fromUnitId);
  const to = units.find((unit) => unit.id === toUnitId);
  if (!from || !to) throw new Error('Missing unit');
  if (from.category_id !== to.category_id) throw new Error('Incompatible units');
  return (value * from.factor_to_base) / to.factor_to_base;
}

function assertClose(label, actual, expected, tolerance = 0.000001) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertThrows(label, fn) {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(`${label}: expected failure`);
}

function feetInchesToDecimalFeet(feet, inches = 0) {
  if (feet < 0 || !Number.isInteger(feet)) throw new Error('Invalid feet');
  if (inches < 0 || inches >= 12) throw new Error('Invalid inches');
  return feet + inches / 12;
}

function decimalFeetToFeetInchesParts(value) {
  const feet = Math.floor(value);
  let inches = Number(((value - feet) * 12).toFixed(3));
  if (inches >= 12) return { feet: feet + 1, inches: 0 };
  return { feet, inches };
}

assertClose('1 m = ft', convertUnit(1, 'm', 'ft'), 3.280839895, 0.00000001);
assertClose('1 ft = m', convertUnit(1, 'ft', 'm'), 0.3048);
assertClose('1 ft-in = m', convertUnit(1, 'ft-in', 'm'), 0.3048);
assertClose('1 in = m', convertUnit(1, 'in', 'm'), 0.0254);
assertClose('1 m3 = ft3', convertUnit(1, 'm3', 'ft3'), 35.3146667, 0.0000001);
assertClose('1 ft3 = m3', convertUnit(1, 'ft3', 'm3'), 0.0283168466, 0.0000000001);
assertClose('1 gal_us = liter', convertUnit(1, 'gal_us', 'liter'), 3.785411784, 0.000000001);
assertClose('1 short_ton = lb', convertUnit(1, 'short_ton', 'lb'), 2000);
assertClose('1 metric_ton = lb', convertUnit(1, 'metric_ton', 'lb'), 2204.6226218);
assertThrows('m3 to lb without material factor fails', () => convertUnit(1, 'm3', 'lb'));
assertThrows('in to gal_us without calibration fails', () => convertUnit(1, 'in', 'gal_us'));
assertThrows('length to mass fails', () => convertUnit(1, 'm', 'lb'));
assertClose('6 ft 6 in = decimal ft', feetInchesToDecimalFeet(6, 6), 6.5);
assertClose('2 ft 3.5 in = decimal ft', feetInchesToDecimalFeet(2, 3.5), 2.2916667, 0.0000001);
assertClose('6.5 decimal ft formats feet', decimalFeetToFeetInchesParts(6.5).feet, 6);
assertClose('6.5 decimal ft formats inches', decimalFeetToFeetInchesParts(6.5).inches, 6);
assertThrows('negative inches rejected', () => feetInchesToDecimalFeet(2, -1));
assertThrows('12 inches rejected', () => feetInchesToDecimalFeet(2, 12));

console.log('Unit conversion validation passed.');
