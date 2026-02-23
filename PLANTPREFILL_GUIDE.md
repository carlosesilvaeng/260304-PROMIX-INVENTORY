# PlantPrefill System - Guía de Uso

## 📋 Resumen

El **PlantPrefillProvider** es el sistema central de precarga de datos para el inventario mensual. Automatiza la carga de configuraciones y datos del mes anterior, creando una experiencia "lista para usar" donde el gerente de planta solo debe llenar campos específicos.

---

## 🎯 Características Principales

### 1. **Carga Automática de Configuración**
- Al entrar a una sección, se carga automáticamente la configuración de la planta
- Silos, agregados, aditivos, diesel, productos, utilities, etc.
- **Campos bloqueados (read-only)**: Vienen de la configuración y no se pueden editar

### 2. **Creación Automática de Entries Vacías**
- Si no existen entries para el mes actual, se crean automáticamente
- Cada entry tiene todos los campos necesarios precargados
- El gerente solo debe llenar los campos editables

### 3. **Carry-Over del Mes Anterior**
- **Silos**: `previous_reading` = mes anterior `current_reading`
- **Agregados**: `previous_reading` = mes anterior `current_reading`
- **Aditivos**: `beginning` = mes anterior `ending`
- **Diesel**: `beginning` = mes anterior `ending`
- **Productos**: `beginning` = mes anterior `ending`
- **Utilities**: `previous_reading` = mes anterior `current_reading`
- **Petty Cash**: `beginning_balance` = mes anterior `ending_balance`

### 4. **Cálculos Automáticos**
- **Agregados**: `usage = previous + purchases - current`
- **Aditivos**: `ending = beginning + purchases - usage`
- **Diesel**: `ending = beginning + purchases - usage`
- **Productos**: `ending = beginning + production - sales`
- **Utilities**: `consumption = current - previous`

---

## 🚀 Cómo Usar

### En un Componente de Sección

```tsx
import { usePlantPrefill } from '../../contexts/PlantPrefillContext';

export function MySection() {
  const { prefillData, loadPlantData, updateEntry } = usePlantPrefill();
  
  // 1. Cargar datos al montar
  useEffect(() => {
    if (currentPlant) {
      const yearMonth = '2025-02'; // Obtener del estado global
      loadPlantData(currentPlant.id, yearMonth);
    }
  }, [currentPlant, loadPlantData]);
  
  // 2. Mostrar loading
  if (prefillData.loading) {
    return <LoadingSpinner />;
  }
  
  // 3. Mostrar error
  if (prefillData.error) {
    return <ErrorMessage message={prefillData.error} />;
  }
  
  // 4. Usar los datos
  return (
    <div>
      {prefillData.agregadosEntries.map(entry => (
        <AggregateRow
          key={entry.id}
          entry={entry}
          onChange={(field, value) => {
            updateEntry('agregados', entry.id, { [field]: value });
          }}
        />
      ))}
    </div>
  );
}
```

---

## 📊 Estructura de Datos

### `prefillData`

```typescript
{
  // Metadata del mes
  inventoryMonth: InventoryMonth | null;  // Mes actual
  previousMonth: InventoryMonth | null;   // Mes anterior (para carry-over)
  
  // Configuración (read-only)
  config: PlantConfigPackage | null;
  
  // Entries editables del mes actual
  silosEntries: SiloEntry[];
  agregadosEntries: AgregadoEntry[];
  aditivosEntries: AditivoEntry[];
  dieselEntry: DieselEntry | null;
  productosEntries: ProductoEntry[];
  utilitiesEntries: UtilityEntry[];
  metersEntries: MeterEntry[];
  pettyCashEntry: PettyCashEntry | null;
  
  // Estados de carga
  loading: boolean;
  error: string | null;
}
```

---

## 🔐 Campos Bloqueados vs Editables

### ❌ BLOQUEADOS (Read-Only) - Vienen de configuración:
- Material name / Silo name
- Unit (unidad de medida)
- Capacity (capacidad)
- Calibration curve IDs
- Meter type
- Initial balances

### ✅ EDITABLES - El gerente debe llenar:
- Current reading
- Purchases
- Usage
- Sales / Production
- Notes / Observations
- Photos (evidencia fotográfica)

### 🟢 AUTO-CALCULADOS:
- Previous reading (del mes anterior)
- Beginning balance (del mes anterior)
- Consumption
- Ending balance
- Usage (basado en fórmula)

