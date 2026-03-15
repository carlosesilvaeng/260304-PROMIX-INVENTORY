import {
  SILOS_IMPORT_COLUMNS,
  SILOS_IMPORT_META_SHEET,
  SILOS_IMPORT_MODULE,
  SILOS_IMPORT_SHEET_NAME,
  SILOS_IMPORT_TEMPLATE_VERSION,
  type SilosImportMeta,
} from './silosImportWorkbook';

export interface ParsedSilosImportRow {
  row_number: number;
  silo_name: string;
  measurement_method: string;
  allowed_products: string;
  is_active: string;
}

export interface ParsedSilosImportFile {
  meta: SilosImportMeta;
  rows: ParsedSilosImportRow[];
}

function toCellString(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export async function parseSilosImportFile(file: File): Promise<ParsedSilosImportFile> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const dataSheet = workbook.Sheets[SILOS_IMPORT_SHEET_NAME];
  if (!dataSheet) {
    throw new Error(`El archivo no contiene la hoja "${SILOS_IMPORT_SHEET_NAME}".`);
  }

  const headerRows = XLSX.utils.sheet_to_json<(string | number)[]>(dataSheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });

  const expectedHeaders = SILOS_IMPORT_COLUMNS.map((column) => column.label);
  const actualHeaders = (headerRows[0] || []).map((value) => toCellString(value));

  if (expectedHeaders.length !== actualHeaders.length || expectedHeaders.some((header, index) => header !== actualHeaders[index])) {
    throw new Error('Los encabezados de la hoja Datos no coinciden con la plantilla oficial.');
  }

  const rows: ParsedSilosImportRow[] = [];
  headerRows.slice(1).forEach((rowValues, index) => {
    const normalized = SILOS_IMPORT_COLUMNS.reduce((acc, column, columnIndex) => {
      acc[column.key] = toCellString(rowValues[columnIndex]);
      return acc;
    }, {} as Record<string, string>);

    const isEmptyRow = Object.values(normalized).every((value) => !String(value || '').trim());
    if (isEmptyRow) return;

    rows.push({
      row_number: index + 2,
      silo_name: normalized.silo_name || '',
      measurement_method: normalized.measurement_method || '',
      allowed_products: normalized.allowed_products || '',
      is_active: normalized.is_active || '',
    });
  });

  const metaSheet = workbook.Sheets[SILOS_IMPORT_META_SHEET];
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

  if (metaMap.module !== SILOS_IMPORT_MODULE) {
    throw new Error('La plantilla no corresponde al modulo de Silos.');
  }

  if (metaMap.template_version !== SILOS_IMPORT_TEMPLATE_VERSION) {
    throw new Error('La version de la plantilla no es compatible. Genera una plantilla nueva desde el sistema.');
  }

  const meta: SilosImportMeta = {
    template_type: metaMap.template_type === 'current_config' ? 'current_config' : 'blank',
    module: SILOS_IMPORT_MODULE,
    template_version: SILOS_IMPORT_TEMPLATE_VERSION,
    plant_id: metaMap.plant_id || '',
    plant_name: metaMap.plant_name || '',
    generated_at: metaMap.generated_at || '',
  };

  if (!meta.plant_id) {
    throw new Error('La plantilla no indica la planta destino.');
  }

  return { meta, rows };
}
