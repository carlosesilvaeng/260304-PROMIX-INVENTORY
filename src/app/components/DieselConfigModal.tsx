import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Alert } from './Alert';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { Select } from './Select';
import {
  executePlantDieselImport,
  getCalibrationCurvesCatalog,
  getPlantDieselConfigEntry,
  previewPlantDieselImport,
  updatePlantDieselConfigEntry,
  type CalibrationCurveCatalogItem,
  type DieselImportPreviewResponse,
} from '../utils/api';
import type { Plant } from '../contexts/AuthContext';
import { parseDieselImportFile } from '../utils/dieselImportParser';
import {
  DIESEL_IMPORT_MODULE,
  DIESEL_IMPORT_TEMPLATE_VERSION,
  downloadDieselImportWorkbook,
  type DieselImportWorkbookRow,
} from '../utils/dieselImportWorkbook';

interface DieselConfigForm {
  id?: string;
  measurement_method: string;
  calibration_curve_name?: string | null;
  reading_uom: string;
  tank_capacity_gallons: string;
  initial_inventory_gallons: string;
  calibration_table_text: string;
  is_active: boolean;
}

interface DieselImportPayload {
  module: 'diesel';
  template_version: string;
  import_mode: 'upsert';
  rows: Array<{
    row_number: number;
    measurement_method: string;
    calibration_curve_name: string;
    reading_uom: string;
    tank_capacity_gallons: string;
    initial_inventory_gallons: string;
    calibration_table_json: string;
    is_active: string;
  }>;
}

function createEmptyForm(): DieselConfigForm {
  return {
    measurement_method: 'TANK_LEVEL',
    calibration_curve_name: null,
    reading_uom: 'inches',
    tank_capacity_gallons: '',
    initial_inventory_gallons: '',
    calibration_table_text: '',
    is_active: true,
  };
}

function stringifyTable(value: Record<string, number> | null | undefined) {
  if (!value || Object.keys(value).length === 0) return '';
  return JSON.stringify(value, null, 2);
}

function toWorkbookRows(form: DieselConfigForm): DieselImportWorkbookRow[] {
  if (
    !form.measurement_method.trim() &&
    !form.reading_uom.trim() &&
    !form.tank_capacity_gallons.trim() &&
    !form.calibration_table_text.trim()
  ) {
    return [];
  }

  return [{
    measurement_method: form.measurement_method.trim() || 'TANK_LEVEL',
    calibration_curve_name: form.calibration_curve_name?.trim() || null,
    reading_uom: form.reading_uom.trim(),
    tank_capacity_gallons: form.tank_capacity_gallons.trim() || null,
    initial_inventory_gallons: form.initial_inventory_gallons.trim() || null,
    calibration_table: form.calibration_table_text.trim() ? JSON.parse(form.calibration_table_text) : null,
    is_active: form.is_active,
  }];
}

function toImportPayloadRows(fileRows: Awaited<ReturnType<typeof parseDieselImportFile>>['rows']): DieselImportPayload['rows'] {
  return fileRows.map((row) => ({
    row_number: row.row_number,
    measurement_method: row.measurement_method,
    calibration_curve_name: row.calibration_curve_name,
    reading_uom: row.reading_uom,
    tank_capacity_gallons: row.tank_capacity_gallons,
    initial_inventory_gallons: row.initial_inventory_gallons,
    calibration_table_json: row.calibration_table_json,
    is_active: row.is_active,
  }));
}

