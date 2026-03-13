# Plan Tecnico: Rol Gerente de Operaciones

## Objetivo

Agregar un nuevo rol de usuario llamado `operations_manager` para representar al "Gerente de Operaciones".

Este rol debe comportarse como un `plant_manager` con estas diferencias:

- Puede entrar a cualquier planta activa.
- Puede ver informacion de cualquier planta.
- Puede llenar y enviar inventarios desde cualquier planta.
- Puede ver reportes de todas las plantas.
- Puede entrar a Configuracion solo para gestionar usuarios `plant_manager`.
- Puede crear usuarios `plant_manager`.
- Puede editar, resetear contrasenas e inactivar usuarios `plant_manager` existentes.

Este rol no debe:

- Aprobar o rechazar inventarios.
- Crear, editar o eliminar usuarios `admin`.
- Crear, editar o eliminar usuarios `super_admin`.
- Crear, editar o eliminar usuarios `operations_manager`.
- Administrar configuraciones de planta, catalogos, modulos o herramientas tecnicas.

## Decision de diseno

La implementacion es factible ahora, pero no debe hacerse como un "if" aislado.

El sistema actual esta acoplado a roles fijos en base de datos, backend y frontend:

- `users.role` solo permite `plant_manager`, `admin`, `super_admin`.
- La Edge Function `make-server` concentra la seguridad real usando `service_role`.
- El frontend usa multiples comparaciones duras por rol.

Por eso el cambio correcto es:

1. Agregar el nuevo rol al schema y tipos.
2. Introducir helpers de permisos en backend.
3. Reemplazar validaciones duras por capacidades.
4. Ajustar el frontend para mostrar solo lo que corresponde al nuevo rol.

## Permisos exactos

### Matriz resumida

| Capacidad | plant_manager | operations_manager | admin | super_admin |
| --- | --- | --- | --- | --- |
| Ver plantas asignadas | Si | Si | Si | Si |
| Ver todas las plantas activas | No | Si | Si | Si |
| Seleccionar cualquier planta | No | Si | Si | Si |
| Llenar inventario | Si | Si | No | No |
| Enviar inventario a aprobacion | Si | Si | No | No |
| Aprobar / rechazar inventario | No | No | Si | Si |
| Ver reportes de todas las plantas | No | Si | Si | Si |
| Ver reporte de fotos global | No | No por defecto | Si | Si |
| Ver auditoria | No por defecto | No por defecto | Si | Si |
| Gestionar usuarios | No | Solo `plant_manager` | Amplio | Total |
| Configurar plantas | No | No | Si | Si |
| Configurar modulos | No | No | No | Si |
| Herramientas tecnicas | No | No | No | Si |

### Regla recomendada para usuarios

El `operations_manager` puede operar solo sobre usuarios cuyo `role = 'plant_manager'`.

Operaciones permitidas:

- Crear `plant_manager`
- Editar `plant_manager`
- Resetear contrasena de `plant_manager`
- Inactivar / activar `plant_manager`
- Ver listado de `plant_manager`

Operaciones prohibidas:

- Crear `operations_manager`
- Editar `operations_manager`
- Resetear contrasena de `operations_manager`
- Inactivar / activar `operations_manager`
- Eliminar usuarios
- Gestionar `admin`
- Gestionar `super_admin`

## Alcance exacto

### Backend

#### 1. Schema y tipos

Actualizar:

- `supabase/schema.sql`
- `supabase/schema_complete.sql`
- migracion nueva en `supabase/migrations/`
- `supabase/functions/make-server/auth.tsx`

Cambios:

- Expandir el `CHECK` de `users.role` para incluir `operations_manager`.
- Expandir los tipos TypeScript de `User`, `SignupData` y formularios relacionados.

#### 2. Helpers de permisos

Crear helpers centralizados en `supabase/functions/make-server/index.ts` o moverlos a un modulo utilitario:

- `isPlantManagerLike(user)`
- `canAccessAllPlants(user)`
- `canManagePlantManagers(user)`
- `canApproveInventory(user)`
- `canManagePlantConfiguration(user)`
- `canUseTechnicalTools(user)`

Reglas sugeridas:

- `isPlantManagerLike`: `plant_manager` y `operations_manager`
- `canAccessAllPlants`: `operations_manager`, `admin`, `super_admin`
- `canManagePlantManagers`: `operations_manager`, `admin`, `super_admin`
- `canApproveInventory`: `admin`, `super_admin`
- `canManagePlantConfiguration`: `admin`, `super_admin`
- `canUseTechnicalTools`: `super_admin`

