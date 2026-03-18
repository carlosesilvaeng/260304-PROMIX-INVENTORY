import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

// Initialize Supabase client with service role key
export const getSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

export const INVENTORY_CHILD_TABLES = [
  { table: 'inventory_aggregates_entries', configKey: 'aggregates' },
  { table: 'inventory_silos_entries', configKey: 'silos' },
  { table: 'inventory_additives_entries', configKey: 'additives' },
  { table: 'inventory_diesel_entries', configKey: 'diesel' },
  { table: 'inventory_products_entries', configKey: 'products' },
  { table: 'inventory_utilities_entries', configKey: 'utilities' },
  { table: 'inventory_petty_cash_entries', configKey: 'petty_cash' },
] as const;

const INVENTORY_STATUSES = ['IN_PROGRESS', 'SUBMITTED', 'APPROVED'] as const;
const CLEANUP_PREVIEW_PREFIX = 'data_cleanup_preview:';
const CONFIG_CLEANUP_PREVIEW_PREFIX = 'config_cleanup_preview:';
const PRODUCTS_IMPORT_PREVIEW_PREFIX = 'products_import_preview:';
const AGGREGATES_IMPORT_PREVIEW_PREFIX = 'aggregates_import_preview:';
const SILOS_IMPORT_PREVIEW_PREFIX = 'silos_import_preview:';
const DIESEL_IMPORT_PREVIEW_PREFIX = 'diesel_import_preview:';
const MATERIALS_IMPORT_PREVIEW_PREFIX = 'materials_import_preview:';
const PROCEDENCIAS_IMPORT_PREVIEW_PREFIX = 'procedencias_import_preview:';
const ADDITIVES_CATALOG_IMPORT_PREVIEW_PREFIX = 'additives_catalog_import_preview:';
const CALIBRATION_CURVES_IMPORT_PREVIEW_PREFIX = 'calibration_curves_import_preview:';
const CLEANUP_PREVIEW_TTL_MS = 15 * 60 * 1000;
const MAX_CLEANUP_INVENTORY_MONTHS = 200;
const MAX_CLEANUP_DISTINCT_MONTHS = 24;
const CONFIG_CLEANUP_MODULES = ['silos', 'aggregates', 'additives', 'diesel', 'products', 'utilities', 'petty_cash'] as const;

type InventoryStatus = typeof INVENTORY_STATUSES[number];
export type ConfigCleanupModule = typeof CONFIG_CLEANUP_MODULES[number];

interface CleanupFiltersInput {
  scope?: string;
  plant_ids?: string[];
  year_month_from?: string | null;
  year_month_to?: string | null;
  statuses?: string[];
  include_photos?: boolean;
}

export interface CleanupFilters {
  scope: 'transactional';
  plant_ids: string[];
  year_month_from: string | null;
  year_month_to: string | null;
  statuses: InventoryStatus[];
  include_photos: boolean;
}

interface InventoryMonthRow {
  id: string;
  plant_id: string;
  year_month: string;
  status: InventoryStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CleanupPreviewRecord {
  token: string;
  payload: CleanupFilters;
  created_at: string;
  expires_at: string;
}

interface ConfigCleanupInput {
  plant_id?: string | null;
  modules?: string[];
  include_related_rows?: boolean;
}

export interface ConfigCleanupFilters {
  plant_id: string;
  modules: ConfigCleanupModule[];
  include_related_rows: boolean;
}

interface ConfigCleanupPreviewRecord {
  token: string;
  payload: ConfigCleanupFilters;
  created_at: string;
  expires_at: string;
}

interface PlantSummaryRow {
  id: string;
  name: string;
  is_active?: boolean;
}

export interface PlantConfigurationCountsRow {
  plant_id: string;
  aggregates: number;
  silos: number;
  additives: number;
  diesel: number;
  products: number;
  hasInvalidAggregates: boolean;
}

export interface CalibrationCurvePointInput {
  point_key: number;
  point_value: number;
}

interface CalibrationCurveRow {
  id: string;
  plant_id: string;
  curve_name: string;
  measurement_type: string;
  reading_uom?: string | null;
  points: CalibrationCurvePointInput[];
  point_count: number;
  data_points: Record<string, number>;
}

interface ProductsImportInput {
  module?: string;
  template_version?: string;
  import_mode?: string;
  rows?: Array<{
    row_number?: number;
    product_name?: string;
    category?: string;
    measure_mode?: string;
    uom?: string;
    requires_photo?: string;
    reading_uom?: string;
    tank_capacity?: string;
    unit_volume?: string;
    calibration_table_json?: string;
    notes?: string;
    is_active?: string;
  }>;
}

export interface NormalizedProductsImportRow {
  row_number: number;
  product_name: string;
  category: 'OIL' | 'LUBRICANT' | 'CONSUMABLE' | 'EQUIPMENT' | 'OTHER';
  measure_mode: 'COUNT' | 'DRUM' | 'PAIL' | 'TANK_READING';
  uom: string;
  requires_photo: boolean;
  reading_uom: string | null;
  tank_capacity: number | null;
  unit_volume: number | null;
  calibration_table: Record<string, number> | null;
  notes: string;
  is_active: boolean;
  action: 'create' | 'update';
  existing_id?: string;
}

interface ProductsImportPreviewRecord {
  token: string;
  plant_id: string;
  payload: {
    module: 'products';
    template_version: string;
    import_mode: 'upsert';
    rows: ProductsImportInput['rows'];
  };
  created_at: string;
  expires_at: string;
}

const PRODUCTS_IMPORT_ALLOWED_CATEGORIES = ['OIL', 'LUBRICANT', 'CONSUMABLE', 'EQUIPMENT', 'OTHER'] as const;
const PRODUCTS_IMPORT_ALLOWED_MEASURE_MODES = ['COUNT', 'DRUM', 'PAIL', 'TANK_READING'] as const;
const AGGREGATES_IMPORT_ALLOWED_MEASUREMENT_METHODS = ['BOX', 'CONE'] as const;
const SILOS_IMPORT_ALLOWED_MEASUREMENT_METHODS = ['FEET_TO_CUBIC_YARDS'] as const;
const DIESEL_IMPORT_ALLOWED_MEASUREMENT_METHODS = ['TANK_LEVEL'] as const;

interface AggregatesImportInput {
  module?: string;
  template_version?: string;
  import_mode?: string;
  rows?: Array<{
    row_number?: number;
    aggregate_name?: string;
    material_type?: string;
    location_area?: string;
    measurement_method?: string;
    unit?: string;
    box_width_ft?: string;
    box_height_ft?: string;
    is_active?: string;
  }>;
}

export interface NormalizedAggregatesImportRow {
  row_number: number;
  aggregate_name: string;
  material_type: string;
  location_area: string;
  measurement_method: 'BOX' | 'CONE';
  unit: string;
  box_width_ft: number | null;
  box_height_ft: number | null;
  is_active: boolean;
  action: 'create' | 'update';
  existing_id?: string;
}

interface AggregatesImportPreviewRecord {
  token: string;
  plant_id: string;
  payload: {
    module: 'aggregates';
    template_version: string;
    import_mode: 'upsert';
    rows: AggregatesImportInput['rows'];
  };
  created_at: string;
  expires_at: string;
}

interface SilosImportInput {
  module?: string;
  template_version?: string;
  import_mode?: string;
  rows?: Array<{
    row_number?: number;
    silo_name?: string;
    measurement_method?: string;
    allowed_products?: string;
    is_active?: string;
  }>;
}

export interface NormalizedSilosImportRow {
  row_number: number;
  silo_name: string;
  measurement_method: 'FEET_TO_CUBIC_YARDS';
  allowed_products: string[];
  is_active: boolean;
  action: 'create' | 'update';
  existing_id?: string;
}

interface SilosImportPreviewRecord {
  token: string;
  plant_id: string;
  payload: {
    module: 'silos';
    template_version: string;
    import_mode: 'upsert';
    rows: SilosImportInput['rows'];
  };
  created_at: string;
  expires_at: string;
}

interface DieselImportInput {
  module?: string;
  template_version?: string;
  import_mode?: string;
  rows?: Array<{
    row_number?: number;
    measurement_method?: string;
    calibration_curve_name?: string;
    reading_uom?: string;
    tank_capacity_gallons?: string;
    initial_inventory_gallons?: string;
    calibration_table_json?: string;
    is_active?: string;
  }>;
}

export interface NormalizedDieselImportRow {
  row_number: number;
  measurement_method: 'TANK_LEVEL';
  calibration_curve_name: string | null;
  reading_uom: string;
  tank_capacity_gallons: number;
  initial_inventory_gallons: number | null;
  calibration_table: Record<string, number>;
  is_active: boolean;
  action: 'create' | 'update';
  existing_id?: string;
}

interface DieselImportPreviewRecord {
  token: string;
  plant_id: string;
  payload: {
    module: 'diesel';
    template_version: string;
    import_mode: 'upsert';
    rows: DieselImportInput['rows'];
  };
  created_at: string;
  expires_at: string;
}

interface MaterialsImportInput {
  module?: string;
  template_version?: string;
  import_mode?: string;
  rows?: Array<{
    row_number?: number;
    nombre?: string;
    clase?: string;
  }>;
}

export interface NormalizedMaterialsImportRow {
  row_number: number;
  nombre: string;
  clase: string | null;
  action: 'create' | 'update';
  unchanged: boolean;
  existing_id?: string;
}

interface MaterialsImportPreviewRecord {
  token: string;
  payload: {
    module: 'materiales';
    template_version: string;
    import_mode: 'upsert';
    rows: MaterialsImportInput['rows'];
  };
  created_at: string;
  expires_at: string;
}

interface ProcedenciasImportInput {
  module?: string;
  template_version?: string;
  import_mode?: string;
  rows?: Array<{
    row_number?: number;
    nombre?: string;
  }>;
}

export interface NormalizedProcedenciasImportRow {
  row_number: number;
  nombre: string;
  action: 'create' | 'update';
  unchanged: boolean;
  existing_id?: string;
}

interface ProcedenciasImportPreviewRecord {
  token: string;
  payload: {
    module: 'procedencias';
    template_version: string;
    import_mode: 'upsert';
    rows: ProcedenciasImportInput['rows'];
  };
  created_at: string;
  expires_at: string;
}

interface AdditivesCatalogImportInput {
  module?: string;
  template_version?: string;
  import_mode?: string;
  rows?: Array<{
    row_number?: number;
    nombre?: string;
    marca?: string;
    uom?: string;
  }>;
}

export interface NormalizedAdditivesCatalogImportRow {
  row_number: number;
  nombre: string;
  marca: string | null;
  uom: string;
  action: 'create' | 'update';
  unchanged: boolean;
  existing_id?: string;
}

interface AdditivesCatalogImportPreviewRecord {
  token: string;
  payload: {
    module: 'additivos_catalogo';
    template_version: string;
    import_mode: 'upsert';
    rows: AdditivesCatalogImportInput['rows'];
  };
  created_at: string;
  expires_at: string;
}

interface CalibrationCurvesImportInput {
  module?: string;
  template_version?: string;
  import_mode?: string;
  curves?: Array<{
    row_number?: number;
    curve_name?: string;
    measurement_type?: string;
    reading_uom?: string;
  }>;
  points?: Array<{
    row_number?: number;
    curve_name?: string;
    point_key?: string | number;
    point_value?: string | number;
  }>;
}

export interface NormalizedCalibrationCurvesImportRow {
  row_number: number;
  curve_name: string;
  measurement_type: string;
  reading_uom: string | null;
  points: CalibrationCurvePointInput[];
  data_points: Record<string, number>;
  action: 'create' | 'update';
  existing_id?: string;
  reference_count: number;
}

interface CalibrationCurvesImportPreviewRecord {
  token: string;
  plant_id: string;
  payload: {
    module: 'calibration_curves';
    template_version: string;
    import_mode: 'upsert';
    curves: CalibrationCurvesImportInput['curves'];
    points: CalibrationCurvesImportInput['points'];
  };
  created_at: string;
  expires_at: string;
}

function isValidYearMonth(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value.trim());
}

function normalizeStringArray(values: unknown, allowed?: readonly string[]) {
  if (!Array.isArray(values)) return [];

  const normalized = values
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  const filtered = allowed
    ? normalized.filter((value) => allowed.includes(value))
    : normalized;

  return Array.from(new Set(filtered)).sort();
}

function stableSortObject(value: any): any {
  if (Array.isArray(value)) {
    return value.map(stableSortObject);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((acc: Record<string, any>, key) => {
      acc[key] = stableSortObject(value[key]);
      return acc;
    }, {});
}

function stableStringify(value: any) {
  return JSON.stringify(stableSortObject(value));
}

function buildCleanupPreviewKey(token: string) {
  return `${CLEANUP_PREVIEW_PREFIX}${token}`;
}

function buildConfigCleanupPreviewKey(token: string) {
  return `${CONFIG_CLEANUP_PREVIEW_PREFIX}${token}`;
}

function buildProductsImportPreviewKey(token: string) {
  return `${PRODUCTS_IMPORT_PREVIEW_PREFIX}${token}`;
}

function buildAggregatesImportPreviewKey(token: string) {
  return `${AGGREGATES_IMPORT_PREVIEW_PREFIX}${token}`;
}

function buildSilosImportPreviewKey(token: string) {
  return `${SILOS_IMPORT_PREVIEW_PREFIX}${token}`;
}

function buildDieselImportPreviewKey(token: string) {
  return `${DIESEL_IMPORT_PREVIEW_PREFIX}${token}`;
}

function buildMaterialsImportPreviewKey(token: string) {
  return `${MATERIALS_IMPORT_PREVIEW_PREFIX}${token}`;
}

function buildProcedenciasImportPreviewKey(token: string) {
  return `${PROCEDENCIAS_IMPORT_PREVIEW_PREFIX}${token}`;
}

function buildAdditivesCatalogImportPreviewKey(token: string) {
  return `${ADDITIVES_CATALOG_IMPORT_PREVIEW_PREFIX}${token}`;
}

function buildCalibrationCurvesImportPreviewKey(token: string) {
  return `${CALIBRATION_CURVES_IMPORT_PREVIEW_PREFIX}${token}`;
}

function normalizeCleanupFilters(input: CleanupFiltersInput): CleanupFilters {
  const yearMonthFrom = isValidYearMonth(input.year_month_from) ? input.year_month_from.trim() : null;
  const yearMonthTo = isValidYearMonth(input.year_month_to) ? input.year_month_to.trim() : null;

  return {
    scope: 'transactional',
    plant_ids: normalizeStringArray(input.plant_ids),
    year_month_from: yearMonthFrom,
    year_month_to: yearMonthTo,
    statuses: normalizeStringArray(input.statuses, INVENTORY_STATUSES) as InventoryStatus[],
    include_photos: input.include_photos !== false,
  };
}

function normalizeConfigCleanupFilters(input: ConfigCleanupInput): ConfigCleanupFilters {
  return {
    plant_id: String(input.plant_id || '').trim(),
    modules: normalizeStringArray(input.modules, CONFIG_CLEANUP_MODULES) as ConfigCleanupModule[],
    include_related_rows: input.include_related_rows !== false,
  };
}

function normalizeProductsImportPayload(input: ProductsImportInput) {
  return {
    module: input.module === 'products' ? 'products' as const : 'products' as const,
    template_version: String(input.template_version || '').trim(),
    import_mode: input.import_mode === 'upsert' ? 'upsert' as const : 'upsert' as const,
    rows: Array.isArray(input.rows)
      ? input.rows.map((row) => ({
          row_number: Number(row?.row_number || 0),
          product_name: String(row?.product_name || ''),
          category: String(row?.category || ''),
          measure_mode: String(row?.measure_mode || ''),
          uom: String(row?.uom || ''),
          requires_photo: String(row?.requires_photo || ''),
          reading_uom: String(row?.reading_uom || ''),
          tank_capacity: String(row?.tank_capacity || ''),
          unit_volume: String(row?.unit_volume || ''),
          calibration_table_json: String(row?.calibration_table_json || ''),
          notes: String(row?.notes || ''),
          is_active: String(row?.is_active || ''),
        }))
      : [],
  };
}

function normalizeAggregatesImportPayload(input: AggregatesImportInput) {
  return {
    module: input.module === 'aggregates' ? 'aggregates' as const : 'aggregates' as const,
    template_version: String(input.template_version || '').trim(),
    import_mode: input.import_mode === 'upsert' ? 'upsert' as const : 'upsert' as const,
    rows: Array.isArray(input.rows)
      ? input.rows.map((row) => ({
          row_number: Number(row?.row_number || 0),
          aggregate_name: String(row?.aggregate_name || ''),
          material_type: String(row?.material_type || ''),
          location_area: String(row?.location_area || ''),
          measurement_method: String(row?.measurement_method || ''),
          unit: String(row?.unit || ''),
          box_width_ft: String(row?.box_width_ft || ''),
          box_height_ft: String(row?.box_height_ft || ''),
          is_active: String(row?.is_active || ''),
        }))
      : [],
  };
}

function normalizeSilosImportPayload(input: SilosImportInput) {
  return {
    module: input.module === 'silos' ? 'silos' as const : 'silos' as const,
    template_version: String(input.template_version || '').trim(),
    import_mode: input.import_mode === 'upsert' ? 'upsert' as const : 'upsert' as const,
    rows: Array.isArray(input.rows)
      ? input.rows.map((row) => ({
          row_number: Number(row?.row_number || 0),
          silo_name: String(row?.silo_name || ''),
          measurement_method: String(row?.measurement_method || ''),
          allowed_products: String(row?.allowed_products || ''),
          is_active: String(row?.is_active || ''),
        }))
      : [],
  };
}

function normalizeDieselImportPayload(input: DieselImportInput) {
  return {
    module: input.module === 'diesel' ? 'diesel' as const : 'diesel' as const,
    template_version: String(input.template_version || '').trim(),
    import_mode: input.import_mode === 'upsert' ? 'upsert' as const : 'upsert' as const,
    rows: Array.isArray(input.rows)
      ? input.rows.map((row) => ({
          row_number: Number(row?.row_number || 0),
          measurement_method: String(row?.measurement_method || ''),
          calibration_curve_name: String(row?.calibration_curve_name || ''),
          reading_uom: String(row?.reading_uom || ''),
          tank_capacity_gallons: String(row?.tank_capacity_gallons || ''),
          initial_inventory_gallons: String(row?.initial_inventory_gallons || ''),
          calibration_table_json: String(row?.calibration_table_json || ''),
          is_active: String(row?.is_active || ''),
        }))
      : [],
  };
}

function normalizeMaterialsImportPayload(input: MaterialsImportInput) {
  return {
    module: input.module === 'materiales' ? 'materiales' as const : 'materiales' as const,
    template_version: String(input.template_version || '').trim(),
    import_mode: input.import_mode === 'upsert' ? 'upsert' as const : 'upsert' as const,
    rows: Array.isArray(input.rows)
      ? input.rows.map((row) => ({
          row_number: Number(row?.row_number || 0),
          nombre: String(row?.nombre || ''),
          clase: String(row?.clase || ''),
        }))
      : [],
  };
}

function normalizeProcedenciasImportPayload(input: ProcedenciasImportInput) {
  return {
    module: input.module === 'procedencias' ? 'procedencias' as const : 'procedencias' as const,
    template_version: String(input.template_version || '').trim(),
    import_mode: input.import_mode === 'upsert' ? 'upsert' as const : 'upsert' as const,
    rows: Array.isArray(input.rows)
      ? input.rows.map((row) => ({
          row_number: Number(row?.row_number || 0),
          nombre: String(row?.nombre || ''),
        }))
      : [],
  };
}

function normalizeAdditivesCatalogImportPayload(input: AdditivesCatalogImportInput) {
  return {
    module: input.module === 'additivos_catalogo' ? 'additivos_catalogo' as const : 'additivos_catalogo' as const,
    template_version: String(input.template_version || '').trim(),
    import_mode: input.import_mode === 'upsert' ? 'upsert' as const : 'upsert' as const,
    rows: Array.isArray(input.rows)
      ? input.rows.map((row) => ({
          row_number: Number(row?.row_number || 0),
          nombre: String(row?.nombre || ''),
          marca: String(row?.marca || ''),
          uom: String(row?.uom || ''),
        }))
      : [],
  };
}

function normalizeCalibrationCurvesImportPayload(input: CalibrationCurvesImportInput) {
  return {
    module: input.module === 'calibration_curves' ? 'calibration_curves' as const : 'calibration_curves' as const,
    template_version: String(input.template_version || '').trim(),
    import_mode: input.import_mode === 'upsert' ? 'upsert' as const : 'upsert' as const,
    curves: Array.isArray(input.curves)
      ? input.curves.map((row) => ({
          row_number: Number(row?.row_number || 0),
          curve_name: String(row?.curve_name || ''),
          measurement_type: String(row?.measurement_type || ''),
          reading_uom: String(row?.reading_uom || ''),
        }))
      : [],
    points: Array.isArray(input.points)
      ? input.points.map((point) => ({
          row_number: Number(point?.row_number || 0),
          curve_name: String(point?.curve_name || ''),
          point_key: String(point?.point_key ?? ''),
          point_value: String(point?.point_value ?? ''),
        }))
      : [],
  };
}

function validateCleanupFilters(filters: CleanupFilters) {
  if (filters.scope !== 'transactional') {
    throw new Error('Solo se admite scope transactional en esta version.');
  }

  if (filters.year_month_from && !isValidYearMonth(filters.year_month_from)) {
    throw new Error('year_month_from no tiene un formato valido.');
  }

  if (filters.year_month_to && !isValidYearMonth(filters.year_month_to)) {
    throw new Error('year_month_to no tiene un formato valido.');
  }

  if (filters.year_month_from && filters.year_month_to && filters.year_month_from > filters.year_month_to) {
    throw new Error('El rango de meses es invalido: year_month_from no puede ser mayor que year_month_to.');
  }
}

function validateConfigCleanupFilters(filters: ConfigCleanupFilters) {
  if (!filters.plant_id) {
    throw new Error('Debes seleccionar una planta.');
  }

  if (filters.modules.length === 0) {
    throw new Error('Debes seleccionar al menos un modulo.');
  }
}

function validateProductsImportPayload(input: ReturnType<typeof normalizeProductsImportPayload>) {
  if (input.module !== 'products') {
    throw new Error('Solo se admite el modulo products en esta version.');
  }

  if (input.template_version !== '2.0') {
    throw new Error('La version de la plantilla no es compatible. Genera una plantilla nueva desde el sistema.');
  }

  if (input.import_mode !== 'upsert') {
    throw new Error('Solo se admite import_mode upsert en esta version.');
  }

  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    throw new Error('El archivo no contiene filas para importar.');
  }
}

