# 🚀 GUÍA DE DEPLOYMENT - PROMIX PLANT INVENTORY

## ⚠️ IMPORTANTE: El Edge Function se despliega AUTOMÁTICAMENTE en Figma Make

En Figma Make, el Edge Function ubicado en `/supabase/functions/server/index.tsx` se despliega **automáticamente** cada vez que publicas el sitio. No necesitas hacer nada manualmente.

---

## 📋 CHECKLIST PRE-DEPLOYMENT

### ✅ 1. Verificar que las credenciales de Supabase están configuradas

Las credenciales ya están en el archivo `/utils/supabase/info.tsx`:
- ✅ Project ID: `olieryxyhakumgyohlrr`
- ✅ Anon Key: Configurada

### ✅ 2. Crear las tablas en Supabase Dashboard

**CRÍTICO:** Las tablas NO se crean automáticamente. Debes ejecutar el SQL manualmente:

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto: `olieryxyhakumgyohlrr`
3. Click en **"SQL Editor"** → **"New Query"**
4. Copia TODO el contenido de `/supabase/schema.sql` (450 líneas)
5. Pégalo en el editor y haz click en **"Run"**
6. Verifica que las 17 tablas se crearon correctamente

### ✅ 3. Verificar las variables de entorno en el Edge Function

El Edge Function necesita estas variables de entorno (se configuran automáticamente en Figma Make):
- `SUPABASE_URL` → `https://olieryxyhakumgyohlrr.supabase.co`
- `SUPABASE_ANON_KEY` → (La key pública)
- `SUPABASE_SERVICE_ROLE_KEY` → **NECESITAS CONFIGURAR ESTO**

---

## 🔑 CONFIGURAR SERVICE ROLE KEY

El Edge Function necesita el **Service Role Key** para poder escribir en la base de datos.

### Obtener el Service Role Key:

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto: `olieryxyhakumgyohlrr`
3. Ve a **Settings** → **API**
4. En la sección **Project API keys**, busca:
   - **`service_role` secret** (NO la anon key)
5. Copia esta key

### Configurar en Figma Make:

El sistema ya tiene configurado el secreto `SUPABASE_SERVICE_ROLE_KEY` en el archivo `/utils/supabase/info.tsx`, pero **DEBES ASEGURARTE** de que esté en las variables de entorno del Edge Function.

---

## 🎯 PASOS PARA DESPLEGAR EN PRODUCCIÓN

### Paso 1: Ejecutar el SQL en Supabase Dashboard
```bash
# Ve a Supabase Dashboard → SQL Editor
# Ejecuta el contenido de /supabase/schema.sql
```

### Paso 2: Configurar Service Role Key
El sistema ya te solicitó este secreto previamente. Si no lo has configurado, el Edge Function no podrá escribir en la base de datos.

### Paso 3: Publicar el sitio
```bash
# En Figma Make, haz click en "Publish"
# El Edge Function se despliega automáticamente a:
# https://olieryxyhakumgyohlrr.supabase.co/functions/v1/make-server-02205af0
```

### Paso 4: Verificar el deployment
1. Ve a tu sitio publicado
2. Inicia sesión con: `super@promix.com` / `password123`
3. Ve a **Database Setup**
4. Haz click en **"Verificar & Cargar Datos"**
5. Si ves errores, revisa los logs en:
   - Figma Make → Console
   - Supabase Dashboard → Edge Functions → Logs

---

## 🔍 TROUBLESHOOTING

### Error: "Could not find the table 'public.xxx' in the schema cache"
**Solución:** Las tablas no existen. Ejecuta el SQL en Supabase Dashboard (Paso 1).

### Error: "Missing Supabase environment variables"
**Solución:** El Service Role Key no está configurado. Verifica que `SUPABASE_SERVICE_ROLE_KEY` esté en las variables de entorno.

### Error: "Authorization error"
**Solución:** La Service Role Key es incorrecta. Obtén la key correcta desde Supabase Dashboard → Settings → API.

### Error: "Network error"
**Solución:** El Edge Function no está desplegado o la URL es incorrecta. Verifica que el sitio esté publicado.

---

## 📊 VERIFICAR QUE TODO FUNCIONA

### Test 1: Health Check
```bash
curl https://olieryxyhakumgyohlrr.supabase.co/functions/v1/make-server-02205af0/health
# Debería retornar: {"status":"ok"}
```

### Test 2: Inicializar Base de Datos
1. Ve a Database Setup en el sitio publicado
2. Haz click en "Verificar & Cargar Datos"
3. Debería mostrar: "✅ Setup completo exitoso!"

### Test 3: Crear un Inventario
1. Login como gerente de planta
2. Selecciona una planta (ej: CAROLINA)
3. Crea un nuevo inventario
4. Verifica que se guarde en Supabase

---

## 🎉 PRODUCCIÓN LISTA

Una vez completados todos los pasos:

✅ Tablas creadas en Supabase
✅ Service Role Key configurada
✅ Edge Function desplegado automáticamente
✅ Sitio publicado y funcionando
✅ Configuraciones de 6 plantas cargadas

**URL del sitio publicado:**
- Frontend: Tu URL de Figma Make publicada
- Backend API: `https://olieryxyhakumgyohlrr.supabase.co/functions/v1/make-server-02205af0`

---

## 📝 NOTAS IMPORTANTES

1. **El Edge Function se redespliega automáticamente** cada vez que publicas en Figma Make
2. **Las tablas NO se recrean automáticamente** - solo necesitas ejecutar el SQL una vez
3. **Los datos persisten** en Supabase entre deployments
4. **El Service Role Key es sensible** - nunca lo expongas en el frontend
5. **Los inventarios se guardan en las tablas transaccionales** con estado IN_PROGRESS → SUBMITTED → APPROVED

---

## 🆘 SOPORTE

Si tienes problemas:
1. Revisa los logs en Supabase Dashboard → Edge Functions
2. Abre la consola del navegador (F12) para ver errores del frontend
3. Verifica que todas las credenciales sean correctas
4. Asegúrate de que las tablas existan en Supabase

**Recuerda:** El deployment es automático en Figma Make. Solo necesitas ejecutar el SQL una vez en Supabase Dashboard.
