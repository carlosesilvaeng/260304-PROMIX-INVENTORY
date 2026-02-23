# 🔧 SOLUCIÓN DE ERRORES: "Could not find column in schema cache"

## ❌ Problema
Ves errores como:
```
Error seeding aggregate PIEDRA #4: {
  code: "PGRST204",
  message: "Could not find the 'material_type' column in the schema cache"
}
```

## ✅ Causa
PostgREST (el API de Supabase) tiene un **cache del schema** desactualizado. 
Cuando agregas columnas con ALTER TABLE, PostgREST no las ve hasta recargar el cache.

---

## 🚀 SOLUCIÓN RÁPIDA (3 pasos)

### **PASO 1: Ejecutar Migración Completa**

1. Ve a **Supabase Dashboard** → **SQL Editor**
2. Haz clic en **"New Query"**
3. Abre el archivo: `/supabase/MEGA_MIGRATION_ALL_CONFIG_TABLES.sql`
4. Copia TODO el contenido
5. Pega en SQL Editor
6. Haz clic en **"Run"**
7. Verifica que aparezcan mensajes ✅ para cada columna

### **PASO 2: Recargar Cache de PostgREST**

1. En Supabase SQL Editor, crea otra **"New Query"**
2. Escribe:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```
3. Haz clic en **"Run"**

### **PASO 3: Volver a la App**

1. **Espera 10 segundos** (para que PostgREST recargue)
2. Ve a la aplicación → **Database Setup**
3. Haz clic en **"✓ Verificar & Cargar Datos"**
4. Deberías ver: **"✅ Setup completo exitoso!"**

---

## 📋 ¿Qué columnas agrega la migración?

### plant_aggregates_config:
- `material_type` (PIEDRA, ARENA)
- `location_area` (ÁREA 1, CAJÓN A)
- `measurement_method` (CONE, BOX)
- `box_width_ft`
- `box_height_ft`
- `sort_order`
- `is_active`

### plant_silos_config:
- `measurement_method`
- `calibration_curve_name`
- `sort_order`
- `is_active`

### plant_additives_config:
- `measurement_method`
- `calibration_curve_name`
- `sort_order`
- `is_active`

### plant_diesel_config:
- `measurement_method`
- `calibration_curve_name`
- `is_active`

### plant_products_config:
- `unit`
- `sort_order`
- `is_active`

### plant_utilities_meters_config:
- `meter_type`
- `sort_order`
- `is_active`

### plant_petty_cash_config:
- `monthly_amount`
- `is_active`

---

## 🆘 Si sigue fallando

1. Verifica que ejecutaste **TODO** el script de migración
2. Verifica que ejecutaste `NOTIFY pgrst, 'reload schema';`
3. **Espera 10-15 segundos** después del NOTIFY
4. Refresca la página de la app
5. Vuelve a intentar

---

## 📞 Contacto
Si el problema persiste, revisa los logs del servidor en:
- Supabase Dashboard → Edge Functions → Logs
