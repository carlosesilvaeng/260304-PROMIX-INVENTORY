/**
 * Module Configuration Types
 * Defines which sections/modules are enabled/disabled for the entire application
 */

export type ModuleKey = 
  | 'aggregates'
  | 'silos'
  | 'additives'
  | 'diesel'
  | 'products'
  | 'utilities'
  | 'petty_cash'
  | 'review_approve';

export interface ModuleConfig {
  key: ModuleKey;
  name: string;
  description: string;
  enabled: boolean;
  icon: string;
  order: number;
}

export interface ModuleSettings {
  modules: Record<ModuleKey, ModuleConfig>;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}

export const DEFAULT_MODULE_CONFIG: ModuleSettings = {
  modules: {
    aggregates: {
      key: 'aggregates',
      name: 'Agregados',
      description: 'Inventario de agregados (arena, piedra, etc.)',
      enabled: true, // Habilitado por defecto para comenzar rolling out
      icon: '🏗️',
      order: 1,
    },
    silos: {
      key: 'silos',
      name: 'Silos',
      description: 'Inventario de silos de cemento',
      enabled: false,
      icon: '🏭',
      order: 2,
    },
    additives: {
      key: 'additives',
      name: 'Aditivos',
      description: 'Inventario de aditivos químicos',
      enabled: false,
      icon: '⚗️',
      order: 3,
    },
    diesel: {
      key: 'diesel',
      name: 'Diesel',
      description: 'Control de inventario de combustible',
      enabled: false,
      icon: '⛽',
      order: 4,
    },
    products: {
      key: 'products',
      name: 'Aceites y Productos',
      description: 'Inventario de aceites, lubricantes, consumibles y equipos',
      enabled: false,
      icon: '📦',
      order: 5,
    },
    utilities: {
      key: 'utilities',
      name: 'Servicios',
      description: 'Lecturas de medidores (agua, electricidad, etc.)',
      enabled: false,
      icon: '🔌',
      order: 6,
    },
    petty_cash: {
      key: 'petty_cash',
      name: 'Petty Cash',
      description: 'Control de caja chica',
      enabled: false,
      icon: '💵',
      order: 7,
    },
    review_approve: {
      key: 'review_approve',
      name: 'Revisar y Aprobar',
      description: 'Sistema de aprobación de inventarios',
      enabled: false,
      icon: '✅',
      order: 8,
    },
  },
};
