# 📋 Instrucciones para Configurar Supabase - Review & Approve Workflow

Este documento contiene las instrucciones paso a paso para configurar la base de datos de Supabase para soportar el flujo completo de **Revisión y Aprobación** de inventarios.

---

## 🎯 Objetivo

Agregar campos a la tabla `inventory_month_02205af0` para soportar:
- ✅ Envío a aprobación (SUBMIT)
- ✅ Aprobación (APPROVE)
- ✅ Rechazo (REJECT)
- ✅ Trazabilidad completa (quién llenó, quién aprobó, cuándo)

---

## 📝 Pasos para Ejecutar la Migración

### **Paso 1: Acceder a Supabase SQL Editor**

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. En el menú lateral izquierdo, haz clic en **"SQL Editor"**
3. Haz clic en el botón **"New Query"** (esquina superior derecha)

### **Paso 2: Copiar y Pegar el Script SQL**

Copia el siguiente script SQL y pégalo en el editor:

```sql
-- ============================================================================
-- MIGRATION: ADD SUBMISSION AND APPROVAL FIELDS
-- ============================================================================

-- Step 1: Add new columns
ALTER TABLE inventory_month_02205af0
ADD COLUMN IF NOT EXISTS submitted_by TEXT,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approval_notes TEXT,
ADD COLUMN IF NOT EXISTS rejected_by TEXT,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_notes TEXT;

-- Step 2: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_month_status 
ON inventory_month_02205af0(status);

CREATE INDEX IF NOT EXISTS idx_inventory_month_plant_status 
ON inventory_month_02205af0(plant_id, status);

CREATE INDEX IF NOT EXISTS idx_inventory_month_year_month 
ON inventory_month_02205af0(year_month);

-- Step 3: Add column comments for documentation
COMMENT ON COLUMN inventory_month_02205af0.status IS 
'Status: IN_PROGRESS, SUBMITTED, or APPROVED';

COMMENT ON COLUMN inventory_month_02205af0.created_by IS 
'User ID who created/filled the inventory';

COMMENT ON COLUMN inventory_month_02205af0.submitted_by IS 
'User ID who submitted for approval';

COMMENT ON COLUMN inventory_month_02205af0.submitted_at IS 
'Timestamp when submitted for approval';

COMMENT ON COLUMN inventory_month_02205af0.approved_by IS 
'User ID who approved the inventory';

COMMENT ON COLUMN inventory_month_02205af0.approved_at IS 
'Timestamp when approved';

COMMENT ON COLUMN inventory_month_02205af0.approval_notes IS 
'Optional notes by approver';

COMMENT ON COLUMN inventory_month_02205af0.rejected_by IS 
'User ID who rejected the inventory';

COMMENT ON COLUMN inventory_month_02205af0.rejected_at IS 
'Timestamp when rejected';

COMMENT ON COLUMN inventory_month_02205af0.rejection_notes IS 
'Required notes explaining rejection';
```

### **Paso 3: Ejecutar el Script**

1. Haz clic en el botón **"Run"** (esquina inferior derecha)
   - O presiona **Ctrl + Enter** (Windows/Linux)
   - O presiona **Cmd + Enter** (Mac)

2. Espera a que aparezca el mensaje: **"Success. No rows returned"**

### **Paso 4: Verificar la Migración**

