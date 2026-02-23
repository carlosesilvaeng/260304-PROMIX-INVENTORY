import React, { useEffect } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { NumericInput } from '../../components/Input';
import { PhotoCapture } from '../../components/PhotoCapture';
import { useAuth } from '../../contexts/AuthContext';
import { usePlantPrefill } from '../../contexts/PlantPrefillContext';
import {
  ProductMeasureMode,
  convertProductReadingToQuantity,
  getProductInputLabel,
  getProductCalculatedLabel,
} from '../../config/productsConfig';
import { saveProductsEntries } from '../../utils/api';

// Category badge colors
const CATEGORY_COLORS: Record<string, string> = {
  OIL: 'bg-amber-100 text-amber-800 border-amber-300',
  LUBRICANT: 'bg-purple-100 text-purple-800 border-purple-300',
  CONSUMABLE: 'bg-blue-100 text-blue-800 border-blue-300',
  EQUIPMENT: 'bg-gray-100 text-gray-800 border-gray-300',
  OTHER: 'bg-green-100 text-green-800 border-green-300',
};

const CATEGORY_LABELS: Record<string, string> = {
  OIL: 'Aceite',
  LUBRICANT: 'Lubricante',
  CONSUMABLE: 'Consumible',
  EQUIPMENT: 'Equipo',
  OTHER: 'Otro',
};

