import {CONFIG_TABLES, createConfigurationPackage, validateConfigurationPackage, type ConfigurationPackage} from './configurationPackages';
import {configurationFieldLabel} from './configurationWorkbook';
import {EXCEL_FORMAT, EXCEL_VERSION, METADATA_SHEET, OPTIONS_SHEET, MAX_EXCEL_BYTES, PLANT_FIELDS,
  tableSheetName, tableColumns, plantExcelLabel, projectedCell, readOnlyField, fieldKind, referenceTables,
  rowReferenceLabel, IDENTITY_FIELDS, READ_ONLY_TABLES, fieldOptions, excelNumber, decodeExcelBaseline} from './configurationExcelFormat';
import {checkCancellation} from './reportTransport';
import type {Cell, Worksheet} from 'exceljs';

export interface ExcelConfiguration {
  configuration: ConfigurationPackage;
  modified: boolean;
}
type LocatedRow = {table: string; row: Record<string, any>; sheet: Worksheet; line: number; columns: string[]};
const requiredFields: Record<string, string[]> = {
  unit_categories: ['code', 'name_es', 'name_en'],
  units: ['code', 'category_id', 'name_es', 'name_en', 'symbol', 'measurement_system', 'factor_to_base'],
  materiales_catalog: ['nombre', 'clase'], procedencias_catalog: ['nombre'], additives_catalog: ['nombre'],
  material_conversion_factors: ['from_unit_id', 'to_unit_id', 'factor'],
  plant_aggregates_config: ['aggregate_name', 'measurement_method'], plant_cajones_config: ['cajon_name'],
  plant_silos_config: ['silo_name', 'measurement_method'], plant_additives_config: ['additive_name', 'measurement_method'],
  plant_diesel_config: ['measurement_method'], plant_products_config: ['product_name', 'unit'],
  plant_utilities_meters_config: ['meter_name', 'meter_type', 'unit'],
  measurement_configs: ['capture_unit_id', 'calculation_unit_id', 'display_unit_id', 'inventory_unit_id'],
  silo_allowed_products: ['silo_config_id', 'product_name'],
};
function fail(sheet: Worksheet | string, row: number, column: string, message: string): never {
  throw Error(`${typeof sheet === 'string' ? sheet : sheet.name} · fila ${row} · columna ${column}: ${message}`);
}
function scalar(cell: Cell): string | number | boolean | null {
  const value = cell.value;
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) fail(cell.worksheet, cell.row, cell.address, 'Fecha inválida.');
    return value.toISOString();
  }
  if (typeof value === 'object') fail(cell.worksheet, cell.row, cell.address, 'Usa un valor directo. No se admiten fórmulas, errores, enlaces ni valores compuestos.');
  if (typeof value === 'number' && !Number.isFinite(value)) fail(cell.worksheet, cell.row, cell.address, 'Número inválido.');
  return value;
}
function blank(value: any) { return value === null || value === undefined || (typeof value === 'string' && value.trim() === ''); }
function parseValue(value: any, kind: ReturnType<typeof fieldKind>, sheet: Worksheet, line: number, label: string): any {
  if (blank(value)) return null;
  if (kind === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 1 || /^(sí|si|true|verdadero|yes|1)$/i.test(String(value).trim())) return true;
    if (value === 0 || /^(no|false|falso|0)$/i.test(String(value).trim())) return false;
    fail(sheet, line, label, 'Escribe Sí o No.');
  }
  if (kind === 'number' || kind === 'integer') {
    // Excel serializes small numeric cells in exponent notation. Expand numbers
    // without rounding; text cells must use an explicit exact decimal.
    let text = String(value).trim();
    if (typeof value === 'number' && /e/i.test(text)) {
      const [mantissa, exponent] = text.toLowerCase().split('e');
      const negative = mantissa.startsWith('-'), unsigned = mantissa.replace(/^[+-]/, '');
      const digits = unsigned.replace('.', ''), position = (unsigned.indexOf('.') < 0 ? unsigned.length : unsigned.indexOf('.')) + Number(exponent);
      text = (negative ? '-' : '') + (position <= 0 ? '0.' + '0'.repeat(-position) + digits : position >= digits.length ? digits + '0'.repeat(position - digits.length) : digits.slice(0, position) + '.' + digits.slice(position));
    }
    if (typeof value === 'boolean' || !/^[+-]?\d+(\.\d+)?$/.test(text) || !Number.isFinite(Number(text))) fail(sheet, line, label, 'Escribe un decimal válido con punto, sin separadores de miles.');
    if (typeof value === 'number' && typeof excelNumber(value) === 'string') fail(sheet, line, label, 'Este número excede la precisión de Excel. Escríbelo como texto exacto.');
    if (kind === 'integer') {
      if (!Number.isSafeInteger(Number(text))) fail(sheet, line, label, 'Escribe un entero válido.');
      return Number(text);
    }
    return text;
  }
  if (kind === 'date') {
    const text = String(value);
    if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(text) || !Number.isFinite(Date.parse(text))) fail(sheet, line, label, 'Usa una fecha válida AAAA-MM-DD.');
    return text.includes('T') ? text.slice(0, 10) : text;
  }
  if (typeof value !== 'string') fail(sheet, line, label, 'Escribe texto; conserva códigos e identificadores como texto.');
  return value;
}
function verifyHeaders(sheet: Worksheet, headers: string[]) {
  for (let column = 1; column <= headers.length; column++) {
    if (scalar(sheet.getCell(3, column)) !== headers[column - 1]) fail(sheet, 3, String(column), 'Falta un encabezado o cambió el orden de las columnas. Vuelve a exportar el archivo.');
  }
  if (sheet.columnCount > headers.length) {
    for (let column = headers.length + 1; column <= sheet.columnCount; column++) {
      if (sheet.getColumn(column).values.some(value => !blank(value))) fail(sheet, 3, String(column), 'Columna no soportada.');
    }
  }
}
function resolveReference(file: ConfigurationPackage, original: ConfigurationPackage, field: string, value: string, location: LocatedRow) {
  const candidates = referenceTables(field).flatMap(table => file.payload.tables[table].map(row => ({table, row})));
  const direct = candidates.filter(candidate => candidate.row.id === value);
  // Accept the exported label even when the referenced row was renamed in the same workbook.
  const aliases = referenceTables(field).flatMap(table => original.payload.tables[table]
    .filter(row => rowReferenceLabel(table, row, original) === value).map(row => ({table, id: row.id})));
  const matches = direct.length ? direct : candidates.filter(({table, row}) =>
    rowReferenceLabel(table, row, file) === value || [row.code, row.nombre, row.curve_name, row.silo_name, row.aggregate_name,
      row.cajon_name, row.additive_name, row.product_name, row.meter_name, row.name_es].includes(value)
    || aliases.some(alias => alias.table === table && alias.id === row.id));
  if (matches.length !== 1) fail(location.sheet, location.line, configurationFieldLabel(field),
    matches.length ? 'Referencia ambigua. Selecciona un nombre/código único.' : 'Referencia inexistente. Incluye la dependencia en el archivo.');
  return matches[0].row.id;
}
function validateEditedEquipment(file: ConfigurationPackage, original: ConfigurationPackage, location: LocatedRow) {
  const {table, row, sheet, line} = location;
  const before = original.payload.tables[table].find(candidate => candidate.id === row.id);
  const changed = (field: string) => !before || String(row[field] ?? '') !== String(before[field] ?? '');
  const reject = (field: string, message: string) => fail(sheet, line, configurationFieldLabel(field), message);
  const nonnegative = ['box_width_ft', 'box_height_ft', 'diameter', 'length', 'width', 'total_height', 'capacity',
    'diameter_in', 'total_height_in', 'cone_height_in', 'bottom_diameter_in', 'monthly_amount', 'initial_amount',
    'initial_inventory_gallons', 'tank_capacity_gallons', 'tank_capacity', 'unit_volume'];
  for (const field of nonnegative) if (changed(field) && !blank(row[field]) && Number(row[field]) < 0) reject(field, 'El valor no puede ser negativo.');
  for (const field of ['is_active', 'active', 'sort_order', 'decimal_precision']) {
    if (changed(field) && original.payload.schema[table].includes(field) && before && blank(row[field])) reject(field, 'Completa este campo.');
  }
  if (['factor', 'factor_to_base'].some(field => changed(field) && !blank(row[field]) && Number(row[field]) <= 0)) reject(table === 'units' ? 'factor_to_base' : 'factor', 'El factor debe ser mayor que cero.');
  if (table === 'plant_products_config' && ['DRUM', 'PAIL'].includes(row.measure_mode)
    && ['measure_mode', 'unit_volume'].some(changed) && !(Number(row.unit_volume) > 0)) reject('unit_volume', 'El volumen por envase debe ser mayor que cero.');
  if (table === 'plant_silos_config' && row.calculation_method === 'GEOMETRIC_CYLINDER_CONE'
    && ['calculation_method', 'diameter_in', 'total_height_in', 'cone_height_in', 'bottom_diameter_in', 'capacity_fraction', 'inventory_unit_id'].some(changed)) {
    for (const field of ['diameter_in', 'total_height_in']) if (!(Number(row[field]) > 0)) reject(field, 'Debe ser mayor que cero para el método geométrico.');
    if (Number(row.bottom_diameter_in) > Number(row.diameter_in)) reject('bottom_diameter_in', 'No puede exceder el diámetro superior.');
    if (!(Number(row.capacity_fraction) > 0 && Number(row.capacity_fraction) <= 1)) reject('capacity_fraction', 'La fracción debe ser mayor que 0 y menor o igual que 1.');
    if (blank(row.inventory_unit_id)) reject('inventory_unit_id', 'Selecciona la unidad de inventario.');
  }
  const usesCurve = row.calculation_method === 'CALIBRATION_CURVE' || row.measurement_method === 'CURVE' || row.measure_mode === 'TANK_READING'
    || (table === 'plant_diesel_config' && row.measurement_method === 'TANK_LEVEL');
  if (original.payload.schema[table].includes('calibration_curve_name')
    && (changed('calibration_curve_name') || (!before && usesCurve) || (usesCurve && ['calculation_method', 'measurement_method', 'measure_mode'].some(changed)))) {
    if (usesCurve && blank(row.calibration_curve_name)) reject('calibration_curve_name', 'Selecciona una curva existente.');
    if (!blank(row.calibration_curve_name)) {
      const curves = file.payload.tables.calibration_curves.filter(curve => curve.curve_name === row.calibration_curve_name);
      if (curves.length !== 1) reject('calibration_curve_name', 'La curva seleccionada no existe o es ambigua.');
      // Curve selection owns the embedded snapshot; never leave the previous
      // curve's protected JSON attached to a newly selected name.
      for (const field of ['conversion_table', 'calibration_table']) if (file.payload.json_fields[table].includes(field)) row[field] = curves[0].data_points;
    }
  }
}

