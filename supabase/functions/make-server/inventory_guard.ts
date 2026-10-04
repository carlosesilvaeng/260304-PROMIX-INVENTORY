import { calculateSiloGeometry, roundSiloResult } from './silo_geometry.ts';
import { calculateSiloInventoryPresentation, resolveSiloProductFactor } from './silo_inventory.ts';
import { calculateAdditiveMeasurement, normalizeAdditiveMeasurementMethod, roundAdditiveMeasurement } from './additive_measurement.ts';

export const INVENTORY_SECTIONS = ['aggregates', 'silos', 'additives', 'diesel', 'products', 'utilities', 'petty-cash'] as const;
export type InventorySection = typeof INVENTORY_SECTIONS[number];
export class InventoryError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'INVALID_INVENTORY') { super(message); this.status = status; this.code = code; }
}
export function requireInventoryWriter(user: any) {
  if (!user?.is_active || !['plant_manager', 'operations_manager'].includes(user.role)) {
    throw new InventoryError('No tienes permisos para registrar mediciones.', 403, 'INVENTORY_WRITE_FORBIDDEN');
  }
}
export function optionalNumber(value: unknown, label = 'Lectura'): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') throw new InventoryError(`${label}: número inválido.`);
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new InventoryError(`${label}: ingresa un número válido mayor o igual a cero.`);
  return number;
}
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const present = (value: unknown) => value !== null && value !== undefined && value !== '';
const select = (source: any, keys: string[]) => Object.fromEntries(keys.map(key => [key, source[key] ?? null]));
const coneFields = ['cone_m1', 'cone_m2', 'cone_m3', 'cone_m4', 'cone_m5', 'cone_m6', 'cone_d1', 'cone_d2'];

function curveValue(reading: number | null, table: any): number | null {
  if (reading === null) return null;
  const points = Object.entries(table || {}).map(([x, y]) => [Number(x), Number(y)])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)).sort((a, b) => a[0] - b[0]);
  if (!points.length) throw new InventoryError('Falta la curva de calibración configurada.');
  if (reading < points[0][0] || reading > points.at(-1)![0]) throw new InventoryError('La lectura está fuera del rango de calibración.');
  for (let i = 0; i < points.length; i++) {
    if (reading === points[i][0]) return round(points[i][1]);
    if (i > 0 && reading < points[i][0]) {
      const [x, y] = points[i - 1]; const [nextX, nextY] = points[i];
      return round(y + (reading - x) / (nextX - x) * (nextY - y));
    }
  }
  return round(points.at(-1)![1]);
}
function effectiveRule(pack: any, section: string, equipmentId?: string) {
  return (pack.measurement_configs || []).filter((r: any) => r.active !== false && (!r.plant_id || r.plant_id === pack.plant_id)
    && (!r.section_code || r.section_code === section) && (!r.equipment_id || r.equipment_id === equipmentId))
    .sort((a: any, b: any) => (Number(!!b.plant_id) * 16 + Number(!!b.section_code) * 8 + Number(!!b.equipment_id) * 4)
      - (Number(!!a.plant_id) * 16 + Number(!!a.section_code) * 8 + Number(!!a.equipment_id) * 4))[0];
}
function unit(pack: any, id: string) {
  const result = (pack.units || []).find((u: any) => u.id === id && u.active !== false);
  if (!result || !(Number(result.factor_to_base) > 0)) throw new InventoryError(`Unidad no configurada: ${id}.`);
  return result;
}
function volumeFactor(u: any) {
  if (u.category_id === 'volume') return Number(u.factor_to_base);
  if (u.category_id === 'capacity') return Number(u.factor_to_base) * 0.003785411784;
  throw new InventoryError(`Unidad de volumen inválida: ${u.id}.`);
}
function convert(pack: any, value: number, from: string, to: string, factorId?: string) {
  if (from === to) return value;
  const a = unit(pack, from); const b = unit(pack, to);
  if (a.category_id === b.category_id) return value * Number(a.factor_to_base) / Number(b.factor_to_base);
  if (['volume', 'capacity'].includes(a.category_id) && ['volume', 'capacity'].includes(b.category_id)) return value * volumeFactor(a) / volumeFactor(b);
  const factor = (pack.material_conversion_factors || []).find((f: any) => f.id === factorId && f.active !== false);
  if (factor?.from_unit_id === from && factor?.to_unit_id === to && Number(factor.factor) > 0) return value * Number(factor.factor);
  throw new InventoryError(`No existe conversión configurada entre ${from} y ${to}.`);
}

