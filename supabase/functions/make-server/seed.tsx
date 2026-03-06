import { getSupabaseClient } from './database.tsx';

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