---

## 🎨 UI/UX Guidelines

### 1. **Campos Read-Only**
```tsx
<div className="bg-gray-100 border border-gray-300 rounded px-3 py-2">
  <span className="text-gray-700">{value} 🔒</span>
</div>
```

### 2. **Campos Editables**
```tsx
<NumericInput
  value={entry.current_reading}
  onChange={(value) => handleFieldChange(entry.id, 'current_reading', value)}
  className="border-blue-500"
/>
```

### 3. **Campos Auto-Calculados**
```tsx
<div className="bg-green-50 border border-green-300 rounded px-3 py-2">
  <span className="text-green-800 font-semibold">{calculatedValue}</span>
</div>
```

### 4. **Indicadores de Carry-Over**
```tsx
{prefillData.previousMonth && (
  <p className="text-sm text-gray-500">
    📅 Datos del mes anterior precargados automáticamente
  </p>
)}
```

---

## 💾 Guardar Datos

```tsx
const handleSave = async () => {
  if (!prefillData.inventoryMonth) return;
  
  const response = await saveAggregatesEntries(
    prefillData.inventoryMonth.id,
    prefillData.agregadosEntries
  );
  
  if (response.success) {
    // Mostrar mensaje de éxito
  }
};
```

---

## 🔄 Flujo Completo

```
1. Usuario selecciona planta y mes
   ↓
2. PlantPrefillProvider carga:
   - Configuración de la planta
   - Mes actual (o lo crea si no existe)
   - Mes anterior (para carry-over)
   ↓
3. Si el mes es nuevo:
   - Crea entries vacías basadas en config
   - Aplica carry-over del mes anterior
   ↓
4. Usuario llena campos editables
   - updateEntry() actualiza estado local
   - Cálculos automáticos se ejecutan
   ↓
5. Usuario guarda
   - saveXxxEntries() guarda en Supabase
   - Muestra confirmación
```

---

## 🛠️ Ejemplo Completo: Sección de Agregados

Ver `/src/app/pages/sections/AggregatesSection_NEW.tsx` para un ejemplo completo implementado.

**Características del ejemplo:**
- ✅ Carga automática de configuración
- ✅ Campos bloqueados visualmente diferenciados
- ✅ Cálculo automático de consumo
- ✅ Carry-over del mes anterior
- ✅ Validación de campos requeridos
- ✅ Captura de evidencia fotográfica
- ✅ Guardar en Supabase

---

## 📝 Notas Importantes

1. **Siempre verificar `prefillData.loading`** antes de mostrar datos
2. **Usar `updateEntry()` para cambios locales**, no mutaciones directas
3. **Los campos con 🔒 NO se deben mostrar como editables**
4. **Validar que `inventoryMonth` existe antes de guardar**
5. **Mostrar mensajes claros cuando no hay configuración**

---

## 🚨 Casos de Error

### Sin Configuración
```tsx
if (prefillData.config === null || prefillData.agregadosEntries.length === 0) {
  return (
    <EmptyState
      title="Sin Agregados Configurados"
      message="Contacta al administrador para configurar los agregados de esta planta."
    />
  );
}
```

### Mes Anterior No Existe
```tsx
if (!prefillData.previousMonth) {
  // No hay carry-over, todos los "previous" serán 0
  // Esto es normal para el primer mes
}
```

### Error de Carga
```tsx
if (prefillData.error) {
  return <ErrorMessage message={prefillData.error} />;
}
```

---

## 🎯 Beneficios para el Usuario Final

1. **No necesita recordar qué items tiene su planta** - Ya están listados
2. **No necesita copiar datos del mes anterior** - Ya están precargados
3. **Cálculos automáticos** - Menos errores manuales
4. **UI clara** - Sabe exactamente qué llenar y qué no tocar
5. **Experiencia consistente** - Todas las secciones funcionan igual

---

## 🔗 Archivos Relacionados

- **Contexto**: `/src/app/contexts/PlantPrefillContext.tsx`
- **API**: `/src/app/utils/api.ts`
- **Backend**: `/supabase/functions/server/index.tsx`
- **Backend DB**: `/supabase/functions/server/database.tsx`
- **Ejemplo**: `/src/app/pages/sections/AggregatesSection_NEW.tsx`

---

✅ **Sistema listo para producción** - Todas las secciones deben migrar a este patrón.
