# Análisis de impacto — métodos de medición de Aditivos

## Situación anterior

El módulo distinguía `TANK` y `MANUAL`. Los tanques usaban interpolación lineal de
`conversion_table` y el servidor recalculaba el volumen. Sin embargo, la tabla usada
por el endpoint de inventario provenía del payload del cliente. Por tanto, el cálculo
era servidor-side pero su configuración no era autoritativa.

## Impacto del cambio

- `TANK`, `TANK_LEVEL` y `CALIBRATION_CURVE` continúan funcionando como alias de
  `CURVE`; no se reescriben inventarios históricos.
- `MANUAL_QUANTITY` continúa funcionando como alias de `MANUAL`.
- Se añaden `CYLINDER_VERTICAL` y `RECTANGULAR_IBC` sin tablas de calibración.
- El servidor carga siempre método, curva, dimensiones, capacidad y unidades desde
  `plant_additives_config`.
- Cada captura conserva un snapshot de la configuración efectiva, sus unidades,
  porcentaje, volumen visible y cantidad de inventario.
- Fotografías, notas, arrastre, reportes y auditoría conservan sus claves existentes.

## Decisión de datos

Se amplía `plant_additives_config` en lugar de crear una tabla por estrategia. La
relación es uno-a-uno, los parámetros son pequeños y mutuamente excluyentes, y las
restricciones se validan en el registro de estrategias. Esto evita joins y ciclos de
vida adicionales sin impedir agregar estrategias futuras.

## Riesgos controlados

- Configuración geométrica inválida: rechazada al guardar configuración y al calcular.
- Manipulación del cliente: los campos calculables del payload se ignoran.
- Diferencias entre capacidad nominal y geométrica: el volumen se limita a la
  capacidad nominal y el porcentaje nunca supera 100%.
- Unidades incompatibles: se rechazan si no existe conversión estándar o factor de
  material aplicable.