function validateAggregatesImportPayload(input: ReturnType<typeof normalizeAggregatesImportPayload>) {
  if (input.module !== 'aggregates') {
    throw new Error('Solo se admite el modulo aggregates en esta version.');
  }

  if (input.template_version !== '2.0') {
    throw new Error('La version de la plantilla no es compatible. Genera una plantilla nueva desde el sistema.');
  }

  if (input.import_mode !== 'upsert') {
    throw new Error('Solo se admite import_mode upsert en esta version.');
  }

  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    throw new Error('El archivo no contiene filas para importar.');
  }
}

function validateSilosImportPayload(input: ReturnType<typeof normalizeSilosImportPayload>) {
  if (input.module !== 'silos') {
    throw new Error('Solo se admite el modulo silos en esta version.');
  }

  if (input.template_version !== '1.0') {
    throw new Error('La version de la plantilla no es compatible. Genera una plantilla nueva desde el sistema.');
  }

  if (input.import_mode !== 'upsert') {
    throw new Error('Solo se admite import_mode upsert en esta version.');
  }

  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    throw new Error('El archivo no contiene filas para importar.');
  }
}

function validateDieselImportPayload(input: ReturnType<typeof normalizeDieselImportPayload>) {
  if (input.module !== 'diesel') {
    throw new Error('Solo se admite el modulo diesel en esta version.');
  }

  if (input.template_version !== '1.0') {
    throw new Error('La version de la plantilla no es compatible. Genera una plantilla nueva desde el sistema.');
  }

  if (input.import_mode !== 'upsert') {
    throw new Error('Solo se admite import_mode upsert en esta version.');
  }

  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    throw new Error('El archivo no contiene filas para importar.');
  }
}

function validateMaterialsImportPayload(input: ReturnType<typeof normalizeMaterialsImportPayload>) {
  if (input.module !== 'materiales') {
    throw new Error('Solo se admite el modulo materiales en esta version.');
  }

  if (input.template_version !== '1.0') {
    throw new Error('La version de la plantilla no es compatible. Genera una plantilla nueva desde el sistema.');
  }

  if (input.import_mode !== 'upsert') {
    throw new Error('Solo se admite import_mode upsert en esta version.');
  }

  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    throw new Error('El archivo no contiene filas para importar.');
  }
}

function validateProcedenciasImportPayload(input: ReturnType<typeof normalizeProcedenciasImportPayload>) {
  if (input.module !== 'procedencias') {
    throw new Error('Solo se admite el modulo procedencias en esta version.');
  }

  if (input.template_version !== '1.0') {
    throw new Error('La version de la plantilla no es compatible. Genera una plantilla nueva desde el sistema.');
  }

  if (input.import_mode !== 'upsert') {
    throw new Error('Solo se admite import_mode upsert en esta version.');
  }

  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    throw new Error('El archivo no contiene filas para importar.');
  }
}

function validateAdditivesCatalogImportPayload(input: ReturnType<typeof normalizeAdditivesCatalogImportPayload>) {
  if (input.module !== 'additivos_catalogo') {
    throw new Error('Solo se admite el modulo additivos_catalogo en esta version.');
  }

  if (input.template_version !== '1.0') {
    throw new Error('La version de la plantilla no es compatible. Genera una plantilla nueva desde el sistema.');
  }

  if (input.import_mode !== 'upsert') {
    throw new Error('Solo se admite import_mode upsert en esta version.');
  }

  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    throw new Error('El archivo no contiene filas para importar.');
  }
}

function validateCalibrationCurvesImportPayload(input: ReturnType<typeof normalizeCalibrationCurvesImportPayload>) {
  if (input.module !== 'calibration_curves') {
    throw new Error('Solo se admite el modulo calibration_curves en esta version.');
  }

  if (input.template_version !== '2.0') {
    throw new Error('La version de la plantilla no es compatible. Genera una plantilla nueva desde el sistema.');
  }

  if (input.import_mode !== 'upsert') {
    throw new Error('Solo se admite import_mode upsert en esta version.');
  }

  if (!Array.isArray(input.curves) || input.curves.length === 0) {
    throw new Error('El archivo no contiene curvas para importar.');
  }

  if (!Array.isArray(input.points) || input.points.length === 0) {
    throw new Error('El archivo no contiene puntos para importar.');
  }
}

function createEmptyChildCounts() {
  return INVENTORY_CHILD_TABLES.reduce((acc: Record<string, number>, { table }) => {
    acc[table] = 0;
    return acc;
  }, {});
}

function createEmptyStatusCounts() {
  return INVENTORY_STATUSES.reduce((acc: Record<InventoryStatus, number>, status) => {
    acc[status] = 0;
    return acc;
  }, {} as Record<InventoryStatus, number>);
}

function createEmptyConfigModuleCounts() {
  return CONFIG_CLEANUP_MODULES.reduce((acc: Record<ConfigCleanupModule, number>, module) => {
    acc[module] = 0;
    return acc;
  }, {} as Record<ConfigCleanupModule, number>);
}

function sumModuleCounts(countsByTable: Record<string, number>, tables: string[]) {
  return tables.reduce((sum, table) => sum + (countsByTable[table] || 0), 0);
}

async function countRowsByPlant(table: string, plantId: string) {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('plant_id', plantId);

  if (error) throw error;
  return count || 0;
}

async function getPlantForConfigCleanup(plantId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('plants')
    .select('id, name, is_active')
    .eq('id', plantId)
    .single();

  if (error || !data) {
    throw new Error('Planta no encontrada.');
  }

  return data as PlantSummaryRow;
}

