import type { Plant } from '../contexts/AuthContext';

export const AGGREGATES_IMPORT_TEMPLATE_VERSION = '1.0';
export const AGGREGATES_IMPORT_MODULE = 'aggregates';
export const AGGREGATES_IMPORT_SHEET_NAME = 'Datos';
export const AGGREGATES_IMPORT_INSTRUCTIONS_SHEET = 'Instrucciones';
export const AGGREGATES_IMPORT_META_SHEET = 'Meta';
export const AGGREGATES_IMPORT_METHOD_OPTIONS = ['BOX', 'CONE'] as const;
export const AGGREGATES_IMPORT_BOOLEAN_OPTIONS = ['Sí', 'No'] as const;

export interface AggregatesImportWorkbookRow {
  aggregate_name: string;
  material_type: string;
  location_area: string;
  measurement_method: string;
  unit: string;
  box_width_ft?: number | string | null;
  box_height_ft?: number | string | null;
  is_active: boolean;
}

export interface AggregatesImportMeta {
  template_type: 'blank' | 'current_config';
  module: typeof AGGREGATES_IMPORT_MODULE;
  template_version: typeof AGGREGATES_IMPORT_TEMPLATE_VERSION;
  plant_id: string;
  plant_name: string;
  generated_at: string;
}

type ColumnDefinition = {
  key: keyof AggregatesImportWorkbookExportRow;
  label: string;
  width: number;
};

export interface AggregatesImportWorkbookExportRow {
  aggregate_name: string;
  material_type: string;
  location_area: string;
  measurement_method: string;
  unit: string;
  box_width_ft: string;
  box_height_ft: string;
  is_active: string;
}

export const AGGREGATES_IMPORT_COLUMNS: ColumnDefinition[] = [
  { key: 'aggregate_name', label: 'Nombre del agregado', width: 28 },
  { key: 'material_type', label: 'Material', width: 22 },
  { key: 'location_area', label: 'Procedencia', width: 22 },
  { key: 'measurement_method', label: 'Metodo de medicion', width: 20 },
  { key: 'unit', label: 'Unidad', width: 18 },
  { key: 'box_width_ft', label: 'Ancho (ft)', width: 16 },
  { key: 'box_height_ft', label: 'Alto (ft)', width: 16 },
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

function toExportRows(rows: AggregatesImportWorkbookRow[]): AggregatesImportWorkbookExportRow[] {
  return rows.map((row) => ({
    aggregate_name: row.aggregate_name || '',
    material_type: row.material_type || '',
    location_area: row.location_area || '',
    measurement_method: row.measurement_method || '',
    unit: row.unit || 'CUBIC_YARDS',
    box_width_ft: stringifyNumber(row.box_width_ft),
    box_height_ft: stringifyNumber(row.box_height_ft),
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

function buildInstructionRows(meta: AggregatesImportMeta, materialOptions: string[], procedenciaOptions: string[]) {
  return [
    ['Modulo', 'Agregados'],
    ['Planta', meta.plant_name],
    ['Archivo', meta.template_type === 'blank' ? 'Plantilla en blanco' : 'Configuracion actual exportada'],
    ['Version de plantilla', meta.template_version],
    ['Generado', new Date(meta.generated_at).toLocaleString('es-PR')],
    ['', ''],
    ['Reglas generales', ''],
    ['1', 'No cambies los encabezados de la hoja Datos.'],
    ['2', 'Solo importa archivos generados por el sistema para este mismo modulo.'],
    ['3', 'Si Metodo de medicion = BOX, debes completar Ancho (ft) y Alto (ft).'],
    ['4', 'Si Metodo de medicion = CONE, Ancho y Alto se ignoraran.'],
    ['5', 'Material y Procedencia deben existir previamente en Catálogos.'],
    ['6', 'Activo acepta Sí o No.'],
    ['7', 'La importacion migra la configuracion al esquema nuevo de agregados y limpia los cajones legacy.'],
    ['', ''],
    ['Valores permitidos', ''],
    ['Metodo de medicion', AGGREGATES_IMPORT_METHOD_OPTIONS.join(', ')],
    ['Booleanos', AGGREGATES_IMPORT_BOOLEAN_OPTIONS.join(', ')],
    ['Materiales sugeridos', materialOptions.join(', ') || 'Catalogo vacio'],
    ['Procedencias sugeridas', procedenciaOptions.join(', ') || 'Catalogo vacio'],
  ];
}

export async function downloadAggregatesImportWorkbook(options: {
  plant: Plant;
  rows: AggregatesImportWorkbookRow[];
  templateType: 'blank' | 'current_config';
  materialOptions: string[];
  procedenciaOptions: string[];
}) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PROMIX Plant Inventory';
  workbook.created = new Date();
  workbook.modified = new Date();

  const meta: AggregatesImportMeta = {
    template_type: options.templateType,
    module: AGGREGATES_IMPORT_MODULE,
    template_version: AGGREGATES_IMPORT_TEMPLATE_VERSION,
    plant_id: options.plant.id,
    plant_name: options.plant.name,
    generated_at: new Date().toISOString(),
  };

  const dataSheet = workbook.addWorksheet(AGGREGATES_IMPORT_SHEET_NAME, {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }],
  });
  dataSheet.properties.defaultRowHeight = 22;
  dataSheet.columns = AGGREGATES_IMPORT_COLUMNS.map((column) => ({ key: column.key, width: column.width }));

  const headerRow = dataSheet.getRow(1);
  AGGREGATES_IMPORT_COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: '1F2937' } };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  });

  toExportRows(options.rows).forEach((rowValues, rowIndex) => {
    const row = dataSheet.getRow(rowIndex + 2);
    AGGREGATES_IMPORT_COLUMNS.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.value = rowValues[column.key];
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  });

  const instructionSheet = workbook.addWorksheet(AGGREGATES_IMPORT_INSTRUCTIONS_SHEET, {
    views: [{ showGridLines: false }],
  });
  instructionSheet.columns = [{ width: 24 }, { width: 90 }];
  instructionSheet.getCell('A1').value = `Importacion de ${meta.plant_name}`;
  instructionSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: '1F2937' } };
  instructionSheet.mergeCells('A1:B1');
  instructionSheet.getCell('A1').fill = SECTION_FILL;
  instructionSheet.getCell('A1').border = THIN_BORDER;
  instructionSheet.getCell('B1').border = THIN_BORDER;

  buildInstructionRows(meta, options.materialOptions, options.procedenciaOptions).forEach((rowValues, rowIndex) => {
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

  const metaSheet = workbook.addWorksheet(AGGREGATES_IMPORT_META_SHEET, {
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
    `PROMIX-Agregados-${options.plant.code}-${suffix}-${date}.xlsx`
  );
}
