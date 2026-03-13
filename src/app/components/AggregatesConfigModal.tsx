import React, { useEffect, useState } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import {
  getMateriales,
  getPlantConfig,
  getProcedencias,
  updatePlantAggregatesConfigEntries,
} from '../utils/api';
import type { Plant } from '../contexts/AuthContext';

type AggregateMeasurementMethod = 'BOX' | 'CONE';

interface AggregateConfigRow {
  id?: string;
  aggregate_name: string;
  material_type: string;
  location_area: string;
  measurement_method: AggregateMeasurementMethod;
  unit: string;
  box_width_ft: string;
  box_height_ft: string;
  is_active: boolean;
}

function createEmptyRow(): AggregateConfigRow {
  return {
    aggregate_name: '',
    material_type: '',
    location_area: '',
    measurement_method: 'BOX',
    unit: 'CUBIC_YARDS',
    box_width_ft: '',
    box_height_ft: '',
    is_active: true,
  };
}

function mapCajonToAggregateRow(cajon: Plant['cajones'][number]): AggregateConfigRow {
  return {
    aggregate_name: cajon.name || '',
    material_type: cajon.material || '',
    location_area: cajon.procedencia || '',
    measurement_method: 'BOX',
    unit: 'CUBIC_YARDS',
    box_width_ft: String(cajon.ancho ?? ''),
    box_height_ft: String(cajon.alto ?? ''),
    is_active: true,
  };
}

