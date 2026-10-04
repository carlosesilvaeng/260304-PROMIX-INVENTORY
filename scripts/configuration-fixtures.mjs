import {CONFIG_TABLES,createConfigurationPackage} from '../supabase/functions/make-server/configuration_package.ts';
export async function configurationFixture(id='A'){
  const tables=Object.fromEntries(CONFIG_TABLES.map(table=>[table,[]]));
  tables.unit_categories=[{id:'volume',code:'volume',base_unit_id:'m3',name_es:'Volumen',active:true}];
  tables.units=[{id:'m3',category_id:'volume',code:'m3',factor_to_base:1,name_es:'Metro cúbico',active:true}];
  tables.materiales_catalog=[{id:'material',nombre:'Arena',clase:'AGGREGATE',is_active:false}];
  tables.procedencias_catalog=[{id:'origin',nombre:'Cantera',is_active:true}];
  tables.additives_catalog=[{id:'additive',nombre:'Aditivo',uom:'m3',is_active:false}];
  tables.plant_aggregates_config=[{id:'aggregate',plant_id:id,aggregate_name:'Agregado',measurement_method:'BOX',box_width_ft:0,box_height_ft:2,unit:'m3',sort_order:0,is_active:false}];
  tables.plant_cajones_config=[{id:'box',plant_id:id,cajon_name:'Cajón',box_width_ft:2,box_height_ft:3,is_active:false}];
  tables.plant_silos_config=[{id:'silo',plant_id:id,silo_name:'Silo',geometry_model:'EXACT',capacity_fraction:0.75,calibration_curve_name:'Curva',requires_photo:true,is_active:true}];
  tables.plant_additives_config=[{id:'additive_cfg',plant_id:id,additive_name:'Aditivo',diameter:20,dimension_unit_id:'m3',is_active:true}];
  tables.plant_diesel_config=[{id:'diesel',plant_id:id,initial_inventory_gallons:0,tank_capacity_gallons:500,is_active:false}];
  tables.plant_products_config=[{id:'product',plant_id:id,product_name:'Producto',measure_mode:'DRUM',unit:'m3',unit_volume:55,is_active:true}];
  tables.plant_utilities_meters_config=[{id:'meter',plant_id:id,meter_name:'Medidor',requires_photo:true,unit:'m3',is_active:false}];
  tables.plant_petty_cash_config=[{id:'cash',plant_id:id,monthly_amount:100,initial_amount:0,is_active:true}];
  tables.calibration_curves=[{id:'curve',plant_id:id,curve_name:'Curva',data_points:JSON.stringify({0:0,10:100})}];
  tables.calibration_curve_points=[{id:'point0',curve_id:'curve',point_key:0,point_value:0,available_gallons:0,consumed_gallons:100,percentage:0,status:'EMPTY'},{id:'point10',curve_id:'curve',point_key:10,point_value:100,available_gallons:100,consumed_gallons:0,percentage:100,status:'FULL'}];
  tables.silo_allowed_products=[{id:'allowed',silo_config_id:'silo',product_name:'Arena'}];
  tables.material_conversion_factors=[{id:'factor',plant_id:id,material_id:'material',from_unit_id:'m3',to_unit_id:'m3',factor:1,active:false}];
  tables.measurement_configs=[{id:'rule',plant_id:id,equipment_id:'silo',calibration_curve_id:'curve',active:false}];
  const schema=Object.fromEntries(CONFIG_TABLES.map(table=>[table,[...new Set(['id',...tables[table].flatMap(row=>Object.keys(row))])]]));
  return createConfigurationPackage({plant:{id,name:`Planta ${id}`,code:id,has_cone_measurement:true,has_cajon_measurement:true,petty_cash_established:100},tables,schema,json_fields:Object.fromEntries(CONFIG_TABLES.map(table=>[table,table==='calibration_curves'?['data_points']:[]])),numeric_fields:Object.fromEntries(CONFIG_TABLES.map(table=>[table,schema[table].filter(column=>tables[table].some(row=>typeof row[column]==='number'))]))},'https://synthetic.supabase.co','2026-10-04T20:00:00Z');
}
