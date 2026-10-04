# PROMIX: plan de validación, estabilización y mejora

**Fecha del plan:** 3 de octubre de 2026

**Guardado:** 3 de octubre de 2026, 23:12:21 — America/Bogota (UTC−05:00)

**Origen:** plan presentado y decisiones confirmadas en el chat «Revisar y planificar mejoras del pro».

**Estado al guardar:** revisión inicial realizada; implementación de la Fase 1 pendiente. Este documento no acredita correcciones, migraciones ni despliegues realizados.

**Actualización — 4 de octubre de 2026, 06:16:52, America/Bogota:** la Fase 1 quedó implementada en el repositorio y verificada con pruebas unitarias, del cliente y de transacciones en PostgreSQL local aislado. Continúan pendientes la aceptación autenticada en el clon y la publicación; producción no fue modificada. Véase el [registro de implementación y pruebas](fase-1-implementacion-2026-10-04_06-16-52.md). Se conserva el plan original como referencia; las demás fases no fueron ejecutadas.

> **Alcance autorizado posteriormente por el usuario: Fase 1 solamente — corregir guardado, autorización y trazabilidad, incluyendo sus pruebas.** Las demás fases se conservan como referencia futura y no forman parte de esta intervención. No se incluyen autoguardado móvil, mejoras de reportes ni exportación de configuraciones. Las pruebas de escritura requieren el clon aislado acordado; su disponibilidad debe comprobarse antes de ejecutarlas.

Este archivo conserva el contenido del plan entregado en el chat, adaptando los metadatos de entrega y los enlaces para su consulta desde el repositorio. Los hallazgos describen el estado revisado en esa sesión y deben distinguirse de avances posteriores.

## 1. Objetivo y decisiones acordadas

Validar el funcionamiento de PROMIX, corregir problemas que puedan perder u ocultar información y evolucionar el proyecto conservando sus funcionalidades actuales.

Orden de trabajo acordado en el plan general:

1. Verificar el entorno y reproducir los problemas conocidos.
2. Asegurar persistencia y trazabilidad de inventarios incompletos.
3. Mejorar la captura móvil con conexión intermitente.
4. Corregir reportes y consolidación operativa.
5. Incorporar Excel completo y respaldo reutilizable de configuraciones.
6. Reducir deuda técnica con pruebas de regresión.

Las pruebas que creen, modifiquen, aprueben o restauren información se realizarán en un **clon aislado**. Para la futura Fase 2 se acordó **autoguardado de borradores**, conservación local y sincronización posterior; no se implementará dentro de la Fase 1.

## 2. Qué se comprobó y qué falta validar

### Comprobaciones realizadas

| Comprobación | Resultado | Alcance |
|---|---|---|
| Compilación de producción | Correcta | No sustituye pruebas funcionales ni comprobación de tipos |
| Pantalla inicial de la compilación local | Muestra el formulario de acceso | No se inició sesión |
| Seis scripts de prueba declarados | Correctos | Unidades, geometría, inventario, esquema y validación de silos; medición de aditivos |
| Reconciliación de contenedores de aditivos | Correcta | Conservación de lecturas y entradas configuradas |
| Pruebas de límites de espera | Cuatro casos correctos | Solicitudes detenidas, cancelación y reintento |
| Función desplegada | `ACTIVE`, versión 71 | Verificación de metadatos |
| Configuración del gateway | `verify_jwt: false` | Conforme a las instrucciones del repositorio |
| Salud del backend | `{"status":"ok"}` | Disponibilidad básica |
| Versión reportada por backend | `2609011514` | Coincide con la constante principal local, pero no demuestra igualdad del código |
| Guaynabo y Ceiba | Consultados nuevamente | Solo conteos, fechas, estados y eventos; sin modificaciones |

**Conclusión:** el proyecto compila y cuenta con una base funcional, pero todavía no puede certificarse su operación completa.

Quedan pendientes pruebas autenticadas de extremo a extremo, dispositivos móviles reales, concurrencia, permisos por rol, restauración del clon, integridad histórica y correspondencia entre lo desplegado y el repositorio.

### Caso real que debe guiar la estabilización

Se revisó el chat **«Revisar inventario de Guaynabo»** y se contrastaron sus resultados con una consulta actual durante la revisión.

