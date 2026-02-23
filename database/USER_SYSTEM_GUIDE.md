# 🚀 GUÍA RÁPIDA - Sistema de Usuarios con Supabase Auth

## 📋 Resumen

Se ha implementado un **sistema completo de autenticación** con Supabase Auth que reemplaza los usuarios mock del frontend.

---

## ✅ ¿Qué Cambió?

### **ANTES** (Mock Users)
- ❌ Usuarios hardcoded en `AuthContext.tsx`
- ❌ No persistentes en base de datos
- ❌ Sin seguridad real
- ❌ No escalable

### **AHORA** (Supabase Auth)
- ✅ Tabla `users_02205af0` en la base de datos
- ✅ Integración con Supabase Auth
- ✅ Tokens JWT seguros
- ✅ Gestión de usuarios desde UI (Super Admin)
- ✅ Contraseñas hasheadas
- ✅ Roles y permisos por planta

---

## 🗄️ Estructura de la Base de Datos

### **Tabla: `users_02205af0`**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | ID único del usuario |
| `name` | TEXT | Nombre completo |
| `email` | TEXT | Email (único) |
| `role` | TEXT | plant_manager \| admin \| super_admin |
| `assigned_plants` | TEXT[] | Array de IDs de plantas asignadas |
| `is_active` | BOOLEAN | Si el usuario puede hacer login |
| `auth_user_id` | UUID | ID en Supabase Auth (auth.users) |
| `last_login_at` | TIMESTAMPTZ | Último login |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | Última modificación |

---

## 🔐 Roles y Permisos

### **1. Plant Manager**
- ✅ Acceso solo a plantas asignadas
- ✅ Llenar inventarios
- ✅ Enviar para aprobación
- ❌ No puede aprobar
- ❌ No puede gestionar usuarios

### **2. Admin**
- ✅ Acceso a todas las plantas
- ✅ Aprobar/rechazar inventarios
- ✅ Ver reportes globales
- ❌ No puede gestionar usuarios

### **3. Super Admin**
- ✅ Acceso total al sistema
- ✅ Gestionar usuarios (crear/editar/eliminar)
- ✅ Configurar módulos
- ✅ Todas las funciones de Admin

---

## 📦 Archivos Creados

### **Backend** (`/supabase/functions/server/`)
- ✅ `auth.tsx` - Servicio de autenticación completo
- ✅ `index.tsx` - Endpoints de auth agregados

### **Base de Datos** (`/database/`)
- ✅ `04_CREATE_USERS_TABLE.sql` - Crear tabla users
- ✅ `05_INSERT_INITIAL_USERS.sql` - 3 usuarios iniciales

---

## 🚀 Pasos de Inicialización

### **Paso 1: Crear Tabla de Usuarios**

Ejecuta en Supabase SQL Editor:

```sql
-- Copiar y ejecutar el contenido completo de:
/database/04_CREATE_USERS_TABLE.sql
```

**Esperado**: Mensaje de éxito + verificación de columnas

---

### **Paso 2: Insertar Usuarios Iniciales**

```sql
-- Copiar y ejecutar el contenido completo de:
/database/05_INSERT_INITIAL_USERS.sql
```

**Esperado**: 3 usuarios insertados

---

### **Paso 3: Crear Usuarios en Supabase Auth**

⚠️ **IMPORTANTE**: Los usuarios deben existir en Supabase Auth para poder hacer login.

#### **Opción A: Automático (Recomendado)**

La aplicación creará automáticamente los usuarios en Supabase Auth cuando intenten hacer login por primera vez. Los usuarios iniciales tienen:

- **Email**: gerente@promixpr.com
- **Password temporal**: `promix2026`

- **Email**: rdelrosario@promixpr.com  
- **Password temporal**: `promix2026`

- **Email**: super@promix.com
- **Password temporal**: `promix2026`

#### **Opción B: Manual (Si Opción A falla)**

1. **Ir a Supabase Dashboard** → Authentication → Users
2. **Add User** → Manual
3. **Crear cada usuario**:
   ```
   Email: gerente@promixpr.com
   Password: promix2026
   Auto Confirm: ✅ Yes
   ```
4. **Repetir para los 3 usuarios**

---

### **Paso 4: Vincular Auth con Tabla**

Después de crear usuarios en Auth, necesitas vincular sus `auth_user_id`:

```sql
-- Obtener el auth_user_id de cada usuario desde Supabase Auth
-- Luego actualizar la tabla:

UPDATE users_02205af0 
SET auth_user_id = 'UUID_DEL_AUTH_USER'
WHERE email = 'gerente@promixpr.com';

-- Repetir para cada usuario
```

**⚠️ NOTA**: Este paso se hace automáticamente en el primer login si usas la Opción A.

---

## 🧪 Probar el Sistema

### **1. Login con Usuario Inicial**

1. **Abrir aplicación**
2. **Hacer logout** (si estás logueado con mock user)
3. **Refrescar**: `Ctrl + F5`
4. **Login**:
   - Email: `super@promix.com`
   - Password: `promix2026`

**✅ Esperado**: Login exitoso + redirección a selección de planta

---

### **2. Verificar Usuario en BD**

