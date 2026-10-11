export type PhysicalStockSection = 'aggregates' | 'silos' | 'additives';

// Clear capture values on both transitions; a restored item must be measured again.
export function physicalStockUpdates(section: PhysicalStockSection, absent: boolean) {
  const common = { no_physical_stock: absent, no_physical_stock_by: null,
    no_physical_stock_user_name: null, no_physical_stock_at: null, photo_url: null };
  const zero = absent ? 0 : null;
  if (section === 'aggregates') return { ...common, box_height_ft: null, box_length_ft: null,
    ...Object.fromEntries(['cone_m1','cone_m2','cone_m3','cone_m4','cone_m5','cone_m6','cone_d1','cone_d2'].map(key => [key, null])), calculated_volume_cy: zero };
  if (section === 'silos') return { ...common, reading_value: null, reading: null, product_name: null, product_in_silo: null,
    calculated_result: zero, calculated_result_cy: zero, calculated_volume: zero, calculated_volume_ft3: zero,
    presentation_lbs: zero, presentation_sacks: zero, presentation_metric_tons: zero, calculation_metadata: null };
  return { ...common, reading_value: null, reading: null, quantity: zero, calculated_volume: zero,
    calculated_gallons: zero, display_volume: zero, inventory_quantity: zero, inventory_percentage: zero };
}
