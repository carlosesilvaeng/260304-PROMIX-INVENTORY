import React, { useEffect } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { NumericInput } from '../../components/Input';
import { PhotoCapture } from '../../components/PhotoCapture';
import { useAuth } from '../../contexts/AuthContext';
import { usePlantPrefill } from '../../contexts/PlantPrefillContext';
import {
  calculatePettyCashTotal,
  calculatePettyCashDifference,
  getPettyCashStatus,
  formatCurrency,
} from '../../config/pettyCashConfig';
import { compressPettyCashPhoto } from '../../utils/imageCompression';
import { savePettyCashEntry } from '../../utils/api';

export function PettyCashSection() {
  const { currentPlant } = useAuth();
  const { prefillData, loadPlantData, updateEntry, getCurrentYearMonth } = usePlantPrefill();
  
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Load data when component mounts
  useEffect(() => {
    if (currentPlant) {
      console.log('[PettyCashSection] Loading data for plant:', currentPlant.id, currentPlant.name);
      const yearMonth = getCurrentYearMonth();
      console.log('[PettyCashSection] Year-Month:', yearMonth);
      loadPlantData(currentPlant.id, yearMonth);
    } else {
      console.warn('[PettyCashSection] No currentPlant available');
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
              <p className="text-[#5F6773]">Cargando datos de petty cash...</p>
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

  const pettyCash = prefillData.pettyCashEntry;

  if (!pettyCash) {
    return (
      <div className="p-6">
        <Card className="text-center py-12">
          <p className="text-[#5F6773] mb-2">No hay configuración de Petty Cash para esta planta</p>
          <p className="text-sm text-[#5F6773]">
            Contacta al administrador para configurar el Petty Cash
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

    // Recalculate total and difference when receipts or cash changes
    if (field === 'receipts' || field === 'cash') {
      const receipts = field === 'receipts' ? value : pettyCash.receipts;
      const cash = field === 'cash' ? value : pettyCash.cash;
      
      const total = calculatePettyCashTotal(receipts || 0, cash || 0);
      const difference = calculatePettyCashDifference(pettyCash.established_amount, total);
      
      updates.total = total;
      updates.difference = difference;
    }

    updateEntry('pettyCash', pettyCash.id, updates);
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
      console.log('[PettyCashSection] Saving entry:', pettyCash);
      
      const response = await savePettyCashEntry(
        prefillData.inventoryMonth.id,
        pettyCash
      );

      if (response.success) {
        setSaveMessage({ type: 'success', text: '✓ Petty Cash guardado exitosamente' });
        // Reload data to get fresh ID from database
        if (currentPlant) {
          const yearMonth = getCurrentYearMonth();
          await loadPlantData(currentPlant.id, yearMonth);
        }
      } else {
        setSaveMessage({ type: 'error', text: `Error: ${response.error}` });
      }
    } catch (error) {
      console.error('[PettyCashSection] Save error:', error);
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

  const isComplete = () => {
    // Must have receipts >= 0 (can be 0)
    if (pettyCash.receipts === null || pettyCash.receipts === undefined || pettyCash.receipts < 0) {
      return false;
    }
    // Must have cash >= 0 (can be 0)
    if (pettyCash.cash === null || pettyCash.cash === undefined || pettyCash.cash < 0) {
      return false;
    }
    // Must have photo
    if (!pettyCash.photo_url) {
      return false;
    }
    return true;
  };

  const status = getPettyCashStatus(pettyCash.difference || pettyCash.established_amount);
  const complete = isComplete();

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#3B3A36]">Petty Cash</h2>
          <p className="text-[#5F6773]">Control de Efectivo y Recibos</p>
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

      {/* INSTRUCTIONS */}
      <Card className="bg-blue-50 border-2 border-blue-300">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="text-3xl">💡</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-blue-900 mb-2">
                Instrucciones
              </h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="font-bold">1.</span>
                  <span><strong>Petty Cash Establecido:</strong> Este es el monto fijo que debe mantenerse. No puedes editarlo.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <span><strong>Recibos:</strong> Suma total de todos los recibos/gastos del mes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">3.</span>
                  <span><strong>Efectivo:</strong> Efectivo físico en caja</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">4.</span>
                  <span><strong>Total:</strong> Se calcula automáticamente (Recibos + Efectivo)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">5.</span>
                  <span><strong>Diferencia:</strong> Establecido - Total. Debe ser $0.00 para cuadrar</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Card>

      {/* MAIN CARD */}
      <Card className={complete ? 'border-green-300 bg-green-50/30' : ''}>
        <div className="p-6 space-y-6">
          {/* ESTABLISHED AMOUNT - READ-ONLY */}
          <div className="bg-gradient-to-r from-[#2475C7]/10 to-[#2475C7]/5 border-2 border-[#2475C7] rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#5F6773] mb-1">
                  Petty Cash Establecido (No Editable)
                </p>
                <p className="text-4xl font-bold text-[#2475C7]">
                  {formatCurrency(pettyCash.established_amount)}
                </p>
                <p className="text-xs text-[#5F6773] mt-1">
                  Este es el monto fijo que debe mantenerse en Petty Cash
                </p>
              </div>
              <div className="text-6xl">💰</div>
            </div>
          </div>

          {/* INPUTS: RECEIPTS AND CASH */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <NumericInput
                label="Recibos ($)"
                value={pettyCash.receipts || ''}
                onValueChange={(val) => handleFieldChange('receipts', val || 0)}
                placeholder="0.00"
                required
                helpText="Suma total de recibos/gastos"
              />
            </div>

            <div>
              <NumericInput
                label="Efectivo en Caja ($)"
                value={pettyCash.cash || ''}
                onValueChange={(val) => handleFieldChange('cash', val || 0)}
                placeholder="0.00"
                required
                helpText="Efectivo físico disponible"
              />
            </div>
          </div>

          {/* CALCULATED FIELDS: TOTAL AND DIFFERENCE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* TOTAL */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
              <p className="text-sm font-semibold text-[#5F6773] mb-2">
                Total (Recibos + Efectivo)
              </p>
              <p className="text-4xl font-bold text-[#2475C7]">
                {formatCurrency(pettyCash.total || 0)}
              </p>
              <p className="text-xs text-[#5F6773] mt-2">
                = ${(pettyCash.receipts || 0).toFixed(2)} + ${(pettyCash.cash || 0).toFixed(2)}
              </p>
            </div>

            {/* DIFFERENCE */}
            <div className={`rounded-lg p-6 border-2 ${
              status.status === 'CORRECT'
                ? 'bg-green-50 border-green-300'
                : status.status === 'SHORT'
                  ? 'bg-red-50 border-red-300'
                  : 'bg-orange-50 border-orange-300'
            }`}>
              <p className="text-sm font-semibold text-[#5F6773] mb-2">
                {status.label}
              </p>
              <p className={`text-4xl font-bold ${status.color}`}>
                {formatCurrency(Math.abs(pettyCash.difference || pettyCash.established_amount))}
              </p>
              <p className="text-xs text-[#5F6773] mt-2">
                {status.status === 'CORRECT' && '✓ El Petty Cash cuadra perfecto'}
                {status.status === 'SHORT' && '⚠️ Falta dinero para alcanzar el monto establecido'}
                {status.status === 'OVER' && '⚠️ Hay más dinero del establecido'}
              </p>
            </div>
          </div>

          {/* VISUAL INDICATOR */}
          {status.status !== 'CORRECT' && (
            <Card className="bg-yellow-50 border-yellow-300">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">⚠️</div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-yellow-900 mb-1">
                      Atención: El Petty Cash no cuadra
                    </p>
                    <p className="text-sm text-yellow-800">
                      {status.status === 'SHORT' && (
                        <>Faltan <strong>{formatCurrency(pettyCash.difference)}</strong> para alcanzar el monto establecido. Verifica los recibos y efectivo.</>
                      )}
                      {status.status === 'OVER' && (
                        <>Hay un sobrante de <strong>{formatCurrency(Math.abs(pettyCash.difference))}</strong>. Verifica la suma de recibos y efectivo.</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* PHOTO WITH AUTOMATIC COMPRESSION (handled by PhotoCapture) */}
          <PhotoCapture
            label="Foto de Evidencia (Recibos y Efectivo)"
            required
            currentPhoto={pettyCash.photo_url}
            onPhotoCapture={(photo) => handleFieldChange('photo_url', photo)}
          />

          {/* NOTES */}
          <div>
            <label className="block text-sm font-semibold text-[#3B3A36] mb-1.5">
              Notas / Comentarios (Opcional)
            </label>
            <textarea
              value={pettyCash.notes || ''}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              placeholder="Explica cualquier discrepancia, gastos importantes, o situaciones especiales..."
              className="w-full px-4 py-2.5 border border-[#9D9B9A] rounded focus:outline-none focus:ring-2 focus:ring-[#2475C7] focus:border-transparent resize-none"
              rows={3}
            />
            <p className="text-xs text-[#5F6773] mt-1">
              Si el Petty Cash no cuadra, explica aquí la razón
            </p>
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
          {!complete && (
            <span className="text-orange-600">
              ⚠️ Completa todos los campos requeridos (recibos, efectivo y foto)
            </span>
          )}
          {complete && status.status === 'CORRECT' && (
            <span className="text-green-600">
              ✓ El Petty Cash está completo y cuadra perfecto
            </span>
          )}
          {complete && status.status !== 'CORRECT' && (
            <span className="text-yellow-600">
              ⚠️ El Petty Cash está completo pero no cuadra - Verifica los montos
            </span>
          )}
        </div>
        <Button 
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="min-w-[200px]"
        >
          {saving ? 'Guardando...' : 'Guardar Petty Cash'}
        </Button>
      </div>
    </div>
  );
}
