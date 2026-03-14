import {
  PRODUCTS_IMPORT_COLUMNS,
  PRODUCTS_IMPORT_META_SHEET,
  PRODUCTS_IMPORT_MODULE,
  PRODUCTS_IMPORT_SHEET_NAME,
  PRODUCTS_IMPORT_TEMPLATE_VERSION,
  type ProductsImportMeta,
} from './productsImportWorkbook';

export interface ParsedProductsImportRow {
  row_number: number;
  product_name: string;
  category: string;
  measure_mode: string;
  uom: string;
  requires_photo: string;
  reading_uom: string;
  tank_capacity: string;
  unit_volume: string;
  calibration_table_json: string;
  notes: string;
  is_active: string;
}

export interface ParsedProductsImportFile {
  meta: ProductsImportMeta;
  rows: ParsedProductsImportRow[];
}

function toCellString(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export async function parseProductsImportFile(file: File): Promise<ParsedProductsImportFile> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const dataSheet = workbook.Sheets[PRODUCTS_IMPORT_SHEET_NAME];
  if (!dataSheet) {
    throw new Error(`El archivo no contiene la hoja "${PRODUCTS_IMPORT_SHEET_NAME}".`);
  }

  const headerRows = XLSX.utils.sheet_to_json<(string | number)[]>(dataSheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });

  const expectedHeaders = PRODUCTS_IMPORT_COLUMNS.map((column) => column.label);
  const actualHeaders = (headerRows[0] || []).map((value) => toCellString(value));

  if (expectedHeaders.length !== actualHeaders.length || expectedHeaders.some((header, index) => header !== actualHeaders[index])) {
    throw new Error('Los encabezados de la hoja Datos no coinciden con la plantilla oficial.');
  }

  const dataRows = headerRows.slice(1);
  const rows: ParsedProductsImportRow[] = [];

  dataRows.forEach((rowValues, index) => {
    const normalized = PRODUCTS_IMPORT_COLUMNS.reduce((acc, column, columnIndex) => {
      acc[column.key] = toCellString(rowValues[columnIndex]);
      return acc;
    }, {} as Record<string, string>);

    const isEmptyRow = Object.values(normalized).every((value) => !String(value || '').trim());
    if (isEmptyRow) return;

    rows.push({
      row_number: index + 2,
      product_name: normalized.product_name || '',
      category: normalized.category || '',
      measure_mode: normalized.measure_mode || '',
      uom: normalized.uom || '',
      requires_photo: normalized.requires_photo || '',
      reading_uom: normalized.reading_uom || '',
      tank_capacity: normalized.tank_capacity || '',
      unit_volume: normalized.unit_volume || '',
      calibration_table_json: normalized.calibration_table_json || '',
      notes: normalized.notes || '',
      is_active: normalized.is_active || '',
    });
  });

  const metaSheet = workbook.Sheets[PRODUCTS_IMPORT_META_SHEET];
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

  if (metaMap.module !== PRODUCTS_IMPORT_MODULE) {
    throw new Error('La plantilla no corresponde al modulo de Aceites y productos.');
  }

  if (metaMap.template_version !== PRODUCTS_IMPORT_TEMPLATE_VERSION) {
    throw new Error('La version de la plantilla no es compatible. Genera una plantilla nueva desde el sistema.');
  }

  const meta: ProductsImportMeta = {
    template_type: metaMap.template_type === 'current_config' ? 'current_config' : 'blank',
    module: PRODUCTS_IMPORT_MODULE,
    template_version: PRODUCTS_IMPORT_TEMPLATE_VERSION,
    plant_id: metaMap.plant_id || '',
    plant_name: metaMap.plant_name || '',
    generated_at: metaMap.generated_at || '',
  };

  if (!meta.plant_id) {
    throw new Error('La plantilla no indica la planta destino.');
  }

  return { meta, rows };
}