/** Reads visible cells, then rebuilds a normal server package. Internal baseline is never applied instead of edits. */
export async function readConfigurationWorkbook(buffer: ArrayBuffer, signal?: AbortSignal): Promise<ExcelConfiguration[]> {
  checkCancellation(signal);
  if (buffer.byteLength > MAX_EXCEL_BYTES) throw Error('El archivo supera el máximo de 10 MB.');
  const ExcelJS = await import('exceljs');
  const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
  const workbook = new Workbook();
  try { await workbook.xlsx.load(buffer); } catch { throw Error('No se pudo leer el Excel. Carga un archivo .xlsx exportado por PROMIX.'); }
  checkCancellation(signal);
  const metadata = workbook.getWorksheet(METADATA_SHEET);
  if (!metadata) throw Error('Este Excel es documental o no es compatible. Vuelve a exportar las configuraciones para obtener un Excel editable.');
  if (scalar(metadata.getCell('A1')) !== EXCEL_FORMAT || scalar(metadata.getCell('B1')) !== EXCEL_VERSION) throw Error('La versión del Excel no es compatible. Vuelve a exportar las configuraciones.');
  if (metadata.rowCount > 2000 || metadata.columnCount > 2) throw Error('Los metadatos del Excel están dañados o exceden el límite.');
  const chunks: string[] = [];
  for (let line = 2; line <= metadata.rowCount; line++) {
    if (scalar(metadata.getCell(line, 1)) !== line - 1 || typeof scalar(metadata.getCell(line, 2)) !== 'string') fail(metadata, line, 'Contenido', 'Metadatos incompletos. Vuelve a exportar.');
    chunks.push(String(scalar(metadata.getCell(line, 2))));
  }
  if (chunks.reduce((length, chunk) => length + chunk.length, 0) > 30_000_000) throw Error('Los metadatos del Excel exceden el límite permitido.');
  let originals: ConfigurationPackage[];
  try {
    const parsed = decodeExcelBaseline(chunks.join(''));
    if (!Array.isArray(parsed) || !parsed.length || parsed.length > 100) throw Error('Número de plantas inválido.');
    originals = [];
    for (const candidate of parsed) { checkCancellation(signal); originals.push(await validateConfigurationPackage(candidate)); }
  } catch (error: any) { throw Error(`Los datos internos del Excel no son válidos: ${error.message}`); }
  if (new Set(originals.map(file => file.origin.plant_id)).size !== originals.length || new Set(originals.map(plantExcelLabel)).size !== originals.length) throw Error('El archivo contiene plantas de origen duplicadas o ambiguas.');
  const allowedSheets = new Set(['Resumen', 'Instrucciones', 'Parámetros de planta', METADATA_SHEET, OPTIONS_SHEET, ...CONFIG_TABLES.map(tableSheetName)]);
  for (const sheet of workbook.worksheets) {
    if (!allowedSheets.has(sheet.name)) throw Error(`Hoja no soportada: ${sheet.name}. Conserva las hojas del archivo exportado.`);
    if (sheet.rowCount > 50003 || sheet.columnCount > 256) throw Error(`La hoja ${sheet.name} excede el límite permitido.`);
  }
  for (const name of allowedSheets) if (!workbook.getWorksheet(name)) throw Error(`Falta la hoja ${name}. Vuelve a exportar el archivo.`);
  const files = originals.map(file => structuredClone(file));
  const locations = new Map<string, LocatedRow[]>();
  for (const file of files) { locations.set(file.origin.plant_id, []); for (const table of CONFIG_TABLES) file.payload.tables[table] = []; }
  for (const table of CONFIG_TABLES) {
    checkCancellation(signal);
    const sheet = workbook.getWorksheet(tableSheetName(table))!, columns = tableColumns(originals, table);
    verifyHeaders(sheet, ['Planta de origen', ...columns.map(configurationFieldLabel), 'Origen interno']);
    const seen = new Set<string>();
    for (let line = 4; line <= sheet.rowCount; line++) {
      const values = Array.from({length: columns.length + 2}, (_, index) => scalar(sheet.getCell(line, index + 1)));
      if (values.every(blank)) continue;
      const hiddenOrigin = values[columns.length + 1];
      const originIndex = originals.findIndex(file => hiddenOrigin ? file.origin.plant_id === hiddenOrigin : plantExcelLabel(file) === values[0]);
      if (originIndex < 0) fail(sheet, line, 'Planta de origen', 'Selecciona una planta de origen válida.');
      const original = originals[originIndex], file = files[originIndex];
      if (values[0] !== plantExcelLabel(original)) fail(sheet, line, 'Planta de origen', 'No cambies la planta de una fila existente; agrega una fila nueva.');
      const id = values[columns.indexOf('id') + 1];
      const before = blank(id) ? undefined : original.payload.tables[table].find(row => row.id === id);
      if (!blank(id) && !before) fail(sheet, line, 'Identificador', 'Identificador desconocido o alterado. Para agregar usa una fila vacía.');
      if (before && seen.has(`${original.origin.plant_id}:${id}`)) fail(sheet, line, 'Identificador', 'Identificador duplicado. Para agregar usa una fila vacía.');
      if (before) seen.add(`${original.origin.plant_id}:${id}`);
      if (!before && READ_ONLY_TABLES.has(table)) fail(sheet, line, 'Registro', 'Agrega o modifica curvas desde la pantalla de curvas del sistema.');
      const row = before ? structuredClone(before) : {id: crypto.randomUUID()};
      const location = {table, row, sheet, line, columns};
      for (const [index, field] of columns.entries()) {
        if (!original.payload.schema[table].includes(field)) {
          if (!blank(values[index + 1])) fail(sheet, line, configurationFieldLabel(field), 'Campo no disponible para esta planta.');
          continue;
        }
        const value = values[index + 1], previous = before?.[field];
        if (before && value === projectedCell(original, table, field, previous)) continue;
        if (readOnlyField(original, table, field)) {
          if (before || !blank(value)) fail(sheet, line, configurationFieldLabel(field), 'Campo protegido. Modifícalo desde el sistema.');
          continue;
        }
        if (!before && blank(value)) continue; // Let database defaults apply to new optional fields.
        row[field] = parseValue(value, fieldKind(original, table, field), sheet, line, configurationFieldLabel(field));
        const options = fieldOptions(table, field);
        if (options && row[field] !== null && !options.includes(row[field])) fail(sheet, line, configurationFieldLabel(field), 'Opción no permitida.');
      }
      if (!before) {
        if (original.payload.schema[table].includes('plant_id')) row.plant_id = original.origin.plant_id;
      }
      for (const field of requiredFields[table] || []) if (original.payload.schema[table].includes(field) && blank(row[field])) fail(sheet, line, configurationFieldLabel(field), 'Completa este campo.');
      file.payload.tables[table].push(row);locations.get(file.origin.plant_id)!.push(location);
    }
    // Removing protected curves/points is forbidden. Other relation omissions are
    // retained to avoid the server's authoritative relation replacement deleting them.
    for (const [index, original] of originals.entries()) {
      for (const row of original.payload.tables[table]) if (!seen.has(`${original.origin.plant_id}:${row.id}`)) {
        if (READ_ONLY_TABLES.has(table)) fail(sheet, 4, 'Registro', 'Faltan datos protegidos de curvas. Vuelve a exportar el archivo.');
        if (table === 'silo_allowed_products') files[index].payload.tables[table].push(structuredClone(row));
      }
    }
  }
  const parameters = workbook.getWorksheet('Parámetros de planta')!;
  verifyHeaders(parameters, ['Planta', 'Parámetro', 'Valor', 'Origen interno', 'Campo interno']);
  const seenParameters = new Set<string>();
  for (let line = 4; line <= parameters.rowCount; line++) {
    const values = Array.from({length: 5}, (_, index) => scalar(parameters.getCell(line, index + 1)));
    if (values.every(blank)) continue;
    const index = originals.findIndex(file => file.origin.plant_id === values[3]);
    const field = String(values[4]);
    if (index < 0 || !Object.hasOwn(PLANT_FIELDS, field)) fail(parameters, line, 'Parámetro', 'Parámetro de planta desconocido.');
    const original = originals[index], key = `${original.origin.plant_id}:${field}`;
    if (seenParameters.has(key)) fail(parameters, line, 'Parámetro', 'Parámetro duplicado.');
    seenParameters.add(key);
    if (values[0] !== plantExcelLabel(original) || values[1] !== PLANT_FIELDS[field as keyof typeof PLANT_FIELDS]) fail(parameters, line, 'Parámetro', 'No cambies la planta ni el nombre del parámetro.');
    const previous = original.payload.plant[field];
    const expected = previous == null ? null : field === 'petty_cash_established' ? excelNumber(previous) : previous ? 'Sí' : 'No';
    if (values[2] !== expected) files[index].payload.plant[field] = parseValue(values[2], field === 'petty_cash_established' ? 'number' : 'boolean', parameters, line, 'Valor');
    if (blank(files[index].payload.plant[field])) fail(parameters, line, 'Valor', 'Completa el parámetro de planta.');
    if (field === 'petty_cash_established' && Number(files[index].payload.plant[field]) < 0) fail(parameters, line, 'Valor', 'El monto no puede ser negativo.');
  }
  if (seenParameters.size !== files.length * Object.keys(PLANT_FIELDS).length) fail(parameters, 4, 'Parámetro', 'Faltan parámetros de planta.');
  const result: ExcelConfiguration[] = [];
  for (const [index, file] of files.entries()) {
    checkCancellation(signal);
    for (const location of locations.get(file.origin.plant_id)!) {
      for (const field of location.columns) if (referenceTables(field).length && !blank(location.row[field])) location.row[field] = resolveReference(file, originals[index], field, location.row[field], location);
      validateEditedEquipment(file, originals[index], location);
    }
    for (const table of CONFIG_TABLES) {
      const identities = new Set<string>();
      for (const row of file.payload.tables[table]) {
        const identity = JSON.stringify(IDENTITY_FIELDS[table].map(field => row[field] ?? (field === 'tank_name' ? '' : null)));
        if (identities.has(identity)) {
          const location = locations.get(file.origin.plant_id)!.find(location => location.table === table && location.row.id === row.id);
          fail(tableSheetName(table), location?.line || 4, 'Registro', 'Dos filas identifican el mismo elemento. Corrige el nombre, código o referencias duplicados.');
        }
        identities.add(identity);
      }
      // Row order is not a configuration edit. Preserve original order for exact roundtrips.
      const order = new Map(originals[index].payload.tables[table].map((row, position) => [row.id, position]));
      file.payload.tables[table].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
    }
    const modified = JSON.stringify(file.payload) !== JSON.stringify(originals[index].payload);
    const configuration = modified ? await createConfigurationPackage(file.payload, file.origin.environment, file.generated_at) : originals[index];
    result.push({configuration: await validateConfigurationPackage(configuration), modified});
  }
  checkCancellation(signal);
  return result;
}
