# Fase 2 — Autoguardado y recuperación móvil

Fecha: 2026-10-04 13:00:45 (America/Bogota, UTC−05:00).

## Estado y alcance

Implementación de la Fase 2 autorizada por el usuario, sobre la Fase 1 del commit `0ab4ab8`. El código y las pruebas locales están preparados. No se desplegó el cliente ni `make-server`, no se aplicaron migraciones en servicios remotos y no se modificó producción. No se hizo un nuevo commit.

La aceptación integral en un clon de Supabase, cámaras de teléfonos reales y planta piloto sigue pendiente. Los resultados del navegador usan datos sintéticos y servicios interceptados; no acreditan un guardado en la base de producción.

Las Fases 3, 4 y 5 permanecen fuera de esta intervención. El JSON de emergencia descrito aquí exporta el borrador del inventario; no constituye el paquete reutilizable de configuraciones de la Fase 4.

## Cambios implementados

### Durabilidad y separación de datos

- IndexedDB conserva los siete módulos de captura: agregados, silos, aditivos, diésel, productos, utilidades y caja chica.
- Las claves separan entorno, usuario, planta, período y sección. El identificador del inventario se comprueba al recuperar un borrador.
- Cada edición copia sus valores y solicita su escritura local inmediatamente, incluidas cantidades cero y fotografías comprimidas pendientes.
- Una revisión local impide que otra pestaña sobrescriba un borrador actualizado. Ante colisión, conserva los valores de la pestaña en memoria y ofrece exportación; no afirma que esos últimos valores estén protegidos localmente.
- Fallos de cuota o de transacción muestran «Requiere atención». La salida se advierte cuando no hay confirmación de protección local.
- Cambiar de usuario detiene la cola y limpia la vista anterior. Las respuestas tardías se descartan si ya cambió el usuario o inventario abierto.

### Sincronización y guardado manual

- Intenta sincronizar después de dos segundos sin edición, con un máximo de diez segundos mientras continúan las ediciones. El límite no promete terminar la solicitud en diez segundos y los errores transitorios aplican una espera creciente, hasta sesenta segundos.
- Guarda duraderamente el identificador de operación, revisión esperada y contenido antes de enviar. Un resultado desconocido se reintenta con la misma operación y contenido preparado.
- Serializa solicitudes por sección. «Guardar ahora» utiliza la misma cola que el autoguardado.
- Si se edita durante una solicitud, conserva la nueva generación y la envía después; una respuesta antigua no elimina esos cambios.
- La confirmación instala los identificadores y valores calculados por el servidor, conserva los metadatos necesarios para presentar y seguir editando el formulario y retira la marca de registro temporal.
- Se mantienen los controles explícitos para guardar y enviar a aprobación. Envío y guardado final de borrador requieren terminar la sincronización; un conflicto o falta de conexión impide anunciar envío exitoso.

### Estados y recuperación

Se muestra el estado de la sección, o los pendientes de todas las secciones en el resumen:

| Estado | Lo que acredita |
|---|---|
| Guardando en este dispositivo | Escritura local todavía pendiente |
| Guardado en este dispositivo | Escritura local confirmada, sin confirmación remota de la edición |
| Pendiente de sincronizar | Borrador conservado, con envío pendiente |
| Sincronizando | Operación de guardado en curso |
| Guardado en servidor | Datos y revisión confirmados por el servidor |
| Requiere atención | Almacenamiento fallido, sesión, permiso, conflicto o incompatibilidad |

- Al recuperar conexión o volver desde segundo plano, se vuelve a activar la cola pendiente; al ocultarse la página se intenta vaciarla. La protección principal es IndexedDB, pues el navegador puede interrumpir tareas de segundo plano.
- Una sesión vencida o un rechazo de autorización detiene el envío. El borrador solo se recupera dentro del ámbito del mismo usuario; después de autenticar y cargar el inventario, puede volver a sincronizarse.
- Un conflicto muestra los valores locales y remotos. El usuario puede conservar los remotos o guardar el borrador sobre la revisión consultada; esta última acción se rechaza si el servidor volvió a cambiar.
- Si el inventario ya fue enviado o aprobado, conserva el borrador y bloquea su guardado.
- «Exportar borrador» descarga un JSON con la vista actual y cola local, útil también si IndexedDB no funciona. No se añadió importación automática de ese archivo.