export function configuredRows(pack: any, section: InventorySection): any[] {
  switch (section) {
    case 'aggregates': return pack.aggregates?.length ? pack.aggregates.map((c: any) => ({ ...c,
      box_width_ft: c.box_width_ft || (pack.cajones || []).find((box: any) => box.name === c.aggregate_name)?.ancho,
    })) : (pack.cajones || []).map((c: any) => ({
      ...c, aggregate_name: c.name, material_type: c.material, location_area: c.procedencia,
      measurement_method: 'BOX', box_width_ft: c.ancho, box_height_ft: c.alto,
    }));
    case 'utilities': return pack.utilities_meters || [];
    case 'petty-cash': return pack.petty_cash ? [pack.petty_cash] : [];
    case 'diesel': return pack.diesel ? [pack.diesel] : [];
    default: return pack[section] || [];
  }
}
export function configId(section: InventorySection, row: any) {
  if (section === 'aggregates' && typeof row.aggregate_config_id === 'string') return row.aggregate_config_id.replace(/^fallback_cajon_/, '');
  return row[`${section === 'aggregates' ? 'aggregate' : section === 'silos' ? 'silo' : section === 'additives' ? 'additive' : section === 'products' ? 'product' : section === 'utilities' ? 'utility_meter' : section === 'petty-cash' ? 'petty_cash' : 'diesel'}_config_id`]
    || (section === 'products' ? row.producto_config_id : section === 'utilities' ? row.utility_config_id : null);
}