| Inventario de septiembre de 2026 | Estado | Registros guardados | Eventos de guardado |
|---|---|---:|---:|
| Guaynabo | En progreso | 0 en las siete secciones | 0 |
| Ceiba | En progreso | 17 en seis secciones | 7 |

En Ceiba, **los siete eventos de guardado tienen la planta vacía**. Esto explica que puedan desaparecer al filtrar la auditoría por planta.

En Guaynabo, la evidencia confirma la creación del inventario, pero **no permite determinar si el operario escribió información que nunca llegó al servidor**. No debe atribuirse el incidente a un error del usuario ni a una causa técnica concreta sin evidencia adicional.

Ya existen correcciones incorporadas en los commits `01713df` y `44eaf28`: consulta global de reportes para administradores y visualización de valores guardados. Deben conservarse y comprobarse en el despliegue; no rehacerlas como funcionalidades nuevas.

## 3. Hallazgos y prioridades

**P0:** integridad, pérdida de datos o autorización; atender antes de ampliar funcionalidades.

**P1:** exactitud, trazabilidad y operación diaria.

**P2:** mantenimiento y optimización.

Los hallazgos de código indican comportamientos o riesgos verificables por inspección; no todos se han reproducido en producción.

| Prioridad | Hallazgo | Implicación y acción |
|---|---|---|
| P0 | Las lecturas editadas en `PlantPrefillContext` permanecen en memoria; la persistencia de `InventoryContext` no cubre esas ediciones | Incorporar borrador persistente de lecturas y fotos, con recuperación después de cerrar o recargar |
| P0 | Los guardados de sección inspeccionados verifican acceso a la planta, pero no bloquean de forma uniforme estados enviados/aprobados; las funciones SQL revisadas tampoco ofrecen ese bloqueo | Probar llamadas directas y proteger estado, rol y revisión dentro de la transacción |
| P0 | El reemplazo atómico de una sección no tiene control de versión entre dispositivos | Evitar que un guardado antiguo sobrescriba uno reciente |
| P0 | Algunos resultados calculados se aceptan desde el cliente; diésel y productos también reciben curvas dentro de la solicitud | Recalcular en servidor usando configuración autorizada, conservando ausencia de datos y cero como valores diferentes |
| P1 | `SECTION_SAVED` omite `plant_id` en los guardados revisados | Corregir eventos nuevos y completar asociaciones históricas cuando exista una relación inequívoca |
| P1 | `logAudit` ejecuta la inserción sin esperar su resultado y no inspecciona el error devuelto | Hacer durables los eventos que acreditan guardados y cambios de estado |
| P1 | La comprobación previa al envío verifica presencia de filas e identificadores, no toda la validez de sus campos | Separar «hay registros», «hay datos capturados» y «está completo» |
| P1 | Reportes consulta como máximo 200 inventarios y luego filtra en pantalla | Los períodos antiguos pueden quedar excluidos sin aviso; trasladar filtros y paginación al servidor |
| P1 | La exportación puede continuar cuando falla la consulta de un detalle | Impedir que un archivo incompleto se presente como una exportación correcta |
| P1 | El formateador de reportes convierte cantidades a texto antes de crear Excel | Conservar celdas numéricas para sumar, filtrar y analizar |
| P1 | Algunos encabezados y etiquetas asumen unidades; agregados usa la unidad de la primera fila | Mostrar la unidad real por registro y evitar consolidaciones incompatibles |
| P1 | El Excel de configuraciones es una representación de configuración activa, no un respaldo restaurable | Añadir exportación completa y versionada, incluyendo dependencias y parámetros geométricos |
| P1 | Algunas consultas de configuración registran errores y devuelven colecciones vacías | Distinguir «sin configuración» de «no fue posible consultar» |
| P1 | El cambio de contraseña lee `access_token`, mientras la sesión utiliza `promix_access_token` | Unificar la obtención de sesión y reproducir el flujo en pruebas |
| P1 | La validación de token no comprueba `is_active`, aunque el inicio de sesión sí lo hace | Verificar que desactivar un usuario invalide también su acceso con una sesión existente |
| P1 | La subida de fotos recibe una planta sin comprobar su pertenencia en el manejador inspeccionado | Validar autorización, asociación y límites del archivo en servidor |
| P2 | El paquete principal generado pesa aproximadamente 3,04 MB; hay importaciones estáticas que anulan cargas diferidas | Separar reportes y bibliotecas de exportación de la captura móvil |
| P2 | No se encontraron controles versionados de tipos ni una canalización de integración continua; las pruebas cubren áreas específicas | Establecer comprobaciones reproducibles y ampliar cobertura por riesgo |
| P2 | Versiones visibles diferentes, archivos centrales extensos y cambios locales sin versionar | Identificar cada despliegue por commit y ordenar el repositorio antes de refactorizar |

