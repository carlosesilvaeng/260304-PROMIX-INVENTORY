import * as XLSX from 'xlsx';
import type { Plant } from '../contexts/AuthContext';

export const CALIBRATION_CURVES_IMPORT_TEMPLATE_VERSION = '3.0';
export const CALIBRATION_CURVES_IMPORT_MODULE = 'calibration_curves';
export const CALIBRATION_CURVES_IMPORT_CURVES_SHEET = 'Curvas';
export const CALIBRATION_CURVES_IMPORT_POINTS_SHEET = 'Puntos';
export const CALIBRATION_CURVES_IMPORT_INSTRUCTIONS_SHEET = 'Instrucciones';
export const CALIBRATION_CURVES_IMPORT_META_SHEET = 'Meta';

export interface CalibrationCurveWorkbookPoint {
  point_key: number;
  point_value: number;
  available_gallons?: number | null;
  consumed_gallons?: number | null;
  percentage?: number | null;
  status?: string | null;
}

export interface CalibrationCurvesImportWorkbookRow {
  curve_name: string;
  measurement_type: string;
  reading_uom?: string | null;
  points: CalibrationCurveWorkbookPoint[];
}

export interface CalibrationCurvesImportMeta {
  template_type: 'blank' | 'current_config';
  module: typeof CALIBRATION_CURVES_IMPORT_MODULE;
  template_version: typeof CALIBRATION_CURVES_IMPORT_TEMPLATE_VERSION;
  plant_id: string;
  plant_name: string;
  generated_at: string;
}

type ColumnDefinition = {
  key: string;
  label: string;
  width: number;
};

export const CALIBRATION_CURVES_IMPORT_CURVE_COLUMNS: ColumnDefinition[] = [
  { key: 'curve_name', label: 'Nombre de curva', width: 30 },
  { key: 'measurement_type', label: 'Metodo de medicion', width: 22 },
  { key: 'reading_uom', label: 'Unidad de lectura', width: 20 },
];

export const CALIBRATION_CURVES_IMPORT_POINT_COLUMNS: ColumnDefinition[] = [
  { key: 'curve_name', label: 'Nombre de curva', width: 30 },
  { key: 'point_key', label: 'Nivel', width: 14 },
  { key: 'available_gallons', label: 'Galones disponibles', width: 22 },
  { key: 'consumed_gallons', label: 'Galones consumidos', width: 22 },
  { key: 'percentage', label: 'Porcentaje', width: 16 },
  { key: 'status', label: 'Status', width: 18 },
];

function sortPoints(points: CalibrationCurveWorkbookPoint[]) {
  return [...points].sort((left, right) => left.point_key - right.point_key);
}

function downloadBuffer(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildInstructionRows(meta: CalibrationCurvesImportMeta) {
  return [
    ['Modulo', 'Curvas de conversión'],
    ['Planta', meta.plant_name],
    ['Archivo', meta.template_type === 'blank' ? 'Plantilla en blanco' : 'Curvas actuales exportadas'],
    ['Version de plantilla', meta.template_version],
    ['Generado', new Date(meta.generated_at).toLocaleString('es-PR')],
    ['', ''],
    ['Reglas generales', ''],
    ['1', 'No cambies los encabezados de las hojas Curvas y Puntos.'],
    ['2', 'La plantilla solo aplica a esta planta.'],
    ['3', 'La importación trabaja en modo upsert por Nombre de curva.'],
    ['4', 'Cada curva en la hoja Curvas debe tener al menos un punto en la hoja Puntos.'],
    ['5', 'Cada fila de la hoja Puntos debe referenciar una curva existente en la hoja Curvas.'],
    ['6', 'Nivel y Galones disponibles deben ser numéricos.'],
    ['7', 'No se permiten niveles duplicados dentro de la misma curva.'],
    ['8', 'La importación no elimina curvas faltantes del archivo.'],
    ['9', 'Si una curva ya es usada por diesel o aditivos, el preview avisará y esas configuraciones se resincronizarán con la nueva tabla al ejecutar la importación.'],
  ];
}

function createSheet(rows: (string | number | null | undefined)[][], columns: ColumnDefinition[]) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = columns.map((column) => ({ wch: column.width }));
  return worksheet;
}

export async function downloadCalibrationCurvesImportWorkbook(options: {
  plant: Plant;
  rows: CalibrationCurvesImportWorkbookRow[];
  templateType: 'blank' | 'current_config';
}) {
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: 'PROMIX Curvas de conversión',
    Author: 'PROMIX Plant Inventory',
    CreatedDate: new Date(),
  };

  const meta: CalibrationCurvesImportMeta = {
    template_type: options.templateType,
    module: CALIBRATION_CURVES_IMPORT_MODULE,
    template_version: CALIBRATION_CURVES_IMPORT_TEMPLATE_VERSION,
    plant_id: options.plant.id,
    plant_name: options.plant.name,
    generated_at: new Date().toISOString(),
  };

  const curveRows = [
    CALIBRATION_CURVES_IMPORT_CURVE_COLUMNS.map((column) => column.label),
    ...options.rows.map((rowValues) => [
      rowValues.curve_name || '',
      rowValues.measurement_type || '',
      rowValues.reading_uom || '',
    ]),
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(curveRows, CALIBRATION_CURVES_IMPORT_CURVE_COLUMNS),
    CALIBRATION_CURVES_IMPORT_CURVES_SHEET,
  );

  const pointRows = [
    CALIBRATION_CURVES_IMPORT_POINT_COLUMNS.map((column) => column.label),
    ...options.rows.flatMap((curve) => sortPoints(curve.points || []).map((point) => [
      curve.curve_name || '',
      point.point_key,
      point.available_gallons ?? point.point_value,
      point.consumed_gallons ?? '',
      point.percentage ?? '',
      point.status || '',
    ])),
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(pointRows, CALIBRATION_CURVES_IMPORT_POINT_COLUMNS),
    CALIBRATION_CURVES_IMPORT_POINTS_SHEET,
  );

  const instructionRows = [
    [`Importacion de curvas - ${meta.plant_name}`, ''],
    ...buildInstructionRows(meta),
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(instructionRows, [
      { key: 'label', label: 'Campo', width: 24 },
      { key: 'value', label: 'Valor', width: 90 },
    ]),
    CALIBRATION_CURVES_IMPORT_INSTRUCTIONS_SHEET,
  );

  const metaRows = Object.entries(meta).map(([key, value]) => [key, value]);
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(metaRows, [
      { key: 'key', label: 'Key', width: 24 },
      { key: 'value', label: 'Value', width: 48 },
    ]),
    CALIBRATION_CURVES_IMPORT_META_SHEET,
  );
  const metaSheetIndex = workbook.SheetNames.indexOf(CALIBRATION_CURVES_IMPORT_META_SHEET);
  workbook.Workbook = workbook.Workbook || {};
  workbook.Workbook.Sheets = workbook.Workbook.Sheets || [];
  workbook.Workbook.Sheets[metaSheetIndex] = { Hidden: 1 };

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const date = new Date().toISOString().slice(0, 10);
  const suffix = options.templateType === 'blank' ? 'plantilla' : 'curvas-actuales';
  downloadBuffer(buffer, `PROMIX-Curvas-${options.plant.code}-${suffix}-${date}.xlsx`);
}