// Only operator inputs survive. Methods, units, dimensions, curves and calculated
// quantities always come from the authorized plant configuration.
export function prepareInventoryRows(section: InventorySection, inputs: any[], pack: any, previous: any = {}): any[] {
  if (!Array.isArray(inputs) || inputs.length > 1000) throw new InventoryError('entries debe ser un arreglo de hasta 1000 registros.');
  const configs = configuredRows(pack, section); const seen = new Set<string>();
  const rows = inputs.map(input => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InventoryError('Registro inválido.');
    const id = configId(section, input);
    const c = configs.find((c: any) => c.id === id && c.is_active !== false);
    if (!c || seen.has(id)) throw new InventoryError('Configuración inexistente, duplicada o ajena a la planta.');
    seen.add(id);
    if (input.photo_url != null && typeof input.photo_url !== 'string') throw new InventoryError('Foto inválida.');
    if (input.notes != null && typeof input.notes !== 'string') throw new InventoryError('Observaciones inválidas.');
    const base: any = { ...(input.id ? { id: input.id } : {}), photo_url: input.photo_url?.trim() || null, notes: input.notes?.trim() || null };
    const n = (key: string) => optionalNumber(input[key], key);
    switch (section) {
      case 'aggregates': {
        const rule = effectiveRule(pack, section); const capture = rule?.capture_unit_id || 'ft';
        const display = rule?.display_unit_id || rule?.calculation_unit_id || 'ft3';
        const row: any = { ...base, aggregate_config_id: c.id, ...select(c, ['aggregate_name', 'material_type', 'location_area', 'measurement_method']),
          unit: display, box_width_ft: optionalNumber(c.box_width_ft), box_height_ft: n('box_height_ft'), box_length_ft: n('box_length_ft'),
          ...Object.fromEntries(coneFields.map(key => [key, n(key)])), calculated_volume_cy: null };
        let volume: number | null = null;
        if (c.measurement_method === 'BOX') {
          if ([row.box_width_ft, row.box_height_ft, row.box_length_ft].every(present)) volume = row.box_width_ft * row.box_height_ft * row.box_length_ft;
        } else if (c.measurement_method === 'CONE') {
          if (coneFields.every(key => present(row[key]))) {
            const radius = (row.cone_d1 + row.cone_d2) / 4;
            const slope = coneFields.slice(0, 6).reduce((sum, key) => sum + row[key], 0) / 6;
            if (slope < radius) throw new InventoryError('Las medidas del cono no forman una geometría válida.');
            volume = Math.PI * radius ** 2 * Math.sqrt(slope ** 2 - radius ** 2) / 3;
          }
        } else throw new InventoryError('Método de agregado no configurado.');
        if (volume !== null) row.calculated_volume_cy = round(convert(pack, volume, capture === 'm' ? 'm3' : 'ft3', display));
        return row;
      }
      case 'silos': {
        if ((input.product_name ?? input.product_in_silo) != null && typeof (input.product_name ?? input.product_in_silo) !== 'string') throw new InventoryError('Producto inválido.');
        const reading = optionalNumber(input.reading_value ?? input.reading); const product = String(input.product_name || input.product_in_silo || '').trim() || null;
        if (product && c.allowed_products?.length && !c.allowed_products.includes(product)) throw new InventoryError('Producto no permitido en este silo.');
        const row: any = { ...base, silo_config_id: c.id, ...select(c, ['silo_name', 'measurement_method', 'reading_uom', 'conversion_table', 'reading_reference', 'diameter_in', 'total_height_in', 'cone_height_in', 'bottom_diameter_in', 'cylinder_height_mode', 'slope_divisor_mode', 'material_conversion_factor_id', 'calibration_curve_name']),
          allowed_products: c.allowed_products || [], product_name: product, product_in_silo: product, product_id: null,
          calculation_method: c.calculation_method || 'CALIBRATION_CURVE', geometry_model: c.geometry_model || 'LEGACY_LINEAR', capacity_fraction: Number(c.capacity_fraction ?? 1),
          requires_photo: c.requires_photo ?? true, reading_value: reading, reading,
          calculated_result: null, calculated_result_cy: null, calculated_volume: null, calculated_volume_ft3: null,
          calculated_result_unit_id: c.inventory_unit_id || null, presentation_lbs: null, presentation_sacks: null, presentation_metric_tons: null,
          calculation_metadata: null };
        if (reading === null) return row;
        if (row.calculation_method === 'GEOMETRIC_CYLINDER_CONE') {
          const geometry = calculateSiloGeometry({ ...c, reading_in: reading });
          row.calculated_volume_ft3 = roundSiloResult(geometry.calculated_volume_ft3);
          if (!product) return row; // An incomplete draft is allowed; submission is not.
          const factor = resolveSiloProductFactor({ factors: pack.material_conversion_factors || [], plantId: pack.plant_id, productName: product, explicitFactorId: c.material_conversion_factor_id });
          if (factor) {
            const p = calculateSiloInventoryPresentation(geometry.calculated_volume_ft3, factor);
            row.calculated_result = roundSiloResult(p.pounds); row.calculated_result_unit_id = 'lb';
            row.presentation_lbs = roundSiloResult(p.pounds); row.presentation_sacks = roundSiloResult(p.sacks);
            row.presentation_metric_tons = roundSiloResult(p.pounds / 2204.6226218);
            row.calculation_metadata = { geometry, factor: { id: factor.id, factor: factor.factor, material_id: factor.material_id || null }, product, sack_weight_lbs: p.sackWeightLbs };
          } else {
            if (['lb', 'sack'].includes(c.inventory_unit_id)) throw new InventoryError('Falta el factor de conversión del producto.');
            row.calculated_result = row.calculated_volume_ft3; row.calculated_result_unit_id = 'ft3';
            row.calculation_metadata = { geometry, factor: null, product, conversion_pending: true };
          }
        } else {
          row.calculated_result = curveValue(reading, c.conversion_table);
          row.calculation_metadata = { calibration_curve_name: c.calibration_curve_name };
        }
        row.calculated_result_cy = row.calculated_volume = row.calculated_result;
        return row;
      }
      case 'additives': {
        const method = normalizeAdditiveMeasurementMethod(c.measurement_method || (c.additive_type === 'TANK' ? 'CURVE' : 'MANUAL'));
        const rule = effectiveRule(pack, section, c.id);
        const capture = rule?.capture_unit_id || c.dimension_unit_id || c.reading_uom || 'in';
        const calculation = method === 'MANUAL' ? c.capacity_unit_id : rule?.calculation_unit_id || c.capacity_unit_id || 'gal_us';
        const display = method === 'MANUAL' ? calculation : rule?.display_unit_id || calculation;
        const inventory = method === 'MANUAL' ? calculation : rule?.inventory_unit_id || calculation;
        const reading = method === 'MANUAL' ? null : optionalNumber(input.reading_value ?? input.reading); const quantity = method === 'MANUAL' ? n('quantity') : null;
        const row: any = { ...base, additive_config_id: c.id, ...select(c, ['brand', 'uom', 'requires_photo', 'tank_name', 'diameter', 'length', 'width', 'total_height', 'capacity', 'dimension_unit_id', 'capacity_unit_id']),
          additive_type: method === 'MANUAL' ? 'MANUAL' : 'TANK', product_name: c.additive_name, measurement_method: method,
          reading_uom: method === 'CURVE' ? c.reading_uom : capture, reading_value: reading, reading, quantity,
          conversion_table: method === 'CURVE' ? c.conversion_table : null,
          capture_unit_id: capture, calculation_unit_id: calculation, display_unit_id: display, inventory_unit_id: inventory,
          calculated_volume: null, calculated_gallons: null, inventory_percentage: null, display_volume: null, inventory_quantity: null };
        if ((method === 'MANUAL' ? quantity : reading) === null) return row;
        unit(pack, calculation);
        let measurement: any;
        if (method === 'CURVE') measurement = { calculated_volume: curveValue(reading, c.conversion_table), inventory_percentage: null };
        else if (method === 'MANUAL') measurement = calculateAdditiveMeasurement({ method, capacity: c.capacity }, { quantity });
        else measurement = calculateAdditiveMeasurement({ ...c, method, dimension_factor_to_base: Number(unit(pack, c.dimension_unit_id).factor_to_base),
          calculation_volume_factor_to_base: volumeFactor(unit(pack, calculation)), capacity_volume_factor_to_base: volumeFactor(unit(pack, c.capacity_unit_id)) }, { reading });
        row.calculated_volume = roundAdditiveMeasurement(measurement.calculated_volume);
        row.calculated_gallons = calculation === 'gal_us' ? row.calculated_volume : null;
        row.inventory_percentage = measurement.inventory_percentage === null ? null : roundAdditiveMeasurement(measurement.inventory_percentage);
        row.display_volume = round(convert(pack, row.calculated_volume, calculation, display, rule?.material_conversion_factor_id));
        row.inventory_quantity = round(convert(pack, row.calculated_volume, calculation, inventory, rule?.material_conversion_factor_id));
        if (method === 'MANUAL') row.quantity = row.calculated_volume;
        return row;
      }
      case 'diesel': {
        const reading = optionalNumber(input.reading_inches ?? input.reading); const purchases = n('purchases_gallons');
        const beginning = optionalNumber(previous.diesel?.ending_inventory ?? c.initial_inventory_gallons);
        const ending = curveValue(reading, c.calibration_table);
        return { ...base, diesel_config_id: c.id, plant_id: pack.plant_id, unit: 'gal_us', reading_uom: c.reading_uom,
          reading_inches: reading, reading, calculated_gallons: ending, ending_inventory: ending,
          beginning_inventory: beginning, purchases_gallons: purchases, consumption_gallons: [beginning, purchases, ending].every(present) ? round(beginning! + purchases! - ending!) : null,
          calibration_table: c.calibration_table, tank_capacity_gallons: c.tank_capacity_gallons };
      }
      case 'products': {
        const reading = n('reading_value'); const count = n('unit_count');
        const mode = c.measure_mode; const quantity = mode === 'TANK_READING' ? curveValue(reading, c.calibration_table) : ['DRUM', 'PAIL'].includes(mode) ? count : n('quantity');
        if (!['TANK_READING', 'DRUM', 'PAIL', 'COUNT'].includes(mode)) throw new InventoryError('Método de producto inválido.');
        const volume = optionalNumber(c.unit_volume);
        return { ...base, product_config_id: c.id, producto_config_id: c.id, ...select(c, ['product_name', 'category', 'measure_mode', 'requires_photo', 'reading_uom', 'calibration_table', 'tank_capacity']),
          uom: c.uom || c.unit, reading_value: mode === 'TANK_READING' ? reading : null, unit_count: ['DRUM', 'PAIL'].includes(mode) ? count : null,
          unit_volume: volume, total_volume: ['DRUM', 'PAIL'].includes(mode) && count !== null && volume !== null ? round(count * volume) : null,
          calculated_quantity: mode === 'TANK_READING' ? quantity : null, quantity };
      }
      case 'utilities': {
        const prior = (previous.utilities || []).find((r: any) => configId(section, r) === c.id);
        const previousReading = optionalNumber(prior?.current_reading ?? c.initial_reading); const current = n('current_reading');
        if (current !== null && previousReading !== null && current < previousReading) throw new InventoryError('La lectura actual no puede ser menor que la anterior.');
        return { ...base, utility_meter_config_id: c.id, utility_config_id: c.id, ...select(c, ['meter_name', 'meter_number', 'utility_type', 'uom', 'provider', 'requires_photo']),
          uom: c.uom || c.unit, utility_type: c.utility_type || (['WATER_AAA','WATER_WELL','ELECTRICITY','GAS','OTHER'].includes(c.meter_type) ? c.meter_type : 'OTHER'),
          requires_photo: c.requires_photo ?? true,
          previous_reading: previousReading, current_reading: current, reading: current,
          consumption: current === null || previousReading === null ? null : round(current - previousReading) };
      }
      case 'petty-cash': {
        const receipts = n('receipts'); const cash = n('cash');
        const established = optionalNumber(c.monthly_amount ?? c.initial_amount ?? c.established_amount ?? pack.plant_petty_cash_established);
        const total = receipts !== null && cash !== null ? round(receipts + cash) : null;
        return { ...base, petty_cash_config_id: c.id, plant_id: pack.plant_id, currency: c.currency || 'USD', established_amount: established,
          receipts, cash, total, difference: established !== null && total !== null ? round(established - total) : null };
      }
    }
  });
  for (const row of rows) {
    if (Object.values(row).some(value => typeof value === 'number' && !Number.isFinite(value))) {
      throw new InventoryError('El cálculo excede el rango numérico permitido. Revisa las mediciones.');
    }
  }
  return rows;
}

