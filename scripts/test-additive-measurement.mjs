import assert from 'node:assert/strict';
import {
  calculateAdditiveMeasurement,
  interpolateAdditiveCurve,
  normalizeAdditiveMeasurementMethod,
} from '../supabase/functions/make-server/additive_measurement.ts';

assert.equal(normalizeAdditiveMeasurementMethod('TANK'), 'CURVE');
assert.equal(normalizeAdditiveMeasurementMethod('MANUAL_QUANTITY'), 'MANUAL');
assert.equal(interpolateAdditiveCurve(15, { 0: 0, 10: 100, 20: 300 }), 200);

const excel = calculateAdditiveMeasurement({
  method: 'CYLINDER_VERTICAL',
  diameter: 64,
  total_height: 144,
  capacity: 3000,
  dimension_factor_to_base: 0.0254,
  calculation_volume_factor_to_base: 0.003785411784,
  capacity_volume_factor_to_base: 0.003785411784,
}, { reading: 144 });
assert.ok(Math.abs(excel.uncapped_volume - 2005.40) < 0.02);

const ibc = calculateAdditiveMeasurement({
  method: 'RECTANGULAR_IBC',
  length: 48,
  width: 40,
  total_height: 46,
  capacity: 330,
  dimension_factor_to_base: 0.0254,
  calculation_volume_factor_to_base: 0.003785411784,
  capacity_volume_factor_to_base: 0.003785411784,
}, { reading: 46 });
assert.equal(ibc.calculated_volume, 330);
assert.equal(ibc.inventory_percentage, 100);
assert.throws(() => calculateAdditiveMeasurement({
  method: 'RECTANGULAR_IBC',
  length: 48,
  width: 40,
  total_height: 46,
  capacity: 330,
  dimension_factor_to_base: 0.0254,
  calculation_volume_factor_to_base: 0.003785411784,
  capacity_volume_factor_to_base: 0.003785411784,
}, { reading: 47 }));

console.log('Additive measurement strategy tests passed.');
