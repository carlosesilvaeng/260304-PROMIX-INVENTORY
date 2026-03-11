import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Alert } from './Alert';
import { getPlantSilos, updatePlantSilos } from '../utils/api';
import type { Plant } from '../types';

interface SiloEntry {
  id?: string;
  silo_name: string;
  is_active: boolean;
  measurement_method?: string;
  allowed_products?: string[];
}

interface SilosConfigModalProps {
  plant: Plant;
  onSaved: () => void;
  onClose: () => void;
}

export function SilosConfigModal({ plant, onSaved, onClose }: SilosConfigModalProps) {
  const [silos, setSilos] = useState<SiloEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current silos for this plant on mount
  useEffect(() => {
    setLoading(true);
    getPlantSilos(plant.id)
      .then((res) => {
        if (res.success) {
          setSilos(
            (res.data ?? []).map((s: any) => ({
              id: s.id,
              silo_name: s.silo_name,
              is_active: s.is_active ?? true,
              measurement_method: s.measurement_method,
              allowed_products: s.allowed_products ?? [],
            }))
          );
        } else {
          setError(res.error ?? 'Error cargando silos');
        }
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false));
  }, [plant.id]);

  const addSilo = () => {
    setSilos([...silos, { silo_name: '', is_active: true }]);
  };

  const updateSilo = (index: number, updates: Partial<SiloEntry>) => {
    const updated = [...silos];
    updated[index] = { ...updated[index], ...updates };
    setSilos(updated);
  };

  const removeSilo = (index: number) => {
    setSilos(silos.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    // Validate: all names must be non-empty
    const invalid = silos.find((s) => !s.silo_name.trim());
    if (invalid !== undefined) {
      setError('Todos los silos deben tener un nombre');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await updatePlantSilos(
        plant.id,
        silos.map((s) => ({
          id: s.id,
          silo_name: s.silo_name.trim(),
          is_active: s.is_active,
          measurement_method: s.measurement_method,
          allowed_products: s.allowed_products ?? [],
        }))
      );
      if (res.success) {
        onSaved();
      } else {
        setError(res.error ?? 'Error guardando silos');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#9D9B9A]">
          <h3 className="text-xl text-[#3B3A36] font-medium">
            Configuración de Silos — {plant.name}
          </h3>
          <p className="text-sm text-[#5F6773] mt-1">
            Agregue, edite o elimine los silos disponibles para esta planta
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} />
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-[#5F6773]">Cargando silos...</div>
          ) : (
            <div className="space-y-4">
              {silos.length === 0 ? (
                <div className="text-center py-8 bg-[#F2F3F5] rounded-lg">
                  <p className="text-[#5F6773] mb-2">No hay silos configurados</p>
                  <p className="text-sm text-[#5F6773]">
                    Haga clic en "Agregar Silo" para comenzar
                  </p>
                </div>
              ) : (
                silos.map((silo, index) => (
                  <div key={index} className="border border-[#9D9B9A] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-[#3B3A36]">
                        Silo #{index + 1}
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSilo(index)}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>

                    <div className="flex items-end gap-4">
                      <div className="flex-1">
                        <Input
                          label="Nombre del Silo"
                          value={silo.silo_name}
                          onChange={(e) => updateSilo(index, { silo_name: e.target.value })}
                          placeholder="Ej: Silo Cemento 1"
                          required
                        />
                      </div>
                      <div className="flex items-center gap-2 mb-1 pb-1">
                        <label className="text-sm text-[#5F6773]">Activo</label>
                        <button
                          type="button"
                          onClick={() => updateSilo(index, { is_active: !silo.is_active })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                            silo.is_active ? 'bg-[#2475C7]' : 'bg-[#9D9B9A]'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              silo.is_active ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}

              <Button variant="secondary" onClick={addSilo} className="w-full">
                + Agregar Silo
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#9D9B9A] flex items-center justify-end gap-3">
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