Referencias principales de la revisión:

- [Servidor: autorización, guardados, auditoría y reportes](../supabase/functions/make-server/index.ts)
- [Estado y carga de captura](../src/app/contexts/PlantPrefillContext.tsx)
- [Exportación de reportes](../src/app/utils/exportReports.ts)

## 4. Ejecución por fases

### Fase 0 — Establecer una base reproducible

**Referencia futura y prerrequisitos de pruebas; no ampliar la intervención autorizada sin necesidad.**

**Acciones**

- Registrar commit, modificaciones locales, migraciones pendientes y versiones desplegadas.
- Preservar los documentos, scripts y migraciones existentes sin incluir automáticamente archivos temporales en commits.
- Crear el clon siguiendo la guía existente y comprobar la restauración de base y fotografías.
- Separar configuración de conexión y comandos de despliegue por entorno. Impedir que una compilación de pruebas apunte inadvertidamente a producción.
- Crear cuentas de prueba para los cuatro roles y plantas con distintos métodos de medición.
- Preparar escenarios equivalentes a Guaynabo y Ceiba, sin modificar sus inventarios originales.
- Comparar migraciones y funciones SQL instaladas con las esperadas por el código.

**Criterio de salida:** frontend, backend, base y almacenamiento de pruebas identificados; restauración comprobada; producción fuera de los flujos de escritura de pruebas.

### Fase 1 — Corregir guardado, autorización y trazabilidad

**Única fase autorizada para ejecución en esta intervención, incluyendo sus pruebas.**

Esta fase debe preceder al autoguardado.

**Persistencia y validación**

- Centralizar las reglas de quién puede capturar, enviar, aprobar y rechazar.
- Permitir edición operativa únicamente en `IN_PROGRESS`; mantener revisión y aprobación para los roles correspondientes.
- Bloquear modificaciones de inventarios enviados o aprobados también desde solicitudes directas.
- Proteger en una misma transacción el estado, la revisión esperada, el guardado y su evento de auditoría.
- Incorporar identificadores de operación para que un reintento no duplique un guardado.
- Recalcular resultados derivados con configuración validada del servidor.
- Permitir borradores incompletos, pero impedir su envío mientras falten datos obligatorios.
- Diferenciar errores de consulta, ausencia de inventario y ausencia de configuración; no crear un mes porque una consulta falló.

**Auditoría**

- Todo guardado debe registrar usuario autenticado, planta, período, sección, revisión, identificador de operación y fecha del servidor.
- Añadir cantidad de registros con datos capturados, completos y pendientes.
- Registrar creación, primer ingreso informado por el cliente, borrador guardado, fallos recibidos por el servidor, envío, aprobación y rechazo.
- Completar `plant_id` en eventos históricos mediante su inventario asociado. No inventar eventos ni fechas inexistentes.
- Conservar las reglas actuales de visibilidad de auditoría por rol.

**Criterio de salida:** un borrador parcial guardado aparece al administrador, su evento se encuentra filtrando por planta y ninguna solicitud obsoleta o no autorizada lo sobrescribe.

### Fase 2 — Autoguardado y recuperación móvil

**Referencia futura; fuera de la intervención autorizada.**

**Comportamiento acordado**