#### 3. Acceso a plantas

Actualizar:

- `checkPlantAccess(...)`
- `GET /make-server/plants`
- `GET /make-server/plants/:plantId/config`

Regla:

- `operations_manager` debe ver cualquier planta activa.
- `plant_manager` sigue limitado por `assigned_plants`.

#### 4. Inventario

Actualizar:

- `POST /make-server/inventory/save-draft`
- `POST /make-server/inventory/submit`

Regla:

- `operations_manager` puede guardar borrador y enviar inventario igual que `plant_manager`.

No cambiar:

- `POST /make-server/inventory/approve`
- `POST /make-server/inventory/reject`

Esos endpoints deben seguir reservados a `admin` y `super_admin`.

#### 5. Reportes

Actualizar:

- `GET /make-server/reports`

Regla:

- `operations_manager` ve reportes de todas las plantas.
- `plant_manager` sigue restringido a `assigned_plants`.

Decidir explicitamente:

- `GET /make-server/photos/report`: recomiendo dejarlo solo para `admin` y `super_admin` en esta primera version.
- `GET /make-server/audit/*`: recomiendo dejarlo solo para `admin` y `super_admin`.

#### 6. Gestion de usuarios

Actualizar:

- `POST /make-server/auth/signup`
- `GET /make-server/auth/users`
- `PUT /make-server/auth/users/:userId`
- `POST /make-server/auth/users/:userId/reset-password`
- funciones auxiliares en `supabase/functions/make-server/auth.tsx`

Regla:

- `operations_manager` puede gestionar solo usuarios `plant_manager`.
- `admin` mantiene gestion amplia segun la logica actual.
- `super_admin` mantiene control total.

Validaciones minimas necesarias:

- Si quien ejecuta es `operations_manager`, el `role` objetivo debe ser `plant_manager`.
- Si quien ejecuta es `operations_manager`, en `signup` el `role` solicitado debe ser `plant_manager`.
- Si quien ejecuta es `operations_manager`, no puede cambiar el rol de un usuario a otro valor.
- Si quien ejecuta es `operations_manager`, no puede tocar usuarios `admin`, `super_admin` ni `operations_manager`.
- Si quien ejecuta es `operations_manager`, no puede eliminar usuarios.

#### 7. Auditoria

Registrar acciones nuevas o mantener las actuales, pero asegurando que queden trazables:

- creacion de `plant_manager`
- actualizacion de `plant_manager`
- reseteo de contrasena
- activacion / inactivacion

### Frontend

#### 1. Tipos y normalizacion

Actualizar:

- `src/app/contexts/AuthContext.tsx`
- cualquier interfaz local de usuario en pantallas de settings/auditoria

Cambios:

- Agregar `operations_manager` al tipo union.
- Ajustar `normalizeUser` para no degradar este rol a `plant_manager`.

#### 2. Seleccion de planta y acceso global

Actualizar:

- `src/app/App.tsx`
- `src/app/pages/PlantSelection.tsx`
- `src/app/components/TopBar.tsx`

Regla:

- `operations_manager` debe poder entrar sin planta seleccionada y luego escoger cualquier planta activa.
- Debe aparecer como acceso global, igual que `admin`, pero sin privilegios administrativos amplios.

#### 3. Inventario y dashboard

Actualizar:

- `src/app/components/Sidebar.tsx`
- `src/app/pages/Dashboard.tsx`
- `src/app/pages/Reports.tsx`
- `src/app/pages/sections/ReviewAndApproveSection.tsx`

Regla:

- `operations_manager` debe ver menu de inventario.
- Debe poder reanudar inventarios `IN_PROGRESS`.
- Debe poder enviar inventarios a aprobacion.
- No debe ver botones de aprobar / rechazar.

#### 4. Configuracion

Actualizar:

- `src/app/pages/Settings.tsx`
- `src/app/pages/settings/UserManagement.tsx`

Regla:

- `operations_manager` puede entrar a Settings, pero solo a la pestaña de usuarios.
- No debe poder manejar plantas, catalogos, modulos, unidades ni herramientas.
- No debe ver accion de eliminar usuario.

#### 5. UserManagement

Cambios UI:

- Incluir el nuevo rol en etiquetas visibles.
- Permitir que `operations_manager` abra el panel.
- En el modal de crear, si el usuario actual es `operations_manager`, el selector de rol debe estar fijo en `plant_manager`.
- En listados, ocultar o deshabilitar acciones sobre roles no permitidos.

#### 6. Textos e idiomas

Actualizar:

- `src/app/contexts/LanguageContext.tsx`

