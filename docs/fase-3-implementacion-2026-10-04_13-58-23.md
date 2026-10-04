# Fase 3 — Evidencia de avance y reportes confiables

Fecha: 2026-10-04 13:58:23 (America/Bogota, UTC−05:00).

## Estado y alcance

La Fase 3 solicitada por el usuario está implementada en el repositorio y validada localmente, sobre la Fase 2 del commit `e360927`. No se hizo commit, push ni despliegue; no se modificaron datos ni servicios de producción. La aceptación autenticada en el clon de Supabase y la publicación siguen pendientes.

Esta intervención corresponde a seguimiento, reportes, consolidación y exportaciones de inventarios. La exportación reutilizable de configuraciones de la Fase 4 permanece pendiente. Se conservaron los archivos y cambios ajenos que ya existían en el directorio.

## Comportamiento implementado

### Estado, captura y actividad

- El listado separa el estado del proceso (en progreso, enviado o aprobado), el avance guardado y la actividad recibida por el servidor.
- Crear un inventario mensual o mostrar filas prellenadas no acredita que el operario haya registrado mediciones.
- El avance distingue registros guardados, registros con información, completos y pendientes. Incluye los elementos configurados todavía no guardados.
- Los conteos se apoyan en recibos transaccionales de guardado. Los datos históricos sin recibos suficientes se identifican como «por verificar»; no se inventa su completitud.
- Para inventarios abiertos se informa el alcance de la configuración activa y los registros persistidos. Para inventarios cerrados se conserva el alcance registrado en los recibos; cambiar la configuración posterior no reinterpreta el histórico.
- Los nuevos guardados conservan el número de elementos configurados de las siete secciones y las unidades/modos aplicados a sus filas.
- La consulta de detalle presenta las siete secciones con valores guardados y la cronología autorizada. Se puede cargar el resto de los eventos por páginas.

### Actividad móvil y recepción

- La cola durable conserva la primera captura informada por el dispositivo y la hora de la edición asociada a cada operación.
- Esas horas sobreviven al cierre y recuperación del borrador; los reintentos mantienen el identificador y la hora de la operación.
- Un guardado manual de un formulario sin ediciones no crea por sí solo una primera captura móvil.
- La hora informada por el dispositivo y la hora recibida en el servidor aparecen separadas. Si no existe el evento inicial, el primer recibo con información acredita la primera recepción conocida.
- El administrador solo conoce lo que recibió el servidor. Un borrador pendiente offline no se presenta como información ya sincronizada. El reloj del móvil puede estar desajustado y no se considera una hora de recepción confiable.
- En pantalla se utiliza explícitamente la hora de Puerto Rico; los archivos conservan fechas ISO con su referencia UTC.

### Filtros, indicadores y permisos

- Planta, año/mes o período y estado se filtran en servidor antes de calcular el total y los indicadores.
- El listado muestra 50 inventarios por página. El total y las exportaciones abarcan el conjunto filtrado completo, incluidos resultados posteriores al antiguo límite de 200.
- La exportación usa una fecha de corte del servidor y una huella del conjunto de inventarios. Si cambia el conjunto, una revisión o un estado durante la paginación, se solicita actualizar; no se genera un archivo silenciosamente incompleto.
- La descarga comprueba que cada detalle corresponde a la planta, período, revisión y estado consultados.
- Los encargados de planta acceden a sus plantas asignadas; operaciones, administración y superadministración mantienen su alcance autorizado.
- Se bloquean usuarios inactivos y consultas de detalle o cronología de plantas ajenas. La exclusión de eventos de superadministración para administradores ocurre antes de contar y paginar.
- Las funciones de reportes solo pueden ejecutarse desde el servidor con su rol de servicio; no quedan expuestas directamente a los roles públicos del cliente.
- Auditoría utiliza los mismos filtros por planta/período, obtiene todas las páginas y mantiene el filtro de usuario para los eventos.

