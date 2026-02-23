import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.ts";
import * as db from "./database.ts";
import * as seed from "./seed.ts";
import * as auth from "./auth.ts";

const app = new Hono();

// ============================================================================
// BUILD VERSION - Update manually when deploying
// ============================================================================
const BUILD_VERSION = '2602182000';
// Format: YYMMDDHHMI (GMT-5 Puerto Rico Time) = 26/02/18 20:00 = Feb 18, 2026 8:00 PM

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

// Health check endpoint
app.get("/make-server-02205af0/health", (c) => {
  return c.json({ status: "ok" });
});

// Get BUILD version endpoint
app.get("/make-server-02205af0/build-version", (c) => {
  return c.json({ 
    success: true, 
    buildVersion: BUILD_VERSION,
    timestamp: new Date().toISOString()
  });
});

// Debug environment endpoint - Check backend configuration
app.get("/make-server-02205af0/debug/env", (c) => {
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

// Signup - Create new user (Super Admin only)
app.post("/make-server-02205af0/auth/signup", async (c) => {
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
app.post("/make-server-02205af0/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const result = await auth.login(body);
    
    if (!result.success) {
      return c.json(result, 400);
    }
    
    return c.json(result);
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Change Password - Cambiar contraseña del usuario autenticado
app.post("/make-server-02205af0/auth/change-password", async (c) => {
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
app.get("/make-server-02205af0/auth/check-first-time", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    
    // Count total users
    const { count, error } = await supabase
      .from('users_02205af0')
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
app.post("/make-server-02205af0/auth/verify", async (c) => {
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
app.get("/make-server-02205af0/auth/users", async (c) => {
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
app.put("/make-server-02205af0/auth/users/:userId", async (c) => {
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
app.delete("/make-server-02205af0/auth/users/:userId", async (c) => {
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
app.post("/make-server-02205af0/db/initialize", async (c) => {
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
app.post("/make-server-02205af0/db/reload-cache", async (c) => {
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
app.post("/make-server-02205af0/db/seed", async (c) => {
  try {
    await seed.seedPlantConfigurations();
    return c.json({ success: true, message: "Plant configurations seeded successfully" });
  } catch (error) {
    console.error("Seed error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Seed test users
app.post("/make-server-02205af0/db/seed-users", async (c) => {
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
app.post("/make-server-02205af0/db/clear", async (c) => {
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

app.get("/make-server-02205af0/plants/:plantId/config", async (c) => {
  try {
    const plantId = c.req.param("plantId");
    
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

// ============================================================================
// INVENTORY MONTH ENDPOINTS
// ============================================================================

// Get or create inventory month
app.post("/make-server-02205af0/inventory/month", async (c) => {
  try {
    const body = await c.req.json();
    const { plant_id, year_month, created_by } = body;
    
    if (!plant_id || !year_month || !created_by) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    const inventoryMonth = await db.getOrCreateInventoryMonth(plant_id, year_month, created_by);
    return c.json({ success: true, data: inventoryMonth });
  } catch (error) {
    console.error("Error creating/getting inventory month:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get full inventory month data
app.get("/make-server-02205af0/inventory/month/:inventoryMonthId", async (c) => {
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
app.get("/make-server-02205af0/inventory/month/:plantId/:yearMonth", async (c) => {
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
app.put("/make-server-02205af0/inventory/month/:inventoryMonthId/status", async (c) => {
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
// SAVE INDIVIDUAL SECTION ENTRIES
// ============================================================================

// Save aggregates entries
app.post("/make-server-02205af0/inventory/aggregates", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, entries } = body;
    
    if (!inventory_month_id || !entries) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    // Delete existing entries for this inventory month
    await supabase.from('inventory_aggregates_entries_02205af0').delete().eq('inventory_month_id', inventory_month_id);
    
    // Insert new entries
    const { data, error } = await supabase.from('inventory_aggregates_entries_02205af0').insert(entries).select();
    
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error saving aggregates entries:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Save silos entries
app.post("/make-server-02205af0/inventory/silos", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, entries } = body;
    
    if (!inventory_month_id || !entries) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    await supabase.from('inventory_silos_entries_02205af0').delete().eq('inventory_month_id', inventory_month_id);
    const { data, error } = await supabase.from('inventory_silos_entries_02205af0').insert(entries).select();
    
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error saving silos entries:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Save additives entries
app.post("/make-server-02205af0/inventory/additives", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, entries } = body;
    
    if (!inventory_month_id || !entries) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    await supabase.from('inventory_additives_entries_02205af0').delete().eq('inventory_month_id', inventory_month_id);
    const { data, error } = await supabase.from('inventory_additives_entries_02205af0').insert(entries).select();
    
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error saving additives entries:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Save diesel entry
app.post("/make-server-02205af0/inventory/diesel", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, entry } = body;
    
    if (!inventory_month_id || !entry) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    await supabase.from('inventory_diesel_entries_02205af0').delete().eq('inventory_month_id', inventory_month_id);
    const { data, error } = await supabase.from('inventory_diesel_entries_02205af0').insert(entry).select().single();
    
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error saving diesel entry:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Save products entries
app.post("/make-server-02205af0/inventory/products", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, entries } = body;
    
    if (!inventory_month_id || !entries) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    await supabase.from('inventory_products_entries_02205af0').delete().eq('inventory_month_id', inventory_month_id);
    const { data, error } = await supabase.from('inventory_products_entries_02205af0').insert(entries).select();
    
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error saving products entries:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Save utilities entries
app.post("/make-server-02205af0/inventory/utilities", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, entries } = body;
    
    if (!inventory_month_id || !entries) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    await supabase.from('inventory_utilities_entries_02205af0').delete().eq('inventory_month_id', inventory_month_id);
    const { data, error } = await supabase.from('inventory_utilities_entries_02205af0').insert(entries).select();
    
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error saving utilities entries:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Save petty cash entry
app.post("/make-server-02205af0/inventory/petty-cash", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, entry } = body;
    
    if (!inventory_month_id || !entry) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    await supabase.from('inventory_petty_cash_entries_02205af0').delete().eq('inventory_month_id', inventory_month_id);
    const { data, error } = await supabase.from('inventory_petty_cash_entries_02205af0').insert(entry).select().single();
    
    if (error) throw error;
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
app.post("/make-server-02205af0/inventory/save-draft", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id } = body;
    
    if (!inventory_month_id) {
      return c.json({ success: false, error: "Missing inventory_month_id" }, 400);
    }
    
    // Just update the updated_at timestamp
    const { data, error } = await supabase
      .from('inventory_month_02205af0')
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
app.post("/make-server-02205af0/inventory/submit", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, submitted_by } = body;
    
    if (!inventory_month_id || !submitted_by) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    // Get current inventory month
    const { data: currentMonth, error: fetchError } = await supabase
      .from('inventory_month_02205af0')
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
      .from('inventory_month_02205af0')
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
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error submitting inventory:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Approve inventory (SUBMITTED -> APPROVED)
app.post("/make-server-02205af0/inventory/approve", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, approved_by, notes } = body;
    
    if (!inventory_month_id || !approved_by) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    // Get current inventory month
    const { data: currentMonth, error: fetchError } = await supabase
      .from('inventory_month_02205af0')
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
      .from('inventory_month_02205af0')
      .update(updateData)
      .eq('id', inventory_month_id)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log(`[APPROVE] Inventory ${inventory_month_id} approved by ${approved_by}`);
    return c.json({ success: true, data });
  } catch (error) {
    console.error("Error approving inventory:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Reject inventory (SUBMITTED -> IN_PROGRESS)
app.post("/make-server-02205af0/inventory/reject", async (c) => {
  try {
    const supabase = db.getSupabaseClient();
    const body = await c.req.json();
    const { inventory_month_id, rejected_by, rejection_notes } = body;
    
    if (!inventory_month_id || !rejected_by || !rejection_notes) {
      return c.json({ success: false, error: "Missing required fields (inventory_month_id, rejected_by, rejection_notes)" }, 400);
    }
    
    // Get current inventory month
    const { data: currentMonth, error: fetchError } = await supabase
      .from('inventory_month_02205af0')
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
      .from('inventory_month_02205af0')
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
app.get("/make-server-02205af0/modules/config", async (c) => {
  try {
    console.log('[MODULES] Fetching module configuration');
    const config = await kv.get('module_config_02205af0');
    
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
app.post("/make-server-02205af0/modules/config", async (c) => {
  try {
    const body = await c.req.json();
    
    console.log('[MODULES] Updating module configuration:', body);
    
    // Validate structure
    if (!body.modules) {
      return c.json({ success: false, error: "Missing 'modules' field" }, 400);
    }
    
    // Save to KV store
    await kv.set('module_config_02205af0', body);
    
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
// DEBUG ENDPOINTS
// ============================================================================

// Validate JWT token
app.get("/make-server-02205af0/auth/validate", async (c) => {
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

Deno.serve(app.fetch);