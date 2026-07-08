import React, { useEffect, useState } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { NumericInput } from '../../components/Input';
import { PhotoCapture } from '../../components/PhotoCapture';
import { UnitFlowSummary } from '../../components/UnitFlowSummary';
import { useAuth } from '../../contexts/AuthContext';
import { usePlantPrefill } from '../../contexts/PlantPrefillContext';
import { convertReadingToVolume, hasCalibrationPoints } from '../../utils/calibration';
import { formatYearMonthLabel } from '../../utils/dateFormatting';
import { formatOptionalNumber, formatNumber } from '../../utils/numberFormatting';
import { saveAdditivesEntries } from '../../utils/api';
import {
  convertForCalculationToDisplay,
  resolveEffectiveMeasurementConfig,
  type MeasurementConfig,
  type UnitDefinition,
} from '../../utils/unitConversion';
import {
  calculateAdditiveMeasurement,
  normalizeAdditiveMeasurementMethod,
} from '../../../../supabase/functions/make-server/additive_measurement';
import additiveTankMeasurementReference from '../../../assets/additive-tank-measurement-reference.png';

type TabType = 'tanks' | 'manual';

type AdditiveCalibrationPoint = {
  point_key: number;
  point_value: number;
  available_gallons?: number | null;
  consumed_gallons?: number | null;
  percentage?: number | null;
  status?: string | null;
};

