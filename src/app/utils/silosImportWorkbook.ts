import type { Plant } from '../contexts/AuthContext';

export const SILOS_IMPORT_TEMPLATE_VERSION = '2.0';
export const SILOS_IMPORT_MODULE = 'silos';
export const SILOS_IMPORT_SHEET_NAME = 'Datos';
export const SILOS_IMPORT_INSTRUCTIONS_SHEET = 'Instrucciones';
export const SILOS_IMPORT_META_SHEET = 'Meta';
export const SILOS_IMPORT_METHOD_OPTIONS = ['SILO_LEVEL'] as const;
export const SILOS_IMPORT_BOOLEAN_OPTIONS = ['Sí', 'No'] as const;

export interface SilosImportWorkbookRow {
  silo_name: string;
  measurement_method: string;
  calibration_curve_name?: string | null;
  reading_uom?: string | null;
  allowed_products?: string[] | null;
  is_active: boolean;
}

export interface SilosImportMeta {
  template_type: 'blank' | 'current_config';
  module: typeof SILOS_IMPORT_MODULE;
  template_version: typeof SILOS_IMPORT_TEMPLATE_VERSION;
  plant_id: string;
  plant_name: string;
  generated_at: string;
}

type ColumnDefinition = {
  key: keyof SilosImportWorkbookExportRow;
  label: string;
  width: number;
};

export interface SilosImportWorkbookExportRow {
  silo_name: string;
  measurement_method: string;
  calibration_curve_name: string;
  reading_uom: string;
  allowed_products: string;
  is_active: string;
}

export const SILOS_IMPORT_COLUMNS: ColumnDefinition[] = [
  { key: 'silo_name', label: 'Nombre del silo', width: 28 },
  { key: 'measurement_method', label: 'Metodo de medicion', width: 24 },
  { key: 'calibration_curve_name', label: 'Nombre de curva', width: 34 },
  { key: 'reading_uom', label: 'Unidad de lectura', width: 18 },
  { key: 'allowed_products', label: 'Productos permitidos', width: 44 },
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

function toExportRows(rows: SilosImportWorkbookRow[]): SilosImportWorkbookExportRow[] {
  return rows.map((row) => ({
    silo_name: row.silo_name || '',
    measurement_method: row.measurement_method || 'SILO_LEVEL',
    calibration_curve_name: row.calibration_curve_name || '',
    reading_uom: row.reading_uom || '',
    allowed_products: Array.isArray(row.allowed_products) ? row.allowed_products.join(' | ') : '',
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

function buildInstructionRows(meta: SilosImportMeta, productOptions: string[]) {
  return [
    ['Modulo', 'Silos'],
    ['Planta', meta.plant_name],
    ['Archivo', meta.template_type === 'blank' ? 'Plantilla en blanco' : 'Configuracion actual exportada'],
    ['Version de plantilla', meta.template_version],
    ['Generado', new Date(meta.generated_at).toLocaleString('es-PR')],
    ['', ''],
    ['Reglas generales', ''],
    ['1', 'No cambies los encabezados de la hoja Datos.'],
    ['2', 'Solo importa archivos generados por el sistema para este mismo modulo.'],
    ['3', 'Nombre de curva debe existir en Catalogos > Curvas de conversion para esta planta.'],
    ['4', 'Unidad de lectura se sincroniza desde la curva seleccionada.'],
    ['5', 'Productos permitidos acepta varios nombres separados por |.'],
    ['6', 'Cada producto permitido debe existir como Aceite o Producto activo en la planta.'],
    ['7', 'Activo acepta Sí o No.'],
    ['', ''],
    ['Valores permitidos', ''],
    ['Metodo de medicion', SILOS_IMPORT_METHOD_OPTIONS.join(', ')],
    ['Booleanos', SILOS_IMPORT_BOOLEAN_OPTIONS.join(', ')],
    ['Productos activos sugeridos', productOptions.join(', ') || 'No hay productos activos configurados'],
  ];
}

export async function downloadSilosImportWorkbook(options: {
  plant: Plant;
  rows: SilosImportWorkbookRow[];
  templateType: 'blank' | 'current_config';
  productOptions: string[];
}) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PROMIX Plant Inventory';
  workbook.created = new Date();
  workbook.modified = new Date();

  const meta: SilosImportMeta = {
    template_type: options.templateType,
    module: SILOS_IMPORT_MODULE,
    template_version: SILOS_IMPORT_TEMPLATE_VERSION,
    plant_id: options.plant.id,
    plant_name: options.plant.name,
    generated_at: new Date().toISOString(),
  };

  const dataSheet = workbook.addWorksheet(SILOS_IMPORT_SHEET_NAME, {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }],
  });
  dataSheet.properties.defaultRowHeight = 22;
  dataSheet.columns = SILOS_IMPORT_COLUMNS.map((column) => ({ key: column.key, width: column.width }));

  const headerRow = dataSheet.getRow(1);
  SILOS_IMPORT_COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: '1F2937' } };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  });

  toExportRows(options.rows).forEach((rowValues, rowIndex) => {
    const row = dataSheet.getRow(rowIndex + 2);
    SILOS_IMPORT_COLUMNS.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.value = rowValues[column.key];
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  });

  const instructionSheet = workbook.addWorksheet(SILOS_IMPORT_INSTRUCTIONS_SHEET, {
    views: [{ showGridLines: false }],
  });
  instructionSheet.columns = [{ width: 24 }, { width: 90 }];
  instructionSheet.getCell('A1').value = `Importacion de ${meta.plant_name}`;
  instructionSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: '1F2937' } };
  instructionSheet.mergeCells('A1:B1');
  instructionSheet.getCell('A1').fill = SECTION_FILL;
  instructionSheet.getCell('A1').border = THIN_BORDER;
  instructionSheet.getCell('B1').border = THIN_BORDER;

  buildInstructionRows(meta, options.productOptions).forEach((rowValues, rowIndex) => {
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

  const metaSheet = workbook.addWorksheet(SILOS_IMPORT_META_SHEET, {
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
    `PROMIX-Silos-${options.plant.code}-${suffix}-${date}.xlsx`
  );
}
