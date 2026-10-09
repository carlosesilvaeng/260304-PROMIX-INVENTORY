// Full built app and real downloads. All remote data is synthetic and intercepted.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {buildInventoryReport} from '../supabase/functions/make-server/report_model.ts';
const require=createRequire(import.meta.url),XLSX=require('xlsx');
const {chromium}=require(process.env.PROMIX_PLAYWRIGHT_MODULE||'playwright');
const server=createServer(async(req,res)=>{try{const path=resolve('dist',new URL(req.url,'http://localhost').pathname==='/'?'index.html':'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(resolve('dist')+'/'))throw Error('Invalid path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const app=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
 const user={id:'synthetic-admin',name:'Administrador de prueba',email:'admin@example.invalid',role:'admin',assigned_plants:[],is_active:true};
 const plants=['A','B'].map(id=>({id,name:`Planta ${id}`,code:id,is_active:true,isActive:true,methods:{},pettyCashEstablished:0}));
 const token=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:user.id})).toString('base64url')}.synthetic`;
 await app.addInitScript(({user,token})=>{localStorage.setItem('promix_access_token',token);localStorage.setItem('promix_user',JSON.stringify(user));},{user,token});
 const progress={saved_count:2,captured_count:1,complete_count:0,pending_count:1,first_capture_received_at:'2026-10-04T18:00:00Z',first_capture_client_at:'2026-10-04T15:00:00Z',last_save_received_at:'2026-10-04T18:10:00Z',sections:[]};
 const rows=Array.from({length:251},(_,i)=>({id:`m${i}`,plant_id:i===1?'B':'A',plant_name:i===1?'Planta B':'Planta A',year_month:i<2?'2026-10':`2025-${String(i%12+1).padStart(2,'0')}`,status:i<2?'IN_PROGRESS':'APPROVED',write_revision:1,created_at:'2026-10-01T12:00:00Z',created_by:user.id,updated_at:'2026-10-04T18:10:00Z',activity_at:i===1?'2026-10-04T19:00:00Z':'2026-10-04T18:00:00Z',progress}));
 const detail=row=>buildInventoryReport({reporting_version:3,month:row,plant_name:row.plant_name,progress,previous:null,
  agregados:[{aggregate_name:'Agregado m3',material_type:'Arena',measurement_method:'BOX',box_width_ft:3,box_height_ft:2,box_length_ft:1,capture_unit_id:'m',calculated_volume_cy:6,unit:'m3'},{aggregate_name:'Agregado ft3',material_type:'Arena',calculated_volume_cy:2,unit:'ft3',capture_unit_id:'ft'}],
  silos:[{silo_name:'Silo 1',product_name:'Cemento',reading_value:2,reading_uom:'ft',calculated_result:5,calculated_result_unit_id:'yd3'}],
  aditivos:[{product_name:'Aditivo',additive_type:'MANUAL',inventory_quantity:0,inventory_unit_id:'gal_us'}],
  diesel:{ending_inventory:3,purchases_gallons:7,consumption_gallons:5,unit:'gal_us'},
  productos:[{product_name:'Producto cero',quantity:0,uom:'unit',measure_mode:'COUNT',photo_url:'https://evidence.example.invalid/ok.png'},{product_name:'Envase',quantity:2,unit_count:2,total_volume:110,unit_volume:55,uom:'gal_us',measure_mode:'DRUM',photo_url:'https://evidence.example.invalid/missing.png'}],
  utilities:[{meter_name:'Agua',previous_reading:0,current_reading:10,consumption:10,uom:'gal_us'}],pettyCash:{established_amount:100,cash:80,receipts:20,total:100,difference:0,currency:'USD'}});
 let failDetail=false,slow=false,legacy=false;const reportQueries=[],photoHeaders=[],deleteRequests=[];
 await app.route('https://evidence.example.invalid/**',async route=>{photoHeaders.push(route.request().headers());await route.fulfill(route.request().url().endsWith('/missing.png')?{status:404,body:''}:{status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')});});
 await app.route('https://*.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname,q=url.searchParams;let reply={success:true,data:null},status=200;
  if(path.endsWith('/auth/check-first-time'))reply={success:true,isFirstTime:false,userCount:1};
  else if(path.endsWith('/auth/verify'))reply={success:true,user};
  else if(path.endsWith('/plants'))reply={success:true,data:plants};
  else if(path.endsWith('/photos/report'))reply={success:true,data:[
   {id:'p1',plant_id:'B',plant_name:'Planta B',section:'Silos',item_name:'Foto B',year_month:'2026-10',created_at:'2026-10-03T12:00:00Z'},
   {id:'p2',plant_id:'A',plant_name:'Planta A',section:'Agregados',item_name:'Foto A',year_month:'2026-10',created_at:'2026-10-02T12:00:00Z'},
   {id:'p3',plant_id:'A',plant_name:'Planta A',section:'Productos',item_name:'Foto producto',year_month:'2026-10',created_at:'2026-10-01T12:00:00Z'},
  ].map(p=>({...p,notes:null,photo_url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='}))};
  else if(path.endsWith('/modules/config'))reply={success:true,data:{modules:{products:{enabled:true},review_approve:{enabled:true}}}};
  else if(path.endsWith('/reports')||path.endsWith('/audit/flow')){
   reportQueries.push(Object.fromEntries(q));const filtered=rows.filter(row=>(!q.get('plant_id')||row.plant_id===q.get('plant_id'))&&(!q.get('year')||row.year_month.startsWith(q.get('year')))&&(!q.get('month')||row.year_month.endsWith('-'+q.get('month')))&&(!q.get('status')||row.status===q.get('status')));if(q.get('activity_order'))filtered.sort((a,b)=>(Date.parse(a.activity_at)-Date.parse(b.activity_at))*(q.get('activity_order')==='asc'?1:-1));const offset=Number(q.get('offset')||0),limit=Number(q.get('limit')||50);
   reply=legacy?{success:true,data:filtered.slice(0,200)}:{success:true,reporting_version:3,data:filtered.slice(offset,offset+limit),pagination:{offset,limit,total:filtered.length,has_more:offset+limit<filtered.length},totals:{total:filtered.length,in_progress:filtered.filter(r=>r.status==='IN_PROGRESS').length,submitted:0,approved:filtered.filter(r=>r.status==='APPROVED').length},years:['2026','2025'],snapshot_id:'fixture',as_of:'2026-10-04T19:00:00Z'};
  }else if(path.endsWith('/audit/logs'))reply={success:true,reporting_version:3,data:[{id:'event',action:'SECTION_SAVED',user_name:user.name,timestamp:'2026-10-04T18:00:00Z',details:{section:'products',captured_count:1,complete_count:0,pending_count:1,client_occurred_at:'2026-10-04T15:00:00Z'}}],pagination:{offset:0,limit:50,total:1,has_more:false},as_of:'2026-10-04T19:00:00Z'};
  else if(/\/reports\/m\d+$/.test(path)&&route.request().method()==='DELETE'){deleteRequests.push(route.request().postDataJSON());reply={success:true,deleted_photos:0,warnings:[]};}
  else if(/\/reports\/m\d+$/.test(path)){
   if(slow)await new Promise(resolve=>setTimeout(resolve,1000));
   if(failDetail&&path.endsWith('/m1')){status=500;reply={success:false,error:'Detalle no disponible'};}else reply={success:true,reporting_version:3,data:detail(rows.find(r=>path.endsWith('/'+r.id)))};
  }
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(reply),headers:{'access-control-allow-origin':'*'}}).catch(()=>{});
 });
 const page=await app.newPage();page.setDefaultTimeout(15000);const errors=[],downloads=[];page.on('pageerror',e=>errors.push(e.message));page.on('download',d=>downloads.push(d));
 await page.goto(origin);await page.getByRole('button',{name:/Reportes/,exact:false}).first().click();await page.getByText(/Mostrando 1–50 de 251/).waitFor();
 assert.equal(reportQueries[0].activity_order,'desc');assert.equal(await page.locator('th[aria-sort="descending"]').count(),1);assert.equal(await page.locator('tbody tr').first().locator('td').first().innerText(),'Planta B\n\n2026-10');
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();await page.getByText(/Mostrando 51–100 de 251/).waitFor();
 await page.locator('select').nth(1).selectOption('2026');await page.getByText(/Mostrando 1–2 de 2/).waitFor();assert.ok(reportQueries.some(q=>q.year==='2026'));
 for(const width of [360,390,430]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`report page overflow at ${width}`);}
 await page.getByRole('button',{name:'Ver detalle y cronología'}).first().click();await page.locator('summary').filter({hasText:'Aceites y Productos'}).click();await page.getByText('Producto cero',{exact:true}).first().waitFor();await page.getByText(/Informado por el móvil:/).waitFor();assert.ok(await page.getByText('Sin comparación: período anterior no disponible').count());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'detail must not overflow outer viewport');await page.screenshot({path:'/private/tmp/promix-phase3-reports-mobile.png',fullPage:true});
 await page.keyboard.press('Escape');
 const xlsxDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Excel · todos los resultados',exact:true}).click();const xlsx=await xlsxDownload;await xlsx.saveAs('/private/tmp/promix-phase3-browser.xlsx');await page.getByText(/Archivo generado con todos/).waitFor();
 const workbook=XLSX.readFile('/private/tmp/promix-phase3-browser.xlsx');assert.equal(workbook.Sheets['Información'].B4.v,2);assert.ok(Object.values(workbook.Sheets['Consolidado']).some(cell=>cell?.t==='n'&&cell.v===0));assert.ok(Object.values(workbook.Sheets['Evidencias']).some(cell=>String(cell?.v).includes('Fotografía no disponible')));assert.equal(new Set(workbook.SheetNames).size,workbook.SheetNames.length);
 const pdfDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar PDF',exact:true}).click();const pdf=await pdfDownload;await pdf.saveAs('/private/tmp/promix-phase3-browser.pdf');await page.getByText(/Archivo generado con todos/).waitFor();assert.ok(photoHeaders.length);assert.ok(photoHeaders.every(headers=>!headers.authorization));
 const before=downloads.length;failDetail=true;await page.getByRole('button',{name:'Excel · todos los resultados',exact:true}).click();await page.getByRole('alert').filter({hasText:/No se generó el archivo/}).waitFor();assert.match(await page.getByRole('alert').innerText(),/B \/ 2026-10/);assert.equal(downloads.length,before);failDetail=false;
 slow=true;await page.getByRole('button',{name:'Excel · todos los resultados',exact:true}).click();await page.getByRole('button',{name:'Cancelar exportación',exact:true}).click();await page.getByRole('alert').filter({hasText:'Exportación cancelada'}).waitFor();assert.equal(downloads.length,before);slow=false;
 await page.setViewportSize({width:1280,height:900});
 assert.equal(await page.locator('tbody tr').first().locator('td').first().innerText(),'Planta B\n\n2026-10');
 await page.getByRole('button',{name:'Ordenar por actividad recibida',exact:true}).click();await page.waitForTimeout(150);assert.equal(await page.locator('tbody tr').first().locator('td').first().innerText(),'Planta A\n\n2026-10');
 await page.getByRole('button',{name:'Ordenar por actividad recibida',exact:true}).click();await page.waitForTimeout(150);assert.equal(await page.locator('tbody tr').first().locator('td').first().innerText(),'Planta B\n\n2026-10');
 await page.getByRole('button',{name:'Ordenar por actividad recibida',exact:true}).click();await page.waitForTimeout(150);
 assert.ok(reportQueries.some(q=>q.activity_order==='desc'));assert.ok(reportQueries.some(q=>q.activity_order==='asc'));
 await page.getByRole('button',{name:'Eliminar',exact:true}).first().click();await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(deleteRequests.length,0);
 await page.getByRole('button',{name:'Eliminar',exact:true}).first().click();await page.getByRole('button',{name:'Eliminar inventario',exact:true}).click();await page.waitForTimeout(200);assert.equal(deleteRequests.length,1);assert.deepEqual(deleteRequests[0],{confirm:true,plant_id:'A',year_month:'2026-10',write_revision:1});
 await page.screenshot({path:'/private/tmp/promix-report-order.png',fullPage:true});
 legacy=true;await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.getByRole('alert').filter({hasText:/Actualiza el servidor/}).waitFor();assert.equal(downloads.length,before);assert.deepEqual(errors,[]);
 await page.getByRole('button',{name:/Reporte de Fotos/}).first().click();await page.getByText('Mostrando 3 fotos',{exact:true}).waitFor();
 const photoItems=()=>page.locator('tbody tr td:nth-child(3)').allTextContents();
 assert.deepEqual((await photoItems()).map(s=>s.trim()),['Foto B','Foto A','Foto producto']);
 await page.getByRole('button',{name:'Ordenar por Fecha / Hora',exact:true}).click();assert.deepEqual((await photoItems()).map(s=>s.trim()),['Foto producto','Foto A','Foto B']);
 await page.getByRole('button',{name:'Ordenar por Planta',exact:true}).click();assert.deepEqual((await photoItems()).map(s=>s.trim()),['Foto A','Foto producto','Foto B']);
 await page.getByRole('button',{name:'Ordenar por Planta',exact:true}).click();assert.equal((await photoItems())[0].trim(),'Foto B');
 await page.getByRole('button',{name:'Ordenar por Sección',exact:true}).click();assert.deepEqual((await photoItems()).map(s=>s.trim()),['Foto producto','Foto A','Foto B']);
 await page.getByRole('combobox',{name:'Sección',exact:true}).selectOption('Aceites y Productos');assert.deepEqual((await photoItems()).map(s=>s.trim()),['Foto producto']);await page.getByText('Mostrando 1 foto',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Limpiar',exact:true}).click();await page.getByText('Mostrando 3 fotos',{exact:true}).waitFor();
 for(const width of [360,390,430]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`photo page overflow at ${width}`);}
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'/private/tmp/promix-photo-order.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('Photo section filter, three sortable columns, activity ordering and delete confirmation/cancel passed.');
 console.log('Built app passed: 251 reports, pagination/filter totals, mobile 360/390/430, saved details/timeline, actual numeric XLSX and PDF downloads, missing-photo disclosure, no credentials sent to images, no partial export, cancellation and old-server protection.');await app.close();
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
