# Arquitectura de medición de Aditivos

## Contrato

`calculateAdditiveMeasurement(config, input)` es un motor puro. Normaliza aliases y
despacha una estrategia registrada:

| Estrategia | Entrada | Configuración | Resultado |
|---|---|---|---|
| `MANUAL` | cantidad | ninguna | cantidad |
| `CURVE` | lectura | `conversion_table` | interpolación lineal |
| `CYLINDER_VERTICAL` | altura de líquido | diámetro, altura, capacidad | `πr²h` |
| `RECTANGULAR_IBC` | altura de líquido | largo, ancho, altura, capacidad | `largo × ancho × h` |

Los métodos geométricos convierten dimensiones a la longitud base, calculan volumen
en la unidad cúbica base y lo convierten a la unidad de cálculo. La capacidad se
convierte a esa misma unidad antes de limitar el resultado.

## Flujo autoritativo

```text
payload (lectura/cantidad/foto/notas)
  -> autorización del mes y planta
  -> carga de plant_additives_config
  -> resolución de measurement_config por equipo
  -> estrategia + validación
  -> cálculo -> visualización -> inventario
  -> persistencia atómica del resultado y snapshot
```

La UI ejecuta el mismo motor únicamente para vista previa. El resultado persistido
siempre es el recalculado por `make-server`.

## Extensibilidad

Una estrategia futura (`CYLINDER_HORIZONTAL`, `RECTANGULAR_TANK` o
`CUSTOM_FORMULA`) se agrega al tipo, normalizador y registro del motor. No debe
modificar las fórmulas de las estrategias existentes.
