# ⚡ INICIO RÁPIDO: Inicialización Completa de Supabase

## 🎯 En 3 Pasos (10-15 minutos)

---

## PASO 1: LIMPIEZA (2 min)

```
1. Ir a Supabase → SQL Editor → New query
2. Abrir: /database/01_CLEANUP_ALL_TABLES.sql
3. Copiar TODO y pegar
4. Run
```

**✅ Esperado**: `LIMPIEZA COMPLETADA`

---

## PASO 2: CREACIÓN (2 min)

```
1. Nueva query en Supabase
2. Abrir: /database/02_CREATE_ALL_TABLES.sql
3. Copiar TODO y pegar
4. Run
```

**✅ Esperado**: `9 tablas con ✅ Existe`

---

## PASO 3: DATOS (3 min) - OPCIONAL

```
1. Nueva query en Supabase
2. Abrir: /DUMMY_DATA_ENERO_2026.sql
3. Copiar TODO (560 líneas) y pegar
4. Run
```

**✅ Esperado**: `Success. No rows returned`

---

## VERIFICAR (1 min)

```
1. Nueva query en Supabase
2. Abrir: /VERIFICATION_SCRIPT.sql
3. Copiar TODO y pegar
4. Run
```

**✅ Esperado**:
```
inventory_month: 6
aggregates_entries: 20
silos_entries: 20
... etc
INTEGRIDAD: ✅ OK
```

---

## PROBAR EN APP (2 min)

```
1. Refrescar navegador (Ctrl+F5)
2. Login: admin@promix.com / password123
3. Dashboard debe mostrar datos de Enero 2026
4. Settings → Módulos debe funcionar
```

---

## ⚠️ MUY IMPORTANTE

- ❌ **NO ejecutar en PRODUCCIÓN** sin backup
- ✅ Solo para DESARROLLO/TESTING
- ⚠️ PASO 1 **BORRA TODOS LOS DATOS**

---

## 🆘 Si algo falla

Ver: `/database/INITIALIZATION_GUIDE.md` (guía completa)

---

## 📁 Archivos Clave

```
/database/
├── 01_CLEANUP_ALL_TABLES.sql     ← Borra todo
├── 02_CREATE_ALL_TABLES.sql      ← Crea tablas
└── INITIALIZATION_GUIDE.md       ← Guía completa

/
├── DUMMY_DATA_ENERO_2026.sql     ← Datos de prueba
└── VERIFICATION_SCRIPT.sql       ← Verificación
```

---

**¡Listo en 15 minutos!** 🚀
