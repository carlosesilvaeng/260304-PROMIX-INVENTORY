import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canCaptureInventory,canCapturePlantInventory,inventoryApprovalBlock} from '../supabase/functions/make-server/inventory_permissions.ts';
import {requireInventoryWriter} from '../supabase/functions/make-server/inventory_guard.ts';
import {isConfigurationUnavailable} from '../supabase/functions/make-server/configuration_errors.ts';
const admin={id:'admin',role:'admin',is_active:true,assigned_plants:['A'],can_capture_inventory:true};
test('admin capability requires explicit permission, assignment, active account and plant',()=>{
 assert.equal(canCaptureInventory({...admin,can_capture_inventory:false}),false);
 assert.doesNotThrow(()=>requireInventoryWriter(admin));
 assert.equal(canCapturePlantInventory(admin,'A'),true);
 assert.equal(canCapturePlantInventory(admin,'B'),false);
 assert.equal(canCapturePlantInventory(admin,'A',false),false);
 assert.equal(canCaptureInventory({...admin,is_active:false}),false);
 assert.equal(canCapturePlantInventory({...admin,role:'super_admin'},'B'),false);
});
test('legacy operators retain assignment/global behavior and permission revocation stops writes',()=>{
 assert.equal(canCapturePlantInventory({...admin,role:'plant_manager',can_capture_inventory:false},'A'),true);
 assert.equal(canCapturePlantInventory({...admin,role:'plant_manager'},'B'),false);
 assert.equal(canCapturePlantInventory({...admin,role:'operations_manager'},'B'),true);
 assert.throws(()=>requireInventoryWriter({...admin,can_capture_inventory:false}),/permisos/);
});
test('approval needs a different identified account, not a display name',()=>{
 assert.match(inventoryApprovalBlock('admin',{status:'SUBMITTED',submitted_by_user_id:'admin'}),/Otra persona/);
 assert.match(inventoryApprovalBlock('admin',{status:'SUBMITTED'}),/identificar/);
 assert.equal(inventoryApprovalBlock('other',{status:'SUBMITTED',submitted_by_user_id:'admin'}),null);
 assert.equal(inventoryApprovalBlock('admin',{status:'IN_PROGRESS'}),null);
});
test('only missing configuration RPC errors are classified as an unavailable configuration service',()=>{
 assert.equal(isConfigurationUnavailable({code:'PGRST202',message:'configuration_export'}),true);
 assert.equal(isConfigurationUnavailable({message:'Could not find the function public.configuration_import'}),true);
 assert.equal(isConfigurationUnavailable({code:'42501',message:'Acceso no autorizado'}),false);
 assert.equal(isConfigurationUnavailable({code:'PGRST202',message:'other_function'}),false);
});

test('revoking admin capture preserves the unsent durable draft and prevents synchronization',async t=>{
 const {InventorySync}=await import('../src/app/utils/inventorySync.ts');
 const values=new Map();const store={get:async key=>structuredClone(values.get(key)),put:async(key,value)=>{const next=(values.get(key)?.version||0)+1;values.set(key,structuredClone({...value,version:next}));return next;}};
 const actor={...admin};let sends=0;
 const dependencies={store,online:()=>true,ready:()=>canCapturePlantInventory(actor,'A'),preparePhotos:async rows=>rows,send:async()=>{sends++;throw Error('Should not send');},notify:()=>{}};
 const engine=new InventorySync('admin/A/2026-10',dependencies);t.after(()=>engine.stop());
 await engine.restore('month','products',[{product_config_id:'p',quantity:null}],0,'IN_PROGRESS');
 engine.change('products',[{product_config_id:'p',quantity:7}]);
 actor.can_capture_inventory=false;
 assert.equal((await engine.flush('products')).success,false);assert.equal(sends,0);
 assert.equal(values.get('draft:admin/A/2026-10:products').rows[0].quantity,7);
 engine.stop();actor.can_capture_inventory=true;
 const restored=new InventorySync('admin/A/2026-10',dependencies);t.after(()=>restored.stop());
 assert.equal((await restored.restore('month','products',[],0,'IN_PROGRESS',false))[0].quantity,7);
});