export function AggregatesConfigModal({
  plant,
  onSaved,
  onClose,
}: {
  plant: Plant;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<AggregateConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materialOptions, setMaterialOptions] = useState<string[]>([]);
  const [procedenciaOptions, setProcedenciaOptions] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([getMateriales(), getProcedencias()])
      .then(([materialesResponse, procedenciasResponse]) => {
        if (materialesResponse.success) {
          setMaterialOptions((materialesResponse.data || []).map((item: any) => item.nombre).filter(Boolean));
        }

        if (procedenciasResponse.success) {
          setProcedenciaOptions((procedenciasResponse.data || []).map((item: any) => item.nombre).filter(Boolean));
        }
      })
      .catch((catalogError) => {
        console.error('❌ Error cargando catalogos de agregados:', catalogError);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    getPlantConfig(plant.id)
      .then((response) => {
        if (!response.success) {
          setError(response.error ?? 'Error cargando agregados');
          return;
        }

        const aggregateEntries = response.data?.aggregates ?? [];
        const legacyCajones = response.data?.cajones ?? plant.cajones ?? [];

        if (aggregateEntries.length === 0) {
          setRows(legacyCajones.map(mapCajonToAggregateRow));
          return;
        }

        const loadedRows = aggregateEntries.map((entry: any) => ({
          id: entry.id,
          aggregate_name: entry.aggregate_name || '',
          material_type: entry.material_type || '',
          location_area: entry.location_area || '',
          measurement_method: String(entry.measurement_method || 'BOX').toUpperCase() === 'CONE' ? 'CONE' : 'BOX',
          unit: entry.unit || 'CUBIC_YARDS',
          box_width_ft: entry.box_width_ft === null || entry.box_width_ft === undefined ? '' : String(entry.box_width_ft),
          box_height_ft: entry.box_height_ft === null || entry.box_height_ft === undefined ? '' : String(entry.box_height_ft),
          is_active: entry.is_active ?? true,
        })) as AggregateConfigRow[];

        setRows(loadedRows);
      })
      .catch(() => setError('Error de conexion cargando agregados'))
      .finally(() => setLoading(false));
  }, [plant.id, plant.cajones]);

  const updateRow = (index: number, updates: Partial<AggregateConfigRow>) => {
    setRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...updates } : row)));
  };

  const buildSelectOptions = (
    values: string[],
    currentValue: string,
    emptyLabel: string
  ) => {
    const normalizedValues = [...values];
    if (currentValue.trim() && !normalizedValues.includes(currentValue.trim())) {
      normalizedValues.unshift(currentValue.trim());
    }

    return [
      { value: '', label: emptyLabel },
      ...normalizedValues.map((value) => ({ value, label: value })),
    ];
  };

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleMethodChange = (index: number, measurementMethod: AggregateMeasurementMethod) => {
    updateRow(index, {
      measurement_method: measurementMethod,
      box_width_ft: measurementMethod === 'BOX' ? rows[index].box_width_ft : '',
      box_height_ft: measurementMethod === 'BOX' ? rows[index].box_height_ft : '',
    });
  };

  const validateRows = () => {
    const normalizedNames = new Set<string>();

    for (const [index, row] of rows.entries()) {
      const label = row.aggregate_name.trim() || `Fila ${index + 1}`;
      const normalizedName = row.aggregate_name.trim().toUpperCase();

      if (!normalizedName) {
        return `El agregado en la fila ${index + 1} debe tener nombre`;
      }

      if (normalizedNames.has(normalizedName)) {
        return `Hay nombres de agregados repetidos. Revisa "${label}"`;
      }
      normalizedNames.add(normalizedName);

      if (!row.measurement_method) {
        return `${label}: el metodo de medicion es requerido`;
      }

      if (!row.material_type.trim()) {
        return `${label}: el material es requerido`;
      }

      if (!row.location_area.trim()) {
        return `${label}: la procedencia es requerida`;
      }

      if (row.measurement_method === 'BOX') {
        if (row.box_width_ft.trim() === '' || Number.isNaN(Number(row.box_width_ft))) {
          return `${label}: el ancho del cajon debe ser numerico`;
        }

        if (row.box_height_ft.trim() === '' || Number.isNaN(Number(row.box_height_ft))) {
          return `${label}: el alto del cajon debe ser numerico`;
        }
      }
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateRows();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = rows.map((row, index) => ({
        ...(row.id ? { id: row.id } : {}),
        aggregate_name: row.aggregate_name.trim(),
        material_type: row.material_type.trim(),
        location_area: row.location_area.trim(),
        measurement_method: row.measurement_method,
        unit: row.unit || 'CUBIC_YARDS',
        box_width_ft: row.measurement_method === 'BOX' ? Number(row.box_width_ft) || 0 : null,
        box_height_ft: row.measurement_method === 'BOX' ? Number(row.box_height_ft) || 0 : null,
        sort_order: index,
        is_active: row.is_active,
      }));

      const response = await updatePlantAggregatesConfigEntries(plant.id, payload);
      if (!response.success) {
        setError(
          response.error?.includes('respuesta no valida')
            ? 'No se pudo guardar porque el backend publicado aun no tiene esta ruta de agregados. Hay que publicar la Edge Function actualizada.'
            : (response.error ?? 'Error guardando agregados')
        );
        return;
      }

      onSaved();
    } catch {
      setError('Error de conexion guardando agregados');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white">
        <div className="border-b border-[#9D9B9A] p-6">
          <h3 className="text-xl font-medium text-[#3B3A36]">
            Configuración de Agregados - {plant.name}
          </h3>
          <p className="mt-1 text-sm text-[#5F6773]">
            Esta es la configuración principal de agregados por planta. El gerente solo captura usando el método definido aquí.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} />
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-[#5F6773]">Cargando agregados...</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <p className="font-semibold">Cómo funciona esta configuración</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-blue-800">
                  <li>Si eliges <strong>Cajón</strong>, el gerente solo ingresará el largo y el sistema usará ancho y alto fijos.</li>
                  <li>Si eliges <strong>Cono</strong>, el gerente ingresará M1 a M6 y D1 a D2 en la captura.</li>
                  <li>Si la planta aún no tiene agregados configurados, se precargan aquí desde la configuración anterior para facilitar la migración inicial.</li>
                  <li>Después de guardar en esta pantalla, los agregados de la planta se administran únicamente aquí.</li>
                </ul>
              </div>

              {rows.length === 0 ? (
                <div className="rounded-lg bg-[#F2F3F5] py-8 text-center">
                  <p className="mb-2 text-[#5F6773]">No hay agregados configurados</p>
                  <p className="text-sm text-[#5F6773]">Agrega la primera fila para esta planta</p>
                </div>
              ) : (
                rows.map((row, index) => (
                  <div key={row.id || `new-${index}`} className="rounded-lg border border-[#9D9B9A] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-sm font-medium text-[#3B3A36]">Agregado #{index + 1}</h4>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-[#5F6773]">
                          Activo
                          <input
                            type="checkbox"
                            checked={row.is_active}
                            onChange={(e) => updateRow(index, { is_active: e.target.checked })}
                          />
                        </label>
                        <Button variant="ghost" size="sm" onClick={() => removeRow(index)} disabled={saving}>
                          🗑️
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <Input
                        label="Nombre del agregado"
                        value={row.aggregate_name}
                        onChange={(e) => updateRow(index, { aggregate_name: e.target.value })}
                        placeholder="Ej: Cajón 1 / Cono Arena"
                        required
                      />
                      <Select
                        label="Material"
                        value={row.material_type}
                        onChange={(e) => updateRow(index, { material_type: e.target.value })}
                        options={buildSelectOptions(materialOptions, row.material_type, '— Seleccionar material —')}
                        required
                      />
                      <Select
                        label="Procedencia"
                        value={row.location_area}
                        onChange={(e) => updateRow(index, { location_area: e.target.value })}
                        options={buildSelectOptions(procedenciaOptions, row.location_area, '— Seleccionar procedencia —')}
                        required
                      />
                      <Select
                        label="Metodo de medicion"
                        value={row.measurement_method}
                        onChange={(e) => handleMethodChange(index, e.target.value as AggregateMeasurementMethod)}
                        options={[
                          { value: 'BOX', label: 'Cajón' },
                          { value: 'CONE', label: 'Cono' },
                        ]}
                        required
                      />
                    </div>

                    {row.measurement_method === 'BOX' ? (
                      <div className="mt-4 rounded-lg border border-[#E4E4E4] bg-[#F9FAFB] p-4">
                        <p className="mb-3 text-sm text-[#5F6773]">
                          Para cajón, ancho y alto quedan fijos en configuración; el gerente solo capturará el largo.
                        </p>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <Input
                            label="Ancho (ft)"
                            type="number"
                            value={row.box_width_ft}
                            onChange={(e) => updateRow(index, { box_width_ft: e.target.value })}
                            placeholder="30"
                            required
                          />
                          <Input
                            label="Alto (ft)"
                            type="number"
                            value={row.box_height_ft}
                            onChange={(e) => updateRow(index, { box_height_ft: e.target.value })}
                            placeholder="12"
                            required
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <p className="font-semibold">Método Cono</p>
                        <p className="mt-1 text-amber-800">
                          En inventario, el gerente capturará las 6 medidas M y los 2 diámetros D. No se usan ancho ni alto fijos.
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}

              <Button variant="secondary" onClick={addRow} className="w-full" disabled={saving}>
                + Agregar fila de agregado
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#9D9B9A] p-6">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Salir
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={loading}>
            Guardar configuración
          </Button>
        </div>
      </div>
    </div>
  );
}
