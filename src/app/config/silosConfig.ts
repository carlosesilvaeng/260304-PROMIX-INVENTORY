// Configuración de unidades de medida para silos
// Define las unidades disponibles para las lecturas de silos

export interface SiloUnit {
  value: string;
  label: string;
  abbreviation: string;
  description?: string;
}

/**
 * Unidades de medida disponibles para silos
 * Se pueden agregar más unidades según las necesidades de cada planta
 */
export const SILO_UNITS: SiloUnit[] = [
  {
    value: 'tons',
    label: 'Toneladas',
    abbreviation: 'tons',
    description: 'Toneladas métricas',
  },
  {
    value: 'lbs',
    label: 'Libras',
    abbreviation: 'lbs',
    description: 'Libras (pounds)',
  },
  {
    value: 'kg',
    label: 'Kilogramos',
    abbreviation: 'kg',
    description: 'Kilogramos',
  },
  {
    value: 'bbl',
    label: 'Barriles',
    abbreviation: 'bbl',
    description: 'Barriles',
  },
  {
    value: 'ft3',
    label: 'Pies Cúbicos',
    abbreviation: 'ft³',
    description: 'Pies cúbicos',
  },
  {
    value: 'm3',
    label: 'Metros Cúbicos',
    abbreviation: 'm³',
    description: 'Metros cúbicos',
  },
  {
    value: 'percent',
    label: 'Porcentaje',
    abbreviation: '%',
    description: 'Porcentaje de capacidad',
  },
];

/**
 * Unidad por defecto para nuevos silos
 */
export const DEFAULT_SILO_UNIT = 'tons';

/**
 * Obtiene información de una unidad específica
 */
export function getSiloUnit(value: string): SiloUnit | undefined {
  return SILO_UNITS.find(unit => unit.value === value);
}

/**
 * Obtiene la abreviación de una unidad
 */
export function getSiloUnitAbbreviation(value: string): string {
  const unit = getSiloUnit(value);
  return unit?.abbreviation || value;
}