function normalizeCurveNameKey(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

interface RawCalibrationCurveRecord {
  id: string;
  plant_id: string;
  curve_name: string;
  measurement_type: string;
  reading_uom?: string | null;
  data_points?: Record<string, number> | null;
}

interface RawCalibrationCurvePointRecord {
  curve_id: string;
  point_key: string | number;
  point_value: string | number;
}

function parseCalibrationCurvePointNumber(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} debe ser numerico`);
  }
  return parsed;
}

function sortCalibrationCurvePoints(points: CalibrationCurvePointInput[]) {
  return [...points].sort((left, right) => left.point_key - right.point_key);
}

function buildCalibrationCurveDataPoints(points: CalibrationCurvePointInput[]) {
  return sortCalibrationCurvePoints(points).reduce((acc: Record<string, number>, point) => {
    acc[String(point.point_key)] = point.point_value;
    return acc;
  }, {});
}

function normalizeCalibrationCurvePoints(
  points: Array<{ point_key: unknown; point_value: unknown }> | null | undefined,
  options?: { allowEmpty?: boolean },
) {
  const normalized = Array.isArray(points)
    ? points
        .map((point) => ({
          point_key: parseCalibrationCurvePointNumber(point?.point_key, 'Key'),
          point_value: parseCalibrationCurvePointNumber(point?.point_value, 'Value'),
        }))
    : [];

  const seenKeys = new Set<number>();
  for (const point of normalized) {
    if (seenKeys.has(point.point_key)) {
      throw new Error(`Key duplicado: ${point.point_key}`);
    }
    seenKeys.add(point.point_key);
  }

  if (!options?.allowEmpty && normalized.length === 0) {
    throw new Error('La curva debe tener al menos un punto');
  }

  return sortCalibrationCurvePoints(normalized);
}

function normalizeCalibrationCurvePointsFromRecord(
  value: Record<string, number> | null | undefined,
  options?: { allowEmpty?: boolean },
) {
  const points = Object.entries(value || {}).map(([point_key, point_value]) => ({
    point_key,
    point_value,
  }));
  return normalizeCalibrationCurvePoints(points, options);
}

async function listCalibrationCurvePointsByCurveIds(curveIds: string[]) {
  if (curveIds.length === 0) {
    return new Map<string, CalibrationCurvePointInput[]>();
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('calibration_curve_points')
    .select('curve_id, point_key, point_value')
    .in('curve_id', curveIds)
    .order('point_key', { ascending: true });

  if (error) throw error;

  return (data || []).reduce((acc, row) => {
    const curveId = String((row as RawCalibrationCurvePointRecord).curve_id || '');
    const existing = acc.get(curveId) || [];
    existing.push({
      point_key: parseCalibrationCurvePointNumber((row as RawCalibrationCurvePointRecord).point_key, 'Key'),
      point_value: parseCalibrationCurvePointNumber((row as RawCalibrationCurvePointRecord).point_value, 'Value'),
    });
    acc.set(curveId, existing);
    return acc;
  }, new Map<string, CalibrationCurvePointInput[]>());
}

async function hydrateCalibrationCurves(rows: RawCalibrationCurveRecord[]) {
  const pointsByCurveId = await listCalibrationCurvePointsByCurveIds(rows.map((row) => row.id));

  return rows.map((row) => {
    const normalizedPoints = pointsByCurveId.get(row.id)?.length
      ? normalizeCalibrationCurvePoints(pointsByCurveId.get(row.id))
      : normalizeCalibrationCurvePointsFromRecord(row.data_points || {}, { allowEmpty: true });

    return {
      id: row.id,
      plant_id: row.plant_id,
      curve_name: row.curve_name,
      measurement_type: row.measurement_type,
      reading_uom: row.reading_uom ?? null,
      points: normalizedPoints,
      point_count: normalizedPoints.length,
      data_points: buildCalibrationCurveDataPoints(normalizedPoints),
    } satisfies CalibrationCurveRow;
  });
}

export async function listPlantCalibrationCurves(plantId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('calibration_curves')
    .select('id, plant_id, curve_name, measurement_type, reading_uom, data_points')
    .eq('plant_id', plantId)
    .order('curve_name', { ascending: true });

  if (error) throw error;
  return hydrateCalibrationCurves((data || []) as RawCalibrationCurveRecord[]);
}

function buildCalibrationCurveMap(rows: CalibrationCurveRow[]) {
  return rows.reduce((acc: Record<string, CalibrationCurveRow>, row) => {
    acc[normalizeCurveNameKey(row.curve_name)] = row;
    return acc;
  }, {});
}

export async function findPlantCalibrationCurveByName(plantId: string, curveName: string) {
  const rows = await listPlantCalibrationCurves(plantId);
  const curve = buildCalibrationCurveMap(rows)[normalizeCurveNameKey(curveName)] || null;
  return {
    curve,
    all: rows,
  };
}

function buildCalibrationCurveMapForPackage(rows: CalibrationCurveRow[]) {
  return rows.reduce((acc: Record<string, CalibrationCurveRow>, row) => {
    acc[row.id] = row;
    acc[row.curve_name] = row;
    return acc;
  }, {});
}

function areCalibrationTablesEquivalent(
  left: Record<string, number> | null | undefined,
  right: Record<string, number> | null | undefined,
) {
  return stableStringify(left || {}) === stableStringify(right || {});
}

export async function resolveDefaultSiloCalibrationCurve(plantId: string) {
  const curves = await listPlantCalibrationCurves(plantId);
  const siloCurves = curves.filter((curve) => normalizeCurveNameKey(curve.curve_name).startsWith('silo'));

  if (siloCurves.length === 1) {
    return {
      curve_name: siloCurves[0].curve_name,
      warning: null,
      candidates: siloCurves.map((curve) => curve.curve_name),
    };
  }

  if (siloCurves.length === 0) {
    return {
      curve_name: null,
      warning: 'La planta no tiene una curva SILO* configurada; los silos quedaron sin calibration_curve_name por defecto.',
      candidates: [],
    };
  }

  return {
    curve_name: null,
    warning: `La planta tiene múltiples curvas SILO* (${siloCurves.map((curve) => `"${curve.curve_name}"`).join(', ')}). Los silos no recibieron una calibration_curve_name por defecto para evitar ambigüedad.`,
    candidates: siloCurves.map((curve) => curve.curve_name),
  };
}

export async function getCalibrationCurveById(id: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('calibration_curves')
    .select('id, plant_id, curve_name, measurement_type, reading_uom, data_points')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const [curve] = await hydrateCalibrationCurves([data as RawCalibrationCurveRecord]);
  return curve || null;
}

async function replaceCalibrationCurvePoints(curveId: string, points: CalibrationCurvePointInput[]) {
  const supabase = getSupabaseClient();
  const normalizedPoints = normalizeCalibrationCurvePoints(points);

  const { error: deleteError } = await supabase
    .from('calibration_curve_points')
    .delete()
    .eq('curve_id', curveId);

  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from('calibration_curve_points')
    .insert(normalizedPoints.map((point) => ({
      curve_id: curveId,
      point_key: point.point_key,
      point_value: point.point_value,
    })));

  if (insertError) throw insertError;
}

export async function createCalibrationCurve(data: {
  plant_id: string;
  curve_name: string;
  measurement_type: string;
  reading_uom?: string | null;
  points?: CalibrationCurvePointInput[];
  data_points?: Record<string, number>;
}) {
  const points = data.points
    ? normalizeCalibrationCurvePoints(data.points)
    : normalizeCalibrationCurvePointsFromRecord(data.data_points || {});
  const derivedDataPoints = buildCalibrationCurveDataPoints(points);
  const supabase = getSupabaseClient();

  const { data: created, error } = await supabase
    .from('calibration_curves')
    .insert({
      plant_id: data.plant_id.trim(),
      curve_name: data.curve_name.trim(),
      measurement_type: data.measurement_type.trim(),
      reading_uom: normalizeCatalogOptionalText(data.reading_uom),
      data_points: derivedDataPoints,
    })
    .select('id, plant_id, curve_name, measurement_type, reading_uom, data_points')
    .single();

  if (error) throw error;
  await replaceCalibrationCurvePoints(created.id, points);
  const curve = await getCalibrationCurveById(created.id);
  if (!curve) {
    throw new Error('No se pudo recargar la curva creada.');
  }
  return curve;
}

export async function updateCalibrationCurve(id: string, patch: {
  curve_name?: string;
  measurement_type?: string;
  reading_uom?: string | null;
  points?: CalibrationCurvePointInput[];
  data_points?: Record<string, number>;
}) {
  const existing = await getCalibrationCurveById(id);
  if (!existing) {
    throw new Error('Curva no encontrada');
  }

  const points = patch.points
    ? normalizeCalibrationCurvePoints(patch.points)
    : patch.data_points
      ? normalizeCalibrationCurvePointsFromRecord(patch.data_points)
      : existing.points;
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    data_points: buildCalibrationCurveDataPoints(points),
  };

  if (patch.curve_name !== undefined) update.curve_name = patch.curve_name.trim();
  if (patch.measurement_type !== undefined) update.measurement_type = patch.measurement_type.trim();
  if (patch.reading_uom !== undefined) update.reading_uom = normalizeCatalogOptionalText(patch.reading_uom);

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('calibration_curves')
    .update(update)
    .eq('id', id);

  if (error) throw error;

  await replaceCalibrationCurvePoints(id, points);
  const curve = await getCalibrationCurveById(id);
  if (!curve) {
    throw new Error('No se pudo recargar la curva actualizada.');
  }
  return curve;
}

export async function getCalibrationCurveReferenceSummary(plantId: string, curveName: string) {
  const supabase = getSupabaseClient();
  const normalizedKey = normalizeCurveNameKey(curveName);

  const [
    { data: siloRows, error: silosError },
    { data: additiveRows, error: additivesError },
    { data: dieselRows, error: dieselError },
  ] = await Promise.all([
    supabase
      .from('plant_silos_config')
      .select('calibration_curve_name')
      .eq('plant_id', plantId)
      .neq('is_active', false),
    supabase
      .from('plant_additives_config')
      .select('calibration_curve_name')
      .eq('plant_id', plantId)
      .neq('is_active', false),
    supabase
      .from('plant_diesel_config')
      .select('calibration_curve_name')
      .eq('plant_id', plantId)
      .eq('is_active', true),
  ]);

  if (silosError) throw silosError;
  if (additivesError) throw additivesError;
  if (dieselError) throw dieselError;

  const silos = (siloRows || []).filter((row: any) => normalizeCurveNameKey(row?.calibration_curve_name) === normalizedKey).length;
  const additives = (additiveRows || []).filter((row: any) => normalizeCurveNameKey(row?.calibration_curve_name) === normalizedKey).length;
  const diesel = (dieselRows || []).filter((row: any) => normalizeCurveNameKey(row?.calibration_curve_name) === normalizedKey).length;

  return {
    silos,
    additives,
    diesel,
    total: silos + additives + diesel,
  };
}

export async function syncCalibrationCurveConsumers(
  plantId: string,
  curveName: string,
  readingUom: string | null | undefined,
  dataPoints: Record<string, number>,
) {
  const supabase = getSupabaseClient();
  const normalizedCurveName = String(curveName || '').trim();
  const normalizedReadingUom = normalizeCatalogOptionalText(readingUom);

  const { error: additivesError } = await supabase
    .from('plant_additives_config')
    .update({
      reading_uom: normalizedReadingUom,
      conversion_table: dataPoints,
      updated_at: new Date().toISOString(),
    })
    .eq('plant_id', plantId)
    .eq('calibration_curve_name', normalizedCurveName);

  if (additivesError) throw additivesError;

  const { error: dieselError } = await supabase
    .from('plant_diesel_config')
    .update({
      reading_uom: normalizedReadingUom,
      calibration_table: dataPoints,
      updated_at: new Date().toISOString(),
    })
    .eq('plant_id', plantId)
    .eq('calibration_curve_name', normalizedCurveName);

  if (dieselError) throw dieselError;
}

async function getInventoryMonthCountForPlant(plantId: string) {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from('inventory_month')
    .select('id', { count: 'exact', head: true })
    .eq('plant_id', plantId);

  if (error) throw error;
  return count || 0;
}

async function getSiloConfigIdsForPlant(plantId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('plant_silos_config')
    .select('id')
    .eq('plant_id', plantId);

  if (error) throw error;
  return (data || []).map((row: { id: string }) => row.id);
}

function normalizeBooleanString(value: string, defaultsTo: boolean) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return defaultsTo;
  if (['si', 'sí', 'true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['no', 'false', '0', 'n'].includes(normalized)) return false;
  throw new Error('debe ser Sí o No');
}

function parseNullableNumberString(value: string) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) {
    throw new Error('debe ser un numero valido');
  }
  return parsed;
}

function parseCalibrationTableJson(value: string) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error('debe contener un JSON valido');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('debe ser un objeto JSON con pares lectura:valor');
  }

  const result = Object.entries(parsed).reduce((acc: Record<string, number>, [key, rawValue]) => {
    const numericValue = Number(rawValue);
    if (Number.isNaN(numericValue)) {
      throw new Error('debe contener solo valores numericos');
    }
    acc[String(key)] = numericValue;
    return acc;
  }, {});

  if (Object.keys(result).length === 0) {
    throw new Error('no puede estar vacia');
  }

  return result;
}

function parsePipeSeparatedValues(value: string) {
  const normalized = String(value || '').trim();
  if (!normalized) return [];

  return Array.from(
    new Set(
      normalized
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function normalizeCatalogOptionalText(value: string | null | undefined) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeCatalogNameKey(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

type MaterialCatalogRow = {
  id: string;
  nombre: string;
  clase?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
};

type ProcedenciaCatalogRow = {
  id: string;
  nombre: string;
  sort_order?: number | null;
  is_active?: boolean;
};

function buildCatalogNameMap<T extends { nombre: string }>(rows: T[]) {
  return rows.reduce((acc: Record<string, T>, row) => {
    acc[normalizeCatalogNameKey(row.nombre)] = row;
    return acc;
  }, {});
}

export async function listMaterialCatalogItems() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('materiales_catalog')
    .select('id, nombre, clase, sort_order, is_active')
    .order('sort_order', { ascending: true })
    .order('nombre', { ascending: true });

  if (error) throw error;
  return (data || []) as MaterialCatalogRow[];
}

export async function findMaterialCatalogByName(materialName: string) {
  const rows = await listMaterialCatalogItems();
  const material = buildCatalogNameMap(rows)[normalizeCatalogNameKey(materialName)] || null;
  return {
    material,
    all: rows,
  };
}

export async function getMaterialCatalogById(id: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('materiales_catalog')
    .select('id, nombre, clase, sort_order, is_active')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function listProcedenciaCatalogItems() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('procedencias_catalog')
    .select('id, nombre, sort_order, is_active')
    .order('sort_order', { ascending: true })
    .order('nombre', { ascending: true });

  if (error) throw error;
  return (data || []) as ProcedenciaCatalogRow[];
}

export async function findProcedenciaCatalogByName(procedenciaName: string) {
  const rows = await listProcedenciaCatalogItems();
  const procedencia = buildCatalogNameMap(rows)[normalizeCatalogNameKey(procedenciaName)] || null;
  return {
    procedencia,
    all: rows,
  };
}

export async function getProcedenciaCatalogById(id: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('procedencias_catalog')
    .select('id, nombre, sort_order, is_active')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function getAdditiveCatalogById(id: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('additives_catalog')
    .select('id, nombre, marca, uom, sort_order, is_active')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function getMaterialCatalogReferenceSummary(materialName: string) {
  const supabase = getSupabaseClient();
  const normalizedKey = normalizeCatalogNameKey(materialName);
  const [{ data: aggregateRows, error: aggregateError }, { data: cajonRows, error: cajonError }] = await Promise.all([
    supabase
      .from('plant_aggregates_config')
      .select('material_type')
      .neq('is_active', false),
    supabase
      .from('plant_cajones_config')
      .select('material')
      .neq('is_active', false),
  ]);

  if (aggregateError) throw aggregateError;
  if (cajonError) throw cajonError;

  const aggregates = (aggregateRows || []).filter((row: any) => normalizeCatalogNameKey(row?.material_type) === normalizedKey).length;
  const cajones = (cajonRows || []).filter((row: any) => normalizeCatalogNameKey(row?.material) === normalizedKey).length;

  return {
    aggregates,
    cajones,
    total: aggregates + cajones,
  };
}

export async function syncMaterialCatalogConsumers(previousName: string, nextName: string) {
  const normalizedPrevious = String(previousName || '').trim();
  const normalizedNext = String(nextName || '').trim();
  if (!normalizedPrevious || !normalizedNext || normalizedPrevious === normalizedNext) return;

  const supabase = getSupabaseClient();
  const [{ data: aggregateRows, error: aggregateError }, { data: cajonRows, error: cajonError }] = await Promise.all([
    supabase
      .from('plant_aggregates_config')
      .select('id, material_type')
      .neq('is_active', false),
    supabase
      .from('plant_cajones_config')
      .select('id, material')
      .neq('is_active', false),
  ]);

  if (aggregateError) throw aggregateError;
  if (cajonError) throw cajonError;

  const aggregateIds = (aggregateRows || [])
    .filter((row: any) => normalizeCatalogNameKey(row?.material_type) === normalizeCatalogNameKey(normalizedPrevious))
    .map((row: any) => row.id);
  const cajonIds = (cajonRows || [])
    .filter((row: any) => normalizeCatalogNameKey(row?.material) === normalizeCatalogNameKey(normalizedPrevious))
    .map((row: any) => row.id);

  if (aggregateIds.length > 0) {
    const { error } = await supabase
      .from('plant_aggregates_config')
      .update({ material_type: normalizedNext, updated_at: new Date().toISOString() })
      .in('id', aggregateIds);
    if (error) throw error;
  }

  if (cajonIds.length > 0) {
    const { error } = await supabase
      .from('plant_cajones_config')
      .update({ material: normalizedNext, updated_at: new Date().toISOString() })
      .in('id', cajonIds);
    if (error) throw error;
  }
}

export async function getProcedenciaCatalogReferenceSummary(procedenciaName: string) {
  const supabase = getSupabaseClient();
  const normalizedKey = normalizeCatalogNameKey(procedenciaName);
  const [{ data: aggregateRows, error: aggregateError }, { data: cajonRows, error: cajonError }] = await Promise.all([
    supabase
      .from('plant_aggregates_config')
      .select('location_area')
      .neq('is_active', false),
    supabase
      .from('plant_cajones_config')
      .select('procedencia')
      .neq('is_active', false),
  ]);

  if (aggregateError) throw aggregateError;
  if (cajonError) throw cajonError;

  const aggregates = (aggregateRows || []).filter((row: any) => normalizeCatalogNameKey(row?.location_area) === normalizedKey).length;
  const cajones = (cajonRows || []).filter((row: any) => normalizeCatalogNameKey(row?.procedencia) === normalizedKey).length;

  return {
    aggregates,
    cajones,
    total: aggregates + cajones,
  };
}

export async function syncProcedenciaCatalogConsumers(previousName: string, nextName: string) {
  const normalizedPrevious = String(previousName || '').trim();
  const normalizedNext = String(nextName || '').trim();
  if (!normalizedPrevious || !normalizedNext || normalizedPrevious === normalizedNext) return;

  const supabase = getSupabaseClient();
  const [{ data: aggregateRows, error: aggregateError }, { data: cajonRows, error: cajonError }] = await Promise.all([
    supabase
      .from('plant_aggregates_config')
      .select('id, location_area')
      .neq('is_active', false),
    supabase
      .from('plant_cajones_config')
      .select('id, procedencia')
      .neq('is_active', false),
  ]);

  if (aggregateError) throw aggregateError;
  if (cajonError) throw cajonError;

  const aggregateIds = (aggregateRows || [])
    .filter((row: any) => normalizeCatalogNameKey(row?.location_area) === normalizeCatalogNameKey(normalizedPrevious))
    .map((row: any) => row.id);
  const cajonIds = (cajonRows || [])
    .filter((row: any) => normalizeCatalogNameKey(row?.procedencia) === normalizeCatalogNameKey(normalizedPrevious))
    .map((row: any) => row.id);

  if (aggregateIds.length > 0) {
    const { error } = await supabase
      .from('plant_aggregates_config')
      .update({ location_area: normalizedNext, updated_at: new Date().toISOString() })
      .in('id', aggregateIds);
    if (error) throw error;
  }

  if (cajonIds.length > 0) {
    const { error } = await supabase
      .from('plant_cajones_config')
      .update({ procedencia: normalizedNext, updated_at: new Date().toISOString() })
      .in('id', cajonIds);
    if (error) throw error;
  }
}

export async function getAdditiveCatalogReferenceSummary(catalogAdditiveId: string) {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from('plant_additives_config')
    .select('id', { count: 'exact', head: true })
    .eq('catalog_additive_id', catalogAdditiveId)
    .neq('is_active', false);

  if (error) throw error;
  return {
    additives: count || 0,
    total: count || 0,
  };
}

export async function syncAdditiveCatalogConsumers(
  catalogAdditiveId: string,
  payload: {
    nombre: string;
    marca?: string | null;
    uom: string;
  },
) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('plant_additives_config')
    .update({
      additive_name: payload.nombre,
      brand: payload.marca || '',
      uom: payload.uom,
      updated_at: new Date().toISOString(),
    })
    .eq('catalog_additive_id', catalogAdditiveId);

  if (error) throw error;
}

async function queryInventoryMonths(filters: CleanupFilters, options?: { page?: number; pageSize?: number; countExact?: boolean }) {
  const supabase = getSupabaseClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 25;
  const countExact = options?.countExact ?? false;

  let query = supabase
    .from('inventory_month')
    .select('id, plant_id, year_month, status, created_by, created_at, updated_at', { count: countExact ? 'exact' : undefined })
    .order('year_month', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.plant_ids.length > 0) {
    query = query.in('plant_id', filters.plant_ids);
  }

  if (filters.year_month_from) {
    query = query.gte('year_month', filters.year_month_from);
  }

  if (filters.year_month_to) {
    query = query.lte('year_month', filters.year_month_to);
  }

  if (filters.statuses.length === 1) {
    query = query.eq('status', filters.statuses[0]);
  } else if (filters.statuses.length > 1) {
    query = query.in('status', filters.statuses);
  }

  if (options) {
    query = query.range((page - 1) * pageSize, (page - 1) * pageSize + pageSize - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    items: (data || []) as InventoryMonthRow[],
    total: count ?? null,
  };
}

async function fetchChildRowsForInventoryMonths(inventoryMonthIds: string[]) {
  const supabase = getSupabaseClient();

  if (inventoryMonthIds.length === 0) {
    return INVENTORY_CHILD_TABLES.reduce((acc: Record<string, any[]>, { table }) => {
      acc[table] = [];
      return acc;
    }, {});
  }

  const results = await Promise.all(
    INVENTORY_CHILD_TABLES.map(async ({ table }) => {
      const { data, error } = await supabase
        .from(table)
        .select('inventory_month_id, photo_url')
        .in('inventory_month_id', inventoryMonthIds);

      if (error) throw error;
      return [table, data || []] as const;
    })
  );

  return Object.fromEntries(results) as Record<string, Array<{ inventory_month_id: string; photo_url?: string | null }>>;
}

function aggregateChildCounts(
  inventoryMonths: InventoryMonthRow[],
  childRowsByTable: Record<string, Array<{ inventory_month_id: string; photo_url?: string | null }>>
) {
  const countsByInventoryMonth = inventoryMonths.reduce((acc: Record<string, { child_counts: Record<string, number>; photo_count: number }>, month) => {
    acc[month.id] = {
      child_counts: createEmptyChildCounts(),
      photo_count: 0,
    };
    return acc;
  }, {});

  const countsByTable = {
    inventory_month: inventoryMonths.length,
    ...createEmptyChildCounts(),
  } as Record<string, number>;

  let totalPhotos = 0;

  Object.entries(childRowsByTable).forEach(([table, rows]) => {
    countsByTable[table] = rows.length;

    rows.forEach((row) => {
      const target = countsByInventoryMonth[row.inventory_month_id];
      if (!target) return;

      target.child_counts[table] += 1;
      if (row.photo_url) {
        target.photo_count += 1;
        totalPhotos += 1;
      }
    });
  });

  return {
    countsByInventoryMonth,
    countsByTable,
    totalPhotos,
  };
}

function buildPreviewWarnings(inventoryMonths: InventoryMonthRow[], deletedPhotosCount: number) {
  const warnings: string[] = [];

  if (inventoryMonths.some((month) => month.status === 'APPROVED')) {
    warnings.push('La seleccion incluye inventarios aprobados.');
  }

  if (inventoryMonths.some((month) => month.status === 'SUBMITTED')) {
    warnings.push('La seleccion incluye inventarios enviados para aprobacion.');
  }

  if (deletedPhotosCount > 0) {
    warnings.push(`Se eliminaran ${deletedPhotosCount} fotografias asociadas.`);
  }

  return warnings;
}

function summarizePreview(inventoryMonths: InventoryMonthRow[], countsByTable: Record<string, number>, deletedPhotosCount: number) {
  return {
    inventory_month_ids: inventoryMonths.map((month) => month.id),
    plants: Array.from(new Set(inventoryMonths.map((month) => month.plant_id))).sort(),
    year_months: Array.from(new Set(inventoryMonths.map((month) => month.year_month))).sort(),
    counts_by_table: countsByTable,
    deleted_photos_count: deletedPhotosCount,
    warnings: buildPreviewWarnings(inventoryMonths, deletedPhotosCount),
  };
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

export async function initializeDatabaseSchema() {
  const supabase = getSupabaseClient();
  
  console.log('Starting database schema initialization...');
  
  try {
    // Note: Since we cannot execute raw SQL DDL statements directly,
    // we need to create tables through Supabase Dashboard or migrations.
    // For this implementation, we'll use a workaround with the KV store
    // to track initialization status and rely on Supabase Dashboard setup.
    
    // Check if tables exist by attempting to query them
    const tablesToCheck = [
      'additives_catalog',
      'calibration_curves',
      'plant_aggregates_config',
      'plant_silos_config',
      'plant_cajones_config',
      'silo_allowed_products',
      'plant_additives_config',
      'plant_diesel_config',
      'plant_products_config',
      'plant_utilities_meters_config',
      'plant_petty_cash_config',
      'inventory_month',
      'inventory_aggregates_entries',
      'inventory_silos_entries',
      'inventory_additives_entries',
      'inventory_diesel_entries',
      'inventory_products_entries',
      'inventory_utilities_entries',
      'inventory_petty_cash_entries'
    ];
    
    const results = [];
    for (const table of tablesToCheck) {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error) {
        results.push({ table, exists: false, error: error.message });
      } else {
        results.push({ table, exists: true });
      }
    }
    
    const missingTables = results.filter(r => !r.exists);
    
    if (missingTables.length > 0) {
      console.error('Missing tables:', missingTables);
      
      const friendlyMessage = 
        `❌ Las tablas de base de datos no existen todavía.\\n\\n` +
        `📋 Tablas faltantes: ${missingTables.length}/${tablesToCheck.length}\\n\\n` +
        `📝 ACCIÓN REQUERIDA:\\n` +
        `1. Ve a Supabase Dashboard → SQL Editor\\n` +
        `2. Ejecuta el contenido del archivo /supabase/schema.sql\\n` +
        `3. Vuelve aquí y haz clic en \"Verificar Tablas\"\\n\\n` +
        `ℹ️ Figma Make no puede crear tablas automáticamente. Debes ejecutar el SQL manualmente en Supabase Dashboard.`;
      
      throw new Error(friendlyMessage);
    }
    
    console.log('✅ All tables exist and are accessible');
    return { success: true, tables: results };
    
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// ============================================================================
// CONFIGURATION QUERIES
// ============================================================================

export async function getPlantConfigPackage(plantId: string) {
  const supabase = getSupabaseClient();
  
  try {
    console.log(`🔍 [getPlantConfigPackage] Starting fetch for plant: ${plantId}`);
    
    // Fetch all configuration tables
    const [
      aggregatesRes,
      silosRes,
      cajonesRes,
      additivesRes,
      dieselRes,
      productsRes,
      utilitiesRes,
      pettyCashRes,
      curves,
    ] = await Promise.all([
      supabase.from('plant_aggregates_config').select('*').eq('plant_id', plantId).neq('is_active', false).order('sort_order'),
      supabase.from('plant_silos_config').select('*').eq('plant_id', plantId).neq('is_active', false).order('sort_order'),
      supabase.from('plant_cajones_config').select('*').eq('plant_id', plantId).neq('is_active', false).order('sort_order'),
      supabase.from('plant_additives_config').select('*').eq('plant_id', plantId).neq('is_active', false).order('sort_order'),
      supabase.from('plant_diesel_config').select('*').eq('plant_id', plantId).eq('is_active', true).single(),
      supabase.from('plant_products_config').select('*').eq('plant_id', plantId).neq('is_active', false).order('sort_order'),
      supabase.from('plant_utilities_meters_config').select('*').eq('plant_id', plantId).neq('is_active', false).order('sort_order'),
      supabase.from('plant_petty_cash_config').select('*').eq('plant_id', plantId).eq('is_active', true).single(),
      listPlantCalibrationCurves(plantId),
    ]);
    
    console.log(`📊 [getPlantConfigPackage] Aggregates query result:`, {
      error: aggregatesRes.error,
      count: aggregatesRes.data?.length || 0,
      data: aggregatesRes.data
    });
    
    if (aggregatesRes.error) {
      console.error(`❌ [getPlantConfigPackage] Aggregates query error:`, aggregatesRes.error);
    }

    if (silosRes.error) {
      console.error(`❌ [getPlantConfigPackage] Silos query error:`, silosRes.error);
    }

    if (cajonesRes.error) {
      console.error(`❌ [getPlantConfigPackage] Cajones query error:`, cajonesRes.error);
    }
    
    const calibration_curves = buildCalibrationCurveMapForPackage(curves || []);
    const siloIds = (silosRes.data || []).map((silo) => silo.id).filter(Boolean);
    let siloAllowedProductsBySiloId: Record<string, string[]> = {};

    if (siloIds.length > 0) {
      const { data: siloAllowedProductsRows, error: siloAllowedProductsError } = await supabase
        .from('silo_allowed_products')
        .select('silo_config_id, product_name')
        .in('silo_config_id', siloIds);

      if (siloAllowedProductsError) {
        console.error(`❌ [getPlantConfigPackage] Silo allowed products query error:`, siloAllowedProductsError);
      } else {
        siloAllowedProductsBySiloId = (siloAllowedProductsRows || []).reduce((acc: Record<string, string[]>, row: any) => {
          if (!row?.silo_config_id || !row?.product_name) return acc;
          if (!acc[row.silo_config_id]) acc[row.silo_config_id] = [];
          acc[row.silo_config_id].push(row.product_name);
          return acc;
        }, {});
      }
    }
    
    // Format silos with allowed products
    const silos = (silosRes.data || []).map(silo => ({
      ...silo,
      allowed_products: siloAllowedProductsBySiloId[silo.id] || []
    }));

    const cajones = (cajonesRes.data || []).map((cajon: any) => ({
      id: cajon.id,
      name: cajon.cajon_name,
      material: cajon.material ?? '',
      procedencia: cajon.procedencia ?? '',
      ancho: Number(cajon.box_width_ft ?? 0),
      alto: Number(cajon.box_height_ft ?? 0),
      sort_order: cajon.sort_order ?? 0,
      is_active: cajon.is_active ?? true,
    }));
    
    return {
      plant_id: plantId,
      aggregates: aggregatesRes.data || [],
      cajones,
      silos,
      additives: additivesRes.data || [],
      diesel: dieselRes.data || null,
      products: productsRes.data || [],
      utilities_meters: utilitiesRes.data || [],
      petty_cash: pettyCashRes.data || null,
      calibration_curves
    };
  } catch (error) {
    console.error('Error fetching plant configuration:', error);
    throw error;
  }
}

