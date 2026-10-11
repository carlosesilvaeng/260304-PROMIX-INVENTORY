# Administrador con funciones de supervisor

Una persona mantiene su cuenta y rol de administrador. En **Configuración → Usuarios → Editar**, marca **También supervisor**, selecciona sus plantas y guarda. Puede consultar todas las plantas como administrador, pero sólo registrar, guardar y enviar inventarios en las plantas asignadas y activas. El permiso está desactivado por defecto, también para superadministradores.

La cuenta conserva Configuración, Reportes, Auditoría y Reporte de Fotos. Inventario Mensual abre el selector de sus plantas operativas. Cada acción queda registrada bajo la misma identidad.

Otra cuenta debe aprobar el inventario enviado por esa persona. Se compara el ID del remitente, no su nombre. Para inventarios pendientes anteriores se recupera el último remitente registrado en auditoría; cuando falta esa identidad, la aprobación queda bloqueada y la interfaz lo explica. Retirar el permiso bloquea escrituras; los borradores locales no se borran.

## Arreglo de exportación

Producción carecía de `20261004200000_configuration_packages.sql`. Se instaló esa migración y se recargó la caché. Además, `configuration_import` necesitaba incluir el esquema `extensions` para encontrar `pgcrypto.digest` en Supabase; lo corrige `20261011131000_configuration_crypto_search_path.sql`.

La migración `20261011130000_admin_supervisor_capability.sql` agrega el permiso y el ID del remitente, protege captura y aprobación, y restringe la función de auditoría de captura al servidor. Se registra cada migración aplicada dentro de su propia transacción.

El cliente muestra un solo mensaje comprensible ante una función de configuración faltante y detiene las exportaciones pendientes. Los errores específicos de una planta siguen identificándola.

La migración pendiente de productos conserva este permiso si se instala después; se añadió sólo esa compatibilidad de autorización y no se desplegó dicha migración en este trabajo.

## Verificación

- `npm run test:admin-supervisor`: permisos por rol, asignación, actividad, revocación y autoaprobación.
- `npm run test:admin-supervisor-db`: funciones reales, remitentes históricos, auditoría y ejecución restringida, en una base local desechable.
- `python3 scripts/test-admin-supervisor-db.py --without-pending-products`: verifica también el orden inverso de instalación de la migración de productos.
- `npm run test:admin-supervisor-browser`: selector operativo, edición del permiso y revocación con datos simulados; requiere Playwright/Chrome o `PROMIX_PLAYWRIGHT_MODULE`.
- `npm run test:configuration-package`, `npm run test:configuration-package-db` y `npm run test:configuration-package-browser`: JSON, Excel, importación, conflictos y errores comunes.

El servidor se despliega con `npm run deploy:make-server` y se comprueba inmediatamente con `npm run check:make-server`; debe reportar `verify_jwt: false`.

En producción se verificó la exportación de las seis plantas mediante resultados resumidos y el reconocimiento de la función por la API. La vista previa se comprobó en una planta compatible y se revirtió la transacción. Las configuraciones antiguas que el validador detecta como incompletas deben normalizarse antes de importarlas; no se modificaron sus equipos.

La interfaz debe publicarse mediante el flujo habitual del sitio. No se habilitaron cuentas individuales ni se incluyeron los cambios ajenos pendientes en el despliegue del servidor.
