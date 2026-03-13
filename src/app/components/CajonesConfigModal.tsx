import React, { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import type { CajonConfig } from '../contexts/AuthContext';

interface CajonesConfigModalProps {
  plantName: string;
  cajones: CajonConfig[];
  materiales: string[];
  procedencias: string[];
  onSave: (cajones: CajonConfig[]) => void;
  onClose: () => void;
}

export function CajonesConfigModal({ plantName, cajones: initialCajones, materiales, procedencias, onSave, onClose }: CajonesConfigModalProps) {
  const [cajones, setCajones] = useState<CajonConfig[]>(initialCajones || []);

  const addCajon = () => {
    const newCajon: CajonConfig = {
      id: `cajon-${Date.now()}`,
      name: '',
      material: '',
      procedencia: '',
      ancho: 0,
      alto: 0,
    };
    setCajones([...cajones, newCajon]);
  };

  const updateCajon = (index: number, updates: Partial<CajonConfig>) => {
    const updated = [...cajones];
    updated[index] = { ...updated[index], ...updates };
    setCajones(updated);
  };

  const removeCajon = (index: number) => {
    setCajones(cajones.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(cajones);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#9D9B9A]">
          <h3 className="text-xl text-[#3B3A36] font-medium">
            Configuración de Cajones - {plantName}
          </h3>
          <p className="text-sm text-[#5F6773] mt-1">
            Configure los cajones/materiales que estarán disponibles para esta planta
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            {cajones.length === 0 ? (
              <div className="text-center py-8 bg-[#F2F3F5] rounded-lg">
                <p className="text-[#5F6773] mb-4">No hay cajones configurados</p>
                <p className="text-sm text-[#5F6773]">
                  Haga clic en "Agregar Cajón" para comenzar
                </p>
              </div>
            ) : (
              cajones.map((cajon, index) => (
                <div key={cajon.id} className="border border-[#9D9B9A] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-[#3B3A36]">
                      Cajón #{index + 1}
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCajon(index)}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="Nombre del Cajón"
                      value={cajon.name}
                      onChange={(e) => updateCajon(index, { name: e.target.value })}
                      placeholder="Ej: Cajón 1"
                      required
                    />
                    <Select
                      label="Material"
                      value={cajon.material}
                      onChange={(e) => updateCajon(index, { material: e.target.value })}
                      required
                    >
                      <option value="">— Seleccionar material —</option>
                      {materiales.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </Select>
                    <Select
                      label="Procedencia"
                      value={cajon.procedencia}
                      onChange={(e) => updateCajon(index, { procedencia: e.target.value })}
                      required
                    >
                      <option value="">— Seleccionar procedencia —</option>
                      {procedencias.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </Select>
                  </div>

                  {/* Dimensiones fijas — valores por defecto bloqueados en inventario */}
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-[#E4E4E4]">
                    <div>
                      <label className="block text-sm font-medium text-[#3B3A36] mb-1">
                        Ancho (ft) <span className="text-xs text-[#5F6773] font-normal">— valor fijo en inventario 🔒</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cajon.ancho === 0 ? '' : (cajon.ancho ?? '')}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateCajon(index, { ancho: value === '' ? 0 : parseFloat(value) || 0 });
                        }}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-[#9D9B9A] rounded text-[#3B3A36] focus:outline-none focus:border-[#2475C7]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#3B3A36] mb-1">
                        Alto (ft) <span className="text-xs text-[#5F6773] font-normal">— valor fijo en inventario 🔒</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cajon.alto === 0 ? '' : (cajon.alto ?? '')}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateCajon(index, { alto: value === '' ? 0 : parseFloat(value) || 0 });
                        }}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-[#9D9B9A] rounded text-[#3B3A36] focus:outline-none focus:border-[#2475C7]"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}

            <Button variant="secondary" onClick={addCajon} className="w-full">
              + Agregar Cajón
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#9D9B9A] flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Salir
          </Button>
          <Button onClick={handleSave}>
            Guardar Configuración
          </Button>
        </div>
      </div>
    </div>
  );
}
