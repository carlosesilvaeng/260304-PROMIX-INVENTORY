# 🚀 GUÍA COMPLETA: INICIALIZAR SUPABASE DESDE CERO

## ⚠️ ADVERTENCIA IMPORTANTE

Esta guía te llevará a **BORRAR TODAS las tablas existentes** y crear todo desde cero. **TODOS LOS DATOS SE PERDERÁN PERMANENTEMENTE**.

---

## 📋 ¿Cuándo usar esta guía?

✅ **SÍ, úsala si**:
- La base de datos tiene inconsistencias
- Actualizaste desde versión 32 y hay cambios estructurales
- Quieres empezar completamente limpio
- Estás en ambiente de **DESARROLLO** o **TESTING**
- Quieres cargar datos dummy desde cero

❌ **NO la uses si**:
- Estás en **PRODUCCIÓN** con datos reales
- No has hecho backup de datos importantes
- No estás seguro de querer perder todos los datos

---

## 🎯 Resultado Final

Después de completar esta guía tendrás:

✅ Base de datos completamente limpia  
✅ 9 tablas creadas con estructura actualizada  
✅ Índices y constraints aplicados  
✅ Configuración de módulos inicializada (solo Agregados habilitado)  
✅ **OPCIONAL**: Datos dummy de Enero 2026 cargados (~98 registros)  

---

## 📦 Preparación

### **Archivos necesarios** (ya creados en `/database/`):

| Orden | Archivo | Propósito |
|-------|---------|-----------|
| 1️⃣ | `01_CLEANUP_ALL_TABLES.sql` | Borra todas las tablas |
| 2️⃣ | `02_CREATE_ALL_TABLES.sql` | Crea todas las tablas |
| 3️⃣ | `/DUMMY_DATA_ENERO_2026.sql` | Carga datos de prueba (opcional) |
| 4️⃣ | `/VERIFICATION_SCRIPT.sql` | Verifica que todo está bien |

---

## 🔥 PASO A PASO: INICIALIZACIÓN COMPLETA

### **PASO 1: Acceder a Supabase SQL Editor** (1 minuto)