export async function listPlantConfigurationCounts(plantIds: string[]) {
  if (plantIds.length === 0) {
    return [] as PlantConfigurationCountsRow[];
  }

  const supabase = getSupabaseClient();
  const [
    { data: aggregatesRows, error: aggregatesError },
    { data: cajonesRows, error: cajonesError },
    { data: silosRows, error: silosError },
    { data: additivesRows, error: additivesError },
    { data: dieselRows, error: dieselError },
    { data: productsRows, error: productsError },
  ] = await Promise.all([
    supabase
      .from('plant_aggregates_config')
      .select('plant_id, measurement_method, box_width_ft, box_height_ft')
      .in('plant_id', plantIds)
      .neq('is_active', false),
    supabase
      .from('plant_cajones_config')
      .select('plant_id, box_width_ft, box_height_ft')
      .in('plant_id', plantIds)
      .neq('is_active', false),
    supabase
      .from('plant_silos_config')
      .select('plant_id')
      .in('plant_id', plantIds)
      .neq('is_active', false),
    supabase
      .from('plant_additives_config')
      .select('plant_id')
      .in('plant_id', plantIds)
      .neq('is_active', false),
    supabase
      .from('plant_diesel_config')
      .select('plant_id')
      .in('plant_id', plantIds)
      .eq('is_active', true),
    supabase
      .from('plant_products_config')
      .select('plant_id')
      .in('plant_id', plantIds)
      .neq('is_active', false),
  ]);

  [
    aggregatesError,
    cajonesError,
    silosError,
    additivesError,
    dieselError,
    productsError,
  ].forEach((error) => {
    if (error) throw error;
  });

  const countByPlant = (rows: Array<{ plant_id: string }> | null | undefined) =>
    (rows || []).reduce((acc: Record<string, number>, row) => {
      const plantId = String(row?.plant_id || '');
      if (!plantId) return acc;
      acc[plantId] = (acc[plantId] || 0) + 1;
      return acc;
    }, {});

  const invalidAggregatesByPlant = (aggregatesRows || []).reduce((acc: Record<string, boolean>, row: any) => {
    const plantId = String(row?.plant_id || '');
    if (!plantId) return acc;
    const measurementMethod = String(row?.measurement_method || 'BOX').toUpperCase();
    if (measurementMethod !== 'BOX') return acc;
    if (Number(row?.box_width_ft ?? 0) <= 0 || Number(row?.box_height_ft ?? 0) <= 0) {
      acc[plantId] = true;
    }
    return acc;
  }, {});

  const invalidCajonesByPlant = (cajonesRows || []).reduce((acc: Record<string, boolean>, row: any) => {
    const plantId = String(row?.plant_id || '');
    if (!plantId) return acc;
    if (Number(row?.box_width_ft ?? 0) <= 0 || Number(row?.box_height_ft ?? 0) <= 0) {
      acc[plantId] = true;
    }
    return acc;
  }, {});

  const aggregatesCountByPlant = countByPlant(aggregatesRows as Array<{ plant_id: string }> | null);
  const cajonesCountByPlant = countByPlant(cajonesRows as Array<{ plant_id: string }> | null);
  const silosCountByPlant = countByPlant(silosRows);
  const additivesCountByPlant = countByPlant(additivesRows);
  const dieselCountByPlant = countByPlant(dieselRows);
  const productsCountByPlant = countByPlant(productsRows);

  return plantIds.map((plantId) => {
    const aggregateCount = aggregatesCountByPlant[plantId] || 0;
    const cajonesCount = cajonesCountByPlant[plantId] || 0;

    return {
      plant_id: plantId,
      aggregates: aggregateCount > 0 ? aggregateCount : cajonesCount,
      silos: silosCountByPlant[plantId] || 0,
      additives: additivesCountByPlant[plantId] || 0,
      diesel: dieselCountByPlant[plantId] || 0,
      products: productsCountByPlant[plantId] || 0,
      hasInvalidAggregates: aggregateCount > 0
        ? Boolean(invalidAggregatesByPlant[plantId])
        : Boolean(invalidCajonesByPlant[plantId]),
    } satisfies PlantConfigurationCountsRow;
  });
}

// ============================================================================
// INVENTORY MONTH OPERATIONS
// ============================================================================

export async function getOrCreateInventoryMonth(plantId: string, yearMonth: string, createdBy: string) {
  const supabase = getSupabaseClient();
  
  // Try to get existing inventory month
  const { data: existing } = await supabase
    .from('inventory_month')
    .select('*')
    .eq('plant_id', plantId)
    .eq('year_month', yearMonth)
    .single();
  
  if (existing) {
    return existing;
  }
  
  // Create new inventory month
  const { data: newMonth, error } = await supabase
    .from('inventory_month')
    .insert({
      plant_id: plantId,
      year_month: yearMonth,
      status: 'IN_PROGRESS',
      created_by: createdBy
    })
    .select()
    .single();
  
  if (error) throw error;
  return newMonth;
}

export async function getInventoryMonthData(inventoryMonthId: string) {
  const supabase = getSupabaseClient();
  
  try {
    const [
      monthRes,
      aggregatesRes,
      silosRes,
      additivesRes,
      dieselRes,
      productsRes,
      utilitiesRes,
      pettyCashRes
    ] = await Promise.all([
      supabase.from('inventory_month').select('*').eq('id', inventoryMonthId).single(),
      supabase.from('inventory_aggregates_entries').select('*').eq('inventory_month_id', inventoryMonthId),
      supabase.from('inventory_silos_entries').select('*').eq('inventory_month_id', inventoryMonthId),
      supabase.from('inventory_additives_entries').select('*').eq('inventory_month_id', inventoryMonthId),
      supabase.from('inventory_diesel_entries').select('*').eq('inventory_month_id', inventoryMonthId).single(),
      supabase.from('inventory_products_entries').select('*').eq('inventory_month_id', inventoryMonthId),
      supabase.from('inventory_utilities_entries').select('*').eq('inventory_month_id', inventoryMonthId),
      supabase.from('inventory_petty_cash_entries').select('*').eq('inventory_month_id', inventoryMonthId).single()
    ]);
    
    return {
      inventory_month: monthRes.data,
      aggregates_entries: aggregatesRes.data || [],
      silos_entries: silosRes.data || [],
      additives_entries: additivesRes.data || [],
      diesel_entry: dieselRes.data || null,
      products_entries: productsRes.data || [],
      utilities_entries: utilitiesRes.data || [],
      petty_cash_entry: pettyCashRes.data || null
    };
  } catch (error) {
    console.error('Error fetching inventory month data:', error);
    throw error;
  }
}

export async function updateInventoryMonthStatus(
  inventoryMonthId: string,
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED',
  actorName?: string
) {
  const supabase = getSupabaseClient();
  
  const updateData: any = { status, updated_at: new Date().toISOString() };
  
  if (status === 'APPROVED' && actorName) {
    updateData.approved_by = actorName;
    updateData.approved_at = new Date().toISOString();
  }
  
  const { data, error } = await supabase
    .from('inventory_month')
    .update(updateData)
    .eq('id', inventoryMonthId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getInventoryMonthByPlantAndDate(plantId: string, yearMonth: string) {
  const supabase = getSupabaseClient();
  
  try {
    // Get inventory month
    const { data: month, error: monthError } = await supabase
      .from('inventory_month')
      .select('*')
      .eq('plant_id', plantId)
      .eq('year_month', yearMonth)
      .single();
    
    if (monthError || !month) {
      return null;
    }
    
    // Get all entries for this month
    const [
      silosRes,
      agregadosRes,
      aditivosRes,
      dieselRes,
      productosRes,
      utilitiesRes,
      pettyCashRes
    ] = await Promise.all([
      supabase.from('inventory_silos_entries').select('*').eq('inventory_month_id', month.id),
      supabase.from('inventory_aggregates_entries').select('*').eq('inventory_month_id', month.id),
      supabase.from('inventory_additives_entries').select('*').eq('inventory_month_id', month.id),
      supabase.from('inventory_diesel_entries').select('*').eq('inventory_month_id', month.id).maybeSingle(),
      supabase.from('inventory_products_entries').select('*').eq('inventory_month_id', month.id),
      supabase.from('inventory_utilities_entries').select('*').eq('inventory_month_id', month.id),
      supabase.from('inventory_petty_cash_entries').select('*').eq('inventory_month_id', month.id).maybeSingle()
    ]);
    
    return {
      month,
      silos: silosRes.data || [],
      agregados: agregadosRes.data || [],
      aditivos: aditivosRes.data || [],
      diesel: dieselRes.data || null,
      productos: productosRes.data || [],
      utilities: utilitiesRes.data || [],
      meters: utilitiesRes.data || [], // meters are also in utilities
      pettyCash: pettyCashRes.data || null
    };
  } catch (error) {
    console.error('Error fetching inventory month by plant and date:', error);
    throw error;
  }
}

export async function getDataControlSummary() {
  const supabase = getSupabaseClient();

  const [
    plantsRes,
    inventoryMonthsRes,
    aggregatesRes,
    cajonesRes,
    silosRes,
    additivesRes,
    dieselRes,
    productsRes,
    utilitiesRes,
    pettyCashRes,
  ] = await Promise.all([
    supabase.from('plants').select('id, name, is_active').order('name'),
    supabase.from('inventory_month').select('id, plant_id, status, year_month'),
    supabase.from('plant_aggregates_config').select('plant_id').neq('is_active', false),
    supabase.from('plant_cajones_config').select('plant_id').neq('is_active', false),
    supabase.from('plant_silos_config').select('plant_id').neq('is_active', false),
    supabase.from('plant_additives_config').select('plant_id').neq('is_active', false),
    supabase.from('plant_diesel_config').select('plant_id').neq('is_active', false),
    supabase.from('plant_products_config').select('plant_id').neq('is_active', false),
    supabase.from('plant_utilities_meters_config').select('plant_id').neq('is_active', false),
    supabase.from('plant_petty_cash_config').select('plant_id').neq('is_active', false),
  ]);

  [
    plantsRes,
    inventoryMonthsRes,
    aggregatesRes,
    cajonesRes,
    silosRes,
    additivesRes,
    dieselRes,
    productsRes,
    utilitiesRes,
    pettyCashRes,
  ].forEach((result) => {
    if (result.error) throw result.error;
  });

  const plants = plantsRes.data || [];
  const inventoryMonths = (inventoryMonthsRes.data || []) as Array<{ id: string; plant_id: string; status: InventoryStatus; year_month: string }>;
  const childRowsByTable = await fetchChildRowsForInventoryMonths(inventoryMonths.map((month) => month.id));
  const { countsByInventoryMonth, totalPhotos } = aggregateChildCounts(
    inventoryMonths.map((month) => ({
      ...month,
      created_by: '',
      created_at: '',
      updated_at: '',
    })),
    childRowsByTable
  );

  const countByPlant = (rows: Array<{ plant_id: string }> | null) =>
    (rows || []).reduce((acc: Record<string, number>, row) => {
      acc[row.plant_id] = (acc[row.plant_id] || 0) + 1;
      return acc;
    }, {});

  const configCoverageMaps = {
    aggregates: countByPlant(aggregatesRes.data),
    cajones: countByPlant(cajonesRes.data),
    silos: countByPlant(silosRes.data),
    additives: countByPlant(additivesRes.data),
    diesel: countByPlant(dieselRes.data),
    products: countByPlant(productsRes.data),
    utilities: countByPlant(utilitiesRes.data),
    petty_cash: countByPlant(pettyCashRes.data),
  };

  const inventoryByPlant = inventoryMonths.reduce((acc: Record<string, { total_months: number; by_status: Record<InventoryStatus, number>; photos: number }>, month) => {
    if (!acc[month.plant_id]) {
      acc[month.plant_id] = {
        total_months: 0,
        by_status: createEmptyStatusCounts(),
        photos: 0,
      };
    }

    acc[month.plant_id].total_months += 1;
    acc[month.plant_id].by_status[month.status] += 1;
    acc[month.plant_id].photos += countsByInventoryMonth[month.id]?.photo_count || 0;
    return acc;
  }, {});

  const byStatus = createEmptyStatusCounts();
  inventoryMonths.forEach((month) => {
    byStatus[month.status] += 1;
  });

  const basePlantRows = plants.map((plant) => ({
    plant_id: plant.id,
    plant_name: plant.name,
  }));

  return {
    plants: {
      total: plants.length,
      active: plants.filter((plant) => plant.is_active !== false).length,
      inactive: plants.filter((plant) => plant.is_active === false).length,
    },
    configurationCoverage: basePlantRows.map((plant) => ({
      ...plant,
      aggregates: (configCoverageMaps.aggregates[plant.plant_id] || 0) > 0
        ? (configCoverageMaps.aggregates[plant.plant_id] || 0)
        : (configCoverageMaps.cajones[plant.plant_id] || 0),
      silos: configCoverageMaps.silos[plant.plant_id] || 0,
      additives: configCoverageMaps.additives[plant.plant_id] || 0,
      diesel: configCoverageMaps.diesel[plant.plant_id] || 0,
      products: configCoverageMaps.products[plant.plant_id] || 0,
      utilities: configCoverageMaps.utilities[plant.plant_id] || 0,
      petty_cash: configCoverageMaps.petty_cash[plant.plant_id] || 0,
    })),
    inventorySummary: {
      total_months: inventoryMonths.length,
      by_status: byStatus,
      by_plant: basePlantRows.map((plant) => ({
        ...plant,
        total_months: inventoryByPlant[plant.plant_id]?.total_months || 0,
        by_status: inventoryByPlant[plant.plant_id]?.by_status || createEmptyStatusCounts(),
        photos: inventoryByPlant[plant.plant_id]?.photos || 0,
      })),
    },
    photoSummary: {
      total_photos: totalPhotos,
      by_plant: basePlantRows.map((plant) => ({
        ...plant,
        photos: inventoryByPlant[plant.plant_id]?.photos || 0,
      })),
    },
  };
}

export async function listInventoryMonthsForControl(input: CleanupFiltersInput & { status?: string; page?: number; page_size?: number }) {
  const filters = normalizeCleanupFilters({
    ...input,
    statuses: input.status ? [input.status] : input.statuses,
  });
  validateCleanupFilters(filters);

  const page = Math.max(1, Number(input.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(input.page_size || 25)));
  const { items, total } = await queryInventoryMonths(filters, { page, pageSize, countExact: true });
  const childRowsByTable = await fetchChildRowsForInventoryMonths(items.map((item) => item.id));
  const { countsByInventoryMonth } = aggregateChildCounts(items, childRowsByTable);

  return {
    items: items.map((item) => ({
      ...item,
      photo_count: countsByInventoryMonth[item.id]?.photo_count || 0,
      child_counts: countsByInventoryMonth[item.id]?.child_counts || createEmptyChildCounts(),
    })),
    pagination: {
      page,
      page_size: pageSize,
      total: total || 0,
    },
  };
}

export async function previewTransactionalCleanup(input: CleanupFiltersInput) {
  const filters = normalizeCleanupFilters(input);
  validateCleanupFilters(filters);

  const { items } = await queryInventoryMonths(filters);
  const distinctMonths = new Set(items.map((item) => item.year_month));

  if (items.length > MAX_CLEANUP_INVENTORY_MONTHS) {
    throw new Error(`La seleccion supera el limite de ${MAX_CLEANUP_INVENTORY_MONTHS} inventarios. Reduce el filtro e intenta de nuevo.`);
  }

  if (distinctMonths.size > MAX_CLEANUP_DISTINCT_MONTHS) {
    throw new Error(`La seleccion supera el limite de ${MAX_CLEANUP_DISTINCT_MONTHS} meses distintos. Reduce el rango e intenta de nuevo.`);
  }

  const childRowsByTable = await fetchChildRowsForInventoryMonths(items.map((item) => item.id));
  const { countsByTable, totalPhotos } = aggregateChildCounts(items, childRowsByTable);
  const summary = summarizePreview(items, countsByTable, totalPhotos);

  return {
    scope: filters.scope,
    filters,
    ...summary,
  };
}

export async function createCleanupPreviewToken(previewPayload: CleanupFiltersInput) {
  const payload = normalizeCleanupFilters(previewPayload);
  validateCleanupFilters(payload);

  const token = crypto.randomUUID();
  const record: CleanupPreviewRecord = {
    token,
    payload,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CLEANUP_PREVIEW_TTL_MS).toISOString(),
  };

  await kv.set(buildCleanupPreviewKey(token), record);
  return record;
}

export async function validateCleanupPreviewToken(token: string, payload: CleanupFiltersInput) {
  if (!token) {
    return { valid: false, error: 'Preview token requerido.' };
  }

  const stored = await kv.get(buildCleanupPreviewKey(token)) as CleanupPreviewRecord | null;
  if (!stored) {
    return { valid: false, error: 'Preview token no encontrado o expirado.' };
  }

  if (new Date(stored.expires_at).getTime() < Date.now()) {
    await kv.del(buildCleanupPreviewKey(token));
    return { valid: false, error: 'Preview token expirado.' };
  }

  const normalizedPayload = normalizeCleanupFilters(payload);
  validateCleanupFilters(normalizedPayload);

  if (stableStringify(stored.payload) !== stableStringify(normalizedPayload)) {
    return { valid: false, error: 'El payload no coincide con la previsualizacion aprobada.' };
  }

  return {
    valid: true,
    payload: stored.payload,
    expires_at: stored.expires_at,
  };
}

export async function consumeCleanupPreviewToken(token: string) {
  await kv.del(buildCleanupPreviewKey(token));
}

export async function previewPlantConfigurationCleanup(input: ConfigCleanupInput) {
  const filters = normalizeConfigCleanupFilters(input);
  validateConfigCleanupFilters(filters);

  const plant = await getPlantForConfigCleanup(filters.plant_id);
  const countsByTable: Record<string, number> = {};
  const countsByModule = createEmptyConfigModuleCounts();

  if (filters.modules.includes('aggregates')) {
    countsByTable.plant_aggregates_config = await countRowsByPlant('plant_aggregates_config', filters.plant_id);
    countsByTable.plant_cajones_config = await countRowsByPlant('plant_cajones_config', filters.plant_id);
    countsByModule.aggregates = sumModuleCounts(countsByTable, ['plant_aggregates_config', 'plant_cajones_config']);
  }

  if (filters.modules.includes('silos')) {
    const siloIds = await getSiloConfigIdsForPlant(filters.plant_id);
    countsByTable.plant_silos_config = siloIds.length;

    if (filters.include_related_rows && siloIds.length > 0) {
      const supabase = getSupabaseClient();
      const { count, error } = await supabase
        .from('silo_allowed_products')
        .select('id', { count: 'exact', head: true })
        .in('silo_config_id', siloIds);

      if (error) throw error;
      countsByTable.silo_allowed_products = count || 0;
    } else {
      countsByTable.silo_allowed_products = 0;
    }

    countsByModule.silos = sumModuleCounts(countsByTable, ['plant_silos_config', 'silo_allowed_products']);
  }

  if (filters.modules.includes('additives')) {
    countsByTable.plant_additives_config = await countRowsByPlant('plant_additives_config', filters.plant_id);
    countsByModule.additives = countsByTable.plant_additives_config;
  }

  if (filters.modules.includes('diesel')) {
    countsByTable.plant_diesel_config = await countRowsByPlant('plant_diesel_config', filters.plant_id);
    countsByModule.diesel = countsByTable.plant_diesel_config;
  }

  if (filters.modules.includes('products')) {
    countsByTable.plant_products_config = await countRowsByPlant('plant_products_config', filters.plant_id);
    countsByModule.products = countsByTable.plant_products_config;
  }

  if (filters.modules.includes('utilities')) {
    countsByTable.plant_utilities_meters_config = await countRowsByPlant('plant_utilities_meters_config', filters.plant_id);
    countsByModule.utilities = countsByTable.plant_utilities_meters_config;
  }

  if (filters.modules.includes('petty_cash')) {
    countsByTable.plant_petty_cash_config = await countRowsByPlant('plant_petty_cash_config', filters.plant_id);
    countsByModule.petty_cash = countsByTable.plant_petty_cash_config;
  }

  const inventoryMonthsCount = await getInventoryMonthCountForPlant(filters.plant_id);
  const warnings: string[] = [];

  if (inventoryMonthsCount > 0) {
    warnings.push(`La planta tiene ${inventoryMonthsCount} inventarios historicos. Reiniciar configuracion no los elimina.`);
  }

  if (Object.values(countsByTable).reduce((sum, count) => sum + count, 0) === 0) {
    warnings.push('No se encontraron registros de configuracion para los modulos seleccionados.');
  }

  return {
    plant: {
      id: plant.id,
      name: plant.name,
      is_active: plant.is_active !== false,
    },
    modules: filters.modules,
    include_related_rows: filters.include_related_rows,
    counts_by_module: countsByModule,
    counts_by_table: countsByTable,
    inventory_months_count: inventoryMonthsCount,
    warnings,
  };
}

export async function createConfigCleanupPreviewToken(previewPayload: ConfigCleanupInput) {
  const payload = normalizeConfigCleanupFilters(previewPayload);
  validateConfigCleanupFilters(payload);

  const token = crypto.randomUUID();
  const record: ConfigCleanupPreviewRecord = {
    token,
    payload,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CLEANUP_PREVIEW_TTL_MS).toISOString(),
  };

  await kv.set(buildConfigCleanupPreviewKey(token), record);
  return record;
}

