/**
 * exportReports.ts
 * Client-side export utilities for the Reports page.
 * Generates Excel (.xlsx) and PDF files from the filtered inventory list,
 * including summary + section-level detail fetched from the API.
 */

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '@/assets/logo-promix.png';

// ============================================================================
// TYPES
// ============================================================================

export interface ReportSummary {
  id: string;
  plant_id: string;
  year_month: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED';
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_by?: string;
  approved_at?: string;
}

interface SectionDetail {
  name: string;
  headers: string[];
  rows: (string | number)[][];
  photos?: SectionPhoto[];
}

interface ReportDetail {
  report: ReportSummary;
  sections: SectionDetail[];
}

interface LogoImage {
  dataUrl: string;
  displayW: number; // mm at target height
  displayH: number; // mm
}

interface SectionPhoto {
  label: string;
  url: string;
}

interface EmbeddedImage {
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  width: number;
  height: number;
}

// ============================================================================
// HELPERS
// ============================================================================

const MONTH_NAMES: Record<string, string> = {
  '01': 'Enero',   '02': 'Febrero',  '03': 'Marzo',    '04': 'Abril',
  '05': 'Mayo',    '06': 'Junio',    '07': 'Julio',    '08': 'Agosto',
  '09': 'Sep',     '10': 'Octubre',  '11': 'Noviembre','12': 'Diciembre',
};

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'En Progreso',
  SUBMITTED:   'Enviado',
  APPROVED:    'Aprobado',
};

