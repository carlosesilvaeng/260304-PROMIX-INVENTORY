import type { Plant } from '../contexts/AuthContext';

export const CALIBRATION_CURVES_IMPORT_TEMPLATE_VERSION = '2.0';
export const CALIBRATION_CURVES_IMPORT_MODULE = 'calibration_curves';
export const CALIBRATION_CURVES_IMPORT_CURVES_SHEET = 'Curvas';
export const CALIBRATION_CURVES_IMPORT_POINTS_SHEET = 'Puntos';
export const CALIBRATION_CURVES_IMPORT_INSTRUCTIONS_SHEET = 'Instrucciones';
export const CALIBRATION_CURVES_IMPORT_META_SHEET = 'Meta';

export interface CalibrationCurveWorkbookPoint {
  point_key: number;
  point_value: number;
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
  { key: 'point_key', label: 'Key', width: 16 },
  { key: 'point_value', label: 'Value', width: 16 },
];

const SECTION_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'DCEBFA' },
} as const;

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'EEF4FB' },
} as const;

const THIN_BORDER = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
} as const;

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
    ['6', 'Key y Value deben ser numéricos.'],
    ['7', 'No se permiten Keys duplicados dentro de la misma curva.'],
    ['8', 'La importación no elimina curvas faltantes del archivo.'],
    ['9', 'Si una curva ya es usada por diesel o aditivos, el preview avisará y esas configuraciones se resincronizarán con la nueva tabla al ejecutar la importación.'],
  ];
}

function writeHeaders(worksheet: any, columns: ColumnDefinition[]) {
  worksheet.properties.defaultRowHeight = 22;
  worksheet.columns = columns.map((column) => ({ key: column.key, width: column.width }));

  const headerRow = worksheet.getRow(1);
  columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: '1F2937' } };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  });
}

export async function downloadCalibrationCurvesImportWorkbook(options: {
  plant: Plant;
  rows: CalibrationCurvesImportWorkbookRow[];
  templateType: 'blank' | 'current_config';
}) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PROMIX Plant Inventory';
  workbook.created = new Date();
  workbook.modified = new Date();

  const meta: CalibrationCurvesImportMeta = {
    template_type: options.templateType,
    module: CALIBRATION_CURVES_IMPORT_MODULE,
    template_version: CALIBRATION_CURVES_IMPORT_TEMPLATE_VERSION,
    plant_id: options.plant.id,
    plant_name: options.plant.name,
    generated_at: new Date().toISOString(),
  };

  const curvesSheet = workbook.addWorksheet(CALIBRATION_CURVES_IMPORT_CURVES_SHEET, {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }],
  });
  writeHeaders(curvesSheet, CALIBRATION_CURVES_IMPORT_CURVE_COLUMNS);

  options.rows.forEach((rowValues, rowIndex) => {
    const row = curvesSheet.getRow(rowIndex + 2);
    row.getCell(1).value = rowValues.curve_name || '';
    row.getCell(2).value = rowValues.measurement_type || '';
    row.getCell(3).value = rowValues.reading_uom || '';
    for (let columnIndex = 1; columnIndex <= 3; columnIndex += 1) {
      row.getCell(columnIndex).border = THIN_BORDER;
      row.getCell(columnIndex).alignment = { vertical: 'top', wrapText: true };
    }
  });

  const pointsSheet = workbook.addWorksheet(CALIBRATION_CURVES_IMPORT_POINTS_SHEET, {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }],
  });
  writeHeaders(pointsSheet, CALIBRATION_CURVES_IMPORT_POINT_COLUMNS);

  let pointRowIndex = 2;
  options.rows.forEach((curve) => {
    sortPoints(curve.points || []).forEach((point) => {
      const row = pointsSheet.getRow(pointRowIndex);
      row.getCell(1).value = curve.curve_name || '';
      row.getCell(2).value = point.point_key;
      row.getCell(3).value = point.point_value;
      for (let columnIndex = 1; columnIndex <= 3; columnIndex += 1) {
        row.getCell(columnIndex).border = THIN_BORDER;
        row.getCell(columnIndex).alignment = { vertical: 'top', wrapText: true };
      }
      pointRowIndex += 1;
    });
  });

  const instructionSheet = workbook.addWorksheet(CALIBRATION_CURVES_IMPORT_INSTRUCTIONS_SHEET, {
    views: [{ showGridLines: false }],
  });
  instructionSheet.columns = [{ width: 24 }, { width: 90 }];
  instructionSheet.getCell('A1').value = `Importacion de curvas - ${meta.plant_name}`;
  instructionSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: '1F2937' } };
  instructionSheet.mergeCells('A1:B1');
  instructionSheet.getCell('A1').fill = SECTION_FILL;
  instructionSheet.getCell('A1').border = THIN_BORDER;
  instructionSheet.getCell('B1').border = THIN_BORDER;

  buildInstructionRows(meta).forEach((rowValues, rowIndex) => {
    const row = instructionSheet.getRow(rowIndex + 2);
    rowValues.forEach((value, valueIndex) => {
      const cell = row.getCell(valueIndex + 1);
      cell.value = value;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'top', wrapText: true };
      if (rowIndex === 0 || rowValues[1] === '') {
        cell.font = { bold: true, color: { argb: '1F2937' } };
      }
    });
  });

  const metaSheet = workbook.addWorksheet(CALIBRATION_CURVES_IMPORT_META_SHEET, {
    state: 'hidden',
    views: [{ showGridLines: false }],
  });
  metaSheet.columns = [{ width: 24 }, { width: 48 }];
  Object.entries(meta).forEach(([key, value], index) => {
    const row = metaSheet.getRow(index + 1);
    row.getCell(1).value = key;
    row.getCell(2).value = value;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  const suffix = options.templateType === 'blank' ? 'plantilla' : 'curvas-actuales';
  downloadBuffer(buffer as ArrayBuffer, `PROMIX-Curvas-${options.plant.code}-${suffix}-${date}.xlsx`);
}