export function summarizeInventorySection(section: InventorySection, rows: any[]) {
  const required = (row: any): string[] => {
    switch (section) {
      case 'aggregates': return row.measurement_method === 'BOX' ? ['box_height_ft', 'box_length_ft'] : coneFields;
      case 'silos': return ['reading_value', ...(row.calculation_method === 'GEOMETRIC_CYLINDER_CONE' ? ['product_name'] : [])];
      case 'additives': return row.measurement_method === 'MANUAL' ? ['quantity'] : ['reading_value'];
      case 'diesel': return ['reading_inches', 'purchases_gallons'];
      case 'products': return row.measure_mode === 'TANK_READING' ? ['reading_value'] : ['DRUM', 'PAIL'].includes(row.measure_mode) ? ['unit_count'] : ['quantity'];
      case 'utilities': return ['current_reading'];
      case 'petty-cash': return ['receipts', 'cash'];
    }
  };
  let captured = 0; let complete = 0;
  for (const row of rows) {
    const keys = required(row);
    if (keys.some(key => present(row[key])) || row.photo_url || row.notes) captured++;
    const requiresPhoto = ['aggregates', 'diesel', 'petty-cash'].includes(section) || (section === 'silos' ? row.requires_photo !== false : row.requires_photo);
    const derived = section === 'aggregates' ? 'calculated_volume_cy' : section === 'silos' ? 'calculated_result' : section === 'additives' ? 'inventory_quantity'
      : section === 'diesel' ? 'consumption_gallons' : section === 'products' ? (['DRUM', 'PAIL'].includes(row.measure_mode) ? 'total_volume' : 'quantity') : section === 'petty-cash' ? 'total' : null;
    if (keys.every(key => present(row[key])) && (!requiresPhoto || row.photo_url) && (!derived || present(row[derived]))) complete++;
  }
  return { saved_count: rows.length, captured_count: captured, complete_count: complete, pending_count: rows.length - complete };
}

