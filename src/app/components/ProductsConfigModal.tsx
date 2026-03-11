import React, { useEffect, useState } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import {
  getPlantProductsConfigEntries,
  updatePlantProductsConfigEntries,
} from '../utils/api';
import type { Plant } from '../contexts/AuthContext';

interface ProductConfigRow {
  id?: string;
  product_name: string;
  category: string;
  measure_mode: string;
  uom: string;
  requires_photo: boolean;
  reading_uom?: string | null;
  calibration_table_text: string;
  tank_capacity: string;
  unit_volume: string;
  notes: string;
  is_active: boolean;
}

function createEmptyRow(): ProductConfigRow {
  return {
    product_name: '',
    category: 'OTHER',
    measure_mode: 'COUNT',
    uom: '',
    requires_photo: false,
    reading_uom: null,
    calibration_table_text: '',
    tank_capacity: '',
    unit_volume: '',
    notes: '',
    is_active: true,
  };
}

function stringifyTable(value: Record<string, number> | null | undefined) {
  if (!value || Object.keys(value).length === 0) return '';
  return JSON.stringify(value, null, 2);
}

export function ProductsConfigModal({
  plant,
  onSaved,
  onClose,
}: {
  plant: Plant;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ProductConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getPlantProductsConfigEntries(plant.id)
      .then((response) => {
        if (!response.success) {
          setError(response.error ?? 'Error cargando productos');
          return;
        }

        const loadedRows = (response.data ?? []).map((entry: any) => ({
          id: entry.id,
          product_name: entry.product_name || '',
          category: entry.category || 'OTHER',
          measure_mode: entry.measure_mode || 'COUNT',
          uom: entry.uom || entry.unit || '',
          requires_photo: entry.requires_photo ?? false,
          reading_uom: entry.reading_uom || null,
          calibration_table_text: stringifyTable(entry.calibration_table),
          tank_capacity: String(entry.tank_capacity ?? ''),
          unit_volume: String(entry.unit_volume ?? ''),
          notes: entry.notes || '',
          is_active: entry.is_active ?? true,
        }));

        setRows(loadedRows);
      })
      .catch(() => setError('Error de conexión cargando productos'))
      .finally(() => setLoading(false));
  }, [plant.id]);

  const updateRow = (index: number, updates: Partial<ProductConfigRow>) => {
    setRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...updates } : row)));
  };

  const handleModeChange = (index: number, measureMode: string) => {
    updateRow(index, {
      measure_mode: measureMode,
      reading_uom: measureMode === 'TANK_READING' ? rows[index].reading_uom || 'inches' : null,
      calibration_table_text: measureMode === 'TANK_READING' ? rows[index].calibration_table_text : '',
      tank_capacity: measureMode === 'TANK_READING' ? rows[index].tank_capacity : '',
      unit_volume: measureMode === 'DRUM' || measureMode === 'PAIL' ? rows[index].unit_volume || '' : '',
    });
  };

  const validateRows = () => {
    for (const [index, row] of rows.entries()) {
      const label = row.product_name || `Fila ${index + 1}`;

      if (!row.product_name.trim()) return `La fila ${index + 1} debe tener nombre`;
      if (!row.uom.trim()) return `${label}: la unidad es requerida`;

      if (row.measure_mode === 'TANK_READING') {
        if (!row.reading_uom?.trim()) return `${label}: la unidad de lectura es requerida`;
        if (!row.calibration_table_text.trim()) return `${label}: la tabla de calibración es requerida`;
        try {
          JSON.parse(row.calibration_table_text);
        } catch {
          return `${label}: la tabla de calibración no tiene JSON válido`;
        }
      }

      if ((row.measure_mode === 'DRUM' || row.measure_mode === 'PAIL') && !row.unit_volume.trim()) {
        return `${label}: el volumen por unidad es requerido`;
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
        product_name: row.product_name.trim(),
        category: row.category,
        measure_mode: row.measure_mode,
        uom: row.uom.trim(),
        requires_photo: row.requires_photo,
        reading_uom: row.measure_mode === 'TANK_READING' ? row.reading_uom?.trim() || null : null,
        calibration_table: row.measure_mode === 'TANK_READING' ? JSON.parse(row.calibration_table_text) : null,
        tank_capacity: row.measure_mode === 'TANK_READING' ? Number(row.tank_capacity) || 0 : null,
        unit_volume: row.measure_mode === 'DRUM' || row.measure_mode === 'PAIL' ? Number(row.unit_volume) || 0 : null,
        notes: row.notes.trim(),
        sort_order: index,
        is_active: row.is_active,
      }));

      const response = await updatePlantProductsConfigEntries(plant.id, payload);
      if (!response.success) {
        setError(response.error ?? 'Error guardando productos');
        return;
      }

      onSaved();
    } catch {
      setError('Error de conexión guardando productos');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white">
        <div className="border-b border-[#9D9B9A] p-6">
          <h3 className="text-xl font-medium text-[#3B3A36]">
            Configuración de Aceites y Productos — {plant.name}
          </h3>
          <p className="mt-1 text-sm text-[#5F6773]">
            Administra productos y consumibles directamente desde la tabla de configuración.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} />
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-[#5F6773]">Cargando productos...</div>
          ) : (
            <div className="space-y-4">
              {rows.length === 0 ? (
                <div className="rounded-lg bg-[#F2F3F5] py-8 text-center">
                  <p className="mb-2 text-[#5F6773]">No hay productos configurados</p>
                  <p className="text-sm text-[#5F6773]">Agrega la primera fila para esta planta</p>
                </div>
              ) : (
                rows.map((row, index) => (
                  <div key={row.id || `new-${index}`} className="rounded-lg border border-[#9D9B9A] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-sm font-medium text-[#3B3A36]">Producto #{index + 1}</h4>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-[#5F6773]">
                          Activo
                          <input
                            type="checkbox"
                            checked={row.is_active}
                            onChange={(e) => updateRow(index, { is_active: e.target.checked })}
                          />
                        </label>
                        <Button variant="ghost" size="sm" onClick={() => setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}>
                          🗑️
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <Input
                        label="Nombre"
                        value={row.product_name}
                        onChange={(e) => updateRow(index, { product_name: e.target.value })}
                        placeholder="Ej: Aceite Hidráulico"
                        required
                      />
                      <Select
                        label="Categoría"
                        value={row.category}
                        onChange={(e) => updateRow(index, { category: e.target.value })}
                        options={[
                          { value: 'OIL', label: 'Aceite' },
                          { value: 'LUBRICANT', label: 'Lubricante' },
                          { value: 'CONSUMABLE', label: 'Consumible' },
                          { value: 'EQUIPMENT', label: 'Equipo' },
                          { value: 'OTHER', label: 'Otro' },
                        ]}
                      />
                      <Select
                        label="Método"
                        value={row.measure_mode}
                        onChange={(e) => handleModeChange(index, e.target.value)}
                        options={[
                          { value: 'COUNT', label: 'Conteo' },
                          { value: 'DRUM', label: 'Tambores' },
                          { value: 'PAIL', label: 'Pailas' },
                          { value: 'TANK_READING', label: 'Lectura de tanque' },
                        ]}
                      />
                      <Input
                        label="Unidad"
                        value={row.uom}
                        onChange={(e) => updateRow(index, { uom: e.target.value })}
                        placeholder="Ej: pails, units, gallons"
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
                      {(row.measure_mode === 'DRUM' || row.measure_mode === 'PAIL') && (
                        <Input
                          label="Volumen por unidad"
                          type="number"
                          value={row.unit_volume}
                          onChange={(e) => updateRow(index, { unit_volume: e.target.value })}
                          placeholder="55"
                          required
                        />
                      )}
                      <Input
                        label="Notas"
                        value={row.notes}
                        onChange={(e) => updateRow(index, { notes: e.target.value })}
                        placeholder="Opcional"
                      />
                    </div>

                    {row.measure_mode === 'TANK_READING' && (
                      <div className="mt-4 space-y-4 rounded-lg border border-[#E4E4E4] bg-[#F9FAFB] p-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <Input
                            label="Unidad de lectura"
                            value={row.reading_uom || ''}
                            onChange={(e) => updateRow(index, { reading_uom: e.target.value })}
                            placeholder="Ej: inches"
                            required
                          />
                          <Input
                            label="Capacidad del tanque"
                            type="number"
                            value={row.tank_capacity}
                            onChange={(e) => updateRow(index, { tank_capacity: e.target.value })}
                            placeholder="500"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-[#3B3A36]">
                            Tabla de calibración JSON
                            <span className="ml-1 text-[#C94A4A]">*</span>
                          </label>
                          <textarea
                            value={row.calibration_table_text}
                            onChange={(e) => updateRow(index, { calibration_table_text: e.target.value })}
                            rows={6}
                            className="w-full rounded border border-[#9D9B9A] bg-[#F2F3F5] px-3 py-2 font-mono text-sm text-[#3B3A36] focus:border-[#2475C7] focus:outline-none"
                            placeholder='{"0": 0, "6": 25, "12": 52}'
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              <Button variant="secondary" onClick={() => setRows((prev) => [...prev, createEmptyRow()])} className="w-full">
                + Agregar Producto
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
