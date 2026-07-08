import { assertAlmostEquals, assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  calculateAdditiveMeasurement,
  interpolateAdditiveCurve,
  normalizeAdditiveMeasurementMethod,
} from './additive_measurement.ts';

Deno.test('conserva aliases e interpolación de curva', () => {
  assertEquals(normalizeAdditiveMeasurementMethod('TANK_LEVEL'), 'CURVE');
  assertEquals(normalizeAdditiveMeasurementMethod('MANUAL_QUANTITY'), 'MANUAL');
  const curve = { 0: 0, 10: 100, 20: 300 };
  assertEquals(interpolateAdditiveCurve(-1, curve), 0);
  assertEquals(interpolateAdditiveCurve(10, curve), 100);
  assertEquals(interpolateAdditiveCurve(15, curve), 200);
  assertEquals(interpolateAdditiveCurve(30, curve), 300);
});

Deno.test('reproduce cilindro vertical del Excel antes del tope', () => {
  const result = calculateAdditiveMeasurement({
    method: 'CYLINDER_VERTICAL',
    diameter: 64,
    total_height: 144,
    capacity: 3000,
    dimension_factor_to_base: 0.0254,
    calculation_volume_factor_to_base: 0.003785411784,
    capacity_volume_factor_to_base: 0.003785411784,
  }, { reading: 144 });
  assertAlmostEquals(result.uncapped_volume, 2005.40, 0.02);
  assertAlmostEquals(result.calculated_volume, 2005.40, 0.02);
});

Deno.test('limita cilindro a capacidad nominal y porcentaje a cien', () => {
  const result = calculateAdditiveMeasurement({
    method: 'CYLINDER_VERTICAL',
    diameter: 64,
    total_height: 144,
    capacity: 275,
    dimension_factor_to_base: 0.0254,
    calculation_volume_factor_to_base: 0.003785411784,
    capacity_volume_factor_to_base: 0.003785411784,
  }, { reading: 144 });
  assertEquals(result.calculated_volume, 275);
  assertEquals(result.inventory_percentage, 100);
});

Deno.test('calcula IBC y valida dominio', () => {
  const config = {
    method: 'RECTANGULAR_IBC',
    length: 48,
    width: 40,
    total_height: 46,
    capacity: 330,
    dimension_factor_to_base: 0.0254,
    calculation_volume_factor_to_base: 0.003785411784,
    capacity_volume_factor_to_base: 0.003785411784,
  };
  const empty = calculateAdditiveMeasurement(config, { reading: 0 });
  assertEquals(empty.calculated_volume, 0);
  assertEquals(empty.inventory_percentage, 0);
  assertThrows(() => calculateAdditiveMeasurement(config, { reading: 47 }));
  assertThrows(() => calculateAdditiveMeasurement({ ...config, width: 0 }, { reading: 1 }));
});
