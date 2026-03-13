import React, { useEffect, useState } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { Input } from './Input';
import {
  getPlantDieselConfigEntry,
  updatePlantDieselConfigEntry,
} from '../utils/api';
import type { Plant } from '../contexts/AuthContext';

interface DieselConfigForm {
  id?: string;
  measurement_method: string;
  calibration_curve_name?: string | null;
  reading_uom: string;
  tank_capacity_gallons: string;
  initial_inventory_gallons: string;
  calibration_table_text: string;
  is_active: boolean;
}

function createEmptyForm(): DieselConfigForm {
  return {
    measurement_method: 'TANK_LEVEL',
    calibration_curve_name: null,
    reading_uom: 'inches',
    tank_capacity_gallons: '',
    initial_inventory_gallons: '',
    calibration_table_text: '',
    is_active: true,
  };
}

function stringifyTable(value: Record<string, number> | null | undefined) {
  if (!value || Object.keys(value).length === 0) return '';
  return JSON.stringify(value, null, 2);
}

export function DieselConfigModal({
  plant,
  onSaved,
  onClose,
}: {
  plant: Plant;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DieselConfigForm>(createEmptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getPlantDieselConfigEntry(plant.id)
      .then((response) => {
        if (!response.success) {
          setError(response.error ?? 'Error cargando diesel');
          return;
        }

        if (!response.data) {
          setForm(createEmptyForm());
          return;
        }

        setForm({
          id: response.data.id,
          measurement_method: response.data.measurement_method || 'TANK_LEVEL',
          calibration_curve_name: response.data.calibration_curve_name || null,
          reading_uom: response.data.reading_uom || 'inches',
          tank_capacity_gallons: String(response.data.tank_capacity_gallons ?? ''),
          initial_inventory_gallons: String(response.data.initial_inventory_gallons ?? ''),
          calibration_table_text: stringifyTable(response.data.calibration_table),
          is_active: response.data.is_active ?? true,
        });
      })
      .catch(() => setError('Error de conexión cargando diesel'))
      .finally(() => setLoading(false));
  }, [plant.id]);

  const handleSave = async () => {
    if (!form.measurement_method.trim()) {
      setError('El método de medición es requerido');
      return;
    }

    if (!form.reading_uom.trim()) {
      setError('La unidad de lectura es requerida');
      return;
    }

    if (!form.tank_capacity_gallons.trim()) {
      setError('La capacidad del tanque es requerida');
      return;
    }

    if (!form.calibration_table_text.trim()) {
      setError('La tabla de calibración es requerida');
      return;
    }

    let calibrationTable: Record<string, number>;
    try {
      calibrationTable = JSON.parse(form.calibration_table_text);
    } catch {
      setError('La tabla de calibración no tiene JSON válido');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await updatePlantDieselConfigEntry(plant.id, {
        ...(form.id ? { id: form.id } : {}),
        measurement_method: form.measurement_method.trim(),
        calibration_curve_name: form.calibration_curve_name || null,
        reading_uom: form.reading_uom.trim(),
        tank_capacity_gallons: Number(form.tank_capacity_gallons) || 0,
        initial_inventory_gallons: Number(form.initial_inventory_gallons) || 0,
        calibration_table: calibrationTable,
        is_active: form.is_active,
      });

      if (!response.success) {
        setError(response.error ?? 'Error guardando diesel');
        return;
      }

      onSaved();
    } catch {
      setError('Error de conexión guardando diesel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white">
        <div className="border-b border-[#9D9B9A] p-6">
          <h3 className="text-xl font-medium text-[#3B3A36]">
            Configuración de Diesel — {plant.name}
          </h3>
          <p className="mt-1 text-sm text-[#5F6773]">
            Administra el tanque y la tabla de calibración desde la base de datos.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} />
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-[#5F6773]">Cargando diesel...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label="Método"
                  value={form.measurement_method}
                  onChange={(e) => setForm((prev) => ({ ...prev, measurement_method: e.target.value }))}
                  placeholder="Ej: TANK_LEVEL"
                  required
                />
                <Input
                  label="Unidad de lectura"
                  value={form.reading_uom}
                  onChange={(e) => setForm((prev) => ({ ...prev, reading_uom: e.target.value }))}
                  placeholder="Ej: inches"
                  required
                />
                <Input
                  label="Capacidad del tanque (galones)"
                  type="number"
                  value={form.tank_capacity_gallons}
                  onChange={(e) => setForm((prev) => ({ ...prev, tank_capacity_gallons: e.target.value }))}
                  placeholder="8000"
                  required
                />
                <Input
                  label="Inventario inicial"
                  type="number"
                  value={form.initial_inventory_gallons}
                  onChange={(e) => setForm((prev) => ({ ...prev, initial_inventory_gallons: e.target.value }))}
                  placeholder="5000"
                />
                <Input
                  label="Nombre de curva"
                  value={form.calibration_curve_name || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, calibration_curve_name: e.target.value || null }))}
                  placeholder="Opcional"
                />
                <label className="flex items-center gap-2 rounded border border-[#9D9B9A] bg-[#F2F3F5] px-3 py-2 text-sm text-[#3B3A36]">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  />
                  Activo
                </label>
              </div>

              <div>
                <label className="mb-1.5 block text-[#3B3A36]">
                  Tabla de calibración JSON
                  <span className="ml-1 text-[#C94A4A]">*</span>
                </label>
                <textarea
                  value={form.calibration_table_text}
                  onChange={(e) => setForm((prev) => ({ ...prev, calibration_table_text: e.target.value }))}
                  rows={10}
                  className="w-full rounded border border-[#9D9B9A] bg-[#F2F3F5] px-3 py-2 font-mono text-sm text-[#3B3A36] focus:border-[#2475C7] focus:outline-none"
                  placeholder='{"0": 0, "8": 400, "16": 832}'
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#9D9B9A] p-6">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Salir
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={loading}>
            Guardar Configuración
          </Button>
        </div>
      </div>
    </div>
  );
}
