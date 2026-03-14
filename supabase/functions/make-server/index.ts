import { Hono } from "npm:hono@4.6";
import { cors } from "npm:hono@4.6/cors";
import { logger } from "npm:hono@4.6/logger";
import * as kv from "./kv_store.tsx";
import * as db from "./database.tsx";
import * as seed from "./seed.tsx";
import * as auth from "./auth.tsx";

const app = new Hono();

// ============================================================================
// BUILD VERSION - Update manually when deploying
// ============================================================================
const BUILD_VERSION = '2603131705';
// Format: YYMMDDHHMM (GMT-5 Puerto Rico Time) = 26/03/03 18:00 = Mar 03, 2026 6:00 PM

console.log('🚀 [PROMIX] Edge Function Started - Build', BUILD_VERSION);
console.log('📋 [PROMIX] Environment Check:');
console.log('   SUPABASE_URL:', Deno.env.get('SUPABASE_URL'));
console.log('   CLIENT_ANON_KEY length:', Deno.env.get('CLIENT_ANON_KEY')?.length);
console.log('   CLIENT_ANON_KEY prefix:', Deno.env.get('CLIENT_ANON_KEY')?.substring(0, 50) + '...');
console.log('   SUPABASE_SERVICE_ROLE_KEY exists:', !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
console.log('   SUPABASE_SERVICE_ROLE_KEY length:', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.length || 0);
console.log('   SUPABASE_SERVICE_ROLE_KEY prefix:', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.substring(0, 50) + '...');

// Decode and check key algorithms
const anonKey = Deno.env.get('CLIENT_ANON_KEY');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (anonKey) {
  try {
    const parts = anonKey.split('.');
    const header = JSON.parse(atob(parts[0]));
    console.log('   CLIENT_ANON_KEY algorithm:', header.alg);
  } catch (e) {
    console.log('   CLIENT_ANON_KEY: Not a valid JWT');
  }
}
if (serviceKey) {
  try {
    const parts = serviceKey.split('.');
    const header = JSON.parse(atob(parts[0]));
    console.log('   SUPABASE_SERVICE_ROLE_KEY algorithm:', header.alg);
  } catch (e) {
    console.log('   SUPABASE_SERVICE_ROLE_KEY: Not a valid JWT');
  }
}

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// ============================================================================
// AUTH MIDDLEWARE HELPERS
// ============================================================================

async function requireAuth(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);
  const { user, error } = await auth.verifyToken(token);
  if (!user || error) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  c.set('user', user);
  await next();
}

async function requireAdmin(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);
  const { user, error } = await auth.verifyToken(token);
  if (!user || error) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return c.json({ success: false, error: 'Forbidden: Admin access required' }, 403);
  }
  c.set('user', user);
  await next();
}

async function requireSuperAdmin(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);
  const { user, error } = await auth.verifyToken(token);
  if (!user || error) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  if (user.role !== 'super_admin') {
    return c.json({ success: false, error: 'Forbidden: Super Admin access required' }, 403);
  }
  c.set('user', user);
  await next();
}

async function requireUserManagement(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);
  const { user, error } = await auth.verifyToken(token);
  if (!user || error) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  if (!canManagePlantManagers(user)) {
    return c.json({ success: false, error: 'Forbidden: User management access required' }, 403);
  }
  c.set('user', user);
  await next();
}

function isPlantManagerLike(user: any): boolean {
  return user?.role === 'plant_manager' || user?.role === 'operations_manager';
}

function canAccessAllPlants(user: any): boolean {
  return user?.role === 'operations_manager' || user?.role === 'admin' || user?.role === 'super_admin';
}

function canManagePlantManagers(user: any): boolean {
  return user?.role === 'operations_manager' || user?.role === 'admin' || user?.role === 'super_admin';
}

function checkPlantAccess(user: any, plantId: string): boolean {
  if (canAccessAllPlants(user)) return true;
  return (user.assigned_plants as string[])?.includes(plantId) ?? false;
}

// ============================================================================
// ROUTE-LEVEL AUTH MIDDLEWARE
// ============================================================================

// All inventory endpoints require at minimum a valid login
app.use('/make-server/inventory/*', requireAuth);

// Database admin endpoints require admin or super_admin role
app.use('/make-server/db/*', requireAdmin);

// Plant config endpoints require a valid login (plant access checked per-handler)
app.use('/make-server/plants/*', requireAuth);

// Module config endpoints require a valid login (write ops check admin inside handler)
app.use('/make-server/modules/*', requireAuth);

// Debug endpoint requires admin role
app.use('/make-server/debug/*', requireAdmin);

// Data control endpoints require super_admin role
app.use('/make-server/admin/data', requireSuperAdmin);
app.use('/make-server/admin/data/*', requireSuperAdmin);

// Audit endpoints require at minimum a valid login
app.use('/make-server/audit/*', requireAuth);

// Plants list endpoint requires a valid login (exact path, not covered by /plants/*)
app.use('/make-server/plants', requireAuth);

// Reports endpoint requires a valid login
app.use('/make-server/reports', requireAuth);

// Catalog endpoints (materiales, procedencias) require admin role
app.use('/make-server/catalogs/*', requireAdmin);

// ============================================================================
// AUDIT HELPER
// ============================================================================

// Fire-and-forget: never throws, never delays the main response
function logAudit(supabase: any, entry: {
  user_email: string;
  user_name?: string;
  user_id?: string;
  action: string;
  plant_id?: string | null;
  inventory_month_id?: string | null;
  details?: any;
}) {
  supabase.from('audit_logs').insert({
    ...entry,
    timestamp: new Date().toISOString(),
  }).then(() => {}).catch((e: any) => {
    console.error('[AUDIT] Failed to log:', e.message);
  });
}

async function createAuditEntry(supabase: any, entry: {
  user_email: string;
  user_name?: string;
  user_id?: string;
  action: string;
  plant_id?: string | null;
  inventory_month_id?: string | null;
  details?: any;
}) {
  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      ...entry,
      timestamp: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}

async function deleteInventoryMonthCascade(
  inventoryMonthId: string,
  options?: {
    supabase?: any;
    actor?: { email: string; name?: string; id?: string };
    auditAction?: string | null;
    auditDetails?: Record<string, any>;
  }
) {
  const supabase = options?.supabase || db.getSupabaseClient();
  const childTables = db.INVENTORY_CHILD_TABLES.map(({ table }) => table);

  const { data: report, error: reportError } = await supabase
    .from('inventory_month')
    .select('id, plant_id, year_month')
    .eq('id', inventoryMonthId)
    .single();

  if (reportError || !report) {
    throw new Error('Reporte no encontrado');
  }

  const photoUrls: string[] = [];
  const deletedRowsByTable: Record<string, number> = {};
  const warnings: string[] = [];

  for (const table of childTables) {
    const { data: rows, error: rowsError } = await supabase
      .from(table)
      .select('photo_url')
      .eq('inventory_month_id', inventoryMonthId);

    if (rowsError) throw rowsError;

    deletedRowsByTable[table] = rows?.length || 0;
    rows?.forEach((row: any) => {
      if (row?.photo_url) photoUrls.push(row.photo_url);
    });
  }

  let deletedPhotos = 0;
  if (photoUrls.length > 0) {
    const storagePaths = Array.from(new Set(
      photoUrls
        .filter((url: string) => url.includes('/inventory-photos/'))
        .map((url: string) => url.split('/inventory-photos/')[1])
        .filter(Boolean)
    ));

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('inventory-photos')
        .remove(storagePaths);

      if (storageError) {
        warnings.push(`No se pudieron eliminar algunas fotos del bucket: ${storageError.message}`);
        console.warn('[DELETE INVENTORY] Storage removal warning:', storageError.message);
      } else {
        deletedPhotos = storagePaths.length;
      }
    }
  }

  for (const table of childTables) {
    const { error } = await supabase.from(table).delete().eq('inventory_month_id', inventoryMonthId);
    if (error) throw error;
  }

  const { error: deleteError } = await supabase
    .from('inventory_month')
    .delete()
    .eq('id', inventoryMonthId);

  if (deleteError) throw deleteError;

  if (options?.auditAction && options.actor) {
    logAudit(supabase, {
      user_email: options.actor.email,
      user_name: options.actor.name,
      user_id: options.actor.id,
      action: options.auditAction,
      plant_id: report.plant_id,
      inventory_month_id: inventoryMonthId,
      details: {
        year_month: report.year_month,
        deleted_rows_by_table: deletedRowsByTable,
        photos_deleted: deletedPhotos,
        warnings,
        ...options.auditDetails,
      },
    });
  }

  return {
    report,
    deletedRowsByTable,
    deletedPhotos,
    warnings,
  };
}

// ============================================================================
// PUBLIC ENDPOINTS
// ============================================================================

// Health check endpoint
app.get("/make-server/health", (c) => {
  return c.json({ status: "ok" });
});

// Get BUILD version endpoint
app.get("/make-server/build-version", (c) => {
  return c.json({ 
    success: true, 
    buildVersion: BUILD_VERSION,
    timestamp: new Date().toISOString()
  });
});

