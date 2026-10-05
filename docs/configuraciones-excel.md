# Configuraciones de plantas con Excel

En **Configuración → Plantas**, selecciona una planta y pulsa **Exportar Excel**. También puedes descargar las configuraciones de todas las plantas en un archivo.

1. Abre el `.xlsx` y consulta la hoja **Instrucciones**.
2. Edita las celdas azules. Para agregar equipos, usa las 100 filas vacías preparadas al final de cada hoja y selecciona la planta de origen.
3. Selecciona las unidades y dependencias de las listas. Para una dependencia nueva, escribe su nombre o código único. Los identificadores se generan al cargar.
4. Para retirar un equipo, cambia **Activo** a **No**. Borrar una fila no elimina automáticamente el equipo del destino.
5. Guarda como `.xlsx` y pulsa **Cargar Excel**. Si contiene varias plantas, selecciona una configuración de origen.
6. Selecciona explícitamente la planta destino, pulsa **Revisar diferencias** y comprueba los cambios antes de **Aplicar configuración revisada**.

Los registros adicionales del destino se conservan por defecto. Su desactivación y la creación de dependencias compartidas requieren marcar las casillas correspondientes. Los catálogos compartidos existentes incompatibles bloquean la aplicación.

Las curvas, sus puntos y los datos estructurados protegidos se editan desde sus pantallas habituales. Al seleccionar otra curva existente, sus datos se incorporan al equipo. Los decimales que exceden la precisión de Excel se guardan como texto exacto; conserva ese formato.

Las fórmulas, referencias ambiguas o inexistentes y filas duplicadas bloquean la carga. Los errores indican hoja, fila y columna. Los Excel documentales anteriores deben volver a exportarse para obtener el formato editable.

JSON está disponible en **Mostrar opciones avanzadas (JSON)**, desmarcado por defecto. El archivo de configuración no contiene usuarios, inventarios históricos ni fotografías y no sustituye un respaldo completo.
