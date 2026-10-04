# Reportes: filtros, orden y eliminación auditada

Estado: implementado, validado localmente y autorizado por el usuario para publicar en producción. Migración y servidor publicados; publicación de interfaz y verificación final en curso. No se eliminaron inventarios reales.

## Cambios

- Fotos: filtro por sección, normalización de Productos/Aceites y Productos y Caja Chica/Petty Cash; orden ascendente/descendente desde Planta, Sección y Fecha/Hora. Los indicadores y el total reflejan el filtro de sección. Fechas comparadas como instantes y nombres en español, con desempate estable por identificador.
- Reportes: orden por última actividad recibido antes de paginar; fecha calculada como máximo de creación, actualización, evento y recibo de guardado. Incluye el orden en la exportación de todos los resultados y detecta cambios de actividad durante la paginación. En progreso se presenta en rojo.
- Eliminar: conserva el diálogo previo con planta y período y exige confirmación explícita en el servidor con identidad y revisión. El borrado y REPORT_DELETED se confirman en una única transacción. Si falla auditoría, se revierten mes y registros hijos. Solo administradores activos pueden ejecutar esta operación.
- Auditoría: etiqueta Inventario eliminado; el evento conserva usuario, planta, período, revisión y cantidades por tabla. Permanece visible por período aunque el mes ya no exista.
- Fotos tras eliminar: limpieza posterior a confirmar la transacción; objetos phase2 reutilizables conservados; advertencias de limpieza visibles en el resultado. El evento de eliminación ya está persistido aunque falle la limpieza o su actualización informativa.

## Validación

- Compilación del cliente y comprobación de imports/sintaxis del servidor correctas.
- 20 pruebas de reportes/transporte/API correctas, incluido rechazo de borrado sin confirmación.
- PostgreSQL temporal: 45 migraciones aplicadas; orden antes de paginar, actividad por eventos, detección de cambios, permisos, revisión obsoleta, borrado de hijos, log por período y reversión ante fallo de auditoría comprobados.
- Chrome con API sintética: filtro de fotos, tres encabezados ordenables, orden de actividad, cancelar sin DELETE y confirmar con identidad/revisión comprobados. Regresiones de 251 reportes, filtros, descargas reales Excel/PDF y móviles 360/390/430 correctas.

## Publicación pendiente

Publicar coordinadamente la migración `20261004210000_report_sort_and_audited_delete.sql`, servidor y cliente. La migración depende de guardado y reportes, ya aplicados en producción durante la corrección anterior; no requiere la migración independiente de paquetes de configuración. No aplicar pendientes ajenos a este cambio por accidente.

El cliente nuevo debe estar disponible al publicar el servidor que exige el cuerpo de confirmación: una interfaz antigua no podrá eliminar hasta recargarse. Ejecutar `npm run deploy:make-server` y después inmediatamente `npm run check:make-server`; confirmar `verify_jwt: false`.

La prueba remota posterior debe ser de solo lectura para orden y filtros; no eliminar inventarios reales para validar el cambio.
