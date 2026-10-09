# Apariencia de la aplicación

En **Configuración → Apariencia**, un usuario **Admin o Super Admin** puede seleccionar **Original** o **Command** y pulsar **Guardar para toda la empresa**. Seleccionar una muestra no guarda ni aplica el cambio hasta confirmar con el botón.

- **Original** conserva los colores anteriores y es la opción inicial.
- **Command** adapta los colores de las capturas de Command Cloud: superficies claras, navegación azul pálido, azul petróleo y bordes gris lavanda.
- Los colores de error, advertencia y éxito mantienen su significado. Logos, disposición, reglas de negocio, cálculos y formatos de exportación permanecen iguales.

La elección se guarda por separado en `appearance_config`, dentro del almacenamiento de configuración existente. El servidor permite consultar la configuración con una sesión válida y solo permite guardarla a Admin y Super Admin. No se requieren migraciones de inventario.

El dispositivo que guarda aplica la paleta al recibir la confirmación. Los demás la consultan al iniciar sesión, volver a la aplicación, recuperar conexión y cada 60 segundos mientras estén visibles. Un dispositivo sin conexión conserva la última paleta confirmada; si aún no tiene una, utiliza Original. El cambio no recarga la pantalla ni descarta formularios o borradores.

## Verificación

- `npm run build`
- `npm run test:appearance`: permisos, validación, metadatos, valores iniciales, aislamiento de configuración y errores.
- `npm run test:appearance-browser`: aplicación compilada en Chrome, con datos sintéticos y solicitudes remotas interceptadas; Admin/Super Admin, sincronización, errores, respuesta antigua, persistencia, móvil y formulario sin guardar.

La prueba de navegador requiere Playwright y Chrome. Se puede indicar el módulo mediante `PROMIX_PLAYWRIGHT_MODULE`. Para comparar Original con una compilación anterior, usar `PROMIX_BASELINE_DIST`. Las capturas se guardan en `outputs/appearance-palettes`.

## Publicación

Publicar el frontend con el procedimiento habitual del proyecto. Para el servidor ejecutar **`npm run deploy:make-server`** y después **`npm run check:make-server`**; confirmar **`"verify_jwt": false`**. La protección de las rutas de apariencia se realiza con los permisos internos del servidor.