function formatPeriod(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${MONTH_NAMES[month] || month} ${year}`;
}

function formatDate(iso: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('es-PR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function safeNum(v: any): string {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  return isNaN(n) ? '-' : n.toFixed(2);
}

function formatAggregateBoxDetail(entry: any): string {
  return `A:${safeNum(entry.box_width_ft)} ft · H:${safeNum(entry.box_height_ft)} ft · L:${safeNum(entry.box_length_ft)} ft`;
}

function formatAggregateConeDetail(entry: any): string {
  return [
    `M1:${safeNum(entry.cone_m1)}`,
    `M2:${safeNum(entry.cone_m2)}`,
    `M3:${safeNum(entry.cone_m3)}`,
    `M4:${safeNum(entry.cone_m4)}`,
    `M5:${safeNum(entry.cone_m5)}`,
    `M6:${safeNum(entry.cone_m6)}`,
    `D1:${safeNum(entry.cone_d1)}`,
    `D2:${safeNum(entry.cone_d2)}`,
  ].join(' · ');
}

// ============================================================================
// LOGO LOADER
// ============================================================================

const LOGO_TARGET_H = 10; // mm

async function loadLogoImage(): Promise<LogoImage | null> {
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    // Compute natural dimensions to preserve aspect ratio
    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });
    const aspectRatio = img.naturalWidth && img.naturalHeight
      ? img.naturalWidth / img.naturalHeight
      : 3.5; // fallback ratio for a typical horizontal logo
    return {
      dataUrl,
      displayW: aspectRatio * LOGO_TARGET_H,
      displayH: LOGO_TARGET_H,
    };
  } catch {
    return null;
  }
}

async function loadRemoteImage(url: string, token: string): Promise<EmbeddedImage | null> {
  try {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) return null;

    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });

    const mimeType = blob.type.toLowerCase();
    const format = mimeType.includes('png') ? 'PNG' : 'JPEG';

    return {
      dataUrl,
      format,
      width: img.naturalWidth || 1,
      height: img.naturalHeight || 1,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// FETCH DETAIL FOR ONE REPORT
// ============================================================================

async function fetchDetail(
  report: ReportSummary,
  apiBaseUrl: string,
  token: string,
): Promise<ReportDetail> {
  const sections: SectionDetail[] = [];

  try {
    const res = await fetch(
      `${apiBaseUrl}/inventory/month/${report.plant_id}/${report.year_month}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const json = await res.json();

    if (!json.success || !json.data) return { report, sections };

    const data = json.data;

    // ── Agregados ──────────────────────────────────────────────────────────
    if (data.agregados?.length) {
      sections.push({
        name: 'Agregados',
        headers: ['Nombre', 'Material', 'Área', 'Método', 'Detalle cajón/cono', 'Volumen (cy)', 'Notas', 'Foto'],
        rows: data.agregados.map((e: any) => [
          e.aggregate_name ?? '-',
          e.material_type ?? '-',
          e.location_area ?? '-',
          e.measurement_method ?? '-',
          String(e.measurement_method || '').toUpperCase() === 'BOX'
            ? formatAggregateBoxDetail(e)
            : formatAggregateConeDetail(e),
          safeNum(e.calculated_volume_cy),
          e.notes ?? '-',
          e.photo_url ? 'Sí' : 'No',
        ]),
        photos: data.agregados
          .filter((e: any) => !!e.photo_url)
          .map((e: any) => ({
            label: e.aggregate_name ?? 'Agregado',
            url: e.photo_url,
          })),
      });
    }

    // ── Silos ──────────────────────────────────────────────────────────────
    if (data.silos?.length) {
      sections.push({
        name: 'Silos',
        headers: ['Silo', 'Producto', 'Lectura', 'Resultado', 'Foto'],
        rows: data.silos.map((e: any) => [
          e.silo_name ?? '-',
          e.product_name ?? '-',
          safeNum(e.reading_value),
          safeNum(e.calculated_result_cy),
          e.photo_url ? 'Sí' : 'No',
        ]),
      });
    }

    // ── Aditivos ───────────────────────────────────────────────────────────
    if (data.aditivos?.length) {
      sections.push({
        name: 'Aditivos',
        headers: ['Producto', 'Marca', 'Tipo', 'Cantidad', 'UOM', 'Foto'],
        rows: data.aditivos.map((e: any) => [
          e.product_name ?? '-',
          e.brand ?? '-',
          e.additive_type ?? '-',
          safeNum(e.additive_type === 'TANK' ? e.calculated_volume : e.quantity),
          e.uom ?? '-',
          e.photo_url ? 'Sí' : 'No',
        ]),
      });
    }

    // ── Diesel ─────────────────────────────────────────────────────────────
    if (data.diesel) {
      const d = data.diesel;
      sections.push({
        name: 'Diesel',
        headers: ['Lectura (pulg)', 'Galones calculados', 'Inventario inicial', 'Compras', 'Consumo', 'Foto'],
        rows: [[
          safeNum(d.reading_inches),
          safeNum(d.calculated_gallons),
          safeNum(d.beginning_inventory),
          safeNum(d.purchases_gallons),
          safeNum(d.consumption_gallons),
          d.photo_url ? 'Sí' : 'No',
        ]],
      });
    }

    // ── Productos ──────────────────────────────────────────────────────────
    if (data.productos?.length) {
      sections.push({
        name: 'Productos',
        headers: ['Producto', 'Categoría', 'UOM', 'Cantidad', 'Foto'],
        rows: data.productos.map((e: any) => [
          e.product_name ?? '-',
          e.category ?? '-',
          e.uom ?? '-',
          safeNum(e.quantity ?? e.calculated_quantity),
          e.photo_url ? 'Sí' : 'No',
        ]),
      });
    }

    // ── Utilities ──────────────────────────────────────────────────────────
    if (data.utilities?.length) {
      sections.push({
        name: 'Utilidades',
        headers: ['Medidor', 'Tipo', 'Lectura anterior', 'Lectura actual', 'Consumo', 'UOM', 'Foto'],
        rows: data.utilities.map((e: any) => [
          e.meter_name ?? '-',
          e.utility_type ?? '-',
          safeNum(e.previous_reading),
          safeNum(e.current_reading),
          safeNum(e.consumption),
          e.uom ?? '-',
          e.photo_url ? 'Sí' : 'No',
        ]),
      });
    }

    // ── Petty Cash ─────────────────────────────────────────────────────────
    if (data.pettyCash) {
      const p = data.pettyCash;
      sections.push({
        name: 'Petty Cash',
        headers: ['Establecido ($)', 'Recibos ($)', 'Efectivo ($)', 'Total ($)', 'Diferencia ($)', 'Foto'],
        rows: [[
          safeNum(p.established_amount),
          safeNum(p.receipts),
          safeNum(p.cash),
          safeNum(p.total),
          safeNum(p.difference),
          p.photo_url ? 'Sí' : 'No',
        ]],
      });
    }
  } catch {
    // return whatever we have so far
  }

  return { report, sections };
}

// ============================================================================
// EXCEL EXPORT
// ============================================================================

