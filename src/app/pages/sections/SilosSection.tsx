import React, { useEffect } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { NumericInput } from '../../components/Input';
import { PhotoCapture } from '../../components/PhotoCapture';
import { UnitFlowSummary } from '../../components/UnitFlowSummary';
import { useAuth } from '../../contexts/AuthContext';
import { usePlantPrefill } from '../../contexts/PlantPrefillContext';
import { convertReadingToVolume, hasCalibrationPoints } from '../../utils/calibration';
import { formatYearMonthLabel } from '../../utils/dateFormatting';
import { formatNumber } from '../../utils/numberFormatting';
import { saveSilosEntries } from '../../utils/api';
import {
  resolveEffectiveMeasurementConfig,
  type MeasurementConfig,
  type UnitDefinition,
} from '../../utils/unitConversion';
import siloMeasurementReference from '../../../assets/silo-measurement-reference.png';
import { calculateSiloGeometry } from '../../../../supabase/functions/make-server/silo_geometry';

interface SilosSectionProps {
  onBack?: () => void;
}

function roundTo(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function getReadingFeet(entry: any) {
  const reading = Number(entry.reading_value ?? entry.reading ?? 0) || 0;
  return roundTo(reading / 12);
}

function normalizeCalibrationPoints(points: any[] | null | undefined) {
  return (points || [])
    .map((point) => ({
      reading: Number(point.point_key),
      status: String(point.status || '').trim() || null,
    }))
    .filter((point) => Number.isFinite(point.reading))
    .sort((left, right) => left.reading - right.reading);
}

function getStatusForReading(points: ReturnType<typeof normalizeCalibrationPoints>, reading: number) {
  if (points.length === 0) return null;

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  if (reading <= firstPoint.reading) return firstPoint.status;
  if (reading >= lastPoint.reading) return lastPoint.status;

  for (let index = 0; index < points.length - 1; index += 1) {
    const lowerPoint = points[index];
    const upperPoint = points[index + 1];

    if (reading === upperPoint.reading) return upperPoint.status;
    if (reading >= lowerPoint.reading && reading <= upperPoint.reading) {
      return lowerPoint.status || upperPoint.status;
    }
  }

  return null;
}

function getSiloVolumeMetrics(entry: any, calibrationCurves: Record<string, any> | undefined) {
  const reading = Number(entry.reading_value ?? entry.reading ?? 0) || 0;
  if (entry.calculation_method === 'GEOMETRIC_CYLINDER_CONE') {
    try {
      const geometry = calculateSiloGeometry({
        diameter_in: entry.diameter_in,
        total_height_in: entry.total_height_in,
        cone_height_in: entry.cone_height_in,
        bottom_diameter_in: entry.bottom_diameter_in,
        cylinder_height_mode: entry.cylinder_height_mode,
        slope_divisor_mode: entry.slope_divisor_mode,
        reading_reference: entry.reading_reference,
        reading_in: reading,
      });
      return {
        sacks: geometry.calculated_volume_ft3,
        resultLabel: 'ft³ preliminares',
        lbs: null,
        metricTons: null,
        volumePercentage: geometry.total_volume_ft3 > 0
          ? roundTo(geometry.calculated_volume_ft3 / geometry.total_volume_ft3 * 100)
          : null,
        status: 'Cálculo preliminar',
        calculatedVolumeFt3: geometry.calculated_volume_ft3,
        error: null,
      };
    } catch (error) {
      return {
        sacks: 0, resultLabel: 'ft³ preliminares', lbs: null, metricTons: null,
        volumePercentage: null, status: null, calculatedVolumeFt3: 0,
        error: error instanceof Error ? error.message : 'Geometría inválida',
      };
    }
  }
  const conversionTable = entry.conversion_table || {};
  const sacks = hasCalibrationPoints(conversionTable)
    ? convertReadingToVolume(reading, conversionTable)
    : Number(entry.calculated_volume ?? entry.calculated_result_cy ?? 0) || 0;
  const curve = entry.calibration_curve_name
    ? calibrationCurves?.[entry.calibration_curve_name]
    : null;
  const status = getStatusForReading(normalizeCalibrationPoints(curve?.points), reading);
  const maxVolume = Math.max(
    0,
    ...Object.values(conversionTable)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  );
  const volumePercentage = maxVolume > 0 ? roundTo((sacks / maxVolume) * 100) : null;

  return {
    sacks,
    resultLabel: 'resultado por curva',
    lbs: entry.presentation_lbs ?? null,
    metricTons: entry.presentation_metric_tons ?? null,
    volumePercentage,
    status,
    calculatedVolumeFt3: entry.calculated_volume_ft3 ?? null,
    error: null,
  };
}

function clampPercentage(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getSiloLevelColor(percentage: number) {
  if (percentage <= 20) return '#E53E3E';
  if (percentage <= 40) return '#F59E0B';
  return '#2F855A';
}

function SiloLevelIndicator({
  percentage,
  sacks,
  status,
  resultLabel = 'resultado',
}: {
  percentage: number | null | undefined;
  sacks: number;
  status: string | null | undefined;
  resultLabel?: string;
}) {
  const safePercentage = clampPercentage(percentage);
  const fillColor = getSiloLevelColor(safePercentage);

  return (
    <div className="h-full min-h-[192px] rounded border border-[#9D9B9A] bg-white p-4">
      <div className="flex h-full items-center gap-4">
        <div className="relative h-44 w-24 shrink-0 overflow-hidden rounded-md border-2 border-[#3B3A36] bg-[#F2F3F5]">
          <div
            className="absolute bottom-0 left-0 right-0 transition-all"
            style={{ height: `${safePercentage}%`, backgroundColor: fillColor }}
          />
          <div className="absolute left-0 right-0 top-1/4 border-t border-[#9D9B9A]" />
          <div className="absolute left-0 right-0 top-1/2 border-t border-[#9D9B9A]" />
          <div className="absolute left-0 right-0 top-3/4 border-t border-[#9D9B9A]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#3B3A36]">Nivel del silo</p>
          <p className="mt-1 text-2xl font-bold text-[#3B3A36]">
            {percentage === null || percentage === undefined ? '-' : `${formatNumber(safePercentage)}%`}
          </p>
          <p className="mt-2 text-sm font-semibold" style={{ color: fillColor }}>
            {formatNumber(sacks)} {resultLabel}
          </p>
          <p className="mt-1 truncate text-sm font-semibold" style={{ color: fillColor }}>
            {status || '-'}
          </p>
        </div>
      </div>
    </div>
  );
}

export function SilosSection({ onBack }: SilosSectionProps) {
  const { currentPlant } = useAuth();
  const { prefillData, loadPlantData, updateEntry, getCurrentYearMonth } = usePlantPrefill();
  
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);
  const unitCatalog = (prefillData.config?.units || []) as UnitDefinition[];
  const measurementConfigs = (prefillData.config?.measurement_configs || []) as MeasurementConfig[];
  const siloMeasurementConfigs = measurementConfigs.filter((config) => (
    config.section_code !== 'silos' ||
    config.calculation_unit_id === 'sack' ||
    config.display_unit_id === 'sack' ||
    config.inventory_unit_id === 'sack'
  ));
  const siloUnits = resolveEffectiveMeasurementConfig({
    units: unitCatalog,
    configs: siloMeasurementConfigs,
    plantId: currentPlant?.id,
    sectionCode: 'silos',
    fallbackCaptureUnitId: 'in',
    fallbackCalculationUnitId: 'sack',
    fallbackDisplayUnitId: 'sack',
    fallbackInventoryUnitId: 'lb',
    fallbackRuleLabel: 'Curva de silo',
    fallbackRuleDetail: 'La lectura se convierte con la tabla configurada del silo.',
  });

  // Load data when component mounts
  useEffect(() => {
    if (currentPlant) {
      console.log('[SilosSection] Loading data for plant:', currentPlant.id, currentPlant.name);
      const yearMonth = getCurrentYearMonth();
      console.log('[SilosSection] Year-Month:', yearMonth);
      loadPlantData(currentPlant.id, yearMonth);
    } else {
      console.warn('[SilosSection] No currentPlant available');
    }
  }, [currentPlant, loadPlantData, getCurrentYearMonth]);

  // Show loading state
  if (prefillData.loading) {
    return (
      <div className="p-6">
        <Card>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#2475C7] mb-4"></div>
              <p className="text-[#5F6773]">Cargando datos de silos...</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Show error state
  if (prefillData.error) {
    return (
      <div className="p-6">
        <Card className="border-red-300 bg-red-50">
          <div className="p-6">
            <div className="flex items-start gap-3">
              <div className="text-3xl">❌</div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-900 mb-2">
                  Error al Cargar Datos
                </h3>
                <p className="text-red-800 mb-4">
                  {prefillData.error}
                </p>
                <div className="bg-white rounded p-4 mb-4 text-sm text-[#3B3A36]">
                  <p className="font-semibold mb-2">Posibles soluciones:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Verifica que la base de datos esté configurada (Herramientas → Base de Datos)</li>
                    <li>Asegúrate de haber configurado los datos reales de la planta</li>
                    <li>Revisa los logs de la consola para más detalles</li>
                  </ul>
                </div>
                <Button
                  onClick={() => {
                    if (currentPlant) {
                      const yearMonth = getCurrentYearMonth();
                      loadPlantData(currentPlant.id, yearMonth);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  🔄 Reintentar
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // FIELD CHANGE HANDLER
  // ============================================================================

  const handleFieldChange = (entryId: string, field: string, value: any) => {
    const entry = prefillData.silosEntries.find(e => e.id === entryId);
    if (!entry) return;

    const updates: any = { [field]: value };

    // Auto-calculate available volume based on the configured silo curve.
    if (field === 'reading_value') {
      const readingNum = typeof value === 'string' ? parseFloat(value) : value;
      const calculatedVolume = value !== null && value !== undefined && value !== '' && hasCalibrationPoints(entry.conversion_table) && !isNaN(readingNum)
        ? convertReadingToVolume(readingNum, entry.conversion_table)
        : 0;
      updates.calculated_result_cy = calculatedVolume;
      updates.calculated_volume = calculatedVolume;
    }

    updateEntry('silos', entryId, updates);
  };

  // ============================================================================
  // SAVE HANDLER
  // ============================================================================

  const handleSave = async () => {
    if (!prefillData.inventoryMonth) {
      setSaveMessage({ type: 'error', text: 'No hay mes de inventario seleccionado' });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      // Prepare entries for saving (remove temp IDs and internal flags)
      const entriesToSave = prefillData.silosEntries.map(entry => {
        const isGeometric = entry.calculation_method === 'GEOMETRIC_CYLINDER_CONE';
        if (!isGeometric && !hasCalibrationPoints(entry.conversion_table)) {
          throw new Error(`${entry.silo_name}: falta tabla de calibración para calcular la lectura del silo.`);
        }
        if (isGeometric && !entry.product_name) {
          throw new Error(`${entry.silo_name}: selecciona el producto almacenado.`);
        }
        if ((entry.requires_photo ?? true) && !entry.photo_url) {
          throw new Error(`${entry.silo_name}: la fotografía es obligatoria.`);
        }

        const readingValue = Number(entry.reading_value ?? entry.reading ?? 0) || 0;
        const calculatedVolume = isGeometric
          ? getSiloVolumeMetrics(entry, prefillData.config?.calibration_curves).calculatedVolumeFt3 || 0
          : convertReadingToVolume(readingValue, entry.conversion_table);

        return {
          ...(entry._isNew ? {} : { id: entry.id }),
          inventory_month_id: entry.inventory_month_id,
          silo_config_id: entry.silo_config_id,
          silo_name: entry.silo_name,
          measurement_method: entry.measurement_method,
          allowed_products: entry.allowed_products || [],
          product_id: entry.product_id || entry.product_name || null,
          product_name: entry.product_name || null,
          product_in_silo: entry.product_name || null,
          reading_uom: entry.reading_uom || null,
          reading_value: readingValue,
          reading: readingValue,
          previous_reading: entry.previous_reading ?? 0,
          calculated_result_cy: calculatedVolume,
          calculated_volume: calculatedVolume,
          conversion_table: entry.conversion_table || null,
          calculation_method: entry.calculation_method || 'CALIBRATION_CURVE',
          reading_reference: entry.reading_reference || null,
          photo_url: entry.photo_url,
          notes: entry.notes || '',
        };
      });

      const response = await saveSilosEntries(
        prefillData.inventoryMonth.id,
        entriesToSave
      );

      if (response.success) {
        setSaveMessage({ type: 'success', text: '✓ Silos guardados exitosamente' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: 'error', text: `Error: ${response.error}` });
      }
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: `Error al guardar: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      });
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const isEntryComplete = (entry: any): boolean => {
    // Must have reading value and photo
    return !!(
      entry.reading_value !== null &&
      entry.reading_value !== undefined &&
      entry.reading_value !== '' &&
      (!(entry.requires_photo ?? true) || entry.photo_url) &&
      (entry.calculation_method !== 'GEOMETRIC_CYLINDER_CONE' || entry.product_name)
    );
  };

  const completedCount = prefillData.silosEntries.filter(isEntryComplete).length;
  const totalCount = prefillData.silosEntries.length;

  // ============================================================================
  // LOADING & ERROR STATES
  // ============================================================================

  if (prefillData.silosEntries.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] p-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-[#1A1D1F] mb-2">
            Sin Silos Configurados
          </h2>
          <p className="text-[#6F767E]">
            No hay silos configurados para esta planta. 
            Contacta al administrador para configurar los silos.
          </p>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#1A1D1F] mb-2">
            Inventario de Silos
          </h1>
          <p className="text-[#6F767E]">
            {currentPlant?.name} - {formatYearMonthLabel(prefillData.inventoryMonth?.year_month)}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm text-[#9D9B9A]">
              Progreso: {completedCount}/{totalCount} silos completos
            </span>
            {prefillData.previousMonth && (
              <span className="text-sm text-green-700 bg-green-100 px-2 py-1 rounded">
                ✓ Datos del mes anterior precargados
              </span>
            )}
          </div>
          <UnitFlowSummary effectiveConfig={siloUnits} className="mt-4" />
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className={`mb-6 p-4 rounded border ${
            saveMessage.type === 'success' 
              ? 'bg-green-50 border-green-300 text-green-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}>
            {saveMessage.text}
          </div>
        )}

        {/* Instructions */}
        <Card className="p-6 mb-6 bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">
            📋 Instrucciones
          </h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li><strong>Nombre del Silo 🔒:</strong> Preconfigurado por administrativos</li>
            <li><strong>Unidad de Medida 🔒:</strong> Fija según configuración (no editable)</li>
            <li><strong>Lectura:</strong> Ingresa el valor de la lectura del medidor</li>
            <li><strong>Resultado:</strong> El cliente muestra una vista previa; el servidor recalcula el valor autoritativo.</li>
            <li><strong>Evidencia fotográfica:</strong> Requerida cuando así lo indique la configuración del silo.</li>
          </ul>
        </Card>

        {/* Silos List */}
        <div className="space-y-4">
          {prefillData.silosEntries.map((entry, index) => {
            const siloMetrics = getSiloVolumeMetrics(entry, prefillData.config?.calibration_curves);

            return (
              <Card key={entry.id} className="p-6">
              {/* Header */}
              <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-[#1A1D1F]">
                    {entry.silo_name}
                  </h3>
                  <div className="flex gap-3 text-sm text-[#6F767E] mt-1">
                    <span>📏 {entry.calculation_method === 'GEOMETRIC_CYLINDER_CONE' ? 'Geometría cilindro + cono' : 'Curva de calibración'}</span>
                    <span className="font-medium text-[#2B7DE9]">
                      Lectura: {siloUnits.captureLabel || entry.reading_uom || 'nivel'} 🔒
                    </span>
                  </div>
                </div>
                <div className="flex w-full max-w-[520px] shrink-0 flex-col items-end gap-2 self-center lg:self-start">
                  <div className="flex flex-wrap justify-end gap-2">
                    <span className="text-sm font-medium text-[#6F767E] bg-gray-100 px-3 py-1 rounded">
                      Silo #{index + 1}
                    </span>
                    {isEntryComplete(entry) && (
                      <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                        ✓ Completo
                      </span>
                    )}
                    {(entry.requires_photo ?? true) && !entry.photo_url && (
                      <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded">
                        ⚠️ Falta Foto
                      </span>
                    )}
                  </div>
                  <img
                    src={siloMeasurementReference}
                    alt="Referencia de medición de silo: lectura de arriba hacia abajo"
                    className="h-auto max-h-[210px] w-full object-contain"
                  />
                </div>
              </div>

              {/* Reading and Result */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 mb-4">
                {entry.calculation_method === 'GEOMETRIC_CYLINDER_CONE' && (
                  <div>
                    <label className="block text-sm font-medium text-[#1A1D1F] mb-2">Producto almacenado *</label>
                    <select
                      value={entry.product_name || ''}
                      onChange={(event) => handleFieldChange(entry.id, 'product_name', event.target.value)}
                      className="w-full rounded border border-[#9D9B9A] bg-white px-3 py-2.5"
                    >
                      <option value="">-- Selecciona --</option>
                      {(entry.allowed_products || []).map((product: string) => (
                        <option key={product} value={product}>{product}</option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Reading - EDITABLE */}
                <div>
                  <label className="block text-sm font-medium text-[#1A1D1F] mb-2">
                    Lectura ({entry.calculation_method === 'GEOMETRIC_CYLINDER_CONE' ? 'in' : (siloUnits.captureLabel || entry.reading_uom || 'nivel')}) *
                  </label>
                  <NumericInput
                    value={entry.reading_value ?? ''}
                    onValueChange={(value) => handleFieldChange(entry.id, 'reading_value', value)}
                    placeholder="0.00"
                    className="w-full"
                  />
                  <p className="text-xs text-[#6F767E] mt-1">
                    {entry.reading_reference === 'EMPTY_HEIGHT_INCHES' ? 'Altura vacía desde la parte superior' :
                      entry.reading_reference === 'FILLED_HEIGHT_INCHES' ? 'Altura ocupada por material' : 'Ingresa la lectura del medidor'}
                  </p>
                </div>

                {/* Feet - AUTO CONVERTED */}
                <div>
                  <label className="block text-sm font-medium text-[#6F767E] mb-2">
                    Pies
                  </label>
                  <div className="bg-[#F2F3F5] border border-[#9D9B9A] rounded px-3 py-2.5">
                    <span className="text-[#1A1D1F] font-semibold text-lg">
                      {formatNumber(getReadingFeet(entry))} ft
                    </span>
                  </div>
                  <p className="text-xs text-[#6F767E] mt-1">Lectura ÷ 12</p>
                </div>

                {/* Result - AUTO CALCULATED */}
                <div>
                  <label className="block text-sm font-medium text-[#6F767E] mb-2">
                    {entry.calculation_method === 'GEOMETRIC_CYLINDER_CONE' ? 'Volumen disponible (vista previa)' : 'Resultado disponible'} 📊
                  </label>
                  <div className="bg-green-50 border border-green-300 rounded px-3 py-2.5">
                    <span className="text-[#1A1D1F] font-semibold text-lg">
                      {formatNumber(siloMetrics.sacks)} {siloMetrics.resultLabel}
                    </span>
                  </div>
                  <p className="text-xs text-[#6F767E] mt-1">Cálculo automático</p>
                </div>
                {siloMetrics.lbs !== null && <div>
                  <label className="block text-sm font-medium text-[#6F767E] mb-2">
                    Libras (lbs)
                  </label>
                  <div className="bg-[#F2F3F5] border border-[#9D9B9A] rounded px-3 py-2.5">
                    <span className="text-[#1A1D1F] font-semibold text-lg">
                      {formatNumber(siloMetrics.lbs)} lbs
                    </span>
                  </div>
                  <p className="text-xs text-[#6F767E] mt-1">Sacos × 94</p>
                </div>}
                {siloMetrics.metricTons !== null && <div>
                  <label className="block text-sm font-medium text-[#6F767E] mb-2">
                    Toneladas métricas
                  </label>
                  <div className="bg-[#F2F3F5] border border-[#9D9B9A] rounded px-3 py-2.5">
                    <span className="text-[#1A1D1F] font-semibold text-lg">
                      {formatNumber(siloMetrics.metricTons)} t
                    </span>
                  </div>
                  <p className="text-xs text-[#6F767E] mt-1">Lbs ÷ 2204.62</p>
                </div>}
                <div>
                  <label className="block text-sm font-medium text-[#6F767E] mb-2">
                    Status
                  </label>
                  <div className="bg-[#F2F3F5] border border-[#9D9B9A] rounded px-3 py-2.5">
                    <span className="text-[#1A1D1F] font-semibold text-lg">
                      {siloMetrics.status || '-'}
                    </span>
                  </div>
                  <p className="text-xs text-[#6F767E] mt-1">Según curva</p>
                </div>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#1A1D1F] mb-2">
                  Notas / Observaciones
                </label>
                <textarea
                  value={entry.notes || ''}
                  onChange={(e) => handleFieldChange(entry.id, 'notes', e.target.value)}
                  placeholder="Observaciones opcionales..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white border border-[#9D9B9A] rounded focus:outline-none focus:ring-2 focus:ring-[#2B7DE9]"
                />
              </div>

              {/* Photo Capture */}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                <div>
                  <PhotoCapture
                    label="Evidencia Fotográfica del Medidor"
                    required={entry.requires_photo ?? true}
                    onPhotoCapture={(photo) => handleFieldChange(entry.id, 'photo_url', photo)}
                    currentPhoto={entry.photo_url}
                    fit="contain"
                  />
                  {(entry.requires_photo ?? true) && !entry.photo_url && (
                    <p className="text-xs text-red-600 mt-2">
                      ⚠️ La foto del medidor es obligatoria
                    </p>
                  )}
                </div>
                <div className="pt-8">
                  <SiloLevelIndicator
                    percentage={siloMetrics.volumePercentage}
                    sacks={siloMetrics.sacks}
                    status={siloMetrics.status}
                    resultLabel={siloMetrics.resultLabel}
                  />
                </div>
              </div>
              </Card>
            );
          })}
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-4 justify-between items-center sticky bottom-0 bg-white p-4 border-t border-[#9D9B9A] shadow-lg rounded-t">
          <div className="text-sm text-[#6F767E]">
            {completedCount}/{totalCount} silos completos • 
            {totalCount - completedCount > 0 && ` ${totalCount - completedCount} pendientes`}
          </div>
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => onBack?.()}
            >
              Salir
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#2B7DE9] hover:bg-[#1E5DB8] text-white"
            >
              {saving ? 'Guardando...' : 'Guardar Silos'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
