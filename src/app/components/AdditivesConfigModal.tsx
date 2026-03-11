import React, { useEffect, useState } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import {
  getPlantAdditivesConfigEntries,
  updatePlantAdditivesConfigEntries,
} from '../utils/api';
import type { Plant } from '../contexts/AuthContext';

type AdditiveType = 'TANK' | 'MANUAL';

interface AdditiveConfigRow {
  id?: string;
  additive_name: string;
  additive_type: AdditiveType;
  measurement_method: string;
  calibration_curve_name?: string | null;
  brand: string;
  uom: string;
  requires_photo: boolean;
  tank_name?: string | null;
  reading_uom?: string | null;
  conversion_table_text: string;
  is_active: boolean;
}

const EMPTY_TANK_TABLE = '{\n  "0": 0\n}';

function createEmptyRow(): AdditiveConfigRow {
  return {
    additive_name: '',
    additive_type: 'MANUAL',
    measurement_method: 'MANUAL_QUANTITY',
    calibration_curve_name: null,
    brand: '',
    uom: '',
    requires_photo: false,
    tank_name: null,
    reading_uom: null,
    conversion_table_text: '',
    is_active: true,
  };
}

function stringifyConversionTable(value: Record<string, number> | null | undefined) {
  if (!value || Object.keys(value).length === 0) return '';
  return JSON.stringify(value, null, 2);
}

