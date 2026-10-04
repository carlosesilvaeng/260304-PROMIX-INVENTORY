import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InventorySync } from '../src/app/utils/inventorySync.ts';
import { DraftCollision, inventoryScopeKey } from '../src/app/utils/inventoryDraftStore.ts';
class Store {
 records=new Map();fail=false;
 async get(key){return structuredClone(this.records.get(key));}
 async put(key,value,version){if(this.fail)throw new DOMException('Quota exceeded','QuotaExceededError');const prior=this.records.get(key)?.version||0;if(version!==undefined&&version!==prior)throw new DraftCollision('another tab');const next=prior+1;this.records.set(key,structuredClone({...value,version:next}));return next;}
}
const row=value=>[{product_config_id:'p',quantity:value}];
function setup(t, overrides={}){
 const store=overrides.store||new Store();let online=true,ready=true;const sent=[],states=[];
 const dependencies={store,online:()=>online,ready:()=>ready,preparePhotos:async rows=>rows,send:async(d,op)=>{sent.push(structuredClone(op));return {success:true,revision:op.expected+1,data:op.rows};},notify:(section,state,rows)=>states.push({section,...state,rows}),...overrides};
 const engine=new InventorySync(overrides.scope||'user-A/plant-A/month-A',dependencies);t.after(()=>engine.stop());
 return {engine,store,sent,states,offline:()=>online=false,expire:()=>ready=false};
}
test('zero and pending photographs are durable before connecting',async t=>{
 const x=setup(t);await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.offline();x.engine.change('products',[{...row(0)[0],photo_url:'data:image/jpeg;base64,AA=='}]);await x.engine.flush('products');
 const restored=setup(t,{store:x.store});const rows=await restored.engine.restore('m','products',row(null),0,'IN_PROGRESS',false);
 assert.equal(rows[0].quantity,0);assert.match(rows[0].photo_url,/^data:image/);assert.equal(x.sent.length,0);
});
test('confirmed latest rows also survive offline restart with an older view cache',async t=>{
 const x=setup(t);await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.engine.change('products',row(7));await x.engine.flush('products');
 const restored=setup(t,{store:x.store});assert.equal((await restored.engine.restore('m','products',row(null),0,'IN_PROGRESS',false))[0].quantity,7);
});
test('a lost response reuses the durable operation across restart',async t=>{
 let operation;const x=setup(t,{send:async(d,op)=>{operation=structuredClone(op);throw new Error('lost response');}});
 await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.engine.change('products',row(2));await x.engine.flush('products');x.engine.stop();
 const restored=setup(t,{store:x.store});await restored.engine.restore('m','products',row(2),1,'IN_PROGRESS');await restored.engine.flush('products');
 assert.equal(restored.sent[0].id,operation.id);assert.deepEqual(restored.sent[0].rows,operation.rows);assert.equal(restored.sent[0].expected,0);
});
test('edits during a request are sent in a second serialized operation',async t=>{
 let release,started;const waiting=new Promise(resolve=>started=resolve);const first=new Promise(resolve=>release=resolve);const sent=[];
 const x=setup(t,{send:async(d,op)=>{sent.push(structuredClone(op));if(sent.length===1){started();await first;}return {success:true,revision:op.expected+1,data:op.rows};}});
 await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.engine.change('products',row(1));const flush=x.engine.flush('products');await waiting;x.engine.change('products',row(3));release();await flush;
 assert.equal(sent.length,2);assert.equal(sent[0].rows[0].quantity,1);assert.equal(sent[1].rows[0].quantity,3);assert.equal(sent[1].expected,1);assert.equal(x.engine.hasPending(),false);
});
test('manual save joins the same in-flight operation',async t=>{
 let release;const waiting=new Promise(resolve=>release=resolve);const x=setup(t,{send:async(d,op)=>{await waiting;return {success:true,revision:1,data:op.rows};}});
 await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.engine.change('products',row(1));const first=x.engine.flush('products');const second=x.engine.flush('products');assert.equal(first,second);release();await first;
});
test('a newer server revision pauses recovery without overwriting local values',async t=>{
 const x=setup(t);await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.offline();x.engine.change('products',row(4));await x.engine.flush('products');
 const restored=setup(t,{store:x.store});const local=await restored.engine.restore('m','products',row(99),2,'IN_PROGRESS');await restored.engine.flush('products');assert.equal(local[0].quantity,4);assert.equal(restored.sent.length,0);assert.equal(restored.states.at(-1).state,'attention');
});
test('submitted inventories retain their local draft and cannot synchronize',async t=>{
 const x=setup(t);await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.offline();x.engine.change('products',row(4));await x.engine.flush('products');
 const restored=setup(t,{store:x.store});await restored.engine.restore('m','products',row(5),1,'SUBMITTED');assert.equal((await restored.engine.flush('products')).success,false);assert.equal(restored.sent.length,0);assert.equal(restored.engine.drafts.get('products').rows[0].quantity,4);
});
test('quota failure never reports local protection or sends unprotected data',async t=>{
 const x=setup(t);await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.store.fail=true;x.engine.change('products',row(4));await x.engine.flush('products');assert.equal(x.sent.length,0);assert.equal(x.states.at(-1).localSaved,false);
});
test('a stale tab cannot overwrite a different tab local draft',async t=>{
 const x=setup(t);await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');const y=setup(t,{store:x.store});await y.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.offline();y.offline();x.engine.change('products',row(1));await x.engine.flush('products');y.engine.change('products',row(2));await y.engine.flush('products');assert.equal(y.states.at(-1).localSaved,false);const saved=[...x.store.records.values()][0];assert.equal(saved.rows[0].quantity,1);
});
test('session expiry preserves drafts and prevents transmission',async t=>{
 const x=setup(t);await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.engine.change('products',row(4));x.expire();await x.engine.flush('products');assert.equal(x.sent.length,0);assert.equal(x.states.at(-1).state,'attention');assert.equal(x.states.at(-1).localSaved,true);
});
test('HTTP authorization/conflict errors pause instead of repeatedly writing',async t=>{
 for(const status of [401,403,409]){let count=0;const x=setup(t,{send:async()=>{count++;return {success:false,status,error:'blocked'};}});await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.engine.change('products',row(4));await x.engine.flush('products');assert.equal(count,1);assert.equal(x.states.at(-1).state,'attention');assert.equal(x.engine.hasPending(),true);}
});
test('failed photo upload never sends a section without its pending evidence',async t=>{
 const x=setup(t,{preparePhotos:async()=>{throw new Error('offline photo');}});await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.engine.change('products',[{...row(0)[0],photo_url:'data:image/jpeg;base64,AA=='}]);await x.engine.flush('products');assert.equal(x.sent.length,0);assert.match(x.engine.drafts.get('products').rows[0].photo_url,/data:image/);
});
test('scope keys isolate environments, owners, plants and periods',()=>{
 const keys=[inventoryScopeKey('prod','u','A','2026-10'),inventoryScopeKey('clone','u','A','2026-10'),inventoryScopeKey('prod','other','A','2026-10'),inventoryScopeKey('prod','u','B','2026-10'),inventoryScopeKey('prod','u','A','2026-09')];assert.equal(new Set(keys).size,5);
});
test('resolving a conflict requires a deliberate rebase or discarding local values',async t=>{
 const x=setup(t);await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.offline();x.engine.change('products',row(4));await x.engine.flush('products');
 const y=setup(t,{store:x.store});await y.engine.restore('m','products',row(99),2,'IN_PROGRESS');await y.engine.resolve('products',row(99),2,true);await y.engine.flush('products');assert.equal(y.sent[0].expected,2);assert.equal(y.sent[0].rows[0].quantity,4);
});
test('unsupported server protocol retains local data without a remote write',async t=>{
 const x=setup(t,{ready:()=>false,unavailableReason:'Actualizar servidor'});await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.engine.change('products',row(0));await x.engine.flush('products');assert.equal(x.sent.length,0);assert.equal(x.states.at(-1).message,'Actualizar servidor');assert.equal(x.states.at(-1).localSaved,true);
});
test('invalid server confirmation pauses instead of retrying blindly',async t=>{
 let count=0;const x=setup(t,{send:async()=>{count++;return {success:true,data:row(5)};}});await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.engine.change('products',row(5));await x.engine.flush('products');await x.engine.flush('products');assert.equal(count,1);assert.equal(x.states.at(-1).state,'attention');assert.equal(x.engine.hasPending(),true);
});
const settle=async()=>{for(let n=0;n<30;n++)await Promise.resolve();};
test('autosave waits two idle seconds and sends by ten seconds during continuous editing',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:100000});
 const x=setup(t);await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.engine.change('products',row(1));await settle();t.mock.timers.tick(1999);await settle();assert.equal(x.sent.length,0);t.mock.timers.tick(1);await settle();assert.equal(x.sent.length,1);
 x.engine.change('products',row(2));await settle();for(let n=0;n<9;n++){t.mock.timers.tick(1000);await settle();x.engine.change('products',row(n+3));await settle();}assert.equal(x.sent.length,1);t.mock.timers.tick(1000);await settle();assert.equal(x.sent.length,2);assert.equal(x.sent[1].rows[0].quantity,11);
});
test('stopping a user queue prevents photo upload and section writes after a pending edit',async t=>{
 let uploaded=0;const x=setup(t,{preparePhotos:async rows=>{uploaded++;return rows;}});await x.engine.restore('m','products',row(null),0,'IN_PROGRESS');x.engine.change('products',row(4));x.engine.stop();await x.engine.flush('products');assert.equal(uploaded,0);assert.equal(x.sent.length,0);assert.equal([...x.store.records.values()][0].rows[0].quantity,4);
});
test('canonical acknowledgement preserves display metadata and clears temporary identity',async t=>{
 const x=setup(t,{send:async()=>({success:true,revision:1,data:[{id:'persisted',product_config_id:'p',quantity:0,notes:null}]})});
 await x.engine.restore('m','products',[{id:'temp_p',_isNew:true,product_config_id:'p',quantity:null,unit_label:'unidad',notes:'old'}],0,'IN_PROGRESS');x.engine.change('products',[{id:'temp_p',_isNew:true,product_config_id:'p',quantity:0,unit_label:'unidad',notes:'old'}]);await x.engine.flush('products');
 const saved=x.engine.drafts.get('products').rows[0];assert.equal(saved.id,'persisted');assert.equal(saved._isNew,false);assert.equal(saved.unit_label,'unidad');assert.equal(saved.notes,null);
});
