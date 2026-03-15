# Curvas de Conversión: estado actual y plan de importación v2

## Estado actual
- `calibration_curves` es un catálogo por planta con unicidad `(plant_id, curve_name)`.
- `AdditivesConfigModal` usa la curva como plantilla: copia `reading_uom` y `data_points` hacia `plant_additives_config.conversion_table`.
- Diesel guarda `calibration_curve_name`, pero también persiste su propia `calibration_table`.
- Silos solo usan `curve_name` por convención (`SILO*`) como referencia nominal.
- Productos no dependen del catálogo de curvas.

## Implicaciones
- La curva no es hoy una fuente viva única de verdad.
- Renombrar curvas puede romper referencias nominales en silos, diesel y aditivos.
- Cambiar `data_points` no propaga automáticamente a configuraciones que ya copiaron la tabla.
- Un flujo `replace` sería riesgoso porque podría borrar curvas todavía referenciadas.

## Recomendación v2
- Importar curvas por planta seleccionada, no multi-planta.
- Soportar solo `upsert` por `curve_name` en la primera versión.
- Bloquear renombres y deletes desde la importación inicial.
- Mostrar preview con impacto:
  - curvas nuevas
  - curvas actualizadas
  - posibles referencias existentes por nombre
- Si se quiere propagación real más adelante, primero migrar el modelo para que diesel/aditivos resuelvan por `curve_id` o join vivo, no por copia JSON/nombre.

## Nota técnica
- `getPlantConfigPackage` todavía intenta resolver `calibration_curve_id` legacy. Conviene revisarlo antes de una fase posterior de refactor o importación avanzada.
