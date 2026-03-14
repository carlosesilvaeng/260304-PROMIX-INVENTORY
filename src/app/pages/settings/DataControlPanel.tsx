import { useEffect, useMemo, useState } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../contexts/AuthContext';
import {
  executeTransactionalCleanup,
  getDataControlInventories,
  getDataControlSummary,
  previewTransactionalCleanup,
  type DataControlInventoryListItem,
  type DataControlSummary,
  type InventoryStatus,
  type TransactionalCleanupFilters,
  type TransactionalCleanupPreview,
} from '../../utils/api';

type AlertState = {
  type: 'success' | 'error' | 'info';
  message: string;
} | null;

type CleanupIntent = {
  title: string;
  payload: TransactionalCleanupFilters;
};

const STATUS_OPTIONS: Array<{ value: InventoryStatus; label: string }> = [
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'SUBMITTED', label: 'Enviado' },
  { value: 'APPROVED', label: 'Aprobado' },
];

const CHILD_TABLE_LABELS: Record<string, string> = {
  inventory_month: 'Inventarios',
  inventory_aggregates_entries: 'Agregados',
  inventory_silos_entries: 'Silos',
  inventory_additives_entries: 'Aditivos',
  inventory_diesel_entries: 'Diesel',
  inventory_products_entries: 'Productos',
  inventory_utilities_entries: 'Utilidades',
  inventory_petty_cash_entries: 'Petty cash',
};

function formatYearMonthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('es-PR', { month: 'long', year: 'numeric' });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-PR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: InventoryStatus }) {
  const config = {
    IN_PROGRESS: 'bg-[#f59e0b]/10 text-[#f59e0b]',
    SUBMITTED: 'bg-[#2475C7]/10 text-[#2475C7]',
    APPROVED: 'bg-[#2ecc71]/10 text-[#2ecc71]',
  }[status];

  const label = STATUS_OPTIONS.find((option) => option.value === status)?.label || status;

  return <span className={`px-3 py-1 rounded text-xs font-medium ${config}`}>{label}</span>;
}

function KpiCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number;
  subtitle?: string;
}) {
  return (
    <Card className="space-y-1">
      <p className="text-sm text-[#5F6773]">{title}</p>
      <p className="text-3xl font-semibold text-[#3B3A36]">{value.toLocaleString('en-US')}</p>
      {subtitle ? <p className="text-xs text-[#5F6773]">{subtitle}</p> : null}
    </Card>
  );
}

