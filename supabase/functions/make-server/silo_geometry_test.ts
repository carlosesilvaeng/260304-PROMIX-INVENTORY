import { assertAlmostEquals, assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { calculateSiloGeometry } from './silo_geometry.ts';

Deno.test('reproduce el caso Excel 1', () => {
  const result = calculateSiloGeometry({
    diameter_in: 137, total_height_in: 216, cone_height_in: 72, bottom_diameter_in: 12,
    cylinder_height_mode: 'H_MINUS_24', slope_divisor_mode: 'SLOPE_DIVISOR_H',
    reading_reference: 'FILLED_HEIGHT_INCHES', reading_in: 0,
  });
  assertAlmostEquals(result.cylinder_volume_ft3, 1637.90, 0.01);
  assertAlmostEquals(result.cone_volume_ft3, 224.24, 0.01);
  assertAlmostEquals(result.total_volume_ft3, 1862.14, 0.02);
  assertAlmostEquals(result.slope_ft3_per_in, 7.58, 0.01);
});

Deno.test('reproduce el caso Excel 2', () => {
  const result = calculateSiloGeometry({
    diameter_in: 64, total_height_in: 144, cone_height_in: 66, bottom_diameter_in: 10,
    cylinder_height_mode: 'FULL_H', slope_divisor_mode: 'SLOPE_DIVISOR_H_MINUS_24',
    reading_reference: 'FILLED_HEIGHT_INCHES', reading_in: 0,
  });
  assertAlmostEquals(result.cylinder_volume_ft3, 268.08, 0.01);
  assertAlmostEquals(result.cone_volume_ft3, 48.36, 0.01);
  assertAlmostEquals(result.total_volume_ft3, 316.44, 0.02);
  assertAlmostEquals(result.slope_ft3_per_in, 2.23, 0.01);
});

Deno.test('interpreta lectura vacía y rechaza dominio inválido', () => {
  const base = {
    diameter_in: 64, total_height_in: 144, cone_height_in: 66, bottom_diameter_in: 10,
    cylinder_height_mode: 'FULL_H' as const, slope_divisor_mode: 'SLOPE_DIVISOR_EFFECTIVE' as const,
    reading_reference: 'EMPTY_HEIGHT_INCHES' as const,
  };
  const empty = calculateSiloGeometry({ ...base, reading_in: 144 });
  assertEquals(empty.calculated_volume_ft3, 0);
  assertThrows(() => calculateSiloGeometry({ ...base, reading_in: 145 }));
  assertThrows(() => calculateSiloGeometry({ ...base, bottom_diameter_in: 65, reading_in: 1 }));
  assertThrows(() => calculateSiloGeometry({
    ...base, total_height_in: 24, cylinder_height_mode: 'H_MINUS_24', reading_in: 1,
  }));
});
