export const ADDITIVES_CATALOG_IMPORT_TEMPLATE_VERSION = '1.0';
export const ADDITIVES_CATALOG_IMPORT_MODULE = 'additivos_catalogo';
export const ADDITIVES_CATALOG_IMPORT_SHEET_NAME = 'Datos';
export const ADDITIVES_CATALOG_IMPORT_INSTRUCTIONS_SHEET = 'Instrucciones';
export const ADDITIVES_CATALOG_IMPORT_META_SHEET = 'Meta';

export interface AdditivesCatalogImportWorkbookRow {
  nombre: string;
  marca?: string | null;
  uom: string;
}

export interface AdditivesCatalogImportMeta {
  template_type: 'blank' | 'current_config';
  module: typeof ADDITIVES_CATALOG_IMPORT_MODULE;
  template_version: typeof ADDITIVES_CATALOG_IMPORT_TEMPLATE_VERSION;
  generated_at: string;
}

type ColumnDefinition = {
  key: keyof AdditivesCatalogImportWorkbookExportRow;
  label: string;
  width: number;
};

export interface AdditivesCatalogImportWorkbookExportRow {
  nombre: string;
  marca: string;
  uom: string;
}

export const ADDITIVES_CATALOG_IMPORT_COLUMNS: ColumnDefinition[] = [
  { key: 'nombre', label: 'Nombre', width: 28 },
  { key: 'marca', label: 'Marca', width: 24 },
  { key: 'uom', label: 'Unidad', width: 18 },
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

function toExportRows(rows: AdditivesCatalogImportWorkbookRow[]): AdditivesCatalogImportWorkbookExportRow[] {
  return rows.map((row) => ({
    nombre: row.nombre || '',
    marca: row.marca || '',
    uom: row.uom || '',
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

function buildInstructionRows(meta: AdditivesCatalogImportMeta) {
  return [
    ['Modulo', 'Aditivos catálogo'],
    ['Archivo', meta.template_type === 'blank' ? 'Plantilla en blanco' : 'Catalogo actual exportado'],
    ['Version de plantilla', meta.template_version],
    ['Generado', new Date(meta.generated_at).toLocaleString('es-PR')],
    ['', ''],
    ['Reglas generales', ''],
    ['1', 'No cambies los encabezados de la hoja Datos.'],
    ['2', 'Solo importa archivos generados por el sistema para este mismo catalogo.'],
    ['3', 'Nombre es requerido.'],
    ['4', 'Unidad es requerida.'],
    ['5', 'Marca es opcional.'],
    ['6', 'La importacion solo crea o actualiza; no elimina filas faltantes.'],
    ['7', 'Los cambios de nombre, marca y unidad se sincronizan con configuraciones de aditivos que referencian este catálogo.'],
  ];
}

export async function downloadAdditivesCatalogImportWorkbook(options: {
  rows: AdditivesCatalogImportWorkbookRow[];
  templateType: 'blank' | 'current_config';
}) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PROMIX Plant Inventory';
  workbook.created = new Date();
  workbook.modified = new Date();

  const meta: AdditivesCatalogImportMeta = {
    template_type: options.templateType,
    module: ADDITIVES_CATALOG_IMPORT_MODULE,
    template_version: ADDITIVES_CATALOG_IMPORT_TEMPLATE_VERSION,
    generated_at: new Date().toISOString(),
  };

  const dataSheet = workbook.addWorksheet(ADDITIVES_CATALOG_IMPORT_SHEET_NAME, {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }],
  });
  dataSheet.properties.defaultRowHeight = 22;
  dataSheet.columns = ADDITIVES_CATALOG_IMPORT_COLUMNS.map((column) => ({ key: column.key, width: column.width }));

  const headerRow = dataSheet.getRow(1);
  ADDITIVES_CATALOG_IMPORT_COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: '1F2937' } };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  });

  toExportRows(options.rows).forEach((rowValues, rowIndex) => {
    const row = dataSheet.getRow(rowIndex + 2);
    ADDITIVES_CATALOG_IMPORT_COLUMNS.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.value = rowValues[column.key];
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  });

  const instructionSheet = workbook.addWorksheet(ADDITIVES_CATALOG_IMPORT_INSTRUCTIONS_SHEET, {
    views: [{ showGridLines: false }],
  });
  instructionSheet.columns = [{ width: 24 }, { width: 90 }];
  instructionSheet.getCell('A1').value = 'Importacion de aditivos catálogo';
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

  const metaSheet = workbook.addWorksheet(ADDITIVES_CATALOG_IMPORT_META_SHEET, {
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
  const suffix = options.templateType === 'blank' ? 'plantilla' : 'catalogo-actual';
  downloadBuffer(buffer as ArrayBuffer, `PROMIX-Aditivos-Catalogo-${suffix}-${date}.xlsx`);
}