export async function validateConfigCleanupPreviewToken(token: string, payload: ConfigCleanupInput) {
  if (!token) {
    return { valid: false, error: 'Preview token requerido.' };
  }

  const stored = await kv.get(buildConfigCleanupPreviewKey(token)) as ConfigCleanupPreviewRecord | null;
  if (!stored) {
    return { valid: false, error: 'Preview token no encontrado o expirado.' };
  }

  if (new Date(stored.expires_at).getTime() < Date.now()) {
    await kv.del(buildConfigCleanupPreviewKey(token));
    return { valid: false, error: 'Preview token expirado.' };
  }

  const normalizedPayload = normalizeConfigCleanupFilters(payload);
  validateConfigCleanupFilters(normalizedPayload);

  if (stableStringify(stored.payload) !== stableStringify(normalizedPayload)) {
    return { valid: false, error: 'El payload no coincide con la previsualizacion aprobada.' };
  }

  return {
    valid: true,
    payload: stored.payload,
    expires_at: stored.expires_at,
  };
}

export async function consumeConfigCleanupPreviewToken(token: string) {
  await kv.del(buildConfigCleanupPreviewKey(token));
}

export async function executePlantConfigurationCleanup(input: ConfigCleanupInput) {
  const filters = normalizeConfigCleanupFilters(input);
  validateConfigCleanupFilters(filters);

  const preview = await previewPlantConfigurationCleanup(filters);
  const supabase = getSupabaseClient();
  const deletedRowsByTable = Object.keys(preview.counts_by_table).reduce((acc: Record<string, number>, table) => {
    acc[table] = 0;
    return acc;
  }, {});
  const deletedRowsByModule = createEmptyConfigModuleCounts();

  if (filters.modules.includes('silos')) {
    const siloIds = await getSiloConfigIdsForPlant(filters.plant_id);

    if (filters.include_related_rows && siloIds.length > 0) {
      const { error: allowedProductsError } = await supabase
        .from('silo_allowed_products')
        .delete()
        .in('silo_config_id', siloIds);

      if (allowedProductsError) throw allowedProductsError;
      deletedRowsByTable.silo_allowed_products = preview.counts_by_table.silo_allowed_products || 0;
    }

    const { error: silosError } = await supabase
      .from('plant_silos_config')
      .delete()
      .eq('plant_id', filters.plant_id);

    if (silosError) throw silosError;
    deletedRowsByTable.plant_silos_config = preview.counts_by_table.plant_silos_config || 0;
    deletedRowsByModule.silos = sumModuleCounts(deletedRowsByTable, ['plant_silos_config', 'silo_allowed_products']);
  }

  if (filters.modules.includes('aggregates')) {
    const { error: aggregatesError } = await supabase
      .from('plant_aggregates_config')
      .delete()
      .eq('plant_id', filters.plant_id);
    if (aggregatesError) throw aggregatesError;

    const { error: cajonesError } = await supabase
      .from('plant_cajones_config')
      .delete()
      .eq('plant_id', filters.plant_id);
    if (cajonesError) throw cajonesError;

    deletedRowsByTable.plant_aggregates_config = preview.counts_by_table.plant_aggregates_config || 0;
    deletedRowsByTable.plant_cajones_config = preview.counts_by_table.plant_cajones_config || 0;
    deletedRowsByModule.aggregates = sumModuleCounts(deletedRowsByTable, ['plant_aggregates_config', 'plant_cajones_config']);
  }

  if (filters.modules.includes('additives')) {
    const { error } = await supabase
      .from('plant_additives_config')
      .delete()
      .eq('plant_id', filters.plant_id);
    if (error) throw error;
    deletedRowsByTable.plant_additives_config = preview.counts_by_table.plant_additives_config || 0;
    deletedRowsByModule.additives = deletedRowsByTable.plant_additives_config;
  }

  if (filters.modules.includes('diesel')) {
    const { error } = await supabase
      .from('plant_diesel_config')
      .delete()
      .eq('plant_id', filters.plant_id);
    if (error) throw error;
    deletedRowsByTable.plant_diesel_config = preview.counts_by_table.plant_diesel_config || 0;
    deletedRowsByModule.diesel = deletedRowsByTable.plant_diesel_config;
  }

  if (filters.modules.includes('products')) {
    const { error } = await supabase
      .from('plant_products_config')
      .delete()
      .eq('plant_id', filters.plant_id);
    if (error) throw error;
    deletedRowsByTable.plant_products_config = preview.counts_by_table.plant_products_config || 0;
    deletedRowsByModule.products = deletedRowsByTable.plant_products_config;
  }

  if (filters.modules.includes('utilities')) {
    const { error } = await supabase
      .from('plant_utilities_meters_config')
      .delete()
      .eq('plant_id', filters.plant_id);
    if (error) throw error;
    deletedRowsByTable.plant_utilities_meters_config = preview.counts_by_table.plant_utilities_meters_config || 0;
    deletedRowsByModule.utilities = deletedRowsByTable.plant_utilities_meters_config;
  }

  if (filters.modules.includes('petty_cash')) {
    const { error } = await supabase
      .from('plant_petty_cash_config')
      .delete()
      .eq('plant_id', filters.plant_id);
    if (error) throw error;
    deletedRowsByTable.plant_petty_cash_config = preview.counts_by_table.plant_petty_cash_config || 0;
    deletedRowsByModule.petty_cash = deletedRowsByTable.plant_petty_cash_config;
  }

  return {
    plant: preview.plant,
    modules: filters.modules,
    deleted_rows_by_table: deletedRowsByTable,
    deleted_rows_by_module: deletedRowsByModule,
    inventory_months_count: preview.inventory_months_count,
    warnings: preview.warnings,
  };
}

export async function previewProductsImport(plantId: string, input: ProductsImportInput) {
  const payload = normalizeProductsImportPayload(input);
  validateProductsImportPayload(payload);

  const plant = await getPlantForConfigCleanup(plantId);
  const supabase = getSupabaseClient();
  const { data: existingRows, error } = await supabase
    .from('plant_products_config')
    .select('id, product_name, sort_order')
    .eq('plant_id', plantId);

  if (error) throw error;

  const existingByName = (existingRows || []).reduce((acc: Record<string, { id: string; sort_order?: number }>, row: any) => {
    acc[String(row.product_name || '').trim().toLowerCase()] = {
      id: row.id,
      sort_order: row.sort_order,
    };
    return acc;
  }, {});

  const seenNames = new Map<string, number>();
  const normalizedRows: NormalizedProductsImportRow[] = [];
  const errors: Array<{ row: number; column: string; message: string }> = [];
  const warnings: string[] = [];

  payload.rows.forEach((rawRow, index) => {
    const rowNumber = rawRow.row_number || index + 2;
    const rowErrors: Array<{ column: string; message: string }> = [];
    const productName = rawRow.product_name.trim();
    const category = rawRow.category.trim().toUpperCase();
    const measureMode = rawRow.measure_mode.trim().toUpperCase();
    const uom = rawRow.uom.trim();
    const readingUom = rawRow.reading_uom.trim();
    const notes = rawRow.notes.trim();

    if (!productName) rowErrors.push({ column: 'Nombre', message: 'es requerido' });
    if (!category) rowErrors.push({ column: 'Categoria', message: 'es requerida' });
    if (category && !PRODUCTS_IMPORT_ALLOWED_CATEGORIES.includes(category as any)) {
      rowErrors.push({ column: 'Categoria', message: `valor invalido. Usa ${PRODUCTS_IMPORT_ALLOWED_CATEGORIES.join(', ')}` });
    }
    if (!measureMode) rowErrors.push({ column: 'Metodo', message: 'es requerido' });
    if (measureMode && !PRODUCTS_IMPORT_ALLOWED_MEASURE_MODES.includes(measureMode as any)) {
      rowErrors.push({ column: 'Metodo', message: `valor invalido. Usa ${PRODUCTS_IMPORT_ALLOWED_MEASURE_MODES.join(', ')}` });
    }
    if (!uom) rowErrors.push({ column: 'Unidad', message: 'es requerida' });

    let requiresPhoto = false;
    let isActive = true;
    let tankCapacity: number | null = null;
    let unitVolume: number | null = null;
    let calibrationTable: Record<string, number> | null = null;

    try {
      requiresPhoto = normalizeBooleanString(rawRow.requires_photo, false);
    } catch (error: any) {
      rowErrors.push({ column: 'Requiere foto', message: error.message });
    }

    try {
      isActive = normalizeBooleanString(rawRow.is_active, true);
    } catch (error: any) {
      rowErrors.push({ column: 'Activo', message: error.message });
    }

    try {
      tankCapacity = parseNullableNumberString(rawRow.tank_capacity);
    } catch (error: any) {
      rowErrors.push({ column: 'Capacidad tanque', message: error.message });
    }

    try {
      unitVolume = parseNullableNumberString(rawRow.unit_volume);
    } catch (error: any) {
      rowErrors.push({ column: 'Volumen por unidad', message: error.message });
    }

    if (measureMode === 'TANK_READING') {
      if (!readingUom) rowErrors.push({ column: 'Unidad lectura', message: 'es requerida para TANK_READING' });
      try {
        calibrationTable = parseCalibrationTableJson(rawRow.calibration_table_json);
      } catch (error: any) {
        rowErrors.push({ column: 'Tabla calibracion JSON', message: error.message });
      }
    } else if (rawRow.calibration_table_json.trim()) {
      warnings.push(`Fila ${rowNumber}: se ignorara Tabla calibracion JSON porque el metodo no es TANK_READING.`);
    }

    if (measureMode === 'DRUM' || measureMode === 'PAIL') {
      if (unitVolume === null) {
        rowErrors.push({ column: 'Volumen por unidad', message: `es requerido para ${measureMode}` });
      }
    } else if (rawRow.unit_volume.trim()) {
      warnings.push(`Fila ${rowNumber}: se ignorara Volumen por unidad porque el metodo no es DRUM ni PAIL.`);
    }

    if (productName) {
      const key = productName.toLowerCase();
      if (seenNames.has(key)) {
        rowErrors.push({ column: 'Nombre', message: `duplicado dentro del archivo; tambien aparece en la fila ${seenNames.get(key)}` });
      } else {
        seenNames.set(key, rowNumber);
      }
    }

    if (rowErrors.length > 0) {
      rowErrors.forEach((rowError) => {
        errors.push({
          row: rowNumber,
          column: rowError.column,
          message: rowError.message,
        });
      });
      return;
    }

    const existing = existingByName[productName.toLowerCase()];
    normalizedRows.push({
      row_number: rowNumber,
      product_name: productName,
      category: category as NormalizedProductsImportRow['category'],
      measure_mode: measureMode as NormalizedProductsImportRow['measure_mode'],
      uom,
      requires_photo: requiresPhoto,
      reading_uom: measureMode === 'TANK_READING' ? readingUom || null : null,
      tank_capacity: measureMode === 'TANK_READING' ? tankCapacity : null,
      unit_volume: measureMode === 'DRUM' || measureMode === 'PAIL' ? unitVolume : null,
      calibration_table: measureMode === 'TANK_READING' ? calibrationTable : null,
      notes,
      is_active: isActive,
      action: existing ? 'update' : 'create',
      existing_id: existing?.id,
    });
  });

  return {
    plant: {
      id: plant.id,
      name: plant.name,
    },
    module: 'products' as const,
    template_version: payload.template_version,
    import_mode: 'upsert' as const,
    summary: {
      total_rows: payload.rows.length,
      valid_rows: normalizedRows.length,
      error_rows: Array.from(new Set(errors.map((item) => item.row))).length,
      creates: normalizedRows.filter((row) => row.action === 'create').length,
      updates: normalizedRows.filter((row) => row.action === 'update').length,
    },
    errors,
    warnings: Array.from(new Set(warnings)),
    normalized_rows: normalizedRows,
  };
}

export async function createProductsImportPreviewToken(plantId: string, previewPayload: ProductsImportInput) {
  const payload = normalizeProductsImportPayload(previewPayload);
  validateProductsImportPayload(payload);

  const token = crypto.randomUUID();
  const record: ProductsImportPreviewRecord = {
    token,
    plant_id: plantId,
    payload,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CLEANUP_PREVIEW_TTL_MS).toISOString(),
  };

  await kv.set(buildProductsImportPreviewKey(token), record);
  return record;
}

export async function validateProductsImportPreviewToken(plantId: string, token: string, payload: ProductsImportInput) {
  if (!token) {
    return { valid: false, error: 'Preview token requerido.' };
  }

  const stored = await kv.get(buildProductsImportPreviewKey(token)) as ProductsImportPreviewRecord | null;
  if (!stored) {
    return { valid: false, error: 'Preview token no encontrado o expirado.' };
  }

  if (stored.plant_id !== plantId) {
    return { valid: false, error: 'La previsualizacion no corresponde a esta planta.' };
  }

  if (new Date(stored.expires_at).getTime() < Date.now()) {
    await kv.del(buildProductsImportPreviewKey(token));
    return { valid: false, error: 'Preview token expirado.' };
  }

  const normalizedPayload = normalizeProductsImportPayload(payload);
  validateProductsImportPayload(normalizedPayload);

  if (stableStringify(stored.payload) !== stableStringify(normalizedPayload)) {
    return { valid: false, error: 'El payload no coincide con la previsualizacion aprobada.' };
  }

  return {
    valid: true,
    payload: stored.payload,
    expires_at: stored.expires_at,
  };
}

export async function consumeProductsImportPreviewToken(token: string) {
  await kv.del(buildProductsImportPreviewKey(token));
}

export async function executeProductsImport(plantId: string, input: ProductsImportInput) {
  const preview = await previewProductsImport(plantId, input);
  if (preview.summary.valid_rows === 0) {
    throw new Error('No hay filas validas para importar.');
  }

  const supabase = getSupabaseClient();
  const { data: existingRows, error } = await supabase
    .from('plant_products_config')
    .select('id, product_name, sort_order')
    .eq('plant_id', plantId);

  if (error) throw error;

  const existingById = (existingRows || []).reduce((acc: Record<string, { sort_order?: number }>, row: any) => {
    acc[row.id] = { sort_order: row.sort_order };
    return acc;
  }, {});

  const maxSortOrder = Math.max(-1, ...(existingRows || []).map((row: any) => Number(row.sort_order ?? -1)));
  let nextSortOrder = maxSortOrder + 1;

  let created = 0;
  let updated = 0;

  for (const row of preview.normalized_rows) {
    const payload = {
      plant_id: plantId,
      product_name: row.product_name,
      unit: row.uom,
      category: row.category,
      measure_mode: row.measure_mode,
      requires_photo: row.requires_photo,
      reading_uom: row.reading_uom,
      calibration_table: row.calibration_table,
      tank_capacity: row.tank_capacity,
      unit_volume: row.unit_volume,
      notes: row.notes,
      is_active: row.is_active,
      sort_order: row.existing_id ? (existingById[row.existing_id]?.sort_order ?? nextSortOrder++) : nextSortOrder++,
    };

    if (row.action === 'update' && row.existing_id) {
      const { error: updateError } = await supabase
        .from('plant_products_config')
        .update(payload)
        .eq('id', row.existing_id);

      if (updateError) throw updateError;
      updated += 1;
    } else {
      const { error: insertError } = await supabase
        .from('plant_products_config')
        .insert(payload);

      if (insertError) throw insertError;
      created += 1;
    }
  }

  return {
    ...preview,
    result: {
      created,
      updated,
    },
  };
}