export function ProductsSection() {
  const { currentPlant } = useAuth();
  const { prefillData, loadPlantData, updateEntry } = usePlantPrefill();
  
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Load data when component mounts
  useEffect(() => {
    if (currentPlant) {
      console.log('[ProductsSection] Loading data for plant:', currentPlant.id, currentPlant.name);
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      console.log('[ProductsSection] Year-Month:', yearMonth);
      loadPlantData(currentPlant.id, yearMonth);
    } else {
      console.warn('[ProductsSection] No currentPlant available');
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
              <p className="text-[#5F6773]">Cargando datos de productos...</p>
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

  const productos = prefillData.productosEntries || [];

  if (productos.length === 0) {
    return (
      <div className="p-6">
        <Card className="text-center py-12">
          <p className="text-[#5F6773] mb-2">No hay productos configurados para esta planta</p>
          <p className="text-sm text-[#5F6773]">
            Contacta al administrador para configurar los productos
          </p>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // FIELD CHANGE HANDLER
  // ============================================================================

  const handleFieldChange = (producto: any, field: string, value: any) => {
    const updates: any = { [field]: value };

    // Calculate quantities based on measure_mode
    if (producto.measure_mode === 'TANK_READING' && field === 'reading_value') {
      // TANK_READING: calculate quantity from reading using calibration table
      const readingNum = typeof value === 'string' ? parseFloat(value) : value;
      if (!isNaN(readingNum) && producto.calibration_table) {
        const calculated = convertProductReadingToQuantity(readingNum, producto.calibration_table);
        updates.calculated_quantity = calculated;
        updates.quantity = calculated;
      }
    } else if ((producto.measure_mode === 'DRUM' || producto.measure_mode === 'PAIL') && field === 'unit_count') {
      // DRUM/PAIL: calculate total volume = unit_count * unit_volume
      const countNum = typeof value === 'string' ? parseFloat(value) : value;
      if (!isNaN(countNum) && producto.unit_volume) {
        const total = countNum * producto.unit_volume;
        updates.total_volume = total;
        updates.quantity = countNum; // Quantity = number of units
      }
    } else if (producto.measure_mode === 'COUNT' && field === 'quantity') {
      // COUNT: direct quantity
      const quantityNum = typeof value === 'string' ? parseFloat(value) : value;
      updates.quantity = isNaN(quantityNum) ? 0 : quantityNum;
    }

    updateEntry('productos', producto.id, updates);
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
      console.log('[ProductsSection] Saving entries:', productos);
      
      const response = await saveProductsEntries(
        prefillData.inventoryMonth.id,
        productos
      );

      if (response.success) {
        setSaveMessage({ type: 'success', text: '✓ Productos guardados exitosamente' });
        // Reload data to get fresh IDs from database
        if (currentPlant) {
          const now = new Date();
          const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          await loadPlantData(currentPlant.id, yearMonth);
        }
      } else {
        setSaveMessage({ type: 'error', text: `Error: ${response.error}` });
      }
    } catch (error) {
      console.error('[ProductsSection] Save error:', error);
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

  const isProductValid = (producto: any) => {
    // Must have quantity > 0 or explicitly = 0
    if (producto.quantity === null || producto.quantity === undefined) {
      return false;
    }
    // If requires photo, must have photo
    if (producto.requires_photo && !producto.photo_url) {
      return false;
    }
    return true;
  };

  const isProductComplete = (producto: any) => {
    return producto.quantity >= 0 && (!producto.requires_photo || producto.photo_url);
  };

  const allComplete = productos.every(isProductComplete);
  const someStarted = productos.some(p => p.quantity > 0 || p.photo_url);

  // ============================================================================
  // GROUP PRODUCTS BY CATEGORY
  // ============================================================================

  const groupedProducts = productos.reduce((acc: any, product: any) => {
    const category = product.category || 'OTHER';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {});

  // ============================================================================
  // RENDER PRODUCT CARD
  // ============================================================================

  const renderProductCard = (producto: any) => {
    const isComplete = isProductComplete(producto);
    
    return (
      <Card key={producto.id} className={`${isComplete ? 'border-green-300 bg-green-50/30' : ''}`}>
        <div className="p-6 space-y-4">
          {/* HEADER */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-[#3B3A36]">
                  {producto.product_name}
                </h3>
                {isComplete && (
                  <span className="text-green-600 text-lg">✓</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded border ${CATEGORY_COLORS[producto.category] || CATEGORY_COLORS.OTHER}`}>
                  {CATEGORY_LABELS[producto.category] || 'Otro'}
                </span>
                <span className="text-sm text-[#5F6773]">
                  {producto.measure_mode === 'TANK_READING' && '📊 Tanque con Lectura'}
                  {producto.measure_mode === 'DRUM' && '🛢️ Tambores (55 gal)'}
                  {producto.measure_mode === 'PAIL' && '🪣 Pailas (5 gal)'}
                  {producto.measure_mode === 'COUNT' && '🔢 Conteo Directo'}
                </span>
              </div>
            </div>
          </div>

          {/* INPUTS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* INPUT FIELD based on measure_mode */}
            {producto.measure_mode === 'TANK_READING' && (
              <>
                <NumericInput
                  label={getProductInputLabel(producto.measure_mode, producto.reading_uom, producto.uom)}
                  value={producto.reading_value || ''}
                  onValueChange={(val) => handleFieldChange(producto, 'reading_value', val || 0)}
                  placeholder="0.00"
                  required
                  helpText="Lectura del medidor del tanque"
                />
                <div>
                  <label className="block text-sm font-semibold text-[#3B3A36] mb-1.5">
                    {getProductCalculatedLabel(producto.measure_mode, producto.uom)}
                  </label>
                  <div className="bg-[#F2F3F5] border border-[#9D9B9A] rounded px-4 py-2.5 h-[42px] flex items-center">
                    <span className="text-[#2475C7] font-bold text-lg">
                      {(producto.calculated_quantity || 0).toLocaleString()}
                    </span>
                    <span className="text-[#5F6773] ml-2 text-sm">{producto.uom}</span>
                  </div>
                  <p className="text-xs text-[#5F6773] mt-1">
                    Calculado automáticamente según tabla de calibración
                  </p>
                </div>
              </>
            )}

            {(producto.measure_mode === 'DRUM' || producto.measure_mode === 'PAIL') && (
              <>
                <NumericInput
                  label={getProductInputLabel(producto.measure_mode, producto.reading_uom, producto.uom)}
                  value={producto.unit_count || ''}
                  onValueChange={(val) => handleFieldChange(producto, 'unit_count', val || 0)}
                  placeholder="0"
                  required
                  helpText={`Número de ${producto.measure_mode === 'DRUM' ? 'tambores' : 'pailas'}`}
                />
                <div>
                  <label className="block text-sm font-semibold text-[#3B3A36] mb-1.5">
                    Volumen Total (galones)
                  </label>
                  <div className="bg-[#F2F3F5] border border-[#9D9B9A] rounded px-4 py-2.5 h-[42px] flex items-center">
                    <span className="text-[#2475C7] font-bold text-lg">
                      {(producto.total_volume || 0).toLocaleString()}
                    </span>
                    <span className="text-[#5F6773] ml-2 text-sm">galones</span>
                  </div>
                  <p className="text-xs text-[#5F6773] mt-1">
                    = {producto.unit_count || 0} × {producto.unit_volume || 0} gal/unidad
                  </p>
                </div>
              </>
            )}

            {producto.measure_mode === 'COUNT' && (
              <NumericInput
                label={getProductInputLabel(producto.measure_mode, producto.reading_uom, producto.uom)}
                value={producto.quantity || ''}
                onValueChange={(val) => handleFieldChange(producto, 'quantity', val || 0)}
                placeholder="0"
                required
                helpText={`Si no hay inventario, ingresa 0`}
              />
            )}
          </div>

          {/* PHOTO (conditional) */}
          {producto.requires_photo && (
            <PhotoCapture
              label="Foto de Evidencia"
              required
              currentPhoto={producto.photo_url}
              onPhotoCapture={(photo) => handleFieldChange(producto, 'photo_url', photo)}
            />
          )}

          {/* NOTES */}
          <div>
            <label className="block text-sm font-semibold text-[#3B3A36] mb-1.5">
              Notas (Opcional)
            </label>
            <textarea
              value={producto.notes || ''}
              onChange={(e) => handleFieldChange(producto, 'notes', e.target.value)}
              placeholder="Observaciones adicionales..."
              className="w-full px-4 py-2.5 border border-[#9D9B9A] rounded focus:outline-none focus:ring-2 focus:ring-[#2475C7] focus:border-transparent resize-none"
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
          <h2 className="text-2xl font-bold text-[#3B3A36]">Aceites y Productos</h2>
          <p className="text-[#5F6773]">Aceites, Lubricantes, Consumibles y Equipos</p>
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

      {/* SUMMARY */}
      <Card className="bg-[#F2F3F5] border-[#2475C7]/30">
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-semibold text-[#5F6773]">Total Productos</p>
              <p className="text-2xl font-bold text-[#2475C7]">{productos.length}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#5F6773]">Completados</p>
              <p className="text-2xl font-bold text-green-600">
                {productos.filter(isProductComplete).length}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#5F6773]">Pendientes</p>
              <p className="text-2xl font-bold text-orange-600">
                {productos.filter(p => !isProductComplete(p)).length}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* PRODUCTS BY CATEGORY */}
      {Object.entries(groupedProducts).map(([category, categoryProducts]: [string, any]) => (
        <div key={category} className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-[#3B3A36]">
              {CATEGORY_LABELS[category] || 'Otros'}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded border ${CATEGORY_COLORS[category] || CATEGORY_COLORS.OTHER}`}>
              {categoryProducts.length} {categoryProducts.length === 1 ? 'producto' : 'productos'}
            </span>
          </div>
          <div className="space-y-4">
            {categoryProducts.map(renderProductCard)}
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
              ⚠️ Algunos productos están incompletos - Completa todos los campos requeridos
            </span>
          )}
          {!allComplete && !someStarted && (
            <span className="text-[#E53E3E]">
              ⚠️ Completa todos los productos requeridos (puedes ingresar 0 si no hay inventario)
            </span>
          )}
          {allComplete && (
            <span className="text-green-600">
              ✓ Todos los productos están completos
            </span>
          )}
        </div>
        <Button 
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="min-w-[200px]"
        >
          {saving ? 'Guardando...' : 'Guardar Productos'}
        </Button>
      </div>
    </div>
  );
}