import {
  CALIBRATION_CURVES_IMPORT_CURVES_SHEET,
  CALIBRATION_CURVES_IMPORT_CURVE_COLUMNS,
  CALIBRATION_CURVES_IMPORT_META_SHEET,
  CALIBRATION_CURVES_IMPORT_MODULE,
  CALIBRATION_CURVES_IMPORT_POINTS_SHEET,
  CALIBRATION_CURVES_IMPORT_POINT_COLUMNS,
  CALIBRATION_CURVES_IMPORT_TEMPLATE_VERSION,
  type CalibrationCurvesImportMeta,
} from './calibrationCurvesImportWorkbook';

export interface ParsedCalibrationCurvesImportCurveRow {
  row_number: number;
  curve_name: string;
  measurement_type: string;
  reading_uom: string;
}

export interface ParsedCalibrationCurvesImportPointRow {
  row_number: number;
  curve_name: string;
  point_key: string;
  point_value: string;
  available_gallons: string;
  consumed_gallons: string;
  percentage: string;
  status: string;
}

export interface ParsedCalibrationCurvesImportFile {
  meta: CalibrationCurvesImportMeta;
  curves: ParsedCalibrationCurvesImportCurveRow[];
  points: ParsedCalibrationCurvesImportPointRow[];
}

function toCellString(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function ensureHeaders(actual: string[], expected: string[], sheetName: string) {
  if (expected.length !== actual.length || expected.some((header, index) => header !== actual[index])) {
    throw new Error(`Los encabezados de la hoja ${sheetName} no coinciden con la plantilla oficial.`);
  }
}

function findHeaderRow(rows: unknown[][], requiredHeaders: string[]) {
  return rows.findIndex((row) => {
    const normalized = row.map((value) => toCellString(value).toLowerCase());
    return requiredHeaders.every((header) => normalized.some((value) => value.includes(header.toLowerCase())));
  });
}

function findHeaderIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.some((alias) => header === alias || header.includes(alias)));
}

function getMetadataValue(rows: unknown[][], label: string) {
  const labelKey = label.toLowerCase();
  for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex += 1) {
    const row = rows[rowIndex];
    const columnIndex = row.findIndex((value) => toCellString(value).toLowerCase() === labelKey);
    if (columnIndex >= 0) {
      const nextRowValue = toCellString(rows[rowIndex + 1]?.[columnIndex]);
      const sameRowValue = toCellString(row[columnIndex + 1]);
      return nextRowValue || sameRowValue;
    }
  }
  return '';
}

function normalizePercentCell(value: unknown) {
  const rawValue = toCellString(value);
  if (!rawValue) return '';
  if (rawValue.endsWith('%')) return rawValue.slice(0, -1).trim();
  return rawValue;
}

function parseSingleSheetTankCurve(workbook: any): ParsedCalibrationCurvesImportFile | null {
  const XLSX = workbook.__xlsx;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
      blankrows: false,
      raw: false,
    });
    const headerRowIndex = findHeaderRow(rows, ['Nivel', 'porcentaje', 'status']);
    if (headerRowIndex < 0) continue;

    const plantName = getMetadataValue(rows, 'Planta');
    const tankName = getMetadataValue(rows, 'Nombre') || sheetName.trim();
    const curveName = tankName.trim().replace(/\s+/g, '_').toUpperCase();
    const headers = rows[headerRowIndex].map((value) => toCellString(value).toLowerCase());
    const levelIndex = headers.findIndex((header) => header.startsWith('nivel'));
    const availableIndex = findHeaderIndex(headers, ['galones disponibles', 'volumen disponible', 'volume disponible', 'vol. disponible']);
    const consumedIndex = findHeaderIndex(headers, ['galones consumidos', 'volumen consumido', 'volume consumido', 'vol. consumido']);
    const percentageIndex = findHeaderIndex(headers, ['porcentaje', '%']);
    const statusIndex = findHeaderIndex(headers, ['status']);
    if ([levelIndex, availableIndex, consumedIndex, percentageIndex, statusIndex].some((index) => index < 0)) continue;

    const points = rows.slice(headerRowIndex + 1).map((rowValues, index) => {
      const point_key = toCellString(rowValues[levelIndex]);
      const available_gallons = toCellString(rowValues[availableIndex]);
      const consumed_gallons = toCellString(rowValues[consumedIndex]);
      const percentage = normalizePercentCell(rowValues[percentageIndex]);
      const status = toCellString(rowValues[statusIndex]);
      return {
        row_number: headerRowIndex + index + 2,
        curve_name: curveName,
        point_key,
        point_value: available_gallons,
        available_gallons,
        consumed_gallons,
        percentage,
        status,
      };
    }).filter((point) => [point.point_key, point.available_gallons, point.consumed_gallons, point.percentage, point.status].some(Boolean));

    if (points.length === 0) continue;

    return {
      meta: {
        template_type: 'blank',
        module: CALIBRATION_CURVES_IMPORT_MODULE,
        template_version: CALIBRATION_CURVES_IMPORT_TEMPLATE_VERSION,
        plant_id: '',
        plant_name: plantName,
        generated_at: '',
      },
      curves: [{
        row_number: 3,
        curve_name: curveName,
        measurement_type: headers[availableIndex]?.includes('volumen') || headers[availableIndex]?.includes('volume') || headers[availableIndex]?.includes('vol.')
          ? 'SILO_LEVEL'
          : 'TANK_LEVEL',
        reading_uom: 'inches',
      }],
      points,
    };
  }

  return null;
}