export function DieselConfigModal({
  plant,
  onSaved,
  onClose,
}: {
  plant: Plant;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DieselConfigForm>(createEmptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingTemplate, setExportingTemplate] = useState(false);
  const [exportingCurrent, setExportingCurrent] = useState(false);
  const [previewingImport, setPreviewingImport] = useState(false);
  const [executingImport, setExecutingImport] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importPreview, setImportPreview] = useState<DieselImportPreviewResponse | null>(null);
  const [importReason, setImportReason] = useState('');
  const [selectedImportFileName, setSelectedImportFileName] = useState('');
  const [importPayload, setImportPayload] = useState<DieselImportPayload | null>(null);
  const [curveItems, setCurveItems] = useState<CalibrationCurveCatalogItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getPlantDieselConfigEntry(plant.id), getCalibrationCurvesCatalog(plant.id)])
      .then(([response, curvesResponse]) => {
        const curves = (curvesResponse.success ? curvesResponse.data : []) || [];
        setCurveItems(curves);
        if (!curvesResponse.success) {
          setError(curvesResponse.error ?? 'Error cargando curvas de conversión');
        }

        if (!response.success) {
          setError(response.error ?? 'Error cargando diesel');
          return;
        }

        if (!response.data) {
          setForm(createEmptyForm());
          return;
        }

        const matchedCurve = response.data.calibration_curve_name
          ? curves.find((curve) => curve.curve_name.trim().toUpperCase() === String(response.data.calibration_curve_name).trim().toUpperCase()) || null
          : null;

        if (response.data.calibration_curve_name && !matchedCurve) {
          setError(`La curva "${response.data.calibration_curve_name}" ya no existe en el catálogo de esta planta. Selecciona una curva válida para resincronizar diesel.`);
        }

        setForm({
          id: response.data.id,
          measurement_method: response.data.measurement_method || 'TANK_LEVEL',
          calibration_curve_name: matchedCurve?.curve_name || response.data.calibration_curve_name || null,
          reading_uom: matchedCurve?.reading_uom || response.data.reading_uom || 'inches',
          tank_capacity_gallons: String(response.data.tank_capacity_gallons ?? ''),
          initial_inventory_gallons: String(response.data.initial_inventory_gallons ?? ''),
          calibration_table_text: stringifyTable(matchedCurve?.data_points || response.data.calibration_table),
          is_active: response.data.is_active ?? true,
        });
      })
      .catch(() => setError('Error de conexión cargando diesel'))
      .finally(() => setLoading(false));
  }, [plant.id]);

  const curveOptions = useMemo(
    () => [
      { value: '', label: '-- Selecciona una curva --' },
      ...curveItems.map((curve) => ({
        value: curve.curve_name,
        label: curve.curve_name,
      })),
    ],
    [curveItems]
  );

  const handleCurveChange = (curveName: string) => {
    const selectedCurve = curveItems.find((curve) => curve.curve_name === curveName) || null;
    setForm((prev) => ({
      ...prev,
      calibration_curve_name: selectedCurve?.curve_name || null,
      reading_uom: selectedCurve?.reading_uom || '',
      calibration_table_text: stringifyTable(selectedCurve?.data_points) || '',
    }));
  };

  const previewHasBlockingErrors = useMemo(
    () => Boolean(importPreview && importPreview.errors.length > 0),
    [importPreview]
  );

  const validateForm = () => {
    if (!form.measurement_method.trim()) {
      return 'El método de medición es requerido';
    }

    if (!form.calibration_curve_name?.trim()) {
      return 'Debes seleccionar una curva de conversión';
    }

    if (!curveItems.some((curve) => curve.curve_name === form.calibration_curve_name)) {
      return 'La curva seleccionada ya no existe en el catálogo de esta planta';
    }

    if (!form.reading_uom.trim()) {
      return 'La unidad de lectura es requerida';
    }

    if (!form.tank_capacity_gallons.trim()) {
      return 'La capacidad del tanque es requerida';
    }

    const tankCapacity = Number(form.tank_capacity_gallons);
    if (Number.isNaN(tankCapacity) || tankCapacity <= 0) {
      return 'La capacidad del tanque debe ser mayor que cero';
    }

    if (form.initial_inventory_gallons.trim()) {
      const initialInventory = Number(form.initial_inventory_gallons);
      if (Number.isNaN(initialInventory) || initialInventory < 0) {
        return 'El inventario inicial no puede ser negativo';
      }
    }

    if (!form.calibration_table_text.trim()) {
      return 'La tabla de calibración es requerida';
    }

    try {
      const parsed = JSON.parse(form.calibration_table_text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
        return 'La tabla de calibración debe ser un objeto JSON válido';
      }
    } catch {
      return 'La tabla de calibración no tiene JSON válido';
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await updatePlantDieselConfigEntry(plant.id, {
        ...(form.id ? { id: form.id } : {}),
        measurement_method: form.measurement_method.trim(),
        calibration_curve_name: form.calibration_curve_name?.trim() || null,
        reading_uom: form.reading_uom.trim(),
        tank_capacity_gallons: Number(form.tank_capacity_gallons),
        initial_inventory_gallons: form.initial_inventory_gallons.trim() ? Number(form.initial_inventory_gallons) : 0,
        calibration_table: JSON.parse(form.calibration_table_text),
        is_active: form.is_active,
      });

      if (!response.success) {
        setError(response.error ?? 'Error guardando diesel');
        return;
      }

      onSaved();
    } catch {
      setError('Error de conexión guardando diesel');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBlankTemplate = async () => {
    setExportingTemplate(true);
    setError(null);
    try {
      await downloadDieselImportWorkbook({
        plant,
        rows: [],
        templateType: 'blank',
      });
    } catch (downloadError: any) {
      setError(downloadError?.message || 'No se pudo generar la plantilla de diesel.');
    } finally {
      setExportingTemplate(false);
    }
  };

  const handleDownloadCurrentConfiguration = async () => {
    setExportingCurrent(true);
    setError(null);
    try {
      await downloadDieselImportWorkbook({
        plant,
        rows: toWorkbookRows(form),
        templateType: 'current_config',
      });
    } catch (downloadError: any) {
      setError(downloadError?.message || 'No se pudo exportar la configuración actual.');
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
      const parsed = await parseDieselImportFile(file);
      if (parsed.meta.plant_id !== plant.id) {
        throw new Error(`La plantilla corresponde a la planta ${parsed.meta.plant_name}. Descarga una plantilla para ${plant.name}.`);
      }

      const payload: DieselImportPayload = {
        module: DIESEL_IMPORT_MODULE,
        template_version: DIESEL_IMPORT_TEMPLATE_VERSION,
        import_mode: 'upsert',
        rows: toImportPayloadRows(parsed.rows),
      };

      const response = await previewPlantDieselImport(plant.id, payload);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'No se pudo validar el archivo.');
      }

      setSelectedImportFileName(file.name);
      setImportPayload(payload);
      setImportPreview(response.data);
      setShowImportPreview(true);
    } catch (importError: any) {
      setError(importError?.message || 'No se pudo procesar el archivo seleccionado.');
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
      const response = await executePlantDieselImport(plant.id, {
        ...importPayload,
        preview_token: importPreview.preview_token,
        reason: importReason,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'No se pudo importar la configuración.');
      }

      resetImportFlow();
      onSaved();
    } catch (importError: any) {
      setError(importError?.message || 'No se pudo importar la configuración.');
    } finally {
      setExecutingImport(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white">
          <div className="border-b border-[#9D9B9A] p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-xl font-medium text-[#3B3A36]">
                  Configuración de Diesel — {plant.name}
                </h3>
                <p className="mt-1 text-sm text-[#5F6773]">
                  Administra el tanque y la tabla de calibración desde la base de datos o con plantilla oficial.
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
              <div className="py-8 text-center text-[#5F6773]">Cargando diesel...</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  <p className="font-semibold">Cómo funciona esta configuración</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-blue-800">
                    <li>La plantilla de diesel maneja una sola fila por planta.</li>
                    <li>Capacidad del tanque debe ser mayor que cero.</li>
                    <li>La tabla de calibración debe venir como JSON válido.</li>
                  </ul>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input
                    label="Método"
                    value={form.measurement_method}
                    onChange={(e) => setForm((prev) => ({ ...prev, measurement_method: e.target.value }))}
                    placeholder="Ej: TANK_LEVEL"
                    required
                  />
                  <Input
                    label="Unidad de lectura"
                    value={form.reading_uom}
                    disabled
                    placeholder="Se llena desde la curva"
                    required
                  />
                  <Input
                    label="Capacidad del tanque (galones)"
                    type="number"
                    value={form.tank_capacity_gallons}
                    onChange={(e) => setForm((prev) => ({ ...prev, tank_capacity_gallons: e.target.value }))}
                    placeholder="8000"
                    required
                  />
                  <Input
                    label="Inventario inicial"
                    type="number"
                    value={form.initial_inventory_gallons}
                    onChange={(e) => setForm((prev) => ({ ...prev, initial_inventory_gallons: e.target.value }))}
                    placeholder="5000"
                  />
                  <Select
                    label="Curva de conversión"
                    value={form.calibration_curve_name || ''}
                    onChange={(e) => handleCurveChange(e.target.value)}
                    options={curveOptions}
                    helperText="La unidad de lectura y la tabla se sincronizan desde la curva seleccionada."
                    required
                  />
                  <label className="flex items-center gap-2 rounded border border-[#9D9B9A] bg-[#F2F3F5] px-3 py-2 text-sm text-[#3B3A36]">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                    />
                    Activo
                  </label>
                </div>

                <div>
                  <label className="mb-1.5 block text-[#3B3A36]">
                    Tabla de calibración JSON
                    <span className="ml-1 text-[#C94A4A]">*</span>
                  </label>
                  <textarea
                    value={form.calibration_table_text}
                    readOnly
                    rows={10}
                    className="w-full rounded border border-[#9D9B9A] bg-[#F2F3F5] px-3 py-2 font-mono text-sm text-[#3B3A36] focus:border-[#2475C7] focus:outline-none"
                    placeholder='{"0": 0, "8": 400, "16": 832}'
                  />
                  <p className="mt-1 text-xs text-[#5F6773]">
                    Vista sincronizada con la curva seleccionada. Para cambiarla, actualiza el catálogo de curvas o elige otra curva.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#9D9B9A] p-6">
            <Button variant="ghost" onClick={onClose} disabled={saving || previewingImport || executingImport}>
              Salir
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={loading || previewingImport || executingImport}>
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
            <Button variant="secondary" onClick={resetImportFlow}>
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
                message="La plantilla es válida. Puedes confirmar la importación para aplicar la configuración de Diesel."
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
                placeholder="Ej: actualización de capacidad y tabla de calibración desde plantilla oficial."
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