### Fotografías y trazabilidad

- La selección se lee y comprime antes de incorporarse al borrador. Se informa «Foto preparada»; esa frase no equivale a una confirmación de guardado.
- Las fotos pendientes permanecen como datos embebidos en el borrador. La operación prepara sus URLs únicamente tras confirmar las subidas y persiste esas URLs antes del guardado de sección.
- SHA-256 del contenido comprimido identifica cada foto. La ruta contiene planta y usuario; los reintentos reutilizan el mismo objeto de almacenamiento.
- El servidor valida usuario operativo activo, acceso a la planta, inventario, estado de proceso, sección, formato JPEG/PNG/WebP, tamaño máximo de tres MB e identificador de contenido.
- Para fotos nuevas de este protocolo, el guardado comprueba entorno, planta, ruta y existencia del objeto. Se mantiene la lectura de evidencias históricas y datos embebidos.
- La cola local distingue evidencia pendiente y subida preparada. El servidor registra `INVENTORY_PHOTO_UPLOAD_CONFIRMED`, asociado al inventario y sección; cada solicitud confirmada, incluidos reintentos, puede producir un evento con el mismo `photo_id`. Estos eventos son confirmaciones de solicitudes, no un contador de fotografías distintas.
- La asociación definitiva queda en el evento transaccional `SECTION_SAVED`, con cantidad de fotos vinculadas y URLs nuevas confirmadas. El reintento de una operación ya aplicada recupera su recibo y no repite ese evento.
- La respuesta de silos conserva geometría autorizada de configuración para permitir nuevas ediciones después de la confirmación automática.

### Apertura móvil sin conexión

- Un service worker de compilación de producción conserva la aplicación y los recursos ya cargados. No almacena respuestas de API ni credenciales en su caché.
- Se conserva una copia por usuario de plantas, configuración de módulos y vista de inventario. Permite reabrir un inventario previamente consultado con una sesión operativa existente y todavía vigente.
- También recupera el contexto previamente consultado ante fallos transitorios de red o servidor, aunque el navegador mantenga `navigator.onLine = true`. Los rechazos 401/403 impiden esa recuperación; la consulta inicial de sesión tiene un tiempo de espera limitado.
- No permite un nuevo inicio de sesión sin conexión ni crear un inventario nuevo offline. Si se borran los datos del navegador o el sistema los elimina, el borrador local deja de estar disponible.
- El teclado numérico solicita entrada decimal. El estado y sus acciones permanecen visibles; acciones nuevas y botones de foto tienen un área táctil mínima de 44 píxeles.
- Se conserva el flujo existente de revisión y acceso a la primera sección incompleta. La cámara y galería siguen disponibles mediante el selector de archivos del dispositivo.

## Compatibilidad y publicación

El servidor devuelve `sync_protocol: 2` en la consulta del inventario. El cliente únicamente transmite esta cola cuando recibió esa capacidad. Frente a un servidor anterior conserva el borrador y explica que es necesario actualizar el servidor; evita enviar operaciones a una versión que pudiera ignorar la revisión y el identificador de operación.

La Fase 2 no añade una migración SQL. Necesita que las migraciones y protecciones de la Fase 1 estén instaladas y verificadas antes de habilitar sincronización en un entorno remoto.

Secuencia para una publicación futura:

1. Preparar el clon y comprobar que tiene las migraciones y permisos de la Fase 1, además del bucket de fotografías.
2. Publicar allí el servidor actualizado y confirmar `sync_protocol: 2`, almacenamiento y auditoría con cuentas reales del clon.
3. Publicar el cliente y validar los casos de aceptación siguientes.
4. Validar teléfonos y planta piloto antes de producción.

Para `make-server` son obligatorios `npm run deploy:make-server` y, inmediatamente después, `npm run check:make-server`, comprobando `verify_jwt: false`. Los scripts existentes apuntan al proyecto configurado; **no utilizarlos en el clon sin adaptar explícitamente el destino**. No se ejecutaron en esta intervención.

## Validación realizada

