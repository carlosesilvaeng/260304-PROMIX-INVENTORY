# 🎨 GUÍA DE ESTANDARIZACIÓN UX - PROMIX Plant Inventory

## Objetivo

Crear una experiencia de usuario consistente en TODAS las secciones del inventario con:
- ✅ Campos numéricos que aceptan **0 como valor válido**
- ✅ Vacío (null/"") marcado como **incompleto**
- ✅ Campos requeridos con **borde rojo** cuando incompletos
- ✅ Campos de configuración **read-only** y visualmente distintos
- ✅ UX uniforme en todas las secciones

---

## 📦 Componentes Creados

### 1. **StandardInput** (`/src/app/components/StandardInput.tsx`)

Input estandarizado para campos editables con validación visual.

**Características**:
- ✅ Acepta `0` como valor válido
- ✅ `null`, `undefined`, `""` = **incompleto**
- ✅ Borde rojo cuando incompleto
- ✅ Asterisco `*` en label si es requerido
- ✅ Unidades mostradas inline
- ✅ Mensaje de error claro
- ✅ Disabled state visualmente distinto

**Uso**:
```tsx
import { StandardInput } from '../../components/StandardInput';

<StandardInput
  label="Box Count"
  value={entry.box_count}
  onChange={(value) => handleFieldChange(entry.id, 'box_count', value)}
  type="number"
  unit="boxes"
  required={true}
  min={0}
  step={1}
  helperText="Enter number of boxes (0 is valid)"
/>
```

**Props**:
- `label`: Texto del label
- `value`: Valor actual (number | string | null | undefined)
- `onChange`: Callback con nuevo valor
- `type`: 'number' | 'text' (default: 'number')
- `unit`: Unidad mostrada (ej: "cy", "gal", "ft")
- `required`: Si es requerido (default: true)
- `disabled`: Si está deshabilitado
- `placeholder`: Placeholder personalizado
- `min`, `max`, `step`: Para inputs numéricos
- `helperText`: Texto de ayuda

### 2. **ReadOnlyField** (`/src/app/components/StandardInput.tsx`)

Campo read-only para mostrar configuración.

**Características**:
- ✅ Fondo gris distintivo
- ✅ Fuente en bold
- ✅ Label en mayúsculas
- ✅ No editable
- ✅ Soporte para íconos
- ✅ Unidades opcionales

**Uso**:
```tsx
import { ReadOnlyField } from '../../components/StandardInput';

<ReadOnlyField
  label="Nombre del Agregado"
  value={entry.aggregate_name}
  icon={<span>🏗️</span>}
/>

<ReadOnlyField
  label="Capacidad del Silo"
  value={entry.capacity}
  unit="tons"
/>
```

**Props**:
- `label`: Texto del label
- `value`: Valor a mostrar (string | number)
- `unit`: Unidad opcional
- `icon`: Ícono opcional (ReactNode)

### 3. **FormSection** (`/src/app/components/StandardInput.tsx`)

Contenedor para agrupar inputs relacionados.

**Uso**:
```tsx
import { FormSection } from '../../components/StandardInput';

<FormSection
  title="Mediciones de Caja"
  description="Ingresa las mediciones de la pila de agregado"
  icon={<span>📐</span>}
>
  <StandardInput label="Ancho" value={...} onChange={...} />
  <StandardInput label="Alto" value={...} onChange={...} />
  <StandardInput label="Largo" value={...} onChange={...} />
</FormSection>
```

---

## 🔧 Patrón de Implementación

### **Estructura Recomendada por Sección**

Cada sección debe seguir este patrón:

```tsx
export function SectionName() {
  // 1. HOOKS
  const { currentPlant } = useAuth();
  const { prefillData, loadPlantData, updateEntry } = usePlantPrefill();
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<...>(null);

  // 2. LOAD DATA
  useEffect(() => {
    if (currentPlant) {
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      loadPlantData(currentPlant.id, yearMonth);
    }
  }, [currentPlant, loadPlantData]);

  // 3. FIELD CHANGE HANDLER
  const handleFieldChange = (entryId: string, field: string, value: any) => {
    updateEntry('sectionName', entryId, { [field]: value });
  };

  // 4. SAVE HANDLER
  const handleSave = async () => { ... };

  // 5. LOADING STATE
  if (prefillData.loading) {
    return <LoadingCard />;
  }

  // 6. ERROR STATE
  if (prefillData.error) {
    return <ErrorCard />;
  }

  // 7. RENDER FORM
  return (
    <div className="p-6 space-y-6">
      {/* Header with progress */}
      <Header />
      
      {/* Entries */}
      {entries.map(entry => (
        <Card key={entry.id}>
          {/* READ-ONLY: Configuration */}
          <ReadOnlyField label="Nombre" value={entry.name} />
          <ReadOnlyField label="Capacidad" value={entry.capacity} unit="tons" />
          
          {/* EDITABLE: User inputs */}
          <StandardInput
            label="Lectura Actual"
            value={entry.current_reading}
            onChange={(v) => handleFieldChange(entry.id, 'current_reading', v)}
            required={true}
          />
          
          {/* Photo */}
          <PhotoCapture
            photo={entry.photo_url}
            onPhotoCapture={(url) => handleFieldChange(entry.id, 'photo_url', url)}
          />
        </Card>
      ))}
      
      {/* Save button */}
      <Button onClick={handleSave}>Guardar</Button>
    </div>
  );
}
```

