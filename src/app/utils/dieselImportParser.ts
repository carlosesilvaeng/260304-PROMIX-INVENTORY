import {
  DIESEL_IMPORT_COLUMNS,
  DIESEL_IMPORT_META_SHEET,
  DIESEL_IMPORT_MODULE,
  DIESEL_IMPORT_SHEET_NAME,
  DIESEL_IMPORT_TEMPLATE_VERSION,
  type DieselImportMeta,
} from './dieselImportWorkbook';

export interface ParsedDieselImportRow {
  row_number: number;
  measurement_method: string;
  calibration_curve_name: string;
  reading_uom: string;
  tank_capacity_gallons: string;
  initial_inventory_gallons: string;
  calibration_table_json: string;
  is_active: string;
}

export interface ParsedDieselImportFile {
  meta: DieselImportMeta;
  rows: ParsedDieselImportRow[];
}

function toCellString(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export async function parseDieselImportFile(file: File): Promise<ParsedDieselImportFile> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const dataSheet = workbook.Sheets[DIESEL_IMPORT_SHEET_NAME];
  if (!dataSheet) {
    throw new Error(`El archivo no contiene la hoja "${DIESEL_IMPORT_SHEET_NAME}".`);
  }

  const headerRows = XLSX.utils.sheet_to_json<(string | number)[]>(dataSheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });

  const expectedHeaders = DIESEL_IMPORT_COLUMNS.map((column) => column.label);
  const actualHeaders = (headerRows[0] || []).map((value) => toCellString(value));

  if (expectedHeaders.length !== actualHeaders.length || expectedHeaders.some((header, index) => header !== actualHeaders[index])) {
    throw new Error('Los encabezados de la hoja Datos no coinciden con la plantilla oficial.');
  }

  const rows: ParsedDieselImportRow[] = [];
  headerRows.slice(1).forEach((rowValues, index) => {
    const normalized = DIESEL_IMPORT_COLUMNS.reduce((acc, column, columnIndex) => {
      acc[column.key] = toCellString(rowValues[columnIndex]);
      return acc;
    }, {} as Record<string, string>);

    const isEmptyRow = Object.values(normalized).every((value) => !String(value || '').trim());
    if (isEmptyRow) return;

    rows.push({
      row_number: index + 2,
      measurement_method: normalized.measurement_method || '',
      calibration_curve_name: normalized.calibration_curve_name || '',
      reading_uom: normalized.reading_uom || '',
      tank_capacity_gallons: normalized.tank_capacity_gallons || '',
      initial_inventory_gallons: normalized.initial_inventory_gallons || '',
      calibration_table_json: normalized.calibration_table_json || '',
      is_active: normalized.is_active || '',
    });
  });

  const metaSheet = workbook.Sheets[DIESEL_IMPORT_META_SHEET];
  if (!metaSheet) {
    throw new Error('El archivo no contiene metadata de plantilla. Genera una plantilla nueva desde el sistema.');
  }

  const metaRows = XLSX.utils.sheet_to_json<(string | number)[]>(metaSheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });

  const metaMap = metaRows.reduce((acc, row) => {
    const key = toCellString(row[0]);
    const value = toCellString(row[1]);
    if (key) acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  if (metaMap.module !== DIESEL_IMPORT_MODULE) {
    throw new Error('La plantilla no corresponde al modulo de Diesel.');
  }

  if (metaMap.template_version !== DIESEL_IMPORT_TEMPLATE_VERSION) {
    throw new Error('La version de la plantilla no es compatible. Genera una plantilla nueva desde el sistema.');
  }

  const meta: DieselImportMeta = {
    template_type: metaMap.template_type === 'current_config' ? 'current_config' : 'blank',
    module: DIESEL_IMPORT_MODULE,
    template_version: DIESEL_IMPORT_TEMPLATE_VERSION,
    plant_id: metaMap.plant_id || '',
    plant_name: metaMap.plant_name || '',
    generated_at: metaMap.generated_at || '',
  };

  if (!meta.plant_id) {
    throw new Error('La plantilla no indica la planta destino.');
  }

  return { meta, rows };
}
