import { createClient } from 'jsr:@supabase/supabase-js@2';

// Initialize Supabase client with service role key
export const getSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

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
        `📋 Tablas faltantes: ${missingTables.length}/17\\n\\n` +
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
      additivesRes,
      dieselRes,
      productsRes,
      utilitiesRes,
      pettyCashRes
    ] = await Promise.all([
      supabase.from('plant_aggregates_config').select('*').eq('plant_id', plantId).neq('is_active', false).order('sort_order'),
      supabase.from('plant_silos_config').select('*').eq('plant_id', plantId).neq('is_active', false).order('sort_order'),
      supabase.from('silo_allowed_products').select('silo_config_id, product_name'),
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
    
    return {
      plant_id: plantId,
      aggregates: aggregatesRes.data || [],
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