---

## 📋 Checklist por Sección

Para cada sección, verifica:

### **Campos de Configuración (READ-ONLY)**

Estos campos vienen de la configuración y NO deben ser editables:

- [ ] Nombres (aggregate_name, silo_name, additive_name, etc.)
- [ ] Capacidades fijas
- [ ] Dimensiones de configuración
- [ ] Números de medidor
- [ ] Unidades de medida
- [ ] Métodos de medición

**Implementación**: Usar `<ReadOnlyField />`

### **Campos Editables (REQUIRED)**

Estos campos deben ser completados por el usuario:

- [ ] Lecturas actuales (current_reading)
- [ ] Conteos (box_count, cone_count)
- [ ] Cantidades (quantity)
- [ ] Mediciones tomadas en campo
- [ ] Fotos de evidencia

**Implementación**: Usar `<StandardInput required={true} />`

### **Validación**

- [ ] `0` es aceptado como valor válido
- [ ] `null`, `undefined`, `""` se marcan como incompletos
- [ ] Borde rojo cuando campo incompleto
- [ ] Mensaje claro: "⚠️ Este campo es requerido"

---

## 🎨 Guía Visual

### **Estado 1: Campo Incompleto (Requerido)**
```
┌─────────────────────────────────────┐
│ Lectura Actual * (gallons)         │ ← Label con *
├─────────────────────────────────────┤
│ [____________________________] gal │ ← Borde ROJO
├─────────────────────────────────────┤
│ ⚠️ Este campo es requerido          │ ← Mensaje de error
└─────────────────────────────────────┘
```

### **Estado 2: Campo Completo con valor 0**
```
┌─────────────────────────────────────┐
│ Box Count * (boxes)                 │
├─────────────────────────────────────┤
│ [____0_______________________] box │ ← Borde AZUL
└─────────────────────────────────────┘
✅ 0 es un valor válido!
```

### **Estado 3: Campo Completo con valor > 0**
```
┌─────────────────────────────────────┐
│ Lectura Actual * (gallons)          │
├─────────────────────────────────────┤
│ [____250.5___________________] gal │ ← Borde AZUL
└─────────────────────────────────────┘
```

### **Estado 4: Campo de Configuración (Read-Only)**
```
┌─────────────────────────────────────┐
│ NOMBRE DEL AGREGADO                 │ ← Label mayúsculas
├─────────────────────────────────────┤
│ 🏗️ 3/4" Clear Stone                │ ← Fondo gris, Bold
└─────────────────────────────────────┘
```

---

## 🔢 Reglas de Validación

### **Para Campos Numéricos**

```typescript
// ❌ INCOMPLETO
value === null
value === undefined
value === ""

// ✅ COMPLETO
value === 0        // 0 es válido!
value === 5
value === 250.5
value === -10      // Depende del contexto
```

### **Para Campos de Texto**

```typescript
// ❌ INCOMPLETO
value === null
value === undefined
value === ""

// ✅ COMPLETO
value === "cualquier string no vacío"
```

### **Para Fotos**

```typescript
// ❌ INCOMPLETO
photo_url === null
photo_url === undefined
photo_url === ""

// ✅ COMPLETO
photo_url === "blob:..." // URL válida
```

---

## 📝 Ejemplos por Sección

### **Aggregates Section**

**Configuración (Read-Only)**:
- ✅ `aggregate_name`
- ✅ `measurement_method` (BOX/CONE)
- ✅ `box_width_ft`, `box_height_ft` (dimensiones fijas)
- ✅ `cone_diameter_*` (dimensiones fijas)