| Comprobación | Resultado |
|---|---|
| `npm run test:inventory-sync` | 19 pruebas aprobadas |
| `npm run test:inventory-photo` | 3 pruebas aprobadas |
| `npm run test:inventory-api` | 4 pruebas aprobadas |
| `npm run test:inventory-guard` | 18 pruebas aprobadas |
| Compilación del cliente | Aprobada; continúan las advertencias existentes sobre tamaño e importaciones de exportación |
| Empaquetado local del servidor | Aprobado; comprueba importaciones y sintaxis, no sustituye integración Deno/Supabase |
| Navegador con IndexedDB real | Recuperación tras cerrar página; aislamiento entre usuarios; colisión entre dos pestañas |
| Aplicación compilada en Chrome con servicios simulados | Cero autoguardado; foto seleccionada offline, recuperada tras recarga y subida al reconectar; reapertura con API inaccesible aunque Wi-Fi siga conectado; servidor anterior bloqueado sin perder el borrador |
| Anchos móviles | 360, 390 y 430 px sin desbordamiento horizontal en el flujo probado de productos; captura revisada visualmente |
| `git diff --check` | Aprobado |

Las 44 pruebas de los cuatro scripts cubren persistencia, identidad, sesión vencida, códigos 401/403/409, cuota, revisión concurrente, edición durante envío, reintento tras respuesta perdida, plazos de dos/diez segundos, metadatos de confirmación y seguridad de fotografías.

Para reproducir el navegador: compilar primero con `npm run build`; después ejecutar `npm run test:inventory-browser`. Se requiere Playwright disponible y Chrome instalado. Puede indicarse la ruta del módulo con `PROMIX_PLAYWRIGHT_MODULE`. El script abre un servidor local temporal, intercepta los servicios Supabase y cierra navegador y servidor al terminar. No utiliza una base real.

## Aceptación pendiente y límites

1. **Clon real:** guardar parcialmente cada uno de los siete módulos y comprobar datos, revisión, avance y auditoría desde una cuenta administradora.
2. **Fotografías reales del clon:** verificar subida, repetición tras interrupción, reutilización del objeto, asociación y rechazo de planta ajena, entorno ajeno o inventario bloqueado.
3. **Dos dispositivos:** modificar la misma sección, revisar diferencias, confirmar una resolución y repetir con un cambio remoto posterior.
4. **Sesión y permisos reales:** expirar sesión, autenticar al mismo usuario, alternar cuentas en un dispositivo compartido y revocar planta/usuario mientras existe un borrador pendiente.
5. **Android e iPhone:** cámara, galería, fotos grandes, decimales con teclado local, pies/pulgadas, orientación, suspensión del navegador, cierre del proceso y retorno.
6. **Siete formularios y revisión:** comprobar controles con teclado abierto, primer pendiente, estados parciales y envío bloqueado ante cualquier sección no sincronizada.
7. **Shell offline:** verificar HTTPS, políticas de caché del alojamiento, actualización de versión y reapertura tras una visita previa completada. Recursos nunca consultados pueden no estar disponibles sin conexión.

La prueba móvil automatizada acredita el flujo de productos en Chrome y dimensiones de pantalla; no acredita cámaras físicas, todos los formularios, comportamiento de Safari o permanencia ilimitada del almacenamiento. Tampoco se incorporó un comprobador completo de tipos del proyecto; pertenece a la depuración estructural prevista para una fase posterior.

## Archivos principales

- `src/app/utils/inventoryDraftStore.ts`: IndexedDB y control de revisión local.
- `src/app/utils/inventorySync.ts`: cola persistente, reintentos y resolución.
- `src/app/contexts/PlantPrefillContext.tsx`: integración con los siete formularios.
- `src/app/components/InventorySyncStatus.tsx`: estado, guardado, exportación y comparación.
- `src/app/components/PhotoCapture.tsx`: captura y compresión previa al borrador.
- `src/app/contexts/AuthContext.tsx` y `ModulesContext.tsx`: recuperación de contexto previamente consultado.
- `public/inventory-sw.js` y `src/main.tsx`: apertura de aplicación previamente cargada sin conexión.
- `supabase/functions/make-server/inventory_photo.ts`, `index.ts`, `database.tsx` e `inventory_guard.ts`: capacidad de protocolo y controles de fotografías/metadatos.
- `scripts/test-inventory-sync.mjs`, `test-inventory-photo.mjs` y `test-inventory-browser.mjs`: pruebas reproducibles.

Se conservaron las modificaciones y archivos que ya existían fuera de esta fase, incluidos README, guías, respaldos y migraciones anteriores sin seguimiento.