export async function exportToExcel(
  reports: ReportSummary[],
  apiBaseUrl: string,
  token: string,
): Promise<void> {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Resumen ───────────────────────────────────────────────────────
  const summaryRows = [
    ['Planta', 'Período', 'Estado', 'Iniciado por', 'Fecha Inicio', 'Aprobado por', 'Fecha Aprobación'],
    ...reports.map(r => [
      r.plant_id,
      formatPeriod(r.year_month),
      STATUS_LABELS[r.status] ?? r.status,
      r.created_by ?? '-',
      formatDate(r.created_at),
      r.approved_by ?? '-',
      r.approved_at ? formatDate(r.approved_at) : '-',
    ]),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  // Bold header row
  const range = XLSX.utils.decode_range(wsSummary['!ref'] || 'A1');
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = wsSummary[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = { font: { bold: true } };
  }
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

  // ── Sheet per report: Detalle ──────────────────────────────────────────────
  const details = await Promise.all(
    reports.map(r => fetchDetail(r, apiBaseUrl, token))
  );

  for (const { report, sections } of details) {
    if (!sections.length) continue;

    const sheetName = `${report.plant_id}-${report.year_month}`.slice(0, 31);
    const allRows: any[][] = [];

    // Report header
    allRows.push([`Planta: ${report.plant_id}   Período: ${formatPeriod(report.year_month)}   Estado: ${STATUS_LABELS[report.status] ?? report.status}`]);
    allRows.push([]);

    for (const sec of sections) {
      allRows.push([sec.name.toUpperCase()]);
      allRows.push(sec.headers);
      allRows.push(...sec.rows);
      allRows.push([]); // blank row between sections
    }

    const ws = XLSX.utils.aoa_to_sheet(allRows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // ── Trigger download ───────────────────────────────────────────────────────
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `PROMIX-Inventarios-${date}.xlsx`);
}

// ============================================================================
// PDF EXPORT
// ============================================================================

const BANNER_H = 15; // mm — dark header banner on detail pages
const PHOTO_BLOCK_H = 38; // mm

async function renderSectionPhotos(
  doc: jsPDF,
  section: SectionDetail,
  token: string,
  startY: number,
  pageW: number,
  pageH: number,
): Promise<number> {
  if (!section.photos?.length) return startY;

  const photos = await Promise.all(
    section.photos.map(async (photo) => ({
      ...photo,
      image: await loadRemoteImage(photo.url, token),
    })),
  );
  const availablePhotos = photos.filter((photo) => photo.image);
  if (!availablePhotos.length) return startY;

  let y = startY;
  const marginX = 10;
  const gap = 6;
  const columns = 3;
  const cardW = (pageW - marginX * 2 - gap * (columns - 1)) / columns;
  const imageH = 24;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 58, 54);
  doc.text(`Miniaturas de fotos - ${section.name}`, marginX, y);
  y += 4;

  for (let i = 0; i < availablePhotos.length; i++) {
    const column = i % columns;
    if (column === 0 && i > 0) {
      y += PHOTO_BLOCK_H;
    }

    if (y + PHOTO_BLOCK_H > pageH - 12) {
      doc.addPage();
      y = 12;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 58, 54);
      doc.text(`Miniaturas de fotos - ${section.name}`, marginX, y);
      y += 4;
    }

    const photo = availablePhotos[i];
    const x = marginX + column * (cardW + gap);
    const img = photo.image!;
    const aspect = img.width / img.height;
    const drawW = aspect >= 1 ? cardW : imageH * aspect;
    const drawH = aspect >= 1 ? cardW / aspect : imageH;
    const finalW = Math.min(drawW, cardW);
    const finalH = Math.min(drawH, imageH);
    const imgX = x + (cardW - finalW) / 2;
    const imgY = y;

    doc.setDrawColor(157, 155, 154);
    doc.roundedRect(x, y, cardW, imageH, 1.5, 1.5);
    doc.addImage(img.dataUrl, img.format, imgX, imgY, finalW, finalH);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(95, 103, 115);
    const truncated = photo.label.length > 28 ? `${photo.label.slice(0, 25)}...` : photo.label;
    doc.text(truncated, x, y + imageH + 4);
  }

  return y + PHOTO_BLOCK_H;
}

interface PdfExportOptions {
  mode?: 'download' | 'preview';
  fileName?: string;
}

