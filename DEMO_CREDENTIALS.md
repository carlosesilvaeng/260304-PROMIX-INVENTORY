# 🔐 PROMIX Plant Inventory - Demo Credentials

## Credenciales de Demostración / Demo Credentials

Esta aplicación utiliza autenticación simulada con validación de contraseñas. A continuación se encuentran las credenciales de acceso para diferentes roles.

---

## 👥 Usuarios de Demostración

### 1. 👨‍💼 Gerente de Planta / Plant Manager

**Nombre:** Carlos Rodríguez  
**Email:** `carlos@promix.com`  
**Contraseña:** `password123`  
**Rol:** Gerente de Planta  
**Plantas Asignadas:** CAROLINA, CEIBA

**Permisos:**
- ✅ Realizar inventarios en plantas asignadas
- ✅ Ver reportes de plantas asignadas
- ✅ Configurar cajones en plantas asignadas
- ❌ Aprobar inventarios
- ❌ Crear o modificar plantas
- ❌ Ver todas las plantas

---

### 2. 👩‍💼 Administrador / Admin

**Nombre:** Ana García  
**Email:** `ana@promix.com`  
**Contraseña:** `password123`  
**Rol:** Administrador  
**Plantas Asignadas:** Todas (6 plantas)

**Permisos:**
- ✅ Realizar inventarios en todas las plantas
- ✅ Aprobar inventarios
- ✅ Ver reportes de todas las plantas
- ✅ Configurar cajones en todas las plantas
- ✅ Exportar reportes (PDF, Excel)
- ❌ Crear o modificar plantas
- ❌ Gestionar usuarios

---

### 3. 👨‍💻 Super Administrador / Super Admin

**Nombre:** Juan Pérez  
**Email:** `super@promix.com`  
**Contraseña:** `password123`  
**Rol:** Super Administrador  
**Plantas Asignadas:** Todas (acceso total)

**Permisos:**
- ✅ Realizar inventarios en todas las plantas
- ✅ Aprobar inventarios
- ✅ Ver reportes de todas las plantas
- ✅ Crear nuevas plantas
- ✅ Modificar configuración de plantas
- ✅ Activar/Desactivar plantas
- ✅ Configurar silos y cajones
- ✅ Gestionar configuración del sistema
- ✅ Exportar reportes (PDF, Excel)

---

## 🏭 Plantas PROMIX Disponibles

| ID | Nombre | Código | Ubicación | Silos | Petty Cash |
|----|--------|--------|-----------|-------|------------|
| 1  | CAROLINA | CAR-001 | Carolina, PR | 3 (2 Cemento, 1 Slag) | $1,000 |
| 2  | CEIBA | CEI-002 | Ceiba, PR | 2 (2 Cemento) | $1,000 |
| 3  | GUAYNABO | GUA-003 | Guaynabo, PR | 3 (2 Cemento, 1 Slag) | $2,000 |
| 4  | GURABO | GUR-004 | Gurabo, PR | 2 (2 Cemento) | $1,000 |
| 5  | VEGA BAJA | VEB-005 | Vega Baja, PR | 3 (2 Cemento, 1 Slag) | $1,000 |
| 6  | HUMACAO | HUM-006 | Humacao, PR | 2 (2 Cemento) | $1,000 |

---

## 🔒 Seguridad

### Almacenamiento de Contraseñas

- Las contraseñas están definidas en el código fuente (`/src/app/contexts/AuthContext.tsx`)
- **NO se guardan contraseñas en `localStorage`** por seguridad
- Solo se almacena la información del usuario (sin contraseña) en el navegador
- La validación se realiza comparando email + contraseña

### Flujo de Autenticación

```
1. Usuario ingresa email y contraseña
   ↓
2. Sistema busca coincidencia en MOCK_USERS
   ↓
3. Si coincide: Login exitoso
   └─> Guarda usuario (sin password) en localStorage
   
4. Si no coincide: Error "Credenciales inválidas"
```

---

## 🛠️ Código de Referencia

**Archivo:** `/src/app/contexts/AuthContext.tsx`

**Usuarios Mock (líneas 54-76):**
```typescript
const MOCK_USERS: User[] = [
  { 
    id: '1', 
    name: 'Carlos Rodríguez', 
    email: 'carlos@promix.com', 
    password: 'password123',
    role: 'plant_manager',
    assignedPlants: ['1', '2']
  },
  { 
    id: '2', 
    name: 'Ana García', 
    email: 'ana@promix.com', 
    password: 'password123',
    role: 'admin',
    assignedPlants: ['1', '2', '3', '4', '5', '6']
  },
  { 
    id: '3', 
    name: 'Juan Pérez', 
    email: 'super@promix.com', 
    password: 'password123',
    role: 'super_admin'
  },
];
```

**Función Login (líneas ~185-195):**
```typescript
const login = async (email: string, password: string) => {
  // Validar email y contraseña
  const foundUser = MOCK_USERS.find(u => u.email === email && u.password === password);
  if (!foundUser) {
    throw new Error('Credenciales inválidas');
  }
  
  // No guardar la contraseña en localStorage
  const { password: _, ...userWithoutPassword } = foundUser;
  setUser(foundUser);
  localStorage.setItem('promix_user', JSON.stringify(userWithoutPassword));
};
```

---

## 📱 Características por Rol

### Gerente de Planta
- Dashboard con progreso de inventario
- 7 secciones de inventario (Agregados, Silos, Aditivos, Diesel, Aceites, Utilidades, Petty Cash)
- Captura de fotos con evidencia
- Timestamps automáticos (inicio/fin)
- Cálculos automáticos de volúmenes
- Configuración de cajones personalizados

### Administrador
- Todo lo del Gerente de Planta +
- Aprobar inventarios completados
- Ver reportes históricos de todas las plantas
- Filtros avanzados por mes/año
- Exportación a PDF/Excel
- Trazabilidad completa (quién diligencia, quién aprueba)

### Super Administrador
- Todo lo del Administrador +
- Crear nuevas plantas
- Configurar silos por planta
- Activar/Desactivar plantas
- Modificar montos de Petty Cash
- Configurar métodos de medición (Cono/Cajón)
- Gestión completa del sistema

---

## 🌐 Idiomas Disponibles

- 🇪🇸 **Español** (Predeterminado)
- 🇺🇸 **English**

Selector de idioma disponible en:
- Login
- Selección de Planta
- Dashboard
- Todas las páginas del sistema

---

## ⚙️ Cambiar Contraseñas

Para cambiar las contraseñas de demostración, edita el archivo:

`/src/app/contexts/AuthContext.tsx`

Busca el array `MOCK_USERS` y modifica el campo `password`:

```typescript
{ 
  id: '1', 
  name: 'Carlos Rodríguez', 
  email: 'carlos@promix.com', 
  password: 'TU_NUEVA_CONTRASEÑA', // ← Modificar aquí
  role: 'plant_manager',
  assignedPlants: ['1', '2']
}
```

---

## 📞 Soporte

Para preguntas sobre credenciales o acceso, contactar al administrador del sistema.

**Versión:** 2.0  
**Última actualización:** Febrero 2026