Ejecuta esta consulta para verificar que todas las columnas existen:

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'inventory_month_02205af0'
ORDER BY ordinal_position;
```

**Deberías ver estas nuevas columnas:**
- ✅ `submitted_by` (TEXT)
- ✅ `submitted_at` (TIMESTAMPTZ)
- ✅ `approved_by` (TEXT)
- ✅ `approved_at` (TIMESTAMPTZ)
- ✅ `approval_notes` (TEXT)
- ✅ `rejected_by` (TEXT)
- ✅ `rejected_at` (TIMESTAMPTZ)
- ✅ `rejection_notes` (TEXT)

---

## 🗂️ Estructura Final de la Tabla

Después de la migración, la tabla `inventory_month_02205af0` tendrá:

### **Campos Principales**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | ID único del mes de inventario |
| `plant_id` | TEXT | ID de la planta |
| `year_month` | TEXT | Mes en formato YYYY-MM |
| `status` | TEXT | IN_PROGRESS, SUBMITTED, APPROVED |
| `notes` | TEXT | Notas generales |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | Última actualización |

### **Campos de Trazabilidad (Nuevos)**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `created_by` | TEXT | Usuario que creó/llenó el inventario |
| `submitted_by` | TEXT | Usuario que envió a aprobación |
| `submitted_at` | TIMESTAMPTZ | Cuándo se envió a aprobación |
| `approved_by` | TEXT | Usuario que aprobó |
| `approved_at` | TIMESTAMPTZ | Cuándo se aprobó |
| `approval_notes` | TEXT | Notas del aprobador |
| `rejected_by` | TEXT | Usuario que rechazó |
| `rejected_at` | TIMESTAMPTZ | Cuándo se rechazó |
| `rejection_notes` | TEXT | Razón del rechazo |

---

## 🔄 Flujo de Estados

### **Estado 1: IN_PROGRESS**
- **Quién**: Plant Manager
- **Acción**: Completando secciones del inventario
- **Campos activos**: `created_by`, `created_at`
- **Edición**: ✅ Permitida

### **Estado 2: SUBMITTED**
- **Quién**: Plant Manager envía
- **Acción**: Enviado a aprobación
- **Campos activos**: `submitted_by`, `submitted_at`
- **Edición**: 🔒 **BLOQUEADA** (solo lectura)

### **Estado 3A: APPROVED**
- **Quién**: Admin/Super Admin aprueba
- **Acción**: Inventario finalizado
- **Campos activos**: `approved_by`, `approved_at`, `approval_notes`
- **Edición**: 🔒 **BLOQUEADA** (solo lectura)

### **Estado 3B: REJECTED → IN_PROGRESS**
- **Quién**: Admin/Super Admin rechaza
- **Acción**: Devuelto al Plant Manager
- **Campos activos**: `rejected_by`, `rejected_at`, `rejection_notes`
- **Edición**: ✅ Permitida nuevamente

---

## 🔧 Endpoints del Backend (Ya Implementados)

### **1. Save Draft**
```
POST /make-server-02205af0/inventory/save-draft
Body: { inventory_month_id }
```
- Mantiene estado `IN_PROGRESS`
- Actualiza `updated_at`

### **2. Submit for Approval**
```
POST /make-server-02205af0/inventory/submit
Body: { inventory_month_id, submitted_by }
```
- Cambia estado: `IN_PROGRESS` → `SUBMITTED`
- Guarda `submitted_by` y `submitted_at`
- **Bloquea edición**

### **3. Approve Inventory**
```
POST /make-server-02205af0/inventory/approve
Body: { inventory_month_id, approved_by, notes? }
```
- Cambia estado: `SUBMITTED` → `APPROVED`
- Guarda `approved_by`, `approved_at`, `approval_notes`
- **Mantiene bloqueo**

### **4. Reject Inventory**
```
POST /make-server-02205af0/inventory/reject
Body: { inventory_month_id, rejected_by, rejection_notes }
```
- Cambia estado: `SUBMITTED` → `IN_PROGRESS`
- Guarda `rejected_by`, `rejected_at`, `rejection_notes`
- Limpia `submitted_by` y `submitted_at`
- **Desbloquea edición**

---

## ✅ Validación de Estados

Los endpoints validan automáticamente:

### **Submit**
- ✅ Solo desde `IN_PROGRESS`
- ❌ Error si ya está `SUBMITTED` o `APPROVED`

### **Approve**
- ✅ Solo desde `SUBMITTED`
- ❌ Error si está `IN_PROGRESS` o ya `APPROVED`

### **Reject**
- ✅ Solo desde `SUBMITTED`
- ❌ Error si está `IN_PROGRESS` o ya `APPROVED`

---

## 🔐 Permisos por Rol

### **Plant Manager (PLANT_MANAGER)**
- ✅ Crear inventario
- ✅ Completar secciones
- ✅ Guardar borrador
- ✅ **Enviar a aprobación**
- ❌ Aprobar
- ❌ Rechazar

### **Admin (ADMIN) / Super Admin (SUPER_ADMIN)**
- ✅ Ver inventarios
- ✅ **Aprobar inventario**
- ✅ **Rechazar inventario**
- ❌ Editar secciones directamente

---

## 📊 Queries Útiles para Reportes

### **Inventarios Pendientes de Aprobación**
```sql
SELECT 
    id,
    plant_id,
    year_month,
    submitted_by,
    submitted_at
