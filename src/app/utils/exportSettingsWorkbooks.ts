export interface SettingsWorkbookSheet {
  name: string;
  headers: string[];
  rows: Array<Array<string | number | boolean | null | undefined>>;
}

const WORKBOOK_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE5EFFA' } };
const TITLE_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF3B3A36' } };
const THIN_BORDER = {
  top: { style: 'thin' as const, color: { argb: 'FFD8DADF' } },
  left: { style: 'thin' as const, color: { argb: 'FFD8DADF' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFD8DADF' } },
  right: { style: 'thin' as const, color: { argb: 'FFD8DADF' } },
};

function downloadBuffer(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer], { type: WORKBOOK_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalizeCellValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Si' : 'No';
  return value;
}

function sanitizeSheetName(name: string, usedNames: Set<string>) {
  const baseName = (name || 'Hoja')
    .replace(/[\\/?*[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31) || 'Hoja';

  let sheetName = baseName;
  let index = 2;
  while (usedNames.has(sheetName)) {
    const suffix = ` ${index}`;
    sheetName = `${baseName.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }
  usedNames.add(sheetName);
  return sheetName;
}

function formatFileDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function exportSettingsWorkbook(title: string, sheets: SettingsWorkbookSheet[], filePrefix: string) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PROMIX Plant Inventory';
  workbook.created = new Date();
  workbook.modified = new Date();

  const usedNames = new Set<string>();

  sheets.forEach((sheet) => {
    const worksheet = workbook.addWorksheet(sanitizeSheetName(sheet.name, usedNames), {
      views: [{ showGridLines: false, state: 'frozen', ySplit: 2 }],
    });

    const columnCount = Math.max(sheet.headers.length, 1);
    worksheet.mergeCells(1, 1, 1, columnCount);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 };
    titleCell.fill = TITLE_FILL;
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const headerRow = worksheet.getRow(2);
    sheet.headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FF1F2937' } };
      cell.fill = HEADER_FILL;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle', wrapText: true };
    });

    const dataRows = sheet.rows.length > 0 ? sheet.rows : [Array(columnCount).fill('Sin datos')];
    dataRows.forEach((rowValues, rowIndex) => {
      const row = worksheet.getRow(rowIndex + 3);
      for (let index = 0; index < columnCount; index += 1) {
        const cell = row.getCell(index + 1);
        cell.value = normalizeCellValue(rowValues[index]);
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: 'top', wrapText: true };
      }
    });

    worksheet.columns = sheet.headers.map((header, index) => {
      const values = [header, ...dataRows.map((row) => String(normalizeCellValue(row[index])))];
      const width = Math.min(Math.max(...values.map((value) => value.length), 12) + 2, 42);
      return { width };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer as ArrayBuffer, `${filePrefix}-${formatFileDate()}.xlsx`);
}
