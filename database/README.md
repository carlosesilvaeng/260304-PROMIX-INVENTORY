# 📁 Database Scripts - PROMIX Plant Inventory

## 🎯 Propósito

Esta carpeta contiene **todos los scripts SQL** necesarios para inicializar, migrar y mantener la base de datos de Supabase del sistema PROMIX Plant Inventory.

---

## 📋 Orden de Ejecución

### **Inicialización Completa desde Cero**

Para borrar todo y empezar limpio:

| Orden | Archivo | Descripción | Tiempo | Obligatorio |
|-------|---------|-------------|--------|-------------|
| 1️⃣ | `01_CLEANUP_ALL_TABLES.sql` | Borra TODAS las tablas | 30 seg | ✅ |
| 2️⃣ | `02_CREATE_ALL_TABLES.sql` | Crea todas las tablas + índices | 1 min | ✅ |
| 3️⃣ | `/DUMMY_DATA_ENERO_2026.sql` | Carga datos de prueba (Enero 2026) | 10 seg | 🟡 Opcional |
| 4️⃣ | `/VERIFICATION_SCRIPT.sql` | Verifica que todo está bien | 30 seg | ✅ Recomendado |

**IMPORTANTE**: Ejecutar en este orden exacto. No omitir pasos.

---

## 📁 Contenido de la Carpeta

### **Scripts Principales**

#### **1. `01_CLEANUP_ALL_TABLES.sql`**
```sql
-- Propósito: Limpieza total de base de datos
-- ⚠️ CUIDADO: Borra TODAS las tablas permanentemente
-- Cuándo usar: 
--   - Al inicializar desde cero
--   - Cuando hay inconsistencias estructurales
--   - Para testing desde estado limpio
```

**Output esperado**:
```
✅ LIMPIEZA COMPLETADA
executed_at: 2026-02-16 ...
message: Base de datos lista para inicialización limpia
```

---

#### **2. `02_CREATE_ALL_TABLES.sql`**
```sql
-- Propósito: Creación completa de estructura de BD
-- Crea: 9 tablas + índices + constraints + config inicial
-- Prerequisito: Haber ejecutado 01_CLEANUP (opcional si BD está vacía)
```

**Tablas creadas**:
1. `inventory_month_02205af0` - Inventarios mensuales
2. `aggregates_entries_02205af0` - Agregados
3. `silos_entries_02205af0` - Silos de cemento
4. `additives_entries_02205af0` - Aditivos
5. `diesel_entries_02205af0` - Diesel
6. `products_entries_02205af0` - Productos terminados
7. `utilities_entries_02205af0` - Agua y electricidad
8. `petty_cash_entries_02205af0` - Petty Cash
9. `kv_store_02205af0` - KV Store (configuraciones)

**Output esperado**:
```
=== TABLAS CREADAS ===
inventory_month_02205af0       ✅ Existe
aggregates_entries_02205af0    ✅ Existe
... (todas con ✅)

✅ CREACIÓN COMPLETADA
```

---

#### **3. `03_LOAD_DUMMY_DATA.sql`**
```sql
-- Propósito: Placeholder para datos dummy
-- Nota: El script real está en /DUMMY_DATA_ENERO_2026.sql
-- Ver: /DUMMY_DATA_GUIDE.md para instrucciones completas
```

---

#### **4. `INITIALIZATION_GUIDE.md`**
```
📖 Guía paso a paso completa para inicializar Supabase desde cero
Incluye:
- Instrucciones detalladas
- Troubleshooting
- Checklist de verificación
- Estimación de tiempos
```

---

### **Scripts Auxiliares** (en raíz del proyecto)

#### **`/DUMMY_DATA_ENERO_2026.sql`**
- 560+ líneas de SQL
- ~98 registros de prueba
- 6 plantas con diferentes estados
- Enero 2026 (mes completo)
- Ver `/DUMMY_DATA_GUIDE.md` para detalles

#### **`/VERIFICATION_SCRIPT.sql`**
- 13 queries de verificación
- Conteos por tabla
- Integridad referencial
- Resumen estadístico

---

## 🚀 Quick Start

### **Para inicializar TODO desde cero** (15 minutos):

```bash
# 1. Ir a Supabase Dashboard → SQL Editor

# 2. Ejecutar scripts en orden:
#    - 01_CLEANUP_ALL_TABLES.sql
#    - 02_CREATE_ALL_TABLES.sql
#    - /DUMMY_DATA_ENERO_2026.sql (opcional)
#    - /VERIFICATION_SCRIPT.sql

# 3. Refrescar app (Ctrl+F5)

# 4. ✅ Listo!
```

Ver **`INITIALIZATION_GUIDE.md`** para instrucciones detalladas.

---

## 📊 Estructura de Datos

### **Relaciones entre tablas**

