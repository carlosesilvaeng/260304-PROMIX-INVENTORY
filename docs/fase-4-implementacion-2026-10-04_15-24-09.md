# Fase 4 — Exportar y reutilizar configuraciones

Fecha: 2026-10-04 15:24:09 (America/Bogota, UTC−05:00).

## Estado

La Fase 4 autorizada está implementada en el repositorio, sobre el commit `9b07cb6` de la Fase 3, y validada localmente. No se hizo commit, push, migración remota ni despliegue. La aceptación autenticada en el clon de Supabase y la publicación siguen pendientes. Se conservaron los cambios y archivos ajenos que ya existían en el directorio, incluido el cambio de README y las migraciones de Ceiba.

## Resultado para el administrador

En **Configuración → Plantas → Exportar y reutilizar configuraciones**:

1. Seleccionar la planta de origen y descargar **Excel completo** o **Guardar JSON**. También se puede descargar un Excel de todas las plantas.
2. Para importar, cargar un JSON exportado o usar la configuración actual de la planta de origen para copiar.
3. Seleccionar explícitamente una planta destino existente.
4. Elegir, si corresponde, autorizar dependencias compartidas faltantes o desactivar configuraciones adicionales. Ambas opciones están desactivadas inicialmente.
5. Pulsar **Revisar diferencias** y revisar elementos, acciones, campos anteriores/nuevos, advertencias y errores.
6. Pulsar **Aplicar configuración revisada** sólo después de una revisión válida.

El panel está reservado para administradores y superadministradores. La base de datos vuelve a verificar rol y estado activo; ocultar el panel no es la autorización del servidor.

## Exportación

### Alcance

Incluye las siete secciones operativas: agregados/cajones, silos, aditivos, diésel, aceites/productos, utilidades y caja chica. Incluye activos e inactivos, métodos, orden, obligatoriedad de fotografías, dimensiones, capacidades, geometría, unidades y parámetros disponibles en las tablas actuales.

El paquete contiene 18 tablas: categorías y unidades, materiales, procedencias, catálogo de aditivos, factores de conversión, curvas, ocho tablas de configuración de planta, reglas de medición, puntos de calibración y productos permitidos por silo. Los cinco catálogos globales se incluyen completos. Factores y reglas incluyen las definiciones globales pertinentes y las de la planta; las reglas globales de equipos de otras plantas quedan excluidas.

La extracción completa es independiente de la consulta de configuración activa utilizada para prellenar inventarios. No se amplió ese prellenado ni se incorporaron equipos inactivos al ingreso operativo.

### Excel

- Veinte hojas principales: resumen, parámetros de planta y las 18 tablas, con encabezados en español, filtros y encabezados congelados.
- Números como celdas numéricas, fechas identificadas, cero real y estados activos/inactivos conservados. No se resumen ni omiten puntos de calibración.
- Los decimales que exceden 15 cifras significativas o la representación numérica disponible se conservan también como texto en **Valores exactos**, con una nota en el resumen. Los números muy pequeños utilizan notación científica para no verse como cero.
- Contenidos extensos se dividen en **Datos extendidos**, identificando planta, sección, registro, parámetro y parte, sin exceder el límite de caracteres por celda. El valor original completo permanece en el JSON. Las celdas extensas pueden consultarse en la barra de fórmulas de Excel.
- Si falla la consulta de alguna planta, no se descarga un Excel parcial. Hasta tres consultas simultáneas y cancelación antes de descargar.

### JSON

Formato `promix-plant-configuration`, versión `1`, con fecha UTC, origen, identidad de planta, esquema, contenido y SHA-256 calculado sobre contenido y metadatos.

Las columnas PostgreSQL NUMERIC se transportan como texto decimal acompañado de `numeric_fields`. Las columnas JSONB se transportan como texto JSON exacto acompañado de `json_fields`; así los decimales dentro de tablas y curvas tampoco pasan por una conversión que pierda precisión en JavaScript. Al aplicar, el servidor de base de datos reconstruye sus tipos originales.

