import { getSupabaseClient } from './database.tsx';

// ============================================================================
// SEED DATA FOR 6 PROMIX PLANTS
// ============================================================================

const PLANTS = [
  'CAROLINA',
  'CEIBA',
  'GUAYNABO',
  'GURABO',
  'VEGA_BAJA',
  'HUMACAO'
];

// Petty Cash amounts by plant
const PETTY_CASH_BY_PLANT: Record<string, number> = {
  'CAROLINA': 1500.00,
  'CEIBA': 1200.00,
  'GUAYNABO': 1500.00,
  'GURABO': 1200.00,
  'VEGA_BAJA': 1000.00,
  'HUMACAO': 1000.00
};

// Default silos configuration
const DEFAULT_SILOS = [
  { silo_name: 'CEMENTO SILO #1', products: ['CEMENTO'] },
  { silo_name: 'CEMENTO SILO #2', products: ['CEMENTO'] },
  { silo_name: 'SLAG SILO #3', products: ['SLAG'] },
];

// Default aggregates configuration
const DEFAULT_AGGREGATES = [
  { 
    aggregate_name: 'PIEDRA #67', 
    material_type: 'PIEDRA',
    location_area: 'ÁREA 1',
    measurement_method: 'CONE'
  },
  { 
    aggregate_name: 'ARENA', 
    material_type: 'ARENA',
    location_area: 'ÁREA 2',
    measurement_method: 'CONE'
  },
  { 
    aggregate_name: 'PIEDRA #8',
    material_type: 'PIEDRA',
    location_area: 'CAJÓN A',
    measurement_method: 'BOX',
    box_width_ft: 10.0,
    box_height_ft: 8.0
  },
  { 
    aggregate_name: 'PIEDRA #4',
    material_type: 'PIEDRA',
    location_area: 'CAJÓN B',
    measurement_method: 'BOX',
    box_width_ft: 12.0,
    box_height_ft: 8.0
  },
];

// Default additives configuration
const DEFAULT_ADDITIVES = [
  { additive_name: 'AIR ENTRAINING', measurement_method: 'INCHES_TO_GALLONS' },
  { additive_name: 'RETARDANT', measurement_method: 'INCHES_TO_GALLONS' },
  { additive_name: 'ACCELERATOR', measurement_method: 'INCHES_TO_GALLONS' },
];

// Default products configuration
const DEFAULT_PRODUCTS = [
  { product_name: 'ENGINE OIL 15W-40', unit: 'GALLON' },
  { product_name: 'HYDRAULIC OIL', unit: 'GALLON' },
  { product_name: 'GREASE', unit: 'PAIL' },
  { product_name: 'COOLANT', unit: 'GALLON' },
];

// Default utilities meters configuration
const DEFAULT_UTILITIES = [
  { meter_type: 'ELECTRICITY', meter_name: 'ELECTRIC METER MAIN', unit: 'KWH' },
  { meter_type: 'WATER', meter_name: 'WATER METER AAA', unit: 'GALLONS' },
];

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

