import assert from 'node:assert/strict';
import { calculateSiloGeometry } from '../supabase/functions/make-server/silo_geometry.ts';

const close = (actual, expected, tolerance = 0.02) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≉ ${expected}`);
};

const case1 = calculateSiloGeometry({
  diameter_in: 137, total_height_in: 216, cone_height_in: 72, bottom_diameter_in: 12,
  cylinder_height_mode: 'H_MINUS_24', slope_divisor_mode: 'SLOPE_DIVISOR_H',
  reading_reference: 'FILLED_HEIGHT_INCHES', reading_in: 0,
});
close(case1.cylinder_volume_ft3, 1637.90);
close(case1.cone_volume_ft3, 224.24);
close(case1.total_volume_ft3, 1862.14);
close(case1.slope_ft3_per_in, 7.58);

const case2 = calculateSiloGeometry({
  diameter_in: 64, total_height_in: 144, cone_height_in: 66, bottom_diameter_in: 10,
  cylinder_height_mode: 'FULL_H', slope_divisor_mode: 'SLOPE_DIVISOR_H_MINUS_24',
  reading_reference: 'FILLED_HEIGHT_INCHES', reading_in: 0,
});
close(case2.cylinder_volume_ft3, 268.08);
close(case2.cone_volume_ft3, 48.36);
close(case2.total_volume_ft3, 316.44);
close(case2.slope_ft3_per_in, 2.23);

assert.throws(() => calculateSiloGeometry({ ...case2, diameter_in: 10, bottom_diameter_in: 11, reading_in: 0 }));
assert.throws(() => calculateSiloGeometry({
  diameter_in: 64, total_height_in: 24, cone_height_in: 66, bottom_diameter_in: 10,
  cylinder_height_mode: 'H_MINUS_24', slope_divisor_mode: 'SLOPE_DIVISOR_EFFECTIVE',
  reading_reference: 'EMPTY_HEIGHT_INCHES', reading_in: 0,
}));
assert.throws(() => calculateSiloGeometry({
  diameter_in: 64, total_height_in: 144, cone_height_in: 66, bottom_diameter_in: 10,
  cylinder_height_mode: 'FULL_H', slope_divisor_mode: 'SLOPE_DIVISOR_EFFECTIVE',
  reading_reference: 'EMPTY_HEIGHT_INCHES', reading_in: 145,
}));

console.log('Silo geometry validation passed.');
