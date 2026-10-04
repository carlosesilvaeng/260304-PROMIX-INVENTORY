import { getAllReportRows } from '../../utils/reportTransport';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { UserRole } from '../../utils/permissions';
import { exportSettingsWorkbook } from '../../utils/exportSettingsWorkbooks';
import { Download } from 'lucide-react';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server`;

// ============================================================================
// TYPES
// ============================================================================

interface InventoryFlow {
  id: string;
  plant_id: string;
  year_month: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED';
  created_by: string;
  created_at: string;
  submitted_by?: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  approval_notes?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_notes?: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  user_id?: string;
  user_email: string;
  user_name?: string;
  action: string;
  plant_id?: string;
  inventory_month_id?: string;
  details?: {
    section?: string;
    captured_count?: number;
    complete_count?: number;
    pending_count?: number;
    year_month?: string;
    reason?: string;
    notes?: string;
    role?: string;
  };
}

interface AuditUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

const ACTION_LABELS: Record<string, string> = {
  REPORT_DELETED: 'Inventario eliminado',
  CONFIGURATION_IMPORT_PREVIEWED: 'Configuración: vista previa revisada',
  CONFIGURATION_IMPORTED: 'Configuración importada',
  INVENTORY_STARTED: 'Inventario iniciado',
  INVENTORY_SUBMITTED: 'Inventario enviado para aprobación',
  INVENTORY_APPROVED: 'Inventario aprobado',
  INVENTORY_REJECTED: 'Inventario rechazado',
  SECTION_SAVED: 'Sección guardada',
  INVENTORY_PHOTO_UPLOAD_CONFIRMED: 'Subida de fotografía confirmada',
  SECTION_SAVE_FAILED: 'Guardado fallido',
  INVENTORY_CAPTURE_STARTED: 'Captura iniciada (informada por el dispositivo)',
  INVENTORY_DRAFT_SAVED: 'Borrador guardado',
  USER_LOGIN: 'Inicio de sesión',
};

const ACTION_ICONS: Record<string, string> = {
  REPORT_DELETED: '🗑️',
  INVENTORY_STARTED: '🟢',
  INVENTORY_SUBMITTED: '📤',
  INVENTORY_APPROVED: '✅',
  INVENTORY_REJECTED: '❌',
  SECTION_SAVED: '💾',
  INVENTORY_PHOTO_UPLOAD_CONFIRMED: '📷',
  SECTION_SAVE_FAILED: '⚠️',
  INVENTORY_CAPTURE_STARTED: '✏️',
  INVENTORY_DRAFT_SAVED: '💾',
  USER_LOGIN: '🔐',
};

const SECTION_LABELS: Record<string, string> = {
  aggregates: 'Agregados',
  silos: 'Silos',
  additives: 'Aditivos',
  diesel: 'Diesel',
  products: 'Aceites y Productos',
  utilities: 'Utilidades',
  'petty-cash': 'Petty Cash',
};

const STATUS_CONFIG = {
  IN_PROGRESS: { label: 'En Progreso', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  SUBMITTED:   { label: 'Enviado',     color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  APPROVED:    { label: 'Aprobado',    color: 'text-green-700 bg-green-50 border-green-200' },
};

function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('es-PR', { month: 'long', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-PR', {
    timeZone:'America/Puerto_Rico', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function formatExactDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-PR', {
    timeZone:'America/Puerto_Rico', year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'hace un momento';
  if (diffMins < 60) return `hace ${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `hace ${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'ayer';
  return `hace ${diffDays} días`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AuditPanel() {
  const { user, accessToken, allPlants } = useAuth();
  const [flows, setFlows] = useState<InventoryFlow[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<AuditUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plantFilter, setPlantFilter] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [exportingExcel, setExportingExcel] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const dataController = useRef<AbortController | null>(null);
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;

    const res = await fetch(`${API_BASE_URL}/auth/users`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken || publicAnonKey}`,
      },
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Error al cargar usuarios');

    const sourceUsers: AuditUser[] = json.users || [];
    const filteredUsers = sourceUsers
      .filter((u) => u.is_active)
      .filter((u) => user?.role === 'super_admin' || u.role !== 'super_admin')
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    setUsers(filteredUsers);
  }, [accessToken, isAdmin, user?.role]);

  const fetchData = useCallback(async () => {
    dataController.current?.abort();const controller=new AbortController();dataController.current=controller;const signal=controller.signal;
    setLoading(true); setError(null); setFlows([]); setLogs([]);
    try {
      const filters = {plant_id:plantFilter||undefined,year_month:periodFilter||undefined};
      const [flowData,logData] = await Promise.all([
        getAllReportRows(API_BASE_URL,accessToken||'',filters,{signal},'/audit/flow'),
        getAllReportRows(API_BASE_URL,accessToken||'',{...filters,user_id:userFilter||undefined},{signal},'/audit/logs'),
      ]);
      if(signal?.aborted)return;
      setFlows(flowData.rows);setLogs(logData.rows);
    }catch(error:any){if(!signal?.aborted)setError(error.message);}finally{if(!signal?.aborted)setLoading(false);}
  },[accessToken,plantFilter,periodFilter,userFilter]);

  useEffect(() => {
    fetchUsers().catch((err: any) => setError(err.message));
  }, [fetchUsers]);

  useEffect(() => {
    void fetchData();return()=>dataController.current?.abort();
  }, [fetchData]);

  // Unique plant IDs from flows for the filter dropdown
  const availablePlants = allPlants.filter(plant=>user?.role!=='plant_manager'||user.assigned_plants.includes(plant.id)).map(plant=>plant.id).sort();
  const userOptions = users.length > 0
    ? users.map((u) => ({
        id: u.id,
        label: `${u.name} (${u.email})`,
      }))
    : Array.from(
        new Map(
          logs
            .filter((l) => !!l.user_id)
            .map((l) => [
              l.user_id!,
              {
                id: l.user_id!,
                label: `${l.user_name || l.user_email} (${l.user_email})`,
              },
            ])
        ).values()
      ).sort((a, b) => a.label.localeCompare(b.label, 'es'));

  const getActionLabel = (log: AuditLog) => {
    if (log.action === 'SECTION_SAVED' && log.details?.section) {
      const counts = log.details.complete_count === undefined ? '' : ` · ${log.details.captured_count} con información, ${log.details.complete_count} completos, ${log.details.pending_count} pendientes`;
      return `Sección guardada: ${SECTION_LABELS[log.details.section] || log.details.section}${counts}`;
    }
    return ACTION_LABELS[log.action] || log.action;
  };

  const formatDetails = (details?: AuditLog['details']) => {
    if (!details) return '-';
    return Object.entries(details)
      .filter(([key]) => !['reporting_metadata','configured_sections','confirmed_photo_urls'].includes(key))
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
      .join(' | ') || '-';
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    setError(null);
    try {
      const filters={plant_id:plantFilter||undefined,year_month:periodFilter||undefined};
      const [flowResult,logResult]=await Promise.all([getAllReportRows(API_BASE_URL,accessToken||'',filters,{},'/audit/flow'),getAllReportRows(API_BASE_URL,accessToken||'',{...filters,user_id:userFilter||undefined},{},'/audit/logs')]);
      const selectedUserLabel = userOptions.find((option) => option.id === userFilter)?.label;
      const filterSummary = [
        plantFilter ? `Planta: ${plantFilter}` : 'Todas las plantas',
        periodFilter ? `Período: ${periodFilter}` : 'Todos los períodos',
        selectedUserLabel ? `Usuario de eventos: ${selectedUserLabel}` : 'Todos los usuarios',
      ].join(' | ');

      await exportSettingsWorkbook(
        `Auditoria - ${filterSummary}`,
        [
          {
            name: 'Flujo inventarios',
            headers: [
              'Planta',
              'Periodo',
              'Estado',
              'Creado por',
              'Creado',
              'Enviado por',
              'Enviado',
              'Aprobado por',
              'Aprobado',
              'Notas aprobacion',
              'Rechazado por',
              'Rechazado',
              'Notas rechazo',
            ],
            rows: flowResult.rows.map((flow) => [
              flow.plant_id,
              formatMonthLabel(flow.year_month),
              STATUS_CONFIG[flow.status]?.label || flow.status,
              flow.created_by,
              formatExactDateTime(flow.created_at),
              flow.submitted_by || '-',
              flow.submitted_at ? formatExactDateTime(flow.submitted_at) : '-',
              flow.approved_by || '-',
              flow.approved_at ? formatExactDateTime(flow.approved_at) : '-',
              flow.approval_notes || '-',
              flow.rejected_by || '-',
              flow.rejected_at ? formatExactDateTime(flow.rejected_at) : '-',
              flow.rejection_notes || '-',
            ]),
          },
          {
            name: 'Eventos',
            headers: ['Fecha', 'Accion', 'Usuario', 'Correo', 'Planta', 'Inventario', 'Detalles'],
            rows: logResult.rows.map((log) => [
              formatExactDateTime(log.timestamp),
              getActionLabel(log),
              log.user_name || '-',
              log.user_email,
              log.plant_id || '-',
              log.inventory_month_id || '-',
              formatDetails(log.details),
            ]),
          },
        ],
        'PROMIX-Auditoria'
      );
    } catch (err: any) {
      setError(err.message || 'No se pudo exportar auditoria a Excel.');
    } finally {
      setExportingExcel(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">

      {/* Header + Filter */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#3B3A36]">Auditoría</h3>
          <p className="text-sm text-[#5F6773]">Flujo de inventarios y registro de actividad</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">Período <input type="month" value={periodFilter} onChange={event=>setPeriodFilter(event.target.value)} className="min-h-11 rounded border px-2"/></label>
          {isAdmin && availablePlants.length > 0 && (
            <select
              value={plantFilter}
              onChange={e => setPlantFilter(e.target.value)}
              className="text-sm border border-[#9D9B9A] rounded px-3 py-1.5 text-[#3B3A36] bg-white"
            >
              <option value="">Todas las plantas</option>
              {availablePlants.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
          {isAdmin && (
            <select
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              disabled={userOptions.length === 0}
              className="text-sm border border-[#9D9B9A] rounded px-3 py-1.5 text-[#3B3A36] bg-white"
            >
              <option value="">
                {userOptions.length === 0 ? 'Sin usuarios disponibles' : 'Todos los usuarios'}
              </option>
              {userOptions.map(u => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={()=>fetchData()}
            className="text-sm px-3 py-1.5 border border-[#9D9B9A] rounded text-[#5F6773] hover:text-[#3B3A36] hover:bg-[#F2F3F5] transition-colors"
          >
            ↻ Actualizar
          </button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportExcel}
            loading={exportingExcel}
            disabled={loading || (flows.length === 0 && logs.length === 0)}
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          Error al cargar datos: {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-[#5F6773]">Cargando auditoría...</div>
      ) : (
        <>
          {/* ── FLUJO DE INVENTARIOS ──────────────────────────────────── */}
          <div>
            <h4 className="text-sm font-semibold text-[#5F6773] uppercase tracking-wide mb-3">
              Flujo de Inventarios
            </h4>

            {flows.length === 0 ? (
              <Card>
                <p className="text-center text-[#5F6773] text-sm py-4">
                  No hay inventarios registrados aún.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {flows.map(flow => {
                  const statusCfg = STATUS_CONFIG[flow.status] || STATUS_CONFIG.IN_PROGRESS;
                  const wasRejected = !!flow.rejected_at;

                  return (
                    <Card key={flow.id}>
                      {/* Card header */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="font-semibold text-[#3B3A36]">{flow.plant_id}</span>
                          <span className="text-[#5F6773] ml-2">·</span>
                          <span className="text-[#5F6773] ml-2 capitalize">
                            {formatMonthLabel(flow.year_month)}
                          </span>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>

                      {/* Timeline steps */}
                      <div className="space-y-2 pl-1">

                        {/* Step 1: Started */}
                        <div className="flex items-start gap-3 text-sm">
                          <span className="mt-0.5">✅</span>
                          <div className="flex-1">
                            <span className="text-[#3B3A36]">Inventario iniciado</span>
                            {flow.created_by && (
                              <span className="text-[#5F6773] ml-1">por {flow.created_by}</span>
                            )}
                          </div>
                          <span className="text-xs text-[#5F6773] whitespace-nowrap">
                            {formatDateTime(flow.created_at)}
                          </span>
                        </div>

                        {/* Step 2: Submitted */}
                        {flow.submitted_at ? (
                          <div className="flex items-start gap-3 text-sm">
                            <span className="mt-0.5">📤</span>
                            <div className="flex-1">
                              <span className="text-[#3B3A36]">Enviado para aprobación</span>
                              {flow.submitted_by && (
                                <span className="text-[#5F6773] ml-1">por {flow.submitted_by}</span>
                              )}
                            </div>
                            <span className="text-xs text-[#5F6773] whitespace-nowrap">
                              {formatDateTime(flow.submitted_at)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3 text-sm">
                            <span className="mt-0.5 opacity-30">⏳</span>
                            <span className="text-[#9D9B9A] italic">Pendiente de envío...</span>
                          </div>
                        )}

                        {/* Step 3: Rejected (if any) */}
                        {wasRejected && (
                          <div className="flex items-start gap-3 text-sm">
                            <span className="mt-0.5">↩️</span>
                            <div className="flex-1">
                              <span className="text-red-600">Rechazado</span>
                              {flow.rejected_by && (
                                <span className="text-[#5F6773] ml-1">por {flow.rejected_by}</span>
                              )}
                              {flow.rejection_notes && (
                                <p className="text-xs text-[#5F6773] mt-0.5">"{flow.rejection_notes}"</p>
                              )}
                            </div>
                            <span className="text-xs text-[#5F6773] whitespace-nowrap">
                              {formatDateTime(flow.rejected_at!)}
                            </span>
                          </div>
                        )}

                        {/* Step 4: Approved */}
                        {flow.approved_at && (
                          <div className="flex items-start gap-3 text-sm">
                            <span className="mt-0.5">✅</span>
                            <div className="flex-1">
                              <span className="text-green-700 font-medium">Aprobado</span>
                              {flow.approved_by && (
                                <span className="text-[#5F6773] ml-1">por {flow.approved_by}</span>
                              )}
                              {flow.approval_notes && (
                                <p className="text-xs text-[#5F6773] mt-0.5">"{flow.approval_notes}"</p>
                              )}
                            </div>
                            <span className="text-xs text-[#5F6773] whitespace-nowrap">
                              {formatDateTime(flow.approved_at)}
                            </span>
                          </div>
                        )}

                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── REGISTRO DE EVENTOS ───────────────────────────────────── */}
          <div>
            <h4 className="text-sm font-semibold text-[#5F6773] uppercase tracking-wide mb-3">
              Registro de Eventos
            </h4>

            {logs.length === 0 ? (
              <Card>
                <p className="text-center text-[#5F6773] text-sm py-4">
                  No hay eventos registrados aún. Los eventos se irán registrando con el uso del sistema.
                </p>
              </Card>
            ) : (
              <Card noPadding>
                <div className="divide-y divide-[#F2F3F5]">
                  {logs.map(log => {
                    const icon = ACTION_ICONS[log.action] || '📋';
                    const label = getActionLabel(log);

                    return (
                      <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-lg flex-shrink-0">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#3B3A36]">{label}</p>
                          <p className="text-xs text-[#5F6773] truncate">
                            {log.user_name || log.user_email}
                            {log.plant_id && ` · ${log.plant_id}`}
                          </p>
                        </div>
                        <div
                          className="flex-shrink-0 text-right"
                          title={formatExactDateTime(log.timestamp)}
                        >
                          <p className="text-xs text-[#9D9B9A]">{timeAgo(log.timestamp)}</p>
                          <p className="text-[11px] text-[#5F6773] whitespace-nowrap mt-0.5">
                            {formatExactDateTime(log.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
