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
  depth_inches: string;
  volume_gallons: string;
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

function normalizeHeader(value: unknown) {
  return toCellString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function findHeaderIndex(headers: unknown[], candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeHeader);
  return headers.findIndex((header) => normalizedCandidates.includes(normalizeHeader(header)));
}

function parseExternalTechnicalTable(workbook: any): ParsedDieselImportFile | null {
  const XLSX = workbook.__xlsx;
  const sheetName = workbook.SheetNames.find((name: string) => normalizeHeader(name) === 'TABLA') || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return null;

  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });

  const headerIndex = rows.findIndex((row) => {
    const depthIndex = findHeaderIndex(row, ['PROF. H (in)', 'PROF H (in)', 'PROFUNDIDAD H (in)']);
    const volumeIndex = findHeaderIndex(row, ['VOL. (GAL)', 'VOL (GAL)', 'VOLUMEN GALONES', 'VOLUMEN (GAL)']);
    return depthIndex >= 0 && volumeIndex >= 0;
  });

  if (headerIndex < 0) return null;

  const headerRow = rows[headerIndex];
  const depthIndex = findHeaderIndex(headerRow, ['PROF. H (in)', 'PROF H (in)', 'PROFUNDIDAD H (in)']);
  const volumeIndex = findHeaderIndex(headerRow, ['VOL. (GAL)', 'VOL (GAL)', 'VOLUMEN GALONES', 'VOLUMEN (GAL)']);
  const dataRows: ParsedDieselImportRow[] = [];

  rows.slice(headerIndex + 1).forEach((rowValues, index) => {
    const depth = toCellString(rowValues[depthIndex]);
    const volume = toCellString(rowValues[volumeIndex]).replace(/,/g, '');
    if (!depth && !volume) return;

    dataRows.push({
      row_number: headerIndex + index + 2,
      measurement_method: 'TANK_LEVEL',
      calibration_curve_name: '',
      reading_uom: 'inches',
      tank_capacity_gallons: '',
      initial_inventory_gallons: '',
      depth_inches: depth,
      volume_gallons: volume,
      is_active: 'Sí',
    });
  });

  if (dataRows.length === 0) return null;

  const inferredPlantName = rows
    .flat()
    .map(toCellString)
    .find((value) => /Planta:/i.test(value))
    ?.replace(/^.*Planta:\s*/i, '')
    .trim() || '';

  return {
    meta: {
      template_type: 'blank',
      module: DIESEL_IMPORT_MODULE,
      template_version: DIESEL_IMPORT_TEMPLATE_VERSION,
      plant_id: '',
      plant_name: inferredPlantName,
      generated_at: '',
    },
    rows: dataRows,
  };
}

export async function parseDieselImportFile(file: File): Promise<ParsedDieselImportFile> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  (workbook as any).__xlsx = XLSX;

  const dataSheet = workbook.Sheets[DIESEL_IMPORT_SHEET_NAME];
  if (!dataSheet) {
    const parsedExternal = parseExternalTechnicalTable(workbook);
    if (parsedExternal) return parsedExternal;
    throw new Error(`El archivo no contiene la hoja "${DIESEL_IMPORT_SHEET_NAME}" ni una hoja técnica "Tabla" con PROF. H (in) y VOL. (GAL).`);
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
      depth_inches: normalized.depth_inches || '',
      volume_gallons: normalized.volume_gallons || '',
      is_active: normalized.is_active || '',
    });
  });

  const metaSheet = workbook.Sheets[DIESEL_IMPORT_META_SHEET];
  if (!metaSheet) {
    const parsedExternal = parseExternalTechnicalTable(workbook);
    if (parsedExternal) return parsedExternal;
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
