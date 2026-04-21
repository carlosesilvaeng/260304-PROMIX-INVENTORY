import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Alert } from './Alert';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { Select } from './Select';
import {
  executePlantAggregatesImport,
  getMateriales,
  getPlantConfig,
  getProcedencias,
  previewPlantAggregatesImport,
  updatePlantAggregatesConfigEntries,
  type AggregatesImportPreviewResponse,
} from '../utils/api';
import type { Plant } from '../contexts/AuthContext';
import { parseAggregatesImportFile } from '../utils/aggregatesImportParser';
import {
  AGGREGATES_IMPORT_MODULE,
  AGGREGATES_IMPORT_TEMPLATE_VERSION,
  downloadAggregatesImportWorkbook,
  type AggregatesImportWorkbookRow,
} from '../utils/aggregatesImportWorkbook';

type AggregateMeasurementMethod = 'BOX' | 'CONE';

interface AggregateConfigRow {
  id?: string;
  aggregate_name: string;
  material_type: string;
  location_area: string;
  measurement_method: AggregateMeasurementMethod;
  unit: string;
  box_width_ft: string;
  box_height_ft: string;
  is_active: boolean;
}

type AggregateDimensionField = 'box_width_ft' | 'box_height_ft';

interface AggregatesImportPayload {
  module: 'aggregates';
  template_version: string;
  import_mode: 'upsert';
  rows: Array<{
    row_number: number;
    aggregate_name: string;
    material_type: string;
    location_area: string;
    measurement_method: string;
    unit: string;
    box_width_ft: string;
    box_height_ft: string;
    is_active: string;
  }>;
}

function createEmptyRow(): AggregateConfigRow {
  return {
    aggregate_name: '',
    material_type: '',
    location_area: '',
    measurement_method: 'BOX',
    unit: 'CUBIC_YARDS',
    box_width_ft: '',
    box_height_ft: '',
    is_active: true,
  };
}

function mapCajonToAggregateRow(cajon: Plant['cajones'][number]): AggregateConfigRow {
  return {
    aggregate_name: cajon.name || '',
    material_type: cajon.material || '',
    location_area: cajon.procedencia || '',
    measurement_method: 'BOX',
    unit: 'CUBIC_YARDS',
    box_width_ft: String(cajon.ancho ?? ''),
    box_height_ft: String(cajon.alto ?? ''),
    is_active: true,
  };
}

function toWorkbookRows(rows: AggregateConfigRow[]): AggregatesImportWorkbookRow[] {
  return rows.map((row) => ({
    aggregate_name: row.aggregate_name.trim(),
    material_type: row.material_type.trim(),
    location_area: row.location_area.trim(),
    measurement_method: row.measurement_method,
    unit: row.unit.trim() || 'CUBIC_YARDS',
    box_width_ft: row.measurement_method === 'BOX' ? row.box_width_ft.trim() : null,
    box_height_ft: row.measurement_method === 'BOX' ? row.box_height_ft.trim() : null,
    is_active: row.is_active,
  }));
}

function toImportPayloadRows(
  fileRows: Awaited<ReturnType<typeof parseAggregatesImportFile>>['rows']
): AggregatesImportPayload['rows'] {
  return fileRows.map((row) => ({
    row_number: row.row_number,
    aggregate_name: row.aggregate_name,
    material_type: row.material_type,
    location_area: row.location_area,
    measurement_method: row.measurement_method,
    unit: row.unit,
    box_width_ft: row.box_width_ft,
    box_height_ft: row.box_height_ft,
    is_active: row.is_active,
  }));
}

