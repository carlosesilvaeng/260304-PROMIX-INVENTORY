// Exercise the actual aggregate, silo and additive forms with synthetic contexts; no live API calls.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PROMIX_PLAYWRIGHT_MODULE||'playwright');
const fixture=`import React from 'react';
const plant={id:'test',name:'Planta de prueba'},noop=()=>{};
const mode=new URLSearchParams(location.search).get('section');
const section=mode.startsWith('additives')?'additives':mode;
const field={aggregates:'agregadosEntries',silos:'silosEntries',additives:'aditivosEntries'}[section];
let rows=[section==='aggregates'?{id:'a',aggregate_config_id:'a',material_type:'Arena',measurement_method:'BOX',box_width_ft:4,box_height_ft:null,box_length_ft:null}:
 section==='silos'?{id:'s',silo_config_id:'s',silo_name:'Silo vacío',calculation_method:'GEOMETRIC_CYLINDER_CONE',requires_photo:true,allowed_products:['Cemento'],reading_value:null}:
 {id:'d',additive_config_id:'d',product_name:'Aditivo de prueba',additive_type:mode.endsWith('manual')?'MANUAL':'TANK',measurement_method:mode.endsWith('manual')?'MANUAL':'CURVE',requires_photo:true,capacity:100,capacity_unit_id:'gal_us',reading_value:null,quantity:null}];
const listeners=new Set(),update=()=>listeners.forEach(fn=>fn([...rows]));
export const useAuth=()=>({currentPlant:plant});
export function usePlantPrefill(){const [state,setState]=React.useState(rows);React.useEffect(()=>{listeners.add(setState);return()=>listeners.delete(setState);},[]);
return {prefillData:{[field]:state,inventoryMonth:{id:'m',year_month:'2026-10'},config:{}},loadPlantData:noop,getCurrentYearMonth:()=> '2026-10',getSectionRevision:()=>0,markChangesSaved:noop,
updateEntry:(_,id,data)=>{rows=rows.map(p=>p.id===id?{...p,...data}:p);window.lastRow=rows[0];update();},
saveSection:async()=>{window.savedRow={...rows[0]};rows=rows.map(p=>({...p,no_physical_stock_by:'operator',no_physical_stock_user_name:'Operador de prueba',no_physical_stock_at:'2026-10-11T21:00:00Z'}));update();return {success:true,saved_at:'2026-10-11T21:00:00Z'};}};}`;
const bundle=await build({stdin:{contents:"import React from 'react';import {createRoot} from 'react-dom/client';import {AggregatesSection} from './src/app/pages/sections/AggregatesSection.tsx';import {SilosSection} from './src/app/pages/sections/SilosSection.tsx';import {AdditivesSection} from './src/app/pages/sections/AdditivesSection.tsx';const section=new URLSearchParams(location.search).get('section');createRoot(document.getElementById('root')).render(React.createElement(section==='aggregates'?AggregatesSection:section==='silos'?SilosSection:AdditivesSection,{}));",resolveDir:process.cwd()},bundle:true,jsx:'automatic',format:'esm',loader:{'.png':'dataurl'},write:false,logLevel:'silent',plugins:[{name:'synthetic-contexts',setup(b){
 b.onResolve({filter:/contexts\/(AuthContext|PlantPrefillContext)$/},()=>({path:'fixture',namespace:'test'}));
 b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:fixture,loader:'tsx',resolveDir:process.cwd()}));
 b.onResolve({filter:/^\/utils\/supabase\/info$/},()=>({path:'info',namespace:'info'}));
 b.onLoad({filter:/.*/,namespace:'info'},()=>({contents:"export const projectId='test';export const publicAnonKey='test';"}));
}}]});
const server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);}else res.end('<!doctype html><div id="root"></div><script type="module" src="/app.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const mode of ['aggregates','silos','additives-tank','additives-manual']){
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://**',route=>route.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}/?section=${mode}`);
 const checkbox=page.locator('input[type=checkbox]');await checkbox.waitFor();
 const captureCount=await page.locator('input[type=number]').count();assert.ok(captureCount>0);
 await checkbox.click();await page.getByRole('alertdialog').waitFor();assert.equal(await checkbox.isChecked(),false);
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await checkbox.isChecked(),false);
 await checkbox.click();await page.getByRole('button',{name:'Sí, confirmar NO HAY FÍSICO',exact:true}).click();
 assert.equal(await checkbox.isChecked(),true);assert.equal(await page.locator('input[type=number]').count(),0);
 if(mode==='silos')assert.equal(await page.getByRole('combobox').count(),0);
 const save=page.getByRole('button',{name:mode==='aggregates'?'Guardar Agregados':mode==='silos'?'Guardar Silos':/Guardar Aditivos/});
 assert.equal(await save.isEnabled(),true);await save.click();
 await page.getByText('Registrado por Operador de prueba',{exact:false}).waitFor();
 assert.equal((await page.evaluate(()=>window.savedRow)).no_physical_stock,true);
 await checkbox.click();assert.equal(await page.locator('input[type=number]').count(),captureCount);
 assert.equal((await page.evaluate(()=>window.lastRow)).no_physical_stock,false);
 assert.equal((await page.evaluate(()=>window.lastRow)).no_physical_stock_at,null);
 if(mode.startsWith('additives'))assert.equal(await save.isEnabled(),false);
 assert.deepEqual(errors,[]);console.log(`${mode}: cancel, confirm, bypass, save, audit metadata and restore passed on mobile.`);
 await page.close();
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