```
inventory_month_02205af0 (padre)
  ↓ (FK: inventory_month_id)
  ├── aggregates_entries_02205af0
  ├── silos_entries_02205af0
  ├── additives_entries_02205af0
  ├── diesel_entries_02205af0
  ├── products_entries_02205af0
  ├── utilities_entries_02205af0
  └── petty_cash_entries_02205af0

kv_store_02205af0 (independiente)
  └── Almacena: modules_config, user_settings, etc.
```

### **Estados de inventario**

```
IN_PROGRESS → SUBMITTED → APPROVED
                    ↓
                REJECTED → (vuelta a IN_PROGRESS)
```

---

## 🔒 Seguridad y Permisos

### **Permisos necesarios**:
- `CREATE TABLE` - Para crear tablas
- `DROP TABLE` - Para borrar tablas (limpieza)
- `INSERT` - Para insertar datos
- `SELECT` - Para consultar datos
- `UPDATE` - Para actualizar datos
- `DELETE` - Para borrar datos

### **⚠️ IMPORTANTE**:
- **NUNCA** ejecutar `01_CLEANUP_ALL_TABLES.sql` en **PRODUCCIÓN**
- **SIEMPRE** hacer backup antes de limpiar
- Verificar ambiente antes de ejecutar scripts destructivos

---

## 🧪 Testing

### **Verificar que todo funciona**:

```sql
-- 1. Contar tablas creadas
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%_02205af0';
-- Esperado: 9 tablas

-- 2. Verificar configuración de módulos
SELECT * FROM kv_store_02205af0 
WHERE key = 'modules_config';
-- Esperado: 1 fila con JSON de configuración

-- 3. Si cargaste datos dummy:
SELECT COUNT(*) FROM inventory_month_02205af0;
-- Esperado: 6 inventarios (Enero 2026)

SELECT COUNT(*) FROM aggregates_entries_02205af0;
-- Esperado: ~20 entradas
```

---

## 🆘 Troubleshooting

### **Error: "table already exists"**
```sql
-- Solución: Ejecutar limpieza primero
-- Run: 01_CLEANUP_ALL_TABLES.sql
```

### **Error: "foreign key violation"**
```sql
-- Solución: Borrar en orden correcto
-- Primero entries, luego inventory_month
DELETE FROM aggregates_entries_02205af0;
DELETE FROM inventory_month_02205af0;
```

### **Error: "permission denied"**
```
Solución: 
- Verificar permisos del usuario
- Usar usuario con rol adecuado
- Contactar admin de Supabase
```

### **BD inconsistente después de actualización**
```
Solución COMPLETA:
1. Backup de datos importantes (si hay)
2. Ejecutar 01_CLEANUP_ALL_TABLES.sql
3. Ejecutar 02_CREATE_ALL_TABLES.sql
4. Recargar datos (desde backup o dummy data)
```

---

## 📚 Documentación Relacionada

| Documento | Ubicación | Descripción |
|-----------|-----------|-------------|
| **Guía de Inicialización** | `/database/INITIALIZATION_GUIDE.md` | Paso a paso completo |
| **Datos Dummy - Guía** | `/DUMMY_DATA_GUIDE.md` | Cómo usar datos de prueba |
| **Datos Dummy - Resumen** | `/DUMMY_DATA_SUMMARY.md` | Qué contienen los datos |
| **Quick Start** | `/QUICKSTART.md` | 3 pasos rápidos |
| **Sistema de Módulos** | `/MODULE-MANAGEMENT-SYSTEM.md` | Control de módulos |

---

## 🔄 Migraciones Futuras

### **Para agregar nueva funcionalidad**:

```sql
-- Crear archivo: database/migrations/YYYY-MM-DD_descripcion.sql

-- Ejemplo:
-- database/migrations/2026-03-01_add_comments_table.sql

CREATE TABLE IF NOT EXISTS comments_02205af0 (
  id SERIAL PRIMARY KEY,
  inventory_month_id TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_comments_inventory 
    FOREIGN KEY (inventory_month_id) 
    REFERENCES inventory_month_02205af0(id) 
    ON DELETE CASCADE
);
```

### **Convención de nombres**:
- Todas las tablas: `nombre_02205af0` (sufijo de proyecto)
- Migraciones: `YYYY-MM-DD_descripcion.sql`
- Índices: `idx_tabla_columna`
- Foreign Keys: `fk_tabla_referencia`
- Constraints: `descripcion_constraint`

---

## 📊 Estado Actual

**Versión**: 2.0  
**Última actualización**: 2026-02-16  
**Tablas**: 9  
**Scripts disponibles**: 4 principales + 3 auxiliares  
**Estado**: ✅ Producción ready  

---

## 🎉 Resumen

Esta carpeta contiene todo lo necesario para:

✅ Inicializar BD desde cero  
✅ Migrar de versiones anteriores  
✅ Cargar datos de prueba  
✅ Verificar integridad  
✅ Hacer troubleshooting  

**Ver `INITIALIZATION_GUIDE.md` para empezar** 🚀

---

**Mantenido por**: Equipo PROMIX Development  
**Contacto**: Ver documentación principal  
**Licencia**: Privado - Solo uso interno PROMIX
