# 📊 GUÍA RÁPIDA: CARGAR DATOS DUMMY ENERO 2026

## 🎯 Objetivo

Este script genera datos de prueba completos para **ENERO 2026** en todas las plantas PROMIX, simulando un mes de inventario ya completado. Esto permite probar todas las funcionalidades del sistema con datos realistas.

---

## 🚀 Cómo Ejecutar el Script

### **Opción 1: Desde Supabase Dashboard (Recomendado)**

1. **Ir a Supabase Dashboard**
   - Abrir [supabase.com](https://supabase.com)
   - Seleccionar tu proyecto PROMIX

2. **Abrir SQL Editor**
   - En el menú lateral, click en **"SQL Editor"**
   - Click en **"New query"**

3. **Copiar el Script**
   - Abrir el archivo `/DUMMY_DATA_ENERO_2026.sql`
   - Copiar **TODO** el contenido

4. **Pegar y Ejecutar**
   - Pegar el script en el editor
   - Click en **"Run"** (esquina inferior derecha)
   - Esperar confirmación (debería tardar 5-10 segundos)

5. **Verificar Éxito**
   - Si todo sale bien, verás: `Success. No rows returned`
   - Si hay error, revisar el mensaje y corregir

### **Opción 2: Desde tu Backend Local** (Opcional)

Si tienes acceso directo a la base de datos:

```bash
psql -h [SUPABASE_HOST] -U postgres -d postgres -f DUMMY_DATA_ENERO_2026.sql
```

---

## 📦 Qué Genera el Script

### **6 Plantas con Inventarios de Enero 2026**

| Planta | Estado | Completitud | Escenario |
|--------|--------|-------------|-----------|
| **CAROLINA** | ✅ APPROVED | 100% | Aprobado por María González |
| **CEIBA** | 📤 SUBMITTED | 100% | Esperando aprobación |
| **GUAYNABO** | 🔄 IN_PROGRESS | ~30% | Ana trabajando |
| **GURABO** | ✅ APPROVED | 100% | Aprobado por Roberto Díaz |
| **VEGA BAJA** | 📤 SUBMITTED | 100% | Re-enviado tras rechazo |
| **HUMACAO** | 🔄 IN_PROGRESS | ~10% | Recién iniciado |

### **Datos Generados por Tabla**

#### **1. inventory_month_02205af0** (6 registros)
- ✅ 2 inventarios APPROVED (Carolina, Gurabo)
- ✅ 2 inventarios SUBMITTED (Ceiba, Vega Baja)
- ✅ 2 inventarios IN_PROGRESS (Guaynabo, Humacao)

#### **2. aggregates_entries_02205af0** (~20 registros)
- ✅ Arena Manufacturada, Piedra #8, Piedra #67, Arena Natural
- ✅ Cantidades realistas (300-960 toneladas)
- ✅ Precios por tonelada ($16-24)
- ✅ Fotos de evidencia simuladas
- ✅ Notas descriptivas

#### **3. silos_entries_02205af0** (~20 registros)
- ✅ Silos con nombres específicos por planta
- ✅ Tipos de cemento: Tipo I, II, III
- ✅ Cantidades 118-172 toneladas
- ✅ Precios según tipo ($125-132)

#### **4. additives_entries_02205af0** (~18 registros)
- ✅ Plastificante, Retardante, Acelerante, Reductor de Agua
- ✅ Cantidades en galones (150-580)
- ✅ Precios por galón ($8.75-18.00)

#### **5. diesel_entries_02205af0** (4 registros)
- ✅ Lecturas inicial y final de medidor
- ✅ Consumo calculado (3,640-4,925 galones)
- ✅ Recibos de compra
- ✅ Precio por galón ($3.45)
- ✅ Cálculos de discrepancia automáticos

#### **6. products_entries_02205af0** (~22 registros)
- ✅ Concreto 3000, 4000, 5000 PSI
- ✅ Bloques 6" y 8"
- ✅ Adoquines
- ✅ Cantidades realistas
- ✅ Precios unitarios

#### **7. utilities_entries_02205af0** (~10 registros)
- ✅ Agua: Lecturas de medidores, consumo en m³
- ✅ Electricidad: Lecturas de medidores, consumo en kWh
- ✅ Precios por unidad
- ✅ Cálculos automáticos

#### **8. petty_cash_entries_02205af0** (4 registros)
- ✅ Balance inicial según configuración de planta
- ✅ Recibos totales
- ✅ Gastos totales
- ✅ Balance final
- ✅ Discrepancias realistas (-$29 a +$24)

---

## 🎭 Escenarios de Prueba Cubiertos

### **Escenario 1: Flujo Completo Aprobado (Carolina, Gurabo)**
```
Inicio → Captura → Envío → Aprobación ✅
```
- Todos los módulos completos
- Trazabilidad completa
- Aprobado por Admin/Super Admin
- Histórico disponible

### **Escenario 2: Esperando Aprobación (Ceiba)**
```
Inicio → Captura → Envío 📤 → [Esperando Admin]
```
- Inventario completo
- En Review & Approve
- Listo para aprobar o rechazar

### **Escenario 3: Rechazo y Re-envío (Vega Baja)**
```
Inicio → Captura → Envío → Rechazo ❌ → Corrección → Re-envío 📤
```
- Fue rechazado el 04/01 por falta de Utilities
- Completado el 05/01 y re-enviado
- Historial de rechazo visible
- Notas de rechazo: "Falta completar lecturas de Utilities"

### **Escenario 4: Trabajo en Progreso - Medio (Guaynabo)**
```
Inicio → [Capturando...] 🔄
```
- Agregados: 2/4 items
- Silos: 2/3 items
- Aditivos: 1/4 items
- Resto: 0% completado
- Progreso ~30%

### **Escenario 5: Recién Iniciado (Humacao)**
```
Inicio → [Apenas comenzando...] 🔄
```
- Solo 1 entrada de Agregados
- Resto sin datos
- Progreso ~10%

---

## 🔍 Verificación Post-Ejecución

### **Consultas SQL para Verificar**

```sql
-- Ver todos los inventarios de Enero 2026
SELECT plant_name, status, started_by, submitted_at, approved_at 
FROM inventory_month_02205af0 
WHERE year = 2026 AND month = 'Enero'
ORDER BY plant_name;

-- Contar entradas por tabla
SELECT 
  (SELECT COUNT(*) FROM aggregates_entries_02205af0) as aggregates,
  (SELECT COUNT(*) FROM silos_entries_02205af0) as silos,
  (SELECT COUNT(*) FROM additives_entries_02205af0) as additives,
  (SELECT COUNT(*) FROM diesel_entries_02205af0) as diesel,
  (SELECT COUNT(*) FROM products_entries_02205af0) as products,
  (SELECT COUNT(*) FROM utilities_entries_02205af0) as utilities,
  (SELECT COUNT(*) FROM petty_cash_entries_02205af0) as petty_cash;

-- Ver datos de Carolina (completo)
SELECT * FROM aggregates_entries_02205af0 
WHERE inventory_month_id = 'inv_carolina_jan_2026';

-- Ver caso de rechazo (Vega Baja)
SELECT status, rejected_by, rejected_at, rejection_notes, submitted_at
FROM inventory_month_02205af0 
WHERE plant_id = 'vegabaja';
```

### **Desde la Aplicación**

1. **Login como Plant Manager**
   - Seleccionar cualquier planta
   - Ver Dashboard con datos de Enero 2026

2. **Login como Admin/Super Admin**
   - Ir a **Review & Approve**
   - Ver inventarios de Ceiba y Vega Baja (SUBMITTED)
   - Probar aprobar/rechazar

3. **Verificar Histórico**
   - Ir a **Reportes** o **Histórico**
   - Ver inventarios de Enero 2026
   - Carolina y Gurabo deben aparecer como APPROVED

---

## 📊 Totales Generados

| Tabla | Total Registros | Descripción |
|-------|-----------------|-------------|
| **inventory_month** | 6 | Uno por planta |
| **aggregates_entries** | ~20 | 3-4 por inventario completo |
| **silos_entries** | ~20 | 3-5 según planta |
| **additives_entries** | ~18 | 3-5 productos |
| **diesel_entries** | 4 | Solo plantas completas |
| **products_entries** | ~22 | 3-6 productos |
| **utilities_entries** | ~10 | Agua + Electricidad |
| **petty_cash_entries** | 4 | Solo plantas completas |
| **TOTAL** | **~98 registros** | Datos realistas |

---

## ⚠️ Notas Importantes

### **Antes de Ejecutar**

1. ✅ **Verificar tablas existen**
   - El script asume que las tablas ya fueron creadas
   - Si hay error, ejecutar primero `/MIGRATION-SCRIPT.sql`

2. ✅ **IDs únicos**
   - Los `inventory_month_id` son únicos y específicos
   - Si ya existen datos de Enero 2026, el script fallará
   - Solución: Borrar datos existentes o modificar IDs

3. ✅ **Fotos simuladas**
   - Los nombres de fotos son ficticios
   - En producción, serían URLs reales de Supabase Storage

### **Después de Ejecutar**

1. ✅ **Refrescar navegador**
   - Ctrl+F5 para forzar recarga
   - O cerrar/abrir sesión

2. ✅ **Verificar ModulesContext**
   - Si algunos módulos están deshabilitados, no verás sus secciones
   - Habilitar todos los módulos desde Settings → Módulos

3. ✅ **Probar flujos completos**
   - Aprobar inventarios SUBMITTED
   - Completar inventarios IN_PROGRESS
   - Generar reportes de inventarios APPROVED

---

## 🧪 Casos de Prueba Sugeridos

### **Test 1: Review & Approve**
```
1. Login como Admin (admin@promix.com / password123)
2. Ir a Review & Approve
3. Ver inventarios de Ceiba (completo) y Vega Baja (re-enviado)
4. Probar aprobar Ceiba
5. Verificar que cambia a APPROVED
```

### **Test 2: Completar Inventario Parcial**
```
1. Login como Plant Manager de Guaynabo
2. Ver Dashboard con progreso ~30%
3. Completar Diesel, Products, Utilities, Petty Cash
4. Enviar a aprobación
5. Login como Admin y aprobar
```

### **Test 3: Histórico y Reportes**
```
1. Login como cualquier usuario
2. Ir a Reportes/Histórico
3. Filtrar por Enero 2026
4. Ver inventarios aprobados (Carolina, Gurabo)
5. Generar reporte PDF/Excel
```

### **Test 4: Trazabilidad**
```
1. Ver inventario de Vega Baja
2. Verificar que muestra:
   - Iniciado por: Sofía Ramírez (02/01)
   - Rechazado por: María González (04/01)
   - Razón: "Falta completar lecturas de Utilities"
   - Re-enviado: 05/01 (Utilities completado)
```

---

## 🎉 Beneficios

✅ **Testing Inmediato**: Sin esperar a crear datos manualmente  
✅ **Cobertura Completa**: Todos los escenarios cubiertos  
✅ **Datos Realistas**: Cantidades y precios reales  
✅ **Trazabilidad**: Historial completo de cambios  
✅ **Múltiples Estados**: APPROVED, SUBMITTED, IN_PROGRESS  
✅ **Casos Edge**: Rechazos, discrepancias, incompletos  
✅ **Demo-Ready**: Listo para mostrar a stakeholders  

---

## 🔄 Limpiar Datos (Opcional)

Si necesitas eliminar los datos dummy y empezar de cero:

```sql
-- CUIDADO: Esto borra TODOS los datos de Enero 2026
DELETE FROM petty_cash_entries_02205af0 
WHERE inventory_month_id LIKE 'inv_%_jan_2026';

DELETE FROM utilities_entries_02205af0 
WHERE inventory_month_id LIKE 'inv_%_jan_2026';

DELETE FROM products_entries_02205af0 
WHERE inventory_month_id LIKE 'inv_%_jan_2026';

DELETE FROM diesel_entries_02205af0 
WHERE inventory_month_id LIKE 'inv_%_jan_2026';

DELETE FROM additives_entries_02205af0 
WHERE inventory_month_id LIKE 'inv_%_jan_2026';

DELETE FROM silos_entries_02205af0 
WHERE inventory_month_id LIKE 'inv_%_jan_2026';

DELETE FROM aggregates_entries_02205af0 
WHERE inventory_month_id LIKE 'inv_%_jan_2026';

DELETE FROM inventory_month_02205af0 
WHERE month = 'Enero' AND year = 2026;
```

---

**Fecha**: 2026-02-16  
**Sistema**: PROMIX Plant Inventory  
**Datos**: Enero 2026 (mes pasado)  
**Estado**: ✅ Listo para cargar
