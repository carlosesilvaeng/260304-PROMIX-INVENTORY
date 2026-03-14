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

function validateAggregatesImportPayload(input: ReturnType<typeof normalizeAggregatesImportPayload>) {
  if (input.module !== 'aggregates') {
    throw new Error('Solo se admite el modulo aggregates en esta version.');
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
      siloAllowedProductsRes,
      cajonesRes,
      additivesRes,
      dieselRes,
      productsRes,
      utilitiesRes,
      pettyCashRes
    ] = await Promise.all([
      supabase.from('plant_aggregates_config').select('*').eq('plant_id', plantId).neq('is_active', false).order('sort_order'),
      supabase.from('plant_silos_config').select('*').eq('plant_id', plantId).neq('is_active', false).order('sort_order'),
      supabase.from('silo_allowed_products').select('silo_config_id, product_name'),
      supabase.from('plant_cajones_config').select('*').eq('plant_id', plantId).neq('is_active', false).order('sort_order'),
      supabase.from('plant_additives_config').select('*').eq('plant_id', plantId).neq('is_active', false).order('sort_order'),
      supabase.from('plant_diesel_config').select('*').eq('plant_id', plantId).eq('is_active', true).single(),
      supabase.from('plant_products_config').select('*').eq('plant_id', plantId).neq('is_active', false).order('sort_order'),
      supabase.from('plant_utilities_meters_config').select('*').eq('plant_id', plantId).neq('is_active', false).order('sort_order'),
      supabase.from('plant_petty_cash_config').select('*').eq('plant_id', plantId).eq('is_active', true).single()
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

    if (siloAllowedProductsRes.error) {
      console.error(`❌ [getPlantConfigPackage] Silo allowed products query error:`, siloAllowedProductsRes.error);
    }

    if (cajonesRes.error) {
      console.error(`❌ [getPlantConfigPackage] Cajones query error:`, cajonesRes.error);
    }
    
    // Get unique calibration curve IDs
    const curveIds = new Set<string>();
    additivesRes.data?.forEach(a => a.calibration_curve_id && curveIds.add(a.calibration_curve_id));
    productsRes.data?.forEach(p => p.calibration_curve_id && curveIds.add(p.calibration_curve_id));
    if (dieselRes.data?.calibration_curve_id) curveIds.add(dieselRes.data.calibration_curve_id);
    
    // Fetch calibration curves
    let calibration_curves = {};
    if (curveIds.size > 0) {
      const { data: curves } = await supabase
        .from('calibration_curves')
        .select('*')
        .in('id', Array.from(curveIds));
      
      calibration_curves = (curves || []).reduce((acc, curve) => {
        acc[curve.id] = curve;
        return acc;
      }, {});
    }
    
    // Format silos with allowed products
    const siloAllowedProductsBySiloId = (siloAllowedProductsRes.data || []).reduce((acc: Record<string, string[]>, row: any) => {
      if (!row?.silo_config_id || !row?.product_name) return acc;
      if (!acc[row.silo_config_id]) acc[row.silo_config_id] = [];
      acc[row.silo_config_id].push(row.product_name);
      return acc;
    }, {});

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
  userId?: string
) {
  const supabase = getSupabaseClient();
  
  const updateData: any = { status, updated_at: new Date().toISOString() };
  
  if (status === 'APPROVED' && userId) {
    updateData.approved_by = userId;
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
  const [{ data: aggregateRows, error: aggregateError }, { count: legacyCount, error: legacyError }] = await Promise.all([
    supabase
      .from('plant_aggregates_config')
      .select('id, aggregate_name, sort_order')
      .eq('plant_id', plantId),
    supabase
      .from('plant_cajones_config')
      .select('id', { count: 'exact', head: true })
      .eq('plant_id', plantId),
  ]);

  if (aggregateError) throw aggregateError;
  if (legacyError) throw legacyError;

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

    if (!aggregateName) rowErrors.push({ column: 'Nombre del agregado', message: 'es requerido' });
    if (!materialType) rowErrors.push({ column: 'Material', message: 'es requerido' });
    if (!locationArea) rowErrors.push({ column: 'Procedencia', message: 'es requerida' });
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
      material_type: materialType,
      location_area: locationArea,
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
