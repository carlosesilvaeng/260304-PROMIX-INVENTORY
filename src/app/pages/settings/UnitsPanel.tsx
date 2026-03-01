/**
 * UnitsPanel
 * Admin panel for configuring measurement units per dimension type.
 * Changes apply globally across all inventory sections immediately.
 */

import React, { useState } from 'react';
import { Card } from '../../components/Card';
import { useUnits } from '../../contexts/UnitsContext';
import { useAuth } from '../../contexts/AuthContext';
import type { LengthUnit, AreaUnit, VolumeUnit } from '../../contexts/UnitsContext';

// ============================================================================
// TOGGLE BUTTON
// ============================================================================

interface UnitToggleProps {
  options: { value: string; label: string; description: string }[];
  selected: string;
  onChange: (value: string) => void;
}

function UnitToggle({ options, selected, onChange }: UnitToggleProps) {
  return (
    <div className="flex gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          title={opt.description}
          className={`
            px-5 py-2 rounded border text-sm font-medium transition-all
            ${selected === opt.value
              ? 'bg-[#2475C7] border-[#2475C7] text-white shadow-sm'
              : 'bg-white border-[#9D9B9A] text-[#5F6773] hover:border-[#2475C7] hover:text-[#2475C7]'}
          `}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// DIMENSION ROWS CONFIG
// ============================================================================

const ROWS = [
  {
    key:         'length' as const,
    icon:        '📏',
    label:       'Longitud',
    description: 'Dimensiones lineales: largo, ancho, alto',
    options: [
      { value: 'ft',  label: 'ft',  description: 'Pies (feet)' },
      { value: 'm',   label: 'm',   description: 'Metros' },
    ],
  },
  {
    key:         'area' as const,
    icon:        '⬛',
    label:       'Área',
    description: 'Superficies y secciones transversales',
    options: [
      { value: 'ft2', label: 'ft²', description: 'Pies cuadrados' },
      { value: 'm2',  label: 'm²',  description: 'Metros cuadrados' },
    ],
  },
  {
    key:         'volume' as const,
    icon:        '📦',
    label:       'Volumen',
    description: 'Volúmenes de agregados, silos, tanques',
    options: [
      { value: 'ft3', label: 'ft³', description: 'Pies cúbicos' },
      { value: 'm3',  label: 'm³',  description: 'Metros cúbicos' },
    ],
  },
] as const;

// ============================================================================
// MAIN PANEL
// ============================================================================

export function UnitsPanel() {
  const { units, setUnit, label } = useUnits();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'super_admin';

  const handleChange = (dimension: 'length' | 'area' | 'volume', value: string) => {
    if (!canEdit) return;
    if (dimension === 'length')  setUnit('length',  value as LengthUnit);
    if (dimension === 'area')    setUnit('area',    value as AreaUnit);
    if (dimension === 'volume')  setUnit('volume',  value as VolumeUnit);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg text-[#3B3A36]">Unidades de Medida</h3>
          <p className="text-[#5F6773] text-sm mt-1">
            {canEdit
              ? 'Define las unidades que se utilizarán en todas las secciones del inventario. Los cambios aplican inmediatamente.'
              : 'Unidades de medida configuradas para el sistema. Solo los administradores pueden modificarlas.'}
          </p>
        </div>
        {/* Role badge */}
        <span className={`shrink-0 mt-1 px-3 py-1 rounded text-xs font-medium ${
          canEdit
            ? 'bg-[#2475C7]/10 text-[#2475C7]'
            : 'bg-[#9D9B9A]/15 text-[#5F6773]'
        }`}>
          {canEdit ? '✏️ Edición' : '👁 Solo lectura'}
        </span>
      </div>

      {/* Read-only notice for non-admins */}
      {!canEdit && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded text-sm text-[#92400e]">
          <span className="text-lg">🔒</span>
          <span>No tienes permisos para modificar las unidades del sistema. Contacta a un administrador.</span>
        </div>
      )}

      {/* Saved indicator */}
      {saved && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#2ecc71]/10 border border-[#2ecc71]/30 rounded text-sm text-[#2ecc71] w-fit">
          ✓ Guardado
        </div>
      )}

      {/* Units table */}
      <Card noPadding>
        {/* Table header */}
        <div className="grid grid-cols-[2fr_3fr_2fr] px-6 py-3 bg-[#3B3A36] text-white text-sm font-medium rounded-t">
          <span>Tipo de medida</span>
          <span>Descripción</span>
          <span>Unidad activa</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#F2F3F5]">
          {ROWS.map((row, idx) => {
            const currentValue = units[row.key];
            return (
              <div
                key={row.key}
                className={`grid grid-cols-[2fr_3fr_2fr] items-center px-6 py-5 ${
                  idx % 2 === 1 ? 'bg-[#F2F3F5]/40' : 'bg-white'
                }`}
              >
                {/* Label */}
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{row.icon}</span>
                  <span className="font-medium text-[#3B3A36]">{row.label}</span>
                </div>

                {/* Description */}
                <p className="text-sm text-[#5F6773]">{row.description}</p>

                {/* Toggle (admin) or read-only badge (others) */}
                {canEdit ? (
                  <UnitToggle
                    options={row.options as unknown as { value: string; label: string; description: string }[]}
                    selected={currentValue}
                    onChange={(val) => handleChange(row.key, val)}
                  />
                ) : (
                  <span className="inline-flex items-center px-4 py-2 rounded border border-[#9D9B9A] bg-[#F2F3F5] text-sm font-semibold text-[#3B3A36] w-fit">
                    {label(row.key)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Info box — only for admins */}
      {canEdit && (
        <div className="p-4 bg-[#2475C7]/5 border border-[#2475C7]/20 rounded text-sm text-[#3B3A36]">
          <p className="font-semibold text-[#2475C7] mb-1">ℹ️ Nota</p>
          <p className="text-[#5F6773]">
            Este ajuste controla cómo se muestran y etiquetan las unidades en los formularios de inventario.
            No realiza conversión automática de datos ya guardados — si cambias las unidades,
            asegúrate de que los valores ingresados correspondan a la nueva unidad seleccionada.
          </p>
        </div>
      )}
    </div>
  );
}
