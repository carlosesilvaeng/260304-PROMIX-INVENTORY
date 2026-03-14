import {
  AGGREGATES_IMPORT_COLUMNS,
  AGGREGATES_IMPORT_META_SHEET,
  AGGREGATES_IMPORT_MODULE,
  AGGREGATES_IMPORT_SHEET_NAME,
  AGGREGATES_IMPORT_TEMPLATE_VERSION,
  type AggregatesImportMeta,
} from './aggregatesImportWorkbook';

export interface ParsedAggregatesImportRow {
  row_number: number;
  aggregate_name: string;
  material_type: string;
  location_area: string;
  measurement_method: string;
  unit: string;
  box_width_ft: string;
  box_height_ft: string;
  is_active: string;
}

export interface ParsedAggregatesImportFile {
  meta: AggregatesImportMeta;
  rows: ParsedAggregatesImportRow[];
}

function toCellString(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export async function parseAggregatesImportFile(file: File): Promise<ParsedAggregatesImportFile> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const dataSheet = workbook.Sheets[AGGREGATES_IMPORT_SHEET_NAME];
  if (!dataSheet) {
    throw new Error(`El archivo no contiene la hoja "${AGGREGATES_IMPORT_SHEET_NAME}".`);
  }

  const headerRows = XLSX.utils.sheet_to_json<(string | number)[]>(dataSheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });

  const expectedHeaders = AGGREGATES_IMPORT_COLUMNS.map((column) => column.label);
  const actualHeaders = (headerRows[0] || []).map((value) => toCellString(value));

  if (expectedHeaders.length !== actualHeaders.length || expectedHeaders.some((header, index) => header !== actualHeaders[index])) {
    throw new Error('Los encabezados de la hoja Datos no coinciden con la plantilla oficial.');
  }

  const dataRows = headerRows.slice(1);
  const rows: ParsedAggregatesImportRow[] = [];

  dataRows.forEach((rowValues, index) => {
    const normalized = AGGREGATES_IMPORT_COLUMNS.reduce((acc, column, columnIndex) => {
      acc[column.key] = toCellString(rowValues[columnIndex]);
      return acc;
    }, {} as Record<string, string>);

    const isEmptyRow = Object.values(normalized).every((value) => !String(value || '').trim());
    if (isEmptyRow) return;

    rows.push({
      row_number: index + 2,
      aggregate_name: normalized.aggregate_name || '',
      material_type: normalized.material_type || '',
      location_area: normalized.location_area || '',
      measurement_method: normalized.measurement_method || '',
      unit: normalized.unit || '',
      box_width_ft: normalized.box_width_ft || '',
      box_height_ft: normalized.box_height_ft || '',
      is_active: normalized.is_active || '',
    });
  });

  const metaSheet = workbook.Sheets[AGGREGATES_IMPORT_META_SHEET];
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

  if (metaMap.module !== AGGREGATES_IMPORT_MODULE) {
    throw new Error('La plantilla no corresponde al modulo de Agregados.');
  }

  if (metaMap.template_version !== AGGREGATES_IMPORT_TEMPLATE_VERSION) {
    throw new Error('La version de la plantilla no es compatible. Genera una plantilla nueva desde el sistema.');
  }

  const meta: AggregatesImportMeta = {
    template_type: metaMap.template_type === 'current_config' ? 'current_config' : 'blank',
    module: AGGREGATES_IMPORT_MODULE,
    template_version: AGGREGATES_IMPORT_TEMPLATE_VERSION,
    plant_id: metaMap.plant_id || '',
    plant_name: metaMap.plant_name || '',
    generated_at: metaMap.generated_at || '',
  };

  if (!meta.plant_id) {
    throw new Error('La plantilla no indica la planta destino.');
  }

  return { meta, rows };
}
