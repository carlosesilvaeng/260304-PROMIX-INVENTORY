# Plan de migración — métodos de Aditivos

## Preparación

1. Ejecutar pruebas del motor, pruebas de unidades y `npm run build`.
2. Revisar que los registros legados con tanque tengan curva y tabla válidas.
3. Respaldar `plant_additives_config` e `inventory_additives_entries`.

## Aplicación

1. Aplicar `20260708143000_add_additive_measurement_strategies.sql`.
2. Verificar columnas y las funciones atómicas especializadas.
3. Configurar los nuevos equipos desde Administración; no modificar históricos.
4. Desplegar con `npm run deploy:make-server`.
5. Ejecutar inmediatamente `npm run check:make-server` y confirmar
   `"verify_jwt": false`.

## Verificación

- Guardar una curva existente y comparar el resultado con el histórico.
- Guardar cilindro e IBC con vacío, mitad y lleno.
- Manipular en una prueba el resultado y las dimensiones del payload; verificar que
  el servidor persiste el cálculo basado en configuración.
- Confirmar fotografías, exportación, auditoría y recarga del mes.

## Reversión

Revertir primero frontend y función. Las columnas nuevas son aditivas y pueden
permanecer sin afectar el código anterior. No eliminar columnas ni snapshots durante
la reversión inmediata; hacerlo requeriría una migración posterior y respaldo.
