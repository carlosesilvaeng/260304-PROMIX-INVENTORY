# Fase 1 — Guardado, autorización y trazabilidad

**Fecha del registro:** 4 de octubre de 2026, 06:16:52, America/Bogota (UTC−05:00).

**Estado:** cambios implementados en el repositorio y verificados localmente. No publicados en producción. La aceptación completa de la fase requiere pruebas autenticadas en el clon y publicación coordinada.

**Plan de referencia:** [Plan fechado de validación y mejoras](plan-validacion-y-mejoras-promix-2026-10-03_23-12-21.md).

## Alcance ejecutado

Se implementó solamente la Fase 1 autorizada: guardado manual de borradores, permisos, control de revisiones, validación del servidor y auditoría. Las fases de autoguardado, recuperación offline, mejoras de reportes y exportación de configuraciones siguen pendientes.

El problema de referencia era un inventario iniciado sin evidencia de datos guardados. La creación del mes, el primer ingreso informado por el navegador y la confirmación del guardado ahora tienen eventos distintos. Un evento de captura informa actividad; no afirma que las mediciones estén guardadas.

## Cambios implementados

### 1. Guardado manual protegido

- Las siete secciones usan una misma ruta de validación y una operación de base de datos protegida.
- Cada solicitud incluye una revisión esperada y un identificador único de operación.
- Un reintento de la misma operación devuelve el resultado confirmado previamente; no crea otro guardado ni otro evento.
- Reutilizar la operación para otros datos se rechaza.
- El estado del inventario, su revisión, el reemplazo de registros, el comprobante de operación y el evento de auditoría se comprueban o escriben dentro de la misma transacción.
- Si la auditoría falla, el guardado se revierte. No se devuelve éxito con un historial incompleto.
- Si otra sesión ya guardó, la solicitud antigua se rechaza con conflicto. No se sobrescribe automáticamente.
- Si el inventario ya fue enviado o aprobado, no se aceptan nuevas mediciones.
- La lectura de datos y revisiones se obtiene desde una instantánea consistente. Las consultas en reportes o auditoría no avanzan la revisión del editor.
- Después de crear un mes, el editor vuelve a consultar los registros y revisiones reales antes de habilitar el primer guardado.

### 2. Borradores parciales y datos válidos

- Los campos vacíos se conservan como ausentes; el cero explícito sigue siendo un dato válido.
- Se eliminaron conversiones de vacío a cero en el envío de silos, aditivos, diésel y productos.
- Silos permite guardar antes de seleccionar producto o adjuntar fotografía; los requisitos se verifican al enviar.
- Los mensajes de éxito usan las cantidades confirmadas por el servidor e indican cuántos registros están completos o pendientes.
- El servidor obtiene métodos, ancho fijo de cajones, curvas, unidades, factores y configuración de la planta. Los resultados calculados enviados por el navegador no son la fuente de verdad.
- El alto y largo de agregados siguen siendo mediciones del operador; el ancho se obtiene de la configuración.
- Se mantiene compatibilidad con cajones antiguos y sus identificadores de configuración.
- Diésel y utilidades consultan los datos previos desde el servidor para calcular inventario inicial y consumo. La primera lectura de utilidades puede funcionar como línea base cuando no hay historial.
- Se rechazan números negativos en lecturas, valores no finitos, resultados que exceden el rango numérico, medidores que retroceden y lecturas fuera del rango de calibración.
- El envío y la aprobación requieren todas las configuraciones activas, sus entradas obligatorias y fotografías requeridas. No basta con que exista una fila.
- Si la configuración o el período previo cambió y los resultados guardados ya no coinciden con el cálculo vigente, se exige revisar y volver a guardar la sección. No se valida silenciosamente un resultado diferente del que verá el revisor.
- Los errores de consulta se distinguen de la ausencia de un mes. Una consulta fallida no provoca la creación de otro inventario ni se interpreta como ausencia de configuración.

### 3. Autorización

| Acción | Roles permitidos |
|---|---|
| Crear mes, capturar, guardar y enviar | `plant_manager`, `operations_manager` activos |
| Aprobar y rechazar | `admin`, `super_admin` activos |
| Acceso del encargado de planta | Solamente sus plantas asignadas |

La base de datos comprueba nuevamente usuario, planta, estado, revisión y pertenencia de los registros/configuraciones. Las funciones nuevas no se pueden ejecutar desde los roles públicos del navegador; quedan restringidas al servidor.

También se rechazan sesiones de usuarios desactivados y se exige acceso a una planta activa para subir fotografías. Se corrigió la clave de sesión utilizada al cambiar contraseña. Se retiraron del arranque del servidor los mensajes que mostraban prefijos de claves.

### 4. Historial

| Evento | Significado |
|---|---|
| `INVENTORY_STARTED` | El servidor creó el inventario mensual |
| `INVENTORY_CAPTURE_STARTED` | El navegador informó la primera edición de una sección por ese usuario durante el mes |
| `SECTION_SAVED` | El servidor confirmó los registros y la auditoría en la misma transacción |
| `SECTION_SAVE_FAILED` | Falló un intento recibido por el servidor después de identificar y autorizar el inventario |
| `INVENTORY_DRAFT_SAVED` | Se confirmó la acción explícita de guardar el estado de borrador |
| `INVENTORY_SUBMITTED` / `INVENTORY_APPROVED` / `INVENTORY_REJECTED` | Transición confirmada junto con su evento |