export function AggregatesConfigModal({
  plant,
  onSaved,
  onClose,
}: {
  plant: Plant;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<AggregateConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materialOptions, setMaterialOptions] = useState<string[]>([]);
  const [procedenciaOptions, setProcedenciaOptions] = useState<string[]>([]);
  const [exportingTemplate, setExportingTemplate] = useState(false);
  const [exportingCurrent, setExportingCurrent] = useState(false);
  const [previewingImport, setPreviewingImport] = useState(false);
  const [executingImport, setExecutingImport] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importPreview, setImportPreview] = useState<AggregatesImportPreviewResponse | null>(null);
  const [importReason, setImportReason] = useState('');
  const [selectedImportFileName, setSelectedImportFileName] = useState('');
  const [importPayload, setImportPayload] = useState<AggregatesImportPayload | null>(null);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    Promise.all([getMateriales(), getProcedencias()])
      .then(([materialesResponse, procedenciasResponse]) => {
        if (materialesResponse.success) {
          setMaterialOptions((materialesResponse.data || []).map((item: any) => item.nombre).filter(Boolean));
        }

        if (procedenciasResponse.success) {
          setProcedenciaOptions((procedenciasResponse.data || []).map((item: any) => item.nombre).filter(Boolean));
        }
      })
      .catch((catalogError) => {
        console.error('❌ Error cargando catalogos de agregados:', catalogError);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    getPlantConfig(plant.id)
      .then((response) => {
        if (!response.success) {
          setError(response.error ?? 'Error cargando agregados');
          return;
        }

        const aggregateEntries = response.data?.aggregates ?? [];
        const legacyCajones = response.data?.cajones ?? plant.cajones ?? [];

        if (aggregateEntries.length === 0) {
          setRows(legacyCajones.map(mapCajonToAggregateRow));
          setTouchedFields({});
          return;
        }

        const loadedRows = aggregateEntries.map((entry: any) => ({
          id: entry.id,
          aggregate_name: entry.aggregate_name || '',
          material_type: entry.material_type || '',
          location_area: entry.location_area || '',
          measurement_method: String(entry.measurement_method || 'BOX').toUpperCase() === 'CONE' ? 'CONE' : 'BOX',
          unit: entry.unit || 'CUBIC_YARDS',
          box_width_ft: entry.box_width_ft === null || entry.box_width_ft === undefined ? '' : String(entry.box_width_ft),
          box_height_ft: entry.box_height_ft === null || entry.box_height_ft === undefined ? '' : String(entry.box_height_ft),
          is_active: entry.is_active ?? true,
        })) as AggregateConfigRow[];

        setRows(loadedRows);
        setTouchedFields({});
      })
      .catch(() => setError('Error de conexion cargando agregados'))
      .finally(() => setLoading(false));
  }, [plant.id, plant.cajones]);

  const previewHasBlockingErrors = useMemo(
    () => Boolean(importPreview && importPreview.errors.length > 0),
    [importPreview]
  );

  const saveValidationMessage = useMemo(() => validateRows(), [rows]);

  const getFieldTouchKey = (index: number, field: AggregateDimensionField) => `${index}:${field}`;

  const markFieldTouched = (index: number, field: AggregateDimensionField) => {
    const key = getFieldTouchKey(index, field);
    setTouchedFields((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  const getBoxDimensionError = (
    row: AggregateConfigRow,
    index: number,
    field: AggregateDimensionField
  ) => {
    if (row.measurement_method !== 'BOX') return undefined;

    const key = getFieldTouchKey(index, field);
    if (!touchedFields[key]) return undefined;

    const rawValue = row[field].trim();
    const label = field === 'box_width_ft' ? 'ancho' : 'alto';

    if (!rawValue) return `El ${label} es requerido.`;

    const numericValue = Number(rawValue);
    if (Number.isNaN(numericValue)) return `El ${label} debe ser numerico.`;
    if (numericValue <= 0) return `El ${label} debe ser mayor que cero.`;

    return undefined;
  };

  const updateRow = (index: number, updates: Partial<AggregateConfigRow>) => {
    setRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...updates } : row)));
  };

  const buildSelectOptions = (
    values: string[],
    currentValue: string,
    emptyLabel: string
  ) => {
    const normalizedValues = [...values];
    if (currentValue.trim() && !normalizedValues.includes(currentValue.trim())) {
      normalizedValues.unshift(currentValue.trim());
    }

    return [
      { value: '', label: emptyLabel },
      ...normalizedValues.map((value) => ({ value, label: value })),
    ];
  };

  const addRow = () => {
    setTouchedFields({});
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const removeRow = (index: number) => {
    setTouchedFields({});
    setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleMethodChange = (index: number, measurementMethod: AggregateMeasurementMethod) => {
    if (measurementMethod !== 'BOX') {
      setTouchedFields((prev) => {
        const next = { ...prev };
        delete next[getFieldTouchKey(index, 'box_width_ft')];
        delete next[getFieldTouchKey(index, 'box_height_ft')];
        return next;
      });
    }

    updateRow(index, {
      measurement_method: measurementMethod,
      box_width_ft: measurementMethod === 'BOX' ? rows[index].box_width_ft : '',
      box_height_ft: measurementMethod === 'BOX' ? rows[index].box_height_ft : '',
    });
  };

  function validateRows() {
    const normalizedNames = new Set<string>();
    const availableMaterials = new Set(materialOptions.map((item) => item.trim().toUpperCase()).filter(Boolean));
    const availableProcedencias = new Set(procedenciaOptions.map((item) => item.trim().toUpperCase()).filter(Boolean));

    for (const [index, row] of rows.entries()) {
      const label = row.aggregate_name.trim() || `Fila ${index + 1}`;
      const normalizedName = row.aggregate_name.trim().toUpperCase();
      const normalizedMaterial = row.material_type.trim().toUpperCase();
      const normalizedProcedencia = row.location_area.trim().toUpperCase();

      if (!normalizedName) {
        return `El agregado en la fila ${index + 1} debe tener nombre`;
      }

      if (normalizedNames.has(normalizedName)) {
        return `Hay nombres de agregados repetidos. Revisa "${label}"`;
      }
      normalizedNames.add(normalizedName);

      if (!row.measurement_method) {
        return `${label}: el metodo de medicion es requerido`;
      }

      if (!row.material_type.trim()) {
        return `${label}: el material es requerido`;
      }
      if (!availableMaterials.has(normalizedMaterial)) {
        return `${label}: el material debe existir en el catálogo de materiales`;
      }

      if (!row.location_area.trim()) {
        return `${label}: la procedencia es requerida`;
      }
      if (!availableProcedencias.has(normalizedProcedencia)) {
        return `${label}: la procedencia debe existir en el catálogo de procedencias`;
      }

      if (row.measurement_method === 'BOX') {
        const width = Number(row.box_width_ft);
        if (row.box_width_ft.trim() === '' || Number.isNaN(width)) {
          return `${label}: el ancho del cajon debe ser numerico`;
        }
        if (width <= 0) {
          return `${label}: el ancho del cajon debe ser mayor que cero`;
        }

        const height = Number(row.box_height_ft);
        if (row.box_height_ft.trim() === '' || Number.isNaN(height)) {
          return `${label}: el alto del cajon debe ser numerico`;
        }
        if (height <= 0) {
          return `${label}: el alto del cajon debe ser mayor que cero`;
        }
      }
    }

    return null;
  }

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
        aggregate_name: row.aggregate_name.trim(),
        material_type: row.material_type.trim(),
        location_area: row.location_area.trim(),
        measurement_method: row.measurement_method,
        unit: row.unit || 'CUBIC_YARDS',
        box_width_ft: row.measurement_method === 'BOX' ? Number(row.box_width_ft) : null,
        box_height_ft: row.measurement_method === 'BOX' ? Number(row.box_height_ft) : null,
        sort_order: index,
        is_active: row.is_active,
      }));

      const response = await updatePlantAggregatesConfigEntries(plant.id, payload);
      if (!response.success) {
        setError(
          response.error?.includes('respuesta no valida')
            ? 'No se pudo guardar porque el backend publicado aun no tiene esta ruta de agregados. Hay que publicar la Edge Function actualizada.'
            : (response.error ?? 'Error guardando agregados')
        );
        return;
      }

      onSaved();
    } catch {
      setError('Error de conexion guardando agregados');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBlankTemplate = async () => {
    setExportingTemplate(true);
    setError(null);
    try {
      await downloadAggregatesImportWorkbook({
        plant,
        rows: [],
        templateType: 'blank',
        materialOptions,
        procedenciaOptions,
      });
    } catch (downloadError: any) {
      setError(downloadError?.message || 'No se pudo generar la plantilla de agregados.');
    } finally {
      setExportingTemplate(false);
    }
  };

  const handleDownloadCurrentConfiguration = async () => {
    setExportingCurrent(true);
    setError(null);
    try {
      await downloadAggregatesImportWorkbook({
        plant,
        rows: toWorkbookRows(rows),
        templateType: 'current_config',
        materialOptions,
        procedenciaOptions,
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
      const parsed = await parseAggregatesImportFile(file);
      if (parsed.meta.plant_id !== plant.id) {
        throw new Error(`La plantilla corresponde a la planta ${parsed.meta.plant_name}. Descarga una plantilla para ${plant.name}.`);
      }

      const payload: AggregatesImportPayload = {
        module: AGGREGATES_IMPORT_MODULE,
        template_version: AGGREGATES_IMPORT_TEMPLATE_VERSION,
        import_mode: 'upsert',
        rows: toImportPayloadRows(parsed.rows),
      };

      const response = await previewPlantAggregatesImport(plant.id, payload);
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
      const response = await executePlantAggregatesImport(plant.id, {
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
        <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white">
          <div className="border-b border-[#9D9B9A] p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-xl font-medium text-[#3B3A36]">
                  Configuración de Agregados — {plant.name}
                </h3>
                <p className="mt-1 text-sm text-[#5F6773]">
                  Define la captura por cajón o cono y administra la configuración en bloque con plantilla oficial.
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

          {!loading && materialOptions.length === 0 && (
            <div className="mb-4">
              <Alert type="warning" message="No hay materiales en catálogo. Crea primero los materiales en la pestaña Catálogos." />
            </div>
          )}

          {!loading && procedenciaOptions.length === 0 && (
            <div className="mb-4">
              <Alert type="warning" message="No hay procedencias en catálogo. Crea primero las procedencias en la pestaña Catálogos." />
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-[#5F6773]">Cargando agregados...</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  <p className="font-semibold">Cómo funciona esta configuración</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-blue-800">
                    <li>Si eliges <strong>Cajón</strong>, el gerente solo ingresará el largo y el sistema usará ancho y alto fijos.</li>
                    <li>Si eliges <strong>Cono</strong>, el gerente ingresará M1 a M6 y D1 a D2 en la captura.</li>
                    <li>Si la planta aún no tiene agregados configurados, se precargan aquí desde la configuración anterior para facilitar la migración inicial.</li>
                    <li>Guardar o importar deja esta planta usando el esquema nuevo de agregados y limpia los cajones legacy.</li>
                  </ul>
                </div>

                {rows.length === 0 ? (
                  <div className="rounded-lg bg-[#F2F3F5] py-8 text-center">
                    <p className="mb-2 text-[#5F6773]">No hay agregados configurados</p>
                    <p className="text-sm text-[#5F6773]">Agrega la primera fila para esta planta</p>
                  </div>
                ) : (
                  rows.map((row, index) => {
                    const widthError = getBoxDimensionError(row, index, 'box_width_ft');
                    const heightError = getBoxDimensionError(row, index, 'box_height_ft');

                    return (
                      <div key={row.id || `new-${index}`} className="rounded-lg border border-[#9D9B9A] p-4">
                        <div className="mb-4 flex items-center justify-between">
                          <h4 className="text-sm font-medium text-[#3B3A36]">Agregado #{index + 1}</h4>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm text-[#5F6773]">
                              Activo
                              <input
                                type="checkbox"
                                checked={row.is_active}
                                onChange={(e) => updateRow(index, { is_active: e.target.checked })}
                              />
                            </label>
                            <Button variant="ghost" size="sm" onClick={() => removeRow(index)} disabled={saving || previewingImport || executingImport}>
                              🗑️
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                          <Input
                            label="Nombre del agregado"
                            value={row.aggregate_name}
                            onChange={(e) => updateRow(index, { aggregate_name: e.target.value })}
                            placeholder="Ej: Cajón 1 / Cono Arena"
                            required
                          />
                          <Select
                            label="Material"
                            value={row.material_type}
                            onChange={(e) => updateRow(index, { material_type: e.target.value })}
                            options={buildSelectOptions(materialOptions, row.material_type, '— Seleccionar material —')}
                            required
                          />
                          <Select
                            label="Procedencia"
                            value={row.location_area}
                            onChange={(e) => updateRow(index, { location_area: e.target.value })}
                            options={buildSelectOptions(procedenciaOptions, row.location_area, '— Seleccionar procedencia —')}
                            required
                          />
                          <Select
                            label="Metodo de medicion"
                            value={row.measurement_method}
                            onChange={(e) => handleMethodChange(index, e.target.value as AggregateMeasurementMethod)}
                            options={[
                              { value: 'BOX', label: 'Cajón' },
                              { value: 'CONE', label: 'Cono' },
                            ]}
                            required
                          />
                        </div>

                        {row.measurement_method === 'BOX' ? (
                          <div className="mt-4 rounded-lg border border-[#E4E4E4] bg-[#F9FAFB] p-4">
                            <p className="mb-3 text-sm text-[#5F6773]">
                              Para cajón, ancho y alto quedan fijos en configuración; el gerente solo capturará el largo.
                            </p>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <Input
                                label="Ancho (ft)"
                                type="number"
                                value={row.box_width_ft}
                                onChange={(e) => {
                                  markFieldTouched(index, 'box_width_ft');
                                  updateRow(index, { box_width_ft: e.target.value });
                                }}
                                onBlur={() => markFieldTouched(index, 'box_width_ft')}
                                placeholder="30"
                                error={widthError}
                                required
                              />
                              <Input
                                label="Alto (ft)"
                                type="number"
                                value={row.box_height_ft}
                                onChange={(e) => {
                                  markFieldTouched(index, 'box_height_ft');
                                  updateRow(index, { box_height_ft: e.target.value });
                                }}
                                onBlur={() => markFieldTouched(index, 'box_height_ft')}
                                placeholder="12"
                                error={heightError}
                                required
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                            <p className="font-semibold">Método Cono</p>
                            <p className="mt-1 text-amber-800">
                              En inventario, el gerente capturará las 6 medidas M y los 2 diámetros D. No se usan ancho ni alto fijos.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                <Button variant="secondary" onClick={addRow} className="w-full" disabled={saving || previewingImport || executingImport}>
                  + Agregar fila de agregado
                </Button>
              </div>
            )}
          </div>

          <div className="border-t border-[#9D9B9A] p-6">
            <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={onClose} disabled={saving || previewingImport || executingImport}>
              Salir
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={loading || previewingImport || executingImport || Boolean(saveValidationMessage)}
            >
              Guardar configuración
            </Button>
            </div>
            {saveValidationMessage && (
              <p className="mt-2 text-right text-sm text-[#C94A4A]">
                No puedes guardar: {saveValidationMessage}
              </p>
            )}
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
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
              <div className="rounded border border-[#D4D8DD] bg-[#F9FAFB] p-4">
                <p className="text-xs text-[#5F6773]">Legacy cajones</p>
                <p className="mt-1 text-2xl font-semibold text-[#C94A4A]">{importPreview.summary.legacy_cajones}</p>
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
                message="La plantilla es válida. Puedes confirmar la importación para aplicar las filas al módulo de Agregados."
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
                placeholder="Ej: migración masiva de cajones a la configuración nueva de agregados."
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
