import assert from 'node:assert/strict';
import { test } from 'node:test';
import { optionalNumber, validateInventorySubmissionSection, prepareInventoryRows, summarizeInventorySection, requireInventoryWriter } from '../supabase/functions/make-server/inventory_guard.ts';
import { InventoryWriteProtocol } from '../src/app/utils/inventoryWriteProtocol.ts';
const units = [{id:'ft3',category_id:'volume',factor_to_base:0.028316846592},{id:'m3',category_id:'volume',factor_to_base:1}, {id:'gal_us',category_id:'capacity',factor_to_base:1}];
const pack = {plant_id:'A',units,measurement_configs:[],material_conversion_factors:[],
 aggregates:[{id:'box',measurement_method:'BOX',box_width_ft:4,box_height_ft:3},{id:'cone',measurement_method:'CONE'}],
 silos:[{id:'silo',calculation_method:'CALIBRATION_CURVE',conversion_table:{0:0,10:100},requires_photo:true}],
 additives:[{id:'manual',measurement_method:'MANUAL',capacity_unit_id:'gal_us',capacity:100},{id:'tank',measurement_method:'CURVE',conversion_table:{0:0,10:100},capacity_unit_id:'gal_us',requires_photo:true}],
 diesel:{id:'diesel',initial_inventory_gallons:20,calibration_table:{0:0,10:100}},
 products:[{id:'drum',measure_mode:'DRUM',unit_volume:55},{id:'count',measure_mode:'COUNT'},{id:'ptank',measure_mode:'TANK_READING',calibration_table:{0:0,10:100}}],
 utilities_meters:[{id:'meter',initial_reading:10,requires_photo:true}],petty_cash:{id:'cash',monthly_amount:100}};
const prepare=(section,row,previous)=>prepareInventoryRows(section,[row],pack,previous)[0];
test('zero is captured; missing and invalid numbers remain distinct',()=>{
 assert.equal(optionalNumber(0),0); assert.equal(optionalNumber('0'),0);assert.equal(optionalNumber(null),null);assert.equal(optionalNumber(''),null);
 for(const value of [-1,NaN,Infinity,true,{},'garbage']) assert.throws(()=>optionalNumber(value));
});
test('only active operational roles may write',()=>{
 for(const role of ['plant_manager','operations_manager']) assert.doesNotThrow(()=>requireInventoryWriter({is_active:true,role}));
 for(const role of ['admin','super_admin','unknown']) assert.throws(()=>requireInventoryWriter({is_active:true,role}));
 assert.throws(()=>requireInventoryWriter({is_active:false,role:'plant_manager'}));
});
test('config ownership and duplicate ids are enforced',()=>{
 assert.throws(()=>prepare('products',{product_config_id:'other'}));
 assert.throws(()=>prepareInventoryRows('products',[{product_config_id:'count'},{product_config_id:'count'}],pack));
});
test('box uses configured width, measured height and ignores forged result',()=>{
 const row=prepare('aggregates',{aggregate_config_id:'box',box_length_ft:2,box_height_ft:3,box_width_ft:99,calculated_volume_cy:999});
 assert.equal(row.calculated_volume_cy,24);assert.equal(row.box_height_ft,3);
 assert.equal(prepare('aggregates',{aggregate_config_id:'box'}).calculated_volume_cy,null);
});
test('legacy boxes use real plant config ids and a missing measured height remains pending',()=>{
 const legacy={...pack,aggregates:[],cajones:[{id:'legacy',name:'Box',ancho:4,alto:3}]};
 const row=prepareInventoryRows('aggregates',[{aggregate_config_id:'fallback_cajon_legacy',box_height_ft:null,box_length_ft:2}],legacy)[0];
 assert.equal(row.aggregate_config_id,'legacy');assert.equal(row.calculated_volume_cy,null);
 assert.equal(summarizeInventorySection('aggregates',[row]).complete_count,0);
});
test('cone geometry is calculated and invalid physical readings are rejected',()=>{
 const row={aggregate_config_id:'cone',cone_m1:5,cone_m2:5,cone_m3:5,cone_m4:5,cone_m5:5,cone_m6:5,cone_d1:6,cone_d2:6};
 assert.equal(prepare('aggregates',row).calculated_volume_cy,37.7);
 assert.throws(()=>prepare('aggregates',{...row,cone_d1:20,cone_d2:20}));
});
test('silo drafts allow missing reading and photo, submission counts do not',()=>{
 const row=prepare('silos',{silo_config_id:'silo'});
 assert.equal(row.reading_value,null); assert.equal(row.calculated_result,null);
 assert.equal(summarizeInventorySection('silos',[row]).complete_count,0);
 const zero=prepare('silos',{silo_config_id:'silo',reading_value:0,photo_url:'photo'});
 assert.equal(summarizeInventorySection('silos',[zero]).captured_count,1);assert.equal(summarizeInventorySection('silos',[zero]).complete_count,1);
 assert.throws(()=>prepare('silos',{silo_config_id:'silo',reading_value:11}));
});
test('additives use authorized curves and preserve incomplete manual input',()=>{
 assert.equal(prepare('additives',{additive_config_id:'manual'}).quantity,null);
 assert.equal(prepare('additives',{additive_config_id:'manual',quantity:0}).inventory_quantity,0);
 const row=prepare('additives',{additive_config_id:'tank',reading_value:5,conversion_table:{0:900,10:1000}});
 assert.equal(row.inventory_quantity,50);assert.equal(summarizeInventorySection('additives',[row]).complete_count,0);
});
test('diesel uses previous ending inventory and does not manufacture missing purchases',()=>{
 const row=prepare('diesel',{diesel_config_id:'diesel',reading_inches:5,beginning_inventory:999,purchases_gallons:10,calibration_table:{0:0,10:1000}}, {diesel:{ending_inventory:60}});
 assert.equal(row.ending_inventory,50);assert.equal(row.consumption_gallons,20);
 assert.equal(prepare('diesel',{diesel_config_id:'diesel',reading_inches:0}).consumption_gallons,null);
});
test('products distinguish absent counts and use configured unit volume',()=>{
 assert.equal(prepare('products',{product_config_id:'count'}).quantity,null);
 const row=prepare('products',{product_config_id:'drum',unit_count:2,unit_volume:999,total_volume:999});
 assert.equal(row.quantity,2);assert.equal(row.total_volume,110);
 assert.equal(prepare('products',{product_config_id:'ptank',reading_value:5,calibration_table:{0:0,10:1000}}).quantity,50);
});
test('utilities derive previous reading from history and reject backwards meters',()=>{
 const row=prepare('utilities',{utility_meter_config_id:'meter',current_reading:25,previous_reading:0,consumption:999},{utilities:[{utility_meter_config_id:'meter',current_reading:20}]});
 assert.equal(row.consumption,5);assert.equal(row.previous_reading,20);
 assert.throws(()=>prepare('utilities',{utility_meter_config_id:'meter',current_reading:9}));
});
test('petty cash derives totals and preserves partial receipts',()=>{
 const row=prepare('petty-cash',{petty_cash_config_id:'cash',receipts:20,cash:70,total:999,established_amount:999});
 assert.equal(row.total,90);assert.equal(row.difference,10);
 assert.equal(prepare('petty-cash',{petty_cash_config_id:'cash',receipts:0}).total,null);
});
test('manual retries reuse operation and revision until confirmed',()=>{
 let counter=0;const protocol=new InventoryWriteProtocol(()=>`op-${++counter}`);protocol.setIdentity('user');protocol.observe('m',{products:0});
 const body={entries:[{quantity:0}]};const first=protocol.prepare('m','products',body);
 assert.deepEqual(protocol.prepare('m','products',body),first);
 protocol.confirm('m','products',first.operation_id,1);
 assert.equal(protocol.prepare('m','products',body).expected_revision,1);
 protocol.setIdentity('other');assert.throws(()=>protocol.prepare('m','products',body));
});
test('late response does not confirm a different pending operation',()=>{
 let n=0;const protocol=new InventoryWriteProtocol(()=>`op-${++n}`);protocol.observe('m',{products:0});
 const first=protocol.prepare('m','products',{quantity:1});const next=protocol.prepare('m','products',{quantity:2});
 protocol.confirm('m','products',first.operation_id,1);assert.deepEqual(protocol.prepare('m','products',{quantity:2}),next);
});
test('explicit reload uses the observed revision and invalidates an obsolete retry',()=>{
 let n=0;const protocol=new InventoryWriteProtocol(()=>`op-${++n}`);protocol.observe('m',{products:0});
 const first=protocol.prepare('m','products',{quantity:1});protocol.observe('m',{products:2});
 const next=protocol.prepare('m','products',{quantity:1});
 assert.equal(next.expected_revision,2);assert.notEqual(next.operation_id,first.operation_id);
 protocol.confirm('m','products',first.operation_id,1);
 assert.deepEqual(protocol.prepare('m','products',{quantity:1}),next);
});