export async function exportToPDF(
  reports: ReportSummary[],
  apiBaseUrl: string,
  token: string,
  generatedBy: string = 'Sistema',
  options: PdfExportOptions = {},
): Promise<string | void> {
  const { mode = 'download', fileName } = options;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Capture generation timestamp once (used in footer of every page)
  const genNow = new Date();
  const genDateStr =
    genNow.toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    genNow.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Load Promix logo (graceful — continues without logo if fetch fails)
  const logo = await loadLogoImage();

  // ── Page 1: Summary ────────────────────────────────────────────────────────

  // Logo — top-left corner
  if (logo) {
    doc.addImage(logo.dataUrl, 'PNG', 10, 3, logo.displayW, logo.displayH);
  }

  // Title and subtitle centered
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 58, 54);
  doc.text('PROMIX – Reporte de Inventarios', pageW / 2, 10, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(95, 103, 115);
  doc.text(
    `${genDateStr}  |  Total reportes: ${reports.length}`,
    pageW / 2, 16, { align: 'center' },
  );

  // Summary table
  autoTable(doc, {
    startY: 21,
    head: [['Planta', 'Período', 'Estado', 'Iniciado por', 'Fecha Inicio', 'Aprobado por', 'Fecha Aprobación']],
    body: reports.map(r => [
      r.plant_id,
      formatPeriod(r.year_month),
      STATUS_LABELS[r.status] ?? r.status,
      r.created_by ?? '-',
      formatDate(r.created_at),
      r.approved_by ?? '-',
      r.approved_at ? formatDate(r.approved_at) : '-',
    ]),
    headStyles: { fillColor: [59, 58, 54], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [242, 243, 245] },
    margin: { left: 10, right: 10 },
  });

  // ── Detail per report ──────────────────────────────────────────────────────
  const details = await Promise.all(
    reports.map(r => fetchDetail(r, apiBaseUrl, token))
  );

  for (const { report, sections } of details) {
    if (!sections.length) continue;

    doc.addPage();

    // Dark banner
    doc.setFillColor(59, 58, 54);
    doc.rect(0, 0, pageW, BANNER_H, 'F');

    // Logo inside banner — white background patch to ensure visibility
    if (logo) {
      const logoPad = 1.5;
      const logoY = (BANNER_H - logo.displayH) / 2;
      doc.setFillColor(255, 255, 255);
      doc.rect(5 - logoPad, logoY - logoPad, logo.displayW + 2 * logoPad, logo.displayH + 2 * logoPad, 'F');
      doc.addImage(logo.dataUrl, 'PNG', 5, logoY, logo.displayW, logo.displayH);
    }

    // Banner text: plant · period · status
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `${report.plant_id}  ·  ${formatPeriod(report.year_month)}  ·  ${STATUS_LABELS[report.status] ?? report.status}`,
      pageW / 2, BANNER_H * 0.65, { align: 'center' },
    );
    doc.setTextColor(0, 0, 0);

    let y = BANNER_H + 5;

    for (const sec of sections) {
      // Section title
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(36, 117, 199);
      doc.text(sec.name.toUpperCase(), 10, y);
      doc.setTextColor(0, 0, 0);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [sec.headers],
        body: sec.rows.map(row => row.map(String)),
        headStyles: { fillColor: [36, 117, 199], textColor: 255, fontStyle: 'bold', fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        alternateRowStyles: { fillColor: [242, 243, 245] },
        margin: { left: 10, right: 10 },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
      if (sec.photos?.length) {
        y = await renderSectionPhotos(doc, sec, token, y, pageW, pageH) + 8;
      }
      if (y > pageH - 20) {
        doc.addPage();
        y = 12;
      }
    }
  }

  // ── Footer on every page ───────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  const footerY = pageH - 5;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);

    // Left: generation timestamp + user
    doc.text(
      `Generado: ${genDateStr}  ·  ${generatedBy}`,
      10, footerY, { align: 'left' },
    );

    // Right: page number
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageW - 10, footerY, { align: 'right' },
    );
  }

  const resolvedFileName = fileName || `PROMIX-Inventarios-${new Date().toISOString().slice(0, 10)}.pdf`;

  if (mode === 'preview') {
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    return blobUrl;
  }

  doc.save(resolvedFileName);
}
