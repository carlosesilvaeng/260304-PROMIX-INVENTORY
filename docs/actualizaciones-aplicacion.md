# Actualización de la aplicación

Cada compilación publica `app-version.json` con el mismo identificador incorporado en la aplicación. La comprobación usa una petición sin caché y vence después de cinco segundos; los errores no bloquean el acceso ni el trabajo sin conexión.

Antes de mostrar el acceso y al iniciar o restaurar una sesión se comprueba la versión. Una versión diferente provoca una navegación nueva si no hay cambios, carga de inventario o fotografías en preparación. La sesión y los borradores permanecen en su almacenamiento habitual. Un control por pestaña evita recargas automáticas repetidas si el servidor devuelve todavía el documento anterior.

Durante la sesión se comprueba cada minuto mientras la aplicación esté visible, al volver a la pestaña y al recuperar conexión. Si hay una versión diferente se muestra un aviso. El usuario sigue trabajando y utiliza el guardado habitual. **Actualizar ahora** permanece deshabilitado mientras haya cambios pendientes, sincronización, conflictos, fotos en preparación, carga de inventario o falta de conexión. Una vez confirmado el guardado puede pulsarlo; la aplicación no interrumpe automáticamente una captura en curso.

El servidor debe servir el archivo de versión de la misma publicación que los recursos de la aplicación. No requiere cambios ni despliegue de `make-server`. Los usuarios con una versión anterior a esta funcionalidad necesitan cargar esta publicación una primera vez.

Validación: `npm run test:app-update`, `npm run test:app-update-browser` (requiere Playwright y Chrome), `npm run build`. Las pruebas de navegador usan únicamente una aplicación de prueba local y datos simulados.