1. Ir a [https://supabase.com](https://supabase.com)
2. **Login** con tu cuenta
3. Seleccionar tu proyecto PROMIX
4. En el menú lateral, click **"SQL Editor"**
5. Click **"New query"** (botón verde)

---

### **PASO 2: LIMPIEZA - Borrar tablas existentes** (2 minutos)

⚠️ **ÚLTIMA OPORTUNIDAD PARA HACER BACKUP**

1. **Abrir**: `/database/01_CLEANUP_ALL_TABLES.sql`
2. **Copiar** TODO el contenido del archivo
3. **Pegar** en el SQL Editor de Supabase
4. **Leer** el script para confirmar que entiendes lo que hace
5. **Ejecutar**: Click en **"Run"** (esquina inferior derecha)

**Resultado esperado**:
```
✅ LIMPIEZA COMPLETADA
executed_at: 2026-02-16 ...
message: Base de datos lista para inicialización limpia
```

**Si hay error**:
- Probablemente no había tablas previas (OK, continúa)
- O hay conexiones activas (cerrar conexiones y reintentar)

---

### **PASO 3: CREACIÓN - Crear todas las tablas** (2 minutos)

1. **Nueva query**: Click **"New query"** en Supabase
2. **Abrir**: `/database/02_CREATE_ALL_TABLES.sql`
3. **Copiar** TODO el contenido del archivo
4. **Pegar** en el nuevo SQL Editor
5. **Ejecutar**: Click en **"Run"**

**Resultado esperado**:
```
=== TABLAS CREADAS ===
inventory_month_02205af0       ✅ Existe
aggregates_entries_02205af0    ✅ Existe
silos_entries_02205af0         ✅ Existe
additives_entries_02205af0     ✅ Existe
diesel_entries_02205af0        ✅ Existe
products_entries_02205af0      ✅ Existe
utilities_entries_02205af0     ✅ Existe
petty_cash_entries_02205af0    ✅ Existe
kv_store_02205af0              ✅ Existe

✅ CREACIÓN COMPLETADA
executed_at: 2026-02-16 ...
message: Base de datos inicializada y lista para usar
```

**Si alguna tabla muestra "❌ No existe"**:
- Revisar errores en la consola de Supabase
- Verificar que tienes permisos de CREATE TABLE
- Intentar ejecutar de nuevo

---

### **PASO 4: DATOS DUMMY - Cargar datos de prueba** (3 minutos) ⭐ OPCIONAL

Este paso es **OPCIONAL** pero **MUY RECOMENDADO** para testing.

1. **Nueva query**: Click **"New query"** en Supabase
2. **Abrir**: `/DUMMY_DATA_ENERO_2026.sql` (en la raíz del proyecto)
3. **Copiar** TODO el contenido (560+ líneas)
4. **Pegar** en el SQL Editor
5. **Ejecutar**: Click en **"Run"**
6. **Esperar**: Puede tardar 5-10 segundos

**Resultado esperado**:
```
Success. No rows returned
(Esto es normal para INSERT statements)
```

**Si hay error**:
- `duplicate key value`: Ya existen datos de Enero 2026 (borrar primero)
- `foreign key violation`: Las tablas no se crearon correctamente (volver al PASO 3)
- `table does not exist`: Falta ejecutar PASO 3

---

### **PASO 5: VERIFICACIÓN - Confirmar que todo está OK** (2 minutos)

1. **Nueva query**: Click **"New query"** en Supabase
2. **Abrir**: `/VERIFICATION_SCRIPT.sql`
3. **Copiar** TODO el contenido
4. **Pegar** en el SQL Editor
5. **Ejecutar**: Click en **"Run"**

**Resultado esperado (si cargaste datos dummy)**:
```
=== CONTEO POR TABLA ===
inventory_month_02205af0        6
aggregates_entries_02205af0     20
silos_entries_02205af0          20
additives_entries_02205af0      18
diesel_entries_02205af0         4
products_entries_02205af0       22
utilities_entries_02205af0      10
petty_cash_entries_02205af0     4

=== RESUMEN FINAL ===
Total Inventarios     6      100%
APPROVED              2      33%
SUBMITTED             2      33%
IN_PROGRESS           2      33%

=== INTEGRIDAD REFERENCIAL ===
aggregates_entries    0      ✅ OK
silos_entries         0      ✅ OK
additives_entries     0      ✅ OK
```

**Si NO cargaste datos dummy**:
```
=== CONTEO POR TABLA ===
Todos los conteos deberían ser 0 (OK, base de datos vacía)
```

---

### **PASO 6: PROBAR EN LA APLICACIÓN** (5 minutos)

1. **Refrescar navegador**: `Ctrl + F5` (o `Cmd + Shift + R` en Mac)
2. **Cerrar y reabrir** la aplicación si está corriendo
3. **Login** como cualquier usuario

**Si NO cargaste datos dummy**:
- Dashboard estará vacío (normal)
- Podrás empezar a capturar inventarios desde cero

**Si SÍ cargaste datos dummy**:
- Verás datos de Enero 2026
- Dashboard mostrará información histórica
- Review & Approve tendrá inventarios pendientes

---

## ✅ CHECKLIST DE VERIFICACIÓN

Después de completar todos los pasos, verifica:

### **En Supabase Dashboard**:
- [ ] 9 tablas existen (ver en "Table Editor")
- [ ] kv_store_02205af0 tiene entrada "modules_config"
- [ ] inventory_month_02205af0 existe (vacía o con 6 registros)
- [ ] No hay errores en "Logs"

### **En la aplicación web**:
- [ ] Login funciona correctamente
- [ ] Dashboard carga sin errores
- [ ] Sidebar muestra solo "Agregados" habilitado (por defecto)
- [ ] Settings → Módulos es accesible (solo Super Admin)
- [ ] No hay errores en consola del navegador (F12)

### **Si cargaste datos dummy**:
- [ ] Dashboard muestra datos de Enero 2026
- [ ] Review & Approve muestra Ceiba y Vega Baja (SUBMITTED)
- [ ] Puedes ver inventarios completos de Carolina y Gurabo
- [ ] Puedes ver inventarios parciales de Guaynabo y Humacao

---

## 🎯 SIGUIENTES PASOS

### **1. Habilitar módulos** (2 minutos)
```
Login como Super Admin (super@promix.com)
→ Settings → Módulos
→ Habilitar Silos, Aditivos, etc.
→ Verificar que aparecen en Dashboard
```

### **2. Probar flujo de aprobación** (si cargaste datos dummy) (5 minutos)
```
Login como Admin (admin@promix.com)
→ Review & Approve
→ Ver Ceiba (SUBMITTED)
→ Aprobar o Rechazar
→ Verificar cambio de estado
```

### **3. Empezar inventario nuevo** (10 minutos)
```
Login como Plant Manager
→ Dashboard
→ Click "Iniciar Inventario Febrero 2026"
→ Capturar datos de Agregados
→ Ver progreso en Dashboard
```

---

## 🆘 TROUBLESHOOTING

### **❌ Error: "permission denied for table"**
**Solución**: 
- Verificar que estás usando el usuario correcto
- Verificar que el usuario tiene permisos CREATE TABLE
- En Supabase Dashboard → SQL Editor, verificar conexión

### **❌ Error: "duplicate key value violates unique constraint"**
**Solución**: 
- Ya existen datos con esos IDs
- Ejecutar PASO 1 (limpieza) nuevamente
- O cambiar los IDs en el script de datos dummy

### **❌ Error: "foreign key constraint"**
**Solución**: 
- Las tablas no se crearon en el orden correcto
- Ejecutar PASO 2 (creación) nuevamente
- Verificar que TODAS las tablas se crearon

### **❌ La app no muestra datos después de cargar**
**Solución**: 
- Refrescar navegador con `Ctrl + F5`
- Cerrar y reabrir la aplicación
- Verificar consola del navegador (F12) para errores
- Verificar que el backend está conectado a la BD correcta

### **❌ "modules_config not found" en la app**
**Solución**: 
- Verificar que kv_store_02205af0 existe
- Ejecutar este query manual:
```sql
INSERT INTO kv_store_02205af0 (key, value)
VALUES (
  'modules_config',
  '{"agregados": {"enabled": true}}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

### **❌ No puedo acceder a Settings → Módulos**
**Solución**: 
- Solo Super Admin tiene acceso
- Login con `super@promix.com` / `password123`
- Verificar que el rol se asigna correctamente en el código

---

## 🧹 LIMPIAR TODO DE NUEVO (Si algo salió mal)

Si necesitas empezar de cero otra vez:

```sql
-- 1. Borrar datos (mantener estructura)
DELETE FROM petty_cash_entries_02205af0;
DELETE FROM utilities_entries_02205af0;
DELETE FROM products_entries_02205af0;
DELETE FROM diesel_entries_02205af0;
DELETE FROM additives_entries_02205af0;
DELETE FROM silos_entries_02205af0;
DELETE FROM aggregates_entries_02205af0;
DELETE FROM inventory_month_02205af0;

-- 2. Resetear configuración de módulos
UPDATE kv_store_02205af0 
SET value = '{"agregados": {"enabled": true}}'::jsonb
WHERE key = 'modules_config';

-- 3. O BORRAR TODO (volver al PASO 1)
-- Ejecutar 01_CLEANUP_ALL_TABLES.sql
```

---

## 📊 RESUMEN DE TIEMPO

| Paso | Tiempo | Crítico |
|------|--------|---------|
| Preparación | 1 min | ✅ |
| Limpieza (PASO 1-2) | 2 min | ✅ |
| Creación (PASO 3) | 2 min | ✅ |
| Datos Dummy (PASO 4) | 3 min | 🟡 Opcional |
| Verificación (PASO 5) | 2 min | ✅ |
| Probar en App (PASO 6) | 5 min | ✅ |
| **TOTAL** | **15 min** | |

**Total mínimo (sin datos dummy)**: ~10 minutos  
**Total recomendado (con datos dummy)**: ~15 minutos

---

## 🎉 ÉXITO

Si llegaste hasta aquí y todos los checks pasaron:

✅ **Base de datos inicializada desde cero**  
✅ **Estructura actualizada con todas las mejoras**  
✅ **Sistema de módulos configurado**  
✅ **Datos de prueba cargados** (si lo hiciste)  
✅ **Aplicación funcionando correctamente**  

**¡Listo para empezar a trabajar!** 🚀

---

## 📞 Soporte

Si tienes problemas:

1. **Revisar logs** en Supabase Dashboard → Logs
2. **Revisar consola** del navegador (F12)
3. **Verificar conexión** a base de datos
4. **Consultar documentación** en `/database/README.md`

---

**Fecha**: 2026-02-16  
**Sistema**: PROMIX Plant Inventory  
**Versión BD**: 2.0  
**Estado**: ✅ Listo para usar
