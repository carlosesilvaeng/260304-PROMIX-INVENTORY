import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, FileSpreadsheet, Upload } from 'lucide-react';
import { Alert } from './Alert';
import { Button } from './Button';
import { DeleteIconButton } from './DeleteIconButton';
import { Input } from './Input';
import { Modal } from './Modal';
import { Select } from './Select';
import {
  executePlantProductsImport,
  getCalibrationCurvesCatalog,
  getPlantProductsConfigEntries,
  previewPlantProductsImport,
  updatePlantProductsConfigEntries,
  type CalibrationCurveCatalogItem,
  type ProductsImportPreviewResponse,
} from '../utils/api';
import type { Plant } from '../contexts/AuthContext';
import { parseProductsImportFile } from '../utils/productsImportParser';
import {
  downloadProductsImportWorkbook,
  PRODUCTS_IMPORT_MODULE,
  PRODUCTS_IMPORT_TEMPLATE_VERSION,
  type ProductsImportWorkbookRow,
} from '../utils/productsImportWorkbook';

interface ProductConfigRow {
  id?: string;
  product_name: string;
  category: string;
  measure_mode: string;
  uom: string;
  requires_photo: boolean;
  calibration_curve_name?: string | null;
  reading_uom?: string | null;
  calibration_table: Record<string, number> | null;
  tank_capacity: string;
  unit_volume: string;
  notes: string;
  is_active: boolean;
}

interface ProductsImportPayload {
  module: 'products';
  template_version: string;
  import_mode: 'upsert';
  rows: Array<{
    row_number: number;
    product_name: string;
    category: string;
    measure_mode: string;
    uom: string;
    requires_photo: string;
    reading_uom: string;
    tank_capacity: string;
    unit_volume: string;
    calibration_table_json: string;
    notes: string;
    is_active: string;
  }>;
}

function createEmptyRow(): ProductConfigRow {
  return {
    product_name: '',
    category: 'OTHER',
    measure_mode: 'COUNT',
    uom: '',
    requires_photo: false,
    calibration_curve_name: null,
    reading_uom: null,
    calibration_table: null,
    tank_capacity: '',
    unit_volume: '',
    notes: '',
    is_active: true,
  };
}

function isTankLevelCurve(curve: CalibrationCurveCatalogItem) {
  return String(curve.measurement_type || '').trim().toUpperCase() === 'TANK_LEVEL';
}

function normalizeCurveName(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
}

function getCurvePointCount(curve: CalibrationCurveCatalogItem | null | undefined) {
  return curve?.points?.length || Object.keys(curve?.data_points || {}).length;
}

function findCurveForTable(curves: CalibrationCurveCatalogItem[], table: Record<string, number> | null | undefined) {
  const normalizedTable = JSON.stringify(table || {});
  return curves.find((curve) => JSON.stringify(curve.data_points || {}) === normalizedTable) || null;
}

