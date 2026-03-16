import type { Plant } from '../contexts/AuthContext';

export const DIESEL_IMPORT_TEMPLATE_VERSION = '1.0';
export const DIESEL_IMPORT_MODULE = 'diesel';
export const DIESEL_IMPORT_SHEET_NAME = 'Datos';
export const DIESEL_IMPORT_INSTRUCTIONS_SHEET = 'Instrucciones';
export const DIESEL_IMPORT_META_SHEET = 'Meta';
export const DIESEL_IMPORT_METHOD_OPTIONS = ['TANK_LEVEL'] as const;
export const DIESEL_IMPORT_BOOLEAN_OPTIONS = ['Sí', 'No'] as const;

export interface DieselImportWorkbookRow {
  measurement_method: string;
  calibration_curve_name?: string | null;
  reading_uom: string;
  tank_capacity_gallons: number | string | null;
  initial_inventory_gallons?: number | string | null;
  calibration_table: Record<string, number> | null;
  is_active: boolean;
}

export interface DieselImportMeta {
  template_type: 'blank' | 'current_config';
  module: typeof DIESEL_IMPORT_MODULE;
  template_version: typeof DIESEL_IMPORT_TEMPLATE_VERSION;
  plant_id: string;
  plant_name: string;
  generated_at: string;
}

type ColumnDefinition = {
  key: keyof DieselImportWorkbookExportRow;
  label: string;
  width: number;
};

export interface DieselImportWorkbookExportRow {
  measurement_method: string;
  calibration_curve_name: string;
  reading_uom: string;
  tank_capacity_gallons: string;
  initial_inventory_gallons: string;
  calibration_table_json: string;
  is_active: string;
}

export const DIESEL_IMPORT_COLUMNS: ColumnDefinition[] = [
  { key: 'measurement_method', label: 'Metodo', width: 20 },
  { key: 'calibration_curve_name', label: 'Nombre de curva', width: 26 },
  { key: 'reading_uom', label: 'Unidad de lectura', width: 18 },
  { key: 'tank_capacity_gallons', label: 'Capacidad del tanque', width: 20 },
  { key: 'initial_inventory_gallons', label: 'Inventario inicial', width: 18 },
  { key: 'calibration_table_json', label: 'Tabla calibracion JSON', width: 40 },
  { key: 'is_active', label: 'Activo', width: 12 },
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

function booleanLabel(value: boolean | null | undefined) {
  return value ? 'Sí' : 'No';
}

function stringifyNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

function stringifyTable(value: Record<string, number> | null | undefined) {
  if (!value || Object.keys(value).length === 0) return '';
  return JSON.stringify(value, null, 2);
}

function toExportRows(rows: DieselImportWorkbookRow[]): DieselImportWorkbookExportRow[] {
  return rows.map((row) => ({
    measurement_method: row.measurement_method || 'TANK_LEVEL',
    calibration_curve_name: row.calibration_curve_name || '',
    reading_uom: row.reading_uom || '',
    tank_capacity_gallons: stringifyNumber(row.tank_capacity_gallons),
    initial_inventory_gallons: stringifyNumber(row.initial_inventory_gallons),
    calibration_table_json: stringifyTable(row.calibration_table),
    is_active: booleanLabel(row.is_active),
  }));
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

function buildInstructionRows(meta: DieselImportMeta) {
  return [
    ['Modulo', 'Diesel'],
    ['Planta', meta.plant_name],
    ['Archivo', meta.template_type === 'blank' ? 'Plantilla en blanco' : 'Configuracion actual exportada'],
    ['Version de plantilla', meta.template_version],
    ['Generado', new Date(meta.generated_at).toLocaleString('es-PR')],
    ['', ''],
    ['Reglas generales', ''],
    ['1', 'No cambies los encabezados de la hoja Datos.'],
    ['2', 'La plantilla de diesel solo admite una fila por planta.'],
    ['3', 'Nombre de curva es requerido y debe existir en el catálogo de curvas de esta planta.'],
    ['4', 'Si el archivo trae una unidad o tabla distinta, el sistema usará la definida en la curva seleccionada.'],
    ['5', 'Capacidad del tanque debe ser mayor que cero.'],
    ['6', 'Inventario inicial no puede ser negativo.'],
    ['7', 'Tabla calibracion JSON debe ser un objeto JSON valido.'],
    ['8', 'Activo acepta Sí o No.'],
    ['', ''],
    ['Valores permitidos', ''],
    ['Metodo', DIESEL_IMPORT_METHOD_OPTIONS.join(', ')],
    ['Booleanos', DIESEL_IMPORT_BOOLEAN_OPTIONS.join(', ')],
  ];
}

export async function downloadDieselImportWorkbook(options: {
  plant: Plant;
  rows: DieselImportWorkbookRow[];
  templateType: 'blank' | 'current_config';
}) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PROMIX Plant Inventory';
  workbook.created = new Date();
  workbook.modified = new Date();

  const meta: DieselImportMeta = {
    template_type: options.templateType,
    module: DIESEL_IMPORT_MODULE,
    template_version: DIESEL_IMPORT_TEMPLATE_VERSION,
    plant_id: options.plant.id,
    plant_name: options.plant.name,
    generated_at: new Date().toISOString(),
  };

  const dataSheet = workbook.addWorksheet(DIESEL_IMPORT_SHEET_NAME, {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }],
  });
  dataSheet.properties.defaultRowHeight = 22;
  dataSheet.columns = DIESEL_IMPORT_COLUMNS.map((column) => ({ key: column.key, width: column.width }));

  const headerRow = dataSheet.getRow(1);
  DIESEL_IMPORT_COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: '1F2937' } };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  });

  toExportRows(options.rows).forEach((rowValues, rowIndex) => {
    const row = dataSheet.getRow(rowIndex + 2);
    DIESEL_IMPORT_COLUMNS.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.value = rowValues[column.key];
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  });

  const instructionSheet = workbook.addWorksheet(DIESEL_IMPORT_INSTRUCTIONS_SHEET, {
    views: [{ showGridLines: false }],
  });
  instructionSheet.columns = [{ width: 24 }, { width: 90 }];
  instructionSheet.getCell('A1').value = `Importacion de ${meta.plant_name}`;
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

  const metaSheet = workbook.addWorksheet(DIESEL_IMPORT_META_SHEET, {
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
  const suffix = options.templateType === 'blank' ? 'plantilla' : 'configuracion-actual';
  downloadBuffer(
    buffer as ArrayBuffer,
    `PROMIX-Diesel-${options.plant.code}-${suffix}-${date}.xlsx`
  );
}