**Editable (Required)**:
- ✅ `box_count` (puede ser 0)
- ✅ `cone_count` (puede ser 0)
- ✅ `box_length_ft` (medición en campo, puede ser 0)
- ✅ `cone_m1` a `cone_m6` (mediciones en campo)
- ✅ `cone_d1`, `cone_d2` (mediciones en campo)
- ✅ `photo_url`

### **Silos Section**

**Configuración (Read-Only)**:
- ✅ `silo_name`
- ✅ `capacity_tons`
- ✅ `meter_number`

**Editable (Required)**:
- ✅ `current_reading` (puede ser 0)
- ✅ `product_id` (dropdown)
- ✅ `photo_url`

### **Additives Section**

**Configuración (Read-Only)**:
- ✅ `additive_name`
- ✅ `unit`
- ✅ `meter_number`

**Editable (Required)**:
- ✅ `current_reading` (puede ser 0)
- ✅ `photo_url` (si `requires_photo`)

### **Diesel Section**

**Configuración (Read-Only)**:
- ✅ `tank_capacity_gallons`
- ✅ Curva de calibración

**Editable (Required)**:
- ✅ `current_reading` (pulgadas, puede ser 0)
- ✅ `photo_url`

### **Products Section**

**Configuración (Read-Only)**:
- ✅ `product_name`
- ✅ `measure_mode` (BY_UNIT/BY_WEIGHT)
- ✅ `unit`

**Editable (Required)**:
- ✅ `quantity` (puede ser 0)
- ✅ `photo_url` (si `requires_photo`)

### **Utilities Section**

**Configuración (Read-Only)**:
- ✅ `utility_name`
- ✅ `meter_number`
- ✅ `unit`

**Editable (Required)**:
- ✅ `current_reading` (puede ser 0)
- ✅ `photo_url` (si `requires_photo`)

### **Petty Cash Section**

**Configuración (Read-Only)**:
- ✅ `expected_total` (monto esperado de la planta)

**Editable (Required)**:
- ✅ `receipts` (puede ser 0)
- ✅ `cash` (puede ser 0)
- ✅ `photo_url`

---

## 🚀 Plan de Implementación

### **Fase 1: Componentes Base** ✅
- [x] Crear `StandardInput`
- [x] Crear `ReadOnlyField`
- [x] Crear `FormSection`
- [x] Actualizar validaciones en `validation.ts`

### **Fase 2: Actualizar Secciones**
- [ ] AggregatesSection
- [ ] SilosSection
- [ ] AdditivesSection
- [ ] DieselSection
- [ ] ProductsSection
- [ ] UtilitiesSection
- [ ] PettyCashSection

### **Fase 3: Testing**
- [ ] Verificar que 0 es aceptado
- [ ] Verificar bordes rojos en campos incompletos
- [ ] Verificar que configuración es read-only
- [ ] Verificar validación en ReviewAndApprove

---

## ✅ Definition of Done

Cuando todas las secciones estén actualizadas:

✅ **Campos numéricos aceptan 0**
- Input de 0 no muestra error
- Validación considera 0 como completo

✅ **Vacío es incompleto**
- null/undefined/"" muestran borde rojo
- Mensaje claro: "Este campo es requerido"

✅ **Campos requeridos resaltados**
- Asterisco `*` en label
- Borde rojo cuando incompleto
- Borde azul cuando completo

✅ **Configuración read-only**
- Fondo gris distintivo
- No editable (disabled)
- Label en mayúsculas
- Visualmente distinto

✅ **UX consistente**
- Todas las secciones usan mismos componentes
- Misma apariencia visual
- Mismo comportamiento
- Mismo feedback

✅ **Review detecta correctamente**
- 0 cuenta como completo
- Vacío cuenta como incompleto
- Fotos faltantes detectadas

---

## 📞 Siguiente Acción

**Para implementar en cada sección**:

1. Importar componentes:
```tsx
import { StandardInput, ReadOnlyField, FormSection } from '../../components/StandardInput';
```

2. Identificar campos de configuración → usar `ReadOnlyField`
3. Identificar campos editables → usar `StandardInput`
4. Agrupar inputs relacionados → usar `FormSection`
5. Verificar validación: 0 = válido, vacío = inválido
6. Testear visualmente

**¿Por dónde empezar?**
- Más simple: **DieselSection** (1 entrada única)
- Complejidad media: **SilosSection**, **AdditivesSection**
- Más complejo: **AggregatesSection** (método BOX vs CONE)

---

**Fecha**: 2026-02-16  
**Estado**: ✅ Componentes creados, listos para implementar en secciones  