export async function previewAggregatesImport(plantId: string, input: AggregatesImportInput) {
  const payload = normalizeAggregatesImportPayload(input);
  validateAggregatesImportPayload(payload);

  const plant = await getPlantForConfigCleanup(plantId);
  const supabase = getSupabaseClient();
  const [
    { data: aggregateRows, error: aggregateError },
    { count: legacyCount, error: legacyError },
    materialCatalogRows,
    procedenciaCatalogRows,
  ] = await Promise.all([
    supabase
      .from('plant_aggregates_config')
      .select('id, aggregate_name, sort_order')
      .eq('plant_id', plantId),
    supabase
      .from('plant_cajones_config')
      .select('id', { count: 'exact', head: true })
      .eq('plant_id', plantId),
    listMaterialCatalogItems(),
    listProcedenciaCatalogItems(),
  ]);

  if (aggregateError) throw aggregateError;
  if (legacyError) throw legacyError;

  const materialCatalogByName = buildCatalogNameMap(materialCatalogRows);
  const procedenciaCatalogByName = buildCatalogNameMap(procedenciaCatalogRows);
  const existingByName = (aggregateRows || []).reduce((acc: Record<string, { id: string; sort_order?: number }>, row: any) => {
    acc[String(row.aggregate_name || '').trim().toLowerCase()] = {
      id: row.id,
      sort_order: row.sort_order,
    };
    return acc;
  }, {});

  const seenNames = new Map<string, number>();
  const normalizedRows: NormalizedAggregatesImportRow[] = [];
  const errors: Array<{ row: number; column: string; message: string }> = [];
  const warnings: string[] = [];

  payload.rows.forEach((rawRow, index) => {
    const rowNumber = rawRow.row_number || index + 2;
    const rowErrors: Array<{ column: string; message: string }> = [];
    const aggregateName = rawRow.aggregate_name.trim();
    const materialType = rawRow.material_type.trim();
    const locationArea = rawRow.location_area.trim();
    const measurementMethod = rawRow.measurement_method.trim().toUpperCase();
    const unit = rawRow.unit.trim() || 'CUBIC_YARDS';
    const matchedMaterial = materialCatalogByName[normalizeCatalogNameKey(materialType)] || null;
    const matchedProcedencia = procedenciaCatalogByName[normalizeCatalogNameKey(locationArea)] || null;

    if (!aggregateName) rowErrors.push({ column: 'Nombre del agregado', message: 'es requerido' });
    if (!materialType) rowErrors.push({ column: 'Material', message: 'es requerido' });
    if (!locationArea) rowErrors.push({ column: 'Procedencia', message: 'es requerida' });
    if (materialType && !matchedMaterial) {
      rowErrors.push({ column: 'Material', message: 'no existe en el catálogo de materiales' });
    }
    if (locationArea && !matchedProcedencia) {
      rowErrors.push({ column: 'Procedencia', message: 'no existe en el catálogo de procedencias' });
    }
    if (!measurementMethod) rowErrors.push({ column: 'Metodo de medicion', message: 'es requerido' });
    if (measurementMethod && !AGGREGATES_IMPORT_ALLOWED_MEASUREMENT_METHODS.includes(measurementMethod as any)) {
      rowErrors.push({ column: 'Metodo de medicion', message: `valor invalido. Usa ${AGGREGATES_IMPORT_ALLOWED_MEASUREMENT_METHODS.join(', ')}` });
    }

    let isActive = true;
    let boxWidthFt: number | null = null;
    let boxHeightFt: number | null = null;

    try {
      isActive = normalizeBooleanString(rawRow.is_active, true);
    } catch (error: any) {
      rowErrors.push({ column: 'Activo', message: error.message });
    }

    try {
      boxWidthFt = parseNullableNumberString(rawRow.box_width_ft);
    } catch (error: any) {
      rowErrors.push({ column: 'Ancho (ft)', message: error.message });
    }

    try {
      boxHeightFt = parseNullableNumberString(rawRow.box_height_ft);
    } catch (error: any) {
      rowErrors.push({ column: 'Alto (ft)', message: error.message });
    }

    if (measurementMethod === 'BOX') {
      if (boxWidthFt === null) rowErrors.push({ column: 'Ancho (ft)', message: 'es requerido para BOX' });
      if (boxHeightFt === null) rowErrors.push({ column: 'Alto (ft)', message: 'es requerido para BOX' });
      if (boxWidthFt !== null && boxWidthFt <= 0) {
        rowErrors.push({ column: 'Ancho (ft)', message: 'debe ser mayor que cero para BOX' });
      }
      if (boxHeightFt !== null && boxHeightFt <= 0) {
        rowErrors.push({ column: 'Alto (ft)', message: 'debe ser mayor que cero para BOX' });
      }
    } else {
      if (rawRow.box_width_ft.trim()) {
        warnings.push(`Fila ${rowNumber}: se ignorara Ancho (ft) porque el metodo es CONE.`);
      }
      if (rawRow.box_height_ft.trim()) {
        warnings.push(`Fila ${rowNumber}: se ignorara Alto (ft) porque el metodo es CONE.`);
      }
    }

    if (aggregateName) {
      const key = aggregateName.toLowerCase();
      if (seenNames.has(key)) {
        rowErrors.push({ column: 'Nombre del agregado', message: `duplicado dentro del archivo; tambien aparece en la fila ${seenNames.get(key)}` });
      } else {
        seenNames.set(key, rowNumber);
      }
    }

    if (rowErrors.length > 0) {
      rowErrors.forEach((rowError) => {
        errors.push({
          row: rowNumber,
          column: rowError.column,
          message: rowError.message,
        });
      });
      return;
    }

    const existing = existingByName[aggregateName.toLowerCase()];
    normalizedRows.push({
      row_number: rowNumber,
      aggregate_name: aggregateName,
      material_type: matchedMaterial?.nombre || materialType,
      location_area: matchedProcedencia?.nombre || locationArea,
      measurement_method: measurementMethod as NormalizedAggregatesImportRow['measurement_method'],
      unit,
      box_width_ft: measurementMethod === 'BOX' ? boxWidthFt : null,
      box_height_ft: measurementMethod === 'BOX' ? boxHeightFt : null,
      is_active: isActive,
      action: existing ? 'update' : 'create',
      existing_id: existing?.id,
    });
  });

  if ((legacyCount || 0) > 0) {
    warnings.push(`La planta tiene ${(legacyCount || 0)} cajones legacy. Se limpiaran al ejecutar esta importacion para dejar solo la configuracion nueva.`);
  }

  return {
    plant: {
      id: plant.id,
      name: plant.name,
    },
    module: 'aggregates' as const,
    template_version: payload.template_version,
    import_mode: 'upsert' as const,
    summary: {
      total_rows: payload.rows.length,
      valid_rows: normalizedRows.length,
      error_rows: Array.from(new Set(errors.map((item) => item.row))).length,
      creates: normalizedRows.filter((row) => row.action === 'create').length,
      updates: normalizedRows.filter((row) => row.action === 'update').length,
      legacy_cajones: legacyCount || 0,
    },
    errors,
    warnings: Array.from(new Set(warnings)),
    normalized_rows: normalizedRows,
  };
}

export async function createAggregatesImportPreviewToken(plantId: string, previewPayload: AggregatesImportInput) {
  const payload = normalizeAggregatesImportPayload(previewPayload);
  validateAggregatesImportPayload(payload);

  const token = crypto.randomUUID();
  const record: AggregatesImportPreviewRecord = {
    token,
    plant_id: plantId,
    payload,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CLEANUP_PREVIEW_TTL_MS).toISOString(),
  };

  await kv.set(buildAggregatesImportPreviewKey(token), record);
  return record;
}

export async function validateAggregatesImportPreviewToken(plantId: string, token: string, payload: AggregatesImportInput) {
  if (!token) {
    return { valid: false, error: 'Preview token requerido.' };
  }

  const stored = await kv.get(buildAggregatesImportPreviewKey(token)) as AggregatesImportPreviewRecord | null;
  if (!stored) {
    return { valid: false, error: 'Preview token no encontrado o expirado.' };
  }

  if (stored.plant_id !== plantId) {
    return { valid: false, error: 'La previsualizacion no corresponde a esta planta.' };
  }

  if (new Date(stored.expires_at).getTime() < Date.now()) {
    await kv.del(buildAggregatesImportPreviewKey(token));
    return { valid: false, error: 'Preview token expirado.' };
  }

  const normalizedPayload = normalizeAggregatesImportPayload(payload);
  validateAggregatesImportPayload(normalizedPayload);

  if (stableStringify(stored.payload) !== stableStringify(normalizedPayload)) {
    return { valid: false, error: 'El payload no coincide con la previsualizacion aprobada.' };
  }

  return {
    valid: true,
    payload: stored.payload,
    expires_at: stored.expires_at,
  };
}

export async function consumeAggregatesImportPreviewToken(token: string) {
  await kv.del(buildAggregatesImportPreviewKey(token));
}

export async function executeAggregatesImport(plantId: string, input: AggregatesImportInput) {
  const preview = await previewAggregatesImport(plantId, input);
  if (preview.summary.valid_rows === 0) {
    throw new Error('No hay filas validas para importar.');
  }

  const supabase = getSupabaseClient();
  const { data: existingRows, error } = await supabase
    .from('plant_aggregates_config')
    .select('id, aggregate_name, sort_order')
    .eq('plant_id', plantId);

  if (error) throw error;

  const existingById = (existingRows || []).reduce((acc: Record<string, { sort_order?: number }>, row: any) => {
    acc[row.id] = { sort_order: row.sort_order };
    return acc;
  }, {});

  const maxSortOrder = Math.max(-1, ...(existingRows || []).map((row: any) => Number(row.sort_order ?? -1)));
  let nextSortOrder = maxSortOrder + 1;
  let created = 0;
  let updated = 0;

  for (const row of preview.normalized_rows) {
    const payload = {
      plant_id: plantId,
      aggregate_name: row.aggregate_name,
      material_type: row.material_type,
      location_area: row.location_area,
      measurement_method: row.measurement_method,
      unit: row.unit || 'CUBIC_YARDS',
      box_width_ft: row.measurement_method === 'BOX' ? row.box_width_ft : null,
      box_height_ft: row.measurement_method === 'BOX' ? row.box_height_ft : null,
      is_active: row.is_active,
      sort_order: row.existing_id ? (existingById[row.existing_id]?.sort_order ?? nextSortOrder++) : nextSortOrder++,
    };

    if (row.action === 'update' && row.existing_id) {
      const { error: updateError } = await supabase
        .from('plant_aggregates_config')
        .update(payload)
        .eq('id', row.existing_id);

      if (updateError) throw updateError;
      updated += 1;
    } else {
      const { error: insertError } = await supabase
        .from('plant_aggregates_config')
        .insert(payload);

      if (insertError) throw insertError;
      created += 1;
    }
  }

  const { error: legacyDeleteError } = await supabase
    .from('plant_cajones_config')
    .delete()
    .eq('plant_id', plantId);
  if (legacyDeleteError) throw legacyDeleteError;

  return {
    ...preview,
    result: {
      created,
      updated,
      legacy_cajones_cleared: preview.summary.legacy_cajones,
    },
  };
}

export async function previewSilosImport(plantId: string, input: SilosImportInput) {
  const payload = normalizeSilosImportPayload(input);
  validateSilosImportPayload(payload);

  const plant = await getPlantForConfigCleanup(plantId);
  const supabase = getSupabaseClient();
  const [{ data: siloRows, error: siloError }, { data: productRows, error: productError }, defaultCurveInfo] = await Promise.all([
    supabase
      .from('plant_silos_config')
      .select('id, silo_name, sort_order')
      .eq('plant_id', plantId),
    supabase
      .from('plant_products_config')
      .select('product_name')
      .eq('plant_id', plantId)
      .neq('is_active', false),
    resolveDefaultSiloCalibrationCurve(plantId),
  ]);

  if (siloError) throw siloError;
  if (productError) throw productError;

  const existingByName = (siloRows || []).reduce((acc: Record<string, { id: string; sort_order?: number }>, row: any) => {
    acc[String(row.silo_name || '').trim().toLowerCase()] = {
      id: row.id,
      sort_order: row.sort_order,
    };
    return acc;
  }, {});

  const availableProducts = new Set(
    (productRows || [])
      .map((row: any) => String(row.product_name || '').trim())
      .filter(Boolean)
  );

  const seenNames = new Map<string, number>();
  const normalizedRows: NormalizedSilosImportRow[] = [];
  const errors: Array<{ row: number; column: string; message: string }> = [];
  const warnings: string[] = [];

  payload.rows.forEach((rawRow, index) => {
    const rowNumber = rawRow.row_number || index + 2;
    const rowErrors: Array<{ column: string; message: string }> = [];
    const siloName = rawRow.silo_name.trim();
    const measurementMethod = rawRow.measurement_method.trim().toUpperCase() || 'FEET_TO_CUBIC_YARDS';
    const allowedProducts = parsePipeSeparatedValues(rawRow.allowed_products);

    if (!siloName) rowErrors.push({ column: 'Nombre del silo', message: 'es requerido' });
    if (measurementMethod && !SILOS_IMPORT_ALLOWED_MEASUREMENT_METHODS.includes(measurementMethod as any)) {
      rowErrors.push({ column: 'Metodo de medicion', message: `valor invalido. Usa ${SILOS_IMPORT_ALLOWED_MEASUREMENT_METHODS.join(', ')}` });
    }

    let isActive = true;
    try {
      isActive = normalizeBooleanString(rawRow.is_active, true);
    } catch (error: any) {
      rowErrors.push({ column: 'Activo', message: error.message });
    }

    if (siloName) {
      const key = siloName.toLowerCase();
      if (seenNames.has(key)) {
        rowErrors.push({ column: 'Nombre del silo', message: `duplicado dentro del archivo; tambien aparece en la fila ${seenNames.get(key)}` });
      } else {
        seenNames.set(key, rowNumber);
      }
    }

    if (allowedProducts.length > 0 && availableProducts.size === 0) {
      rowErrors.push({ column: 'Productos permitidos', message: 'la planta no tiene aceites y productos activos para asignar' });
    }

    allowedProducts.forEach((productName) => {
      if (!availableProducts.has(productName)) {
        rowErrors.push({
          column: 'Productos permitidos',
          message: `"${productName}" no existe como aceite/producto activo en esta planta`,
        });
      }
    });

    if (rowErrors.length > 0) {
      rowErrors.forEach((rowError) => {
        errors.push({
          row: rowNumber,
          column: rowError.column,
          message: rowError.message,
        });
      });
      return;
    }

    const existing = existingByName[siloName.toLowerCase()];
    normalizedRows.push({
      row_number: rowNumber,
      silo_name: siloName,
      measurement_method: 'FEET_TO_CUBIC_YARDS',
      allowed_products: allowedProducts,
      is_active: isActive,
      action: existing ? 'update' : 'create',
      existing_id: existing?.id,
    });
  });

  if (availableProducts.size === 0) {
    warnings.push('La planta no tiene aceites y productos activos. Solo podras importar silos sin productos permitidos.');
  }

  if (defaultCurveInfo.warning) {
    warnings.push(defaultCurveInfo.warning);
  }

  return {
    plant: {
      id: plant.id,
      name: plant.name,
    },
    module: 'silos' as const,
    template_version: payload.template_version,
    import_mode: 'upsert' as const,
    summary: {
      total_rows: payload.rows.length,
      valid_rows: normalizedRows.length,
      error_rows: Array.from(new Set(errors.map((item) => item.row))).length,
      creates: normalizedRows.filter((row) => row.action === 'create').length,
      updates: normalizedRows.filter((row) => row.action === 'update').length,
      linked_products: normalizedRows.reduce((sum, row) => sum + row.allowed_products.length, 0),
    },
    errors,
    warnings: Array.from(new Set(warnings)),
    normalized_rows: normalizedRows,
  };
}

export async function createSilosImportPreviewToken(plantId: string, previewPayload: SilosImportInput) {
  const payload = normalizeSilosImportPayload(previewPayload);
  validateSilosImportPayload(payload);

  const token = crypto.randomUUID();
  const record: SilosImportPreviewRecord = {
    token,
    plant_id: plantId,
    payload,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CLEANUP_PREVIEW_TTL_MS).toISOString(),
  };

  await kv.set(buildSilosImportPreviewKey(token), record);
  return record;
}

export async function validateSilosImportPreviewToken(plantId: string, token: string, payload: SilosImportInput) {
  if (!token) {
    return { valid: false, error: 'Preview token requerido.' };
  }

  const stored = await kv.get(buildSilosImportPreviewKey(token)) as SilosImportPreviewRecord | null;
  if (!stored) {
    return { valid: false, error: 'Preview token no encontrado o expirado.' };
  }

  if (stored.plant_id !== plantId) {
    return { valid: false, error: 'La previsualizacion no corresponde a esta planta.' };
  }

  if (new Date(stored.expires_at).getTime() < Date.now()) {
    await kv.del(buildSilosImportPreviewKey(token));
    return { valid: false, error: 'Preview token expirado.' };
  }

  const normalizedPayload = normalizeSilosImportPayload(payload);
  validateSilosImportPayload(normalizedPayload);

  if (stableStringify(stored.payload) !== stableStringify(normalizedPayload)) {
    return { valid: false, error: 'El payload no coincide con la previsualizacion aprobada.' };
  }

  return {
    valid: true,
    payload: stored.payload,
    expires_at: stored.expires_at,
  };
}

export async function consumeSilosImportPreviewToken(token: string) {
  await kv.del(buildSilosImportPreviewKey(token));
}

export async function executeSilosImport(plantId: string, input: SilosImportInput) {
  const preview = await previewSilosImport(plantId, input);
  if (preview.summary.valid_rows === 0) {
    throw new Error('No hay filas validas para importar.');
  }

  const supabase = getSupabaseClient();
  const { data: existingRows, error } = await supabase
    .from('plant_silos_config')
    .select('id, silo_name, sort_order')
    .eq('plant_id', plantId);

  if (error) throw error;

  const existingById = (existingRows || []).reduce((acc: Record<string, { sort_order?: number }>, row: any) => {
    acc[row.id] = { sort_order: row.sort_order };
    return acc;
  }, {});

  const defaultCurveInfo = await resolveDefaultSiloCalibrationCurve(plantId);
  const defaultCurve = defaultCurveInfo.curve_name;

  const maxSortOrder = Math.max(-1, ...(existingRows || []).map((row: any) => Number(row.sort_order ?? -1)));
  let nextSortOrder = maxSortOrder + 1;
  let created = 0;
  let updated = 0;
  const affectedSiloIds: string[] = [];
  const allowedProductsRows: Array<{ silo_config_id: string; product_name: string }> = [];

  for (const row of preview.normalized_rows) {
    const payload = {
      plant_id: plantId,
      silo_name: row.silo_name,
      measurement_method: row.measurement_method,
      calibration_curve_name: defaultCurve,
      is_active: row.is_active,
      sort_order: row.existing_id ? (existingById[row.existing_id]?.sort_order ?? nextSortOrder++) : nextSortOrder++,
    };

    let siloId = row.existing_id;

    if (row.action === 'update' && row.existing_id) {
      const { error: updateError } = await supabase
        .from('plant_silos_config')
        .update(payload)
        .eq('id', row.existing_id);

      if (updateError) throw updateError;
      updated += 1;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('plant_silos_config')
        .insert(payload)
        .select('id')
        .single();

      if (insertError) throw insertError;
      siloId = inserted?.id;
      created += 1;
    }

    if (!siloId) continue;
    affectedSiloIds.push(siloId);
    row.allowed_products.forEach((product_name) => {
      allowedProductsRows.push({ silo_config_id: siloId!, product_name });
    });
  }

  if (affectedSiloIds.length > 0) {
    const { error: deleteAllowedProductsError } = await supabase
      .from('silo_allowed_products')
      .delete()
      .in('silo_config_id', affectedSiloIds);
    if (deleteAllowedProductsError) throw deleteAllowedProductsError;
  }

  if (allowedProductsRows.length > 0) {
    const { error: insertAllowedProductsError } = await supabase
      .from('silo_allowed_products')
      .insert(allowedProductsRows);
    if (insertAllowedProductsError) throw insertAllowedProductsError;
  }

  const warnings = [...preview.warnings];
  if (defaultCurveInfo.warning) {
    warnings.push(defaultCurveInfo.warning);
  }

  return {
    ...preview,
    warnings: Array.from(new Set(warnings)),
    result: {
      created,
      updated,
      linked_products: allowedProductsRows.length,
    },
  };
}