function CalibrationCurveViewModal({
  curve,
  onClose,
}: {
  curve: CalibrationCurveCatalogItem | null;
  onClose: () => void;
}) {
  const rows = useMemo(() => {
    if (!curve) return [];
    if (curve.points?.length) {
      return [...curve.points].sort((left, right) => Number(left.point_key) - Number(right.point_key));
    }
    return Object.entries(curve.data_points || {})
      .map(([point_key, point_value]) => ({
        point_key: Number(point_key),
        point_value: Number(point_value),
        available_gallons: Number(point_value),
        consumed_gallons: null,
        percentage: null,
        status: null,
      }))
      .filter((point) => Number.isFinite(point.point_key) && Number.isFinite(point.point_value))
      .sort((left, right) => left.point_key - right.point_key);
  }, [curve]);

  return (
    <Modal
      isOpen={Boolean(curve)}
      onClose={onClose}
      title={curve ? `Curva de Calibración: ${curve.curve_name}` : 'Curva de Calibración'}
      size="xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded border border-[#D4D8DD] bg-[#F9FAFB] p-3">
            <p className="text-xs text-[#5F6773]">Tipo</p>
            <p className="mt-1 text-sm font-medium text-[#3B3A36]">{curve?.measurement_type || '-'}</p>
          </div>
          <div className="rounded border border-[#D4D8DD] bg-[#F9FAFB] p-3">
            <p className="text-xs text-[#5F6773]">Unidad de lectura</p>
            <p className="mt-1 text-sm font-medium text-[#3B3A36]">{curve?.reading_uom || '-'}</p>
          </div>
          <div className="rounded border border-[#D4D8DD] bg-[#F9FAFB] p-3">
            <p className="text-xs text-[#5F6773]">Puntos</p>
            <p className="mt-1 text-sm font-medium text-[#3B3A36]">{rows.length}</p>
          </div>
        </div>
        <div className="max-h-[420px] overflow-auto rounded border border-[#D7D9DE] bg-white">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-[#F2F3F5] text-[#5F6773]">
              <tr>
                <th className="px-3 py-2 text-left">Nivel</th>
                <th className="px-3 py-2 text-left">Galones disponibles</th>
                <th className="px-3 py-2 text-left">Galones consumidos</th>
                <th className="px-3 py-2 text-left">%</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((point, pointIndex) => (
                <tr key={`${point.point_key}-${pointIndex}`} className="border-t border-[#E4E4E4]">
                  <td className="px-3 py-2 text-[#3B3A36]">{point.point_key}</td>
                  <td className="px-3 py-2 text-[#3B3A36]">{point.available_gallons ?? point.point_value}</td>
                  <td className="px-3 py-2 text-[#5F6773]">{point.consumed_gallons ?? '-'}</td>
                  <td className="px-3 py-2 text-[#5F6773]">{point.percentage ?? '-'}</td>
                  <td className="px-3 py-2 text-[#5F6773]">{point.status || '-'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-[#5F6773]" colSpan={5}>
                    Esta curva no tiene puntos para visualizar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function toWorkbookRows(rows: ProductConfigRow[]): ProductsImportWorkbookRow[] {
  return rows.map((row) => ({
    product_name: row.product_name.trim(),
    category: row.category,
    measure_mode: row.measure_mode,
    uom: row.uom.trim(),
    requires_photo: row.requires_photo,
    reading_uom: row.reading_uom?.trim() || null,
    tank_capacity: row.tank_capacity.trim() || null,
    unit_volume: row.unit_volume.trim() || null,
    calibration_table: row.calibration_table,
    notes: row.notes.trim(),
    is_active: row.is_active,
  }));
}

function toImportPayloadRows(fileRows: Awaited<ReturnType<typeof parseProductsImportFile>>['rows']): ProductsImportPayload['rows'] {
  return fileRows.map((row) => ({
    row_number: row.row_number,
    product_name: row.product_name,
    category: row.category,
    measure_mode: row.measure_mode,
    uom: row.uom,
    requires_photo: row.requires_photo,
    reading_uom: row.reading_uom,
    tank_capacity: row.tank_capacity,
    unit_volume: row.unit_volume,
    calibration_table_json: row.calibration_table_json,
    notes: row.notes,
    is_active: row.is_active,
  }));
}

export function ProductsConfigModal({
  plant,
  onSaved,
  onClose,
}: {
  plant: Plant;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ProductConfigRow[]>([]);
  const [curveItems, setCurveItems] = useState<CalibrationCurveCatalogItem[]>([]);
  const [visualizingCurve, setVisualizingCurve] = useState<CalibrationCurveCatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingTemplate, setExportingTemplate] = useState(false);
  const [exportingCurrent, setExportingCurrent] = useState(false);
  const [previewingImport, setPreviewingImport] = useState(false);
  const [executingImport, setExecutingImport] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importPreview, setImportPreview] = useState<ProductsImportPreviewResponse | null>(null);
  const [importReason, setImportReason] = useState('');
  const [selectedImportFileName, setSelectedImportFileName] = useState('');
  const [importPayload, setImportPayload] = useState<ProductsImportPayload | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getPlantProductsConfigEntries(plant.id), getCalibrationCurvesCatalog(plant.id)])
      .then(([response, curvesResponse]) => {
        if (!response.success) {
          setError(response.error ?? 'Error cargando productos');
          return;
        }

        if (!curvesResponse.success) {
          setError(curvesResponse.error ?? 'Error cargando curvas de calibración');
          return;
        }

        const tankCurveData = ((curvesResponse.data ?? []) as CalibrationCurveCatalogItem[]).filter(isTankLevelCurve);
        setCurveItems(tankCurveData);

        const curvesByName = new Map(
          tankCurveData.map((curve) => [normalizeCurveName(curve.curve_name), curve])
        );

        const loadedRows = (response.data ?? []).map((entry: any) => {
          const matchedCurve = entry.calibration_curve_name
            ? curvesByName.get(normalizeCurveName(entry.calibration_curve_name)) || null
            : findCurveForTable(tankCurveData, entry.calibration_table);

          return {
            id: entry.id,
            product_name: entry.product_name || '',
            category: entry.category || 'OTHER',
            measure_mode: entry.measure_mode || 'COUNT',
            uom: entry.uom || entry.unit || '',
            requires_photo: entry.requires_photo ?? false,
            calibration_curve_name: matchedCurve?.curve_name || entry.calibration_curve_name || null,
            reading_uom: entry.reading_uom || matchedCurve?.reading_uom || null,
            calibration_table: matchedCurve?.data_points || entry.calibration_table || null,
            tank_capacity: String(entry.tank_capacity ?? ''),
            unit_volume: String(entry.unit_volume ?? ''),
            notes: entry.notes || '',
            is_active: entry.is_active ?? true,
          };
        });

        setRows(loadedRows);
      })
      .catch(() => setError('Error de conexión cargando productos'))
      .finally(() => setLoading(false));
  }, [plant.id]);

  const previewHasBlockingErrors = useMemo(
    () => Boolean(importPreview && importPreview.errors.length > 0),
    [importPreview]
  );

  const updateRow = (index: number, updates: Partial<ProductConfigRow>) => {
    setRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...updates } : row)));
  };

  const handleModeChange = (index: number, measureMode: string) => {
    updateRow(index, {
      measure_mode: measureMode,
      reading_uom: measureMode === 'TANK_READING' ? rows[index].reading_uom || 'inches' : null,
      calibration_curve_name: measureMode === 'TANK_READING' ? rows[index].calibration_curve_name || null : null,
      calibration_table: measureMode === 'TANK_READING' ? rows[index].calibration_table : null,
      tank_capacity: measureMode === 'TANK_READING' ? rows[index].tank_capacity : '',
      unit_volume: measureMode === 'DRUM' || measureMode === 'PAIL' ? rows[index].unit_volume || '' : '',
    });
  };

  const handleCurveChange = (index: number, curveName: string) => {
    const selectedCurve = curveItems.find((curve) => curve.curve_name === curveName);
    updateRow(index, {
      calibration_curve_name: selectedCurve?.curve_name || null,
      reading_uom: selectedCurve?.reading_uom || rows[index].reading_uom || 'inches',
      calibration_table: selectedCurve?.data_points || null,
      tank_capacity: selectedCurve ? rows[index].tank_capacity : '',
    });
  };

  const curveOptions = [
    { value: '', label: '-- Selecciona una curva --' },
    ...curveItems.map((curve) => ({
      value: curve.curve_name,
      label: `${curve.curve_name}${curve.reading_uom ? ` (${curve.reading_uom})` : ''}`,
    })),
  ];

  const validateRows = () => {
    for (const [index, row] of rows.entries()) {
      const label = row.product_name || `Fila ${index + 1}`;

      if (!row.product_name.trim()) return `La fila ${index + 1} debe tener nombre`;
      if (!row.uom.trim()) return `${label}: la unidad es requerida`;

      if (row.measure_mode === 'TANK_READING') {
        if (!row.reading_uom?.trim()) return `${label}: la unidad de lectura es requerida`;
        if (!row.calibration_curve_name?.trim()) return `${label}: debes seleccionar una curva de calibración`;
        const selectedCurve = curveItems.find((curve) => curve.curve_name === row.calibration_curve_name);
        if (!selectedCurve) return `${label}: la curva seleccionada ya no existe en esta planta`;
        if (getCurvePointCount(selectedCurve) === 0) return `${label}: la curva seleccionada no tiene puntos`;
      }

      if ((row.measure_mode === 'DRUM' || row.measure_mode === 'PAIL') && !row.unit_volume.trim()) {
        return `${label}: el volumen por unidad es requerido`;
      }
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateRows();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = rows.map((row, index) => ({
        ...(row.id ? { id: row.id } : {}),
        product_name: row.product_name.trim(),
        category: row.category,
        measure_mode: row.measure_mode,
        uom: row.uom.trim(),
        requires_photo: row.requires_photo,
        reading_uom: row.measure_mode === 'TANK_READING' ? row.reading_uom?.trim() || null : null,
        calibration_curve_name: row.measure_mode === 'TANK_READING' ? row.calibration_curve_name || null : null,
        calibration_table: row.measure_mode === 'TANK_READING'
          ? curveItems.find((curve) => curve.curve_name === row.calibration_curve_name)?.data_points || row.calibration_table
          : null,
        tank_capacity: row.measure_mode === 'TANK_READING' ? Number(row.tank_capacity) || 0 : null,
        unit_volume: row.measure_mode === 'DRUM' || row.measure_mode === 'PAIL' ? Number(row.unit_volume) || 0 : null,
        notes: row.notes.trim(),
        sort_order: index,
        is_active: row.is_active,
      }));

      const response = await updatePlantProductsConfigEntries(plant.id, payload);
      if (!response.success) {
        setError(response.error ?? 'Error guardando productos');
        return;
      }

      onSaved();
    } catch {
      setError('Error de conexión guardando productos');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBlankTemplate = async () => {
    setExportingTemplate(true);
    setError(null);
    try {
      await downloadProductsImportWorkbook({
        plant,
        rows: [],
        templateType: 'blank',
      });
    } catch (error: any) {
      setError(error?.message || 'No se pudo generar la plantilla.');
    } finally {
      setExportingTemplate(false);
    }
  };

  const handleDownloadCurrentConfiguration = async () => {
    setExportingCurrent(true);
    setError(null);
    try {
      await downloadProductsImportWorkbook({
        plant,
        rows: toWorkbookRows(rows),
        templateType: 'current_config',
      });
    } catch (error: any) {
      setError(error?.message || 'No se pudo exportar la configuración actual.');
    } finally {
      setExportingCurrent(false);
    }
  };

  const handleOpenFilePicker = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const resetImportFlow = () => {
    setShowImportPreview(false);
    setImportPreview(null);
    setImportReason('');
    setSelectedImportFileName('');
    setImportPayload(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreviewingImport(true);
    setError(null);

    try {
      const parsed = await parseProductsImportFile(file);
      if (parsed.meta.plant_id !== plant.id) {
        throw new Error(`La plantilla corresponde a la planta ${parsed.meta.plant_name}. Descarga una plantilla para ${plant.name}.`);
      }

      const payload: ProductsImportPayload = {
        module: PRODUCTS_IMPORT_MODULE,
        template_version: PRODUCTS_IMPORT_TEMPLATE_VERSION,
        import_mode: 'upsert',
        rows: toImportPayloadRows(parsed.rows),
      };

      const response = await previewPlantProductsImport(plant.id, payload);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'No se pudo validar el archivo.');
      }

      setSelectedImportFileName(file.name);
      setImportPayload(payload);
      setImportPreview(response.data);
      setShowImportPreview(true);
    } catch (error: any) {
      setError(error?.message || 'No se pudo procesar el archivo seleccionado.');
    } finally {
      setPreviewingImport(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleExecuteImport = async () => {
    if (!importPayload || !importPreview?.preview_token) return;

    setExecutingImport(true);
    setError(null);

    try {
      const response = await executePlantProductsImport(plant.id, {
        ...importPayload,
        preview_token: importPreview.preview_token,
        reason: importReason,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'No se pudo importar la configuración.');
      }

      resetImportFlow();
      onSaved();
    } catch (error: any) {
      setError(error?.message || 'No se pudo importar la configuración.');
    } finally {
      setExecutingImport(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white">
          <div className="border-b border-[#9D9B9A] p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-xl font-medium text-[#3B3A36]">
                  Configuración de Aceites y Productos — {plant.name}
                </h3>
                <p className="mt-1 text-sm text-[#5F6773]">
                  Administra productos y consumibles directamente desde la tabla de configuración.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button
                  variant="secondary"
                  onClick={handleDownloadBlankTemplate}
                  loading={exportingTemplate}
                  disabled={loading}
                  className="border-[#2475C7] bg-[#EEF4FB] text-[#2475C7] hover:bg-[#DCEBFA]"
                >
                  <FileSpreadsheet size={16} aria-hidden="true" />
                  Generar plantilla
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleDownloadCurrentConfiguration}
                  loading={exportingCurrent}
                  disabled={loading}
                  className="border-[#1D6F42] bg-[#EAF7EF] text-[#1D6F42] hover:bg-[#D9F1E2]"
                >
                  <Download size={16} aria-hidden="true" />
                  Exportar configuración actual
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleOpenFilePicker}
                  loading={previewingImport}
                  disabled={loading}
                  className="border-[#C97A1E] bg-[#FFF4E8] text-[#9A5A12] hover:bg-[#FDE7CF]"
                >
                  <Upload size={16} aria-hidden="true" />
                  Importar plantilla
                </Button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleImportFileSelected}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4">
                <Alert type="error" message={error} />
              </div>
            )}

            {loading ? (
              <div className="py-8 text-center text-[#5F6773]">Cargando productos...</div>
            ) : (
              <div className="space-y-4">
                {curveItems.length === 0 && (
                  <Alert
                    type="warning"
                    message="No hay curvas de calibración tipo TANK_LEVEL para esta planta. Cárgalas primero en Catálogos para usar Lectura de tanque."
                  />
                )}
                {rows.length === 0 ? (
                  <div className="rounded-lg bg-[#F2F3F5] py-8 text-center">
                    <p className="mb-2 text-[#5F6773]">No hay productos configurados</p>
                    <p className="text-sm text-[#5F6773]">Agrega la primera fila para esta planta</p>
                  </div>
                ) : (
                  rows.map((row, index) => (
                    <div key={row.id || `new-${index}`} className="rounded-lg border border-[#9D9B9A] p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-sm font-medium text-[#3B3A36]">Producto #{index + 1}</h4>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-sm text-[#5F6773]">
                            Activo
                            <input
                              type="checkbox"
                              checked={row.is_active}
                              onChange={(e) => updateRow(index, { is_active: e.target.checked })}
                            />
                          </label>
                          <DeleteIconButton onClick={() => setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index))} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <Input
                          label="Nombre"
                          value={row.product_name}
                          onChange={(e) => updateRow(index, { product_name: e.target.value })}
                          placeholder="Ej: Aceite Hidráulico"
                          required
                        />
                        <Select
                          label="Categoría"
                          value={row.category}
                          onChange={(e) => updateRow(index, { category: e.target.value })}
                          options={[
                            { value: 'OIL', label: 'Aceite' },
                            { value: 'LUBRICANT', label: 'Lubricante' },
                            { value: 'CONSUMABLE', label: 'Consumible' },
                            { value: 'EQUIPMENT', label: 'Equipo' },
                            { value: 'OTHER', label: 'Otro' },
                          ]}
                        />
                        <Select
                          label="Método"
                          value={row.measure_mode}
                          onChange={(e) => handleModeChange(index, e.target.value)}
                          options={[
                            { value: 'COUNT', label: 'Conteo' },
                            { value: 'DRUM', label: 'Tambores' },
                            { value: 'PAIL', label: 'Pailas' },
                            { value: 'TANK_READING', label: 'Lectura de tanque' },
                          ]}
                        />
                        <Input
                          label="Unidad"
                          value={row.uom}
                          onChange={(e) => updateRow(index, { uom: e.target.value })}
                          placeholder="Ej: pails, units, gallons"
                          required
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                        <label className="flex items-center gap-2 rounded border border-[#9D9B9A] bg-[#F2F3F5] px-3 py-2 text-sm text-[#3B3A36]">
                          <input
                            type="checkbox"
                            checked={row.requires_photo}
                            onChange={(e) => updateRow(index, { requires_photo: e.target.checked })}
                          />
                          Requiere foto
                        </label>
                        {(row.measure_mode === 'DRUM' || row.measure_mode === 'PAIL') && (
                          <Input
                            label="Volumen por unidad"
                            type="number"
                            value={row.unit_volume}
                            onChange={(e) => updateRow(index, { unit_volume: e.target.value })}
                            placeholder="55"
                            required
                          />
                        )}
                        <Input
                          label="Notas"
                          value={row.notes}
                          onChange={(e) => updateRow(index, { notes: e.target.value })}
                          placeholder="Opcional"
                        />
                      </div>

                      {row.measure_mode === 'TANK_READING' && (
                        <div className="mt-4 space-y-4 rounded-lg border border-[#E4E4E4] bg-[#F9FAFB] p-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
                            <div className="flex items-end gap-2">
                              <div className="min-w-0 flex-1">
                                <Select
                                  label="Curva de calibración"
                                  value={row.calibration_curve_name || ''}
                                  onChange={(e) => handleCurveChange(index, e.target.value)}
                                  options={curveOptions}
                                  required
                                  helperText="La tabla se administra desde Catálogos."
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => setVisualizingCurve(curveItems.find((curve) => curve.curve_name === row.calibration_curve_name) || null)}
                                disabled={!row.calibration_curve_name}
                                className="mb-[22px] inline-flex h-10 w-10 flex-none items-center justify-center rounded border border-[#2475C7] text-[#2475C7] transition-colors hover:bg-[#EEF4FB] disabled:cursor-not-allowed disabled:border-[#D7D9DE] disabled:text-[#A5ACB8]"
                                title="Visualizar curva"
                                aria-label="Visualizar curva de calibración"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                            <Input
                              label="Unidad de lectura"
                              value={row.reading_uom || ''}
                              disabled
                              placeholder="Se llena desde la curva"
                              required
                            />
                            <Input
                              label="Capacidad del tanque"
                              type="number"
                              value={row.tank_capacity}
                              onChange={(e) => updateRow(index, { tank_capacity: e.target.value })}
                              placeholder="500"
                            />
                          </div>
                          <p className="text-xs text-[#5F6773]">
                            Usa el icono de ojo para revisar la tabla. Para cambiar puntos, actualiza Catálogos &gt; Curvas de conversión.
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}

                <Button variant="secondary" onClick={() => setRows((prev) => [...prev, createEmptyRow()])} className="w-full">
                  + Agregar Producto
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#9D9B9A] p-6">
            <Button variant="dangerOutline" onClick={onClose} disabled={saving || previewingImport || executingImport}>
              Salir
            </Button>
            <Button variant="success" onClick={handleSave} loading={saving} disabled={loading || previewingImport || executingImport}>
              Guardar Configuración
            </Button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showImportPreview}
        onClose={resetImportFlow}
        title="Previsualización de importación"
        size="xl"
        footer={
          <>
            <Button variant="dangerOutline" onClick={resetImportFlow}>
              Cancelar
            </Button>
            <Button
              loading={executingImport}
              disabled={!importPreview?.preview_token || previewHasBlockingErrors || importReason.trim().length < 10}
              onClick={handleExecuteImport}
            >
              Importar configuración
            </Button>
          </>
        }
      >
        {!importPreview ? (
          <p className="text-sm text-[#5F6773]">Preparando previsualización...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div className="rounded border border-[#D4D8DD] bg-[#F9FAFB] p-4">
                <p className="text-xs text-[#5F6773]">Archivo</p>
                <p className="mt-1 text-sm font-medium text-[#3B3A36]">{selectedImportFileName || 'Plantilla'}</p>
              </div>
              <div className="rounded border border-[#D4D8DD] bg-[#F9FAFB] p-4">
                <p className="text-xs text-[#5F6773]">Filas</p>
                <p className="mt-1 text-2xl font-semibold text-[#3B3A36]">{importPreview.summary.total_rows}</p>
              </div>
              <div className="rounded border border-[#D4D8DD] bg-[#F9FAFB] p-4">
                <p className="text-xs text-[#5F6773]">Válidas</p>
                <p className="mt-1 text-2xl font-semibold text-[#1D6F42]">{importPreview.summary.valid_rows}</p>
              </div>
              <div className="rounded border border-[#D4D8DD] bg-[#F9FAFB] p-4">
                <p className="text-xs text-[#5F6773]">Crear</p>
                <p className="mt-1 text-2xl font-semibold text-[#2475C7]">{importPreview.summary.creates}</p>
              </div>
              <div className="rounded border border-[#D4D8DD] bg-[#F9FAFB] p-4">
                <p className="text-xs text-[#5F6773]">Actualizar</p>
                <p className="mt-1 text-2xl font-semibold text-[#9A5A12]">{importPreview.summary.updates}</p>
              </div>
            </div>

            {importPreview.warnings.length > 0 && (
              <div className="space-y-2">
                {importPreview.warnings.map((warning) => (
                  <Alert key={warning} type="warning" message={warning} />
                ))}
              </div>
            )}

            {importPreview.errors.length > 0 ? (
              <div className="space-y-3">
                <Alert
                  type="error"
                  message={`Se encontraron ${importPreview.errors.length} errores. Corrige el archivo y vuelve a importarlo.`}
                />
                <div className="max-h-[320px] overflow-auto rounded border border-[#E4E4E4]">
                  <table className="w-full min-w-[720px]">
                    <thead className="bg-[#F2F3F5] text-[#3B3A36]">
                      <tr>
                        <th className="px-4 py-3 text-left">Fila</th>
                        <th className="px-4 py-3 text-left">Columna</th>
                        <th className="px-4 py-3 text-left">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.errors.map((item, index) => (
                        <tr key={`${item.row}-${item.column}-${index}`} className="border-t border-[#E4E4E4]">
                          <td className="px-4 py-3 text-sm text-[#3B3A36]">{item.row}</td>
                          <td className="px-4 py-3 text-sm text-[#3B3A36]">{item.column}</td>
                          <td className="px-4 py-3 text-sm text-[#C94A4A]">{item.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <Alert
                type="success"
                message="La plantilla es válida. Puedes confirmar la importación para aplicar las filas al módulo de Aceites y productos."
              />
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-[#3B3A36]">
                Motivo de la importación
              </label>
              <textarea
                value={importReason}
                onChange={(event) => setImportReason(event.target.value)}
                className="min-h-[110px] w-full rounded border border-[#9D9B9A] bg-white px-3 py-2 text-sm text-[#3B3A36] focus:border-[#2475C7] focus:outline-none"
                placeholder="Ej: actualización masiva de aceites y consumibles desde plantilla oficial."
              />
            </div>
          </div>
        )}
      </Modal>
      <CalibrationCurveViewModal curve={visualizingCurve} onClose={() => setVisualizingCurve(null)} />
    </>
  );
}
