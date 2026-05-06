import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { Modal } from './Modal';
import {
  executePlantSilosImport,
  getCalibrationCurvesCatalog,
  getPlantConfig,
  getPlantSilos,
  previewPlantSilosImport,
  updatePlantSilos,
  type CalibrationCurveCatalogItem,
  type SilosImportPreviewResponse,
} from '../utils/api';
import type { Plant } from '../types';
import { parseSilosImportFile } from '../utils/silosImportParser';
import {
  downloadSilosImportWorkbook,
  SILOS_IMPORT_MODULE,
  SILOS_IMPORT_TEMPLATE_VERSION,
  type SilosImportWorkbookRow,
} from '../utils/silosImportWorkbook';

interface SiloEntry {
  id?: string;
  silo_name: string;
  is_active: boolean;
  measurement_method: string;
  calibration_curve_name?: string | null;
  reading_uom?: string | null;
  conversion_table?: Record<string, number> | null;
  allowed_products: string[];
}

interface SilosImportPayload {
  module: 'silos';
  template_version: string;
  import_mode: 'upsert';
  rows: Array<{
    row_number: number;
    silo_name: string;
    measurement_method: string;
    calibration_curve_name: string;
    reading_uom: string;
    allowed_products: string;
    is_active: string;
  }>;
}

interface SilosConfigModalProps {
  plant: Plant;
  onSaved: () => void;
  onClose: () => void;
}

function createEmptySilo(): SiloEntry {
  return {
    silo_name: '',
    is_active: true,
    measurement_method: 'SILO_LEVEL',
    calibration_curve_name: null,
    reading_uom: null,
    conversion_table: null,
    allowed_products: [],
  };
}

function buildCurvePointRows(table: Record<string, number> | null | undefined) {
  return Object.entries(table || {})
    .map(([level, value]) => ({
      level: Number(level),
      available: Number(value),
    }))
    .filter((row) => Number.isFinite(row.level) && Number.isFinite(row.available))
    .sort((a, b) => a.level - b.level);
}

function toWorkbookRows(rows: SiloEntry[]): SilosImportWorkbookRow[] {
  return rows.map((row) => ({
    silo_name: row.silo_name.trim(),
    measurement_method: row.measurement_method || 'SILO_LEVEL',
    calibration_curve_name: row.calibration_curve_name || '',
    reading_uom: row.reading_uom || '',
    allowed_products: row.allowed_products || [],
    is_active: row.is_active,
  }));
}

function toImportPayloadRows(fileRows: Awaited<ReturnType<typeof parseSilosImportFile>>['rows']): SilosImportPayload['rows'] {
  return fileRows.map((row) => ({
    row_number: row.row_number,
    silo_name: row.silo_name,
    measurement_method: row.measurement_method,
    calibration_curve_name: row.calibration_curve_name,
    reading_uom: row.reading_uom,
    allowed_products: row.allowed_products,
    is_active: row.is_active,
  }));
}