```sql
SELECT 
  name,
  email,
  role,
  assigned_plants,
  last_login_at
FROM users_02205af0
WHERE email = 'super@promix.com';
```

**✅ Esperado**: `last_login_at` debe tener timestamp reciente

---

### **3. Probar Roles**

#### **Plant Manager** (gerente@promixpr.com)
- ✅ Solo ve CAROLINA y CEIBA en selección de plantas
- ✅ Puede llenar inventarios
- ❌ No ve "Review & Approve"

#### **Admin** (rdelrosario@promixpr.com)
- ✅ Ve todas las 6 plantas
- ✅ Ve "Review & Approve"
- ✅ Puede aprobar inventarios
- ❌ No ve "User Management"

#### **Super Admin** (super@promix.com)
- ✅ Ve todas las 6 plantas
- ✅ Ve "Review & Approve"
- ✅ Ve "User Management" en sidebar
- ✅ Puede crear/editar/eliminar usuarios

---

## 🔧 Endpoints Disponibles

### **POST** `/make-server-02205af0/auth/login`
```json
{
  "email": "super@promix.com",
  "password": "promix2026"
}
```

**Response**:
```json
{
  "success": true,
  "user": { /* user object */ },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### **POST** `/make-server-02205af0/auth/signup`
```json
{
  "name": "Nuevo Usuario",
  "email": "nuevo@promixpr.com",
  "password": "password123",
  "role": "plant_manager",
  "assigned_plants": ["CAROLINA"],
  "created_by_id": "UUID_DEL_SUPER_ADMIN"
}
```

---

### **POST** `/make-server-02205af0/auth/verify`
```
Headers:
Authorization: Bearer <access_token>
```

---

### **GET** `/make-server-02205af0/auth/users`
```
Headers:
Authorization: Bearer <super_admin_token>
```

---

### **PUT** `/make-server-02205af0/auth/users/:userId`
```json
{
  "name": "Nombre Actualizado",
  "assigned_plants": ["CAROLINA", "CEIBA", "GURABO"]
}
```

---

### **DELETE** `/make-server-02205af0/auth/users/:userId`
```
Headers:
Authorization: Bearer <super_admin_token>
```

---

## 🐛 Solución de Problemas

### ❌ "Usuario no encontrado en la base de datos"

**Causa**: El usuario existe en Supabase Auth pero no en `users_02205af0`.

**Solución**:
```sql
SELECT * FROM users_02205af0 WHERE email = 'TU_EMAIL';
```
Si no aparece, ejecutar `05_INSERT_INITIAL_USERS.sql` again.

---

### ❌ "Credenciales inválidas"

**Causa**: La contraseña no coincide.

**Solución**: Resetear password en Supabase Dashboard → Authentication → Users → Edit User.

---

### ❌ "auth_user_id is null"

**Causa**: No se vinculó el usuario de Auth con la tabla.

**Solución**: El sistema lo hace automáticamente en el primer login, pero puedes forzarlo:

```sql
-- 1. Obtener auth_user_id desde Supabase Auth
-- 2. Actualizar manualmente:
UPDATE users_02205af0 
SET auth_user_id = 'UUID_FROM_AUTH'
WHERE email = 'EMAIL';
```

---

### ❌ "Usuario inactivo"

**Causa**: `is_active = false` en la tabla.

**Solución**:
```sql
UPDATE users_02205af0 
SET is_active = true
WHERE email = 'EMAIL';
```

---

## 📊 Verificación Final

Ejecuta este query para ver todos los usuarios:

```sql
SELECT 
  name,
  email,
  role,
  array_length(assigned_plants, 1) as num_plantas,
  is_active,
  CASE 
    WHEN auth_user_id IS NOT NULL THEN '✅ Vinculado'
    ELSE '❌ Sin vincular'
  END as auth_status,
  last_login_at
FROM users_02205af0
ORDER BY 
  CASE role
    WHEN 'super_admin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'plant_manager' THEN 3
  END;
```

**✅ Resultado esperado**:
```
name                  | email                      | role          | num_plantas | is_active | auth_status    | last_login_at
----------------------|----------------------------|---------------|-------------|-----------|----------------|---------------
SUPERUSER             | super@promix.com           | super_admin   | 6           | true      | ✅ Vinculado   | 2026-02-16...
Ricardo del Rosario   | rdelrosario@promixpr.com   | admin         | 6           | true      | ✅ Vinculado   | NULL
GERENTE PLANTA        | gerente@promixpr.com       | plant_manager | 2           | true      | ✅ Vinculado   | NULL
```

---

## ⏭️ Siguiente Paso

Una vez que el sistema de usuarios esté funcionando, el siguiente paso es:

1. **Actualizar AuthContext.tsx** para usar la API real en lugar de MOCK_USERS
2. **Crear página User Management** para Super Admin
3. **Actualizar Login.tsx** para usar endpoint real
4. **Migrar localStorage a sessionStorage** (más seguro)

---

## 💬 ¿Listo para Continuar?

Confirma que:
- ✅ Tabla `users_02205af0` creada
- ✅ 3 usuarios insertados
- ✅ Puedes hacer queries en Supabase

**Luego avísame y continuaré con la integración del frontend!** 🚀