Los guardados incluyen usuario autenticado, planta, período, sección, revisión, operación, fecha del servidor y cantidades guardadas, capturadas, completas y pendientes. La pantalla de auditoría muestra las nuevas acciones y los conteos del guardado. Se conservan sus restricciones de visibilidad por rol.

La migración completa `plant_id` en eventos antiguos únicamente cuando hay un inventario asociado. No crea supuestos guardados, usuarios ni fechas históricas. La nueva trazabilidad no recupera información que nunca llegó al servidor.

## Archivos principales

- `supabase/functions/make-server/inventory_guard.ts`: validación, cálculo autorizado y requisitos de envío.
- `supabase/functions/make-server/index.ts`: guardado y flujo de estados protegidos, actividad y permisos.
- `supabase/functions/make-server/database.tsx`: instantáneas, comprobantes y consultas que propagan errores.
- `supabase/functions/make-server/auth.tsx`: rechazo de usuarios inactivos.
- `supabase/migrations/20261004042000_inventory_guard_and_audit.sql`: transacciones, revisiones, comprobantes y auditoría histórica.
- `src/app/utils/inventoryWriteProtocol.ts`: protocolo de reintentos y revisión en memoria para guardado manual.
- `src/app/utils/api.ts`: transporte del protocolo y confirmación de resultados.
- `src/app/contexts/PlantPrefillContext.tsx`: carga consistente y primer ingreso de datos.
- Las siete pantallas de secciones, `AuditPanel.tsx` y `ChangePasswordModal.tsx`: integración y mensajes.

## Evidencia de verificación

| Verificación | Resultado |
|---|---|
| Compilación de la aplicación con `npm run build` | Aprobada |
| Empaquetado de sintaxis del servidor mediante esbuild | Aprobado; no sustituye una ejecución real en Deno |
| `npm run test:inventory-guard` | 17 casos aprobados |
| `npm run test:inventory-api` | 4 casos aprobados con el cliente real y transporte simulado |
| `npm run test:inventory-guard-db` | 42 migraciones reales aplicadas a una base temporal local y pruebas SQL aprobadas |
| Pruebas de conversiones, geometría/presentación/esquema/validación de silos y medición de aditivos | Aprobadas |
| Prueba de conciliación de contenedores de aditivos | Aprobada |
| Pruebas de límites de tiempo y errores de fotografías | 4 casos aprobados |
| Revisión de formato de diferencias | Sin errores |

Las pruebas nuevas comprueban valores vacíos y cero, cálculos manipulados, configuraciones ajenas/duplicadas, permisos, fotos requeridas, datos incompletos, cambios de configuración, reintentos, respuestas tardías, cambio de usuario y lecturas del revisor que no alteran la revisión del editor.

La integración SQL verificó borradores parciales en las siete secciones, instantáneas, reintentos sin auditoría duplicada, bloqueo de inventarios enviados/aprobados, rechazo de roles incorrectos y reversión de datos y estados cuando falla la auditoría.

Además se utilizaron dos conexiones reales para comprobar un guardado obsoleto después de otro guardado y un guardado mientras otra conexión envía el inventario. Ambos intentos conflictivos fueron rechazados sin sobrescritura.

**Entorno de integración:** PostgreSQL 18 local aislado, datos sintéticos, base nueva con nombre aleatorio que se elimina al finalizar. Los esquemas de Auth/Storage y los roles se inicializan como auxiliares para ejecutar las migraciones. Esto no es una restauración de producción ni valida el gateway, JWT, Storage o las políticas reales de Supabase de extremo a extremo.

La compilación conserva advertencias existentes por tamaño de paquetes y combinación de importaciones dinámicas/estáticas. La optimización de carga queda fuera de esta fase.

## Pendiente para aceptación y publicación

1. Preparar o conectar el clon Supabase aislado de acuerdo con la guía del proyecto. No se hicieron pruebas de escritura sobre producción.
2. Aplicar allí la migración nueva después de verificar la correspondencia de su esquema con las migraciones del repositorio.
3. Publicar servidor y aplicación en ese entorno y ejecutar el recorrido con sesiones reales: encargado asignado, encargado ajeno, operaciones, administrador y usuario desactivado.
4. Confirmar que un borrador parcial aparece en la consulta del administrador y que su evento se encuentra filtrando por planta; validar además conflicto, reintento, envío, aprobación y rechazo en el navegador.
5. Probar la captura y subida de fotografías desde un teléfono real en el clon. No se acredita todavía esa prueba.
6. Publicar coordinadamente la migración, el servidor y la aplicación después de la aceptación. Los clientes anteriores no incluyen revisión/operación y serán rechazados al guardar por el servidor nuevo; requieren recarga de la aplicación. Prever una ventana coordinada de actualización.
7. Para producción, seguir obligatoriamente las instrucciones del repositorio: `npm run deploy:make-server`, luego `npm run check:make-server`, y comprobar `"verify_jwt": false`. No confiar solamente en el archivo de configuración.

**Criterio de cierre:** la implementación local está terminada. La Fase 1 todavía no se declara aceptada en el clon ni instalada en producción. Los cambios previos y archivos ajenos a esta intervención se conservaron. Al emitir este registro no se había creado un commit ni realizado un despliegue.

**Actualización del 4 de octubre de 2026:** el usuario autorizó crear un commit local con el código, la migración, las pruebas y los documentos de la Fase 1. Los archivos previos ajenos a esta fase quedan fuera del commit. Esta autorización no incluye publicación remota ni despliegue; la aceptación en el clon continúa pendiente.
