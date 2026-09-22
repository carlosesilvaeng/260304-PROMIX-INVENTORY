import assert from 'node:assert/strict';
import { validateSilosSection } from '../src/app/utils/validation.ts';

const calibrationSilo = validateSilosSection([{
  silo_name: 'Silo Carolina',
  calculation_method: 'CALIBRATION_CURVE',
  reading_value: 144,
  photo_url: 'https://example.invalid/carolina.jpg',
  product_name: null,
}]);
assert.equal(calibrationSilo.isComplete, true, 'calibration silos do not require a product');
assert.equal(calibrationSilo.completeItems, 1);

const geometricWithoutProduct = validateSilosSection([{
  silo_name: 'Silo geométrico',
  calculation_method: 'GEOMETRIC_CYLINDER_CONE',
  reading_value: 12,
  photo_url: 'https://example.invalid/geometric.jpg',
  product_name: null,
}]);
assert.equal(geometricWithoutProduct.isComplete, false, 'geometric silos require a product');
assert.match(geometricWithoutProduct.issues[0]?.message || '', /producto/i);

const photoOptional = validateSilosSection([{
  silo_name: 'Silo sin foto requerida',
  calculation_method: 'CALIBRATION_CURVE',
  reading_value: 0,
  requires_photo: false,
  photo_url: null,
}]);
assert.equal(photoOptional.isComplete, true, 'optional photos must not block completion');

console.log('Silo validation tests passed.');
