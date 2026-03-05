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
const BUILD_VERSION = '2603050601';
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

function checkPlantAccess(user: any, plantId: string): boolean {
  if (user.role === 'admin' || user.role === 'super_admin') return true;
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
// AUTHENTICATION ENDPOINTS
// ============================================================================

// Signup - Create new user (Admin / Super Admin only)
app.post("/make-server/auth/signup", requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const result = await auth.signup(body);
    
    if (!result.success) {
      return c.json(result, 400);
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
      return c.json(result, 403);
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
      return c.json(result, 403);
    }
    
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

// Seed plant configurations
app.post("/make-server/db/seed", async (c) => {
  try {
    await seed.seedPlantConfigurations();
    return c.json({ success: true, message: "Plant configurations seeded successfully" });
  } catch (error) {
    console.error("Seed error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Seed test users
app.post("/make-server/db/seed-users", async (c) => {
  try {
    await seed.seedTestUsers();
    return c.json({ 
      success: true, 
      message: "Test users created successfully",
      users: [
        { email: "gerente.carolina@promix.com", password: "promix2024", role: "plant_manager", plants: ["CAROLINA"] },
        { email: "gerente.ceiba@promix.com", password: "promix2024", role: "plant_manager", plants: ["CEIBA"] },
        { email: "gerente.guaynabo@promix.com", password: "promix2024", role: "plant_manager", plants: ["GUAYNABO"] },
        { email: "admin@promix.com", password: "promix2024", role: "admin", plants: ["ALL"] },
        { email: "superadmin@promix.com", password: "promix2024", role: "super_admin", plants: ["ALL"] }
      ]
    });
  } catch (error) {
    console.error("Seed users error:", error);
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

    // plant_manager only sees their assigned plants; with no assignments, sees none.
    if (user.role === 'plant_manager') {
      const assignedPlants = Array.isArray(user.assigned_plants) ? user.assigned_plants : [];
      if (assignedPlants.length === 0) {
        console.log(`✅ [GET /plants] Returned 0 plants for ${user.email} (${user.role}) - no assignments`);
        return c.json({ success: true, data: [] });
      }
      query = query.in('id', assignedPlants);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Fetch silos for all plants from the config table (source of truth)
    const { data: allSilos } = await supabase
      .from('plant_silos_config')
      .select('plant_id, id, silo_name, is_active, sort_order')
      .order('sort_order', { ascending: true });

    // Merge: replace legacy JSONB silos with real silos from config table
    const plantsWithSilos = (data ?? []).map((plant: any) => ({
      ...plant,
      silos: (allSilos ?? []).filter((s: any) => s.plant_id === plant.id),
    }));

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
                     'has_cone_measurement', 'has_cajon_measurement', 'is_active',
                     'cajones'];
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

// GET /plants/:plantId/silos — list silos for a plant (admin/super_admin only)
app.get("/make-server/plants/:plantId/silos", async (c) => {
  try {
    const user = c.get('user');
    if (!['admin', 'super_admin'].includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const { plantId } = c.req.param();
    const supabase = db.getSupabaseClient();
    const { data, error } = await supabase
      .from('plant_silos_config')
      .select('id, silo_name, is_active, sort_order')
      .eq('plant_id', plantId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return c.json({ success: true, data: data ?? [] });
  } catch (error: any) {
    console.error("❌ Error fetching silos:", error);
    return c.json({ success: false, error: error.message }, 500);
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
    const silos: { silo_name: string; is_active: boolean }[] = body.silos ?? [];

    const supabase = db.getSupabaseClient();

    // Detect default calibration curve for this plant (SILO*)
    const { data: curves } = await supabase
      .from('calibration_curves')
      .select('curve_name')
      .eq('plant_id', plantId)
      .ilike('curve_name', 'SILO%')
      .limit(1);
    const defaultCurve = curves?.[0]?.curve_name ?? null;

    // Delete all existing silos for the plant
    const { error: delError } = await supabase
      .from('plant_silos_config')
      .delete()
      .eq('plant_id', plantId);
    if (delError) throw delError;

    // Insert new silos if any
    if (silos.length > 0) {
      const rows = silos.map((s, i) => ({
        plant_id: plantId,
        silo_name: s.silo_name,
        measurement_method: 'FEET_TO_CUBIC_YARDS',
        calibration_curve_name: defaultCurve,
        sort_order: i,
        is_active: s.is_active ?? true,
      }));
      const { error: insError } = await supabase
        .from('plant_silos_config')
        .insert(rows);
      if (insError) throw insError;
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
    const body = await c.req.json();
    const { plant_id, year_month, created_by } = body;

    if (!plant_id || !year_month || !created_by) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }

    // Check if it already exists before creating
    const { data: existing } = await supabase
      .from('inventory_month')
      .select('id')
      .eq('plant_id', plant_id)
      .eq('year_month', year_month)
      .single();

    const inventoryMonth = await db.getOrCreateInventoryMonth(plant_id, year_month, created_by);

    // Audit: only log when a NEW inventory month is created
    if (!existing) {
      const user = c.get('user');
      logAudit(supabase, {
        user_email: user.email,
        user_name: user.name,
        user_id: user.id,
        action: 'INVENTORY_STARTED',
        plant_id: plant_id,
        inventory_month_id: inventoryMonth.id,
        details: { year_month },
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
      return c.json({ success: false, error: "Month not found" }, 404);
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
    const { data, error } = await supabase.from('inventory_silos_entries').insert(entries).select();

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
    const { data, error } = await supabase.from('inventory_additives_entries').insert(entries).select();

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
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id } = body;
    
    if (!inventory_month_id) {
      return c.json({ success: false, error: "Missing inventory_month_id" }, 400);
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
    const submitUser = c.get('user');
    logAudit(supabase, {
      user_email: submitUser.email,
      user_name: submitUser.name,
      user_id: submitUser.id,
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
    } else if (plantIdFilter) {
      query = query.eq('plant_id', plantIdFilter);
    }

    const { data, error } = await query;
    if (error) throw error;
    return c.json({ success: true, data });
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
    const supabase = db.getSupabaseClient();

    // Verify the report exists
    const { data: report, error: reportError } = await supabase
      .from('inventory_month')
      .select('id, plant_id, year_month')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return c.json({ success: false, error: 'Reporte no encontrado' }, 404);
    }

    // Collect photo_url values from all 7 child entry tables
    const childTables = [
      'inventory_aggregates_entries',
      'inventory_silos_entries',
      'inventory_additives_entries',
      'inventory_diesel_entries',
      'inventory_products_entries',
      'inventory_utilities_entries',
      'inventory_petty_cash_entries',
    ];

    const photoUrls: string[] = [];
    for (const table of childTables) {
      const { data: rows } = await supabase
        .from(table)
        .select('photo_url')
        .eq('inventory_month_id', reportId);
      rows?.forEach((row: any) => row.photo_url && photoUrls.push(row.photo_url));
    }

    // Delete photos from the 'inventory-photos' storage bucket
    if (photoUrls.length > 0) {
      const storagePaths = photoUrls
        .filter((url: string) => url.includes('/inventory-photos/'))
        .map((url: string) => url.split('/inventory-photos/')[1]);
      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('inventory-photos')
          .remove(storagePaths);
        if (storageError) {
          console.warn('[DELETE REPORT] Storage removal warning:', storageError.message);
        }
      }
    }

    // Delete all child entry records
    for (const table of childTables) {
      await supabase.from(table).delete().eq('inventory_month_id', reportId);
    }

    // Delete the parent inventory_month record
    const { error: deleteError } = await supabase
      .from('inventory_month')
      .delete()
      .eq('id', reportId);

    if (deleteError) throw deleteError;

    // Audit log
    const user = c.get('user');
    logAudit(supabase, {
      user_email: user.email,
      user_name: user.name,
      user_id: user.id,
      action: 'REPORT_DELETED',
      plant_id: report.plant_id,
      inventory_month_id: reportId,
      details: { year_month: report.year_month, photos_deleted: photoUrls.length },
    });

    console.log(`[DELETE REPORT] Report ${reportId} deleted. Photos removed: ${photoUrls.length}`);
    return c.json({ success: true, deleted_photos: photoUrls.length });

  } catch (error: any) {
    console.error('[DELETE REPORT] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
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
// CATALOG ENDPOINTS — materiales y procedencias
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
        .select('id, inventory_month_id, utility_config_id, photo_url, notes, created_at')
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
    const utilConfigIds = [...new Set((utilitiesRes.data || []).map((e: any) => e.utility_config_id).filter(Boolean))];

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
    (utilitiesRes.data  || []).forEach((e: any) => push(e, 'Utilidades', utilNameMap[e.utility_config_id]          || 'Medidor'));
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
