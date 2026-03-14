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
const CLEANUP_PREVIEW_TTL_MS = 15 * 60 * 1000;
const MAX_CLEANUP_INVENTORY_MONTHS = 200;
const MAX_CLEANUP_DISTINCT_MONTHS = 24;

type InventoryStatus = typeof INVENTORY_STATUSES[number];

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
