import React, { useEffect, useState } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { NumericInput } from '../../components/Input';
import { PhotoCapture } from '../../components/PhotoCapture';
import { useAuth } from '../../contexts/AuthContext';
import { usePlantPrefill } from '../../contexts/PlantPrefillContext';
import { convertReadingToVolume, hasCalibrationPoints } from '../../utils/calibration';
import { formatYearMonthLabel } from '../../utils/dateFormatting';
import { saveAdditivesEntries } from '../../utils/api';

type TabType = 'tanks' | 'manual';

export function AdditivesSection() {
  const { currentPlant } = useAuth();
  const { prefillData, loadPlantData, updateEntry, getCurrentYearMonth } = usePlantPrefill();
  
  const [activeTab, setActiveTab] = useState<TabType>('tanks');
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);

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

    // If it's a TANK and reading_value changes, recalculate volume
    if (entry.additive_type === 'TANK' && field === 'reading_value' && entry.conversion_table) {
      const readingNum = typeof value === 'string' ? parseFloat(value) : value;
      if (!isNaN(readingNum)) {
        const calculatedVolume = convertReadingToVolume(readingNum, entry.conversion_table);
        updates.calculated_volume = calculatedVolume;
      }
    }

    // For MANUAL type, ensure quantity is always a number (0 if empty, not null)
    if (entry.additive_type === 'MANUAL' && field === 'quantity') {
      const quantityNum = typeof value === 'string' ? parseFloat(value) : value;
      updates.quantity = isNaN(quantityNum) ? 0 : quantityNum;
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
        const isTank = entry.additive_type === 'TANK';
        if (isTank && !hasCalibrationPoints(entry.conversion_table)) {
          throw new Error(`${entry.product_name}: falta tabla de calibración para calcular la lectura del tanque.`);
        }

        const readingValue = Number(entry.reading_value ?? entry.reading ?? 0) || 0;
        const calculatedVolume = isTank
          ? convertReadingToVolume(readingValue, entry.conversion_table)
          : Number(entry.calculated_volume ?? 0) || 0;

        return {
          ...(entry._isNew ? {} : { id: entry.id }),
          inventory_month_id: entry.inventory_month_id,
          additive_config_id: entry.additive_config_id,
          additive_type: entry.additive_type,
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
      if (tank.reading_value === null || tank.reading_value === undefined) {
        return false;
      }
      if (tank.requires_photo && !tank.photo_url) {
        return false;
      }
    }

    // All manual items must have a quantity (can be 0, but must be set)
    for (const manual of manualEntries) {
      if (manual.quantity === null || manual.quantity === undefined) {
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
            tankEntries.map((entry: any) => (
              <Card key={entry.id} className="p-6">
                <div className="space-y-4">
                  {/* HEADER */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-[#3B3A36]">
                          {entry.tank_name || entry.product_name}
                        </h3>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#2475C7]/10 text-[#2475C7]">
                          TANQUE
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
                  </div>

                  {/* READING AND VOLUME */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NumericInput
                      label={`Lectura (${entry.reading_uom || 'inches'})`}
                      value={entry.reading_value || ''}
                      onValueChange={(val) => handleFieldChange(entry.id, 'reading_value', val || 0)}
                      placeholder="0.00"
                      required
                      helpText="Ingresa la lectura del medidor del tanque"
                    />
                    <div>
                      <label className="block text-sm font-semibold text-[#3B3A36] mb-1.5">
                        Volumen Calculado ({entry.uom})
                      </label>
                      <div className="bg-[#F2F3F5] border border-[#9D9B9A] rounded px-4 py-2.5 h-[42px] flex items-center">
                        <span className="text-[#2475C7] font-bold text-lg">
                          {entry.calculated_volume?.toFixed(2) || '0.00'}
                        </span>
                        <span className="text-[#5F6773] ml-2 text-sm">{entry.uom}</span>
                      </div>
                      <p className="text-xs text-[#5F6773] mt-1">
                        Calculado automáticamente según tabla de conversión
                      </p>
                    </div>
                  </div>

                  {/* PHOTO */}
                  {entry.requires_photo && (
                    <PhotoCapture
                      label="Foto del Medidor"
                      required
                      currentPhoto={entry.photo_url}
                      onPhotoCapture={(photo) => handleFieldChange(entry.id, 'photo_url', photo)}
                    />
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
            ))
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
                      value={entry.quantity}
                      onValueChange={(val) => handleFieldChange(entry.id, 'quantity', val !== null ? val : 0)}
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
