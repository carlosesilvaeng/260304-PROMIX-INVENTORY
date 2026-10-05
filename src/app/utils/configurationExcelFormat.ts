import {CONFIG_TABLE_LABELS, type ConfigurationPackage} from './configurationPackages';

// Workbook versioning is independent of the existing server package protocol.
export const EXCEL_FORMAT = 'promix-editable-plant-configuration';
export const EXCEL_VERSION = 1;
export const METADATA_SHEET = '_PROMIX';
export const OPTIONS_SHEET = '_Opciones';
export const MAX_EXCEL_BYTES = 10 * 1024 * 1024;
export const EXTRA_INPUT_ROWS = 100;
// Excel's XML text notation interprets literal _xNNNN_ sequences. Escape the
// underscore first and encode surrogate/control units so stream boundaries
// cannot split pairs or normalize carriage returns during a roundtrip.
export function escapeExcelText(value: string) {
  return value.replace(/_x[0-9a-f]{4}_/gi, match => '_x005F_' + match.slice(1))
    .replace(/[\x00-\x08\x0b-\x1f\x7f\uD800-\uDFFF]/g, char => '_x' + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0') + '_');
}
export function encodeExcelBaseline(value: ConfigurationPackage[]) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}
export function decodeExcelBaseline(encoded: string): unknown {
  const binary = atob(encoded), bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
}
export const PLANT_FIELDS = {
  has_cone_measurement: 'Método cono habilitado',
  has_cajon_measurement: 'Método cajón habilitado',
  petty_cash_established: 'Caja chica establecida',
} as const;

export const IDENTITY_FIELDS: Record<string, string[]> = {
  unit_categories: ['code'], units: ['code'], materiales_catalog: ['nombre', 'clase'],
  procedencias_catalog: ['nombre'], additives_catalog: ['nombre'],
  material_conversion_factors: ['plant_id', 'material_id', 'from_unit_id', 'to_unit_id', 'effective_from', 'effective_to'],
  calibration_curves: ['plant_id', 'curve_name'], plant_aggregates_config: ['plant_id', 'aggregate_name'],
  plant_cajones_config: ['plant_id', 'cajon_name'], plant_silos_config: ['plant_id', 'silo_name'],
  plant_additives_config: ['plant_id', 'additive_name', 'tank_name'], plant_diesel_config: ['plant_id'],
  plant_products_config: ['plant_id', 'product_name'], plant_utilities_meters_config: ['plant_id', 'meter_name'],
  plant_petty_cash_config: ['plant_id'],
  measurement_configs: ['plant_id', 'section_code', 'inventory_type_id', 'material_id', 'equipment_id'],
  calibration_curve_points: ['curve_id', 'point_key'], silo_allowed_products: ['silo_config_id', 'product_name'],
};
const integerFields = new Set(['sort_order', 'decimal_precision']);
const booleanFields = new Set(['is_active', 'active', 'requires_photo', 'has_cone_measurement', 'has_cajon_measurement']);
const dateFields = new Set(['created_at', 'updated_at', 'effective_from', 'effective_to']);
const structuredFields = new Set(['conversion_table', 'calibration_table', 'data_points']);
// Curves and their authoritative points are edited together in the existing curve editor.
export const READ_ONLY_TABLES = new Set(['calibration_curves', 'calibration_curve_points']);

