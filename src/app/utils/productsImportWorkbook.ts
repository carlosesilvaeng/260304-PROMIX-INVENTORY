import type { Plant } from '../contexts/AuthContext';

export const PRODUCTS_IMPORT_TEMPLATE_VERSION = '1.0';
export const PRODUCTS_IMPORT_MODULE = 'products';
export const PRODUCTS_IMPORT_SHEET_NAME = 'Datos';
export const PRODUCTS_IMPORT_INSTRUCTIONS_SHEET = 'Instrucciones';
export const PRODUCTS_IMPORT_META_SHEET = 'Meta';

export const PRODUCTS_IMPORT_CATEGORY_OPTIONS = ['OIL', 'LUBRICANT', 'CONSUMABLE', 'EQUIPMENT', 'OTHER'] as const;
export const PRODUCTS_IMPORT_MEASURE_MODE_OPTIONS = ['COUNT', 'DRUM', 'PAIL', 'TANK_READING'] as const;
export const PRODUCTS_IMPORT_BOOLEAN_OPTIONS = ['Sí', 'No'] as const;

export interface ProductsImportWorkbookRow {
  product_name: string;
  category: string;
  measure_mode: string;
  uom: string;
  requires_photo: boolean;
  reading_uom?: string | null;
  tank_capacity?: number | string | null;
  unit_volume?: number | string | null;
  calibration_table?: Record<string, number> | null;
  notes?: string;
  is_active: boolean;
}

export interface ProductsImportMeta {
  template_type: 'blank' | 'current_config';
  module: typeof PRODUCTS_IMPORT_MODULE;
  template_version: typeof PRODUCTS_IMPORT_TEMPLATE_VERSION;
  plant_id: string;
  plant_name: string;
  generated_at: string;
}

type ColumnDefinition = {
  key: keyof ProductsImportWorkbookExportRow;
  label: string;
  width: number;
};

export interface ProductsImportWorkbookExportRow {
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

export const PRODUCTS_IMPORT_COLUMNS: ColumnDefinition[] = [
  { key: 'product_name', label: 'Nombre', width: 28 },
  { key: 'category', label: 'Categoria', width: 18 },
  { key: 'measure_mode', label: 'Metodo', width: 18 },
  { key: 'uom', label: 'Unidad', width: 18 },
  { key: 'requires_photo', label: 'Requiere foto', width: 16 },
  { key: 'reading_uom', label: 'Unidad lectura', width: 18 },
  { key: 'tank_capacity', label: 'Capacidad tanque', width: 18 },
  { key: 'unit_volume', label: 'Volumen por unidad', width: 20 },
  { key: 'calibration_table_json', label: 'Tabla calibracion JSON', width: 42 },
  { key: 'notes', label: 'Notas', width: 34 },
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

function stringifyCalibrationTable(value: Record<string, number> | null | undefined) {
  if (!value || Object.keys(value).length === 0) return '';
  return JSON.stringify(value);
}

function toExportRows(rows: ProductsImportWorkbookRow[]): ProductsImportWorkbookExportRow[] {
  return rows.map((row) => ({
    product_name: row.product_name || '',
    category: row.category || '',
    measure_mode: row.measure_mode || '',
    uom: row.uom || '',
    requires_photo: booleanLabel(row.requires_photo),
    reading_uom: row.reading_uom || '',
    tank_capacity: stringifyNumber(row.tank_capacity),
    unit_volume: stringifyNumber(row.unit_volume),
    calibration_table_json: stringifyCalibrationTable(row.calibration_table),
    notes: row.notes || '',
    is_active: booleanLabel(row.is_active),
  }));
}

function downloadBuffer(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob(
    [buffer],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildInstructionRows(meta: ProductsImportMeta) {
  return [
    ['Modulo', 'Aceites y productos'],
    ['Planta', meta.plant_name],
    ['Archivo', meta.template_type === 'blank' ? 'Plantilla en blanco' : 'Configuracion actual exportada'],
    ['Version de plantilla', meta.template_version],
    ['Generado', new Date(meta.generated_at).toLocaleString('es-PR')],
    ['', ''],
    ['Reglas generales', ''],
    ['1', 'No cambies los encabezados de la hoja Datos.'],
    ['2', 'Solo importa archivos generados por el sistema para este mismo modulo.'],
    ['3', 'Si measure_mode = TANK_READING, debes completar Unidad lectura y Tabla calibracion JSON.'],
    ['4', 'Si measure_mode = DRUM o PAIL, debes completar Volumen por unidad.'],
    ['5', 'Requiere foto y Activo aceptan Sí o No.'],
    ['6', 'Tabla calibracion JSON debe ser un objeto JSON valido, por ejemplo {"0":0,"12":52}.'],
    ['', ''],
    ['Valores permitidos', ''],
    ['Categoria', PRODUCTS_IMPORT_CATEGORY_OPTIONS.join(', ')],
    ['Metodo', PRODUCTS_IMPORT_MEASURE_MODE_OPTIONS.join(', ')],
    ['Booleanos', PRODUCTS_IMPORT_BOOLEAN_OPTIONS.join(', ')],
  ];
}

export async function downloadProductsImportWorkbook(options: {
  plant: Plant;
  rows: ProductsImportWorkbookRow[];
  templateType: 'blank' | 'current_config';
}) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PROMIX Plant Inventory';
  workbook.created = new Date();
  workbook.modified = new Date();

  const meta: ProductsImportMeta = {
    template_type: options.templateType,
    module: PRODUCTS_IMPORT_MODULE,
    template_version: PRODUCTS_IMPORT_TEMPLATE_VERSION,
    plant_id: options.plant.id,
    plant_name: options.plant.name,
    generated_at: new Date().toISOString(),
  };

  const dataSheet = workbook.addWorksheet(PRODUCTS_IMPORT_SHEET_NAME, {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }],
  });
  dataSheet.properties.defaultRowHeight = 22;
  dataSheet.columns = PRODUCTS_IMPORT_COLUMNS.map((column) => ({ key: column.key, width: column.width }));

  const headerRow = dataSheet.getRow(1);
  PRODUCTS_IMPORT_COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: '1F2937' } };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  });

  toExportRows(options.rows).forEach((rowValues, rowIndex) => {
    const row = dataSheet.getRow(rowIndex + 2);
    PRODUCTS_IMPORT_COLUMNS.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.value = rowValues[column.key];
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  });

  const instructionSheet = workbook.addWorksheet(PRODUCTS_IMPORT_INSTRUCTIONS_SHEET, {
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

  const metaSheet = workbook.addWorksheet(PRODUCTS_IMPORT_META_SHEET, {
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
    `PROMIX-Productos-${options.plant.code}-${suffix}-${date}.xlsx`
  );
}
