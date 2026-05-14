import React, { useEffect } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { PhotoCapture } from '../../components/PhotoCapture';
import { StandardInput, ReadOnlyField, FormSection } from '../../components/StandardInput';
import { useAuth } from '../../contexts/AuthContext';
import { usePlantPrefill } from '../../contexts/PlantPrefillContext';
import { convertDieselReadingToGallons, calculateDieselConsumption } from '../../utils/diesel';
import { formatYearMonthLabel } from '../../utils/dateFormatting';
import { saveDieselEntry } from '../../utils/api';
import dieselMeasurementReference from '../../../assets/diesel-measurement-reference.png';

function getCalibrationDepthRange(calibrationTable: Record<string, number> | null | undefined) {
  const depths = Object.keys(calibrationTable || {})
    .map((key) => Number(key))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  return {
    min: depths[0] ?? 0,
    max: depths[depths.length - 1] ?? 0,
    count: depths.length,
  };
}

function TankLevelGraphic({
  reading,
  calculatedGallons,
  tankCapacity,
  readingUom,
  calibrationTable,
  plantName,
}: {
  reading: number;
  calculatedGallons: number;
  tankCapacity: number;
  readingUom: string;
  calibrationTable: Record<string, number> | null | undefined;
  plantName?: string;
}) {
  const depthRange = getCalibrationDepthRange(calibrationTable);
  const maxDepth = depthRange.max || 1;
  const fillPercentByDepth = Math.max(0, Math.min(100, (Number(reading || 0) / maxDepth) * 100));
  const volumePercent = tankCapacity > 0
    ? Math.max(0, Math.min(100, (Number(calculatedGallons || 0) / tankCapacity) * 100))
    : 0;
  const waterY = 260 - (fillPercentByDepth / 100) * 220;

  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-[#2F4052]">Monitoreo de Tanque</h3>
        <p className="mt-1 text-sm font-medium text-[#7A858C]">
          {plantName || 'Planta'} | Prof. máx. {maxDepth.toLocaleString()} {readingUom} | Cap. {tankCapacity.toLocaleString()} GAL
        </p>
      </div>

      <div className="mt-4 flex justify-center">
        <svg className="h-auto w-full max-w-[360px]" viewBox="0 0 320 320" role="img" aria-label="Nivel visual del tanque diesel">
          <defs>
            <clipPath id="dieselTankCircle">
              <circle cx="160" cy="160" r="110" />
            </clipPath>
            <linearGradient id="dieselWaterFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#4AB1E8" />
              <stop offset="100%" stopColor="#2475C7" />
            </linearGradient>
          </defs>
          <circle cx="160" cy="160" r="110" fill="#EFF4F7" />
          <g clipPath="url(#dieselTankCircle)">
            <rect x="48" y={waterY} width="224" height="240" fill="url(#dieselWaterFill)" />
            <rect x="48" y={waterY} width="224" height="10" fill="#76C8F0" opacity="0.7" />
          </g>
          <circle cx="160" cy="160" r="110" fill="none" stroke="#2F4052" strokeWidth="10" />
        </svg>
      </div>

      <div className="mt-3 text-center">
        <p className="text-sm font-bold text-[#2F4052]">Profundidad Medida ({readingUom}):</p>
        <p className="mx-auto mt-2 w-36 rounded border border-[#B8C1C7] bg-white px-4 py-2 text-2xl font-semibold text-[#2F4052]">
          {Number(reading || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border border-[#E2EEF8] bg-[#F9FCFF] p-4 text-center shadow-[inset_0_-4px_0_#3AA3DD]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A858C]">Volumen actual</p>
          <p className="mt-2 text-2xl font-bold text-[#2F4052]">
            {Number(calculatedGallons || 0).toLocaleString()} GAL
          </p>
        </div>
        <div className="rounded border border-[#E2EEF8] bg-[#F9FCFF] p-4 text-center shadow-[inset_0_-4px_0_#3AA3DD]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A858C]">% de llenado</p>
          <p className="mt-2 text-2xl font-bold text-[#2F4052]">
            {volumePercent.toFixed(1)}%
          </p>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-[#8A969D]">
        Los valores se calculan mediante interpolación basada en la tabla técnica de {tankCapacity.toLocaleString()} GAL.
      </p>
    </div>
  );
}

export function DieselSection() {
  const { currentPlant } = useAuth();
  const { prefillData, loadPlantData, updateEntry, getCurrentYearMonth } = usePlantPrefill();
  
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Load data when component mounts
  useEffect(() => {
    if (currentPlant) {
      console.log('[DieselSection] Loading data for plant:', currentPlant.id, currentPlant.name);
      const yearMonth = getCurrentYearMonth();
      console.log('[DieselSection] Year-Month:', yearMonth);
      loadPlantData(currentPlant.id, yearMonth);
    } else {
      console.warn('[DieselSection] No currentPlant available');
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
              <p className="text-[#5F6773]">Cargando datos de diesel...</p>
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

  const diesel = prefillData.dieselEntry;

  if (!diesel) {
    return (
      <div className="p-6">
        <Card className="text-center py-12">
          <p className="text-[#5F6773] mb-2">No hay configuración de diesel para esta planta</p>
          <p className="text-sm text-[#5F6773]">
            Contacta al administrador para configurar el tanque de diesel
          </p>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // FIELD CHANGE HANDLER
  // ============================================================================

  const handleFieldChange = (field: string, value: any) => {
    const updates: any = { [field]: value };

    // If reading_inches changes, recalculate gallons
    if (field === 'reading_inches' && diesel.calibration_table) {
      const readingNum = typeof value === 'string' ? parseFloat(value) : value;
      if (!isNaN(readingNum)) {
        const calculatedGallons = convertDieselReadingToGallons(readingNum, diesel.calibration_table);
        updates.calculated_gallons = calculatedGallons;
        updates.ending_inventory = calculatedGallons;
        
        // Recalculate consumption: beginning + purchases - ending
        const consumption = calculateDieselConsumption(
          diesel.beginning_inventory || 0,
          diesel.purchases_gallons || 0,
          calculatedGallons
        );
        updates.consumption_gallons = consumption;
      }
    }

    // If purchases_gallons changes, recalculate consumption
    if (field === 'purchases_gallons') {
      const purchasesNum = typeof value === 'string' ? parseFloat(value) : value;
      if (!isNaN(purchasesNum)) {
        const consumption = calculateDieselConsumption(
          diesel.beginning_inventory || 0,
          purchasesNum,
          diesel.ending_inventory || 0
        );
        updates.consumption_gallons = consumption;
      }
    }

    updateEntry('diesel', diesel.id, updates);
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
      console.log('[DieselSection] Saving entry:', diesel);

      const entryToSave = {
        inventory_month_id: prefillData.inventoryMonth.id,
        diesel_config_id: diesel.diesel_config_id || null,
        plant_id: diesel.plant_id || currentPlant?.id || null,
        unit: diesel.unit || 'gallons',
        reading_uom: diesel.reading_uom || 'inches',
        reading_inches: diesel.reading_inches ?? 0,
        reading: diesel.reading_inches ?? diesel.reading ?? 0,
        calculated_gallons: diesel.calculated_gallons ?? 0,
        calibration_table: diesel.calibration_table || null,
        tank_capacity_gallons: diesel.tank_capacity_gallons ?? 0,
        beginning_inventory: diesel.beginning_inventory ?? 0,
        purchases_gallons: diesel.purchases_gallons ?? 0,
        ending_inventory: diesel.ending_inventory ?? 0,
        consumption_gallons: diesel.consumption_gallons ?? 0,
        photo_url: diesel.photo_url || null,
        notes: diesel.notes || '',
      };
      
      const response = await saveDieselEntry(
        prefillData.inventoryMonth.id,
        entryToSave
      );

      if (response.success) {
        setSaveMessage({ type: 'success', text: '✓ Diesel guardado exitosamente' });
        // Reload data to get fresh ID from database
        if (currentPlant) {
          const yearMonth = getCurrentYearMonth();
          await loadPlantData(currentPlant.id, yearMonth);
        }
      } else {
        setSaveMessage({ type: 'error', text: `Error: ${response.error}` });
      }
    } catch (error) {
      console.error('[DieselSection] Save error:', error);
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
    // Must have reading (can be 0) and photo
    // Note: reading_inches === 0 is VALID, only null/undefined is invalid
    if (diesel.reading_inches === null || diesel.reading_inches === undefined) {
      return false;
    }
    if (!diesel.photo_url) {
      return false;
    }
    // Purchases can be 0 or null (optional)
    return true;
  };

  const isDraft = () => {
    // Has some data but not complete
    return diesel.reading_inches > 0 || diesel.purchases_gallons > 0;
  };

  const numericReading = Number(diesel.reading_inches ?? diesel.reading ?? 0) || 0;
  const numericCalculatedGallons = Number(diesel.calculated_gallons ?? diesel.ending_inventory ?? 0) || 0;
  const numericTankCapacity = Number(diesel.tank_capacity_gallons ?? 0) || 0;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#3B3A36]">Diesel</h2>
          <p className="text-[#5F6773]">Control de Inventario de Diesel</p>
        </div>
        <div className="text-sm text-[#5F6773]">
          <span className="font-semibold">{currentPlant?.name}</span>
          {' • '}
          <span>{formatYearMonthLabel(prefillData.inventoryMonth?.year_month)}</span>
        </div>
      </div>

      {/* TANK INFO */}
      <Card className="bg-[#F2F3F5] border-[#2475C7]/30">
        <div className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#5F6773]">Capacidad del Tanque</p>
                <p className="text-2xl font-bold text-[#2475C7]">
                  {diesel.tank_capacity_gallons?.toLocaleString()} galones
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-sm font-semibold text-[#5F6773]">Método de Medición</p>
                <p className="text-lg font-bold text-[#3B3A36]">
                  Lectura en {diesel.reading_uom}
                </p>
              </div>
            </div>
            <img
              src={dieselMeasurementReference}
              alt="Referencia de medición de diesel: lectura de abajo hacia arriba desde el piso"
              className="h-auto max-h-[190px] w-full max-w-[520px] shrink-0 self-center object-contain lg:self-start"
            />
          </div>
        </div>
      </Card>

      {/* MAIN FORM */}
      <Card className="p-6">
        <div className="space-y-6">
          <TankLevelGraphic
            reading={numericReading}
            calculatedGallons={numericCalculatedGallons}
            tankCapacity={numericTankCapacity}
            readingUom={diesel.reading_uom || 'inches'}
            calibrationTable={diesel.calibration_table}
            plantName={currentPlant?.name}
          />

          {/* PREVIOUS MONTH CARRY-OVER */}
          {prefillData.previousMonth && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold text-blue-900">
                  Inventario Arrastrado del Mes Anterior
                </p>
              </div>
              <p className="text-2xl font-bold text-blue-600 ml-7">
                {(diesel.beginning_inventory || 0).toLocaleString()} galones
              </p>
            </div>
          )}

          {/* READING SECTION */}
          <div>
            <h3 className="text-lg font-bold text-[#3B3A36] mb-4">Lectura Actual del Tanque</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StandardInput
                label={`Lectura del Medidor`}
                value={diesel.reading_inches}
                onChange={(val) => handleFieldChange('reading_inches', val)}
                type="number"
                unit={diesel.reading_uom}
                required={true}
                min={0}
                step={0.01}
                placeholder="0.00"
                helperText="Ingresa la lectura del medidor en pulgadas (0 es válido)"
              />
              <ReadOnlyField
                label="Cantidad Calculada"
                value={(diesel.calculated_gallons || 0).toLocaleString()}
                unit="galones"
                icon={<span>🧮</span>}
              />
            </div>
          </div>

          {/* PURCHASES */}
          <div>
            <h3 className="text-lg font-bold text-[#3B3A36] mb-4">Compras del Mes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StandardInput
                label="Diesel Comprado"
                value={diesel.purchases_gallons}
                onChange={(val) => handleFieldChange('purchases_gallons', val)}
                type="number"
                unit="galones"
                required={false}
                min={0}
                step={0.01}
                placeholder="0.00"
                helperText="Ingresa la cantidad comprada. Si no hubo compras, ingresa 0."
              />
            </div>
          </div>

          {/* CONSUMPTION CALCULATION */}
          <div className="bg-[#2475C7]/10 border-2 border-[#2475C7]/30 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm font-semibold text-[#5F6773] mb-1">Inventario Inicial</p>
                <p className="text-2xl font-bold text-[#3B3A36]">
                  {(diesel.beginning_inventory || 0).toLocaleString()}
                </p>
                <p className="text-xs text-[#5F6773]">galones</p>
              </div>
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm font-semibold text-[#5F6773] mb-1">+ Compras</p>
                  <p className="text-2xl font-bold text-green-600">
                    +{(diesel.purchases_gallons || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-[#5F6773] mt-1">- Inventario Final</p>
                  <p className="text-2xl font-bold text-orange-600">
                    -{(diesel.ending_inventory || 0).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="bg-[#2475C7] text-white rounded-lg p-4 flex flex-col items-center justify-center">
                <p className="text-sm font-semibold mb-2">Consumo Calculado</p>
                <p className="text-4xl font-bold">
                  {(diesel.consumption_gallons || 0).toLocaleString()}
                </p>
                <p className="text-sm mt-1">galones</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[#2475C7]/20">
              <p className="text-xs text-[#5F6773] text-center">
                <span className="font-semibold">Fórmula:</span> Consumo = Inventario Inicial + Compras - Inventario Final
              </p>
            </div>
          </div>

          {/* PHOTO */}
          <PhotoCapture
            label="Foto del Medidor/Tanque"
            required
            currentPhoto={diesel.photo_url}
            onPhotoCapture={(photo) => handleFieldChange('photo_url', photo)}
          />

          {/* NOTES */}
          <div>
            <label className="block text-sm font-semibold text-[#3B3A36] mb-1.5">
              Notas (Opcional)
            </label>
            <textarea
              value={diesel.notes || ''}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              placeholder="Observaciones adicionales..."
              className="w-full px-4 py-2.5 bg-white border border-[#9D9B9A] rounded focus:outline-none focus:ring-2 focus:ring-[#2475C7] focus:border-transparent resize-none"
              rows={3}
            />
          </div>
        </div>
      </Card>

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
          {!isValid() && isDraft() && (
            <span className="text-orange-600">
              ⚠️ Borrador guardado - Completa todos los campos y agrega foto para marcar como completo
            </span>
          )}
          {!isValid() && !isDraft() && (
            <span className="text-[#E53E3E]">
              ⚠️ Completa todos los campos requeridos
            </span>
          )}
          {isValid() && (
            <span className="text-green-600">
              ✓ Listo para guardar
            </span>
          )}
        </div>
        <Button 
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="min-w-[200px]"
        >
          {saving ? 'Guardando...' : isDraft() && !isValid() ? 'Guardar Borrador' : 'Guardar Diesel'}
        </Button>
      </div>
    </div>
  );
}