export function DataControlPanel() {
  const { allPlants } = useAuth();
  const [summary, setSummary] = useState<DataControlSummary | null>(null);
  const [inventories, setInventories] = useState<DataControlInventoryListItem[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingInventories, setLoadingInventories] = useState(true);
  const [alertState, setAlertState] = useState<AlertState>(null);
  const [inventoryPlantFilter, setInventoryPlantFilter] = useState('ALL');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<'ALL' | InventoryStatus>('ALL');
  const [inventoryMonthFrom, setInventoryMonthFrom] = useState('');
  const [inventoryMonthTo, setInventoryMonthTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [cleanupPlantIds, setCleanupPlantIds] = useState<string[]>([]);
  const [cleanupStatuses, setCleanupStatuses] = useState<InventoryStatus[]>(STATUS_OPTIONS.map((option) => option.value));
  const [cleanupMonthFrom, setCleanupMonthFrom] = useState('');
  const [cleanupMonthTo, setCleanupMonthTo] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executingCleanup, setExecutingCleanup] = useState(false);
  const [cleanupIntent, setCleanupIntent] = useState<CleanupIntent | null>(null);
  const [previewData, setPreviewData] = useState<TransactionalCleanupPreview | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [reason, setReason] = useState('');

  const totalPages = Math.max(1, Math.ceil(totalItems / 25));

  const inventoryFilters = useMemo(() => ({
    plantId: inventoryPlantFilter !== 'ALL' ? inventoryPlantFilter : undefined,
    yearMonthFrom: inventoryMonthFrom || undefined,
    yearMonthTo: inventoryMonthTo || undefined,
    status: inventoryStatusFilter,
    page: currentPage,
    pageSize: 25,
  }), [currentPage, inventoryMonthFrom, inventoryMonthTo, inventoryPlantFilter, inventoryStatusFilter]);

  const resetCleanupState = () => {
    setCleanupIntent(null);
    setPreviewData(null);
    setShowPreviewModal(false);
    setShowConfirmModal(false);
    setConfirmationText('');
    setReason('');
  };

  const fetchSummary = async () => {
    setLoadingSummary(true);
    const response = await getDataControlSummary();
    if (!response.success || !response.data) {
      setAlertState({ type: 'error', message: response.error || 'No se pudo cargar el resumen del sistema.' });
      setLoadingSummary(false);
      return;
    }

    setSummary(response.data);
    setLoadingSummary(false);
  };

  const fetchInventories = async () => {
    setLoadingInventories(true);
    const response = await getDataControlInventories(inventoryFilters);
    if (!response.success || !response.data) {
      setAlertState({ type: 'error', message: response.error || 'No se pudo cargar el listado de inventarios.' });
      setLoadingInventories(false);
      return;
    }

    setInventories(response.data.items || []);
    setTotalItems(response.data.pagination.total || 0);
    setLoadingInventories(false);
  };

  const refreshAll = async () => {
    await Promise.all([fetchSummary(), fetchInventories()]);
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchInventories();
  }, [inventoryFilters]);

  const toggleCleanupPlant = (plantId: string) => {
    setCleanupPlantIds((current) =>
      current.includes(plantId)
        ? current.filter((id) => id !== plantId)
        : [...current, plantId]
    );
  };

  const toggleCleanupStatus = (status: InventoryStatus) => {
    setCleanupStatuses((current) =>
      current.includes(status)
        ? current.filter((value) => value !== status)
        : [...current, status]
    );
  };

  const buildBulkPayload = (): TransactionalCleanupFilters => ({
    scope: 'transactional',
    plant_ids: cleanupPlantIds.length > 0 ? cleanupPlantIds : undefined,
    year_month_from: cleanupMonthFrom || undefined,
    year_month_to: cleanupMonthTo || undefined,
    statuses: cleanupStatuses.length > 0 ? cleanupStatuses : undefined,
    include_photos: true,
  });

  const openPreview = async (intent: CleanupIntent) => {
    setPreviewLoading(true);
    setCleanupIntent(intent);
    setAlertState(null);

    const response = await previewTransactionalCleanup(intent.payload);
    setPreviewLoading(false);

    if (!response.success || !response.data) {
      setAlertState({ type: 'error', message: response.error || 'No se pudo previsualizar la limpieza.' });
      return;
    }

    setPreviewData(response.data);
    setShowPreviewModal(true);
  };

  const handleBulkPreview = async () => {
    await openPreview({
      title: 'Limpieza controlada',
      payload: buildBulkPayload(),
    });
  };

  const handleSingleDeletePreview = async (item: DataControlInventoryListItem) => {
    await openPreview({
      title: `Eliminar inventario ${item.plant_id} · ${formatYearMonthLabel(item.year_month)}`,
      payload: {
        scope: 'transactional',
        plant_ids: [item.plant_id],
        year_month_from: item.year_month,
        year_month_to: item.year_month,
        statuses: [item.status],
        include_photos: true,
      },
    });
  };

  const handleExecuteCleanup = async () => {
    if (!previewData?.preview_token || !cleanupIntent) return;

    setExecutingCleanup(true);
    const response = await executeTransactionalCleanup({
      ...cleanupIntent.payload,
      preview_token: previewData.preview_token,
      confirmation_text: confirmationText,
      reason,
    });
    setExecutingCleanup(false);

    if (!response.success || !response.data) {
      setAlertState({ type: 'error', message: response.error || 'No se pudo ejecutar la limpieza.' });
      return;
    }

    resetCleanupState();
    setAlertState({
      type: 'success',
      message: `Limpieza completada: ${response.data.deleted_inventory_months} inventarios y ${response.data.deleted_photos} fotos eliminadas.`,
    });
    await refreshAll();
  };

  return (
    <div className="space-y-6">
      {alertState ? (
        <Alert type={alertState.type} message={alertState.message} />
      ) : null}

      <div>
        <h3 className="text-lg font-semibold text-[#3B3A36]">Control de datos</h3>
        <p className="text-sm text-[#5F6773]">
          Visibilidad del sistema y limpieza controlada de inventarios de prueba.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiCard
          title="Plantas"
          value={summary?.plants.total || 0}
          subtitle={`${summary?.plants.active || 0} activas`}
        />
        <KpiCard title="Inventarios" value={summary?.inventorySummary.total_months || 0} />
        <KpiCard title="Fotos asociadas" value={summary?.photoSummary.total_photos || 0} />
        <KpiCard title="En progreso" value={summary?.inventorySummary.by_status.IN_PROGRESS || 0} />
        <KpiCard title="Aprobados" value={summary?.inventorySummary.by_status.APPROVED || 0} />
      </div>

      <Card noPadding>
        <div className="p-6 border-b border-[#E4E4E4]">
          <h4 className="text-base font-semibold text-[#3B3A36]">Resumen del sistema</h4>
          <p className="text-sm text-[#5F6773]">Cobertura de configuracion y actividad por planta.</p>
        </div>
        {loadingSummary || !summary ? (
          <div className="p-6 text-sm text-[#5F6773]">Cargando resumen...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-[#3B3A36] text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Planta</th>
                  <th className="px-4 py-3 text-center">Agregados</th>
                  <th className="px-4 py-3 text-center">Silos</th>
                  <th className="px-4 py-3 text-center">Aditivos</th>
                  <th className="px-4 py-3 text-center">Diesel</th>
                  <th className="px-4 py-3 text-center">Productos</th>
                  <th className="px-4 py-3 text-center">Utilidades</th>
                  <th className="px-4 py-3 text-center">Petty cash</th>
                  <th className="px-4 py-3 text-center">Inventarios</th>
                  <th className="px-4 py-3 text-center">Fotos</th>
                </tr>
              </thead>
              <tbody>
                {summary.configurationCoverage.map((row) => {
                  const inventoryRow = summary.inventorySummary.by_plant.find((item) => item.plant_id === row.plant_id);
                  const photoRow = summary.photoSummary.by_plant.find((item) => item.plant_id === row.plant_id);

                  return (
                    <tr key={row.plant_id} className="border-b border-[#E4E4E4]">
                      <td className="px-4 py-3 text-[#3B3A36] font-medium">{row.plant_name}</td>
                      <td className="px-4 py-3 text-center">{row.aggregates}</td>
                      <td className="px-4 py-3 text-center">{row.silos}</td>
                      <td className="px-4 py-3 text-center">{row.additives}</td>
                      <td className="px-4 py-3 text-center">{row.diesel}</td>
                      <td className="px-4 py-3 text-center">{row.products}</td>
                      <td className="px-4 py-3 text-center">{row.utilities}</td>
                      <td className="px-4 py-3 text-center">{row.petty_cash}</td>
                      <td className="px-4 py-3 text-center">{inventoryRow?.total_months || 0}</td>
                      <td className="px-4 py-3 text-center">{photoRow?.photos || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card noPadding>
        <div className="p-6 border-b border-[#E4E4E4] space-y-4">
          <div>
            <h4 className="text-base font-semibold text-[#3B3A36]">Inventarios cargados</h4>
            <p className="text-sm text-[#5F6773]">Filtra los inventarios existentes y elimina registros puntuales si lo necesitas.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              value={inventoryPlantFilter}
              onChange={(event) => {
                setInventoryPlantFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-[#C5C6C7] rounded-md bg-white text-[#3B3A36]"
            >
              <option value="ALL">Todas las plantas</option>
              {allPlants.map((plant) => (
                <option key={plant.id} value={plant.id}>{plant.name}</option>
              ))}
            </select>
            <input
              type="month"
              value={inventoryMonthFrom}
              onChange={(event) => {
                setInventoryMonthFrom(event.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-[#C5C6C7] rounded-md text-[#3B3A36]"
            />
            <input
              type="month"
              value={inventoryMonthTo}
              onChange={(event) => {
                setInventoryMonthTo(event.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-[#C5C6C7] rounded-md text-[#3B3A36]"
            />
            <select
              value={inventoryStatusFilter}
              onChange={(event) => {
                setInventoryStatusFilter(event.target.value as 'ALL' | InventoryStatus);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-[#C5C6C7] rounded-md bg-white text-[#3B3A36]"
            >
              <option value="ALL">Todos los estados</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loadingInventories ? (
          <div className="p-6 text-sm text-[#5F6773]">Cargando inventarios...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead className="bg-[#F2F3F5] text-[#3B3A36]">
                  <tr>
                    <th className="px-4 py-3 text-left">Planta</th>
                    <th className="px-4 py-3 text-left">Periodo</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-left">Creado por</th>
                    <th className="px-4 py-3 text-left">Actualizado</th>
                    <th className="px-4 py-3 text-center">Fotos</th>
                    <th className="px-4 py-3 text-left">Secciones</th>
                    <th className="px-4 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {inventories.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-sm text-[#5F6773]">
                        No hay inventarios que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : inventories.map((item) => (
                    <tr key={item.id} className="border-b border-[#E4E4E4]">
                      <td className="px-4 py-3 font-medium text-[#3B3A36]">{item.plant_id}</td>
                      <td className="px-4 py-3 text-[#5F6773] capitalize">{formatYearMonthLabel(item.year_month)}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-3 text-[#5F6773]">{item.created_by}</td>
                      <td className="px-4 py-3 text-[#5F6773]">{formatDateTime(item.updated_at)}</td>
                      <td className="px-4 py-3 text-center">{item.photo_count}</td>
                      <td className="px-4 py-3 text-xs text-[#5F6773]">
                        {Object.entries(item.child_counts)
                          .filter(([, count]) => count > 0)
                          .map(([key, count]) => `${CHILD_TABLE_LABELS[key] || key}: ${count}`)
                          .join(' · ') || 'Sin capturas'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleSingleDeletePreview(item)}
                        >
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-[#E4E4E4] flex items-center justify-between">
              <p className="text-sm text-[#5F6773]">
                Pagina {currentPage} de {totalPages} · {totalItems} registros
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Card className="space-y-4 border-[#C94A4A]/30 bg-[#FFF8F8]">
        <div>
          <h4 className="text-base font-semibold text-[#3B3A36]">Limpieza controlada</h4>
          <p className="text-sm text-[#5F6773]">
            Previsualiza y elimina datos transaccionales de prueba sin tocar configuraciones ni catalogos.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-[#3B3A36] mb-2">Plantas incluidas</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCleanupPlantIds([])}
                className={`px-3 py-1.5 rounded-full border text-sm ${
                  cleanupPlantIds.length === 0
                    ? 'bg-[#2475C7] text-white border-[#2475C7]'
                    : 'bg-white text-[#3B3A36] border-[#C5C6C7]'
                }`}
              >
                Todas
              </button>
              {allPlants.map((plant) => (
                <button
                  key={plant.id}
                  type="button"
                  onClick={() => toggleCleanupPlant(plant.id)}
                  className={`px-3 py-1.5 rounded-full border text-sm ${
                    cleanupPlantIds.includes(plant.id)
                      ? 'bg-[#2475C7] text-white border-[#2475C7]'
                      : 'bg-white text-[#3B3A36] border-[#C5C6C7]'
                  }`}
                >
                  {plant.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="month"
              value={cleanupMonthFrom}
              onChange={(event) => setCleanupMonthFrom(event.target.value)}
              className="px-3 py-2 border border-[#C5C6C7] rounded-md text-[#3B3A36] bg-white"
            />
            <input
              type="month"
              value={cleanupMonthTo}
              onChange={(event) => setCleanupMonthTo(event.target.value)}
              className="px-3 py-2 border border-[#C5C6C7] rounded-md text-[#3B3A36] bg-white"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-[#3B3A36] mb-2">Estados incluidos</p>
            <div className="flex flex-wrap gap-4">
              {STATUS_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-[#3B3A36]">
                  <input
                    type="checkbox"
                    checked={cleanupStatuses.includes(option.value)}
                    onChange={() => toggleCleanupStatus(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[#5F6773]">
            El sistema eliminara inventarios, tablas hijas y fotos asociadas.
          </p>
          <Button
            variant="destructive"
            loading={previewLoading}
            onClick={handleBulkPreview}
          >
            Previsualizar eliminacion
          </Button>
        </div>
      </Card>

      <Modal
        isOpen={showPreviewModal}
        onClose={resetCleanupState}
        title={cleanupIntent?.title || 'Previsualizacion de limpieza'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={resetCleanupState}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!previewData?.preview_token || previewData.inventory_month_ids.length === 0}
              onClick={() => {
                setShowPreviewModal(false);
                setShowConfirmModal(true);
              }}
            >
              Continuar
            </Button>
          </>
        }
      >
        {!previewData ? (
          <p className="text-sm text-[#5F6773]">Cargando previsualizacion...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <KpiCard title="Inventarios" value={previewData.inventory_month_ids.length} />
              <KpiCard title="Tablas hijas" value={Object.values(previewData.counts_by_table).reduce((sum, count) => sum + count, 0) - (previewData.counts_by_table.inventory_month || 0)} />
              <KpiCard title="Fotos a eliminar" value={previewData.deleted_photos_count} />
            </div>

            <Card className="space-y-3 bg-[#F9FAFB]">
              <p className="text-sm font-medium text-[#3B3A36]">Conteos por tabla</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-[#5F6773]">
                {Object.entries(previewData.counts_by_table).map(([key, count]) => (
                  <div key={key} className="flex justify-between gap-4">
                    <span>{CHILD_TABLE_LABELS[key] || key}</span>
                    <strong className="text-[#3B3A36]">{count}</strong>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-[#3B3A36] mb-2">Plantas impactadas</p>
                <p className="text-[#5F6773]">{previewData.plants.join(', ') || 'Ninguna'}</p>
              </div>
              <div>
                <p className="font-medium text-[#3B3A36] mb-2">Meses impactados</p>
                <p className="text-[#5F6773]">{previewData.year_months.map(formatYearMonthLabel).join(', ') || 'Ninguno'}</p>
              </div>
            </div>

            {previewData.warnings.length > 0 ? (
              <div className="space-y-2">
                {previewData.warnings.map((warning) => (
                  <Alert key={warning} type="warning" message={warning} />
                ))}
              </div>
            ) : null}

            {previewData.inventory_month_ids.length === 0 ? (
              <Alert type="info" message="No se encontraron inventarios que coincidan con el filtro seleccionado." />
            ) : null}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showConfirmModal}
        onClose={resetCleanupState}
        title="Confirmar limpieza"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={resetCleanupState}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              loading={executingCleanup}
              disabled={confirmationText !== 'ELIMINAR DATOS DE PRUEBA' || reason.trim().length < 10}
              onClick={handleExecuteCleanup}
            >
              Ejecutar eliminacion
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Alert
            type="warning"
            message="Esta accion es destructiva. El sistema eliminara inventarios, tablas hijas y fotos asociadas."
          />

          <div>
            <label className="block text-sm font-medium text-[#3B3A36] mb-2">
              Escribe exactamente: ELIMINAR DATOS DE PRUEBA
            </label>
            <input
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value)}
              className="w-full px-3 py-2 border border-[#C5C6C7] rounded-md text-[#3B3A36]"
              placeholder="ELIMINAR DATOS DE PRUEBA"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3B3A36] mb-2">
              Motivo
            </label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full min-h-[120px] px-3 py-2 border border-[#C5C6C7] rounded-md text-[#3B3A36]"
              placeholder="Ej: Reinicio de ambiente de pruebas para validacion del flujo de marzo."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
