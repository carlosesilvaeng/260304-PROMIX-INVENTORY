# ⚡ QUICK START: Datos Dummy Enero 2026

## 🚀 En 3 Pasos

### **1. Cargar Datos** (2 minutos)

1. Ir a [Supabase Dashboard](https://supabase.com) → Tu Proyecto
2. Click **"SQL Editor"** (menú lateral)
3. Click **"New query"**
4. Copiar `/DUMMY_DATA_ENERO_2026.sql` completo
5. Pegar y click **"Run"**
6. ✅ Esperar: `Success. No rows returned`

### **2. Verificar** (1 minuto)

1. En mismo SQL Editor, **nueva query**
2. Copiar `/VERIFICATION_SCRIPT.sql`
3. Pegar y click **"Run"**
4. ✅ Ver: 6 inventarios, ~98 registros totales

### **3. Probar en App** (5 minutos)

1. **Refrescar navegador** (Ctrl+F5)
2. **Login**: `admin@promix.com` / `password123`
3. **Ir a**: Review & Approve
4. **Ver**: Ceiba y Vega Baja (SUBMITTED)
5. **Probar**: Aprobar Ceiba

---

## 📊 Qué Contiene

| Planta | Estado | Completitud |
|--------|--------|-------------|
| CAROLINA | ✅ APPROVED | 100% |
| CEIBA | 📤 SUBMITTED | 100% (listo para aprobar) |
| GUAYNABO | 🔄 IN_PROGRESS | 30% (parcial) |
| GURABO | ✅ APPROVED | 100% |
| VEGA BAJA | 📤 SUBMITTED | 100% (rechazado antes, re-enviado) |
| HUMACAO | 🔄 IN_PROGRESS | 10% (recién iniciado) |

**Total**: ~98 registros en 8 tablas • Enero 2026

---

## 🎯 Casos de Prueba Rápidos

### **Test 1: Aprobar Inventario** (2 min)
```
Login Admin → Review & Approve → Ceiba → Aprobar
✅ Estado cambia a APPROVED
```

### **Test 2: Rechazar Inventario** (2 min)
```
Login Admin → Review & Approve → Ceiba → Rechazar
✅ Escribir notas → Estado cambia a IN_PROGRESS
```

### **Test 3: Ver Rechazado** (1 min)
```
Login → Seleccionar Vega Baja → Ver inventario
✅ Ver historial: Rechazado 04/01, Re-enviado 05/01
```

### **Test 4: Completar Parcial** (5 min)
```
Login → Seleccionar Guaynabo → Dashboard
✅ Ver progreso 30% → Completar secciones → 100%
```

---

## 📁 Archivos Creados

| Archivo | Propósito |
|---------|-----------|
| **DUMMY_DATA_ENERO_2026.sql** | Script principal (560 líneas) |
| **VERIFICATION_SCRIPT.sql** | Queries de verificación |
| **DUMMY_DATA_GUIDE.md** | Guía detallada |
| **DUMMY_DATA_SUMMARY.md** | Resumen ejecutivo |
| **QUICKSTART.md** | Esta guía rápida |

---

## ⚠️ Importante

- ✅ Solo datos de **Enero 2026** (no afecta Febrero)
- ✅ Nombres de fotos son **ficticios**
- ✅ Si falla, verificar que tablas existen
- ✅ Para limpiar: Ver `DUMMY_DATA_GUIDE.md`

---

## 🆘 Troubleshooting

**Error: "table does not exist"**
→ Ejecutar primero `/MIGRATION-SCRIPT.sql`

**Error: "duplicate key value"**
→ Ya existen datos de Enero 2026, eliminarlos primero

**No veo datos en app**
→ Refrescar navegador (Ctrl+F5)

**No veo todas las secciones**
→ Habilitar módulos en Settings → Módulos (solo Super Admin)

---

## 📞 Más Info

- **Guía Completa**: `DUMMY_DATA_GUIDE.md`
- **Resumen**: `DUMMY_DATA_SUMMARY.md`
- **Sistema Módulos**: `MODULE-MANAGEMENT-SYSTEM.md`

---

**Listo!** En 3 minutos tienes datos de prueba completos 🎉