El archivo admite hasta 10 MB y hasta 10.000 filas por tabla. Si la presentación con sangría excede 10 MB, la descarga usa JSON compacto para que el propio archivo exportado pueda volver a cargarse. Se rechazan versiones no compatibles, datos alterados, secciones incompletas, identificadores duplicados y campos no declarados. El checksum detecta alteración o corrupción; no es una firma de autenticidad ni reemplaza los permisos de importación.

## Vista previa, dependencias y aplicación

- La vista previa prueba las escrituras y restricciones reales en una subtransacción y revierte los cambios de configuración. Guarda el resultado de revisión y su evento de auditoría, sin aplicar la configuración.
- Reutiliza dependencias compartidas existentes sólo si sus definiciones funcionales coinciden. Un conflicto bloquea la importación; no sobrescribe catálogos globales.
- Crear una dependencia compartida faltante requiere activar la opción correspondiente. Su creación también queda expuesta en la revisión.
- Al copiar, se mapean identificadores y relaciones por tabla; las referencias a unidades, factores, curvas, equipos, aditivos de catálogo, puntos y productos permitidos se traducen al destino. Referencias ausentes o ambiguas bloquean la revisión.
- En una restauración del mismo entorno y planta se pueden conservar los identificadores de equipos que ya pertenecen al destino, incluso si cambiaron de nombre desde el respaldo. No se adopta ciegamente una identidad de otro entorno o planta.
- Por defecto se conservan las configuraciones adicionales del destino. Su desactivación requiere una opción explícita y aparece como diferencia; no se eliminan sus identidades ni sus inventarios históricos.
- Los puntos de curvas y productos permitidos de los silos importados son relaciones completas del paquete y reemplazan sus relaciones anteriores. Esto se anuncia antes de aplicar.
- Se copian los parámetros operativos de métodos y caja chica. Nombre, código, ubicación, estado, imágenes y arreglos antiguos embebidos de la planta destino permanecen locales; el JSON conserva el contexto del origen.
- Si el origen tiene equipos únicamente en los arreglos antiguos embebidos y carece de sus configuraciones normalizadas, la revisión se bloquea con una explicación. Es necesario normalizarlos antes de copiar; no se presenta una restauración parcial como completa.

La revisión queda ligada a usuario, destino, archivo y opciones; caduca a los 15 minutos. Cambiar archivo, destino u opciones elimina la revisión del cliente. El servidor verifica además una huella del destino y de sus dependencias: un cambio posterior obliga a revisar de nuevo. Un bloqueo breve de las tablas de configuración también serializa escrituras realizadas por los endpoints anteriores, que no bloqueaban la planta.

La aplicación de una planta, su evento **Configuración importada** y su recibo se confirman en la misma transacción. Si falla la auditoría, se revierte todo. Reintentar con la misma revisión ya consumida devuelve su confirmación sin volver a escribir ni duplicar el evento. Una respuesta de red desconocida no se presenta como importación confirmada; la pantalla conserva la revisión para reintentar o consultar la configuración.

## Validación realizada

| Comprobación | Resultado |
|---|---|
| Compilación de producción del cliente | Correcta |
| Imports y sintaxis del servidor | Correctos; no equivale a ejecutar la función remota |
| Paquete, checksum, transporte y Excel | 12 pruebas correctas |
| Regresiones de guardado, sincronización, API, fotos y reportes | 63 pruebas correctas |
| PostgreSQL local desechable | 44 migraciones reales aplicadas; base eliminada al terminar |
| Exportar → copiar → reexportar | Equivalencia comprobada en todas las filas de las 18 tablas tras mapear referencias, salvo identificadores/metadatos del destino |
| Copia entre entornos simulados | Todos los identificadores de catálogos cambiados; referencias traducidas y equivalencia de las 18 tablas comprobada |
| Restauración en la misma planta | Revierte un nombre cambiado conservando la identidad del equipo |
| Precisión | Decimales NUMERIC y decimales dentro de JSONB conservados en el recorrido de base de datos |
| Vista previa | Restricciones reales verificadas, sin persistir los cambios de configuración |
| Históricos y adicionales | Registro aprobado con cero permanece intacto; adicionales conservados o desactivados expresamente |
| Permisos e integridad de revisión | Roles, usuario inactivo, propietario de token, digest, caducidad y permisos RPC comprobados |
| Atomicidad | Fallo provocado de auditoría revierte configuración y recibo |
| Concurrencia real | Dos conexiones: importación espera una edición, detecta el cambio confirmado y no aplica nada |
| Navegador de configuraciones | JSON y Excel descargados realmente; destino explícito, diferencias, invalidación, conflictos, archivo alterado, cancelación, servidor anterior y recuperación de respuesta perdida |
| Móvil de configuraciones | Sin desbordamiento externo a 360, 390 y 430 píxeles |
| Excel descargado | Reabierto; números, cero, inactivos y puntos comprobados; 20 hojas renderizadas y revisadas visualmente |
| Regresiones en PostgreSQL | Guardado transaccional, autorización, auditoría, carreras de envío, reportes, filtros y avance correctos con las 44 migraciones |
| Navegador de ingreso y reportes | Recuperación offline/fotos, IndexedDB, sincronización, 251 reportes, filtros y exportaciones correctos |

