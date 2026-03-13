import React, { useEffect } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { NumericInput } from '../../components/Input';
import { PhotoCapture } from '../../components/PhotoCapture';
import { useAuth } from '../../contexts/AuthContext';
import { usePlantPrefill } from '../../contexts/PlantPrefillContext';
import {
  calculateUtilityConsumption,
  getUtilityTypeLabel,
  getUtilityTypeIcon,
  getUtilityTypeColor,
} from '../../config/utilitiesConfig';
import { formatYearMonthLabel } from '../../utils/dateFormatting';
import { saveUtilitiesEntries } from '../../utils/api';

export function UtilitiesSection() {
  const { currentPlant } = useAuth();
  const { prefillData, loadPlantData, updateEntry, getCurrentYearMonth } = usePlantPrefill();
  
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Load data when component mounts
  useEffect(() => {
    if (currentPlant) {
      console.log('[UtilitiesSection] Loading data for plant:', currentPlant.id, currentPlant.name);
      const yearMonth = getCurrentYearMonth();
      console.log('[UtilitiesSection] Year-Month:', yearMonth);
      loadPlantData(currentPlant.id, yearMonth);
    } else {
      console.warn('[UtilitiesSection] No currentPlant available');
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
              <p className="text-[#5F6773]">Cargando datos de utilidades...</p>
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

  const utilities = prefillData.utilitiesEntries || [];

  if (utilities.length === 0) {
    return (
      <div className="p-6">
        <Card className="text-center py-12">
          <p className="text-[#5F6773] mb-2">No hay medidores configurados para esta planta</p>
          <p className="text-sm text-[#5F6773]">
            Contacta al administrador para configurar los medidores de utilidades
          </p>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // FIELD CHANGE HANDLER
  // ============================================================================

  const handleFieldChange = (utility: any, field: string, value: any) => {
    const updates: any = { [field]: value };

    // If current_reading changes, recalculate consumption
    if (field === 'current_reading') {
      const currentNum = typeof value === 'string' ? parseFloat(value) : value;
      if (!isNaN(currentNum)) {
        const consumption = calculateUtilityConsumption(
          currentNum,
          utility.previous_reading || 0
        );
        updates.consumption = consumption;
      }
    }

    updateEntry('utilities', utility.id, updates);
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
      const entriesToSave = utilities.map((entry: any) => ({
        ...entry,
        id: entry._isNew ? undefined : entry.id,
        _isNew: undefined,
      }));

      console.log('[UtilitiesSection] Saving entries:', entriesToSave);
      
      const response = await saveUtilitiesEntries(
        prefillData.inventoryMonth.id,
        entriesToSave
      );

      if (response.success) {
        setSaveMessage({ type: 'success', text: '✓ Utilidades guardadas exitosamente' });
        // Reload data to get fresh IDs from database
        if (currentPlant) {
          const yearMonth = getCurrentYearMonth();
          await loadPlantData(currentPlant.id, yearMonth);
        }
      } else {
        setSaveMessage({ type: 'error', text: `Error: ${response.error}` });
      }
    } catch (error) {
      console.error('[UtilitiesSection] Save error:', error);
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

  const isUtilityComplete = (utility: any) => {
    // Must have a current reading and it cannot go backwards
    if (utility.current_reading === null || utility.current_reading === undefined || utility.current_reading === '') {
      return false;
    }
    if (Number(utility.current_reading) < Number(utility.previous_reading || 0)) {
      return false;
    }
    // Must have photo if required
    if (utility.requires_photo && !utility.photo_url) {
      return false;
    }
    return true;
  };

  const allComplete = utilities.every(isUtilityComplete);
  const someStarted = utilities.some(u =>
    (
      u.current_reading !== null &&
      u.current_reading !== undefined &&
      u.current_reading !== ''
    ) || u.photo_url
  );

  // ============================================================================
  // GROUP UTILITIES BY TYPE
  // ============================================================================

  const groupedUtilities = utilities.reduce((acc: any, utility: any) => {
    const type = utility.utility_type || 'OTHER';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(utility);
    return acc;
  }, {});

  // ============================================================================
  // RENDER UTILITY CARD
  // ============================================================================

  const renderUtilityCard = (utility: any) => {
    const isComplete = isUtilityComplete(utility);
    const hasConsumption = utility.consumption > 0;
    
    return (
      <Card key={utility.id} className={`${isComplete ? 'border-green-300 bg-green-50/30' : ''}`}>
        <div className="p-6 space-y-6">
          {/* HEADER */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{getUtilityTypeIcon(utility.utility_type)}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-[#3B3A36]">
                      {utility.meter_name}
                    </h3>
                    {isComplete && (
                      <span className="text-green-600 text-xl">✓</span>
                    )}
                  </div>
                  <p className="text-sm text-[#5F6773]">
                    Medidor: <span className="font-mono font-semibold">{utility.meter_number}</span>
                    {' • '}
                    Proveedor: {utility.provider}
                  </p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded border ${getUtilityTypeColor(utility.utility_type)}`}>
                {getUtilityTypeLabel(utility.utility_type)}
              </span>
            </div>
          </div>

          {/* READINGS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* PREVIOUS READING - READ-ONLY */}
            <div>
              <label className="block text-sm font-semibold text-[#3B3A36] mb-1.5">
                Lectura Anterior
              </label>
              <div className="bg-[#F2F3F5] border-2 border-[#9D9B9A] rounded px-4 py-3 h-[50px] flex items-center">
                <span className="text-[#5F6773] font-bold text-xl">
                  {(utility.previous_reading || 0).toLocaleString()}
                </span>
                <span className="text-[#5F6773] ml-2 text-sm">{utility.uom}</span>
              </div>
              <p className="text-xs text-[#5F6773] mt-1">
                {prefillData.previousMonth 
                  ? 'Del mes anterior' 
                  : 'Valor inicial'}
              </p>
            </div>

            {/* CURRENT READING - HIGHLIGHTED FOCUS */}
            <div className="relative">
              <label className="block text-sm font-bold text-[#2475C7] mb-1.5 flex items-center gap-2">
                <span>Lectura Actual</span>
                <span className="text-lg">👈</span>
              </label>
              <div className="relative">
                <NumericInput
                  value={utility.current_reading || ''}
                  onValueChange={(val) => handleFieldChange(utility, 'current_reading', val || 0)}
                  placeholder="Ingresa lectura..."
                  required
                  className="border-4 border-[#2475C7] bg-white text-xl font-bold h-[50px] focus:ring-4 focus:ring-[#2475C7]/30 focus:border-[#2475C7]"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <span className="text-sm text-[#5F6773] font-semibold">{utility.uom}</span>
                </div>
              </div>
              <p className="text-xs font-semibold text-[#2475C7] mt-1">
                ⚠️ Este es el único campo que debes llenar
              </p>
            </div>

            {/* CONSUMPTION - CALCULATED */}
            <div>
              <label className="block text-sm font-semibold text-[#3B3A36] mb-1.5">
                Consumo Calculado
              </label>
              <div className={`border-2 rounded px-4 py-3 h-[50px] flex items-center ${
                hasConsumption 
                  ? 'bg-green-50 border-green-300' 
                  : 'bg-gray-50 border-gray-300'
              }`}>
                <span className={`font-bold text-xl ${
                  hasConsumption ? 'text-green-700' : 'text-gray-500'
                }`}>
                  {(utility.consumption || 0).toLocaleString()}
                </span>
                <span className="text-[#5F6773] ml-2 text-sm">{utility.uom}</span>
              </div>
              <p className="text-xs text-[#5F6773] mt-1">
                = Actual - Anterior
              </p>
            </div>
          </div>

          {/* CONSUMPTION VISUAL BAR */}
          {hasConsumption && (
            <div className="bg-gradient-to-r from-[#2475C7]/10 to-green-100 border border-[#2475C7]/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">📊</div>
                  <div>
                    <p className="text-sm font-semibold text-[#5F6773]">Consumo del Mes</p>
                    <p className="text-3xl font-bold text-[#2475C7]">
                      {utility.consumption.toLocaleString()} {utility.uom}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#5F6773]">Rango</p>
                  <p className="text-sm font-mono text-[#3B3A36]">
                    {utility.previous_reading.toLocaleString()} → {utility.current_reading.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PHOTO */}
          {utility.requires_photo && (
            <PhotoCapture
              label="Foto del Medidor"
              required
              currentPhoto={utility.photo_url}
              onPhotoCapture={(photo) => handleFieldChange(utility, 'photo_url', photo)}
            />
          )}

          {/* NOTES */}
          <div>
            <label className="block text-sm font-semibold text-[#3B3A36] mb-1.5">
              Notas (Opcional)
            </label>
            <textarea
              value={utility.notes || ''}
              onChange={(e) => handleFieldChange(utility, 'notes', e.target.value)}
              placeholder="Observaciones adicionales..."
              className="w-full px-4 py-2.5 bg-white border border-[#9D9B9A] rounded focus:outline-none focus:ring-2 focus:ring-[#2475C7] focus:border-transparent resize-none"
              rows={2}
            />
          </div>
        </div>
      </Card>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#3B3A36]">Utilidades</h2>
          <p className="text-[#5F6773]">Agua y Electricidad - Lecturas de Medidores</p>
        </div>
        <div className="text-sm text-[#5F6773]">
          <span className="font-semibold">{currentPlant?.name}</span>
          {' • '}
          <span>{formatYearMonthLabel(prefillData.inventoryMonth?.year_month)}</span>
        </div>
      </div>

      {/* INSTRUCTIONS */}
      <Card className="bg-blue-50 border-2 border-blue-300">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="text-3xl">💡</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-blue-900 mb-2">
                Instrucciones Simples
              </h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="font-bold">1.</span>
                  <span><strong>Lectura Anterior:</strong> Ya está precargada del mes pasado. No necesitas editarla.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <span><strong>Lectura Actual:</strong> <span className="bg-yellow-200 px-1 rounded">Ingresa el valor actual del medidor</span> (campo destacado en amarillo)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">3.</span>
                  <span><strong>Consumo:</strong> Se calcula automáticamente (Actual - Anterior)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">4.</span>
                  <span><strong>Foto:</strong> Captura el medidor para evidencia</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Card>

      {/* SUMMARY */}
      <Card className="bg-[#F2F3F5] border-[#2475C7]/30">
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-semibold text-[#5F6773]">Total Medidores</p>
              <p className="text-2xl font-bold text-[#2475C7]">{utilities.length}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#5F6773]">Completados</p>
              <p className="text-2xl font-bold text-green-600">
                {utilities.filter(isUtilityComplete).length}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#5F6773]">Pendientes</p>
              <p className="text-2xl font-bold text-orange-600">
                {utilities.filter(u => !isUtilityComplete(u)).length}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* UTILITIES BY TYPE */}
      {Object.entries(groupedUtilities).map(([type, typeUtilities]: [string, any]) => (
        <div key={type} className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getUtilityTypeIcon(type as any)}</span>
            <h3 className="text-lg font-bold text-[#3B3A36]">
              {getUtilityTypeLabel(type as any)}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded border ${getUtilityTypeColor(type as any)}`}>
              {typeUtilities.length} {typeUtilities.length === 1 ? 'medidor' : 'medidores'}
            </span>
          </div>
          <div className="space-y-4">
            {typeUtilities.map(renderUtilityCard)}
          </div>
        </div>
      ))}

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
          {!allComplete && someStarted && (
            <span className="text-orange-600">
              ⚠️ Algunos medidores están incompletos - Completa todos los campos requeridos
            </span>
          )}
          {!allComplete && !someStarted && (
            <span className="text-[#E53E3E]">
              ⚠️ Ingresa la lectura actual de cada medidor
            </span>
          )}
          {allComplete && (
            <span className="text-green-600">
              ✓ Todos los medidores están completos
            </span>
          )}
        </div>
        <Button 
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="min-w-[200px]"
        >
          {saving ? 'Guardando...' : 'Guardar Utilidades'}
        </Button>
      </div>
    </div>
  );
}
