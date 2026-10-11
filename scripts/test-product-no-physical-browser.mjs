// Exercise the actual product form with synthetic contexts; no live API calls.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PROMIX_PLAYWRIGHT_MODULE||'playwright');
const fixture=`import React from 'react';
const plant={id:'test',name:'Planta de prueba'};
const noop=()=>{};
let rows=[{id:'p',product_config_id:'p',product_name:'Aceite de prueba',category:'OIL',measure_mode:'COUNT',uom:'unit',requires_photo:true,quantity:null}];
const listeners=new Set();
const update=()=>listeners.forEach(fn=>fn([...rows]));
export const useAuth=()=>({currentPlant:plant});
export function usePlantPrefill(){const [state,setState]=React.useState(rows);React.useEffect(()=>{listeners.add(setState);return()=>listeners.delete(setState);},[]);
return {prefillData:{productosEntries:state,inventoryMonth:{id:'m',year_month:'2026-10'},config:{}},loadPlantData:noop,getCurrentYearMonth:()=> '2026-10',getSectionRevision:()=>0,markChangesSaved:noop,
updateEntry:(_,id,data)=>{rows=rows.map(p=>p.id===id?{...p,...data}:p);window.lastRow=rows[0];update();},
saveSection:async()=>{window.savedRow={...rows[0]};rows=rows.map(p=>({...p,no_physical_stock_by:'operator',no_physical_stock_user_name:'Operador de prueba',no_physical_stock_at:'2026-10-11T21:00:00Z'}));update();return {success:true,saved_at:'2026-10-11T21:00:00Z'};}};}`;
const bundle=await build({stdin:{contents:"import React from 'react';import {createRoot} from 'react-dom/client';import {ProductsSection} from './src/app/pages/sections/ProductsSection.tsx';createRoot(document.getElementById('root')).render(React.createElement(ProductsSection));",resolveDir:process.cwd()},bundle:true,jsx:'automatic',format:'esm',write:false,logLevel:'silent',plugins:[{name:'synthetic-contexts',setup(b){
 b.onResolve({filter:/contexts\/(AuthContext|PlantPrefillContext)$/},()=>({path:'fixture',namespace:'test'}));
 b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:fixture,loader:'tsx',resolveDir:process.cwd()}));
 b.onResolve({filter:/^\/utils\/supabase\/info$/},()=>({path:'info',namespace:'info'}));
 b.onLoad({filter:/.*/,namespace:'info'},()=>({contents:"export const projectId='test';export const publicAnonKey='test';"}));
}}]});
const server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);}else res.end('<!doctype html><div id="root"></div><script type="module" src="/app.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror',error=>console.error(error.message));
 await page.route('https://**',route=>route.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const checkbox=page.locator('input[type=checkbox]');
 await checkbox.click();await page.getByRole('alertdialog').waitFor();
 assert.equal(await checkbox.isChecked(),false);
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 assert.equal(await checkbox.isChecked(),false);assert.equal(await page.locator('input[type=number]').count(),1);
 await checkbox.click();await page.getByRole('button',{name:'Sí, confirmar NO HAY FÍSICO',exact:true}).click();
 assert.equal(await checkbox.isChecked(),true);assert.equal(await page.locator('input[type=number]').count(),0);
 await page.getByText('Sin existencia física.',{exact:false}).waitFor();
 assert.equal((await page.evaluate(()=>window.lastRow)).quantity,0);
 await page.getByRole('button',{name:'Guardar Aceites y Productos',exact:true}).click();
 await page.getByText('Registrado por Operador de prueba',{exact:false}).waitFor();
 assert.equal((await page.evaluate(()=>window.savedRow)).no_physical_stock,true);
 await checkbox.click();assert.equal(await page.locator('input[type=number]').count(),1);
 assert.equal((await page.evaluate(()=>window.lastRow)).quantity,null);
 assert.equal((await page.evaluate(()=>window.lastRow)).no_physical_stock_at,null);
 console.log('Product form: cancel, confirm, bypass inputs, save, audit metadata and restoration passed on mobile.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