- Conservar lecturas y fotografías pendientes en IndexedDB, separadas por entorno, usuario, planta, período y sección.
- Persistir cada cambio localmente y sincronizar después de dos segundos sin edición, con un máximo de diez segundos entre intentos mientras se continúa escribiendo.
- Mantener el botón **Guardar ahora** y la acción explícita **Enviar para aprobación**.
- Serializar guardados por sección y conservar modificaciones realizadas mientras una solicitud está en curso.
- Reintentar errores transitorios al recuperar conexión, sin duplicar operaciones.
- Ante sesión vencida, detener la sincronización, conservar el borrador y reanudar únicamente tras autenticar al mismo usuario.
- Ante conflicto de revisión, mostrar los valores locales y del servidor; no sobrescribir automáticamente.
- Si el inventario fue enviado o aprobado desde otro dispositivo, detener los guardados y explicar el motivo.
- No mostrar un borrador de un usuario a otro en un teléfono compartido.

**Estados visibles**

| Estado | Significado |
|---|---|
| Guardando en este dispositivo | La escritura local todavía está pendiente |
| Guardado en este dispositivo | Existe borrador local; aún no está confirmado en servidor |
| Pendiente de sincronizar | Hay cambios locales por enviar |
| Sincronizando | Se está realizando el guardado remoto |
| Guardado en servidor | El servidor confirmó datos y revisión |
| Requiere atención | Hay conflicto, sesión vencida o error que impide continuar |

Si el almacenamiento local falla o se llena, mostrarlo claramente y no afirmar que el borrador está protegido.

**Fotografías**

- Conservar la foto comprimida localmente hasta confirmar su subida.
- Identificar cada foto para reutilizarla en reintentos.
- Validar planta y asociación en el servidor.
- Registrar por separado foto pendiente, subida y vinculada al inventario.
- Mantener lectura de evidencias históricas, incluidas las que hoy estén guardadas como datos embebidos.

**Experiencia móvil**

- Revisar anchos de 360, 390 y 430 píxeles, orientación y teclado.
- Mostrar unidad, lectura y resultado sin desplazamiento horizontal.
- Facilitar decimales, cero explícito y medidas en pies/pulgadas.
- Mantener accesible el estado de guardado y llevar al primer campo pendiente.
- Probar cámara, galería, compresión, interrupciones y retorno desde segundo plano en Android y iPhone.

**Criterio de salida:** cerrar y reabrir la aplicación recupera el último borrador confirmado localmente; reconectar lo sincroniza una sola vez y el administrador ve lo recibido.

### Fase 3 — Evidencia de avance y reportes confiables

**Referencia futura; fuera de la intervención autorizada.**

**Seguimiento de inventarios**

Mostrar tres dimensiones independientes:

1. **Estado del proceso:** en progreso, enviado o aprobado.
2. **Avance guardado:** registros con captura, completos y pendientes.
3. **Actividad conocida:** creación, primera captura informada, último guardado y última sincronización recibida.

La creación del registro mensual no debe presentarse como prueba de que se ingresaron mediciones. Tampoco una fila prellenada desde configuración debe contarse automáticamente como captura del operario.

Cuando el móvil esté desconectado, el administrador verá únicamente la última información recibida. Los eventos locales posteriores podrán sincronizarse conservando tanto su hora de origen como su hora de recepción, claramente diferenciadas.

**Reportes operativos**

- Conservar la vista de datos guardados ya incorporada y corregir sus etiquetas de unidades.
- Añadir seguimiento por planta y período, con acceso al detalle y a su cronología.
- Aplicar filtros por planta, período y estado en servidor, con paginación y total de resultados.
- Obtener indicadores del conjunto filtrado completo, no solo de la página visible.
- Consolidar por material/producto y unidad compatible.
- Mostrar existencias, consumos y cantidades de envases como métricas distintas.
- Comparar períodos equivalentes; ausencia de período anterior debe aparecer como «sin comparación», no como cero.
- Usar cantidades históricas persistidas y su configuración aplicada; no reinterpretar inventarios aprobados con configuraciones actuales.

**Excel y PDF**

- Utilizar un mismo modelo de datos para pantalla, Excel y PDF.
- Mantener números como números en Excel y aplicar formato visual sin convertirlos a texto.
- Incluir planta, período, estado, unidades, fecha de generación y filtros.
- Evitar nombres de hojas duplicados o truncados ambiguamente.
- Detener la exportación si falta algún detalle requerido y enumerar qué consultas fallaron.
- Si una fotografía no puede cargarse, mostrar la omisión explícitamente.
- Limitar solicitudes simultáneas y permitir cancelar exportaciones extensas.

