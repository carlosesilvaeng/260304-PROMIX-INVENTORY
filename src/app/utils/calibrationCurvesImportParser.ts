import {
  CALIBRATION_CURVES_IMPORT_COLUMNS,
  CALIBRATION_CURVES_IMPORT_META_SHEET,
  CALIBRATION_CURVES_IMPORT_MODULE,
  CALIBRATION_CURVES_IMPORT_SHEET_NAME,
  CALIBRATION_CURVES_IMPORT_TEMPLATE_VERSION,
  type CalibrationCurvesImportMeta,
} from './calibrationCurvesImportWorkbook';

export interface ParsedCalibrationCurvesImportRow {
  row_number: number;
  curve_name: string;
  measurement_type: string;
  reading_uom: string;
  data_points_json: string;
}

export interface ParsedCalibrationCurvesImportFile {
  meta: CalibrationCurvesImportMeta;
  rows: ParsedCalibrationCurvesImportRow[];
}

function toCellString(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export async function parseCalibrationCurvesImportFile(file: File): Promise<ParsedCalibrationCurvesImportFile> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const dataSheet = workbook.Sheets[CALIBRATION_CURVES_IMPORT_SHEET_NAME];
  if (!dataSheet) {
    throw new Error(`El archivo no contiene la hoja "${CALIBRATION_CURVES_IMPORT_SHEET_NAME}".`);
  }

  const headerRows = XLSX.utils.sheet_to_json<(string | number)[]>(dataSheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });

  const expectedHeaders = CALIBRATION_CURVES_IMPORT_COLUMNS.map((column) => column.label);
  const actualHeaders = (headerRows[0] || []).map((value) => toCellString(value));

  if (expectedHeaders.length !== actualHeaders.length || expectedHeaders.some((header, index) => header !== actualHeaders[index])) {
    throw new Error('Los encabezados de la hoja Datos no coinciden con la plantilla oficial.');
  }

  const rows: ParsedCalibrationCurvesImportRow[] = [];
  headerRows.slice(1).forEach((rowValues, index) => {
    const normalized = CALIBRATION_CURVES_IMPORT_COLUMNS.reduce((acc, column, columnIndex) => {
      acc[column.key] = toCellString(rowValues[columnIndex]);
      return acc;
    }, {} as Record<string, string>);

    if (Object.values(normalized).every((value) => !value)) return;

    rows.push({
      row_number: index + 2,
      curve_name: normalized.curve_name || '',
      measurement_type: normalized.measurement_type || '',
      reading_uom: normalized.reading_uom || '',
      data_points_json: normalized.data_points_json || '',
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

  return { meta, rows };
}