export async function seedPlantConfigurations() {
  const supabase = getSupabaseClient();
  
  console.log('Starting seed of plant configurations...');
  
  for (const plantId of PLANTS) {
    console.log(`\nSeeding plant: ${plantId}`);
    
    try {
      // 1. Petty Cash Configuration
      const pettyCashAmount = PETTY_CASH_BY_PLANT[plantId] || 1000.00;
      await supabase
        .from('plant_petty_cash_config')
        .upsert({
          id: `${plantId}_petty_cash`,
          plant_id: plantId,
          monthly_amount: pettyCashAmount,
          is_active: true,
          sort_order: 1
        });
      
      console.log(`  ✓ Petty Cash: $${pettyCashAmount}`);
      
      // 2. Diesel Configuration (tank + calibration curve)
      const dieselCurveId = `${plantId}_diesel_curve`;
      
      // Create diesel calibration curve
      await supabase
        .from('calibration_curves')
        .upsert({
          id: dieselCurveId,
          plant_id: plantId,
          curve_name: dieselCurveId,
          measurement_type: 'INCHES_TO_GALLONS',
          data_points: [
            { reading: 0, value: 0 },
            { reading: 12, value: 500 },
            { reading: 24, value: 1000 },
            { reading: 36, value: 1500 },
            { reading: 48, value: 2000 },
            { reading: 60, value: 2500 },
            { reading: 72, value: 3000 },
          ]
        }, {
          onConflict: 'id',
          ignoreDuplicates: false
        });
      
      console.log(`  ✓ Diesel calibration curve created`);
      
      // 3. Seed Diesel Configuration
      const { error: dieselError } = await supabase
        .from('plant_diesel_config')
        .upsert({
          plant_id: plantId,
          measurement_method: 'INCHES_TO_GALLONS',
          calibration_curve_name: dieselCurveId,
          is_active: true,
          sort_order: 1
        }, {
          onConflict: 'plant_id',
          ignoreDuplicates: false
        });
      
      if (dieselError) {
        console.error(`Error seeding diesel config:`, dieselError);
      } else {
        console.log(`  ✓ Diesel configuration added`);
      }
      
      // 4. Seed Silos Configuration
      for (let i = 0; i < DEFAULT_SILOS.length; i++) {
        const silo = DEFAULT_SILOS[i];
        
        const { data: siloData, error: siloError } = await supabase
          .from('plant_silos_config')
          .upsert({
            plant_id: plantId,
            silo_name: silo.silo_name,
            measurement_method: 'FEET_TO_CUBIC_YARDS',
            calibration_curve_name: null,
            is_active: true,
            sort_order: i
          }, {
            onConflict: 'plant_id,silo_name',
            ignoreDuplicates: false
          })
          .select()
          .single();
        
        if (siloError) {
          console.error(`Error seeding silo ${silo.silo_name}:`, siloError);
          continue;
        }
        
        // Add allowed products for this silo
        if (siloData) {
          const allowedProducts = silo.products.map(product => ({
            silo_config_id: siloData.id,
            product_name: product
          }));
          
          const { error: productsError } = await supabase
            .from('silo_allowed_products')
            .upsert(allowedProducts, {
              onConflict: 'silo_config_id,product_name',
              ignoreDuplicates: false
            });
          
          if (productsError) {
            console.error(`Error seeding silo products:`, productsError);
          } else {
            console.log(`  ✓ Silo configured: ${silo.silo_name}`);
          }
        }
      }
      
      // 5. Seed Aggregates Configuration
      for (let i = 0; i < DEFAULT_AGGREGATES.length; i++) {
        const agg = DEFAULT_AGGREGATES[i];
        
        const { error: aggError } = await supabase
          .from('plant_aggregates_config')
          .upsert({
            plant_id: plantId,
            aggregate_name: agg.aggregate_name,
            material_type: agg.material_type,
            location_area: agg.location_area,
            measurement_method: agg.measurement_method,
            box_width_ft: agg.box_width_ft,
            box_height_ft: agg.box_height_ft,
            is_active: true,
            sort_order: i
          }, {
            onConflict: 'plant_id,aggregate_name',
            ignoreDuplicates: false
          });
        
        if (aggError) {
          console.error(`Error seeding aggregate ${agg.aggregate_name}:`, aggError);
          
          // Check if error is due to missing columns
          if (aggError.code === 'PGRST204' && aggError.message.includes('schema cache')) {
            throw new Error(`
❌ COLUMNAS FALTANTES DETECTADAS

Las columnas necesarias NO existen en las tablas de configuración.

🔧 SOLUCIÓN OBLIGATORIA:

1. Ve a Supabase Dashboard → SQL Editor
   https://supabase.com/dashboard

2. Abre el archivo en tu código:
   /supabase/MEGA_MIGRATION_ALL_CONFIG_TABLES.sql

3. Copia TODO el contenido (es un script completo)

4. Pega en SQL Editor y haz clic en "Run"

5. Ejecuta en una nueva query:
   NOTIFY pgrst, 'reload schema';

6. Espera 10 segundos

7. Vuelve aquí y haz clic en "Verificar & Cargar Datos"

---

📋 Error original: ${aggError.message}
            `.trim());
          }
        } else {
          console.log(`  ✓ Aggregate configured: ${agg.aggregate_name}`);
        }
      }
      
      // 6. Seed Additives Configuration with calibration curves
      for (let i = 0; i < DEFAULT_ADDITIVES.length; i++) {
        const additive = DEFAULT_ADDITIVES[i];
        const curveName = `${plantId}_${additive.additive_name.replace(/\s+/g, '_')}_CURVE`;
        
        // Create calibration curve for additive
        await supabase
          .from('calibration_curves')
          .upsert({
            id: curveName,
            plant_id: plantId,
            curve_name: curveName,
            measurement_type: 'INCHES_TO_GALLONS',
            data_points: [
              { reading: 0, value: 0 },
              { reading: 6, value: 50 },
              { reading: 12, value: 100 },
              { reading: 18, value: 150 },
              { reading: 24, value: 200 },
              { reading: 30, value: 250 },
            ]
          }, {
            onConflict: 'id',
            ignoreDuplicates: false
          });
        
        const { error: additiveError } = await supabase
          .from('plant_additives_config')
          .upsert({
            plant_id: plantId,
            additive_name: additive.additive_name,
            measurement_method: additive.measurement_method,
            calibration_curve_name: curveName,
            is_active: true,
            sort_order: i
          }, {
            onConflict: 'plant_id,additive_name',
            ignoreDuplicates: false
          });
        
        if (additiveError) {
          console.error(`Error seeding additive ${additive.additive_name}:`, additiveError);
        } else {
          console.log(`  ✓ Additive configured: ${additive.additive_name}`);
        }
      }
      
      // 7. Seed Products Configuration
      for (let i = 0; i < DEFAULT_PRODUCTS.length; i++) {
        const product = DEFAULT_PRODUCTS[i];
        
        const { error: productError } = await supabase
          .from('plant_products_config')
          .upsert({
            plant_id: plantId,
            product_name: product.product_name,
            unit: product.unit,
            is_active: true,
            sort_order: i
          }, {
            onConflict: 'plant_id,product_name',
            ignoreDuplicates: false
          });
        
        if (productError) {
          console.error(`Error seeding product ${product.product_name}:`, productError);
        } else {
          console.log(`  ✓ Product configured: ${product.product_name}`);
        }
      }
      
      // 8. Seed Utilities Meters Configuration
      for (let i = 0; i < DEFAULT_UTILITIES.length; i++) {
        const meter = DEFAULT_UTILITIES[i];
        
        const { error: meterError } = await supabase
          .from('plant_utilities_meters_config')
          .upsert({
            plant_id: plantId,
            meter_type: meter.meter_type,
            meter_name: meter.meter_name,
            unit: meter.unit,
            is_active: true,
            sort_order: i
          }, {
            onConflict: 'plant_id,meter_name',
            ignoreDuplicates: false
          });
        
        if (meterError) {
          console.error(`Error seeding utility meter ${meter.meter_name}:`, meterError);
        } else {
          console.log(`  ✓ Utility meter configured: ${meter.meter_name}`);
        }
      }
      
      console.log(`\n✅ Successfully seeded all configurations for ${plantId}`);
      
    } catch (error) {
      console.error(`\n❌ Error seeding plant ${plantId}:`, error);
    }
  }
  
  console.log('\n✅ Seed process completed for all plants!');
}

