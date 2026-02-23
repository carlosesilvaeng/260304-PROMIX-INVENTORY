import React, { useEffect } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { NumericInput } from '../../components/Input';
import { Select } from '../../components/Select';
import { PhotoCapture } from '../../components/PhotoCapture';
import { useAuth } from '../../contexts/AuthContext';
import { usePlantPrefill } from '../../contexts/PlantPrefillContext';
import { saveSilosEntries } from '../../utils/api';

export function SilosSection() {
  const { currentPlant } = useAuth();
  const { prefillData, loadPlantData, updateEntry } = usePlantPrefill();
  
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Load data when component mounts
  useEffect(() => {
    if (currentPlant) {
      console.log('[SilosSection] Loading data for plant:', currentPlant.id, currentPlant.name);
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      console.log('[SilosSection] Year-Month:', yearMonth);
      loadPlantData(currentPlant.id, yearMonth);
    } else {
      console.warn('[SilosSection] No currentPlant available');
    }
  }, [currentPlant, loadPlantData]);

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
                    <li>Verifica que la base de datos esté configurada (Settings → Database Setup)</li>
                    <li>Asegúrate de haber ejecutado "Cargar Configuraciones"</li>
                    <li>Revisa los logs de la consola para más detalles</li>
                  </ul>
                </div>
                <Button
                  onClick={() => {
                    if (currentPlant) {
                      const now = new Date();
                      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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

    // If product selection changes, update product_name
    if (field === 'product_name') {
      updates.product_name = value;
    }

    // Auto-calculate result based on reading_value
    // For now, we'll use a simple 1:1 conversion (reading = result)
    // TODO: In the future, use calibration curves if configured
    if (field === 'reading_value') {
      updates.calculated_result_cy = value; // Simple pass-through for now
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
      const entriesToSave = prefillData.silosEntries.map(entry => ({
        inventory_month_id: entry.inventory_month_id,
        silo_config_id: entry.silo_config_id,
        product_name: entry.product_name,
        reading_value: entry.reading_value || 0,
        calculated_result_cy: entry.calculated_result_cy || 0,
        photo_url: entry.photo_url,
        notes: entry.notes || '',
      }));

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
    // Must have product selected, reading value, and photo
    return !!(entry.product_name && entry.reading_value > 0 && entry.photo_url);
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
            {currentPlant?.name} - {prefillData.inventoryMonth?.year_month}
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
            <li><strong>Producto Medido:</strong> Selecciona el producto que se está midiendo en este silo</li>
            <li><strong>Lectura:</strong> Ingresa el valor de la lectura del medidor</li>
            <li><strong>Resultado:</strong> Se calcula automáticamente basado en la lectura</li>
            <li><strong>Evidencia fotográfica:</strong> Requerida para cada silo</li>
          </ul>
        </Card>

        {/* Silos List */}
        <div className="space-y-4">
          {prefillData.silosEntries.map((entry, index) => (
            <Card key={entry.id} className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[#1A1D1F]">
                    {entry.silo_name}
                  </h3>
                  <div className="flex gap-3 text-sm text-[#6F767E] mt-1">
                    <span>📏 {entry.measurement_method || 'FEET_TO_CUBIC_YARDS'}</span>
                    <span className="font-medium text-[#2B7DE9]">
                      Unidad: Cubic Yards (yd³) 🔒
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-sm font-medium text-[#6F767E] bg-gray-100 px-3 py-1 rounded">
                    Silo #{index + 1}
                  </span>
                  {isEntryComplete(entry) && (
                    <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                      ✓ Completo
                    </span>
                  )}
                  {!entry.photo_url && (
                    <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded">
                      ⚠️ Falta Foto
                    </span>
                  )}
                </div>
              </div>

              {/* Product Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#1A1D1F] mb-2">
                  Producto Medido *
                </label>
                <Select
                  value={entry.product_name || ''}
                  onChange={(e) => handleFieldChange(entry.id, 'product_name', e.target.value)}
                  options={[
                    { value: '', label: '-- Selecciona un producto --' },
                    ...(entry.allowed_products || []).map((product: string) => ({
                      value: product,
                      label: product
                    }))
                  ]}
                  required
                />
                {entry.allowed_products && entry.allowed_products.length > 0 && (
                  <p className="text-xs text-[#6F767E] mt-1">
                    Productos permitidos: {entry.allowed_products.join(', ')}
                  </p>
                )}
              </div>

              {/* Reading and Result */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Reading - EDITABLE */}
                <div>
                  <label className="block text-sm font-medium text-[#1A1D1F] mb-2">
                    Lectura (yd³) *
                  </label>
                  <NumericInput
                    value={entry.reading_value || 0}
                    onValueChange={(value) => handleFieldChange(entry.id, 'reading_value', value || 0)}
                    placeholder="0.00"
                    className="w-full"
                  />
                  <p className="text-xs text-[#6F767E] mt-1">Ingresa la lectura del medidor</p>
                </div>

                {/* Result - AUTO CALCULATED */}
                <div>
                  <label className="block text-sm font-medium text-[#6F767E] mb-2">
                    Resultado (yd³) 📊
                  </label>
                  <div className="bg-green-50 border border-green-300 rounded px-3 py-2.5">
                    <span className="text-[#1A1D1F] font-semibold text-lg">
                      {(entry.calculated_result_cy || 0).toFixed(2)} yd³
                    </span>
                  </div>
                  <p className="text-xs text-[#6F767E] mt-1">Cálculo automático</p>
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
                  className="w-full px-3 py-2 border border-[#9D9B9A] rounded focus:outline-none focus:ring-2 focus:ring-[#2B7DE9]"
                />
              </div>

              {/* Photo Capture */}
              <div>
                <label className="block text-sm font-medium text-[#1A1D1F] mb-2">
                  Evidencia Fotográfica del Medidor *
                </label>
                <PhotoCapture
                  label=""
                  onPhotoCapture={(photo) => handleFieldChange(entry.id, 'photo_url', photo)}
                  currentPhoto={entry.photo_url}
                />
                {!entry.photo_url && (
                  <p className="text-xs text-red-600 mt-2">
                    ⚠️ La foto del medidor es obligatoria
                  </p>
                )}
              </div>
            </Card>
          ))}
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
              onClick={() => window.history.back()}
            >
              Cancelar
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