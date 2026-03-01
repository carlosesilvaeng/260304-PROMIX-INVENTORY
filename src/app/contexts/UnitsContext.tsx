/**
 * UnitsContext
 * Global configuration for measurement units.
 * Persists to localStorage so the admin setting survives refreshes.
 *
 * Usage anywhere in the app:
 *   const { units, setUnit, label } = useUnits();
 *   units.length  → 'ft' | 'm'
 *   units.area    → 'ft2' | 'm2'
 *   units.volume  → 'ft3' | 'm3'
 *   label('volume') → 'ft³' | 'm³'
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type LengthUnit  = 'ft' | 'm';
export type AreaUnit    = 'ft2' | 'm2';
export type VolumeUnit  = 'ft3' | 'm3';

export interface UnitsConfig {
  length: LengthUnit;
  area:   AreaUnit;
  volume: VolumeUnit;
}

export type UnitDimension = keyof UnitsConfig;

interface UnitsContextType {
  units: UnitsConfig;
  setUnit: <K extends UnitDimension>(dimension: K, value: UnitsConfig[K]) => void;
  /** Human-readable symbol: 'ft', 'm', 'ft²', 'm²', 'ft³', 'm³' */
  label: (dimension: UnitDimension) => string;
}

// ============================================================================
// DEFAULTS & LABELS
// ============================================================================

const STORAGE_KEY = 'promix_units_config';

const DEFAULT_UNITS: UnitsConfig = {
  length: 'ft',
  area:   'ft2',
  volume: 'ft3',
};

export const UNIT_LABELS: Record<string, string> = {
  ft:  'ft',
  m:   'm',
  ft2: 'ft²',
  m2:  'm²',
  ft3: 'ft³',
  m3:  'm³',
};

function loadFromStorage(): UnitsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UnitsConfig>;
      return {
        length: parsed.length ?? DEFAULT_UNITS.length,
        area:   parsed.area   ?? DEFAULT_UNITS.area,
        volume: parsed.volume ?? DEFAULT_UNITS.volume,
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_UNITS };
}

// ============================================================================
// CONTEXT
// ============================================================================

const UnitsContext = createContext<UnitsContextType | undefined>(undefined);

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const [units, setUnits] = useState<UnitsConfig>(loadFromStorage);

  const setUnit = useCallback(<K extends UnitDimension>(
    dimension: K,
    value: UnitsConfig[K]
  ) => {
    setUnits(prev => {
      const next = { ...prev, [dimension]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const label = useCallback(
    (dimension: UnitDimension) => UNIT_LABELS[units[dimension]] ?? units[dimension],
    [units]
  );

  return (
    <UnitsContext.Provider value={{ units, setUnit, label }}>
      {children}
    </UnitsContext.Provider>
  );
}

export function useUnits(): UnitsContextType {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error('useUnits must be used within UnitsProvider');
  return ctx;
}