// Debug environment endpoint - Check backend configuration
app.get("/make-server/debug/env", (c) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const clientAnonKey = Deno.env.get('CLIENT_ANON_KEY');
  const legacyAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const jwtSecret = Deno.env.get('JWT_SECRET'); // Changed from SUPABASE_JWT_SECRET
  
  console.log('🔍 [debug/env] Environment inspection:');
  console.log('   CLIENT_ANON_KEY exists:', !!clientAnonKey);
  console.log('   CLIENT_ANON_KEY length:', clientAnonKey?.length || 0);
  console.log('   CLIENT_ANON_KEY prefix:', clientAnonKey?.substring(0, 50) + '...');
  console.log('   SUPABASE_ANON_KEY (legacy) exists:', !!legacyAnonKey);
  console.log('   SUPABASE_ANON_KEY (legacy) length:', legacyAnonKey?.length || 0);
  console.log('   JWT_SECRET exists:', !!jwtSecret);
  console.log('   JWT_SECRET length:', jwtSecret?.length || 0);
  
  return c.json({ 
    success: true,
    buildVersion: BUILD_VERSION,
    environment: {
      hasSupabaseUrl: !!supabaseUrl,
      supabaseUrlPrefix: supabaseUrl?.substring(0, 30) + '...',
      hasClientAnonKey: !!clientAnonKey,
      hasLegacyAnonKey: !!legacyAnonKey,
      anonKeyPrefix: clientAnonKey?.substring(0, 50) + '...',
      anonKeyLength: clientAnonKey?.length || 0,
      hasServiceRoleKey: !!supabaseServiceRoleKey,
      serviceRoleKeyLength: supabaseServiceRoleKey?.length || 0,
      hasJwtSecret: !!jwtSecret,
      jwtSecretLength: jwtSecret?.length || 0,
      note: 'Using CLIENT_ANON_KEY (not SUPABASE_ANON_KEY)'
    },
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// DATA CONTROL ENDPOINTS
// ============================================================================

app.get("/make-server/admin/data/summary", async (c) => {
  try {
    const data = await db.getDataControlSummary();
    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('[DATA CONTROL] Summary error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.get("/make-server/admin/data/inventories", async (c) => {
  try {
    const data = await db.listInventoryMonthsForControl({
      plant_ids: c.req.query('plant_id') ? [c.req.query('plant_id')] : undefined,
      year_month_from: c.req.query('year_month_from'),
      year_month_to: c.req.query('year_month_to'),
      status: c.req.query('status'),
      page: c.req.query('page'),
      page_size: c.req.query('page_size'),
      include_photos: true,
      scope: 'transactional',
    });

    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('[DATA CONTROL] Inventory list error:', error);
    return c.json({ success: false, error: error.message }, 400);
  }
});

app.post("/make-server/admin/data/cleanup/preview", async (c) => {
  try {
    const user = c.get('user');
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();

    const preview = await db.previewTransactionalCleanup(body);
    let previewToken: string | null = null;

    if (preview.inventory_month_ids.length > 0) {
      const record = await db.createCleanupPreviewToken(body);
      previewToken = record.token;
    }

    await createAuditEntry(supabase, {
      user_email: user.email,
      user_name: user.name,
      user_id: user.id,
      action: 'DATA_CLEANUP_PREVIEWED',
      details: {
        scope: preview.scope,
        filters: preview.filters,
        inventory_month_ids: preview.inventory_month_ids,
        counts_by_table: preview.counts_by_table,
        deleted_photos_count: preview.deleted_photos_count,
      },
    });

    return c.json({
      success: true,
      data: {
        ...preview,
        preview_token: previewToken,
      },
    });
  } catch (error: any) {
    console.error('[DATA CONTROL] Cleanup preview error:', error);
    return c.json({ success: false, error: error.message }, 400);
  }
});

app.post("/make-server/admin/data/cleanup/execute", async (c) => {
  try {
    const user = c.get('user');
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const {
      preview_token,
      confirmation_text,
      reason,
      ...filters
    } = body || {};

    if (confirmation_text !== 'ELIMINAR DATOS DE PRUEBA') {
      return c.json({ success: false, error: 'La frase de confirmacion es incorrecta.' }, 400);
    }

    if (typeof reason !== 'string' || reason.trim().length < 10) {
      return c.json({ success: false, error: 'Debes ingresar un motivo de al menos 10 caracteres.' }, 400);
    }

    const validation = await db.validateCleanupPreviewToken(preview_token, filters);
    if (!validation.valid) {
      return c.json({ success: false, error: validation.error }, 400);
    }

    const preview = await db.previewTransactionalCleanup(filters);
    if (preview.inventory_month_ids.length === 0) {
      return c.json({ success: false, error: 'No hay inventarios para eliminar con ese filtro.' }, 400);
    }

    const deletedRowsByTable = preview.counts_by_table
      ? Object.keys(preview.counts_by_table).reduce((acc: Record<string, number>, key) => {
          acc[key] = 0;
          return acc;
        }, {})
      : { inventory_month: 0 };

    let deletedPhotos = 0;
    const warnings: string[] = [];

    for (const inventoryMonthId of preview.inventory_month_ids) {
      const result = await deleteInventoryMonthCascade(inventoryMonthId, {
        supabase,
      });

      deletedRowsByTable.inventory_month = (deletedRowsByTable.inventory_month || 0) + 1;
      deletedPhotos += result.deletedPhotos;
      result.warnings.forEach((warning) => warnings.push(warning));
      Object.entries(result.deletedRowsByTable).forEach(([table, count]) => {
        deletedRowsByTable[table] = (deletedRowsByTable[table] || 0) + count;
      });
    }

    const auditActionId = await createAuditEntry(supabase, {
      user_email: user.email,
      user_name: user.name,
      user_id: user.id,
      action: 'DATA_CLEANUP_EXECUTED',
      details: {
        scope: preview.scope,
        filters: preview.filters,
        inventory_month_ids: preview.inventory_month_ids,
        deleted_inventory_months: preview.inventory_month_ids.length,
        deleted_rows_by_table: deletedRowsByTable,
        deleted_photos: deletedPhotos,
        reason: reason.trim(),
        warnings,
      },
    });

    await db.consumeCleanupPreviewToken(preview_token);

    return c.json({
      success: true,
      data: {
        deleted_inventory_months: preview.inventory_month_ids.length,
        deleted_rows_by_table: deletedRowsByTable,
        deleted_photos: deletedPhotos,
        audit_action_id: auditActionId,
        warnings,
      },
    });
  } catch (error: any) {
    console.error('[DATA CONTROL] Cleanup execute error:', error);
    return c.json({ success: false, error: error.message }, 400);
  }
});

app.post("/make-server/admin/data/config-cleanup/preview", async (c) => {
  try {
    const user = c.get('user');
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();

    const preview = await db.previewPlantConfigurationCleanup(body);
    let previewToken: string | null = null;

    if (Object.values(preview.counts_by_table).some((count) => count > 0)) {
      const record = await db.createConfigCleanupPreviewToken(body);
      previewToken = record.token;
    }

    await createAuditEntry(supabase, {
      user_email: user.email,
      user_name: user.name,
      user_id: user.id,
      action: 'CONFIG_CLEANUP_PREVIEWED',
      plant_id: preview.plant.id,
      details: {
        plant: preview.plant,
        modules: preview.modules,
        include_related_rows: preview.include_related_rows,
        counts_by_module: preview.counts_by_module,
        counts_by_table: preview.counts_by_table,
        inventory_months_count: preview.inventory_months_count,
        warnings: preview.warnings,
      },
    });

    return c.json({
      success: true,
      data: {
        ...preview,
        preview_token: previewToken,
      },
    });
  } catch (error: any) {
    console.error('[DATA CONTROL] Config cleanup preview error:', error);
    return c.json({ success: false, error: error.message }, 400);
  }
});

app.post("/make-server/admin/data/config-cleanup/execute", async (c) => {
  try {
    const user = c.get('user');
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const {
      preview_token,
      confirmation_text,
      reason,
      ...filters
    } = body || {};

    if (confirmation_text !== 'REINICIAR CONFIGURACION') {
      return c.json({ success: false, error: 'La frase de confirmacion es incorrecta.' }, 400);
    }

    if (typeof reason !== 'string' || reason.trim().length < 10) {
      return c.json({ success: false, error: 'Debes ingresar un motivo de al menos 10 caracteres.' }, 400);
    }

    const validation = await db.validateConfigCleanupPreviewToken(preview_token, filters);
    if (!validation.valid) {
      return c.json({ success: false, error: validation.error }, 400);
    }

    const preview = await db.previewPlantConfigurationCleanup(filters);
    const totalRows = Object.values(preview.counts_by_table).reduce((sum, count) => sum + count, 0);
    if (totalRows === 0) {
      return c.json({ success: false, error: 'No hay configuracion para reiniciar con esos modulos.' }, 400);
    }

    const result = await db.executePlantConfigurationCleanup(filters);

    const auditActionId = await createAuditEntry(supabase, {
      user_email: user.email,
      user_name: user.name,
      user_id: user.id,
      action: 'CONFIG_CLEANUP_EXECUTED',
      plant_id: result.plant.id,
      details: {
        plant: result.plant,
        modules: result.modules,
        deleted_rows_by_table: result.deleted_rows_by_table,
        deleted_rows_by_module: result.deleted_rows_by_module,
        inventory_months_count: result.inventory_months_count,
        reason: reason.trim(),
        warnings: result.warnings,
      },
    });

    await db.consumeConfigCleanupPreviewToken(preview_token);

    return c.json({
      success: true,
      data: {
        deleted_modules: result.modules,
        deleted_rows_by_table: result.deleted_rows_by_table,
        deleted_rows_by_module: result.deleted_rows_by_module,
        inventory_months_count: result.inventory_months_count,
        audit_action_id: auditActionId,
        warnings: result.warnings,
      },
    });
  } catch (error: any) {
    console.error('[DATA CONTROL] Config cleanup execute error:', error);
    return c.json({ success: false, error: error.message }, 400);
  }
});

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

// Signup - Create new user (Operations / Admin / Super Admin with role restrictions)
app.post("/make-server/auth/signup", requireUserManagement, async (c) => {
  try {
    const body = await c.req.json();
    const requestingUser = c.get('user');
    const result = await auth.signup(body, requestingUser.id);
    
    if (!result.success) {
      const status = result.error === 'Unauthorized' || result.error?.startsWith('No tienes permisos')
        ? 403
        : 400;
      return c.json(result, status);
    }

    if (result.user) {
      logAudit(db.getSupabaseClient(), {
        user_email: requestingUser.email,
        user_name: requestingUser.name,
        user_id: requestingUser.id,
        action: 'USER_CREATED',
        plant_id: null,
        details: {
          target_user_id: result.user.id,
          target_user_email: result.user.email,
          target_user_role: result.user.role,
        },
      });
    }
    
    return c.json(result);
  } catch (error) {
    console.error("Signup error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Login - Authenticate user
app.post("/make-server/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const result = await auth.login(body);

    if (!result.success) {
      return c.json(result, 400);
    }

    // Audit: user logged in
    if (result.user) {
      logAudit(db.getSupabaseClient(), {
        user_email: result.user.email,
        user_name: result.user.name,
        user_id: result.user.id,
        action: 'USER_LOGIN',
        plant_id: null,
        details: { role: result.user.role },
      });
    }

    return c.json(result);
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Change Password - Cambiar contraseña del usuario autenticado
app.post("/make-server/auth/change-password", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.replace("Bearer ", "");
    
    if (!accessToken) {
      return c.json({ success: false, error: "Token de autenticación requerido" }, 401);
    }
    
    const body = await c.req.json();
    const result = await auth.changePassword(accessToken, body);
    
    if (!result.success) {
      return c.json(result, 400);
    }
    
    return c.json(result);
  } catch (error) {
    console.error("Change password error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Reset Password - Usuario autorizado resetea la contraseña de otro usuario
app.post("/make-server/auth/users/:userId/reset-password", requireUserManagement, async (c) => {
  try {
    const requestingUser = c.get('user');
    const userId = c.req.param("userId");
    const body = await c.req.json();

    const result = await auth.resetUserPassword(userId, body, requestingUser.id);

    if (!result.success) {
      const status = result.error === 'Unauthorized' || result.error?.startsWith('Solo el Super Administrador') || result.error?.startsWith('No tienes permisos')
        ? 403
        : 400;
      return c.json(result, status);
    }

    if (result.user) {
      logAudit(db.getSupabaseClient(), {
        user_email: requestingUser.email,
        user_name: requestingUser.name,
        user_id: requestingUser.id,
        action: 'USER_PASSWORD_RESET',
        details: {
          target_user_id: result.user.id,
          target_user_email: result.user.email,
          target_user_name: result.user.name,
          target_user_role: result.user.role,
        },
      });
    }

    return c.json(result);
  } catch (error) {
    console.error("Reset user password error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Check if this is first-time setup (no users exist)
app.get("/make-server/auth/check-first-time", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    
    // Count total users
    const { count, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error checking user count:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
    
    const isFirstTime = count === 0;
    console.log(`🔍 First-time setup check: ${isFirstTime ? 'YES (no users)' : 'NO (' + count + ' users exist)'}`);
    
    return c.json({ 
      success: true, 
      isFirstTime,
      userCount: count
    });
  } catch (error) {
    console.error("Check first-time error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Verify token - Check if user is authenticated
app.post("/make-server/auth/verify", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.split(" ")[1];
    
    if (!token) {
      return c.json({ success: false, error: "No token provided" }, 401);
    }
    
    const result = await auth.verifyToken(token);
    
    if (!result.user) {
      return c.json({ success: false, error: result.error }, 401);
    }
    
    return c.json({ success: true, user: result.user });
  } catch (error) {
    console.error("Verify token error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get all users (Super Admin and Admin)
app.get("/make-server/auth/users", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.split(" ")[1];
    
    console.log('📋 [GET /auth/users] Request received');
    console.log('   Authorization header:', authHeader ? `${authHeader.substring(0, 30)}...` : 'MISSING');
    console.log('   Token extracted:', token ? `${token.substring(0, 30)}...` : 'MISSING');
    
    if (!token) {
      console.error('❌ [GET /auth/users] No token provided');
      return c.json({ success: false, error: "No token provided" }, 401);
    }
    
    // Verify user and get their ID
    console.log('🔐 [GET /auth/users] Verifying token...');
    const { user: requestingUser, error: verifyError } = await auth.verifyToken(token);
    
    if (!requestingUser) {
      console.error('❌ [GET /auth/users] Token verification failed:', verifyError);
      return c.json({ success: false, error: verifyError || "Unauthorized" }, 401);
    }
    
    console.log('✅ [GET /auth/users] Token verified for user:', requestingUser.email);
    
    const result = await auth.getAllUsers(requestingUser.id);
    
    if (!result.success) {
      console.error('❌ [GET /auth/users] getAllUsers failed:', result.error);
      return c.json(result, 403);
    }
    
    console.log('✅ [GET /auth/users] Returning', result.users?.length || 0, 'users');
    return c.json(result);
  } catch (error) {
    console.error("❌ [GET /auth/users] Unexpected error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update user (Super Admin and Admin with restrictions)
app.put("/make-server/auth/users/:userId", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.split(" ")[1];
    
    if (!token) {
      return c.json({ success: false, error: "No token provided" }, 401);
    }
    
    const { user: requestingUser } = await auth.verifyToken(token);
    
    if (!requestingUser) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }
    
    const userId = c.req.param("userId");
    const updates = await c.req.json();
    
    const result = await auth.updateUser(userId, updates, requestingUser.id);
    
    if (!result.success) {
      return c.json(result, result.error === 'Usuario no encontrado' ? 404 : 403);
    }

    if (result.user) {
      logAudit(db.getSupabaseClient(), {
        user_email: requestingUser.email,
        user_name: requestingUser.name,
        user_id: requestingUser.id,
        action: 'USER_UPDATED',
        plant_id: null,
        details: {
          target_user_id: result.user.id,
          target_user_email: result.user.email,
          target_user_role: result.user.role,
        },
      });
    }
    
    return c.json(result);
  } catch (error) {
    console.error("Update user error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete user (Super Admin can delete all, Admin can delete Plant Managers and Admins)
app.delete("/make-server/auth/users/:userId", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.split(" ")[1];
    
    if (!token) {
      return c.json({ success: false, error: "No token provided" }, 401);
    }
    
    const { user: requestingUser } = await auth.verifyToken(token);
    
    if (!requestingUser) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }
    
    const userId = c.req.param("userId");
    
    const result = await auth.deleteUser(userId, requestingUser.id);
    
    if (!result.success) {
      return c.json(result, result.error === 'User not found' ? 404 : 403);
    }

    logAudit(db.getSupabaseClient(), {
      user_email: requestingUser.email,
      user_name: requestingUser.name,
      user_id: requestingUser.id,
      action: 'USER_DELETED',
      plant_id: null,
      details: {
        target_user_id: userId,
      },
    });
    
    return c.json(result);
  } catch (error) {
    console.error("Delete user error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

// Database initialization endpoint
app.post("/make-server/db/initialize", async (c) => {
  try {
    const result = await db.initializeDatabaseSchema();
    
    if (!result.success) {
      return c.json(result, 500);
    }
    
    return c.json(result);
  } catch (error) {
    console.error("Initialize DB error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Reload PostgREST schema cache endpoint
app.post("/make-server/db/reload-cache", async (c) => {
  try {
    console.log('🔄 [RELOAD CACHE] Reloading PostgREST schema cache...');
    
    const supabase = db.getSupabaseClient();
    
    // Execute NOTIFY command to reload PostgREST schema cache
    const { error } = await supabase.rpc('reload_schema_cache_fn');
    
    if (error) {
      console.error('❌ [RELOAD CACHE] Error:', error);
      // If function doesn't exist, provide instructions
      if (error.code === '42883') {
        return c.json({
          success: false,
          error: 'Schema cache reload function not found. Please execute: NOTIFY pgrst, \'reload schema\'; in Supabase SQL Editor.',
          instructions: [
            '1. Go to Supabase Dashboard → SQL Editor',
            '2. Execute: NOTIFY pgrst, \'reload schema\';',
            '3. Wait 5-10 seconds',
            '4. Try loading configurations again'
          ]
        }, 500);
      }
      return c.json({ success: false, error: error.message }, 500);
    }
    
    console.log('✅ [RELOAD CACHE] Schema cache reload signal sent');
    
    return c.json({ 
      success: true, 
      message: 'Schema cache reload signal sent. Wait 5-10 seconds before retrying.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Reload cache error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Clear all configurations (use with caution!)
app.post("/make-server/db/clear", async (c) => {
  try {
    await seed.clearAllConfigurations();
    return c.json({ success: true, message: "All configurations cleared" });
  } catch (error) {
    console.error("Clear error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============================================================================
// PLANT CONFIGURATION ENDPOINTS
// ============================================================================

app.get("/make-server/plants/:plantId/config", async (c) => {
  try {
    const user = c.get('user');  // set by requireAuth middleware
    const plantId = c.req.param("plantId");

    if (!checkPlantAccess(user, plantId)) {
      console.warn(`🚫 [GET /plants/${plantId}/config] Access denied for user ${user.email} (role: ${user.role})`);
      return c.json({ success: false, error: 'Forbidden: No access to this plant' }, 403);
    }

    console.log(`🔍 [GET /plants/${plantId}/config] Fetching configuration...`);
    
    const config = await db.getPlantConfigPackage(plantId);
    
    console.log(`✅ [GET /plants/${plantId}/config] Configuration retrieved:`);
    console.log(`   Aggregates: ${config.aggregates?.length || 0} items`);
    console.log(`   Silos: ${config.silos?.length || 0} items`);
    console.log(`   Additives: ${config.additives?.length || 0} items`);
    console.log(`   Products: ${config.products?.length || 0} items`);
    console.log(`   Utilities: ${config.utilities?.length || 0} items`);
    console.log(`   Diesel: ${config.diesel ? 'configured' : 'not configured'}`);
    console.log(`   Petty Cash: ${config.petty_cash ? 'configured' : 'not configured'}`);
    
    if (config.aggregates?.length > 0) {
      console.log(`   Aggregate names: ${config.aggregates.map(a => a.aggregate_name).join(', ')}`);
    }
    
    return c.json({ success: true, data: config });
  } catch (error) {
    console.error("❌ Error fetching plant configuration:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// GET /plants — list all plants (replaces MOCK_PLANTS in frontend)
app.get("/make-server/plants", async (c) => {
  try {
    const user = c.get('user');
    const supabase = db.getSupabaseClient();

    let query = supabase
      .from('plants')
      .select('*')
      .order('name');

    // plant_manager only sees assigned plants; operations/admin/super_admin have global access.
    if (!canAccessAllPlants(user)) {
      const assignedPlants = Array.isArray(user.assigned_plants) ? user.assigned_plants : [];
      if (assignedPlants.length === 0) {
        console.log(`✅ [GET /plants] Returned 0 plants for ${user.email} (${user.role}) - no assignments`);
        return c.json({ success: true, data: [] });
      }
      query = query.in('id', assignedPlants);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Fetch silos and cajones from configuration tables (source of truth)
    const [{ data: allSilos }, { data: allCajones }, { data: allAggregates }] = await Promise.all([
      supabase
        .from('plant_silos_config')
        .select('plant_id, id, silo_name, is_active, sort_order')
        .order('sort_order', { ascending: true }),
      supabase
        .from('plant_cajones_config')
        .select('plant_id, id, cajon_name, material, procedencia, box_width_ft, box_height_ft, is_active, sort_order')
        .order('sort_order', { ascending: true }),
      supabase
        .from('plant_aggregates_config')
        .select('plant_id, measurement_method, is_active'),
    ]);

    // Merge: replace legacy JSONB fields with normalized configuration tables
    const plantsWithSilos = (data ?? []).map((plant: any) => {
      const plantSilos = (allSilos ?? []).filter((s: any) => s.plant_id === plant.id && s.is_active !== false);
      const plantCajones = (allCajones ?? [])
        .filter((c: any) => c.plant_id === plant.id && c.is_active !== false)
        .map((c: any) => ({
          id: c.id,
          name: c.cajon_name,
          material: c.material ?? '',
          procedencia: c.procedencia ?? '',
          ancho: Number(c.box_width_ft ?? 0),
          alto: Number(c.box_height_ft ?? 0),
        }));
      const plantConesCount = (allAggregates ?? []).filter(
        (a: any) => a.plant_id === plant.id && a.is_active !== false && a.measurement_method === 'CONE'
      ).length;

      return {
        ...plant,
        silos: plantSilos,
        cajones: plantCajones,
        cones_count: plantConesCount,
      };
    });

    console.log(`✅ [GET /plants] Returned ${plantsWithSilos.length} plants for ${user.email} (${user.role})`);
    return c.json({ success: true, data: plantsWithSilos });
  } catch (error) {
    console.error("❌ Error fetching plants:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// PUT /plants/:plantId — update plant metadata (admin/super_admin only)
app.put("/make-server/plants/:plantId", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden: admin role required' }, 403);
    }

    const plantId = c.req.param('plantId');
    const body = await c.req.json();
    const supabase = db.getSupabaseClient();

    // Only allow safe fields to be updated
    const allowed = ['name', 'location', 'petty_cash_established',
                     'has_cone_measurement', 'has_cajon_measurement', 'is_active'];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }
    update['updated_at'] = new Date().toISOString();

    const { data, error } = await supabase
      .from('plants')
      .update(update)
      .eq('id', plantId)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ [PUT /plants/${plantId}] Updated by ${user.email}`);
    return c.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error updating plant:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============================================================================
// SILO CONFIGURATION ENDPOINTS
// ============================================================================

// GET /plants/:plantId/cajones — list cajones for a plant (admin/super_admin only)
app.get("/make-server/plants/:plantId/cajones", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const { plantId } = c.req.param();
    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('plant_cajones_config')
      .select('id, cajon_name, material, procedencia, box_width_ft, box_height_ft, is_active, sort_order')
      .eq('plant_id', plantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return c.json({
      success: true,
      data: (data ?? []).map((cajon: any) => ({
        id: cajon.id,
        name: cajon.cajon_name,
        material: cajon.material ?? '',
        procedencia: cajon.procedencia ?? '',
        ancho: Number(cajon.box_width_ft ?? 0),
        alto: Number(cajon.box_height_ft ?? 0),
      })),
    });
  } catch (error: any) {
    console.error("❌ Error fetching cajones:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// PUT /plants/:plantId/cajones — replace all cajones for a plant (admin/super_admin only)
app.put("/make-server/plants/:plantId/cajones", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const { plantId } = c.req.param();
    const body = await c.req.json();
    const cajones: {
      id?: string;
      name: string;
      material?: string;
      procedencia?: string;
      ancho?: number;
      alto?: number;
      sort_order?: number;
      is_active?: boolean;
    }[] = body.cajones ?? [];

    const supabase = db.getSupabaseClient();

    const { error: delError } = await supabase
      .from('plant_cajones_config')
      .delete()
      .eq('plant_id', plantId);
    if (delError) throw delError;

    if (cajones.length > 0) {
      const rows = cajones.map((cajon, i) => ({
        plant_id: plantId,
        cajon_name: cajon.name,
        material: cajon.material ?? '',
        procedencia: cajon.procedencia ?? '',
        box_width_ft: cajon.ancho ?? 0,
        box_height_ft: cajon.alto ?? 0,
        sort_order: cajon.sort_order ?? i,
        is_active: cajon.is_active ?? true,
      }));
      const { error: insError } = await supabase
        .from('plant_cajones_config')
        .insert(rows);
      if (insError) throw insError;
    }

    console.log(`✅ [PUT /plants/${plantId}/cajones] Saved ${cajones.length} cajones by ${user.email}`);
    return c.json({ success: true, count: cajones.length });
  } catch (error: any) {
    console.error("❌ Error saving cajones:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// GET /plants/:plantId/aggregates — list aggregates for a plant (admin/super_admin only)
app.get("/make-server/plants/:plantId/aggregates", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const { plantId } = c.req.param();
    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('plant_aggregates_config')
      .select(`
        id,
        aggregate_name,
        material_type,
        location_area,
        measurement_method,
        unit,
        box_width_ft,
        box_height_ft,
        is_active,
        sort_order
      `)
      .eq('plant_id', plantId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return c.json({ success: true, data: data ?? [] });
  } catch (error: any) {
    console.error("❌ Error fetching aggregates config:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// PUT /plants/:plantId/aggregates — replace all aggregates for a plant (admin/super_admin only)
app.put("/make-server/plants/:plantId/aggregates", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const { plantId } = c.req.param();
    const body = await c.req.json();
    const aggregates: {
      id?: string;
      aggregate_name: string;
      material_type?: string;
      location_area?: string;
      measurement_method: string;
      unit?: string;
      box_width_ft?: number | null;
      box_height_ft?: number | null;
      sort_order?: number;
      is_active?: boolean;
    }[] = body.aggregates ?? [];

    for (const [index, aggregate] of aggregates.entries()) {
      const measurementMethod = String(aggregate.measurement_method || 'BOX').toUpperCase();
      if (measurementMethod !== 'BOX') continue;

      const width = aggregate.box_width_ft;
      const height = aggregate.box_height_ft;
      const label = String(aggregate.aggregate_name || '').trim() || `Fila ${index + 1}`;

      if (typeof width !== 'number' || Number.isNaN(width) || width <= 0) {
        return c.json({ success: false, error: `${label}: el ancho del cajon debe ser mayor que cero.` }, 400);
      }

      if (typeof height !== 'number' || Number.isNaN(height) || height <= 0) {
        return c.json({ success: false, error: `${label}: el alto del cajon debe ser mayor que cero.` }, 400);
      }
    }

    const supabase = db.getSupabaseClient();

    const { error: deleteError } = await supabase
      .from('plant_aggregates_config')
      .delete()
      .eq('plant_id', plantId);
    if (deleteError) throw deleteError;

    if (aggregates.length > 0) {
      const rows = aggregates.map((aggregate, index) => {
        const measurementMethod = String(aggregate.measurement_method || 'BOX').toUpperCase();
        const isBoxMethod = measurementMethod === 'BOX';

        return {
          ...(aggregate.id ? { id: aggregate.id } : {}),
          plant_id: plantId,
          aggregate_name: aggregate.aggregate_name,
          material_type: aggregate.material_type ?? '',
          location_area: aggregate.location_area ?? '',
          measurement_method: isBoxMethod ? 'BOX' : 'CONE',
          unit: aggregate.unit || 'CUBIC_YARDS',
          box_width_ft: isBoxMethod ? (aggregate.box_width_ft ?? 0) : null,
          box_height_ft: isBoxMethod ? (aggregate.box_height_ft ?? 0) : null,
          sort_order: aggregate.sort_order ?? index,
          is_active: aggregate.is_active ?? true,
        };
      });

      const { error: insertError } = await supabase
        .from('plant_aggregates_config')
        .insert(rows);
      if (insertError) throw insertError;
    }

    console.log(`✅ [PUT /plants/${plantId}/aggregates] Saved ${aggregates.length} aggregates by ${user.email}`);
    return c.json({ success: true, count: aggregates.length });
  } catch (error: any) {
    console.error("❌ Error saving aggregates config:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// GET /plants/:plantId/silos — list silos for a plant (admin/super_admin only)
app.get("/make-server/plants/:plantId/silos", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const { plantId } = c.req.param();
    const supabase = db.getSupabaseClient();
    const [{ data, error }, { data: allowedProducts, error: allowedProductsError }] = await Promise.all([
      supabase
      .from('plant_silos_config')
      .select('id, silo_name, measurement_method, is_active, sort_order')
      .eq('plant_id', plantId)
      .order('sort_order', { ascending: true }),
      supabase
        .from('silo_allowed_products')
        .select('silo_config_id, product_name'),
    ]);
    if (error) throw error;
    if (allowedProductsError) throw allowedProductsError;

    const allowedProductsBySiloId = (allowedProducts ?? []).reduce((acc: Record<string, string[]>, row: any) => {
      if (!row?.silo_config_id || !row?.product_name) return acc;
      if (!acc[row.silo_config_id]) acc[row.silo_config_id] = [];
      acc[row.silo_config_id].push(row.product_name);
      return acc;
    }, {});

    const silos = (data ?? []).map((silo: any) => ({
      ...silo,
      allowed_products: allowedProductsBySiloId[silo.id] || [],
    }));
    return c.json({ success: true, data: silos });
  } catch (error: any) {
    console.error("❌ Error fetching silos:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// GET /plants/:plantId/additives — list additives for a plant (admin/super_admin only)
app.get("/make-server/plants/:plantId/additives", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const { plantId } = c.req.param();
    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('plant_additives_config')
      .select(`
        id,
        catalog_additive_id,
        additive_name,
        additive_type,
        measurement_method,
        calibration_curve_name,
        brand,
        uom,
        requires_photo,
        tank_name,
        reading_uom,
        conversion_table,
        is_active,
        sort_order
      `)
      .eq('plant_id', plantId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return c.json({ success: true, data: data ?? [] });
  } catch (error: any) {
    console.error("❌ Error fetching additives:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// PUT /plants/:plantId/additives — replace all additives for a plant (admin/super_admin only)
app.put("/make-server/plants/:plantId/additives", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const { plantId } = c.req.param();
    const body = await c.req.json();
    const additives: {
      id?: string;
      catalog_additive_id?: string | null;
      additive_name: string;
      additive_type: string;
      measurement_method?: string;
      calibration_curve_name?: string | null;
      brand?: string;
      uom?: string;
      requires_photo?: boolean;
      tank_name?: string | null;
      reading_uom?: string | null;
      conversion_table?: Record<string, number> | null;
      sort_order?: number;
      is_active?: boolean;
    }[] = body.additives ?? [];

    const supabase = db.getSupabaseClient();

    const { error: delError } = await supabase
      .from('plant_additives_config')
      .delete()
      .eq('plant_id', plantId);
    if (delError) throw delError;

    if (additives.length > 0) {
      const rows = additives.map((additive, index) => ({
        ...(additive.id ? { id: additive.id } : {}),
        plant_id: plantId,
        catalog_additive_id: additive.catalog_additive_id || null,
        additive_name: additive.additive_name,
        additive_type: String(additive.additive_type || 'MANUAL').toUpperCase(),
        measurement_method: additive.measurement_method || (String(additive.additive_type || '').toUpperCase() === 'TANK' ? 'TANK_LEVEL' : 'MANUAL_QUANTITY'),
        calibration_curve_name: additive.calibration_curve_name || null,
        brand: additive.brand || '',
        uom: additive.uom || '',
        requires_photo: additive.requires_photo ?? false,
        tank_name: additive.tank_name || null,
        reading_uom: additive.reading_uom || null,
        conversion_table: additive.conversion_table || null,
        sort_order: additive.sort_order ?? index,
        is_active: additive.is_active ?? true,
      }));

      const { error: insError } = await supabase
        .from('plant_additives_config')
        .insert(rows);
      if (insError) throw insError;
    }

    console.log(`✅ [PUT /plants/${plantId}/additives] Saved ${additives.length} additives by ${user.email}`);
    return c.json({ success: true, count: additives.length });
  } catch (error: any) {
    console.error("❌ Error saving additives:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// GET /plants/:plantId/diesel — fetch diesel config for a plant (admin/super_admin only)
app.get("/make-server/plants/:plantId/diesel", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const { plantId } = c.req.param();
    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('plant_diesel_config')
      .select(`
        id,
        measurement_method,
        calibration_curve_name,
        reading_uom,
        tank_capacity_gallons,
        initial_inventory_gallons,
        calibration_table,
        is_active
      `)
      .eq('plant_id', plantId)
      .maybeSingle();

    if (error) throw error;
    return c.json({ success: true, data: data ?? null });
  } catch (error: any) {
    console.error("❌ Error fetching diesel config:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// PUT /plants/:plantId/diesel — replace diesel config for a plant (admin/super_admin only)
app.put("/make-server/plants/:plantId/diesel", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const { plantId } = c.req.param();
    const body = await c.req.json();
    const diesel = body.diesel;
    const supabase = db.getSupabaseClient();

    const { error: deleteError } = await supabase
      .from('plant_diesel_config')
      .delete()
      .eq('plant_id', plantId);
    if (deleteError) throw deleteError;

    if (diesel) {
      const row = {
        ...(diesel.id ? { id: diesel.id } : {}),
        plant_id: plantId,
        measurement_method: diesel.measurement_method || 'TANK_LEVEL',
        calibration_curve_name: diesel.calibration_curve_name || null,
        reading_uom: diesel.reading_uom || 'inches',
        tank_capacity_gallons: diesel.tank_capacity_gallons ?? 0,
        initial_inventory_gallons: diesel.initial_inventory_gallons ?? 0,
        calibration_table: diesel.calibration_table || null,
        is_active: diesel.is_active ?? true,
      };

      const { error: insertError } = await supabase
        .from('plant_diesel_config')
        .insert(row);
      if (insertError) throw insertError;
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error("❌ Error saving diesel config:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// GET /plants/:plantId/products — list product configs for a plant (admin/super_admin only)
app.get("/make-server/plants/:plantId/products", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const { plantId } = c.req.param();
    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('plant_products_config')
      .select(`
        id,
        product_name,
        unit,
        category,
        measure_mode,
        requires_photo,
        reading_uom,
        calibration_table,
        tank_capacity,
        unit_volume,
        notes,
        is_active,
        sort_order
      `)
      .eq('plant_id', plantId)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    const normalized = (data ?? []).map((entry: any) => ({
      ...entry,
      uom: entry.unit,
    }));

    return c.json({ success: true, data: normalized });
  } catch (error: any) {
    console.error("❌ Error fetching product configs:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// PUT /plants/:plantId/products — replace product configs for a plant (admin/super_admin only)
app.put("/make-server/plants/:plantId/products", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const { plantId } = c.req.param();
    const body = await c.req.json();
    const products = body.products ?? [];
    const supabase = db.getSupabaseClient();

    const { error: deleteError } = await supabase
      .from('plant_products_config')
      .delete()
      .eq('plant_id', plantId);
    if (deleteError) throw deleteError;

    if (products.length > 0) {
      const rows = products.map((product: any, index: number) => ({
        ...(product.id ? { id: product.id } : {}),
        plant_id: plantId,
        product_name: product.product_name,
        unit: product.uom || product.unit || '',
        category: product.category || 'OTHER',
        measure_mode: product.measure_mode || 'COUNT',
        requires_photo: product.requires_photo ?? false,
        reading_uom: product.reading_uom || null,
        calibration_table: product.calibration_table || null,
        tank_capacity: product.tank_capacity ?? null,
        unit_volume: product.unit_volume ?? null,
        notes: product.notes || '',
        sort_order: product.sort_order ?? index,
        is_active: product.is_active ?? true,
      }));

      const { error: insertError } = await supabase
        .from('plant_products_config')
        .insert(rows);
      if (insertError) throw insertError;
    }

    return c.json({ success: true, count: products.length });
  } catch (error: any) {
    console.error("❌ Error saving product configs:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.post("/make-server/plants/:plantId/config-import/products/preview", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const { plantId } = c.req.param();
    const body = await c.req.json();
    const supabase = db.getSupabaseClient();
    const preview = await db.previewProductsImport(plantId, body);
    let previewToken: string | null = null;

    if (preview.summary.valid_rows > 0 && preview.errors.length === 0) {
      const record = await db.createProductsImportPreviewToken(plantId, body);
      previewToken = record.token;
    }

    await createAuditEntry(supabase, {
      user_email: user.email,
      user_name: user.name,
      user_id: user.id,
      action: 'PRODUCTS_IMPORT_PREVIEWED',
      plant_id: plantId,
      details: {
        import_mode: preview.import_mode,
        template_version: preview.template_version,
        summary: preview.summary,
        warnings: preview.warnings,
        error_count: preview.errors.length,
      },
    });

    return c.json({
      success: true,
      data: {
        ...preview,
        preview_token: previewToken,
      },
    });
  } catch (error: any) {
    console.error('❌ Error previewing products import:', error);
    return c.json({ success: false, error: error.message }, 400);
  }
});

app.post("/make-server/plants/:plantId/config-import/products/execute", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const { plantId } = c.req.param();
    const body = await c.req.json();
    const supabase = db.getSupabaseClient();
    const {
      preview_token,
      reason,
      ...payload
    } = body || {};

    if (typeof reason !== 'string' || reason.trim().length < 10) {
      return c.json({ success: false, error: 'Debes ingresar un motivo de al menos 10 caracteres.' }, 400);
    }

    const validation = await db.validateProductsImportPreviewToken(plantId, preview_token, payload);
    if (!validation.valid) {
      return c.json({ success: false, error: validation.error }, 400);
    }

    const result = await db.executeProductsImport(plantId, payload);
    if (result.errors.length > 0) {
      return c.json({ success: false, error: 'La importacion tiene errores y no puede ejecutarse.' }, 400);
    }

    const auditActionId = await createAuditEntry(supabase, {
      user_email: user.email,
      user_name: user.name,
      user_id: user.id,
      action: 'PRODUCTS_IMPORTED_FROM_TEMPLATE',
      plant_id: plantId,
      details: {
        import_mode: result.import_mode,
        template_version: result.template_version,
        summary: result.summary,
        created: result.result.created,
        updated: result.result.updated,
        warnings: result.warnings,
        reason: reason.trim(),
      },
    });

    await db.consumeProductsImportPreviewToken(preview_token);

    return c.json({
      success: true,
      data: {
        plant: result.plant,
        summary: result.summary,
        created: result.result.created,
        updated: result.result.updated,
        warnings: result.warnings,
        audit_action_id: auditActionId,
      },
    });
  } catch (error: any) {
    console.error('❌ Error executing products import:', error);
    return c.json({ success: false, error: error.message }, 400);
  }
});

app.post("/make-server/plants/:plantId/config-import/aggregates/preview", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const { plantId } = c.req.param();
    const body = await c.req.json();
    const supabase = db.getSupabaseClient();
    const preview = await db.previewAggregatesImport(plantId, body);
    let previewToken: string | null = null;

    if (preview.summary.valid_rows > 0 && preview.errors.length === 0) {
      const record = await db.createAggregatesImportPreviewToken(plantId, body);
      previewToken = record.token;
    }

    await createAuditEntry(supabase, {
      user_email: user.email,
      user_name: user.name,
      user_id: user.id,
      action: 'AGGREGATES_IMPORT_PREVIEWED',
      plant_id: plantId,
      details: {
        import_mode: preview.import_mode,
        template_version: preview.template_version,
        summary: preview.summary,
        warnings: preview.warnings,
        error_count: preview.errors.length,
      },
    });

    return c.json({
      success: true,
      data: {
        ...preview,
        preview_token: previewToken,
      },
    });
  } catch (error: any) {
    console.error('❌ Error previewing aggregates import:', error);
    return c.json({ success: false, error: error.message }, 400);
  }
});

app.post("/make-server/plants/:plantId/config-import/aggregates/execute", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const { plantId } = c.req.param();
    const body = await c.req.json();
    const supabase = db.getSupabaseClient();
    const {
      preview_token,
      reason,
      ...payload
    } = body || {};

    if (typeof reason !== 'string' || reason.trim().length < 10) {
      return c.json({ success: false, error: 'Debes ingresar un motivo de al menos 10 caracteres.' }, 400);
    }

    const validation = await db.validateAggregatesImportPreviewToken(plantId, preview_token, payload);
    if (!validation.valid) {
      return c.json({ success: false, error: validation.error }, 400);
    }

    const result = await db.executeAggregatesImport(plantId, payload);
    if (result.errors.length > 0) {
      return c.json({ success: false, error: 'La importacion tiene errores y no puede ejecutarse.' }, 400);
    }

    const auditActionId = await createAuditEntry(supabase, {
      user_email: user.email,
      user_name: user.name,
      user_id: user.id,
      action: 'AGGREGATES_IMPORTED_FROM_TEMPLATE',
      plant_id: plantId,
      details: {
        import_mode: result.import_mode,
        template_version: result.template_version,
        summary: result.summary,
        created: result.result.created,
        updated: result.result.updated,
        legacy_cajones_cleared: result.result.legacy_cajones_cleared,
        warnings: result.warnings,
        reason: reason.trim(),
      },
    });

    await db.consumeAggregatesImportPreviewToken(preview_token);

    return c.json({
      success: true,
      data: {
        plant: result.plant,
        summary: result.summary,
        created: result.result.created,
        updated: result.result.updated,
        legacy_cajones_cleared: result.result.legacy_cajones_cleared,
        warnings: result.warnings,
        audit_action_id: auditActionId,
      },
    });
  } catch (error: any) {
    console.error('❌ Error executing aggregates import:', error);
    return c.json({ success: false, error: error.message }, 400);
  }
});

// PUT /plants/:plantId/silos — replace all silos for a plant (admin/super_admin only)
app.put("/make-server/plants/:plantId/silos", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const { plantId } = c.req.param();
    const body = await c.req.json();
    const silos: {
      id?: string;
      silo_name: string;
      is_active: boolean;
      measurement_method?: string;
      allowed_products?: string[];
    }[] = body.silos ?? [];

    const supabase = db.getSupabaseClient();

    // Detect default calibration curve for this plant (SILO*)
    const { data: curves } = await supabase
      .from('calibration_curves')
      .select('curve_name')
      .eq('plant_id', plantId)
      .ilike('curve_name', 'SILO%')
      .limit(1);
    const defaultCurve = curves?.[0]?.curve_name ?? null;

    const { data: existingSilos, error: existingSilosError } = await supabase
      .from('plant_silos_config')
      .select('id')
      .eq('plant_id', plantId);
    if (existingSilosError) throw existingSilosError;

    const existingSiloIds = (existingSilos ?? []).map((silo: any) => silo.id);

    if (existingSiloIds.length > 0) {
      const { error: deleteAllowedProductsError } = await supabase
        .from('silo_allowed_products')
        .delete()
        .in('silo_config_id', existingSiloIds);
      if (deleteAllowedProductsError) throw deleteAllowedProductsError;
    }

    const { error: delError } = await supabase
      .from('plant_silos_config')
      .delete()
      .eq('plant_id', plantId);
    if (delError) throw delError;

    // Insert new silos if any
    if (silos.length > 0) {
      const rows = silos.map((s, i) => ({
        ...(s.id ? { id: s.id } : {}),
        plant_id: plantId,
        silo_name: s.silo_name,
        measurement_method: s.measurement_method || 'FEET_TO_CUBIC_YARDS',
        calibration_curve_name: defaultCurve,
        sort_order: i,
        is_active: s.is_active ?? true,
      }));
      const { data: insertedSilos, error: insError } = await supabase
        .from('plant_silos_config')
        .insert(rows)
        .select('id, silo_name');
      if (insError) throw insError;

      const insertedSilosByName = new Map(
        (insertedSilos ?? []).map((silo: any) => [silo.silo_name, silo.id])
      );
      const allowedProductsRows = silos.flatMap((silo) =>
        (silo.allowed_products || [])
          .map((productName) => productName?.trim())
          .filter(Boolean)
          .map((product_name) => ({
            silo_config_id: insertedSilosByName.get(silo.silo_name),
            product_name,
          }))
          .filter((row) => row.silo_config_id)
      );

      if (allowedProductsRows.length > 0) {
        const { error: insertAllowedProductsError } = await supabase
          .from('silo_allowed_products')
          .insert(allowedProductsRows);
        if (insertAllowedProductsError) throw insertAllowedProductsError;
      }
    }

    console.log(`✅ [PUT /plants/${plantId}/silos] Saved ${silos.length} silos by ${user.email}`);
    return c.json({ success: true, count: silos.length });
  } catch (error: any) {
    console.error("❌ Error saving silos:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============================================================================
// INVENTORY MONTH ENDPOINTS
// ============================================================================

// Get or create inventory month
app.post("/make-server/inventory/month", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const user = c.get('user');
    const body = await c.req.json();
    const { plant_id, year_month, created_by } = body;
    const effectiveCreatedBy = user?.name || user?.email || created_by;

    if (!plant_id || !year_month || !effectiveCreatedBy) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }

    // Check if it already exists before creating
    const { data: existing } = await supabase
      .from('inventory_month')
      .select('id')
      .eq('plant_id', plant_id)
      .eq('year_month', year_month)
      .single();

    const inventoryMonth = await db.getOrCreateInventoryMonth(plant_id, year_month, effectiveCreatedBy);

    // Audit: only log when a NEW inventory month is created
    if (!existing) {
      logAudit(supabase, {
        user_email: user.email,
        user_name: user.name,
        user_id: user.id,
        action: 'INVENTORY_STARTED',
        plant_id: plant_id,
        inventory_month_id: inventoryMonth.id,
        details: { year_month, created_by: effectiveCreatedBy },
      });
    }

    return c.json({ success: true, data: inventoryMonth });
  } catch (error) {
    console.error("Error creating/getting inventory month:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get full inventory month data
app.get("/make-server/inventory/month/:inventoryMonthId", async (c) => {
  try {
    const inventoryMonthId = c.req.param("inventoryMonthId");
    const data = await db.getInventoryMonthData(inventoryMonthId);
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching inventory month data:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get inventory month by plant and year_month
app.get("/make-server/inventory/month/:plantId/:yearMonth", async (c) => {
  try {
    const plantId = c.req.param("plantId");
    const yearMonth = c.req.param("yearMonth");
    const data = await db.getInventoryMonthByPlantAndDate(plantId, yearMonth);
    
    if (!data) {
      return c.json({ success: false, error: "Month not found" });
    }
    
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching inventory month by plant and date:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update inventory month status
app.put("/make-server/inventory/month/:inventoryMonthId/status", async (c) => {
  try {
    const inventoryMonthId = c.req.param("inventoryMonthId");
    const body = await c.req.json();
    const { status, user_id } = body;
    
    if (!status) {
      return c.json({ success: false, error: "Missing status" }, 400);
    }
    
    const updated = await db.updateInventoryMonthStatus(inventoryMonthId, status, user_id);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating inventory month status:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============================================================================
// PHOTO UPLOAD — compress on client, upload binary here, return public URL
// ============================================================================

app.use('/make-server/photos/*', requireAuth);

app.post('/make-server/photos/upload', async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const { base64, filename, plant_id } = await c.req.json();

    // Validate input
    if (!base64 || !base64.startsWith('data:image/')) {
      return c.json({ success: false, error: 'Datos de imagen inválidos' }, 400);
    }

    // Decode base64 → Uint8Array
    const [header, raw] = base64.split(',');
    const contentType = header.replace('data:', '').replace(';base64', '');
    const binaryStr = atob(raw);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Guard: reject oversized payloads (max 3 MB after client-side compression)
    if (bytes.length > 3 * 1024 * 1024) {
      return c.json({ success: false, error: 'Imagen demasiado grande (máx 3 MB)' }, 400);
    }

    // Build storage path: {plant_id}/{timestamp}-{safeName}.{ext}
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const safeName = (filename || 'foto').replace(/[^a-z0-9]/gi, '_').slice(0, 40);
    const folder = (plant_id || 'general').replace(/[^a-z0-9_]/gi, '_');
    const storagePath = `${folder}/${Date.now()}-${safeName}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('inventory-photos')
      .upload(storagePath, bytes, { contentType, upsert: false });

    if (uploadError) {
      console.error('[photos/upload] Storage error:', uploadError.message);
      return c.json({ success: false, error: uploadError.message }, 500);
    }

    const { data: urlData } = supabase.storage
      .from('inventory-photos')
      .getPublicUrl(uploadData.path);

    return c.json({ success: true, url: urlData.publicUrl });
  } catch (err: any) {
    console.error('[photos/upload] Unexpected error:', err.message);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ============================================================================
// SAVE INDIVIDUAL SECTION ENTRIES
// ============================================================================

// Save aggregates entries
app.post("/make-server/inventory/aggregates", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, entries } = body;

    if (!inventory_month_id || !entries) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    // Delete existing entries for this inventory month
    await supabase.from('inventory_aggregates_entries').delete().eq('inventory_month_id', inventory_month_id);

    // Whitelist only DB columns (strips frontend-only fields like _isNew, etc.)
    const dbEntries = entries.map((e: any) => ({
      ...(e.id ? { id: e.id } : {}),
      inventory_month_id: e.inventory_month_id,
      aggregate_config_id: e.aggregate_config_id,
      aggregate_name: e.aggregate_name,
      material_type: e.material_type,
      location_area: e.location_area,
      measurement_method: e.measurement_method,
      unit: e.unit,
      box_width_ft: e.box_width_ft,
      box_height_ft: e.box_height_ft,
      box_length_ft: e.box_length_ft,
      calculated_volume_cy: e.calculated_volume_cy,
      cone_m1: e.cone_m1,
      cone_m2: e.cone_m2,
      cone_m3: e.cone_m3,
      cone_m4: e.cone_m4,
      cone_m5: e.cone_m5,
      cone_m6: e.cone_m6,
      cone_d1: e.cone_d1,
      cone_d2: e.cone_d2,
      photo_url: e.photo_url,
      notes: e.notes,
    }));

    // Insert new entries
    const { data, error } = await supabase.from('inventory_aggregates_entries').insert(dbEntries).select();

    if (error) throw error;
    logAudit(supabase, { user_email: c.get('user').email, user_name: c.get('user').name, user_id: c.get('user').id, action: 'SECTION_SAVED', inventory_month_id, details: { section: 'aggregates' } });
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error saving aggregates entries:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Save silos entries
app.post("/make-server/inventory/silos", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, entries } = body;

    if (!inventory_month_id || !entries) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }

    await supabase.from('inventory_silos_entries').delete().eq('inventory_month_id', inventory_month_id);
    const dbEntries = entries.map((e: any) => ({
      ...(e.id ? { id: e.id } : {}),
      inventory_month_id: e.inventory_month_id,
      silo_config_id: e.silo_config_id,
      silo_name: e.silo_name,
      measurement_method: e.measurement_method,
      allowed_products: e.allowed_products,
      product_id: e.product_id,
      product_name: e.product_name,
      product_in_silo: e.product_in_silo,
      reading_value: e.reading_value,
      reading: e.reading,
      previous_reading: e.previous_reading,
      calculated_result_cy: e.calculated_result_cy,
      calculated_volume: e.calculated_volume,
      photo_url: e.photo_url,
      notes: e.notes,
    }));
    const { data, error } = await supabase.from('inventory_silos_entries').insert(dbEntries).select();

    if (error) throw error;
    logAudit(supabase, { user_email: c.get('user').email, user_name: c.get('user').name, user_id: c.get('user').id, action: 'SECTION_SAVED', inventory_month_id, details: { section: 'silos' } });
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error saving silos entries:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Save additives entries
app.post("/make-server/inventory/additives", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, entries } = body;

    if (!inventory_month_id || !entries) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }

    await supabase.from('inventory_additives_entries').delete().eq('inventory_month_id', inventory_month_id);
    const dbEntries = entries.map((e: any) => ({
      ...(e.id ? { id: e.id } : {}),
      inventory_month_id: e.inventory_month_id,
      additive_config_id: e.additive_config_id,
      additive_type: e.additive_type,
      product_name: e.product_name,
      brand: e.brand,
      uom: e.uom,
      requires_photo: e.requires_photo,
      tank_name: e.tank_name,
      reading_uom: e.reading_uom,
      reading_value: e.reading_value,
      reading: e.reading,
      calculated_volume: e.calculated_volume,
      calculated_gallons: e.calculated_gallons,
      conversion_table: e.conversion_table,
      quantity: e.quantity,
      photo_url: e.photo_url,
      notes: e.notes,
    }));
    const { data, error } = await supabase.from('inventory_additives_entries').insert(dbEntries).select();

    if (error) throw error;
    logAudit(supabase, { user_email: c.get('user').email, user_name: c.get('user').name, user_id: c.get('user').id, action: 'SECTION_SAVED', inventory_month_id, details: { section: 'additives' } });
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error saving additives entries:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Save diesel entry
app.post("/make-server/inventory/diesel", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, entry } = body;

    if (!inventory_month_id || !entry) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }

    await supabase.from('inventory_diesel_entries').delete().eq('inventory_month_id', inventory_month_id);
    const { data, error } = await supabase.from('inventory_diesel_entries').insert(entry).select().single();

    if (error) throw error;
    logAudit(supabase, { user_email: c.get('user').email, user_name: c.get('user').name, user_id: c.get('user').id, action: 'SECTION_SAVED', inventory_month_id, details: { section: 'diesel' } });
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error saving diesel entry:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Save products entries
app.post("/make-server/inventory/products", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, entries } = body;

    if (!inventory_month_id || !entries) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }

    await supabase.from('inventory_products_entries').delete().eq('inventory_month_id', inventory_month_id);
    const { data, error } = await supabase.from('inventory_products_entries').insert(entries).select();

    if (error) throw error;
    logAudit(supabase, { user_email: c.get('user').email, user_name: c.get('user').name, user_id: c.get('user').id, action: 'SECTION_SAVED', inventory_month_id, details: { section: 'products' } });
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error saving products entries:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Save utilities entries
app.post("/make-server/inventory/utilities", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, entries } = body;

    if (!inventory_month_id || !entries) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    await supabase.from('inventory_utilities_entries').delete().eq('inventory_month_id', inventory_month_id);
    const { data, error } = await supabase.from('inventory_utilities_entries').insert(entries).select();

    if (error) throw error;
    logAudit(supabase, { user_email: c.get('user').email, user_name: c.get('user').name, user_id: c.get('user').id, action: 'SECTION_SAVED', inventory_month_id, details: { section: 'utilities' } });
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error saving utilities entries:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Save petty cash entry
app.post("/make-server/inventory/petty-cash", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, entry } = body;
    
    if (!inventory_month_id || !entry) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    await supabase.from('inventory_petty_cash_entries').delete().eq('inventory_month_id', inventory_month_id);
    const { data, error } = await supabase.from('inventory_petty_cash_entries').insert(entry).select().single();

    if (error) throw error;
    logAudit(supabase, { user_email: c.get('user').email, user_name: c.get('user').name, user_id: c.get('user').id, action: 'SECTION_SAVED', inventory_month_id, details: { section: 'petty-cash' } });
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error saving petty cash entry:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============================================================================
// INVENTORY SUBMISSION AND APPROVAL ENDPOINTS
// ============================================================================

// Save inventory as draft (keeps IN_PROGRESS status)
app.post("/make-server/inventory/save-draft", async (c) => {
  try {
    const user = c.get('user');
    if (!isPlantManagerLike(user)) {
      return c.json({ success: false, error: 'Forbidden: Operational user access required' }, 403);
    }

    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id } = body;
    
    if (!inventory_month_id) {
      return c.json({ success: false, error: "Missing inventory_month_id" }, 400);
    }

    const { data: inventoryMonth, error: fetchError } = await supabase
      .from('inventory_month')
      .select('id, plant_id')
      .eq('id', inventory_month_id)
      .single();

    if (fetchError || !inventoryMonth) {
      return c.json({ success: false, error: 'Inventory month not found' }, 404);
    }

    if (!checkPlantAccess(user, inventoryMonth.plant_id)) {
      return c.json({ success: false, error: 'Forbidden: No access to this plant' }, 403);
    }
    
    // Just update the updated_at timestamp
    const { data, error } = await supabase
      .from('inventory_month')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', inventory_month_id)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log(`[DRAFT] Inventory ${inventory_month_id} saved as draft`);
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error saving draft:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Submit inventory for approval (IN_PROGRESS -> SUBMITTED)
app.post("/make-server/inventory/submit", async (c) => {
  try {
    const user = c.get('user');
    if (!isPlantManagerLike(user)) {
      return c.json({ success: false, error: 'Forbidden: Operational user access required' }, 403);
    }

    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, submitted_by } = body;
    
    if (!inventory_month_id || !submitted_by) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    // Get current inventory month
    const { data: currentMonth, error: fetchError } = await supabase
      .from('inventory_month')
      .select('*')
      .eq('id', inventory_month_id)
      .single();
    
    if (fetchError) throw fetchError;

    if (!checkPlantAccess(user, currentMonth.plant_id)) {
      return c.json({ success: false, error: 'Forbidden: No access to this plant' }, 403);
    }
    
    // Validate current status
    if (currentMonth.status !== 'IN_PROGRESS') {
      return c.json({ 
        success: false, 
        error: `Cannot submit inventory with status ${currentMonth.status}. Only IN_PROGRESS inventories can be submitted.` 
      }, 400);
    }
    
    // Update status to SUBMITTED
    const { data, error } = await supabase
      .from('inventory_month')
      .update({ 
        status: 'SUBMITTED',
        submitted_by: submitted_by,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', inventory_month_id)
      .select()
      .single();
    
    if (error) throw error;

    console.log(`[SUBMIT] Inventory ${inventory_month_id} submitted for approval by ${submitted_by}`);

    // Audit log
    logAudit(supabase, {
      user_email: user.email,
      user_name: user.name,
      user_id: user.id,
      action: 'INVENTORY_SUBMITTED',
      plant_id: currentMonth.plant_id,
      inventory_month_id: inventory_month_id,
      details: { year_month: currentMonth.year_month },
    });

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error submitting inventory:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Approve inventory (SUBMITTED -> APPROVED)
app.post("/make-server/inventory/approve", async (c) => {
  try {
    const user = c.get('user');  // set by requireAuth middleware
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return c.json({ success: false, error: 'Forbidden: Admin access required' }, 403);
    }

    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, approved_by, notes } = body;

    if (!inventory_month_id || !approved_by) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    // Get current inventory month
    const { data: currentMonth, error: fetchError } = await supabase
      .from('inventory_month')
      .select('*')
      .eq('id', inventory_month_id)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Validate current status
    if (currentMonth.status !== 'SUBMITTED') {
      return c.json({ 
        success: false, 
        error: `Cannot approve inventory with status ${currentMonth.status}. Only SUBMITTED inventories can be approved.` 
      }, 400);
    }
    
    // Update status to APPROVED
    const updateData: any = {
      status: 'APPROVED',
      approved_by: approved_by,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    if (notes) {
      updateData.approval_notes = notes;
    }
    
    const { data, error } = await supabase
      .from('inventory_month')
      .update(updateData)
      .eq('id', inventory_month_id)
      .select()
      .single();
    
    if (error) throw error;

    console.log(`[APPROVE] Inventory ${inventory_month_id} approved by ${approved_by}`);

    // Audit log
    logAudit(supabase, {
      user_email: user.email,
      user_name: user.name,
      user_id: user.id,
      action: 'INVENTORY_APPROVED',
      plant_id: currentMonth.plant_id,
      inventory_month_id: inventory_month_id,
      details: { year_month: currentMonth.year_month, notes: notes ?? null },
    });

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error approving inventory:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Reject inventory (SUBMITTED -> IN_PROGRESS)
app.post("/make-server/inventory/reject", async (c) => {
  try {
    const user = c.get('user');  // set by requireAuth middleware
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return c.json({ success: false, error: 'Forbidden: Admin access required' }, 403);
    }

    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, rejected_by, rejection_notes } = body;

    if (!inventory_month_id || !rejected_by || !rejection_notes) {
      return c.json({ success: false, error: "Missing required fields (inventory_month_id, rejected_by, rejection_notes)" }, 400);
    }
    
    // Get current inventory month
    const { data: currentMonth, error: fetchError } = await supabase
      .from('inventory_month')
      .select('*')
      .eq('id', inventory_month_id)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Validate current status
    if (currentMonth.status !== 'SUBMITTED') {
      return c.json({ 
        success: false, 
        error: `Cannot reject inventory with status ${currentMonth.status}. Only SUBMITTED inventories can be rejected.` 
      }, 400);
    }
    
    // Update status back to IN_PROGRESS
    const { data, error } = await supabase
      .from('inventory_month')
      .update({ 
        status: 'IN_PROGRESS',
        rejected_by: rejected_by,
        rejected_at: new Date().toISOString(),
        rejection_notes: rejection_notes,
        // Clear submission data
        submitted_by: null,
        submitted_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', inventory_month_id)
      .select()
      .single();
    
    if (error) throw error;

    console.log(`[REJECT] Inventory ${inventory_month_id} rejected by ${rejected_by}. Reason: ${rejection_notes}`);

    // Audit log
    logAudit(supabase, {
      user_email: user.email,
      user_name: user.name,
      user_id: user.id,
      action: 'INVENTORY_REJECTED',
      plant_id: currentMonth.plant_id,
      inventory_month_id: inventory_month_id,
      details: { year_month: currentMonth.year_month, reason: rejection_notes },
    });

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error rejecting inventory:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============================================================================
// MODULE CONFIGURATION ENDPOINTS
// ============================================================================

// Get module configuration
app.get("/make-server/modules/config", async (c) => {
  try {
    console.log('[MODULES] Fetching module configuration');
    const config = await kv.get('module_config');
    
    if (!config) {
      console.log('[MODULES] No configuration found, returning null');
      return c.json({ success: true, data: null });
    }
    
    console.log('[MODULES] Configuration loaded:', config);
    return c.json({ success: true, data: config });
  } catch (error) {
    console.error('[MODULES] Error fetching config:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update module configuration (Super Admin only)
app.post("/make-server/modules/config", async (c) => {
  try {
    const user = c.get('user');  // set by requireAuth middleware
    if (user.role !== 'super_admin') {
      return c.json({ success: false, error: 'Forbidden: Super Admin access required' }, 403);
    }

    const body = await c.req.json();

    console.log('[MODULES] Updating module configuration:', body);
    
    // Validate structure
    if (!body.modules) {
      return c.json({ success: false, error: "Missing 'modules' field" }, 400);
    }
    
    // Save to KV store
    await kv.set('module_config', body);
    
    console.log('[MODULES] Configuration updated successfully by', body.lastUpdatedBy);
    console.log('[MODULES] Enabled modules:', 
      Object.entries(body.modules)
        .filter(([_, config]: [string, any]) => config.enabled)
        .map(([key, _]) => key)
    );
    
    return c.json({ success: true, data: body });
  } catch (error) {
    console.error('[MODULES] Error updating config:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============================================================================
// AUDIT ENDPOINTS
// ============================================================================

// Inventory workflow flow — derived from existing inventory_month table
app.get("/make-server/audit/flow", async (c) => {
  try {
    const user = c.get('user');
    const supabase = db.getSupabaseClient();
    const plantIdFilter = c.req.query('plant_id');

    let query = supabase
      .from('inventory_month')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (user.role === 'plant_manager') {
      query = query.in('plant_id', user.assigned_plants as string[]);
    } else if (plantIdFilter) {
      query = query.eq('plant_id', plantIdFilter);
    }

    const { data, error } = await query;
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error('[AUDIT] Error fetching flow:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Detailed event log from audit_logs table
app.get("/make-server/audit/logs", async (c) => {
  try {
    const user = c.get('user');
    const supabase = db.getSupabaseClient();
    const plantIdFilter = c.req.query('plant_id');
    const userIdFilter = c.req.query('user_id');
    const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500);

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (user.role === 'plant_manager') {
      // Plant managers see their own plant events + their own logins
      query = query.or(
        `plant_id.in.(${(user.assigned_plants as string[]).join(',')}),and(action.eq.USER_LOGIN,user_id.eq.${user.id})`
      );
    } else {
      if (plantIdFilter) {
        query = query.eq('plant_id', plantIdFilter);
      }
      if (userIdFilter) {
        query = query.eq('user_id', userIdFilter);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    // Security rule: admins cannot see super_admin events in event logs
    let filtered = data ?? [];
    if (user.role === 'admin') {
      const { data: superAdmins, error: superAdminError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'super_admin');
      if (superAdminError) throw superAdminError;

      const superAdminIds = new Set((superAdmins ?? []).map((u: any) => u.id));
      filtered = filtered.filter((log: any) => !superAdminIds.has(log.user_id));
    }

    return c.json({ success: true, data: filtered });
  } catch (error) {
    console.error('[AUDIT] Error fetching logs:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============================================================================
// REPORTS ENDPOINT
// ============================================================================

app.get("/make-server/reports", async (c) => {
  try {
    const user = c.get('user');
    const supabase = db.getSupabaseClient();
    const { year_month, plant_id } = c.req.query();

    let query = supabase
      .from('inventory_month')
      .select(`
        id, plant_id, year_month, status,
        created_by, created_at, updated_at,
        approved_by, approved_at, notes
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    // Role-based filter
    if (user.role === 'plant_manager') {
      query = query.in('plant_id', user.assigned_plants as string[]);
    } else if (plant_id) {
      query = query.eq('plant_id', plant_id);
    }

    // Optional month filter (format: "2025-02")
    if (year_month) query = query.eq('year_month', year_month);

    const { data, error } = await query;
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error('[REPORTS] Error fetching reports:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// DELETE /reports/:id — admin/super_admin only
// Deletes the inventory month record, all child entries, and associated photos from storage
app.delete("/make-server/reports/:id", requireAdmin, async (c) => {
  try {
    const reportId = c.req.param('id');
    const user = c.get('user');
    const result = await deleteInventoryMonthCascade(reportId, {
      actor: { email: user.email, name: user.name, id: user.id },
      auditAction: 'REPORT_DELETED',
    });

    console.log(`[DELETE REPORT] Report ${reportId} deleted. Photos removed: ${result.deletedPhotos}`);
    return c.json({ success: true, deleted_photos: result.deletedPhotos, warnings: result.warnings });

  } catch (error: any) {
    console.error('[DELETE REPORT] Error:', error);
    const status = error.message === 'Reporte no encontrado' ? 404 : 500;
    return c.json({ success: false, error: error.message }, status);
  }
});

// ============================================================================
// DEBUG ENDPOINTS
// ============================================================================

// Validate JWT token
app.get("/make-server/auth/validate", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.split(" ")[1];
    
    if (!token) {
      return c.json({ success: false, error: "No token provided" }, 401);
    }
    
    // Decode JWT payload (sin verificar) para ver info
    let decodedPayload = null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = atob(parts[1]);
        decodedPayload = JSON.parse(payload);
      }
    } catch (e) {
      console.error('Error decoding JWT:', e);
    }
    
    // Verify token
    const { user, error } = await auth.verifyToken(token);
    
    if (error || !user) {
      return c.json({ 
        success: false, 
        error: error || "Invalid token",
        debugInfo: {
          tokenLength: token.length,
          tokenPrefix: token.substring(0, 20) + '...',
          decodedPayload: decodedPayload ? {
            sub: decodedPayload.sub,
            email: decodedPayload.email,
            role: decodedPayload.role,
            iat: decodedPayload.iat ? new Date(decodedPayload.iat * 1000).toISOString() : null,
            exp: decodedPayload.exp ? new Date(decodedPayload.exp * 1000).toISOString() : null,
            isExpired: decodedPayload.exp ? (Date.now() / 1000) > decodedPayload.exp : null
          } : null,
          backendAnonKeyPrefix: Deno.env.get('CLIENT_ANON_KEY')?.substring(0, 30) + '...'
        }
      }, 401);
    }
    
    return c.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    console.error("Token validation error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============================================================================
// CATALOG ENDPOINTS — materiales, procedencias, aditivos y curvas
// ============================================================================

// ── MATERIALES ──

app.get("/make-server/catalogs/materiales", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('materiales_catalog')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error fetching materiales:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.post("/make-server/catalogs/materiales", async (c) => {
  try {
    const { nombre, clase } = await c.req.json();
    if (!nombre?.trim()) return c.json({ success: false, error: 'nombre requerido' }, 400);
    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('materiales_catalog')
      .insert({ nombre: nombre.trim(), clase: clase?.trim() ?? null })
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("❌ Error creating material:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.put("/make-server/catalogs/materiales/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.nombre !== undefined) update.nombre = body.nombre.trim();
    if (body.clase !== undefined) update.clase = body.clase?.trim() ?? null;
    if (body.sort_order !== undefined) update.sort_order = body.sort_order;
    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('materiales_catalog')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error updating material:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.delete("/make-server/catalogs/materiales/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const supabase = db.getSupabaseClient();
    const { error } = await supabase
      .from('materiales_catalog')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error("❌ Error deleting material:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── PROCEDENCIAS ──

app.get("/make-server/catalogs/procedencias", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('procedencias_catalog')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error fetching procedencias:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.post("/make-server/catalogs/procedencias", async (c) => {
  try {
    const { nombre } = await c.req.json();
    if (!nombre?.trim()) return c.json({ success: false, error: 'nombre requerido' }, 400);
    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('procedencias_catalog')
      .insert({ nombre: nombre.trim() })
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("❌ Error creating procedencia:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.put("/make-server/catalogs/procedencias/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.nombre !== undefined) update.nombre = body.nombre.trim();
    if (body.sort_order !== undefined) update.sort_order = body.sort_order;
    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('procedencias_catalog')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error updating procedencia:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.delete("/make-server/catalogs/procedencias/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const supabase = db.getSupabaseClient();
    const { error } = await supabase
      .from('procedencias_catalog')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error("❌ Error deleting procedencia:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── ADITIVOS ──

app.get("/make-server/catalogs/additivos", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('additives_catalog')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error fetching additive catalog:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.post("/make-server/catalogs/additivos", async (c) => {
  try {
    const { nombre, marca, uom } = await c.req.json();
    if (!nombre?.trim()) return c.json({ success: false, error: 'nombre requerido' }, 400);
    if (!uom?.trim()) return c.json({ success: false, error: 'unidad requerida' }, 400);

    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('additives_catalog')
      .insert({
        nombre: nombre.trim(),
        marca: marca?.trim() || null,
        uom: uom.trim(),
      })
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("❌ Error creating additive catalog item:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.put("/make-server/catalogs/additivos/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.nombre !== undefined) update.nombre = body.nombre.trim();
    if (body.marca !== undefined) update.marca = body.marca?.trim() || null;
    if (body.uom !== undefined) update.uom = body.uom.trim();
    if (body.sort_order !== undefined) update.sort_order = body.sort_order;

    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('additives_catalog')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error updating additive catalog item:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.delete("/make-server/catalogs/additivos/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const supabase = db.getSupabaseClient();
    const { error } = await supabase
      .from('additives_catalog')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error("❌ Error deleting additive catalog item:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── CURVAS DE CONVERSION ──

app.get("/make-server/catalogs/calibration-curves", async (c) => {
  try {
    const plantId = c.req.query('plant_id');
    if (!plantId?.trim()) return c.json({ success: false, error: 'plant_id requerido' }, 400);

    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('calibration_curves')
      .select('*')
      .eq('plant_id', plantId.trim())
      .order('curve_name');
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error fetching calibration curves:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.post("/make-server/catalogs/calibration-curves", async (c) => {
  try {
    const { plant_id, curve_name, measurement_type, reading_uom, data_points } = await c.req.json();
    if (!plant_id?.trim()) return c.json({ success: false, error: 'plant_id requerido' }, 400);
    if (!curve_name?.trim()) return c.json({ success: false, error: 'curve_name requerido' }, 400);
    if (!measurement_type?.trim()) return c.json({ success: false, error: 'measurement_type requerido' }, 400);
    if (!data_points || typeof data_points !== 'object' || Array.isArray(data_points) || Object.keys(data_points).length === 0) {
      return c.json({ success: false, error: 'data_points requerido' }, 400);
    }

    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('calibration_curves')
      .insert({
        plant_id: plant_id.trim(),
        curve_name: curve_name.trim(),
        measurement_type: measurement_type.trim(),
        reading_uom: reading_uom?.trim() || null,
        data_points,
      })
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data }, 201);
  } catch (error) {
    console.error("❌ Error creating calibration curve:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.put("/make-server/catalogs/calibration-curves/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.curve_name !== undefined) update.curve_name = body.curve_name.trim();
    if (body.measurement_type !== undefined) update.measurement_type = body.measurement_type.trim();
    if (body.reading_uom !== undefined) update.reading_uom = body.reading_uom?.trim() || null;
    if (body.data_points !== undefined) update.data_points = body.data_points;

    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('calibration_curves')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error updating calibration curve:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.delete("/make-server/catalogs/calibration-curves/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const supabase = db.getSupabaseClient();
    const { error } = await supabase
      .from('calibration_curves')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error("❌ Error deleting calibration curve:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============================================================================
// PHOTOS REPORT ENDPOINT — admin + super_admin only
// GET /photos/report?plant_id=&year_month=YYYY-MM
// Returns flat list of all inventory entries that have a non-empty photo_url
// ============================================================================

app.get('/make-server/photos/report', async (c) => {
  try {
    const user = c.get('user');
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return c.json({ success: false, error: 'Forbidden: Admin access required' }, 403);
    }

    const supabase = db.getSupabaseClient();
    const { plant_id: plantFilter, year_month: monthFilter } = c.req.query();

    // ── Round 1: fetch inventory months (with optional filters) ──────────────
    let monthQuery = supabase
      .from('inventory_month')
      .select('id, plant_id, year_month, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (plantFilter) monthQuery = monthQuery.eq('plant_id', plantFilter);
    if (monthFilter) monthQuery = monthQuery.eq('year_month', monthFilter);

    const { data: months, error: monthsError } = await monthQuery;
    if (monthsError) throw monthsError;
    if (!months || months.length === 0) {
      return c.json({ success: true, data: [], total: 0 });
    }

    const monthIds = months.map((m: any) => m.id);
    const monthMap: Record<string, { plant_id: string; year_month: string; created_at: string }> = {};
    months.forEach((m: any) => { monthMap[m.id] = m; });

    // ── Round 2a: fetch all 7 section tables in parallel ────────────────────
    const [
      aggregatesRes,
      silosRes,
      additivesRes,
      dieselRes,
      productsRes,
      utilitiesRes,
      pettyCashRes,
    ] = await Promise.all([
      supabase
        .from('inventory_aggregates_entries')
        .select('id, inventory_month_id, aggregate_name, photo_url, notes, created_at')
        .in('inventory_month_id', monthIds)
        .not('photo_url', 'is', null)
        .neq('photo_url', ''),

      supabase
        .from('inventory_silos_entries')
        .select('id, inventory_month_id, silo_config_id, photo_url, notes, created_at')
        .in('inventory_month_id', monthIds)
        .not('photo_url', 'is', null)
        .neq('photo_url', ''),

      supabase
        .from('inventory_additives_entries')
        .select('id, inventory_month_id, additive_config_id, photo_url, notes, created_at')
        .in('inventory_month_id', monthIds)
        .not('photo_url', 'is', null)
        .neq('photo_url', ''),

      supabase
        .from('inventory_diesel_entries')
        .select('id, inventory_month_id, photo_url, notes, created_at')
        .in('inventory_month_id', monthIds)
        .not('photo_url', 'is', null)
        .neq('photo_url', ''),

      supabase
        .from('inventory_products_entries')
        .select('id, inventory_month_id, product_config_id, photo_url, notes, created_at')
        .in('inventory_month_id', monthIds)
        .not('photo_url', 'is', null)
        .neq('photo_url', ''),

      supabase
        .from('inventory_utilities_entries')
        .select('id, inventory_month_id, utility_config_id, utility_meter_config_id, photo_url, notes, created_at')
        .in('inventory_month_id', monthIds)
        .not('photo_url', 'is', null)
        .neq('photo_url', ''),

      supabase
        .from('inventory_petty_cash_entries')
        .select('id, inventory_month_id, photo_url, notes, created_at')
        .in('inventory_month_id', monthIds)
        .not('photo_url', 'is', null)
        .neq('photo_url', ''),
    ]);

    // ── Round 2b: resolve names — plants + 4 config tables ──────────────────
    const uniquePlantIds = [...new Set(months.map((m: any) => m.plant_id))];

    const siloConfigIds = [...new Set((silosRes.data     || []).map((e: any) => e.silo_config_id).filter(Boolean))];
    const addConfigIds  = [...new Set((additivesRes.data || []).map((e: any) => e.additive_config_id).filter(Boolean))];
    const prodConfigIds = [...new Set((productsRes.data  || []).map((e: any) => e.product_config_id).filter(Boolean))];
    const utilConfigIds = [...new Set((utilitiesRes.data || []).map((e: any) => e.utility_meter_config_id || e.utility_config_id).filter(Boolean))];

    const [plantsRes, siloNamesRes, addNamesRes, prodNamesRes, utilNamesRes] = await Promise.all([
      supabase.from('plants').select('id, name').in('id', uniquePlantIds),
      siloConfigIds.length
        ? supabase.from('plant_silos_config').select('id, silo_name').in('id', siloConfigIds)
        : Promise.resolve({ data: [] }),
      addConfigIds.length
        ? supabase.from('plant_additives_config').select('id, additive_name').in('id', addConfigIds)
        : Promise.resolve({ data: [] }),
      prodConfigIds.length
        ? supabase.from('plant_products_config').select('id, product_name').in('id', prodConfigIds)
        : Promise.resolve({ data: [] }),
      utilConfigIds.length
        ? supabase.from('plant_utilities_meters_config').select('id, meter_name').in('id', utilConfigIds)
        : Promise.resolve({ data: [] }),
    ]);

    // Build lookup maps
    const plantNameMap: Record<string, string> = {};
    const siloNameMap:  Record<string, string> = {};
    const addNameMap:   Record<string, string> = {};
    const prodNameMap:  Record<string, string> = {};
    const utilNameMap:  Record<string, string> = {};

    (plantsRes.data    || []).forEach((r: any) => { plantNameMap[r.id] = r.name; });
    (siloNamesRes.data || []).forEach((r: any) => { siloNameMap[r.id]  = r.silo_name; });
    (addNamesRes.data  || []).forEach((r: any) => { addNameMap[r.id]   = r.additive_name; });
    (prodNamesRes.data || []).forEach((r: any) => { prodNameMap[r.id]  = r.product_name; });
    (utilNamesRes.data || []).forEach((r: any) => { utilNameMap[r.id]  = r.meter_name; });

    // ── Flatten into a single sorted array ──────────────────────────────────
    interface PhotoRecord {
      id: string;
      section: string;
      item_name: string;
      plant_id: string;
      plant_name: string;
      year_month: string;
      photo_url: string;
      notes: string | null;
      created_at: string;
    }

    const photos: PhotoRecord[] = [];

    const push = (e: any, section: string, item_name: string) => {
      const month = monthMap[e.inventory_month_id];
      if (!month || !e.photo_url) return;
      photos.push({
        id: e.id,
        section,
        item_name,
        plant_id: month.plant_id,
        plant_name: plantNameMap[month.plant_id] || month.plant_id,
        year_month: month.year_month,
        photo_url: e.photo_url,
        notes: e.notes || null,
        created_at: e.created_at,
      });
    };

    (aggregatesRes.data || []).forEach((e: any) => push(e, 'Agregados',  e.aggregate_name                         || 'Agregado'));
    (silosRes.data      || []).forEach((e: any) => push(e, 'Silos',      siloNameMap[e.silo_config_id]             || 'Silo'));
    (additivesRes.data  || []).forEach((e: any) => push(e, 'Aditivos',   addNameMap[e.additive_config_id]          || 'Aditivo'));
    (dieselRes.data     || []).forEach((e: any) => push(e, 'Diesel',     'Diesel'));
    (productsRes.data   || []).forEach((e: any) => push(e, 'Productos',  prodNameMap[e.product_config_id]          || 'Producto'));
    (utilitiesRes.data  || []).forEach((e: any) => push(e, 'Utilidades', utilNameMap[e.utility_meter_config_id || e.utility_config_id] || 'Medidor'));
    (pettyCashRes.data  || []).forEach((e: any) => push(e, 'Caja Chica', 'Caja Chica'));

    // Sort newest first
    photos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    console.log(`[photos/report] Returning ${photos.length} photos for user ${user.email}`);
    return c.json({ success: true, data: photos, total: photos.length });
  } catch (err: any) {
    console.error('[photos/report] Error:', err.message);
    return c.json({ success: false, error: err.message }, 500);
  }
});

Deno.serve(app.fetch);
