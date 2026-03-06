import React, { useEffect } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { PhotoCapture } from '../../components/PhotoCapture';
import { StandardInput, ReadOnlyField, FormSection } from '../../components/StandardInput';
import { useAuth } from '../../contexts/AuthContext';
import { usePlantPrefill } from '../../contexts/PlantPrefillContext';
import { convertDieselReadingToGallons, calculateDieselConsumption } from '../../config/dieselConfig';
import { saveDieselEntry } from '../../utils/api';

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
                    <li>Verifica que la base de datos esté configurada (Settings → Database Setup)</li>
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
      
      const response = await saveDieselEntry(
        prefillData.inventoryMonth.id,
        diesel
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
          <span>
            {prefillData.inventoryMonth?.year_month 
              ? new Date(prefillData.inventoryMonth.year_month + '-01').toLocaleDateString('es-ES', { 
                  month: 'long', 
                  year: 'numeric' 
                })
              : 'Sin mes'}
          </span>
        </div>
      </div>

      {/* TANK INFO */}
      <Card className="bg-[#F2F3F5] border-[#2475C7]/30">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#5F6773]">Capacidad del Tanque</p>
              <p className="text-2xl font-bold text-[#2475C7]">
                {diesel.tank_capacity_gallons?.toLocaleString()} galones
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-[#5F6773]">Método de Medición</p>
              <p className="text-lg font-bold text-[#3B3A36]">
                Lectura en {diesel.reading_uom}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* MAIN FORM */}
      <Card className="p-6">
        <div className="space-y-6">
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
              className="w-full px-4 py-2.5 border border-[#9D9B9A] rounded focus:outline-none focus:ring-2 focus:ring-[#2475C7] focus:border-transparent resize-none"
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