function roundTo(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeAdditiveCalibrationPoints(points: AdditiveCalibrationPoint[] | null | undefined) {
  return (points || [])
    .map((point) => ({
      reading: Number(point.point_key),
      availableVolume: Number(point.available_gallons ?? point.point_value),
      consumedVolume: point.consumed_gallons === null || point.consumed_gallons === undefined
        ? null
        : Number(point.consumed_gallons),
      volumePercentage: point.percentage === null || point.percentage === undefined
        ? null
        : Number(point.percentage),
      status: point.status || null,
    }))
    .filter((point) => Number.isFinite(point.reading) && Number.isFinite(point.availableVolume))
    .sort((left, right) => left.reading - right.reading);
}

function interpolateOptionalNumber(
  reading: number,
  lowerReading: number,
  upperReading: number,
  lowerValue: number | null,
  upperValue: number | null
) {
  if (lowerValue === null || upperValue === null) return lowerValue ?? upperValue;
  if (lowerReading === upperReading) return lowerValue;
  const ratio = (reading - lowerReading) / (upperReading - lowerReading);
  return roundTo(lowerValue + (upperValue - lowerValue) * ratio);
}

function getStatusForReading(
  points: ReturnType<typeof normalizeAdditiveCalibrationPoints>,
  reading: number,
) {
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

function getAdditiveTankMetrics(entry: any) {
  const reading = Number(entry.reading_value ?? entry.reading ?? 0) || 0;
  const points = normalizeAdditiveCalibrationPoints(entry.calibration_points);
  const fallbackAvailableVolume = Number(entry.calculated_volume ?? entry.calculated_gallons ?? 0) || 0;

  if (points.length === 0) {
    return {
      availableVolume: fallbackAvailableVolume,
      consumedVolume: null,
      volumePercentage: null,
      status: null,
    };
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const curveStatus = getStatusForReading(points, reading);

  if (reading <= firstPoint.reading) {
    return {
      availableVolume: roundTo(firstPoint.availableVolume),
      consumedVolume: firstPoint.consumedVolume,
      volumePercentage: firstPoint.volumePercentage,
      status: curveStatus,
    };
  }

  if (reading >= lastPoint.reading) {
    return {
      availableVolume: roundTo(lastPoint.availableVolume),
      consumedVolume: lastPoint.consumedVolume,
      volumePercentage: lastPoint.volumePercentage,
      status: curveStatus,
    };
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const lowerPoint = points[index];
    const upperPoint = points[index + 1];

    if (reading >= lowerPoint.reading && reading <= upperPoint.reading) {
      const rawAvailableVolume = interpolateOptionalNumber(
        reading,
        lowerPoint.reading,
        upperPoint.reading,
        lowerPoint.availableVolume,
        upperPoint.availableVolume
      ) ?? fallbackAvailableVolume;
      const rawConsumedVolume = interpolateOptionalNumber(
        reading,
        lowerPoint.reading,
        upperPoint.reading,
        lowerPoint.consumedVolume,
        upperPoint.consumedVolume
      );
      const rawVolumePercentage = interpolateOptionalNumber(
        reading,
        lowerPoint.reading,
        upperPoint.reading,
        lowerPoint.volumePercentage,
        upperPoint.volumePercentage
      );

      return {
        availableVolume: rawAvailableVolume,
        consumedVolume: rawConsumedVolume,
        volumePercentage: rawVolumePercentage,
        status: curveStatus,
      };
    }
  }

  return {
    availableVolume: fallbackAvailableVolume,
    consumedVolume: null,
    volumePercentage: null,
    status: null,
  };
}

const GALLON_TO_M3 = 0.003785411784;

function volumeFactorToM3(unit: UnitDefinition | undefined) {
  if (!unit) return null;
  const factor = Number(unit.factor_to_base);
  if (!Number.isFinite(factor) || factor <= 0) return null;
  if (unit.category_id === 'volume') return factor;
  if (unit.category_id === 'capacity') return factor * GALLON_TO_M3;
  return null;
}

function formatMetricValue(value: number | null | undefined, fallback = '-') {
  return formatOptionalNumber(value, 2, fallback);
}

function clampPercentage(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getTankLevelColor(percentage: number) {
  if (percentage <= 20) return '#E53E3E';
  if (percentage <= 40) return '#F59E0B';
  return '#2F855A';
}

function TankLevelIndicator({
  percentage,
  status,
}: {
  percentage: number | null | undefined;
  status: string | null | undefined;
}) {
  const safePercentage = clampPercentage(percentage);
  const fillColor = getTankLevelColor(safePercentage);

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
          <p className="text-sm font-semibold text-[#3B3A36]">Nivel del tanque</p>
          <p className="mt-1 text-2xl font-bold text-[#3B3A36]">{formatNumber(safePercentage)}%</p>
          <p className="mt-2 truncate text-sm font-semibold" style={{ color: fillColor }}>
            {status || '-'}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AdditivesSection() {
  const { currentPlant } = useAuth();
  const { prefillData, loadPlantData, updateEntry, getCurrentYearMonth } = usePlantPrefill();
  
  const [activeTab, setActiveTab] = useState<TabType>('tanks');
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);
  const unitCatalog = (prefillData.config?.units || []) as UnitDefinition[];
  const measurementConfigs = (prefillData.config?.measurement_configs || []) as MeasurementConfig[];
  const additiveUnits = resolveEffectiveMeasurementConfig({
    units: unitCatalog,
    configs: measurementConfigs,
    plantId: currentPlant?.id,
    sectionCode: 'additives',
    fallbackCaptureUnitId: 'in',
    fallbackCalculationUnitId: 'gal_us',
    fallbackDisplayUnitId: 'gal_us',
    fallbackInventoryUnitId: 'gal_us',
    fallbackRuleLabel: 'Curva de tanque',
    fallbackRuleDetail: 'La lectura se convierte con la curva configurada del tanque de aditivo.',
  });
  const getEffectiveUnitsForEntry = (entry: any) => resolveEffectiveMeasurementConfig({
    units: unitCatalog,
    configs: measurementConfigs,
    plantId: currentPlant?.id,
    sectionCode: 'additives',
    equipmentId: entry.additive_config_id,
    fallbackCaptureUnitId: entry.dimension_unit_id || 'in',
    fallbackCalculationUnitId: entry.capacity_unit_id || 'gal_us',
    fallbackDisplayUnitId: entry.capacity_unit_id || 'gal_us',
    fallbackInventoryUnitId: entry.capacity_unit_id || 'gal_us',
    fallbackRuleLabel: 'Método de medición del tanque',
    fallbackRuleDetail: 'El servidor recalcula el volumen usando la configuración del equipo.',
  });

  const getEntryMetrics = (entry: any) => {
    const method = normalizeAdditiveMeasurementMethod(
      entry.measurement_method || (entry.additive_type === 'TANK' ? 'CURVE' : 'MANUAL'),
    );
    if (method === 'CURVE') return getAdditiveTankMetrics(entry);
    if (method === 'MANUAL') {
      return { availableVolume: Number(entry.quantity ?? 0), consumedVolume: null, volumePercentage: null, status: null };
    }
    const effective = getEffectiveUnitsForEntry(entry);
    const dimensionUnit = unitCatalog.find((unit) => unit.id === entry.dimension_unit_id);
    const calculationUnit = unitCatalog.find((unit) => unit.id === effective.calculationUnitId);
    const capacityUnit = unitCatalog.find((unit) => unit.id === entry.capacity_unit_id);
    try {
      const result = calculateAdditiveMeasurement({
        method,
        diameter: entry.diameter,
        length: entry.length,
        width: entry.width,
        total_height: entry.total_height,
        capacity: entry.capacity,
        dimension_factor_to_base: Number(dimensionUnit?.factor_to_base),
        calculation_volume_factor_to_base: volumeFactorToM3(calculationUnit),
        capacity_volume_factor_to_base: volumeFactorToM3(capacityUnit),
      }, { reading: entry.reading_value });
      const displayedVolume = convertForCalculationToDisplay(
        result.calculated_volume,
        effective,
        unitCatalog,
      );
      return {
        availableVolume: displayedVolume,
        consumedVolume: null,
        volumePercentage: result.inventory_percentage,
        status: result.inventory_percentage !== null
          ? result.inventory_percentage <= 20 ? 'Bajo' : result.inventory_percentage <= 40 ? 'Medio' : 'Disponible'
          : null,
      };
    } catch {
      return {
        availableVolume: Number(entry.calculated_volume ?? 0) || 0,
        consumedVolume: null,
        volumePercentage: entry.inventory_percentage ?? null,
        status: null,
      };
    }
  };

  // Load data when component mounts
  useEffect(() => {
    if (currentPlant) {
      console.log('[AdditivesSection] Loading data for plant:', currentPlant.id, currentPlant.name);
      const yearMonth = getCurrentYearMonth();
      console.log('[AdditivesSection] Year-Month:', yearMonth);
      loadPlantData(currentPlant.id, yearMonth);
    } else {
      console.warn('[AdditivesSection] No currentPlant available');
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
              <p className="text-[#5F6773]">Cargando datos de aditivos...</p>
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
  // SEPARATE TANKS AND MANUAL ADDITIVES
  // ============================================================================

  const tankEntries = prefillData.aditivosEntries.filter((e: any) => e.additive_type === 'TANK');
  const manualEntries = prefillData.aditivosEntries.filter((e: any) => e.additive_type === 'MANUAL');

  console.log('[AdditivesSection] Tank entries:', tankEntries);
  console.log('[AdditivesSection] Manual entries:', manualEntries);

  // ============================================================================
  // FIELD CHANGE HANDLER
  // ============================================================================

  const handleFieldChange = (entryId: string, field: string, value: any) => {
    const entry = prefillData.aditivosEntries.find((e: any) => e.id === entryId);
    if (!entry) return;

    const updates: any = { [field]: value };
    const hasNumericValue = value !== null && value !== undefined && value !== '';

    const method = normalizeAdditiveMeasurementMethod(
      entry.measurement_method || (entry.additive_type === 'TANK' ? 'CURVE' : 'MANUAL'),
    );

    // Client preview only; the server recalculates authoritatively on save.
    if (method === 'CURVE' && field === 'reading_value' && entry.conversion_table) {
      const readingNum = typeof value === 'string' ? parseFloat(value) : value;
      if (hasNumericValue && !isNaN(readingNum)) {
        const metrics = getAdditiveTankMetrics({
          ...entry,
          reading_value: readingNum,
          calculated_volume: convertReadingToVolume(readingNum, entry.conversion_table),
        });
        updates.calculated_volume = metrics.availableVolume;
        updates.calculated_gallons = metrics.availableVolume;
      } else if (!hasNumericValue) {
        updates.calculated_volume = 0;
        updates.calculated_gallons = 0;
      }
    }
    if ((method === 'CYLINDER_VERTICAL' || method === 'RECTANGULAR_IBC') && field === 'reading_value') {
      const previewEntry = { ...entry, reading_value: value };
      const metrics = getEntryMetrics(previewEntry);
      updates.calculated_volume = metrics.availableVolume;
      updates.calculated_gallons = metrics.availableVolume;
      updates.inventory_percentage = metrics.volumePercentage;
    }

    // For MANUAL type, keep empty distinct from an explicit 0 while editing.
    if (method === 'MANUAL' && field === 'quantity') {
      const quantityNum = typeof value === 'string' ? parseFloat(value) : value;
      updates.quantity = hasNumericValue && !isNaN(quantityNum) ? quantityNum : null;
    }

    updateEntry('aditivos', entryId, updates);
  };

  // ============================================================================
  // SAVE HANDLER
  // ============================================================================

  const handleSave = async () => {
    if (!prefillData.inventoryMonth) {
      setSaveMessage({ type: 'error', text: 'No hay mes de inventario disponible' });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      console.log('[AdditivesSection] Saving entries:', prefillData.aditivosEntries);

      const entriesToSave = prefillData.aditivosEntries.map((entry: any) => {
        const method = normalizeAdditiveMeasurementMethod(
          entry.measurement_method || (entry.additive_type === 'TANK' ? 'CURVE' : 'MANUAL'),
        );
        const isTank = method !== 'MANUAL';
        if (method === 'CURVE' && !hasCalibrationPoints(entry.conversion_table)) {
          throw new Error(`${entry.product_name}: falta tabla de calibración para calcular la lectura del tanque.`);
        }

        const readingValue = Number(entry.reading_value ?? entry.reading ?? 0) || 0;
        const rawCalculatedVolume = method === 'CURVE'
          ? convertReadingToVolume(readingValue, entry.conversion_table)
          : Number(entry.calculated_volume ?? 0) || 0;
        const tankMetrics = isTank
          ? getEntryMetrics({
            ...entry,
            reading_value: readingValue,
            calculated_volume: rawCalculatedVolume,
          })
          : null;
        const calculatedVolume = tankMetrics?.availableVolume ?? rawCalculatedVolume;

        return {
          ...(entry._isNew ? {} : { id: entry.id }),
          inventory_month_id: entry.inventory_month_id,
          additive_config_id: entry.additive_config_id,
          additive_type: entry.additive_type,
          measurement_method: method,
          product_name: entry.product_name,
          brand: entry.brand || '',
          uom: entry.uom,
          requires_photo: entry.requires_photo ?? false,
          tank_name: entry.tank_name || null,
          reading_uom: entry.reading_uom || null,
          reading_value: readingValue,
          reading: readingValue,
          calculated_volume: calculatedVolume,
          calculated_gallons: isTank ? calculatedVolume : entry.calculated_gallons ?? calculatedVolume,
          conversion_table: entry.conversion_table || null,
          quantity: entry.quantity ?? 0,
          diameter: entry.diameter ?? null,
          length: entry.length ?? null,
          width: entry.width ?? null,
          total_height: entry.total_height ?? null,
          capacity: entry.capacity ?? null,
          dimension_unit_id: entry.dimension_unit_id || null,
          capacity_unit_id: entry.capacity_unit_id || null,
          inventory_percentage: tankMetrics?.volumePercentage ?? null,
          photo_url: entry.photo_url || null,
          notes: entry.notes || '',
        };
      });
      
      const response = await saveAdditivesEntries(
        prefillData.inventoryMonth.id,
        entriesToSave
      );

      if (response.success) {
        setSaveMessage({ type: 'success', text: '✓ Aditivos guardados exitosamente' });
        // Reload data to get fresh IDs from database
        if (currentPlant) {
          const yearMonth = getCurrentYearMonth();
          await loadPlantData(currentPlant.id, yearMonth);
        }
      } else {
        setSaveMessage({ type: 'error', text: `Error: ${response.error}` });
      }
    } catch (error) {
      console.error('[AdditivesSection] Save error:', error);
      setSaveMessage({ 
        type: 'error', 
        text: `Error al guardar: ${error instanceof Error ? error.message : 'Error desconocido'}` 
      });
    } finally {
      setSaving(false);
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
    }
  };

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const isValid = () => {
    // All tanks must have reading and photo
    for (const tank of tankEntries) {
      if (tank.reading_value === null || tank.reading_value === undefined || tank.reading_value === '') {
        return false;
      }
      if (tank.requires_photo && !tank.photo_url) {
        return false;
      }
    }

    // All manual items must have a quantity (can be 0, but must be set)
    for (const manual of manualEntries) {
      if (manual.quantity === null || manual.quantity === undefined || manual.quantity === '') {
        return false;
      }
    }

    return true;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#3B3A36]">Aditivos</h2>
          <p className="text-[#5F6773]">Control de Tanques y Productos Manuales</p>
        </div>
        <div className="text-sm text-[#5F6773]">
          <span className="font-semibold">{currentPlant?.name}</span>
          {' • '}
          <span>{formatYearMonthLabel(prefillData.inventoryMonth?.year_month)}</span>
        </div>
      </div>
      <UnitFlowSummary effectiveConfig={additiveUnits} />

      {/* TABS */}
      <div className="flex gap-2 border-b border-[#D4D2CF]">
        <button
          onClick={() => setActiveTab('tanks')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'tanks'
              ? 'text-[#2475C7] border-b-2 border-[#2475C7]'
              : 'text-[#5F6773] hover:text-[#3B3A36]'
          }`}
        >
          🛢️ Tanques ({tankEntries.length})
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'manual'
              ? 'text-[#2475C7] border-b-2 border-[#2475C7]'
              : 'text-[#5F6773] hover:text-[#3B3A36]'
          }`}
        >
          📦 Manuales ({manualEntries.length})
        </button>
      </div>

      {/* TANK PRODUCTS */}
      {activeTab === 'tanks' && (
        <div className="space-y-4">
          {tankEntries.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-[#5F6773] mb-2">No hay tanques configurados para esta planta</p>
              <p className="text-sm text-[#5F6773]">
                Contacta al administrador para configurar tanques
              </p>
            </Card>
          ) : (
            tankEntries.map((entry: any) => {
              const method = normalizeAdditiveMeasurementMethod(entry.measurement_method || 'CURVE');
              const effectiveUnits = getEffectiveUnitsForEntry(entry);
              const tankMetrics = getEntryMetrics(entry);
              const isCurve = method === 'CURVE';
              const methodLabel = method === 'CYLINDER_VERTICAL'
                ? 'CILINDRO VERTICAL'
                : method === 'RECTANGULAR_IBC' ? 'IBC RECTANGULAR' : 'CURVA';

              return (
              <Card key={entry.id} className="p-6">
                <div className="space-y-4">
                  {/* HEADER */}
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-[#3B3A36]">
                          {entry.tank_name || entry.product_name}
                        </h3>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#2475C7]/10 text-[#2475C7]">
                          {methodLabel}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-[#5F6773]">
                          <span className="font-semibold">Producto:</span> {entry.product_name}
                        </p>
                        {entry.brand && (
                          <p className="text-sm text-[#5F6773]">
                            <span className="font-semibold">Marca:</span> {entry.brand}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="w-full max-w-[360px] shrink-0 self-center lg:self-start">
                      <img
                        src={additiveTankMeasurementReference}
                        alt="Referencia de medición de tanque de aditivo: lectura de abajo hacia arriba"
                        className="h-auto max-h-[150px] w-full object-contain"
                      />
                    </div>
                  </div>

                  {!isCurve && (
                    <div className="rounded border border-[#D7D9DE] bg-[#F9FAFB] px-4 py-3 text-sm text-[#5F6773]">
                      <span className="font-semibold text-[#3B3A36]">Dimensiones configuradas: </span>
                      {method === 'CYLINDER_VERTICAL'
                        ? `diámetro ${entry.diameter}`
                        : `largo ${entry.length} × ancho ${entry.width}`}
                      {` × altura ${entry.total_height} ${effectiveUnits.captureLabel || entry.dimension_unit_id || ''}`}
                      {` · capacidad ${entry.capacity} ${entry.capacity_unit_id || ''}`}
                    </div>
                  )}

                  {/* READING AND VOLUME */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                    <NumericInput
                      label={`${isCurve ? 'Lectura' : 'Altura del líquido'} (${effectiveUnits.captureLabel || entry.reading_uom || 'in'})`}
                      value={entry.reading_value ?? ''}
                      onValueChange={(val) => handleFieldChange(entry.id, 'reading_value', val)}
                      placeholder="0.00"
                      required
                      max={!isCurve && entry.total_height ? entry.total_height : undefined}
                      helpText={isCurve ? 'Ingresa la lectura del medidor del tanque' : `Altura máxima: ${entry.total_height} ${effectiveUnits.captureLabel}`}
                    />
                    <div>
                      <label className="block text-sm font-semibold text-[#3B3A36] mb-1.5">
                        Volumen disponible ({effectiveUnits.displayLabel || entry.uom})
                      </label>
                      <div className="bg-[#F2F3F5] border border-[#9D9B9A] rounded px-4 py-2.5 h-[42px] flex items-center">
                        <span className="text-[#2475C7] font-bold text-lg">
                          {formatMetricValue(tankMetrics.availableVolume, '0.00')}
                        </span>
                        <span className="text-[#5F6773] ml-2 text-sm">{effectiveUnits.displayLabel || entry.uom}</span>
                      </div>
                      <p className="text-xs text-[#5F6773] mt-1">
                        {isCurve ? 'Inventario tomado según curva de conversión' : 'Cálculo geométrico limitado a la capacidad nominal'}
                      </p>
                    </div>
                    {isCurve && <div>
                      <label className="block text-sm font-semibold text-[#3B3A36] mb-1.5">
                        Volumen consumido ({additiveUnits.displayLabel || entry.uom})
                      </label>
                      <div className="bg-[#F2F3F5] border border-[#9D9B9A] rounded px-4 py-2.5 h-[42px] flex items-center">
                        <span className="text-[#3B3A36] font-bold text-lg">
                          {formatMetricValue(tankMetrics.consumedVolume)}
                        </span>
                        {tankMetrics.consumedVolume !== null && tankMetrics.consumedVolume !== undefined && (
                          <span className="text-[#5F6773] ml-2 text-sm">{effectiveUnits.displayLabel || entry.uom}</span>
                        )}
                      </div>
                      <p className="text-xs text-[#5F6773] mt-1">
                        Según curva de calibración
                      </p>
                    </div>}
                    <div>
                      <label className="block text-sm font-semibold text-[#3B3A36] mb-1.5">
                        Porcentaje de volumen
                      </label>
                      <div className="bg-[#F2F3F5] border border-[#9D9B9A] rounded px-4 py-2.5 h-[42px] flex items-center">
                        <span className="text-[#3B3A36] font-bold text-lg">
                          {formatMetricValue(tankMetrics.volumePercentage)}
                        </span>
                        {tankMetrics.volumePercentage !== null && tankMetrics.volumePercentage !== undefined && (
                          <span className="text-[#5F6773] ml-2 text-sm">%</span>
                        )}
                      </div>
                      <p className="text-xs text-[#5F6773] mt-1">
                        {isCurve ? 'Según curva de calibración' : `Capacidad nominal: ${entry.capacity} ${entry.capacity_unit_id || ''}`}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#3B3A36] mb-1.5">
                        Status
                      </label>
                      <div className="bg-[#F2F3F5] border border-[#9D9B9A] rounded px-4 py-2.5 h-[42px] flex items-center">
                        <span className="text-[#3B3A36] font-bold truncate">
                          {tankMetrics.status || '-'}
                        </span>
                      </div>
                      <p className="text-xs text-[#5F6773] mt-1">
                        Según lectura del tanque
                      </p>
                    </div>
                  </div>

                  {/* PHOTO */}
                  {entry.requires_photo && (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                      <PhotoCapture
                        label="Foto del Medidor"
                        required
                        currentPhoto={entry.photo_url}
                        onPhotoCapture={(photo) => handleFieldChange(entry.id, 'photo_url', photo)}
                        fit="contain"
                      />
                      <div className="pt-8">
                        <TankLevelIndicator
                          percentage={tankMetrics.volumePercentage}
                          status={tankMetrics.status}
                        />
                      </div>
                    </div>
                  )}

                  {/* NOTES */}
                  <div>
                    <label className="block text-sm font-semibold text-[#3B3A36] mb-1.5">
                      Notas (Opcional)
                    </label>
                    <textarea
                      value={entry.notes || ''}
                      onChange={(e) => handleFieldChange(entry.id, 'notes', e.target.value)}
                      placeholder="Observaciones adicionales..."
                      className="w-full px-4 py-2.5 bg-white border border-[#9D9B9A] rounded focus:outline-none focus:ring-2 focus:ring-[#2475C7] focus:border-transparent resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </Card>
              );
            })
          )}
        </div>
      )}

      {/* MANUAL PRODUCTS */}
      {activeTab === 'manual' && (
        <div className="space-y-4">
          {manualEntries.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-[#5F6773] mb-2">No hay productos manuales configurados para esta planta</p>
              <p className="text-sm text-[#5F6773]">
                Contacta al administrador para configurar productos manuales
              </p>
            </Card>
          ) : (
            manualEntries.map((entry: any) => (
              <Card key={entry.id} className="p-6">
                <div className="space-y-4">
                  {/* HEADER */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-[#3B3A36]">
                          {entry.product_name}
                        </h3>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#f59e0b]/10 text-[#f59e0b]">
                          MANUAL
                        </span>
                      </div>
                      {entry.brand && (
                        <p className="text-sm text-[#5F6773]">
                          <span className="font-semibold">Marca:</span> {entry.brand}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* QUANTITY */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NumericInput
                      label={`Cantidad (${entry.uom})`}
                      value={entry.quantity ?? ''}
                      onValueChange={(val) => handleFieldChange(entry.id, 'quantity', val)}
                      placeholder="0"
                      required
                      helpText="Ingresa la cantidad disponible. Si no hay, ingresa 0."
                    />
                    <div>
                      <label className="block text-sm font-semibold text-[#3B3A36] mb-1.5">
                        Unidad de Medida
                      </label>
                      <div className="bg-[#F2F3F5] border border-[#9D9B9A] rounded px-4 py-2.5 h-[42px] flex items-center">
                        <span className="text-[#3B3A36] font-semibold">
                          {entry.uom}
                        </span>
                      </div>
                      <p className="text-xs text-[#5F6773] mt-1">
                        Unidad predefinida por configuración
                      </p>
                    </div>
                  </div>

                  {/* NOTES */}
                  <div>
                    <label className="block text-sm font-semibold text-[#3B3A36] mb-1.5">
                      Notas (Opcional)
                    </label>
                    <textarea
                      value={entry.notes || ''}
                      onChange={(e) => handleFieldChange(entry.id, 'notes', e.target.value)}
                      placeholder="Observaciones adicionales..."
                      className="w-full px-4 py-2.5 bg-white border border-[#9D9B9A] rounded focus:outline-none focus:ring-2 focus:ring-[#2475C7] focus:border-transparent resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* SAVE MESSAGE */}
      {saveMessage && (
        <Card className={`p-4 ${
          saveMessage.type === 'success' 
            ? 'bg-green-50 border-green-300' 
            : 'bg-red-50 border-red-300'
        }`}>
          <p className={`text-sm font-semibold ${
            saveMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
          }`}>
            {saveMessage.text}
          </p>
        </Card>
      )}

      {/* SAVE BUTTON */}
      <div className="flex justify-between items-center pt-4 border-t border-[#D4D2CF]">
        <div className="text-sm text-[#5F6773]">
          {!isValid() && (
            <span className="text-[#E53E3E]">
              ⚠️ Completa todos los campos requeridos antes de guardar
            </span>
          )}
        </div>
        <Button 
          onClick={handleSave}
          disabled={saving || !isValid()}
          size="lg"
          className="min-w-[200px]"
        >
          {saving ? 'Guardando...' : 'Guardar Aditivos'}
        </Button>
      </div>
    </div>
  );
}
