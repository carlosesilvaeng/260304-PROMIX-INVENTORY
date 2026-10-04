// Real Chromium + IndexedDB; all remote endpoints are intercepted with synthetic
// fixtures. Requires an installed Playwright module and Chrome, never a live DB.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { build } from 'esbuild';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PROMIX_PLAYWRIGHT_MODULE || 'playwright');
const bundle=await build({stdin:{contents:"export * from './src/app/utils/inventoryDraftStore.ts'; export * from './src/app/utils/inventorySync.ts';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false,logLevel:'silent'});
const server=createServer(async(req,res)=>{
 try{
  if(req.url==='/fixture'){res.end('<!doctype html><title>Pruebas locales de borradores</title>');return;}
  if(req.url==='/engine.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
  const pathname=new URL(req.url,'http://localhost').pathname;
  const path=resolve('dist',pathname==='/'?'index.html':'.'+pathname);
  if(!path.startsWith(resolve('dist')+'/')){res.writeHead(403);res.end();return;}
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
  res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 let page=await context.newPage();await page.goto(origin+'/fixture');
 await page.evaluate(async()=>{
  const {IndexedInventoryDraftStore,InventorySync}=await import('/engine.js');
  const store=new IndexedInventoryDraftStore();
  const engine=new InventorySync('real-indexeddb:userA:plantA:2026-10',{store,ready:()=>true,online:()=>false,send:async()=>{throw Error('must remain offline');},preparePhotos:async rows=>rows,notify:()=>{}});
  await engine.restore('m','products',[{quantity:null}],0,'IN_PROGRESS');
  engine.change('products',[{quantity:0,photo_url:'data:image/jpeg;base64,AA=='}]);await engine.flush('products');engine.stop();
 });
 await page.close();page=await context.newPage();await page.goto(origin+'/fixture');
 const recovery=await page.evaluate(async()=>{
  const {IndexedInventoryDraftStore,InventorySync}=await import('/engine.js');const store=new IndexedInventoryDraftStore();
  const dependencies={store,ready:()=>true,online:()=>false,send:async()=>({success:false}),preparePhotos:async rows=>rows,notify:()=>{}};
  const restored=new InventorySync('real-indexeddb:userA:plantA:2026-10',dependencies);
  const own=await restored.restore('m','products',[{quantity:null}],0,'IN_PROGRESS',false);restored.stop();
  const other=new InventorySync('real-indexeddb:userB:plantA:2026-10',dependencies);
  const isolated=await other.restore('m','products',[{quantity:null}],0,'IN_PROGRESS',false);other.stop();return {own,isolated};
 });
 assert.equal(recovery.own[0].quantity,0);assert.match(recovery.own[0].photo_url,/data:image/);assert.equal(recovery.isolated[0].quantity,null);
 console.log('Real IndexedDB: zero and photo survive closing/reopening; different account isolated.');
 const stale=await context.newPage();await stale.goto(origin+'/fixture');
 for(const tab of [page,stale])await tab.evaluate(async()=>{
  const {InventorySync,IndexedInventoryDraftStore}=await import('/engine.js');window.states=[];
  window.engine=new InventorySync('real-two-tabs',{store:new IndexedInventoryDraftStore(),ready:()=>true,online:()=>false,send:async()=>({success:false}),preparePhotos:async rows=>rows,notify:(section,state)=>window.states.push(state)});
  await window.engine.restore('m','products',[{quantity:null}],0,'IN_PROGRESS');
 });
 await page.evaluate(async()=>{window.engine.change('products',[{quantity:1}]);await window.engine.flush('products');window.engine.stop();});
 const collided=await stale.evaluate(async()=>{window.engine.change('products',[{quantity:2}]);await window.engine.flush('products');window.engine.stop();return window.states.at(-1);});assert.equal(collided.localSaved,false);assert.equal(collided.state,'attention');
 console.log('Real IndexedDB: two browser tabs cannot overwrite a newer draft.');
 await context.close();
 // Full built application, synthetic operational session, no Supabase traffic.
 const app=await browser.newContext({viewport:{width:390,height:844}});
 const user={id:'synthetic-operator',name:'Operador de prueba',email:'operator@example.invalid',role:'plant_manager',assigned_plants:['TEST_A'],is_active:true};
 const plant={id:'TEST_A',name:'Planta de prueba',code:'TEST_A',location:'Pruebas',is_active:true,isActive:true,methods:{hasConeMeasurement:false,hasCajonMeasurement:false},pettyCashEstablished:0};
 const token=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:user.id})).toString('base64url')}.synthetic`;
 await app.addInitScript(({user,plant,token})=>{localStorage.setItem('promix_access_token',token);localStorage.setItem('promix_user',JSON.stringify(user));localStorage.setItem('promix_plant',JSON.stringify(plant));}, {user,plant,token});
 let revision=0,rows=[],writes=0,uploads=0,protocol=2,serviceFail=false;
 await app.route('https://*.supabase.co/**',async route=>{
  if(serviceFail){await route.abort('failed');return;}
  const request=route.request();const path=new URL(request.url()).pathname;
  let reply={success:true,data:null};
  if(path.endsWith('/auth/check-first-time'))reply={success:true,isFirstTime:false,userCount:1};
  else if(path.endsWith('/auth/verify'))reply={success:true,user};
  else if(path.endsWith('/modules/config'))reply={success:true,data:{modules:{products:{enabled:true},review_approve:{enabled:true}}}};
  else if(path.endsWith('/plants'))reply={success:true,data:[plant]};
  else if(path.endsWith('/reports'))reply={success:true,reporting_version:3,data:[{id:'m',plant_id:'TEST_A',plant_name:plant.name,year_month:'2026-10',status:'IN_PROGRESS'}],pagination:{total:1,offset:0,limit:50,has_more:false},totals:{total:1,in_progress:1,submitted:0,approved:0},snapshot_id:'same',as_of:new Date().toISOString()};
  else if(path.endsWith('/plants/TEST_A/config'))reply={success:true,data:{plant_id:'TEST_A',aggregates:[],cajones:[],silos:[],additives:[],diesel:null,utilities_meters:[],petty_cash:null,products:[{id:'p',product_name:'Producto de prueba',unit:'unit',uom:'unit',measure_mode:'COUNT',requires_photo:true}],units:[],measurement_configs:[],material_conversion_factors:[],calibration_curves:{}}};
  else if(path.includes('/inventory/month/TEST_A/'))reply=path.endsWith('/2026-10')?{success:true,data:{month:{id:'m',plant_id:'TEST_A',year_month:'2026-10',status:'IN_PROGRESS'},sync_protocol:protocol,section_revisions:{products:revision},productos:rows,silos:[],agregados:[],aditivos:[],utilities:[],diesel:null,pettyCash:null}}:{success:false,error:'Month not found'};
  else if(path.endsWith('/photos/upload')){
   const body=request.postDataJSON();assert.equal(body.photo_id,createHash('sha256').update(body.base64).digest('hex'));assert.equal(body.inventory_month_id,'m');assert.equal(body.section,'products');uploads++;reply={success:true,url:`https://synthetic.supabase.co/storage/v1/object/public/inventory-photos/phase2/TEST_A/synthetic/${body.photo_id}.jpg`};
  }
  else if(path.endsWith('/inventory/products')){
   const body=request.postDataJSON();assert.equal(body.expected_revision,revision);assert.match(body.operation_id,/^[0-9a-f-]{36}$/);rows=body.entries.map(row=>({...row,id:'persisted-p',_isNew:undefined}));revision++;writes++;reply={success:true,revision,data:rows,summary:{captured_count:1,complete_count:1,pending_count:0}};
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(reply),headers:{'access-control-allow-origin':'*'}});
 });
 const ui=await app.newPage();ui.setDefaultTimeout(8000);const errors=[];ui.on('pageerror',error=>errors.push(error.message));
 await ui.goto(origin);await ui.getByRole('button',{name:/Continuar inventario/}).click();

 await ui.getByText('Aceites y Productos',{exact:true}).first().click();
 const input=ui.locator('input[type=number]').first();await input.fill('0');
 await ui.getByLabel('Estado del borrador').getByText(/Guardado en servidor/).waitFor({timeout:12000});
 assert.equal(writes,1);assert.equal(rows[0].quantity,0);
 for(const width of [360,390,430]){await ui.setViewportSize({width,height:844});assert.equal(await ui.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);}
 await ui.screenshot({path:'/private/tmp/promix-phase2-mobile.png',fullPage:true});
 await app.setOffline(true);await input.fill('7');
 await ui.locator('input[type=file]').first().setInputFiles({name:'evidencia.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')});
 await ui.getByText(/Foto preparada/).waitFor();assert.equal(uploads,0);