export function plantExcelLabel(file: ConfigurationPackage) {
  return `${file.origin.plant_name} (${file.payload.plant.code || file.origin.plant_id})`;
}
export function tableSheetName(table: string) { return CONFIG_TABLE_LABELS[table].slice(0, 31); }
export function tableColumns(files: ConfigurationPackage[], table: string) {
  return [...new Set(files.flatMap(file => file.payload.schema[table]))];
}
export function referenceTables(field: string): string[] {
  if (field.endsWith('_unit_id') || ['from_unit_id', 'to_unit_id'].includes(field)) return ['units'];
  return ({category_id: ['unit_categories'], material_id: ['materiales_catalog'],
    material_conversion_factor_id: ['material_conversion_factors'], calibration_curve_id: ['calibration_curves'],
    curve_id: ['calibration_curves'], silo_config_id: ['plant_silos_config'], catalog_additive_id: ['additives_catalog'],
    equipment_id: Object.keys(IDENTITY_FIELDS).filter(table => table.startsWith('plant_')),
  } as Record<string, string[]>)[field] || [];
}
export function rowReferenceLabel(table: string, row: Record<string, any>, file?: ConfigurationPackage) {
  if (table === 'material_conversion_factors' && file) {
    const material = file.payload.tables.materiales_catalog.find(candidate => candidate.id === row.material_id)?.nombre || row.material_id || 'Todos los materiales';
    const unit = (id: string) => file.payload.tables.units.find(candidate => candidate.id === id)?.code || id;
    const period = [row.effective_from, row.effective_to].filter(Boolean).join(' / ');
    return `Factores de conversión: ${material} / ${unit(row.from_unit_id)} a ${unit(row.to_unit_id)}${period ? ' / ' + period : ''}`;
  }
  const fields = IDENTITY_FIELDS[table].filter(field => !['plant_id'].includes(field));
  const name = fields.map(field => row[field]).filter(value => value !== null && value !== undefined && value !== '').join(' / ');
  return `${CONFIG_TABLE_LABELS[table]}: ${name || row.id}`;
}
export function referenceChoices(file: ConfigurationPackage, field: string) {
  return referenceTables(field).flatMap(table => file.payload.tables[table].map(row => ({
    id: row.id, label: rowReferenceLabel(table, row, file), table,
  })));
}
export function fieldKind(file: ConfigurationPackage, table: string, field: string): 'number' | 'integer' | 'boolean' | 'date' | 'text' {
  if (integerFields.has(field)) return 'integer';
  if (booleanFields.has(field) || file.payload.tables[table]?.some(row => typeof row[field] === 'boolean')) return 'boolean';
  if (file.payload.numeric_fields[table]?.includes(field) || file.payload.tables[table]?.some(row => typeof row[field] === 'number')) return 'number';
  if (dateFields.has(field)) return 'date';
  return 'text';
}
export function readOnlyField(file: ConfigurationPackage, table: string, field: string) {
  return READ_ONLY_TABLES.has(table) || ['id', 'plant_id', 'created_at', 'updated_at'].includes(field)
    || structuredFields.has(field) || file.payload.json_fields[table].includes(field)
    || file.payload.tables[table].some(row => row[field] && typeof row[field] === 'object');
}
export function hiddenField(files: ConfigurationPackage[], table: string, field: string) {
  return ['id', 'plant_id', 'created_at', 'updated_at'].includes(field)
    || structuredFields.has(field) || files.some(file => file.payload.json_fields[table].includes(field));
}
function decimalSignature(value: string): string {
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(value);
  if (!match) return value;
  let digits = (match[2] + (match[3] || '')).replace(/^0+/, '');
  if (!digits) return '0';
  let exponent = Number(match[4] || 0) - (match[3] || '').length;
  while (digits.endsWith('0')) { digits = digits.slice(0, -1); exponent++; }
  return (match[1] === '-' ? '-' : '') + digits + 'e' + exponent;
}
export function excelNumber(value: number | string): number | string {
  const numeric = Number(value), signature = decimalSignature(String(value));
  return Number.isFinite(numeric) && signature.split('e')[0].replace('-', '').length <= 15
    && signature === decimalSignature(String(numeric)) ? numeric : String(value);
}
export function projectedCell(file: ConfigurationPackage, table: string, field: string, value: any): any {
  if (value === null || value === undefined) return null;
  if (referenceTables(field).length && field !== 'plant_id') {
    const matches = referenceChoices(file, field).filter(choice => choice.id === value);
    if (matches.length === 1) return matches[0].label;
  }
  const kind = fieldKind(file, table, field);
  if (kind === 'boolean') return value ? 'Sí' : 'No';
  if (kind === 'number' || kind === 'integer') return excelNumber(value);
  if (kind === 'date') return String(value); // Exact timestamps and timezone offsets survive a roundtrip.
  const text = typeof value === 'object' ? JSON.stringify(value) : value;
  return typeof text === 'string' && text.length > 30000 ? 'Datos extensos protegidos; editar en el sistema' : text;
}
export const FIELD_OPTIONS: Record<string, string[]> = {
  calculation_method: ['CALIBRATION_CURVE', 'GEOMETRIC_CYLINDER_CONE'],
  cylinder_height_mode: ['FULL_H', 'H_MINUS_24'],
  slope_divisor_mode: ['SLOPE_DIVISOR_H', 'SLOPE_DIVISOR_H_MINUS_24', 'SLOPE_DIVISOR_EFFECTIVE'],
  reading_reference: ['FILLED_HEIGHT_INCHES', 'EMPTY_HEIGHT_INCHES'],
  measurement_system: ['metric', 'imperial', 'us_customary', 'operational'],
  method: ['table_interpolation', 'linear', 'polynomial'],
  geometry_model: ['LEGACY_LINEAR', 'EXACT_PIECEWISE'],
  measure_mode: ['COUNT', 'DRUM', 'PAIL', 'TANK_READING'],
};
export function fieldOptions(table: string, field: string): string[] | undefined {
  if (field === 'measurement_method') return ({
    plant_aggregates_config: ['BOX', 'CONE'], plant_silos_config: ['SILO_LEVEL'],
    plant_additives_config: ['MANUAL', 'CURVE', 'CYLINDER_VERTICAL', 'RECTANGULAR_IBC'], plant_diesel_config: ['TANK_LEVEL'],
  } as Record<string, string[]>)[table];
  return FIELD_OPTIONS[field];
}
