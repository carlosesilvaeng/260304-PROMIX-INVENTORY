import assert from 'node:assert/strict';
import {
  calculateSiloInventoryPresentation,
  resolveSiloProductFactor,
} from '../supabase/functions/make-server/silo_inventory.ts';

const factors = [
  {
    id: 'cement-global',
    material_id: 'cement',
    plant_id: null,
    from_unit_id: 'ft3',
    to_unit_id: 'lb',
    factor: 90,
    active: true,
    material: { id: 'cement', nombre: 'CEMENTO' },
  },
  {
    id: 'cement-gurabo',
    material_id: 'cement',
    plant_id: 'GURABO',
    from_unit_id: 'ft3',
    to_unit_id: 'lb',
    factor: 94,
    active: true,
    material: { id: 'cement', nombre: 'Cemento' },
  },
  {
    id: 'slag-global',
    material_id: 'slag',
    plant_id: null,
    from_unit_id: 'ft3',
    to_unit_id: 'lb',
    factor: 80,
    active: true,
    material: { id: 'slag', nombre: 'Slag' },
  },
];

const plantFactor = resolveSiloProductFactor({ factors, plantId: 'GURABO', productName: 'cemento' });
assert.equal(plantFactor?.id, 'cement-gurabo', 'plant factor must win over global product factor');

const globalFactor = resolveSiloProductFactor({ factors, plantId: 'GUAYNABO', productName: 'CEMENTO' });
assert.equal(globalFactor?.id, 'cement-global', 'global product factor must be the fallback');

const slagFactor = resolveSiloProductFactor({ factors, plantId: 'GUAYNABO', productName: 'slag' });
assert.equal(slagFactor?.id, 'slag-global', 'products must not reuse another product factor');

const missingFactor = resolveSiloProductFactor({ factors, plantId: 'GUAYNABO', productName: 'Fly Ash' });
assert.equal(missingFactor, null, 'an unconfigured product must not receive a generic factor');

const result = calculateSiloInventoryPresentation(100, plantFactor);
assert.equal(result.pounds, 9400);
assert.equal(result.sacks, 100);
assert.equal(result.sackWeightLbs, 94);

assert.throws(
  () => calculateSiloInventoryPresentation(10, { ...plantFactor, factor: 0 }),
  /factor del producto/i,
);

console.log('Silo inventory presentation tests passed.');