await ui.getByLabel('Estado del borrador').getByText(/Guardado en este dispositivo|Pendiente de sincronizar/).first().waitFor();
 // Reopening the application offline exercises the shell cache and auth cache.
 await ui.evaluate(()=>navigator.serviceWorker.ready);await ui.reload();
 await ui.getByText('Aceites y Productos',{exact:true}).first().click();
 assert.equal(await ui.locator('input[type=number]').first().inputValue(),'7');assert.match(await ui.getByRole('img',{name:'Captura',exact:true}).getAttribute('src'),/^data:image/);
 await app.setOffline(false);await ui.getByLabel('Estado del borrador').getByText(/Guardado en servidor/).waitFor({timeout:12000});
 assert.equal(rows[0].quantity,7);assert.equal(uploads,1);assert.match(rows[0].photo_url,/https:.*phase2/);assert.equal(errors.length,0,errors.join('\n'));
 // Wi-Fi may remain connected while the API is unreachable.
 serviceFail=true;assert.equal(await ui.evaluate(()=>navigator.onLine),true);await ui.locator('input[type=number]').first().fill('9');await ui.getByText(/Guardado en este dispositivo|Pendiente de sincronizar/).first().waitFor();
 await ui.reload();await ui.getByText('Aceites y Productos',{exact:true}).first().click();assert.equal(await ui.locator('input[type=number]').first().inputValue(),'9');
 serviceFail=false;await ui.getByLabel('Estado del borrador').getByRole('button',{name:'Guardar ahora'}).click();await ui.getByLabel('Estado del borrador').getByText(/Guardado en servidor/).waitFor({timeout:12000});assert.equal(rows[0].quantity,9);
 // A prior backend must not receive automatic writes without revision support.
 protocol=undefined;await ui.reload();await ui.getByText('Aceites y Productos',{exact:true}).first().click();const before=writes;
 await ui.locator('input[type=number]').first().fill('8');await ui.getByText(/El servidor debe actualizarse/).waitFor({timeout:12000});assert.equal(writes,before);
 await ui.reload();await ui.getByText('Aceites y Productos',{exact:true}).first().click();assert.equal(await ui.locator('input[type=number]').first().inputValue(),'8');assert.equal(writes,before);
 console.log('Built application: mobile 360/390/430, zero autosave, offline shell/photo recovery, reconnection, unreachable API with Wi-Fi connected and older-server protection passed.');
 await app.close();
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