export function SilosConfigModal({ plant, onSaved, onClose }: SilosConfigModalProps) {
  const [silos, setSilos] = useState<SiloEntry[]>([]);
  const [productOptions, setProductOptions] = useState<string[]>([]);
  const [curveItems, setCurveItems] = useState<CalibrationCurveCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingTemplate, setExportingTemplate] = useState(false);
  const [exportingCurrent, setExportingCurrent] = useState(false);
  const [previewingImport, setPreviewingImport] = useState(false);
  const [executingImport, setExecutingImport] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importPreview, setImportPreview] = useState<SilosImportPreviewResponse | null>(null);
  const [importReason, setImportReason] = useState('');
  const [selectedImportFileName, setSelectedImportFileName] = useState('');
  const [importPayload, setImportPayload] = useState<SilosImportPayload | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getPlantSilos(plant.id), getPlantConfig(plant.id), getCalibrationCurvesCatalog(plant.id)])
      .then(([silosResponse, configResponse, curvesResponse]) => {
        if (silosResponse.success) {
          setSilos(
            (silosResponse.data ?? []).map((s: any) => ({
              id: s.id,
              silo_name: s.silo_name || '',
              is_active: s.is_active ?? true,
              measurement_method: s.measurement_method || 'SILO_LEVEL',
              calibration_curve_name: s.calibration_curve_name || null,
              reading_uom: s.reading_uom || null,
              conversion_table: s.conversion_table || null,
              allowed_products: s.allowed_products ?? [],
            }))
          );
        } else {
          setError(silosResponse.error ?? 'Error cargando silos');
        }

        if (configResponse.success && configResponse.data) {
          setProductOptions(
            (configResponse.data.products ?? [])
              .map((product: any) => String(product.product_name || '').trim())
              .filter(Boolean)
          );
        }

        if (curvesResponse.success) {
          setCurveItems(curvesResponse.data ?? []);
        } else {
          setError(curvesResponse.error ?? 'Error cargando curvas de conversión');
        }
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false));
  }, [plant.id]);

  const previewHasBlockingErrors = useMemo(
    () => Boolean(importPreview && importPreview.errors.length > 0),
    [importPreview]
  );

  const updateSilo = (index: number, updates: Partial<SiloEntry>) => {
    setSilos((prev) => prev.map((silo, rowIndex) => (rowIndex === index ? { ...silo, ...updates } : silo)));
  };

  const siloCurveOptions = useMemo(() => {
    const siloCurves = curveItems.filter((curve) => {
      const method = String(curve.measurement_type || '').trim().toUpperCase();
      return method === 'SILO_LEVEL' || String(curve.curve_name || '').trim().toUpperCase().startsWith('SILO');
    });
    return siloCurves.length > 0 ? siloCurves : curveItems;
  }, [curveItems]);

  const handleCurveChange = (index: number, curveName: string) => {
    const selectedCurve = curveItems.find((curve) => curve.curve_name === curveName);
    updateSilo(index, {
      measurement_method: 'SILO_LEVEL',
      calibration_curve_name: selectedCurve?.curve_name || null,
      reading_uom: selectedCurve?.reading_uom || null,
      conversion_table: selectedCurve?.data_points || null,
    });
  };

  const validateSilos = () => {
    const normalizedNames = new Set<string>();

    for (const [index, silo] of silos.entries()) {
      const label = silo.silo_name.trim() || `Fila ${index + 1}`;
      const normalizedName = silo.silo_name.trim().toUpperCase();

      if (!normalizedName) return `Todos los silos deben tener un nombre`;
      if (normalizedNames.has(normalizedName)) return `Hay nombres de silos repetidos. Revisa "${label}"`;
      normalizedNames.add(normalizedName);
      if (!silo.calibration_curve_name?.trim()) return `${label}: debes seleccionar una curva de conversión`;
      if (!silo.reading_uom?.trim()) return `${label}: la curva seleccionada debe tener unidad de lectura`;
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateSilos();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await updatePlantSilos(
        plant.id,
        silos.map((silo) => ({
          id: silo.id,
          silo_name: silo.silo_name.trim(),
          is_active: silo.is_active,
          measurement_method: silo.measurement_method || 'SILO_LEVEL',
          calibration_curve_name: silo.calibration_curve_name || null,
          reading_uom: silo.reading_uom || null,
          conversion_table: silo.conversion_table || null,
          allowed_products: silo.allowed_products ?? [],
        }))
      );
      if (res.success) {
        onSaved();
      } else {
        setError(res.error ?? 'Error guardando silos');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBlankTemplate = async () => {
    setExportingTemplate(true);
    setError(null);
    try {
      await downloadSilosImportWorkbook({
        plant: plant as unknown as import('../contexts/AuthContext').Plant,
        rows: [],
        templateType: 'blank',
        productOptions,
      });
    } catch (downloadError: any) {
      setError(downloadError?.message || 'No se pudo generar la plantilla de silos.');
    } finally {
      setExportingTemplate(false);
    }
  };

  const handleDownloadCurrentConfiguration = async () => {
    setExportingCurrent(true);
    setError(null);
    try {
      await downloadSilosImportWorkbook({
        plant: plant as unknown as import('../contexts/AuthContext').Plant,
        rows: toWorkbookRows(silos),
        templateType: 'current_config',
        productOptions,
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
      const parsed = await parseSilosImportFile(file);
      if (parsed.meta.plant_id !== plant.id) {
        throw new Error(`La plantilla corresponde a la planta ${parsed.meta.plant_name}. Descarga una plantilla para ${plant.name}.`);
      }

      const payload: SilosImportPayload = {
        module: SILOS_IMPORT_MODULE,
        template_version: SILOS_IMPORT_TEMPLATE_VERSION,
        import_mode: 'upsert',
        rows: toImportPayloadRows(parsed.rows),
      };

      const response = await previewPlantSilosImport(plant.id, payload);
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
      const response = await executePlantSilosImport(plant.id, {
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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-6 border-b border-[#9D9B9A]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-xl text-[#3B3A36] font-medium">
                  Configuración de Silos — {plant.name}
                </h3>
                <p className="text-sm text-[#5F6773] mt-1">
                  Administra silos y usa plantilla oficial para editar en bloque nombres, método y productos permitidos.
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

          <div className="p-6 overflow-y-auto flex-1">
            {error && (
              <div className="mb-4">
                <Alert type="error" message={error} />
              </div>
            )}

            {loading ? (
              <div className="text-center py-8 text-[#5F6773]">Cargando silos...</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  <p className="font-semibold">Cómo funciona esta configuración</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-blue-800">
                    <li>Cada silo puede limitar qué productos aparecen durante el inventario.</li>
                    <li>La plantilla usa la misma estructura para exportar, editar e importar.</li>
                    <li>Cada silo usa una curva de conversión para calcular volumen disponible desde el nivel.</li>
                    <li>Productos permitidos se separan con <strong>|</strong> y deben existir como aceites/productos activos.</li>
                  </ul>
                </div>

                {silos.length === 0 ? (
                  <div className="text-center py-8 bg-[#F2F3F5] rounded-lg">
                    <p className="text-[#5F6773] mb-2">No hay silos configurados</p>
                    <p className="text-sm text-[#5F6773]">
                      Haga clic en "Agregar Silo" para comenzar
                    </p>
                  </div>
                ) : (
                  silos.map((silo, index) => (
                    <div key={silo.id || index} className="border border-[#9D9B9A] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-[#3B3A36]">
                          Silo #{index + 1}
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSilos((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                        >
                          🗑️
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <Input
                          label="Nombre del Silo"
                          value={silo.silo_name}
                          onChange={(e) => updateSilo(index, { silo_name: e.target.value })}
                          placeholder="Ej: Silo Cemento 1"
                          required
                        />
                        <Input
                          label="Método"
                          value={silo.measurement_method || 'SILO_LEVEL'}
                          disabled
                        />
                        <Select
                          label="Curva de conversión"
                          value={silo.calibration_curve_name || ''}
                          onChange={(e) => handleCurveChange(index, e.target.value)}
                          options={[
                            { value: '', label: '-- Selecciona curva --' },
                            ...siloCurveOptions.map((curve) => ({
                              value: curve.curve_name,
                              label: `${curve.curve_name}${curve.reading_uom ? ` (${curve.reading_uom})` : ''}`,
                            })),
                          ]}
                          required
                        />
                        <Input
                          label="Unidad de lectura"
                          value={silo.reading_uom || ''}
                          disabled
                        />
                        <label className="flex items-center gap-2 rounded border border-[#9D9B9A] bg-[#F2F3F5] px-3 py-2 text-sm text-[#3B3A36]">
                          <input
                            type="checkbox"
                            checked={silo.is_active}
                            onChange={(e) => updateSilo(index, { is_active: e.target.checked })}
                          />
                          Activo
                        </label>
                      </div>

                      {silo.calibration_curve_name && (
                        <div className="mt-4 rounded border border-[#D4D8DD] bg-[#F9FAFB] p-3">
                          <div className="max-h-[260px] overflow-auto">
                            <table className="w-full min-w-[540px] text-sm">
                              <thead className="bg-[#EEF0F2] text-[#5F6773]">
                                <tr>
                                  <th className="px-3 py-2 text-left">Nivel</th>
                                  <th className="px-3 py-2 text-left">Vol. disponible</th>
                                  <th className="px-3 py-2 text-left">Vol. consumido</th>
                                  <th className="px-3 py-2 text-left">%</th>
                                  <th className="px-3 py-2 text-left">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {buildCurvePointRows(silo.conversion_table).map((point, pointIndex, points) => {
                                  const maxAvailable = points[points.length - 1]?.available || 0;
                                  const consumed = Math.max(0, maxAvailable - point.available);
                                  const percentage = maxAvailable > 0 ? (point.available / maxAvailable) * 100 : 0;
                                  return (
                                    <tr key={`${point.level}-${pointIndex}`} className="border-t border-[#E4E4E4]">
                                      <td className="px-3 py-2 text-[#3B3A36]">{point.level}</td>
                                      <td className="px-3 py-2 text-[#3B3A36]">{point.available}</td>
                                      <td className="px-3 py-2 text-[#3B3A36]">{consumed}</td>
                                      <td className="px-3 py-2 text-[#3B3A36]">{percentage.toFixed(1)}</td>
                                      <td className="px-3 py-2 text-[#1D6F42]">OK</td>
                                    </tr>
                                  );
                                })}
                                {buildCurvePointRows(silo.conversion_table).length === 0 && (
                                  <tr>
                                    <td className="px-3 py-3 text-[#5F6773]" colSpan={5}>
                                      La curva seleccionada no tiene puntos.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                          <p className="mt-2 text-xs text-[#5F6773]">
                            Tabla sincronizada con la curva seleccionada. Para cambiar puntos, actualiza Catálogos &gt; Curvas de conversión.
                          </p>
                        </div>
                      )}

                      {silo.allowed_products.length > 0 && (
                        <p className="mt-3 text-sm text-[#5F6773]">
                          Productos permitidos: {silo.allowed_products.join(', ')}
                        </p>
                      )}
                    </div>
                  ))
                )}

                <Button variant="secondary" onClick={() => setSilos((prev) => [...prev, createEmptySilo()])} className="w-full">
                  + Agregar Silo
                </Button>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-[#9D9B9A] flex items-center justify-end gap-3">
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
                <p className="text-xs text-[#5F6773]">Productos ligados</p>
                <p className="mt-1 text-2xl font-semibold text-[#3B3A36]">{importPreview.summary.linked_products}</p>
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
                message="La plantilla es válida. Puedes confirmar la importación para aplicar las filas al módulo de Silos."
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
                placeholder="Ej: actualización masiva de silos y productos permitidos desde plantilla oficial."
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