// ============================================================================
// HELPER: Clear all configuration data (use with caution!)
// ============================================================================

export async function clearAllConfigurations() {
  const supabase = getSupabaseClient();
  
  console.log('⚠️  Clearing all plant configurations...');
  
  // Delete in reverse order of dependencies
  await supabase.from('silo_allowed_products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('plant_utilities_meters_config').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('plant_products_config').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('plant_additives_config').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('plant_diesel_config').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('plant_silos_config').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('plant_aggregates_config').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('plant_petty_cash_config').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('calibration_curves').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log('✅ All configurations cleared!');
}

// ============================================================================
// SEED TEST USERS
// ============================================================================

export async function seedTestUsers() {
  const supabase = getSupabaseClient();
  
  console.log('👥 Starting seed of test users...');
  
  const testUsers = [
    {
      name: 'Juan Pérez',
      email: 'gerente.carolina@promix.com',
      password: 'promix2024',
      role: 'plant_manager',
      assigned_plants: ['CAROLINA']
    },
    {
      name: 'María González',
      email: 'gerente.ceiba@promix.com',
      password: 'promix2024',
      role: 'plant_manager',
      assigned_plants: ['CEIBA']
    },
    {
      name: 'Carlos Rivera',
      email: 'gerente.guaynabo@promix.com',
      password: 'promix2024',
      role: 'plant_manager',
      assigned_plants: ['GUAYNABO']
    },
    {
      name: 'Ana Torres',
      email: 'admin@promix.com',
      password: 'promix2024',
      role: 'admin',
      assigned_plants: ['CAROLINA', 'CEIBA', 'GUAYNABO', 'GURABO', 'VEGA_BAJA', 'HUMACAO']
    },
    {
      name: 'Roberto Martínez',
      email: 'superadmin@promix.com',
      password: 'promix2024',
      role: 'super_admin',
      assigned_plants: ['CAROLINA', 'CEIBA', 'GUAYNABO', 'GURABO', 'VEGA_BAJA', 'HUMACAO']
    }
  ];
  
  for (const userData of testUsers) {
    try {
      console.log(`\n  Creating user: ${userData.email}...`);
      
      // Check if user already exists in users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email, auth_user_id')
        .eq('email', userData.email)
        .single();
      
      if (existingUser) {
        console.log(`  ℹ️  User already exists in users table: ${userData.email}`);
        
        // Check if auth user exists
        if (existingUser.auth_user_id) {
          const { data: authUser } = await supabase.auth.admin.getUserById(existingUser.auth_user_id);
          if (authUser.user) {
            console.log(`  ✅ User fully configured: ${userData.email}`);
            continue;
          }
        }
        
        // If no auth user, delete the incomplete record and recreate
        console.log(`  🔧 Cleaning up incomplete user record...`);
        await supabase.from('users').delete().eq('id', existingUser.id);
      }
      
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true, // Auto-confirm
        user_metadata: {
          name: userData.name,
          role: userData.role
        }
      });
      
      if (authError) {
        console.error(`  ❌ Error creating auth user: ${authError.message}`);
        
        // Check if user already exists in auth
        if (authError.message.includes('already registered')) {
          console.log(`  ℹ️  Auth user already exists, trying to link...`);
          
          // Try to find auth user by email
          const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
          const authUser = authUsers?.find(u => u.email === userData.email);
          
          if (authUser) {
            // Create user record with existing auth ID
            const { data: newUser, error: userError } = await supabase
              .from('users')
              .insert({
                name: userData.name,
                email: userData.email,
                role: userData.role,
                assigned_plants: userData.assigned_plants,
                is_active: true,
                auth_user_id: authUser.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select()
              .single();
            
            if (userError) {
              console.error(`  ❌ Error creating user record: ${userError.message}`);
            } else {
              console.log(`  ✅ User linked successfully: ${userData.email}`);
            }
          }
        }
        continue;
      }
      
      if (!authData.user) {
        console.error(`  ❌ No auth user returned`);
        continue;
      }
      
      console.log(`  ✓ Auth user created with ID: ${authData.user.id}`);
      
      // Create user in users table
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          name: userData.name,
          email: userData.email,
          role: userData.role,
          assigned_plants: userData.assigned_plants,
          is_active: true,
          auth_user_id: authData.user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (userError) {
        console.error(`  ❌ Error creating user record: ${userError.message}`);
        // Cleanup: delete auth user
        await supabase.auth.admin.deleteUser(authData.user.id);
      } else {
        console.log(`  ✅ User created successfully: ${userData.email}`);
        console.log(`     Role: ${userData.role}`);
        console.log(`     Plants: ${userData.assigned_plants.join(', ')}`);
      }
      
    } catch (error) {
      console.error(`  ❌ Unexpected error creating user ${userData.email}:`, error);
    }
  }
  
  console.log('\n✅ Test users seed completed!');
  console.log('\n📋 TEST CREDENTIALS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Plant Manager (CAROLINA): gerente.carolina@promix.com / promix2024');
  console.log('Plant Manager (CEIBA):    gerente.ceiba@promix.com / promix2024');
  console.log('Plant Manager (GUAYNABO): gerente.guaynabo@promix.com / promix2024');
  console.log('Admin:                    admin@promix.com / promix2024');
  console.log('Super Admin:              superadmin@promix.com / promix2024');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}