### Modelo histórico y consolidación

- Pantalla, Excel y PDF usan un modelo común construido exclusivamente con las filas persistidas y los metadatos de sus recibos.
- Cada fila muestra su unidad de lectura/existencia; no se toma la unidad de la primera fila para etiquetar todas.
- Las unidades históricas ausentes se indican explícitamente. No se deducen desde la configuración actual.
- El consolidado agrupa por período, sección, material/producto, métrica y unidad. Se conserva la marca cuando está guardada para aditivos; no se hacen equivalencias automáticas entre nombres de materiales.
- Existencias, consumos, compras y cantidades de envases se mantienen separados. No se mezclan galones con pies cúbicos, ni se suman existencias de meses diferentes.
- Se compara con el mes calendario inmediatamente anterior de la misma planta, material, métrica y unidad. No se sustituye por el último mes disponible.
- Cero guardado continúa siendo cero. Dato faltante o período previo ausente aparece como ausencia de dato/comparación, nunca como un cero ficticio.
- Si falta un dato de una fila agrupada, la cantidad agrupada queda sin dato; si falta un equivalente anterior de una planta, la comparación consolidada queda sin comparación. Se rechazan cantidades inválidas y desbordamientos numéricos.

### Excel, PDF y evidencias

- Excel conserva cantidades como celdas numéricas. Incluye información de generación/filtros, resumen, consolidado, detalle por inventario y evidencias.
- Los nombres de hojas se limpian, respetan los 31 caracteres y reciben sufijos para evitar colisiones incluso al truncarse.
- PDF incluye logo, resumen, consolidado, valores de las siete secciones, fechas, unidades y evidencias, con numeración de páginas y encabezados repetidos en las tablas.
- Las fotografías públicas se descargan sin enviarles el token de autenticación. Se limita la carga de detalles y fotos a tres solicitudes simultáneas por etapa.
- Las imágenes se verifican, se limita su espera y se redimensionan para el documento. Una fotografía que falla no se oculta: aparece «Fotografía no disponible; no se pudo cargar». En Excel se conserva su enlace y disponibilidad al momento de generar el archivo; las imágenes no se incrustan allí.
- Si falla algún detalle requerido, se detiene todo el archivo y se enumeran las plantas/períodos afectados. No se exporta un subconjunto aparentando ser completo.
- Las exportaciones de reportes se pueden cancelar durante las consultas y carga de fotos. La creación final del archivo en el navegador es sincrónica y no se interrumpe a mitad de su escritura.
- Se conservan los objetos fotográficos del protocolo de la Fase 2 al eliminar un inventario: sus rutas identifican contenido reutilizable por otros meses. La limpieza de objetos sin referencias queda para un mecanismo posterior; se evita romper evidencias históricas.

## Validación realizada

| Comprobación | Resultado |
|---|---|
| Compilación del cliente de producción | Correcta |
| Compilación del servidor para comprobar imports/sintaxis | Correcta |
| Pruebas del guardado/autorización | 18 correctas |
| Pruebas de sincronización y horas de origen | 20 correctas |
| Pruebas de API del inventario | 4 correctas |
| Pruebas de fotografías | 3 correctas |
| Modelo, filtros, paginación, concurrencia y Excel | 18 correctas |
| PostgreSQL local desechable | 43 migraciones aplicadas; permisos, totales, avance e histórico correctos |
| Regresión de transacciones en PostgreSQL | Correcta; incluye dos conexiones simultáneas y bloqueo tras envío |
| Navegador real del ingreso móvil | Correcto; IndexedDB, recuperación, cero, fotografías, reconexión y servidor anterior |
| Navegador real de reportes | Correcto; 251 inventarios, filtros, paginación, cronología y exportaciones reales |
| Móvil de reportes | Sin desbordamiento de la página a 360, 390 y 430 píxeles; tablas con desplazamiento contenido |
| Excel descargado realmente | Reabierto y comprobado: cero numérico, cantidad de inventarios, evidencias faltantes y hojas únicas |
| PDF descargado realmente | Texto comprobado y siete páginas renderizadas e inspeccionadas; unidades, tablas y evidencias legibles |
| Errores y cancelación | No se descargó un archivo parcial; cancelación y backend antiguo comunicados explícitamente |

