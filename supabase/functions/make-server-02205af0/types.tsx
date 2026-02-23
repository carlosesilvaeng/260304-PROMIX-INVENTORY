// Types for PROMIX Plant Inventory Database Schema

// ============================================================================
// CONFIGURATION TABLES (plant_*_config)
// ============================================================================

export interface PlantAggregatesConfig {
  id: string;
  plant_id: string;
  method: 'BOX' | 'CONE';
  name: string;
  description?: string;
  unit: 'ft' | 'm';
  width_fixed?: number;
  height_fixed?: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlantSilosConfig {
  id: string;
  plant_id: string;
  name: string;
  unit: 'toneladas' | 'libras' | 'kilogramos' | 'barriles' | 'pies_cubicos' | 'metros_cubicos' | 'porcentaje';
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SiloAllowedProducts {
  id: string;
  silo_config_id: string;
  product_name: string;
  created_at: string;
}

export interface PlantAdditivesConfig {
  id: string;
  plant_id: string;
  type: 'TANK' | 'MANUAL';
  name: string;
  description?: string;
  uom: 'in' | 'bags' | 'gal' | 'units';
  calibration_curve_id?: string; // Reference to calibration table if TANK
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CalibrationCurve {
  id: string;
  name: string;
  description?: string;
  data_points: { input: number; output: number }[]; // JSON array
  created_at: string;
  updated_at: string;
}

export interface PlantDieselConfig {
  id: string;
  plant_id: string;
  tank_name: string;
  calibration_curve_id: string; // inches → gallons
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlantProductsConfig {
  id: string;
  plant_id: string;
  name: string;
  description?: string;
  measure_mode: 'TANK_READING' | 'DRUM' | 'PAIL' | 'COUNT';
  uom: string; // gal, drums, pails, units, etc
  calibration_curve_id?: string; // If TANK_READING
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlantUtilitiesMetersConfig {
  id: string;
  plant_id: string;
  meter_type: 'WATER' | 'ELECTRICITY' | 'GAS' | 'OTHER';
  meter_number: string;
  name: string;
  uom: string; // kWh, gallons, m³, etc
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlantPettyCashConfig {
  id: string;
  plant_id: string;
  amount: number;
  currency: string;
  effective_from?: string;
  effective_to?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// MONTHLY TRANSACTIONAL TABLES (inventory_*)
// ============================================================================

export interface InventoryMonth {
  id: string;
  plant_id: string;
  year_month: string; // Format: YYYY-MM
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED';
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryAggregatesEntry {
  id: string;
  inventory_month_id: string;
  aggregate_config_id: string;
  length_reading?: number;
  width_reading?: number;
  height_reading?: number;
  calculated_volume?: number;
  photo_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InventorySilosEntry {
  id: string;
  inventory_month_id: string;
  silo_config_id: string;
  product_name: string;
  reading: number;
  photo_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryAdditivesEntry {
  id: string;
  inventory_month_id: string;
  additive_config_id: string;
  reading?: number;
  calculated_value?: number; // If calibration curve applied
  purchases_month?: number;
  photo_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryDieselEntry {
  id: string;
  inventory_month_id: string;
  diesel_config_id: string;
  reading_inches: number;
  calculated_gallons: number;
  purchases_gallons?: number;
  photo_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryProductsEntry {
  id: string;
  inventory_month_id: string;
  product_config_id: string;
  reading?: number;
  calculated_value?: number; // If calibration curve applied
  count?: number; // For DRUM/PAIL/COUNT modes
  purchases_month?: number;
  photo_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryUtilitiesEntry {
  id: string;
  inventory_month_id: string;
  meter_config_id: string;
  reading: number;
  photo_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryPettyCashEntry {
  id: string;
  inventory_month_id: string;
  petty_cash_config_id: string;
  opening_balance?: number;
  closing_balance: number;
  receipts_total?: number;
  photo_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface PlantConfigPackage {
  plant_id: string;
  aggregates: PlantAggregatesConfig[];
  silos: (PlantSilosConfig & { allowed_products: string[] })[];
  additives: PlantAdditivesConfig[];
  diesel: PlantDieselConfig | null;
  products: PlantProductsConfig[];
  utilities_meters: PlantUtilitiesMetersConfig[];
  petty_cash: PlantPettyCashConfig | null;
  calibration_curves: Record<string, CalibrationCurve>;
}

export interface InventoryMonthData {
  inventory_month: InventoryMonth;
  aggregates_entries: InventoryAggregatesEntry[];
  silos_entries: InventorySilosEntry[];
  additives_entries: InventoryAdditivesEntry[];
  diesel_entry: InventoryDieselEntry | null;
  products_entries: InventoryProductsEntry[];
  utilities_entries: InventoryUtilitiesEntry[];
  petty_cash_entry: InventoryPettyCashEntry | null;
}