export async function previewDieselImport(plantId: string, input: DieselImportInput) {
  const payload = normalizeDieselImportPayload(input);
  validateDieselImportPayload(payload);

  const plant = await getPlantForConfigCleanup(plantId);
  const supabase = getSupabaseClient();
  const [{ data: existingRow, error }, curveRows] = await Promise.all([
    supabase
      .from('plant_diesel_config')
      .select('id')
      .eq('plant_id', plantId)
      .maybeSingle(),
    listPlantCalibrationCurves(plantId),
  ]);

  if (error) throw error;
  const curvesByName = buildCalibrationCurveMap(curveRows);

  const errors: Array<{ row: number; column: string; message: string }> = [];
  const warnings: string[] = [];
  const normalizedRows: NormalizedDieselImportRow[] = [];

  if (payload.rows.length > 1) {
    payload.rows.slice(1).forEach((row, index) => {
      errors.push({
        row: row.row_number || index + 3,
        column: 'Fila',
        message: 'la plantilla de diesel solo admite una fila por planta',
      });
    });
  }

  const rawRow = payload.rows[0];
  if (rawRow) {
    const rowNumber = rawRow.row_number || 2;
    const rowErrors: Array<{ column: string; message: string }> = [];
    const measurementMethod = rawRow.measurement_method.trim().toUpperCase() || 'TANK_LEVEL';
    const readingUom = rawRow.reading_uom.trim();
    const calibrationCurveName = rawRow.calibration_curve_name.trim() || null;
    const matchedCurve = calibrationCurveName ? curvesByName[normalizeCurveNameKey(calibrationCurveName)] || null : null;

    if (measurementMethod && !DIESEL_IMPORT_ALLOWED_MEASUREMENT_METHODS.includes(measurementMethod as any)) {
      rowErrors.push({ column: 'Metodo', message: `valor invalido. Usa ${DIESEL_IMPORT_ALLOWED_MEASUREMENT_METHODS.join(', ')}` });
    }
    if (!calibrationCurveName) {
      rowErrors.push({ column: 'Nombre de curva', message: 'es requerido y debe existir en el catálogo de curvas de esta planta' });
    } else if (!matchedCurve) {
      rowErrors.push({ column: 'Nombre de curva', message: `"${calibrationCurveName}" no existe en el catálogo de curvas de esta planta` });
    }

    let tankCapacity: number | null = null;
    let initialInventory: number | null = null;
    let isActive = true;
    let calibrationTable: Record<string, number> | null = null;

    try {
      tankCapacity = parseNullableNumberString(rawRow.tank_capacity_gallons);
    } catch (previewError: any) {
      rowErrors.push({ column: 'Capacidad del tanque', message: previewError.message });
    }

    try {
      initialInventory = parseNullableNumberString(rawRow.initial_inventory_gallons);
    } catch (previewError: any) {
      rowErrors.push({ column: 'Inventario inicial', message: previewError.message });
    }

    try {
      isActive = normalizeBooleanString(rawRow.is_active, true);
    } catch (previewError: any) {
      rowErrors.push({ column: 'Activo', message: previewError.message });
    }

    try {
      calibrationTable = parseCalibrationTableJson(rawRow.calibration_table_json);
    } catch (previewError: any) {
      rowErrors.push({ column: 'Tabla calibracion JSON', message: previewError.message });
    }

    if (tankCapacity === null) {
      rowErrors.push({ column: 'Capacidad del tanque', message: 'es requerida' });
    } else if (tankCapacity <= 0) {
      rowErrors.push({ column: 'Capacidad del tanque', message: 'debe ser mayor que cero' });
    }

    if (initialInventory !== null && initialInventory < 0) {
      rowErrors.push({ column: 'Inventario inicial', message: 'no puede ser negativo' });
    }

    const curveReadingUom = normalizeCatalogOptionalText(matchedCurve?.reading_uom);
    if (matchedCurve && !curveReadingUom) {
      rowErrors.push({ column: 'Nombre de curva', message: `la curva "${matchedCurve.curve_name}" no tiene unidad de lectura configurada` });
    }

    if (matchedCurve && readingUom && normalizeCatalogOptionalText(readingUom) !== curveReadingUom) {
      warnings.push(`Fila ${rowNumber}: la unidad de lectura del archivo no coincide con la curva "${matchedCurve.curve_name}". Se usará "${curveReadingUom}".`);
    }

    if (matchedCurve && calibrationTable && !areCalibrationTablesEquivalent(calibrationTable, matchedCurve.data_points)) {
      warnings.push(`Fila ${rowNumber}: la tabla JSON del archivo no coincide con la curva "${matchedCurve.curve_name}". Se usará la tabla definida en el catálogo de curvas.`);
    }

    if (rowErrors.length > 0) {
      rowErrors.forEach((rowError) => {
        errors.push({
          row: rowNumber,
          column: rowError.column,
          message: rowError.message,
        });
      });
    } else {
      normalizedRows.push({
        row_number: rowNumber,
        measurement_method: 'TANK_LEVEL',
        calibration_curve_name: matchedCurve!.curve_name,
        reading_uom: curveReadingUom!,
        tank_capacity_gallons: tankCapacity!,
        initial_inventory_gallons: initialInventory,
        calibration_table: matchedCurve!.data_points,
        is_active: isActive,
        action: existingRow?.id ? 'update' : 'create',
        existing_id: existingRow?.id,
      });
    }
  }

  return {
    plant: {
      id: plant.id,
      name: plant.name,
    },
    module: 'diesel' as const,
    template_version: payload.template_version,
    import_mode: 'upsert' as const,
    summary: {
      total_rows: payload.rows.length,
      valid_rows: normalizedRows.length,
      error_rows: Array.from(new Set(errors.map((item) => item.row))).length,
      creates: normalizedRows.filter((row) => row.action === 'create').length,
      updates: normalizedRows.filter((row) => row.action === 'update').length,
    },
    errors,
    warnings: Array.from(new Set(warnings)),
    normalized_rows: normalizedRows,
  };
}

export async function createDieselImportPreviewToken(plantId: string, previewPayload: DieselImportInput) {
  const payload = normalizeDieselImportPayload(previewPayload);
  validateDieselImportPayload(payload);

  const token = crypto.randomUUID();
  const record: DieselImportPreviewRecord = {
    token,
    plant_id: plantId,
    payload,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CLEANUP_PREVIEW_TTL_MS).toISOString(),
  };

  await kv.set(buildDieselImportPreviewKey(token), record);
  return record;
}

export async function validateDieselImportPreviewToken(plantId: string, token: string, payload: DieselImportInput) {
  if (!token) {
    return { valid: false, error: 'Preview token requerido.' };
  }

  const stored = await kv.get(buildDieselImportPreviewKey(token)) as DieselImportPreviewRecord | null;
  if (!stored) {
    return { valid: false, error: 'Preview token no encontrado o expirado.' };
  }

  if (stored.plant_id !== plantId) {
    return { valid: false, error: 'La previsualizacion no corresponde a esta planta.' };
  }

  if (new Date(stored.expires_at).getTime() < Date.now()) {
    await kv.del(buildDieselImportPreviewKey(token));
    return { valid: false, error: 'Preview token expirado.' };
  }

  const normalizedPayload = normalizeDieselImportPayload(payload);
  validateDieselImportPayload(normalizedPayload);

  if (stableStringify(stored.payload) !== stableStringify(normalizedPayload)) {
    return { valid: false, error: 'El payload no coincide con la previsualizacion aprobada.' };
  }

  return {
    valid: true,
    payload: stored.payload,
    expires_at: stored.expires_at,
  };
}

export async function consumeDieselImportPreviewToken(token: string) {
  await kv.del(buildDieselImportPreviewKey(token));
}

export async function executeDieselImport(plantId: string, input: DieselImportInput) {
  const preview = await previewDieselImport(plantId, input);
  if (preview.summary.valid_rows === 0) {
    throw new Error('No hay filas validas para importar.');
  }

  const supabase = getSupabaseClient();
  const row = preview.normalized_rows[0];
  let created = 0;
  let updated = 0;

  const payload = {
    plant_id: plantId,
    measurement_method: row.measurement_method,
    calibration_curve_name: row.calibration_curve_name,
    reading_uom: row.reading_uom,
    tank_capacity_gallons: row.tank_capacity_gallons,
    initial_inventory_gallons: row.initial_inventory_gallons ?? 0,
    calibration_table: row.calibration_table,
    is_active: row.is_active,
  };

  if (row.action === 'update' && row.existing_id) {
    const { error } = await supabase
      .from('plant_diesel_config')
      .update(payload)
      .eq('id', row.existing_id);

    if (error) throw error;
    updated = 1;
  } else {
    const { data: existingRows, error: existingError } = await supabase
      .from('plant_diesel_config')
      .select('id')
      .eq('plant_id', plantId);
    if (existingError) throw existingError;

    if ((existingRows || []).length > 0) {
      const { error: deleteError } = await supabase
        .from('plant_diesel_config')
        .delete()
        .eq('plant_id', plantId);
      if (deleteError) throw deleteError;
    }

    const { error } = await supabase
      .from('plant_diesel_config')
      .insert(payload);

    if (error) throw error;
    created = 1;
  }

  return {
    ...preview,
    result: {
      created,
      updated,
    },
  };
}

export async function previewMaterialsImport(input: MaterialsImportInput) {
  const payload = normalizeMaterialsImportPayload(input);
  validateMaterialsImportPayload(payload);

  const supabase = getSupabaseClient();
  const { data: existingRows, error } = await supabase
    .from('materiales_catalog')
    .select('id, nombre, clase, sort_order, is_active');

  if (error) throw error;

  const existingByKey = (existingRows || []).reduce((acc: Record<string, any>, row: any) => {
    const key = `${String(row.nombre || '').trim().toLowerCase()}::${(normalizeCatalogOptionalText(row.clase) || '').toLowerCase()}`;
    acc[key] = row;
    return acc;
  }, {});

  const seenKeys = new Map<string, number>();
  const normalizedRows: NormalizedMaterialsImportRow[] = [];
  const errors: Array<{ row: number; column: string; message: string }> = [];
  const warnings: string[] = [];

  payload.rows.forEach((rawRow, index) => {
    const rowNumber = rawRow.row_number || index + 2;
    const rowErrors: Array<{ column: string; message: string }> = [];
    const nombre = rawRow.nombre.trim();
    const clase = normalizeCatalogOptionalText(rawRow.clase);
    const key = `${nombre.toLowerCase()}::${(clase || '').toLowerCase()}`;

    if (!nombre) {
      rowErrors.push({ column: 'Nombre', message: 'es requerido' });
    }

    if (nombre) {
      if (seenKeys.has(key)) {
        rowErrors.push({ column: 'Nombre/Clase', message: `duplicado dentro del archivo; también aparece en la fila ${seenKeys.get(key)}` });
      } else {
        seenKeys.set(key, rowNumber);
      }
    }

    if (rowErrors.length > 0) {
      rowErrors.forEach((rowError) => {
        errors.push({ row: rowNumber, column: rowError.column, message: rowError.message });
      });
      return;
    }

    const existing = existingByKey[key];
    const unchanged = Boolean(
      existing &&
      String(existing.nombre || '').trim() === nombre &&
      normalizeCatalogOptionalText(existing.clase) === clase &&
      existing.is_active !== false
    );

    if (unchanged) {
      warnings.push(`Fila ${rowNumber}: "${nombre}" no tiene cambios y se omitirá al ejecutar.`);
    }

    normalizedRows.push({
      row_number: rowNumber,
      nombre,
      clase,
      action: existing ? 'update' : 'create',
      unchanged,
      existing_id: existing?.id,
    });
  });

  return {
    module: 'materiales' as const,
    template_version: payload.template_version,
    import_mode: 'upsert' as const,
    summary: {
      total_rows: payload.rows.length,
      valid_rows: normalizedRows.length,
      error_rows: Array.from(new Set(errors.map((item) => item.row))).length,
      creates: normalizedRows.filter((row) => row.action === 'create' && !row.unchanged).length,
      updates: normalizedRows.filter((row) => row.action === 'update' && !row.unchanged).length,
    },
    errors,
    warnings: Array.from(new Set(warnings)),
    normalized_rows: normalizedRows,
  };
}

export async function createMaterialsImportPreviewToken(previewPayload: MaterialsImportInput) {
  const payload = normalizeMaterialsImportPayload(previewPayload);
  validateMaterialsImportPayload(payload);

  const token = crypto.randomUUID();
  const record: MaterialsImportPreviewRecord = {
    token,
    payload,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CLEANUP_PREVIEW_TTL_MS).toISOString(),
  };

  await kv.set(buildMaterialsImportPreviewKey(token), record);
  return record;
}

export async function validateMaterialsImportPreviewToken(token: string, payload: MaterialsImportInput) {
  if (!token) {
    return { valid: false, error: 'Preview token requerido.' };
  }

  const stored = await kv.get(buildMaterialsImportPreviewKey(token)) as MaterialsImportPreviewRecord | null;
  if (!stored) {
    return { valid: false, error: 'Preview token no encontrado o expirado.' };
  }

  if (new Date(stored.expires_at).getTime() < Date.now()) {
    await kv.del(buildMaterialsImportPreviewKey(token));
    return { valid: false, error: 'Preview token expirado.' };
  }

  const normalizedPayload = normalizeMaterialsImportPayload(payload);
  validateMaterialsImportPayload(normalizedPayload);

  if (stableStringify(stored.payload) !== stableStringify(normalizedPayload)) {
    return { valid: false, error: 'El payload no coincide con la previsualización aprobada.' };
  }

  return {
    valid: true,
    payload: stored.payload,
    expires_at: stored.expires_at,
  };
}

export async function consumeMaterialsImportPreviewToken(token: string) {
  await kv.del(buildMaterialsImportPreviewKey(token));
}

export async function executeMaterialsImport(input: MaterialsImportInput) {
  const preview = await previewMaterialsImport(input);
  if (preview.summary.valid_rows === 0) {
    throw new Error('No hay filas válidas para importar.');
  }

  const supabase = getSupabaseClient();
  const { data: existingRows, error } = await supabase
    .from('materiales_catalog')
    .select('id, sort_order');

  if (error) throw error;

  const existingById = (existingRows || []).reduce((acc: Record<string, any>, row: any) => {
    acc[row.id] = row;
    return acc;
  }, {});

  const maxSortOrder = Math.max(-1, ...(existingRows || []).map((row: any) => Number(row.sort_order ?? -1)));
  let nextSortOrder = maxSortOrder + 1;
  let created = 0;
  let updated = 0;

  for (const row of preview.normalized_rows) {
    if (row.unchanged) continue;

    const sortOrder = row.existing_id ? (existingById[row.existing_id]?.sort_order ?? nextSortOrder++) : nextSortOrder++;
    const payloadRow = {
      nombre: row.nombre,
      clase: row.clase,
      sort_order: sortOrder,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (row.action === 'update' && row.existing_id) {
      const { error: updateError } = await supabase
        .from('materiales_catalog')
        .update(payloadRow)
        .eq('id', row.existing_id);
      if (updateError) throw updateError;
      updated += 1;
    } else {
      const { error: insertError } = await supabase
        .from('materiales_catalog')
        .insert(payloadRow);
      if (insertError) throw insertError;
      created += 1;
    }
  }

  return {
    ...preview,
    result: {
      created,
      updated,
    },
  };
}

export async function previewProcedenciasImport(input: ProcedenciasImportInput) {
  const payload = normalizeProcedenciasImportPayload(input);
  validateProcedenciasImportPayload(payload);

  const supabase = getSupabaseClient();
  const { data: existingRows, error } = await supabase
    .from('procedencias_catalog')
    .select('id, nombre, sort_order, is_active');

  if (error) throw error;

  const existingByName = (existingRows || []).reduce((acc: Record<string, any>, row: any) => {
    acc[String(row.nombre || '').trim().toLowerCase()] = row;
    return acc;
  }, {});

  const seenNames = new Map<string, number>();
  const normalizedRows: NormalizedProcedenciasImportRow[] = [];
  const errors: Array<{ row: number; column: string; message: string }> = [];
  const warnings: string[] = [];

  payload.rows.forEach((rawRow, index) => {
    const rowNumber = rawRow.row_number || index + 2;
    const rowErrors: Array<{ column: string; message: string }> = [];
    const nombre = rawRow.nombre.trim();
    const key = nombre.toLowerCase();

    if (!nombre) {
      rowErrors.push({ column: 'Nombre', message: 'es requerido' });
    }

    if (nombre) {
      if (seenNames.has(key)) {
        rowErrors.push({ column: 'Nombre', message: `duplicado dentro del archivo; también aparece en la fila ${seenNames.get(key)}` });
      } else {
        seenNames.set(key, rowNumber);
      }
    }

    if (rowErrors.length > 0) {
      rowErrors.forEach((rowError) => {
        errors.push({ row: rowNumber, column: rowError.column, message: rowError.message });
      });
      return;
    }

    const existing = existingByName[key];
    const unchanged = Boolean(existing && String(existing.nombre || '').trim() === nombre && existing.is_active !== false);

    if (unchanged) {
      warnings.push(`Fila ${rowNumber}: "${nombre}" no tiene cambios y se omitirá al ejecutar.`);
    }

    normalizedRows.push({
      row_number: rowNumber,
      nombre,
      action: existing ? 'update' : 'create',
      unchanged,
      existing_id: existing?.id,
    });
  });

  return {
    module: 'procedencias' as const,
    template_version: payload.template_version,
    import_mode: 'upsert' as const,
    summary: {
      total_rows: payload.rows.length,
      valid_rows: normalizedRows.length,
      error_rows: Array.from(new Set(errors.map((item) => item.row))).length,
      creates: normalizedRows.filter((row) => row.action === 'create' && !row.unchanged).length,
      updates: normalizedRows.filter((row) => row.action === 'update' && !row.unchanged).length,
    },
    errors,
    warnings: Array.from(new Set(warnings)),
    normalized_rows: normalizedRows,
  };
}

export async function createProcedenciasImportPreviewToken(previewPayload: ProcedenciasImportInput) {
  const payload = normalizeProcedenciasImportPayload(previewPayload);
  validateProcedenciasImportPayload(payload);

  const token = crypto.randomUUID();
  const record: ProcedenciasImportPreviewRecord = {
    token,
    payload,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CLEANUP_PREVIEW_TTL_MS).toISOString(),
  };

  await kv.set(buildProcedenciasImportPreviewKey(token), record);
  return record;
}

export async function validateProcedenciasImportPreviewToken(token: string, payload: ProcedenciasImportInput) {
  if (!token) {
    return { valid: false, error: 'Preview token requerido.' };
  }

  const stored = await kv.get(buildProcedenciasImportPreviewKey(token)) as ProcedenciasImportPreviewRecord | null;
  if (!stored) {
    return { valid: false, error: 'Preview token no encontrado o expirado.' };
  }

  if (new Date(stored.expires_at).getTime() < Date.now()) {
    await kv.del(buildProcedenciasImportPreviewKey(token));
    return { valid: false, error: 'Preview token expirado.' };
  }

  const normalizedPayload = normalizeProcedenciasImportPayload(payload);
  validateProcedenciasImportPayload(normalizedPayload);

  if (stableStringify(stored.payload) !== stableStringify(normalizedPayload)) {
    return { valid: false, error: 'El payload no coincide con la previsualización aprobada.' };
  }

  return {
    valid: true,
    payload: stored.payload,
    expires_at: stored.expires_at,
  };
}