Agregar:

- `role.operationsManager` en espanol e ingles.

## Lista preliminar de archivos a tocar

### Backend

- `supabase/schema.sql`
- `supabase/schema_complete.sql`
- `supabase/migrations/<nueva_migracion>_add_operations_manager_role.sql`
- `supabase/functions/make-server/auth.tsx`
- `supabase/functions/make-server/index.ts`

### Frontend

- `src/app/contexts/AuthContext.tsx`
- `src/app/contexts/LanguageContext.tsx`
- `src/app/App.tsx`
- `src/app/components/Sidebar.tsx`
- `src/app/components/TopBar.tsx`
- `src/app/pages/PlantSelection.tsx`
- `src/app/pages/Dashboard.tsx`
- `src/app/pages/Reports.tsx`
- `src/app/pages/Settings.tsx`
- `src/app/pages/settings/UserManagement.tsx`
- `src/app/pages/settings/AuditPanel.tsx`
- `src/app/pages/sections/ReviewAndApproveSection.tsx`

## Riesgos

### Riesgo alto

- Dar acceso de mas en backend. Como la app usa Edge Functions con `service_role`, un error de permiso en backend expone datos reales aunque el frontend los esconda.

### Riesgo medio

- Inconsistencias entre UI y backend. Ejemplo: permitir abrir una pantalla pero recibir `403`.
- Que `normalizeUser` convierta `operations_manager` en `plant_manager` y se pierda el acceso global.
- Dejar comparaciones duras por rol sin actualizar y romper flujos parciales.

### Riesgo bajo

- Etiquetas de rol incompletas en tablas, top bar, dashboard y auditoria.

## Decisiones recomendadas para esta primera entrega

Para bajar riesgo y sacar valor rapido:

- Si: acceso global a plantas, inventario y reportes.
- Si: gestion limitada de `plant_manager`.
- No por ahora: reporte de fotos global.
- No por ahora: auditoria.
- No por ahora: configuracion de plantas o catalogos.
- No por ahora: permisos granulares por tabla o por accion configurables desde UI.

## Estrategia de implementacion

### Fase 1

- Schema y tipos
- Helpers de permisos backend
- Acceso global a plantas
- Inventario tipo gerente
- Reportes globales

### Fase 2

- UserManagement limitado a `plant_manager`
- Ajustes de Settings
- Ajustes de etiquetas y traducciones

### Fase 3

- QA manual completo
- Deploy de `make-server`
- Verificacion post deploy

## QA minimo requerido

### Casos felices

- Login con `operations_manager`
- Ver todas las plantas activas
- Cambiar entre plantas
- Iniciar inventario en cualquier planta
- Guardar borrador
- Enviar a aprobacion
- Ver reportes de todas las plantas
- Crear un `plant_manager`
- Editar un `plant_manager`
- Resetear contrasena de un `plant_manager`
- Inactivar y reactivar un `plant_manager`

### Casos de seguridad

- Intentar crear `admin` como `operations_manager` y confirmar `403`
- Intentar editar `admin` como `operations_manager` y confirmar `403`
- Intentar resetear contrasena de `admin` y confirmar `403`
- Intentar eliminar un usuario como `operations_manager` y confirmar `403` o ausencia de boton
- Intentar aprobar inventario como `operations_manager` y confirmar `403`
- Intentar entrar a configuracion de plantas y confirmar que no haya acceso
- Intentar usar herramientas de `super_admin` y confirmar que no aparezcan

## Deploy y verificacion

Si esta implementacion toca `make-server`, al final del trabajo se debe hacer:

```bash
npm run deploy:make-server
```

Luego:

```bash
npm run check:make-server
```

Y confirmar que el despliegue reporta:

```json
"verify_jwt": false
```

## Estimado

Implementacion completa con QA manual:

- 1 a 2 dias de trabajo

Si se hace en modo rapido:

- medio dia a 1 dia
- con mas riesgo de huecos de permisos y regresiones

## Recomendacion final

Si, es razonable hacerlo ahora.

La forma mas segura es implementarlo como nuevo rol con capacidades bien definidas, no como una copia parcial de `admin` ni como un `plant_manager` con excepciones dispersas.

## Supuestos de este plan

- El nombre tecnico del rol sera `operations_manager`.
- `operations_manager` es un rol operativo, no aprobador.
- La gestion de usuarios para este rol queda limitada a `plant_manager`.
- El acceso global aplica a plantas activas.
- `assigned_plants` puede mantenerse por compatibilidad, pero no debe limitar a `operations_manager`.
