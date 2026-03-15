import {
  MATERIALS_IMPORT_COLUMNS,
  MATERIALS_IMPORT_META_SHEET,
  MATERIALS_IMPORT_MODULE,
  MATERIALS_IMPORT_SHEET_NAME,
  MATERIALS_IMPORT_TEMPLATE_VERSION,
  type MaterialsImportMeta,
} from './materialsImportWorkbook';

export interface ParsedMaterialsImportRow {
  row_number: number;
  nombre: string;
  clase: string;
}

export interface ParsedMaterialsImportFile {
  meta: MaterialsImportMeta;
  rows: ParsedMaterialsImportRow[];
}

function toCellString(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export async function parseMaterialsImportFile(file: File): Promise<ParsedMaterialsImportFile> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const dataSheet = workbook.Sheets[MATERIALS_IMPORT_SHEET_NAME];
  if (!dataSheet) {
    throw new Error(`El archivo no contiene la hoja "${MATERIALS_IMPORT_SHEET_NAME}".`);
  }

  const headerRows = XLSX.utils.sheet_to_json<(string | number)[]>(dataSheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });

  const expectedHeaders = MATERIALS_IMPORT_COLUMNS.map((column) => column.label);
  const actualHeaders = (headerRows[0] || []).map((value) => toCellString(value));

  if (expectedHeaders.length !== actualHeaders.length || expectedHeaders.some((header, index) => header !== actualHeaders[index])) {
    throw new Error('Los encabezados de la hoja Datos no coinciden con la plantilla oficial.');
  }

  const rows: ParsedMaterialsImportRow[] = [];
  headerRows.slice(1).forEach((rowValues, index) => {
    const normalized = MATERIALS_IMPORT_COLUMNS.reduce((acc, column, columnIndex) => {
      acc[column.key] = toCellString(rowValues[columnIndex]);
      return acc;
    }, {} as Record<string, string>);

    if (Object.values(normalized).every((value) => !value)) return;

    rows.push({
      row_number: index + 2,
      nombre: normalized.nombre || '',
      clase: normalized.clase || '',
    });
  });

  const metaSheet = workbook.Sheets[MATERIALS_IMPORT_META_SHEET];
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

  if (metaMap.module !== MATERIALS_IMPORT_MODULE) {
    throw new Error('La plantilla no corresponde al catálogo de Materiales.');
  }

  if (metaMap.template_version !== MATERIALS_IMPORT_TEMPLATE_VERSION) {
    throw new Error('La versión de la plantilla no es compatible. Genera una plantilla nueva desde el sistema.');
  }

  return {
    meta: {
      template_type: metaMap.template_type === 'current_config' ? 'current_config' : 'blank',
      module: MATERIALS_IMPORT_MODULE,
      template_version: MATERIALS_IMPORT_TEMPLATE_VERSION,
      generated_at: metaMap.generated_at || '',
    },
    rows,
  };
}
