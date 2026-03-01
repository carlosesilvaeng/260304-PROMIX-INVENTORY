/**
 * exportReports.ts
 * Client-side export utilities for the Reports page.
 * Generates Excel (.xlsx) and PDF files from the filtered inventory list,
 * including summary + section-level detail fetched from the API.
 */

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
}

interface ReportDetail {
  report: ReportSummary;
  sections: SectionDetail[];
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
        headers: ['Nombre', 'Material', 'Método', 'Volumen (cy)', 'Foto'],
        rows: data.agregados.map((e: any) => [
          e.aggregate_name ?? '-',
          e.material_type ?? '-',
          e.measurement_method ?? '-',
          safeNum(e.calculated_volume_cy),
          e.photo_url ? 'Sí' : 'No',
        ]),
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

export async function exportToPDF(
  reports: ReportSummary[],
  apiBaseUrl: string,
  token: string,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const date = new Date().toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' });

  // ── Title ──────────────────────────────────────────────────────────────────
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PROMIX – Reporte de Inventarios', pageW / 2, 14, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado: ${date}  |  Total reportes: ${reports.length}`, pageW / 2, 20, { align: 'center' });

  // ── Summary table ──────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: 25,
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

    // Report header banner
    doc.setFillColor(59, 58, 54);
    doc.rect(0, 0, pageW, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `${report.plant_id}  ·  ${formatPeriod(report.year_month)}  ·  ${STATUS_LABELS[report.status] ?? report.status}`,
      pageW / 2, 8, { align: 'center' }
    );
    doc.setTextColor(0, 0, 0);

    let y = 18;

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
        didDrawPage: () => { y = 18; },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 18;
      }
    }
  }

  // ── Page numbers ───────────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageW - 10, doc.internal.pageSize.getHeight() - 5,
      { align: 'right' }
    );
  }

  const fileName = `PROMIX-Inventarios-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