Las pruebas suman 63 casos automatizados de código, además de las pruebas de PostgreSQL y de navegador. El navegador interceptó todas las llamadas a los servicios de datos con respuestas sintéticas; no utilizó usuarios ni inventarios reales. Las pruebas de base de datos crearon bases locales nuevas y las eliminaron al terminar.

La compilación mantiene avisos sobre el tamaño de los paquetes e imports compartidos de Excel ya existentes; reducir ese peso corresponde a la optimización posterior. No se presentó una validación local como confirmación de producción.

## Compatibilidad y publicación pendiente

La API de reportes ahora devuelve `reporting_version: 3`, datos paginados, totales y fecha de corte. El cliente muestra un error explícito frente al servidor anterior para evitar exportaciones truncadas. Por ello no debe publicarse únicamente el cliente nuevo sobre un servidor antiguo.

Orden de aceptación y publicación:

1. Preparar un clon con los datos y permisos de las fases anteriores y aplicar `20261004182000_inventory_reporting.sql` allí.
2. Desplegar el servidor actualizado en el clon y comprobar reportes versión 3, autorización y recepción de capturas/fotos con cuentas del clon.
3. Publicar el cliente en el entorno de prueba y comparar pantalla, tablas persistidas, Excel y PDF para una muestra de los siete módulos, incluyendo inventarios antiguos, incompletos y aprobados.
4. Probar una edición offline, su reintento, recepción posterior y cronología con horas separadas; modificar una configuración después del cierre y comprobar que el histórico permanece intacto.
5. Tras aceptar el clon, publicar en el destino autorizado: migración, servidor y luego cliente. Comprobar nuevamente permisos, reportes y exportaciones.

Para `make-server` son obligatorios `npm run deploy:make-server` y, inmediatamente después, `npm run check:make-server`, comprobando `verify_jwt: false`. Los scripts actuales apuntan al proyecto configurado de producción; no se ejecutaron aquí ni deben utilizarse para el clon sin adaptar explícitamente el destino.

Los inventarios antiguos sin metadatos suficientes continúan disponibles con advertencias; no se hizo un relleno automático de cantidades, unidades o actividad desde la configuración de hoy.

## Archivos principales

- `supabase/migrations/20261004182000_inventory_reporting.sql`: consultas, permisos, conteos, cronología y detalle histórico.
- `supabase/functions/make-server/report_model.ts` y `report_query.ts`: modelo común y validación de filtros.
- `supabase/functions/make-server/index.ts` e `inventory_guard.ts`: endpoints, recibos con metadatos y protección de fotos reutilizables.
- `src/app/utils/reportTransport.ts`, `reportWorkbook.ts`, `inventoryReportModel.ts` y `exportReports.ts`: paginación completa, validación de detalles y exportadores.
- `src/app/pages/Reports.tsx`, `src/app/components/InventoryReportView.tsx` y `SavedInventoryEvidence.tsx`: seguimiento y consulta de datos guardados.
- `src/app/pages/settings/AuditPanel.tsx`: filtros y lectura completa de auditoría.
- `src/app/utils/inventorySync.ts`, `api.ts` y `src/app/contexts/PlantPrefillContext.tsx`: hora durable de origen y envío.
- `scripts/test-inventory-report.mjs`, `test-inventory-report.sql`, `test-inventory-report-db.py` y `test-inventory-report-browser.mjs`: pruebas nuevas.
- `package.json`, `scripts/test-inventory-browser.mjs` y `test-inventory-sync.mjs`: comandos de prueba y regresiones adaptadas/ampliadas.