**Criterio de salida:** pantalla, datos persistidos, Excel y PDF coinciden; ningún filtro omite resultados por un límite oculto.

### Fase 4 — Exportar y reutilizar configuraciones

**Referencia futura; fuera de la intervención autorizada.**

Entregar dos productos separados:

| Producto | Finalidad |
|---|---|
| Excel de configuración | Revisar, comparar y documentar parámetros |
| Paquete JSON versionado | Restaurar o copiar configuraciones mediante validación |

**Contenido**

- Configuración de los siete módulos.
- Métodos, dimensiones, capacidades, obligatoriedad de fotos y orden.
- Curvas completas y puntos de calibración.
- Unidades, factores y reglas de medición contextual.
- Catálogos y relaciones necesarios para interpretar el paquete.
- Registros activos e inactivos, identificados expresamente.
- Versión de formato, origen, fecha y comprobación de integridad.

El paquete de configuración no sustituye al respaldo completo de base, usuarios y fotografías.

**Restauración y copia**

- Incorporar una vista previa con diferencias, dependencias, advertencias y errores.
- Permitir seleccionar explícitamente la planta destino.
- Mapear identificadores al copiar; no reutilizarlos ciegamente entre entornos.
- Reutilizar dependencias idénticas y bloquear conflictos incompatibles sin modificar catálogos globales silenciosamente.
- Mantener registros adicionales del destino salvo selección expresa de desactivación.
- Ejecutar cambios en una transacción por planta y registrar el resultado.
- Invalidar la vista previa si cambia el archivo o la configuración destino.
- Mantener intactos los inventarios históricos.

**Criterio de salida:** exportar una planta, importarla en el clon y volver a exportarla produce una configuración equivalente, salvo identificadores y metadatos del destino.

### Fase 5 — Depuración estructural y publicación gradual

**Referencia futura; fuera de la intervención autorizada, salvo las comprobaciones necesarias para validar la Fase 1.**

- Añadir comprobación de tipos, pruebas y compilación automatizadas.
- Asegurar que las pruebas de fórmulas ejerciten las funciones utilizadas por la aplicación; el script actual de unidades contiene una implementación propia.
- Unificar acceso a sesión, tratamiento de errores y tiempos de espera.
- Dividir progresivamente servidor, acceso a datos y estado de captura por responsabilidades.
- Revisar componentes, dependencias y rutas heredadas de Figma; retirar únicamente lo que se demuestre sin uso.
- Cargar bibliotecas de exportación cuando se necesiten.
- Optimizar imágenes de referencia para conexiones móviles.
- Sustituir versiones manuales contradictorias por identificación reproducible del despliegue.
- Reducir registros de depuración con datos completos y conservar información útil para diagnosticar fallos.

Publicar primero las protecciones del servidor y después el autoguardado. Activarlo inicialmente en una planta piloto, manteniendo revisión y guardado manual disponibles.

Todo despliegue de `make-server` debe utilizar `npm run deploy:make-server`, seguido inmediatamente de `npm run check:make-server`, confirmando **`verify_jwt: false`**.

## 5. Interfaces y datos que deben evolucionar

Esta tabla describe el plan general. En la intervención actual se incluyen únicamente los cambios relacionados con guardado, concurrencia, autorización y trazabilidad de la Fase 1.

| Área | Cambio mínimo previsto |
|---|---|
| Guardado de sección | Identificador de operación, revisión esperada y respuesta con revisión confirmada, fecha y avance |
| Concurrencia | Conflicto explícito cuando otra sesión haya modificado la sección |
| Auditoría | Planta obligatoria en eventos de inventario, origen del evento, operación, sección y conteos |
| Actividad del cliente | Canal autenticado para informar actividad y fallos; nunca puede acreditar por sí mismo un guardado remoto |
| Reportes | Filtros de servidor, paginación, totales y orden estable |
| Configuraciones | Exportación versionada y flujo de vista previa/ejecución para restauración |
| Fotografías | Identificador estable de subida, asociación autorizada y estado de sincronización |

La migración será aditiva. Al activar el nuevo protocolo de guardado se exigirá su versión para evitar que clientes antiguos eludan el control de concurrencia. Una sesión antigua recibirá una instrucción de actualización; no se aceptará silenciosamente un guardado inseguro.