export function AdditivesConfigModal({
  plant,
  onSaved,
  onClose,
}: {
  plant: Plant;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<AdditiveConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getPlantAdditivesConfigEntries(plant.id)
      .then((response) => {
        if (!response.success) {
          setError(response.error ?? 'Error cargando aditivos');
          return;
        }

        const loadedRows = (response.data ?? []).map((entry: any) => ({
          id: entry.id,
          additive_name: entry.additive_name || '',
          additive_type: String(entry.additive_type || 'MANUAL').toUpperCase() as AdditiveType,
          measurement_method: entry.measurement_method || 'MANUAL_QUANTITY',
          calibration_curve_name: entry.calibration_curve_name || null,
          brand: entry.brand || '',
          uom: entry.uom || '',
          requires_photo: entry.requires_photo ?? false,
          tank_name: entry.tank_name || null,
          reading_uom: entry.reading_uom || null,
          conversion_table_text: stringifyConversionTable(entry.conversion_table),
          is_active: entry.is_active ?? true,
        }));

        setRows(loadedRows);
      })
      .catch(() => setError('Error de conexión cargando aditivos'))
      .finally(() => setLoading(false));
  }, [plant.id]);

  const updateRow = (index: number, updates: Partial<AdditiveConfigRow>) => {
    setRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...updates } : row)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleTypeChange = (index: number, nextType: AdditiveType) => {
    updateRow(index, {
      additive_type: nextType,
      measurement_method: nextType === 'TANK' ? 'TANK_LEVEL' : 'MANUAL_QUANTITY',
      requires_photo: nextType === 'TANK',
      tank_name: nextType === 'TANK' ? rows[index].tank_name || '' : null,
      reading_uom: nextType === 'TANK' ? rows[index].reading_uom || 'inches' : null,
      conversion_table_text: nextType === 'TANK' ? (rows[index].conversion_table_text || EMPTY_TANK_TABLE) : '',
    });
  };

  const validateRows = () => {
    for (const [index, row] of rows.entries()) {
      const label = row.additive_name || `Fila ${index + 1}`;

      if (!row.additive_name.trim()) {
        return `El aditivo en la fila ${index + 1} debe tener nombre`;
      }

      if (!row.uom.trim()) {
        return `${label}: la unidad es requerida`;
      }

      if (row.additive_type === 'TANK') {
        if (!row.tank_name?.trim()) {
          return `${label}: el nombre del tanque es requerido`;
        }

        if (!row.reading_uom?.trim()) {
          return `${label}: la unidad de lectura es requerida`;
        }

        if (!row.conversion_table_text.trim()) {
          return `${label}: la tabla de conversión es requerida`;
        }

        try {
          const parsed = JSON.parse(row.conversion_table_text);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
            return `${label}: la tabla de conversión debe ser un JSON con puntos de lectura`;
          }
        } catch {
          return `${label}: la tabla de conversión no tiene JSON válido`;
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
        additive_name: row.additive_name.trim(),
        additive_type: row.additive_type,
        measurement_method: row.measurement_method,
        calibration_curve_name: row.calibration_curve_name || null,
        brand: row.brand.trim(),
        uom: row.uom.trim(),
        requires_photo: row.requires_photo,
        tank_name: row.additive_type === 'TANK' ? row.tank_name?.trim() || null : null,
        reading_uom: row.additive_type === 'TANK' ? row.reading_uom?.trim() || null : null,
        conversion_table: row.additive_type === 'TANK' ? JSON.parse(row.conversion_table_text) : null,
        sort_order: index,
        is_active: row.is_active,
      }));

      const response = await updatePlantAdditivesConfigEntries(plant.id, payload);
      if (!response.success) {
        setError(response.error ?? 'Error guardando aditivos');
        return;
      }

      onSaved();
    } catch {
      setError('Error de conexión guardando aditivos');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white">
        <div className="border-b border-[#9D9B9A] p-6">
          <h3 className="text-xl font-medium text-[#3B3A36]">
            Configuración de Aditivos — {plant.name}
          </h3>
          <p className="mt-1 text-sm text-[#5F6773]">
            Administra tanques y productos manuales directamente desde la tabla de configuración.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} />
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-[#5F6773]">Cargando aditivos...</div>
          ) : (
            <div className="space-y-4">
              {rows.length === 0 ? (
                <div className="rounded-lg bg-[#F2F3F5] py-8 text-center">
                  <p className="mb-2 text-[#5F6773]">No hay aditivos configurados</p>
                  <p className="text-sm text-[#5F6773]">Agrega la primera fila para esta planta</p>
                </div>
              ) : (
                rows.map((row, index) => (
                  <div key={row.id || `new-${index}`} className="rounded-lg border border-[#9D9B9A] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-sm font-medium text-[#3B3A36]">Aditivo #{index + 1}</h4>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-[#5F6773]">
                          Activo
                          <input
                            type="checkbox"
                            checked={row.is_active}
                            onChange={(e) => updateRow(index, { is_active: e.target.checked })}
                          />
                        </label>
                        <Button variant="ghost" size="sm" onClick={() => removeRow(index)}>
                          🗑️
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <Input
                        label="Nombre"
                        value={row.additive_name}
                        onChange={(e) => updateRow(index, { additive_name: e.target.value })}
                        placeholder="Ej: WR 200"
                        required
                      />
                      <Select
                        label="Tipo"
                        value={row.additive_type}
                        onChange={(e) => handleTypeChange(index, e.target.value as AdditiveType)}
                        options={[
                          { value: 'TANK', label: 'Tanque' },
                          { value: 'MANUAL', label: 'Manual' },
                        ]}
                      />
                      <Input
                        label="Marca"
                        value={row.brand}
                        onChange={(e) => updateRow(index, { brand: e.target.value })}
                        placeholder="Ej: SIKA"
                      />
                      <Input
                        label="Unidad"
                        value={row.uom}
                        onChange={(e) => updateRow(index, { uom: e.target.value })}
                        placeholder="Ej: gallons, bags"
                        required
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <label className="flex items-center gap-2 rounded border border-[#9D9B9A] bg-[#F2F3F5] px-3 py-2 text-sm text-[#3B3A36]">
                        <input
                          type="checkbox"
                          checked={row.requires_photo}
                          onChange={(e) => updateRow(index, { requires_photo: e.target.checked })}
                        />
                        Requiere foto
                      </label>
                      <Input
                        label="Método"
                        value={row.measurement_method}
                        onChange={(e) => updateRow(index, { measurement_method: e.target.value })}
                        placeholder="Ej: TANK_LEVEL"
                        required
                      />
                      <Input
                        label="Nombre de curva"
                        value={row.calibration_curve_name || ''}
                        onChange={(e) => updateRow(index, { calibration_curve_name: e.target.value || null })}
                        placeholder="Opcional"
                      />
                    </div>

                    {row.additive_type === 'TANK' && (
                      <div className="mt-4 space-y-4 rounded-lg border border-[#E4E4E4] bg-[#F9FAFB] p-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <Input
                            label="Nombre del tanque"
                            value={row.tank_name || ''}
                            onChange={(e) => updateRow(index, { tank_name: e.target.value })}
                            placeholder="Ej: Tanque WR200"
                            required
                          />
                          <Input
                            label="Unidad de lectura"
                            value={row.reading_uom || ''}
                            onChange={(e) => updateRow(index, { reading_uom: e.target.value })}
                            placeholder="Ej: inches"
                            required
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-[#3B3A36]">
                            Tabla de conversión JSON
                            <span className="ml-1 text-[#C94A4A]">*</span>
                          </label>
                          <textarea
                            value={row.conversion_table_text}
                            onChange={(e) => updateRow(index, { conversion_table_text: e.target.value })}
                            rows={6}
                            className="w-full rounded border border-[#9D9B9A] bg-[#F2F3F5] px-3 py-2 font-mono text-sm text-[#3B3A36] focus:border-[#2475C7] focus:outline-none"
                            placeholder={EMPTY_TANK_TABLE}
                          />
                          <p className="mt-1 text-xs text-[#5F6773]">
                            Ejemplo: {`{"0": 0, "6": 250, "12": 520}`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              <Button variant="secondary" onClick={addRow} className="w-full">
                + Agregar Aditivo
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#9D9B9A] p-6">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={loading}>
            Guardar Configuración
          </Button>
        </div>
      </div>
    </div>
  );
}
