import { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { Alert } from '../components/Alert';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PromixLogo } from '../components/PromixLogo';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { exportToExcel, exportToPDF } from '../utils/exportReports';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-02205af0`;

// ============================================================================
// TYPES
// ============================================================================

interface Report {
  id: string;
  plant_id: string;
  year_month: string;     // "2025-02"
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED';
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const MONTH_NAMES: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

const MONTH_TO_NUM: Record<string, string> = {
  'Enero': '01', 'Febrero': '02', 'Marzo': '03', 'Abril': '04',
  'Mayo': '05', 'Junio': '06', 'Julio': '07', 'Agosto': '08',
  'Septiembre': '09', 'Octubre': '10', 'Noviembre': '11', 'Diciembre': '12',
};

function formatPeriod(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${MONTH_NAMES[month] || month} ${year}`;
}

function formatDateTime(iso: string, locale: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(locale === 'es' ? 'es-PR' : 'en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
    }),
    time: d.toLocaleTimeString(locale === 'es' ? 'es-PR' : 'en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    }),
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

interface ReportsProps {
  onNavigate?: (view: string) => void;
}

export function Reports({ onNavigate }: ReportsProps) {
  const { user, accessToken } = useAuth();
  const { t, language } = useLanguage();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/reports`, {
        headers: { Authorization: `Bearer ${accessToken || publicAnonKey}` },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Error al cargar reportes');
      setReports(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // ── Filter client-side ────────────────────────────────────────────────────

  const filteredReports = reports.filter(r => {
    const [year, month] = r.year_month.split('-');
    if (selectedYear !== 'all' && year !== selectedYear) return false;
    if (selectedMonth !== 'all' && month !== MONTH_TO_NUM[selectedMonth]) return false;
    return true;
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  const currentYear = new Date().getFullYear().toString();
  const thisYearCount = reports.filter(r => r.year_month.startsWith(currentYear)).length;
  const approvedCount = reports.filter(r => r.status === 'APPROVED').length;

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExportExcel = async () => {
    if (!filteredReports.length) return;
    setExportingExcel(true);
    setExportError(null);
    try {
      await exportToExcel(filteredReports, API_BASE_URL, accessToken || publicAnonKey);
      setShowExportSuccess(true);
      setTimeout(() => setShowExportSuccess(false), 3000);
    } catch (err: any) {
      setExportError('Error al exportar Excel: ' + err.message);
      setTimeout(() => setExportError(null), 4000);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    if (!filteredReports.length) return;
    setExportingPDF(true);
    setExportError(null);
    try {
      await exportToPDF(filteredReports, API_BASE_URL, accessToken || publicAnonKey);
      setShowExportSuccess(true);
      setTimeout(() => setShowExportSuccess(false), 3000);
    } catch (err: any) {
      setExportError('Error al exportar PDF: ' + err.message);
      setTimeout(() => setExportError(null), 4000);
    } finally {
      setExportingPDF(false);
    }
  };

  // ── Status badge ──────────────────────────────────────────────────────────

  function StatusBadge({ status }: { status: Report['status'] }) {
    const config = {
      APPROVED:    { label: t('status.approved'),   cls: 'bg-[#2ecc71]/10 text-[#2ecc71]' },
      SUBMITTED:   { label: 'Enviado',              cls: 'bg-[#2475C7]/10 text-[#2475C7]' },
      IN_PROGRESS: { label: t('status.inProgress'), cls: 'bg-[#f59e0b]/10 text-[#f59e0b]' },
    }[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
    return (
      <span className={`px-3 py-1 rounded text-sm ${config.cls}`}>{config.label}</span>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Logo Header */}
      <div className="flex justify-center mb-2">
        <PromixLogo size="lg" />
      </div>

      <div>
        <h2 className="text-2xl text-[#3B3A36]">Reportes</h2>
        <p className="text-[#5F6773]">Historial y exportación de inventarios</p>
      </div>

      {showExportSuccess && (
        <Alert type="success" message="Archivo generado y descargado exitosamente" autoClose />
      )}

      {exportError && (
        <Alert type="error" message={exportError} />
      )}

      {error && (
        <Alert type="error" message={`Error al cargar reportes: ${error}`} />
      )}

      {/* Filters */}
      <Card>
        <h3 className="text-lg text-[#3B3A36] mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Mes"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            options={[
              { value: 'all', label: 'Todos los meses' },
              ...Object.keys(MONTH_TO_NUM).map(m => ({ value: m, label: m })),
            ]}
          />

          <Select
            label="Año"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            options={[
              { value: 'all', label: 'Todos los años' },
              { value: '2026', label: '2026' },
              { value: '2025', label: '2025' },
              { value: '2024', label: '2024' },
              { value: '2023', label: '2023' },
            ]}
          />

          <div className="flex items-end gap-2">
            <Button
              variant="secondary"
              onClick={handleExportPDF}
              disabled={exportingPDF || !filteredReports.length}
              className="flex-1"
            >
              {exportingPDF ? '⏳ Generando...' : '📄 PDF'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportExcel}
              disabled={exportingExcel || !filteredReports.length}
              className="flex-1"
            >
              {exportingExcel ? '⏳ Generando...' : '📊 Excel'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Reports Table */}
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#3B3A36] text-white">
              <tr>
                <th className="px-6 py-3 text-left">Planta</th>
                <th className="px-6 py-3 text-left">Período</th>
                <th className="px-6 py-3 text-left">Fecha Completado</th>
                <th className="px-6 py-3 text-left">Iniciado por</th>
                <th className="px-6 py-3 text-left">Aprobado por</th>
                <th className="px-6 py-3 text-center">Estado</th>
                <th className="px-6 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#5F6773]">
                    Cargando reportes...
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#5F6773]">
                    No hay reportes que coincidan con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => {
                  const completedAt = report.approved_at || (report.status !== 'IN_PROGRESS' ? report.updated_at : null);
                  const completedDT = completedAt ? formatDateTime(completedAt, language) : null;
                  const createdDT   = formatDateTime(report.created_at, language);
                  const approvedDT  = report.approved_at ? formatDateTime(report.approved_at, language) : null;

                  return (
                    <tr key={report.id} className="border-b border-[#9D9B9A] hover:bg-[#F2F3F5] transition-colors">

                      <td className="px-6 py-4">
                        <p className="text-[#3B3A36] font-medium">{report.plant_id}</p>
                      </td>

                      <td className="px-6 py-4 text-[#3B3A36]">
                        {formatPeriod(report.year_month)}
                      </td>

                      <td className="px-6 py-4">
                        {completedDT ? (
                          <>
                            <p className="text-[#3B3A36] text-sm">{completedDT.date}</p>
                            <p className="text-xs text-[#5F6773]">{completedDT.time}</p>
                          </>
                        ) : (
                          <p className="text-[#9D9B9A] text-sm">{t('status.inProgress')}</p>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <p className="text-[#3B3A36] text-sm font-medium">{report.created_by}</p>
                        <div className="mt-1 pt-1 border-t border-[#9D9B9A]/20">
                          <p className="text-xs text-[#2475C7] font-medium">{createdDT.date}</p>
                          <p className="text-xs text-[#5F6773]">{createdDT.time}</p>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {report.approved_by ? (
                          <>
                            <p className="text-[#3B3A36] text-sm font-medium">{report.approved_by}</p>
                            {approvedDT && (
                              <div className="mt-1 pt-1 border-t border-[#9D9B9A]/20">
                                <p className="text-xs text-[#2ecc71] font-medium">{approvedDT.date}</p>
                                <p className="text-xs text-[#5F6773]">{approvedDT.time}</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-[#9D9B9A] text-sm">{t('review.pendingApproval')}</p>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={report.status} />
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onNavigate?.('review')}
                          >
                            {t('common.view')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Exportar PDF de este reporte"
                            onClick={() => exportToPDF([report], API_BASE_URL, accessToken || publicAnonKey)}
                          >
                            📄
                          </Button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <h3 className="text-sm text-[#5F6773] mb-1">Total Reportes</h3>
          <p className="text-3xl font-bold text-[#2475C7]">{filteredReports.length}</p>
        </Card>
        <Card>
          <h3 className="text-sm text-[#5F6773] mb-1">Este Año</h3>
          <p className="text-3xl font-bold text-[#2475C7]">{thisYearCount}</p>
        </Card>
        <Card>
          <h3 className="text-sm text-[#5F6773] mb-1">Aprobados</h3>
          <p className="text-3xl font-bold text-[#2ecc71]">{approvedCount}</p>
        </Card>
      </div>
    </div>
  );
}