export async function consumeProcedenciasImportPreviewToken(token: string) {
  await kv.del(buildProcedenciasImportPreviewKey(token));
}

export async function executeProcedenciasImport(input: ProcedenciasImportInput) {
  const preview = await previewProcedenciasImport(input);
  if (preview.summary.valid_rows === 0) {
    throw new Error('No hay filas válidas para importar.');
  }

  const supabase = getSupabaseClient();
  const { data: existingRows, error } = await supabase
    .from('procedencias_catalog')
    .select('id, sort_order');

  if (error) throw error;

  const existingById = (existingRows || []).reduce((acc: Record<string, any>, row: any) => {
    acc[row.id] = row;
    return acc;
  }, {});

  const maxSortOrder = Math.max(-1, ...(existingRows || []).map((row: any) => Number(row.sort_order ?? -1)));
  let nextSortOrder = maxSortOrder + 1;
  let created = 0;
  let updated = 0;

  for (const row of preview.normalized_rows) {
    if (row.unchanged) continue;

    const sortOrder = row.existing_id ? (existingById[row.existing_id]?.sort_order ?? nextSortOrder++) : nextSortOrder++;
    const payloadRow = {
      nombre: row.nombre,
      sort_order: sortOrder,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (row.action === 'update' && row.existing_id) {
      const { error: updateError } = await supabase
        .from('procedencias_catalog')
        .update(payloadRow)
        .eq('id', row.existing_id);
      if (updateError) throw updateError;
      updated += 1;
    } else {
      const { error: insertError } = await supabase
        .from('procedencias_catalog')
        .insert(payloadRow);
      if (insertError) throw insertError;
      created += 1;
    }
  }

  return {
    ...preview,
    result: {
      created,
      updated,
    },
  };
}

export async function previewAdditivesCatalogImport(input: AdditivesCatalogImportInput) {
  const payload = normalizeAdditivesCatalogImportPayload(input);
  validateAdditivesCatalogImportPayload(payload);

  const supabase = getSupabaseClient();
  const { data: existingRows, error } = await supabase
    .from('additives_catalog')
    .select('id, nombre, marca, uom, sort_order, is_active');

  if (error) throw error;

  const existingByName = (existingRows || []).reduce((acc: Record<string, any>, row: any) => {
    acc[String(row.nombre || '').trim().toLowerCase()] = row;
    return acc;
  }, {});

  const seenNames = new Map<string, number>();
  const normalizedRows: NormalizedAdditivesCatalogImportRow[] = [];
  const errors: Array<{ row: number; column: string; message: string }> = [];
  const warnings: string[] = [];

  payload.rows.forEach((rawRow, index) => {
    const rowNumber = rawRow.row_number || index + 2;
    const rowErrors: Array<{ column: string; message: string }> = [];
    const nombre = rawRow.nombre.trim();
    const marca = normalizeCatalogOptionalText(rawRow.marca);
    const uom = rawRow.uom.trim();
    const key = nombre.toLowerCase();

    if (!nombre) rowErrors.push({ column: 'Nombre', message: 'es requerido' });
    if (!uom) rowErrors.push({ column: 'Unidad', message: 'es requerida' });

    if (nombre) {
      if (seenNames.has(key)) {
        rowErrors.push({ column: 'Nombre', message: `duplicado dentro del archivo; también aparece en la fila ${seenNames.get(key)}` });
      } else {
        seenNames.set(key, rowNumber);
      }
    }

    if (rowErrors.length > 0) {
      rowErrors.forEach((rowError) => {
        errors.push({ row: rowNumber, column: rowError.column, message: rowError.message });
      });
      return;
    }

    const existing = existingByName[key];
    const unchanged = Boolean(
      existing &&
      String(existing.nombre || '').trim() === nombre &&
      normalizeCatalogOptionalText(existing.marca) === marca &&
      String(existing.uom || '').trim() === uom &&
      existing.is_active !== false
    );

    if (unchanged) {
      warnings.push(`Fila ${rowNumber}: "${nombre}" no tiene cambios y se omitirá al ejecutar.`);
    }

    normalizedRows.push({
      row_number: rowNumber,
      nombre,
      marca,
      uom,
      action: existing ? 'update' : 'create',
      unchanged,
      existing_id: existing?.id,
    });
  });

  return {
    module: 'additivos_catalogo' as const,
    template_version: payload.template_version,
    import_mode: 'upsert' as const,
    summary: {
      total_rows: payload.rows.length,
      valid_rows: normalizedRows.length,
      error_rows: Array.from(new Set(errors.map((item) => item.row))).length,
      creates: normalizedRows.filter((row) => row.action === 'create' && !row.unchanged).length,
      updates: normalizedRows.filter((row) => row.action === 'update' && !row.unchanged).length,
    },
    errors,
    warnings: Array.from(new Set(warnings)),
    normalized_rows: normalizedRows,
  };
}

export async function createAdditivesCatalogImportPreviewToken(previewPayload: AdditivesCatalogImportInput) {
  const payload = normalizeAdditivesCatalogImportPayload(previewPayload);
  validateAdditivesCatalogImportPayload(payload);

  const token = crypto.randomUUID();
  const record: AdditivesCatalogImportPreviewRecord = {
    token,
    payload,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CLEANUP_PREVIEW_TTL_MS).toISOString(),
  };

  await kv.set(buildAdditivesCatalogImportPreviewKey(token), record);
  return record;
}

export async function validateAdditivesCatalogImportPreviewToken(token: string, payload: AdditivesCatalogImportInput) {
  if (!token) {
    return { valid: false, error: 'Preview token requerido.' };
  }

  const stored = await kv.get(buildAdditivesCatalogImportPreviewKey(token)) as AdditivesCatalogImportPreviewRecord | null;
  if (!stored) {
    return { valid: false, error: 'Preview token no encontrado o expirado.' };
  }

  if (new Date(stored.expires_at).getTime() < Date.now()) {
    await kv.del(buildAdditivesCatalogImportPreviewKey(token));
    return { valid: false, error: 'Preview token expirado.' };
  }

  const normalizedPayload = normalizeAdditivesCatalogImportPayload(payload);
  validateAdditivesCatalogImportPayload(normalizedPayload);

  if (stableStringify(stored.payload) !== stableStringify(normalizedPayload)) {
    return { valid: false, error: 'El payload no coincide con la previsualización aprobada.' };
  }

  return {
    valid: true,
    payload: stored.payload,
    expires_at: stored.expires_at,
  };
}

export async function consumeAdditivesCatalogImportPreviewToken(token: string) {
  await kv.del(buildAdditivesCatalogImportPreviewKey(token));
}

export async function executeAdditivesCatalogImport(input: AdditivesCatalogImportInput) {
  const preview = await previewAdditivesCatalogImport(input);
  if (preview.summary.valid_rows === 0) {
    throw new Error('No hay filas válidas para importar.');
  }

  const supabase = getSupabaseClient();
  const { data: existingRows, error } = await supabase
    .from('additives_catalog')
    .select('id, sort_order');

  if (error) throw error;

  const existingById = (existingRows || []).reduce((acc: Record<string, any>, row: any) => {
    acc[row.id] = row;
    return acc;
  }, {});

  const maxSortOrder = Math.max(-1, ...(existingRows || []).map((row: any) => Number(row.sort_order ?? -1)));
  let nextSortOrder = maxSortOrder + 1;
  let created = 0;
  let updated = 0;

  for (const row of preview.normalized_rows) {
    if (row.unchanged) continue;

    const sortOrder = row.existing_id ? (existingById[row.existing_id]?.sort_order ?? nextSortOrder++) : nextSortOrder++;
    const payloadRow = {
      nombre: row.nombre,
      marca: row.marca,
      uom: row.uom,
      sort_order: sortOrder,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (row.action === 'update' && row.existing_id) {
      const { error: updateError } = await supabase
        .from('additives_catalog')
        .update(payloadRow)
        .eq('id', row.existing_id);
      if (updateError) throw updateError;
      await syncAdditiveCatalogConsumers(row.existing_id, {
        nombre: row.nombre,
        marca: row.marca,
        uom: row.uom,
      });
      updated += 1;
    } else {
      const { error: insertError } = await supabase
        .from('additives_catalog')
        .insert(payloadRow);
      if (insertError) throw insertError;
      created += 1;
    }
  }

  return {
    ...preview,
    result: {
      created,
      updated,
    },
  };
}

export async function previewCalibrationCurvesImport(plantId: string, input: CalibrationCurvesImportInput) {
  const payload = normalizeCalibrationCurvesImportPayload(input);
  validateCalibrationCurvesImportPayload(payload);

  const plant = await getPlantForConfigCleanup(plantId);
  const supabase = getSupabaseClient();
  const [
    existingRows,
    { data: siloRefs, error: siloError },
    { data: additiveRefs, error: additiveError },
    { data: dieselRef, error: dieselError },
  ] = await Promise.all([
    listPlantCalibrationCurves(plantId),
    supabase
      .from('plant_silos_config')
      .select('calibration_curve_name')
      .eq('plant_id', plantId)
      .neq('is_active', false),
    supabase
      .from('plant_additives_config')
      .select('calibration_curve_name')
      .eq('plant_id', plantId)
      .neq('is_active', false),
    supabase
      .from('plant_diesel_config')
      .select('calibration_curve_name')
      .eq('plant_id', plantId)
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  if (siloError) throw siloError;
  if (additiveError) throw additiveError;
  if (dieselError) throw dieselError;

  const existingByName = (existingRows || []).reduce((acc: Record<string, CalibrationCurveRow>, row) => {
    acc[String(row.curve_name || '').trim().toLowerCase()] = row;
    return acc;
  }, {});

  const referenceCountByName = new Map<string, number>();
  (siloRefs || []).forEach((row: any) => {
    const key = String(row?.calibration_curve_name || '').trim().toLowerCase();
    if (!key) return;
    referenceCountByName.set(key, (referenceCountByName.get(key) || 0) + 1);
  });
  (additiveRefs || []).forEach((row: any) => {
    const key = String(row?.calibration_curve_name || '').trim().toLowerCase();
    if (!key) return;
    referenceCountByName.set(key, (referenceCountByName.get(key) || 0) + 1);
  });
  {
    const key = String(dieselRef?.calibration_curve_name || '').trim().toLowerCase();
    if (key) {
      referenceCountByName.set(key, (referenceCountByName.get(key) || 0) + 1);
    }
  }

  const curveDefinitions = new Map<string, {
    row_number: number;
    curve_name: string;
    measurement_type: string;
    reading_uom: string | null;
  }>();
  const seenNames = new Map<string, number>();
  const pointsByCurveKey = new Map<string, CalibrationCurvePointInput[]>();
  const pointKeysByCurveKey = new Map<string, Map<number, number>>();
  const invalidCurveKeys = new Set<string>();
  const normalizedRows: NormalizedCalibrationCurvesImportRow[] = [];
  const errors: Array<{ row: number; column: string; message: string }> = [];
  const warnings: string[] = [];

  payload.curves.forEach((rawRow, index) => {
    const rowNumber = rawRow.row_number || index + 2;
    const rowErrors: Array<{ column: string; message: string }> = [];
    const curveName = rawRow.curve_name.trim();
    const measurementType = rawRow.measurement_type.trim();
    const readingUom = normalizeCatalogOptionalText(rawRow.reading_uom);
    const curveKey = curveName.toLowerCase();

    if (!curveName) rowErrors.push({ column: 'Nombre de curva', message: 'es requerido' });
    if (!measurementType) rowErrors.push({ column: 'Metodo de medicion', message: 'es requerido' });

    if (curveName) {
      if (seenNames.has(curveKey)) {
        rowErrors.push({ column: 'Nombre de curva', message: `duplicado dentro del archivo; tambien aparece en la fila ${seenNames.get(curveKey)}` });
      } else {
        seenNames.set(curveKey, rowNumber);
        curveDefinitions.set(curveKey, {
          row_number: rowNumber,
          curve_name: curveName,
          measurement_type: measurementType,
          reading_uom: readingUom,
        });
      }
    }

    if (rowErrors.length > 0) {
      if (curveKey) invalidCurveKeys.add(curveKey);
      rowErrors.forEach((rowError) => {
        errors.push({ row: rowNumber, column: rowError.column, message: rowError.message });
      });
    }
  });

  payload.points.forEach((rawPoint, index) => {
    const rowNumber = rawPoint.row_number || index + 2;
    const rowErrors: Array<{ column: string; message: string }> = [];
    const curveName = rawPoint.curve_name.trim();
    const curveKey = curveName.toLowerCase();

    if (!curveName) {
      rowErrors.push({ column: 'Nombre de curva', message: 'es requerido' });
    } else if (!curveDefinitions.has(curveKey)) {
      rowErrors.push({ column: 'Nombre de curva', message: 'debe referenciar una curva existente en la hoja Curvas' });
      invalidCurveKeys.add(curveKey);
    }

    let pointKey: number | null = null;
    let pointValue: number | null = null;

    try {
      pointKey = parseCalibrationCurvePointNumber(rawPoint.point_key, 'Key');
    } catch (error: any) {
      rowErrors.push({ column: 'Key', message: error.message });
    }

    try {
      pointValue = parseCalibrationCurvePointNumber(rawPoint.point_value, 'Value');
    } catch (error: any) {
      rowErrors.push({ column: 'Value', message: error.message });
    }

    if (curveName && pointKey !== null) {
      const seenPointKeys = pointKeysByCurveKey.get(curveKey) || new Map<number, number>();
      if (seenPointKeys.has(pointKey)) {
        rowErrors.push({ column: 'Key', message: `duplicado dentro de la curva; tambien aparece en la fila ${seenPointKeys.get(pointKey)}` });
      } else {
        seenPointKeys.set(pointKey, rowNumber);
        pointKeysByCurveKey.set(curveKey, seenPointKeys);
      }
    }

    if (rowErrors.length > 0) {
      if (curveKey) invalidCurveKeys.add(curveKey);
      rowErrors.forEach((rowError) => {
        errors.push({ row: rowNumber, column: rowError.column, message: rowError.message });
      });
      return;
    }

    const existingPoints = pointsByCurveKey.get(curveKey) || [];
    existingPoints.push({
      point_key: pointKey!,
      point_value: pointValue!,
    });
    pointsByCurveKey.set(curveKey, existingPoints);
  });

  curveDefinitions.forEach((definition, curveKey) => {
    if (!pointsByCurveKey.get(curveKey)?.length) {
      invalidCurveKeys.add(curveKey);
      errors.push({
        row: definition.row_number,
        column: 'Puntos',
        message: 'la curva debe tener al menos un punto en la hoja Puntos',
      });
    }
  });

  curveDefinitions.forEach((definition, curveKey) => {
    if (invalidCurveKeys.has(curveKey)) {
      return;
    }

    const points = normalizeCalibrationCurvePoints(pointsByCurveKey.get(curveKey) || []);
    const dataPoints = buildCalibrationCurveDataPoints(points);
    const existing = existingByName[curveKey];
    const referenceCount = referenceCountByName.get(curveKey) || 0;

    if (existing && referenceCount > 0) {
      warnings.push(`Fila ${definition.row_number}: "${definition.curve_name}" ya está referenciada ${referenceCount} vez/veces. Si confirmas la importación, diesel y aditivos que usan esta curva se resincronizarán con la nueva tabla.`);
    }

    normalizedRows.push({
      row_number: definition.row_number,
      curve_name: definition.curve_name,
      measurement_type: definition.measurement_type,
      reading_uom: definition.reading_uom,
      points,
      data_points: dataPoints,
      action: existing ? 'update' : 'create',
      existing_id: existing?.id,
      reference_count: referenceCount,
    });
  });

  return {
    plant: {
      id: plant.id,
      name: plant.name,
    },
    module: 'calibration_curves' as const,
    template_version: payload.template_version,
    import_mode: 'upsert' as const,
    summary: {
      total_rows: payload.curves.length,
      valid_rows: normalizedRows.length,
      error_rows: Array.from(new Set(errors.map((item) => item.row))).length,
      creates: normalizedRows.filter((row) => row.action === 'create').length,
      updates: normalizedRows.filter((row) => row.action === 'update').length,
      referenced_updates: normalizedRows.filter((row) => row.action === 'update' && row.reference_count > 0).length,
    },
    errors,
    warnings: Array.from(new Set(warnings)),
    normalized_rows: normalizedRows,
  };
}

export async function createCalibrationCurvesImportPreviewToken(plantId: string, previewPayload: CalibrationCurvesImportInput) {
  const payload = normalizeCalibrationCurvesImportPayload(previewPayload);
  validateCalibrationCurvesImportPayload(payload);

  const token = crypto.randomUUID();
  const record: CalibrationCurvesImportPreviewRecord = {
    token,
    plant_id: plantId,
    payload,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CLEANUP_PREVIEW_TTL_MS).toISOString(),
  };

  await kv.set(buildCalibrationCurvesImportPreviewKey(token), record);
  return record;
}

export async function validateCalibrationCurvesImportPreviewToken(plantId: string, token: string, payload: CalibrationCurvesImportInput) {
  if (!token) {
    return { valid: false, error: 'Preview token requerido.' };
  }

  const stored = await kv.get(buildCalibrationCurvesImportPreviewKey(token)) as CalibrationCurvesImportPreviewRecord | null;
  if (!stored) {
    return { valid: false, error: 'Preview token no encontrado o expirado.' };
  }

  if (stored.plant_id !== plantId) {
    return { valid: false, error: 'La previsualizacion no corresponde a esta planta.' };
  }

  if (new Date(stored.expires_at).getTime() < Date.now()) {
    await kv.del(buildCalibrationCurvesImportPreviewKey(token));
    return { valid: false, error: 'Preview token expirado.' };
  }

  const normalizedPayload = normalizeCalibrationCurvesImportPayload(payload);
  validateCalibrationCurvesImportPayload(normalizedPayload);

  if (stableStringify(stored.payload) !== stableStringify(normalizedPayload)) {
    return { valid: false, error: 'El payload no coincide con la previsualizacion aprobada.' };
  }

  return {
    valid: true,
    payload: stored.payload,
    expires_at: stored.expires_at,
  };
}

export async function consumeCalibrationCurvesImportPreviewToken(token: string) {
  await kv.del(buildCalibrationCurvesImportPreviewKey(token));
}

export async function executeCalibrationCurvesImport(plantId: string, input: CalibrationCurvesImportInput) {
  const preview = await previewCalibrationCurvesImport(plantId, input);
  if (preview.summary.valid_rows === 0) {
    throw new Error('No hay filas validas para importar.');
  }

  let created = 0;
  let updated = 0;

  for (const row of preview.normalized_rows) {
    if (row.action === 'update' && row.existing_id) {
      await updateCalibrationCurve(row.existing_id, {
        curve_name: row.curve_name,
        measurement_type: row.measurement_type,
        reading_uom: row.reading_uom,
        points: row.points,
      });
      await syncCalibrationCurveConsumers(plantId, row.curve_name, row.reading_uom, row.data_points);
      updated += 1;
    } else {
      await createCalibrationCurve({
        plant_id: plantId,
        curve_name: row.curve_name,
        measurement_type: row.measurement_type,
        reading_uom: row.reading_uom,
        points: row.points,
      });
      created += 1;
    }
  }

  return {
    ...preview,
    result: {
      created,
      updated,
    },
  };
}