FROM inventory_month_02205af0
WHERE status = 'SUBMITTED'
ORDER BY submitted_at ASC;
```

### **Inventarios Aprobados Este Mes**
```sql
SELECT 
    id,
    plant_id,
    year_month,
    created_by,
    approved_by,
    approved_at
FROM inventory_month_02205af0
WHERE 
    status = 'APPROVED' 
    AND approved_at >= DATE_TRUNC('month', CURRENT_DATE)
ORDER BY approved_at DESC;
```

### **Historial de Rechazos**
```sql
SELECT 
    id,
    plant_id,
    year_month,
    rejected_by,
    rejected_at,
    rejection_notes
FROM inventory_month_02205af0
WHERE rejected_at IS NOT NULL
ORDER BY rejected_at DESC;
```

### **Trazabilidad Completa de un Inventario**
```sql
SELECT 
    id,
    plant_id,
    year_month,
    status,
    created_by,
    created_at,
    submitted_by,
    submitted_at,
    approved_by,
    approved_at,
    rejected_by,
    rejected_at,
    rejection_notes
FROM inventory_month_02205af0
WHERE id = 'YOUR_INVENTORY_ID';
```

---

## 🚨 Troubleshooting

### **Error: "column already exists"**
✅ Esto es normal si ya ejecutaste la migración antes. Los comandos `IF NOT EXISTS` previenen errores.

### **Error: "permission denied"**
❌ Necesitas permisos de administrador en Supabase. Contacta al owner del proyecto.

### **Error: "relation does not exist"**
❌ La tabla `inventory_month_02205af0` no existe. Ejecuta primero el script de inicialización de la base de datos.

### **Verificar que el Backend está Actualizado**
```bash
# En la consola de tu proyecto, verifica que los endpoints respondan:
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/make-server-02205af0/inventory/save-draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"inventory_month_id": "test"}'
```

---

## 📚 Recursos Adicionales

- [Supabase SQL Editor](https://supabase.com/docs/guides/database/overview)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Supabase Indexes](https://supabase.com/docs/guides/database/tables#indexes)

---

## ✅ Checklist de Implementación

- [ ] **Paso 1**: Ejecutar script SQL en Supabase
- [ ] **Paso 2**: Verificar que las columnas existen
- [ ] **Paso 3**: Verificar que los índices se crearon
- [ ] **Paso 4**: Testear endpoint `/inventory/save-draft`
- [ ] **Paso 5**: Testear endpoint `/inventory/submit`
- [ ] **Paso 6**: Testear endpoint `/inventory/approve`
- [ ] **Paso 7**: Testear endpoint `/inventory/reject`
- [ ] **Paso 8**: Verificar trazabilidad en la tabla
- [ ] **Paso 9**: Probar flujo completo en la UI

---

## 🎉 ¡Migración Completa!

Una vez completados todos los pasos, tu aplicación PROMIX PLANT INVENTORY tendrá:

✅ Flujo completo de aprobación con 3 estados  
✅ Bloqueo automático de edición al enviar  
✅ Trazabilidad completa (quién llenó, quién aprobó, cuándo)  
✅ Sistema de rechazo con notas obligatorias  
✅ Validación de estados en el backend  
✅ Permisos por rol correctamente implementados  
✅ Queries optimizadas con índices  

---

**Fecha de Creación**: 2026-02-16  
**Versión**: 1.0  
**Autor**: Sistema PROMIX Plant Inventory  
