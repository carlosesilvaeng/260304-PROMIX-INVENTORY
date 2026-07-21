import React, { useEffect } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { FeetInchesInput } from '../../components/FeetInchesInput';
import { NumericInput } from '../../components/Input';
import { PhotoCapture } from '../../components/PhotoCapture';
import { UnitFlowSummary } from '../../components/UnitFlowSummary';
import { useAuth } from '../../contexts/AuthContext';
import { usePlantPrefill } from '../../contexts/PlantPrefillContext';
import { saveAggregatesEntries } from '../../utils/api';
import { formatFeetInches, isFeetInchesUnit } from '../../utils/feetInches';
import { formatNumber } from '../../utils/numberFormatting';
import {
  convertWithMaterialFactor,
  convertUnit,
  getUnitSymbol,
  resolveEffectiveMeasurementConfig,
  resolveMeasurementConfig,
  type MaterialConversionFactor,
  type MeasurementConfig,
  type UnitDefinition,
} from '../../utils/unitConversion';

interface AggregatesSectionProps {
  onBack?: () => void;
}

export function AggregatesSection({ onBack }: AggregatesSectionProps) {
  const { currentPlant } = useAuth();
  const { prefillData, loadPlantData, updateEntry, getCurrentYearMonth } = usePlantPrefill();
  
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);
  const unitCatalog = (prefillData.config?.units || []) as UnitDefinition[];
  const measurementConfigs = (prefillData.config?.measurement_configs || []) as MeasurementConfig[];
  const aggregateMeasurementConfig = resolveMeasurementConfig(measurementConfigs, {
    plantId: currentPlant?.id,
    sectionCode: 'aggregates',
  });
  const captureUnit = aggregateMeasurementConfig?.capture_unit_id || 'ft';
  const calculationUnit = aggregateMeasurementConfig?.calculation_unit_id || 'ft3';
  const displayUnit = aggregateMeasurementConfig?.display_unit_id || calculationUnit;
  const inventoryUnit = aggregateMeasurementConfig?.inventory_unit_id || displayUnit;
  const materialFactors = (prefillData.config?.material_conversion_factors || []) as MaterialConversionFactor[];
  const aggregateMaterialFactor = materialFactors.find((factor) => factor.id === aggregateMeasurementConfig?.material_conversion_factor_id);
  const usesFeetInchesCapture = isFeetInchesUnit(captureUnit);
  const lengthUnitLabel = usesFeetInchesCapture ? 'ft + in' : getUnitSymbol(unitCatalog, captureUnit, captureUnit === 'm' ? 'm' : 'ft');
  const volumeUnitLabel = getUnitSymbol(unitCatalog, displayUnit, displayUnit === 'm3' ? 'm³' : 'ft³');
  const inventoryUnitLabel = getUnitSymbol(unitCatalog, inventoryUnit, inventoryUnit);
  const aggregateUnits = resolveEffectiveMeasurementConfig({
    units: unitCatalog,
    configs: measurementConfigs,
    plantId: currentPlant?.id,
    sectionCode: 'aggregates',
    fallbackCaptureUnitId: captureUnit,
    fallbackCalculationUnitId: calculationUnit,
    fallbackDisplayUnitId: displayUnit,
    fallbackInventoryUnitId: inventoryUnit,
    fallbackRuleLabel: 'Formula de seccion',
    fallbackRuleDetail: 'El volumen se calcula con la geometria configurada del agregado.',
  });

  // Load data when component mounts
  useEffect(() => {
    if (currentPlant) {
      console.log('[AggregatesSection] Loading data for plant:', currentPlant.id, currentPlant.name);
      const yearMonth = getCurrentYearMonth();
      console.log('[AggregatesSection] Year-Month:', yearMonth);
      loadPlantData(currentPlant.id, yearMonth);
    } else {
      console.warn('[AggregatesSection] No currentPlant available');
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
              <p className="text-[#5F6773]">Cargando datos de agregados...</p>
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
  // VOLUME CALCULATIONS
  // ============================================================================

  const getVolumeUnitForLengthUnit = (unitId: string) => {
    if (unitId === 'm') return 'm3';
    if (unitId === 'ft' || unitId === 'ft-in') return 'ft3';
    return calculationUnit;
  };

  const convertVolumeForDisplay = (rawVolume: number) => {
    const rawVolumeUnit = getVolumeUnitForLengthUnit(captureUnit);
    try {
      const calculationVolume = rawVolumeUnit === calculationUnit
        ? rawVolume
        : convertUnit(rawVolume, rawVolumeUnit, calculationUnit, unitCatalog);
      return calculationUnit === displayUnit
        ? calculationVolume
        : convertUnit(calculationVolume, calculationUnit, displayUnit, unitCatalog);
    } catch (error) {
      console.warn('[AggregatesSection] No se pudo convertir volumen con la configuracion actual:', error);
      return rawVolume;
    }
  };

  const calculateInventoryQuantity = (displayValue: number) => {
    try {
      const calculationValue = displayUnit === calculationUnit
        ? displayValue
        : convertUnit(displayValue, displayUnit, calculationUnit, unitCatalog);
      return calculationUnit === inventoryUnit
        ? calculationValue
        : convertWithMaterialFactor(calculationValue, calculationUnit, inventoryUnit, aggregateMaterialFactor);
    } catch {
      return null;
    }
  };

  const calculateBoxVolume = (width: number, height: number, length: number): number => {
    return convertVolumeForDisplay(width * height * length);
  };

  const calculateConeVolume = (m1: number, m2: number, m3: number, m4: number, m5: number, m6: number, d1: number, d2: number): number => {
    // V = (π × r² × h) / 3  —  r = (D1+D2)/4 (radio promedio), h = √(avgM² − r²) (altura por Pitágoras)
    const r = (d1 + d2) / 4;
    const avgM = (m1 + m2 + m3 + m4 + m5 + m6) / 6;
    const hSquared = Math.pow(avgM, 2) - Math.pow(r, 2);
    if (hSquared <= 0) return 0; // geometría inválida: avgM debe ser mayor que r
    return convertVolumeForDisplay((Math.PI * Math.pow(r, 2) * Math.sqrt(hSquared)) / 3);
  };

  // ============================================================================
  // FIELD CHANGE HANDLER
  // ============================================================================

  const handleFieldChange = (entryId: string, field: string, value: any) => {
    const entry = prefillData.agregadosEntries.find(e => e.id === entryId);
    if (!entry) return;

    const updates: any = { [field]: value };

    // Auto-calculate volume based on method
    if (entry.measurement_method === 'BOX') {
      if (field === 'box_height_ft' || field === 'box_length_ft') {
        const width = Number(entry.box_width_ft ?? 0);
        const height = Number(field === 'box_height_ft' ? value : entry.box_height_ft ?? 0);
        const length = Number(field === 'box_length_ft' ? value : entry.box_length_ft ?? 0);
        updates.calculated_volume_cy = calculateBoxVolume(width, height, length);
        updates.unit = displayUnit;
      }
    } else if (entry.measurement_method === 'CONE') {
      // CONE method: calculate when any measurement changes
      if (field.startsWith('cone_')) {
        const m1 = field === 'cone_m1' ? value : entry.cone_m1;
        const m2 = field === 'cone_m2' ? value : entry.cone_m2;
        const m3 = field === 'cone_m3' ? value : entry.cone_m3;
        const m4 = field === 'cone_m4' ? value : entry.cone_m4;
        const m5 = field === 'cone_m5' ? value : entry.cone_m5;
        const m6 = field === 'cone_m6' ? value : entry.cone_m6;
        const d1 = field === 'cone_d1' ? value : entry.cone_d1;
        const d2 = field === 'cone_d2' ? value : entry.cone_d2;
        
        if ([m1, m2, m3, m4, m5, m6, d1, d2].every(v => v !== null && v !== undefined && v !== '')) {
          updates.calculated_volume_cy = calculateConeVolume(m1, m2, m3, m4, m5, m6, d1, d2);
          updates.unit = displayUnit;
        } else {
          updates.calculated_volume_cy = 0;
          updates.unit = displayUnit;
        }
      }
    }

    updateEntry('agregados', entryId, updates);
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
      // Prepare entries for saving (remove temp IDs and _isNew flag)
      const entriesToSave = prefillData.agregadosEntries.map(entry => ({
        ...entry,
        unit: displayUnit,
        id: entry._isNew ? undefined : entry.id, // Remove temp ID for new entries
        _isNew: undefined, // Remove internal flag
      }));

      const response = await saveAggregatesEntries(
        prefillData.inventoryMonth.id,
        entriesToSave
      );

      if (response.success) {
        setSaveMessage({ type: 'success', text: '✓ Agregados guardados exitosamente' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: 'error', text: `Error: ${response.error}` });
      }
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Error al guardar los datos' });
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const isEntryComplete = (entry: any): boolean => {
    // Has photo
    if (!entry.photo_url) return false;

    // For BOX method
    if (entry.measurement_method === 'BOX') {
      return [
        entry.box_height_ft,
        entry.box_length_ft,
      ].every(v => v !== null && v !== undefined && v !== '');
    }

    // For CONE method
    if (entry.measurement_method === 'CONE') {
      return [
        entry.cone_m1, entry.cone_m2, entry.cone_m3,
        entry.cone_m4, entry.cone_m5, entry.cone_m6,
        entry.cone_d1, entry.cone_d2,
      ].every(v => v !== null && v !== undefined && v !== '');
    }

    return false;
  };

  const completedCount = prefillData.agregadosEntries.filter(isEntryComplete).length;
  const totalCount = prefillData.agregadosEntries.length;
  const formatLengthValue = (value: number | string | null | undefined) => (
    usesFeetInchesCapture ? formatFeetInches(value, `0 ft 0 in`) : `${formatNumber(value || 0)} ${lengthUnitLabel}`
  );
  const renderLengthInput = (
    entryId: string,
    field: string,
    label: string,
    value: number | string | null | undefined,
    helperText?: string,
  ) => (
    usesFeetInchesCapture ? (
      <FeetInchesInput
        label={label}
        value={value}
        onValueChange={(nextValue) => handleFieldChange(entryId, field, nextValue)}
        required
        helperText={helperText}
      />
    ) : (
      <div>
        <label className="block text-sm font-medium text-[#1A1D1F] mb-2">
          {label} ({lengthUnitLabel}) *
        </label>
        <NumericInput
          value={value ?? ''}
          onValueChange={(nextValue) => handleFieldChange(entryId, field, nextValue)}
          placeholder="0.00"
          className="w-full"
        />
        {helperText && <p className="text-xs text-[#6F767E] mt-1">{helperText}</p>}
      </div>
    )
  );

  if (prefillData.agregadosEntries.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] p-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-[#1A1D1F] mb-2">
            Sin Agregados Configurados
          </h2>
          <p className="text-[#6F767E]">
            No hay agregados configurados para esta planta. 
            Contacta al administrador para configurar los agregados.
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
            Inventario de Agregados
          </h1>
          <p className="text-[#6F767E]">
            {currentPlant?.name} - {prefillData.inventoryMonth?.year_month}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm text-[#9D9B9A]">
              Progreso: {completedCount}/{totalCount} agregados completos
            </span>
            {prefillData.previousMonth && (
              <span className="text-sm text-green-700 bg-green-100 px-2 py-1 rounded">
                ✓ Datos del mes anterior precargados
              </span>
            )}
          </div>
          <UnitFlowSummary effectiveConfig={aggregateUnits} className="mt-4" />
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
            <li><strong>Campos bloqueados 🔒:</strong> Material, procedencia, método y ancho (vienen de configuración)</li>
            <li><strong>Método Cajón:</strong> Captura alto y largo en {lengthUnitLabel}</li>
            <li><strong>Método Cono:</strong> Captura 6 medidas M y 2 diámetros D en {lengthUnitLabel}</li>
            <li><strong>Volumen calculado:</strong> Se actualiza automáticamente en {volumeUnitLabel}</li>
            <li><strong>Agregado no usado:</strong> Si un agregado no se usó, ingresa 0 en largo o medidas</li>
            <li><strong>Evidencia fotográfica:</strong> Requerida para cada agregado</li>
          </ul>
        </Card>

        {/* Aggregates List */}
        <div className="space-y-4">
          {prefillData.agregadosEntries.map((entry, index) => (
            <Card key={entry.id} className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[#1A1D1F]">
                    {entry.aggregate_name}
                  </h3>
                  <div className="flex gap-3 text-sm text-[#6F767E] mt-1">
                    <span>📦 {entry.material_type}</span>
                    <span>📍 Procedencia: {entry.location_area}</span>
                    <span className="font-medium text-[#2B7DE9]">
                      {entry.measurement_method === 'BOX' ? '📏 Cajón' : '🔺 Cono'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-sm font-medium text-[#6F767E] bg-gray-100 px-3 py-1 rounded">
                    #{index + 1}
                  </span>
                  {isEntryComplete(entry) && (
                    <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                      ✓ Completo
                    </span>
                  )}
                </div>
              </div>

              {/* BOX METHOD */}
              {entry.measurement_method === 'BOX' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Width - READ ONLY */}
                    <div>
                      <label className="block text-sm font-medium text-[#6F767E] mb-2">
                        Ancho ({lengthUnitLabel}) 🔒
                      </label>
                      <div className="bg-gray-100 border border-gray-300 rounded px-3 py-2 text-[#3B3A36]">
                        {formatLengthValue(entry.box_width_ft || 0)}
                      </div>
                    </div>

                    {/* Height - EDITABLE */}
                    {renderLengthInput(entry.id, 'box_height_ft', 'Alto', entry.box_height_ft)}

                    {/* Length - EDITABLE */}
                    {renderLengthInput(entry.id, 'box_length_ft', 'Largo', entry.box_length_ft, 'Si no se usó, ingresa 0')}

                    {/* Volume - AUTO CALCULATED */}
                    <div>
                      <label className="block text-sm font-medium text-[#6F767E] mb-2">
                        Volumen ({volumeUnitLabel}) 📊
                      </label>
                      <div className="bg-green-50 border border-green-300 rounded px-3 py-2 text-[#1A1D1F] font-semibold">
                        {formatNumber(entry.calculated_volume_cy || 0)} {volumeUnitLabel}
                      </div>
                      {inventoryUnit !== displayUnit && (
                        <p className="mt-1 text-xs text-[#6F767E]">
                          Inventario:{' '}
                          {calculateInventoryQuantity(Number(entry.calculated_volume_cy || 0)) === null
                            ? 'requiere factor'
                            : `${formatNumber(calculateInventoryQuantity(Number(entry.calculated_volume_cy || 0)) || 0)} ${inventoryUnitLabel}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* CONE METHOD */}
              {entry.measurement_method === 'CONE' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* M Measurements */}
                    <div>
                      {renderLengthInput(entry.id, 'cone_m1', 'M1', entry.cone_m1)}
                    </div>
                    <div>
                      {renderLengthInput(entry.id, 'cone_m2', 'M2', entry.cone_m2)}
                    </div>
                    <div>
                      {renderLengthInput(entry.id, 'cone_m3', 'M3', entry.cone_m3)}
                    </div>
                    <div>
                      {renderLengthInput(entry.id, 'cone_m4', 'M4', entry.cone_m4)}
                    </div>
                    <div>
                      {renderLengthInput(entry.id, 'cone_m5', 'M5', entry.cone_m5)}
                    </div>
                    <div>
                      {renderLengthInput(entry.id, 'cone_m6', 'M6', entry.cone_m6)}
                    </div>

                    {/* D Measurements */}
                    <div>
                      {renderLengthInput(entry.id, 'cone_d1', 'D1', entry.cone_d1)}
                    </div>
                    <div>
                      {renderLengthInput(entry.id, 'cone_d2', 'D2', entry.cone_d2)}
                    </div>
                  </div>

                  {/* Volume */}
                  <div>
                    <label className="block text-sm font-medium text-[#6F767E] mb-2">
                      Volumen Calculado ({volumeUnitLabel}) 📊
                    </label>
                    <div className="bg-green-50 border border-green-300 rounded px-3 py-2 text-[#1A1D1F] font-semibold text-lg">
                      {formatNumber(entry.calculated_volume_cy || 0)} {volumeUnitLabel}
                    </div>
                    {inventoryUnit !== displayUnit && (
                      <p className="mt-1 text-xs text-[#6F767E]">
                        Inventario:{' '}
                        {calculateInventoryQuantity(Number(entry.calculated_volume_cy || 0)) === null
                          ? 'requiere factor'
                          : `${formatNumber(calculateInventoryQuantity(Number(entry.calculated_volume_cy || 0)) || 0)} ${inventoryUnitLabel}`}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="mt-4">
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
              <div className="mt-4">
                <label className="block text-sm font-medium text-[#1A1D1F] mb-2">
                  Evidencia Fotográfica *
                </label>
                <PhotoCapture
                  label=""
                  onPhotoCapture={(photo) => handleFieldChange(entry.id, 'photo_url', photo)}
                  currentPhoto={entry.photo_url}
                  fit="contain"
                />
              </div>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-4 justify-between items-center sticky bottom-0 bg-white p-4 border-t border-[#9D9B9A] shadow-lg rounded-t">
          <div className="text-sm text-[#6F767E]">
            {completedCount}/{totalCount} agregados completos • 
            {totalCount - completedCount > 0 && ` ${totalCount - completedCount} pendientes`}
          </div>
          <div className="flex gap-4">
            <Button
              variant="dangerOutline"
              onClick={() => onBack?.()}
            >
              Salir
            </Button>
            <Button
              variant="success"
              onClick={handleSave}
              disabled={saving}
              className="min-w-[180px]"
            >
              {saving ? 'Guardando...' : 'Guardar Agregados'}
            </Button>
            {completedCount === totalCount && totalCount > 0 && (
              <Button
                variant="success"
                onClick={() => onBack?.()}
              >
                ✅ Terminar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
