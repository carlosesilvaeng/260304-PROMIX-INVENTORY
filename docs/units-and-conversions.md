# Unidades y conversiones

PROMIX maneja unidades por contexto. No existe una unidad global unica para todo el sistema: cada planta, seccion, tipo de inventario, material y equipo puede resolver unidades distintas.

## Tipos de unidad por configuracion

- Unidad de captura: unidad en la que el usuario mide en campo, por ejemplo `ft`, `m` o `in`.
- Unidad de calculo: unidad normalizada para formulas internas de la seccion.
- Unidad visible: unidad que se muestra al usuario operativo.
- Unidad de inventario: unidad usada para inventario o contabilidad.

La configuracion vive en `measurement_configs` y se resuelve con esta jerarquia:

1. planta + seccion + material/equipo
2. planta + seccion
3. tipo de inventario
4. default global, solo como fallback

## Conversiones estandar

Las conversiones fisicas dentro de la misma categoria usan `units.factor_to_base`.

Ejemplos:

- longitud: base `m`
- area: base `m2`
- volumen: base `m3`
- capacidad: base `gal_us`
- masa: base `lb`
- conteo: base `unit`

Formula:

```text
valor_base = valor * factor_to_base_origen
valor_destino = valor_base / factor_to_base_destino
```

No se permite convertir entre categorias distintas con conversion estandar. Por ejemplo, `m3` a `lb` no es universal.

## Factores por material

Las conversiones dependientes del material se guardan en `material_conversion_factors`. Se usan para reglas como arena `m3 -> lb`, piedra `m3 -> lb` o cemento `sack -> lb`.

Estos factores pueden ser globales o especificos por planta y deben incluir una fuente operativa o contable en `factor_source`.

## Curvas de calibracion

Las curvas de calibracion se mantienen en `calibration_curves` y `calibration_curve_points`. Se usan cuando una lectura de campo no es una conversion fisica universal, por ejemplo `in -> gal_us` en tanques de aditivos o diesel.

Los campos legacy `point_key` y `point_value` siguen representando lectura y salida. Los campos nuevos de la curva (`input_unit_id`, `output_unit_id`, `method`, `equipment_id`, `material_id`) documentan el contexto.

## Agregar una unidad

1. Crear o reutilizar una categoria en `unit_categories`.
2. Insertar la unidad en `units` con `factor_to_base` hacia la base de su categoria.
3. No insertar conversiones inversas duplicadas; el sistema calcula ambos sentidos con `factor_to_base`.
4. Activar la unidad y definir `decimal_precision` para UI.

## Configurar una planta/seccion/material

1. Elegir la planta y `section_code` (`aggregates`, `additives`, `silos`, `diesel`, `products`, `utilities`).
2. Definir `capture_unit_id`, `calculation_unit_id`, `display_unit_id` e `inventory_unit_id`.
3. Si la unidad de inventario cruza categorias, seleccionar `material_conversion_factor_id`.
4. Si la captura cruza categorias por lectura de equipo, seleccionar `calibration_curve_id`.
5. Mantener una sola configuracion activa por contexto especifico.

Los nombres de columnas legacy como `box_width_ft`, `calculated_volume_cy` y `calculated_gallons` permanecen por compatibilidad. La unidad real se interpreta desde la configuracion contextual.
