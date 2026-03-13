import React, { useEffect } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { NumericInput } from '../../components/Input';
import { PhotoCapture } from '../../components/PhotoCapture';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { usePlantPrefill } from '../../contexts/PlantPrefillContext';
import { useUnits } from '../../contexts/UnitsContext';
import { saveAggregatesEntries } from '../../utils/api';

interface AggregatesSectionProps {
  onBack?: () => void;
}

export function AggregatesSection({ onBack }: AggregatesSectionProps) {
  const { currentPlant } = useAuth();
  const { t } = useLanguage();
  const { units } = useUnits();
  const { prefillData, loadPlantData, updateEntry, getCurrentYearMonth } = usePlantPrefill();
  
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);
  const lengthUnitLabel = units.length === 'm' ? 'm' : 'ft';
  const volumeUnit = units.length === 'm' ? 'm3' : 'ft3';
  const volumeUnitLabel = units.length === 'm' ? 'm³' : 'ft³';

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

  const calculateBoxVolume = (width: number, height: number, length: number): number => {
    return width * height * length;
  };

  const calculateConeVolume = (m1: number, m2: number, m3: number, m4: number, m5: number, m6: number, d1: number, d2: number): number => {
    // V = (π × r² × h) / 3  —  r = (D1+D2)/4 (radio promedio), h = √(avgM² − r²) (altura por Pitágoras)
    const r = (d1 + d2) / 4;
    const avgM = (m1 + m2 + m3 + m4 + m5 + m6) / 6;
    const hSquared = Math.pow(avgM, 2) - Math.pow(r, 2);
    if (hSquared <= 0) return 0; // geometría inválida: avgM debe ser mayor que r
    return (Math.PI * Math.pow(r, 2) * Math.sqrt(hSquared)) / 3;
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
      // BOX method: calculate when length changes (usa ?? 0 para evitar fallo por width/height = 0 o null)
      if (field === 'box_length_ft') {
        const w = entry.box_width_ft ?? 0;
        const h = entry.box_height_ft ?? 0;
        updates.calculated_volume_cy = calculateBoxVolume(w, h, value ?? 0);
        updates.unit = volumeUnit;
      }
    } else if (entry.measurement_method === 'CONE') {
      // CONE method: calculate when any measurement changes
      if (field.startsWith('cone_')) {
        const m1 = field === 'cone_m1' ? value : (entry.cone_m1 || 0);
        const m2 = field === 'cone_m2' ? value : (entry.cone_m2 || 0);
        const m3 = field === 'cone_m3' ? value : (entry.cone_m3 || 0);
        const m4 = field === 'cone_m4' ? value : (entry.cone_m4 || 0);
        const m5 = field === 'cone_m5' ? value : (entry.cone_m5 || 0);
        const m6 = field === 'cone_m6' ? value : (entry.cone_m6 || 0);
        const d1 = field === 'cone_d1' ? value : (entry.cone_d1 || 0);
        const d2 = field === 'cone_d2' ? value : (entry.cone_d2 || 0);
        
        if ([m1, m2, m3, m4, m5, m6, d1, d2].every(v => v !== null && v !== undefined)) {
          updates.calculated_volume_cy = calculateConeVolume(m1, m2, m3, m4, m5, m6, d1, d2);
          updates.unit = volumeUnit;
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
        unit: volumeUnit,
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
      // length can be 0 (not used), but must be explicitly set
      return entry.box_length_ft !== null && entry.box_length_ft !== undefined;
    }

    // For CONE method
    if (entry.measurement_method === 'CONE') {
      return [
        entry.cone_m1, entry.cone_m2, entry.cone_m3,
        entry.cone_m4, entry.cone_m5, entry.cone_m6,
        entry.cone_d1, entry.cone_d2,
      ].every(v => v !== null && v !== undefined);
    }

    return false;
  };

  const completedCount = prefillData.agregadosEntries.filter(isEntryComplete).length;
  const totalCount = prefillData.agregadosEntries.length;

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
            <li><strong>Campos bloqueados 🔒:</strong> Material, procedencia, método, ancho y alto (vienen de configuración)</li>
            <li><strong>Método Cajón:</strong> Solo captura el largo en {lengthUnitLabel}</li>
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
                        {entry.box_width_ft || 0} {lengthUnitLabel}
                      </div>
                    </div>

                    {/* Height - READ ONLY */}
                    <div>
                      <label className="block text-sm font-medium text-[#6F767E] mb-2">
                        Alto ({lengthUnitLabel}) 🔒
                      </label>
                      <div className="bg-gray-100 border border-gray-300 rounded px-3 py-2 text-[#3B3A36]">
                        {entry.box_height_ft || 0} {lengthUnitLabel}
                      </div>
                    </div>

                    {/* Length - EDITABLE */}
                    <div>
                      <label className="block text-sm font-medium text-[#1A1D1F] mb-2">
                        Largo ({lengthUnitLabel}) *
                      </label>
                      <NumericInput
                        value={entry.box_length_ft ?? ''}
                        onValueChange={(value) => handleFieldChange(entry.id, 'box_length_ft', value ?? 0)}
                        placeholder="0.00"
                        className="w-full"
                      />
                      <p className="text-xs text-[#6F767E] mt-1">Si no se usó, ingresa 0</p>
                    </div>

                    {/* Volume - AUTO CALCULATED */}
                    <div>
                      <label className="block text-sm font-medium text-[#6F767E] mb-2">
                        Volumen ({volumeUnitLabel}) 📊
                      </label>
                      <div className="bg-green-50 border border-green-300 rounded px-3 py-2 text-[#1A1D1F] font-semibold">
                        {(entry.calculated_volume_cy || 0).toFixed(2)} {volumeUnitLabel}
                      </div>
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
                      <label className="block text-sm font-medium text-[#1A1D1F] mb-2">M1 ({lengthUnitLabel}) *</label>
                      <NumericInput
                        value={entry.cone_m1 ?? ''}
                        onValueChange={(value) => handleFieldChange(entry.id, 'cone_m1', value ?? 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1A1D1F] mb-2">M2 ({lengthUnitLabel}) *</label>
                      <NumericInput
                        value={entry.cone_m2 ?? ''}
                        onValueChange={(value) => handleFieldChange(entry.id, 'cone_m2', value ?? 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1A1D1F] mb-2">M3 ({lengthUnitLabel}) *</label>
                      <NumericInput
                        value={entry.cone_m3 ?? ''}
                        onValueChange={(value) => handleFieldChange(entry.id, 'cone_m3', value ?? 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1A1D1F] mb-2">M4 ({lengthUnitLabel}) *</label>
                      <NumericInput
                        value={entry.cone_m4 ?? ''}
                        onValueChange={(value) => handleFieldChange(entry.id, 'cone_m4', value ?? 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1A1D1F] mb-2">M5 ({lengthUnitLabel}) *</label>
                      <NumericInput
                        value={entry.cone_m5 ?? ''}
                        onValueChange={(value) => handleFieldChange(entry.id, 'cone_m5', value ?? 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1A1D1F] mb-2">M6 ({lengthUnitLabel}) *</label>
                      <NumericInput
                        value={entry.cone_m6 ?? ''}
                        onValueChange={(value) => handleFieldChange(entry.id, 'cone_m6', value ?? 0)}
                        placeholder="0.00"
                      />
                    </div>

                    {/* D Measurements */}
                    <div>
                      <label className="block text-sm font-medium text-[#1A1D1F] mb-2">D1 ({lengthUnitLabel}) *</label>
                      <NumericInput
                        value={entry.cone_d1 ?? ''}
                        onValueChange={(value) => handleFieldChange(entry.id, 'cone_d1', value ?? 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1A1D1F] mb-2">D2 ({lengthUnitLabel}) *</label>
                      <NumericInput
                        value={entry.cone_d2 ?? ''}
                        onValueChange={(value) => handleFieldChange(entry.id, 'cone_d2', value ?? 0)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Volume */}
                  <div>
                    <label className="block text-sm font-medium text-[#6F767E] mb-2">
                      Volumen Calculado ({volumeUnitLabel}) 📊
                    </label>
                    <div className="bg-green-50 border border-green-300 rounded px-3 py-2 text-[#1A1D1F] font-semibold text-lg">
                      {(entry.calculated_volume_cy || 0).toFixed(2)} {volumeUnitLabel}
                    </div>
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
                  className="w-full px-3 py-2 border border-[#9D9B9A] rounded focus:outline-none focus:ring-2 focus:ring-[#2B7DE9]"
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
              variant="outline"
              onClick={() => onBack?.()}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#2B7DE9] hover:bg-[#1E5DB8] text-white"
            >
              {saving ? 'Guardando...' : 'Guardar Agregados'}
            </Button>
            {completedCount === totalCount && totalCount > 0 && (
              <Button
                onClick={() => onBack?.()}
                className="bg-[#2ecc71] hover:bg-[#27ae60] text-white"
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