Las llamadas remotas de los navegadores fueron interceptadas con respuestas sintéticas. No se utilizaron cuentas, inventarios ni datos reales de producción. Las pruebas del navegador y SQL verifican las capas por separado; falta la prueba integrada con la función desplegada y cuentas reales del clon.

La compilación mantiene los avisos conocidos de tamaño del paquete e imports compartidos de Excel. Las pruebas cubren datos representativos; no constituyen una medición de rendimiento para el máximo de filas admitido. La limpieza periódica de revisiones vencidas y la evaluación de ese volumen quedan para mantenimiento posterior.

## Archivos principales

- `supabase/migrations/20261004200000_configuration_packages.sql`: extracción, normalización de representación exacta, mapeo, revisión, transacción, permisos, recibos y auditoría.
- `supabase/functions/make-server/configuration_package.ts`: formato y comprobaciones compartidas.
- `supabase/functions/make-server/index.ts`: endpoints autenticados de exportación, revisión y aplicación.
- `src/app/pages/settings/ConfigurationTransferPanel.tsx`: flujo visible y revisión de diferencias.
- `src/app/utils/configurationTransport.ts`, `configurationWorkbook.ts`, `configurationPackages.ts`, `exportPlantConfigurations.ts`: transporte, representación y descargas.
- `scripts/test-configuration-package.mjs`, `test-configuration-package.sql`, `test-configuration-package-db.py`, `test-configuration-package-browser.mjs`, `configuration-fixtures.mjs`: pruebas y datos sintéticos.
- `package.json`: comandos de prueba nuevos. `Settings.tsx` y `AuditPanel.tsx`: integración del panel y nombres de eventos.

## Aceptación en clon y publicación pendiente

1. Preparar el clon con las fases anteriores y aplicar `20261004200000_configuration_packages.sql` allí. Esta migración crea funciones y una tabla de revisiones; no importa configuraciones por sí sola.
2. Desplegar el servidor actualizado en el clon y comprobar `configuration_version: 1`, autorización y rechazo de archivos alterados con cuentas del clon.
3. Publicar el cliente de prueba. Exportar una planta representativa con los siete módulos, inactivos, geometría, unidades, factores y curvas completas.
4. Cargar el JSON en una planta destino del clon; comprobar diferencias, creación explícita de dependencias, ausencia de cambios antes de aplicar y auditoría posterior.
5. Volver a exportar y comparar todas las definiciones tras mapear identificadores. Probar además conflictos compartidos, edición simultánea, revisión vencida y un inventario histórico aprobado que no debe cambiar.
6. Tras aceptar el clon, publicar en el destino autorizado en este orden: migración, servidor y cliente. El cliente anterior y el servidor anterior no acreditan soporte del formato nuevo; el cliente nuevo comunica explícitamente si falta la versión del servidor.

Para producción, las instrucciones del repositorio exigen `npm run deploy:make-server`, seguido de `npm run check:make-server`, y verificar que la función desplegada informe `"verify_jwt": false`. Los scripts actuales apuntan al proyecto de producción; no deben usarse tal cual para desplegar el clon. No se ejecutaron en esta intervención.

El paquete de configuración no incluye usuarios, inventarios ni objetos fotográficos y no sustituye un respaldo completo. La Fase 5 permanece pendiente y no forma parte de esta implementación.