test('submission requires every configured row, valid mandatory inputs and authoritative saved calculations',()=>{
 const complete=pack.products.map(config=>prepare('products',{product_config_id:config.id,quantity:0,unit_count:0,reading_value:0}));
 assert.equal(validateInventorySubmissionSection('products',complete,pack).complete,true);
 assert.equal(validateInventorySubmissionSection('products',complete.slice(1),pack).complete,false);
 const forged=complete.map(row=>({...row,total_volume:999}));
 assert.match(validateInventorySubmissionSection('products',forged,pack).error,/vuelve a guardar/);
 const silo=prepare('silos',{silo_config_id:'silo',reading_value:0});
 assert.equal(validateInventorySubmissionSection('silos',[silo],pack).complete,false);
 const partial=prepare('petty-cash',{petty_cash_config_id:'cash',receipts:0,photo_url:'photo'});
 assert.equal(validateInventorySubmissionSection('petty-cash',[partial],pack).complete,false);
});
test('derived numeric overflow is rejected before it can be serialized as null',()=>{
 assert.throws(()=>prepare('products',{product_config_id:'drum',unit_count:Number.MAX_VALUE}),/rango numérico/);
});
test('silo acknowledgement carries configured geometry for subsequent mobile edits',()=>{
 const configured={...pack,silos:[{...pack.silos[0],diameter_in:144,total_height_in:300,cone_height_in:80,bottom_diameter_in:42,cylinder_height_mode:'FULL',slope_divisor_mode:'NONE',material_conversion_factor_id:'factor'}]};
 const saved=prepareInventoryRows('silos',[{silo_config_id:'silo',diameter_in:999}],configured)[0];assert.equal(saved.diameter_in,144);assert.equal(saved.total_height_in,300);assert.equal(saved.material_conversion_factor_id,'factor');assert.equal(saved.reading_value,null);
});