## 6. Pruebas y criterios de aceptación

La siguiente matriz conserva el alcance del plan general. Para la Fase 1 se ejecutarán los casos correspondientes a guardado manual parcial, autorización, concurrencia, validación y auditoría. Los casos de autoguardado, recuperación offline, reportes y restauración se reservan para sus fases.

| Escenario | Resultado exigido |
|---|---|
| Crear inventario sin ingresar datos | Visible como iniciado, con cero capturas |
| Ingresar un solo valor y dejar la sección incompleta | Borrador conservado; avance visible después de sincronizar |
| Registrar cero | Se conserva como captura válida |
| Prellenar desde configuración | No se presenta como ingreso manual |
| Cerrar el navegador después de confirmar guardado local | Borrador recuperable |
| Perder conexión durante una foto | Foto pendiente conservada y sincronizable |
| Servidor guarda, pero la respuesta no llega | Reintento recupera el resultado sin duplicar datos ni eventos |
| Editar mientras se está guardando | La respuesta anterior no borra la edición nueva |
| Dos dispositivos modifican la misma sección | Conflicto visible, sin sobrescritura silenciosa |
| Envío simultáneo con guardado | Estado y datos quedan coherentes |
| Usuario desactivado o planta no autorizada | Acceso rechazado también mediante API |
| Modificar inventario enviado/aprobado | Rechazado por servidor |
| Guardar borrador con campos pendientes | Permitido; envío bloqueado hasta completar |
| Filtrar auditoría de Ceiba | Aparecen los eventos correctamente asociados |
| Consultar Guaynabo | Se distingue inicio de inventario de mediciones guardadas |
| Más de 200 inventarios | Todos consultables y exportables mediante filtros/paginación |
| Falla un detalle durante exportación | No se anuncia éxito ni se descarga un reporte aparentemente completo |
| Unidades distintas | Se muestran correctamente; no se suman sin conversión válida |
| Cambiar configuración actual | No altera resultados históricos aprobados |
| Restaurar paquete inválido | Se rechaza sin cambios parciales |
| Restaurar y reexportar configuración | Equivalencia comprobada |
| Navegación móvil con teclado y fotos | Sin controles inaccesibles ni pérdida de cambios |

Se combinarán pruebas unitarias, integración contra el clon y pruebas de navegador. Cámara, suspensión de la aplicación y recuperación se verificarán además en dispositivos reales en la fase correspondiente.

## 7. Cómo comenzar y cuándo considerar resuelto el trabajo

Secuencia original del plan general:

1. Preparar el clon y verificar la correspondencia de versiones.
2. Reproducir Guaynabo vacío y Ceiba parcialmente diligenciado.
3. Corregir asociación y durabilidad de la auditoría.
4. Proteger guardados por estado, rol y revisión.
5. Incorporar recuperación local y autoguardado.
6. Validar captura incompleta visible para administrador y supervisor.
7. Continuar con reportes y configuración reutilizable.

**Aplicación a la autorización actual:** ejecutar solamente la Fase 1 y sus pruebas; verificar los prerrequisitos de entorno, sin interpretar esta secuencia general como autorización para implementar las demás fases. En particular, los pasos de autoguardado, reportes y configuración reutilizable quedan pendientes.

Cada hallazgo tendrá evidencia, impacto, reproducción, corrección, prueba y estado: confirmado, corregido o pendiente de validación.

**Condiciones de cierre del plan general:**

- Ningún problema P0 abierto.
- Capturas parciales recuperables y visibles tras sincronización.
- Auditoría suficiente para distinguir actividad, intento y guardado confirmado.
- Reportes reconciliados con los datos persistidos.
- Restauración de configuraciones comprobada.
- Pruebas críticas aprobadas en el clon y en la planta piloto.
- Despliegue identificado y procedimiento de reversión documentado.

**Cierre de la intervención actual:** satisfacer el criterio de salida de la Fase 1, documentar las pruebas realizadas y señalar expresamente cualquier validación pendiente. El cierre de esta fase no equivale al cierre del plan general.

No se realizará una reescritura completa ni se cambiarán reglas de cálculo históricas sin pruebas de equivalencia. La prioridad será estabilizar lo existente y demostrar cada mejora con casos reproducibles.