export async function parseCalibrationCurvesImportFile(file: File): Promise<ParsedCalibrationCurvesImportFile> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  (workbook as any).__xlsx = XLSX;

  const curvesSheet = workbook.Sheets[CALIBRATION_CURVES_IMPORT_CURVES_SHEET];
  if (!curvesSheet) {
    const singleSheetCurve = parseSingleSheetTankCurve(workbook);
    if (singleSheetCurve) return singleSheetCurve;
    throw new Error(`El archivo no contiene la hoja "${CALIBRATION_CURVES_IMPORT_CURVES_SHEET}".`);
  }

  const pointsSheet = workbook.Sheets[CALIBRATION_CURVES_IMPORT_POINTS_SHEET];
  if (!pointsSheet) {
    throw new Error(`El archivo no contiene la hoja "${CALIBRATION_CURVES_IMPORT_POINTS_SHEET}".`);
  }

  const curveRowsRaw = XLSX.utils.sheet_to_json<(string | number)[]>(curvesSheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });
  const pointRowsRaw = XLSX.utils.sheet_to_json<(string | number)[]>(pointsSheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });

  ensureHeaders(
    (curveRowsRaw[0] || []).map((value) => toCellString(value)),
    CALIBRATION_CURVES_IMPORT_CURVE_COLUMNS.map((column) => column.label),
    CALIBRATION_CURVES_IMPORT_CURVES_SHEET,
  );
  ensureHeaders(
    (pointRowsRaw[0] || []).map((value) => toCellString(value)),
    CALIBRATION_CURVES_IMPORT_POINT_COLUMNS.map((column) => column.label),
    CALIBRATION_CURVES_IMPORT_POINTS_SHEET,
  );

  const curves: ParsedCalibrationCurvesImportCurveRow[] = [];
  curveRowsRaw.slice(1).forEach((rowValues, index) => {
    const curve_name = toCellString(rowValues[0]);
    const measurement_type = toCellString(rowValues[1]);
    const reading_uom = toCellString(rowValues[2]);

    if (![curve_name, measurement_type, reading_uom].some(Boolean)) return;

    curves.push({
      row_number: index + 2,
      curve_name,
      measurement_type,
      reading_uom,
    });
  });

  const points: ParsedCalibrationCurvesImportPointRow[] = [];
  pointRowsRaw.slice(1).forEach((rowValues, index) => {
    const curve_name = toCellString(rowValues[0]);
    const point_key = toCellString(rowValues[1]);
    const available_gallons = toCellString(rowValues[2]);
    const consumed_gallons = toCellString(rowValues[3]);
    const percentage = normalizePercentCell(rowValues[4]);
    const status = toCellString(rowValues[5]);
    const point_value = available_gallons;

    if (![curve_name, point_key, available_gallons, consumed_gallons, percentage, status].some(Boolean)) return;

    points.push({
      row_number: index + 2,
      curve_name,
      point_key,
      point_value,
      available_gallons,
      consumed_gallons,
      percentage,
      status,
    });
  });

  const metaSheet = workbook.Sheets[CALIBRATION_CURVES_IMPORT_META_SHEET];
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

  if (metaMap.module !== CALIBRATION_CURVES_IMPORT_MODULE) {
    throw new Error('La plantilla no corresponde al catálogo de Curvas de conversión.');
  }

  if (metaMap.template_version !== CALIBRATION_CURVES_IMPORT_TEMPLATE_VERSION) {
    throw new Error('La versión de la plantilla no es compatible. Genera una plantilla nueva desde el sistema.');
  }

  const meta: CalibrationCurvesImportMeta = {
    template_type: metaMap.template_type === 'current_config' ? 'current_config' : 'blank',
    module: CALIBRATION_CURVES_IMPORT_MODULE,
    template_version: CALIBRATION_CURVES_IMPORT_TEMPLATE_VERSION,
    plant_id: metaMap.plant_id || '',
    plant_name: metaMap.plant_name || '',
    generated_at: metaMap.generated_at || '',
  };

  if (!meta.plant_id) {
    throw new Error('La plantilla no indica la planta destino.');
  }

  return { meta, curves, points };
}