export function validateInventorySubmissionSection(section: InventorySection, savedRows: any[], pack: any, previous: any = {}) {
  const configs = configuredRows(pack, section);
  const inputs = savedRows.filter(row => configs.some(config => config.id === configId(section, row)));
  const missing = configs.filter(config => !inputs.some(row => configId(section, row) === config.id));
  const base = { section_code: section, section_name: section, configured_count: configs.length,
    missing_config_ids: missing.map(config => config.id) };
  try {
    const canonical = prepareInventoryRows(section, inputs, pack, previous);
    const summary = summarizeInventorySection(section, canonical);
    // A configuration or prior-month change must not silently validate different
    // quantities from those persisted and visible to the reviewer.
    const derivedFields: Record<InventorySection, string[]> = {
      aggregates: ['calculated_volume_cy'], silos: ['calculated_result_cy'],
      additives: ['calculated_volume', 'inventory_quantity'], diesel: ['ending_inventory','consumption_gallons'],
      products: ['quantity','total_volume'], utilities: ['consumption'], 'petty-cash': ['total','difference'],
    };
    canonical.forEach((row, index) => {
      if (summarizeInventorySection(section, [row]).complete_count === 0) return;
      for (const key of derivedFields[section]) {
        if (row[key] === null || row[key] === undefined) continue;
        const value = inputs[index][key];
        if (!present(value) || !Number.isFinite(Number(value)) || Math.abs(Number(value) - row[key]) > 0.011) {
          throw new InventoryError('La configuración o el cálculo cambió. Revisa y vuelve a guardar esta sección.');
        }
      }
    });
    return { ...base, ...summary, complete: missing.length === 0 && summary.complete_count === configs.length };
  } catch (error) {
    return { ...base, saved_count: inputs.length, captured_count: 0, complete_count: 0,
      pending_count: configs.length, complete: false, error: (error as Error).message };
  }
}
