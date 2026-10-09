// Real Chromium against the built app; every remote request uses synthetic fixtures.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PROMIX_PLAYWRIGHT_MODULE || 'playwright');
const output = resolve('outputs/appearance-palettes');
await mkdir(output, { recursive: true });
const servers = [];
async function serve(directory) {
 const root = resolve(directory);
 const server = createServer(async (req, res) => {
  try {
   const pathname = new URL(req.url, 'http://localhost').pathname;
   const path = resolve(root, pathname === '/' ? 'index.html' : '.' + pathname);
   if (!path.startsWith(root + '/')) throw Error('Invalid path');
   res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(path)] || 'application/octet-stream');
   res.end(await readFile(path));
  } catch { res.writeHead(404); res.end(); }
 });
 await new Promise(r => server.listen(0, '127.0.0.1', r));
 servers.push(server);
 return `http://127.0.0.1:${server.address().port}`;
}
const origin = await serve('dist');
let browser;
let sharedPalette = 'original';
const writes = [], errors = [];
let failWrite = false, failRead = false, slowRead = false, releaseRead;
const plants = [{id:'A',name:'Planta A',code:'A',location:'Prueba',is_active:true,silos:[],cajones:[],methods:{}}];
async function session(role = 'admin', width = 1280, authenticated = true) {
 const context = await browser.newContext({viewport:{width,height:900}});
 const user = {id:`synthetic-${role}`,name:'Usuario de prueba',email:'user@example.invalid',role,assigned_plants:['A'],is_active:true};
 const token = `e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:user.id})).toString('base64url')}.synthetic`;
 if (authenticated) await context.addInitScript(({user,token}) => {localStorage.setItem('promix_access_token',token);localStorage.setItem('promix_user',JSON.stringify(user));if(['plant_manager','operations_manager'].includes(user.role))localStorage.setItem('promix_plant',JSON.stringify({id:'A'}));}, {user,token});
 await context.route('https://*.supabase.co/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  let reply = {success:true,data:[]}, status = 200;
  if (path.endsWith('/auth/check-first-time')) reply={success:true,isFirstTime:false,userCount:1};
  else if (path.endsWith('/auth/verify')) reply={success:true,user};
  else if (path.endsWith('/plants')) reply={success:true,data:plants};
  else if (path.endsWith('/modules/config')) reply={success:true,data:{modules:Object.fromEntries(['aggregates','silos','additives','diesel','products','utilities','petty_cash','review_approve'].map(k=>[k,{enabled:true}]))}};
  else if (path.endsWith('/appearance/config')) {
   if(request.method()==='POST') {
    writes.push(request.postDataJSON());
    if(failWrite) {status=500;reply={success:false,error:'No se pudo guardar la apariencia.'};}
    else if(!['admin','super_admin'].includes(role)) {status=403;reply={success:false,error:'Forbidden'};}
    else {sharedPalette=request.postDataJSON().palette;reply={success:true,data:{palette:sharedPalette}};}
   } else {
    const snapshot=sharedPalette;
    if(slowRead) {slowRead=false;await new Promise(r=>{releaseRead=r;});}
    if(failRead) {status=500;reply={success:false,error:'No se pudo cargar la apariencia.'};}
    else reply={success:true,data:{palette:snapshot}};
   }
  }
  else if(path.endsWith('/reports')) reply={success:true,reporting_version:3,data:[],pagination:{offset:0,limit:50,total:0,has_more:false},totals:{total:0,in_progress:0,submitted:0,approved:0},years:['2026']};
  else if(path.endsWith('/inventory/month')) reply={success:false,error:'Month not found'};
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(reply)});
 });
 const page=await context.newPage();await page.clock.install();page.on('pageerror',e=>errors.push(e.message));
 return {context,page};
}
async function openSettings(page) {
 await page.getByRole('button',{name:/Configuración|Settings/,exact:true}).first().click();
 await page.getByRole('button',{name:'Apariencia',exact:true}).click();
 await page.getByRole('radio',{name:/Command/}).waitFor();
}
async function rootPalette(page) {return page.locator('html').getAttribute('data-palette');}
async function expectPalette(page,value) {await page.waitForFunction(v=>document.documentElement.dataset.palette===v,value);}
async function styles(page) {
 return page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>!['SCRIPT','STYLE'].includes(e.tagName)).map(e=>{
  const c=getComputedStyle(e),r=e.getBoundingClientRect();
  return {tag:e.tagName,text:e.children.length?'':e.textContent,fg:c.color,bg:c.backgroundColor,border:c.borderColor,background:c.backgroundImage,width:r.width,height:r.height,x:r.x,y:r.y};
 }));
}
try {
 browser=await chromium.launch({channel:'chrome',headless:true});
 const admin=await session();await admin.page.goto(origin);await admin.page.getByRole('button',{name:/Configuración|Settings/,exact:true}).first().waitFor();await admin.page.evaluate(()=>document.fonts.ready);
 // Compare default rendering against the unmodified repository when supplied.
 if(process.env.PROMIX_BASELINE_DIST) {
  const baselineOrigin=await serve(process.env.PROMIX_BASELINE_DIST),baseline=await session();
  await baseline.page.goto(baselineOrigin);await baseline.page.getByRole('button',{name:/Configuración|Settings/,exact:true}).first().waitFor();await baseline.page.evaluate(()=>document.fonts.ready);
  await admin.page.waitForTimeout(200);await baseline.page.waitForTimeout(200);
  assert.deepEqual(await styles(admin.page),await styles(baseline.page),'Original dashboard must retain colors and layout');
  await baseline.context.close();
  const login=await session('admin',1280,false),oldLogin=await session('admin',1280,false);
  await login.page.goto(origin);await oldLogin.page.goto(baselineOrigin);
  await login.page.getByRole('button',{name:/Iniciar Sesión|Sign In/i}).waitFor();await oldLogin.page.getByRole('button',{name:/Iniciar Sesión|Sign In/i}).waitFor();
  await login.page.evaluate(()=>document.fonts.ready);await oldLogin.page.evaluate(()=>document.fonts.ready);
  assert.deepEqual(await styles(login.page),await styles(oldLogin.page),'Original login must retain colors and layout');
  await login.context.close();await oldLogin.context.close();
  console.log('Original: dashboard and login computed colors and layout match the previous build.');
 }
 await openSettings(admin.page);
 await admin.page.screenshot({path:output+'/original-desktop.png',fullPage:true,animations:'disabled'});
 assert.equal(await admin.page.getByRole('button',{name:'Guardar para toda la empresa'}).isDisabled(),true);
 await admin.page.getByRole('radio',{name:/Command/}).check();
 assert.equal(await rootPalette(admin.page),'original','Selecting a swatch must not save prematurely');
 await admin.page.getByRole('button',{name:'Guardar para toda la empresa'}).click();await expectPalette(admin.page,'command');
 assert.deepEqual(writes.at(-1),{palette:'command'});
 await admin.page.waitForTimeout(250);
 assert.equal(await admin.page.getByRole('button',{name:/Configuración|Settings/}).first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(0, 107, 145)');
 assert.notEqual(await admin.page.getByRole('button',{name:/Inicio|Home/}).first().evaluate(e=>getComputedStyle(e).color),'rgba(255, 255, 255, 0.8)');
 await admin.page.screenshot({path:output+'/command-desktop.png',fullPage:true,animations:'disabled'});
 const nav=admin.page.locator('nav').first();assert.equal(await nav.evaluate(e=>getComputedStyle(e.parentElement).backgroundColor),'rgb(240, 250, 252)');
 await admin.page.reload();await expectPalette(admin.page,'command');await openSettings(admin.page);
 const second=await session('super_admin');await second.page.goto(origin);await expectPalette(second.page,'command');await openSettings(second.page);
 await second.page.getByRole('radio',{name:/Original/}).check();await second.page.getByRole('button',{name:'Guardar para toda la empresa'}).click();await expectPalette(second.page,'original');
 await admin.page.clock.runFor(60001);await expectPalette(admin.page,'original');
 // A failed write keeps the last confirmed palette and leaves retry available.
 failWrite=true;await admin.page.getByRole('radio',{name:/Command/}).check();await admin.page.getByRole('button',{name:'Guardar para toda la empresa'}).click();await admin.page.getByText('No se pudo guardar la apariencia.',{exact:true}).waitFor();assert.equal(await rootPalette(admin.page),'original');failWrite=false;
 // Slow reads started before a save cannot roll back the newly confirmed palette.
 slowRead=true;await admin.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await admin.page.waitForTimeout(100);assert.ok(releaseRead);
 await admin.page.getByRole('button',{name:'Guardar para toda la empresa'}).click();await expectPalette(admin.page,'command');releaseRead();await admin.page.waitForTimeout(150);assert.equal(await rootPalette(admin.page),'command');
 // Mobile, cached reload without connectivity, and recovery of company settings.
 await admin.page.setViewportSize({width:390,height:844});await admin.page.screenshot({path:output+'/command-mobile.png',fullPage:true,animations:'disabled'});
 assert.ok(await admin.page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No mobile horizontal overflow');
 await admin.context.setOffline(true);await admin.page.evaluate(()=>window.dispatchEvent(new Event('online')));assert.equal(await rootPalette(admin.page),'command');
 await admin.context.setOffline(false);failRead=true;await admin.page.reload();await expectPalette(admin.page,'command');await openSettings(admin.page);assert.equal(await rootPalette(admin.page),'command');failRead=false;
 for(const role of ['plant_manager','operations_manager']) {
  const member=await session(role);await member.page.goto(origin);await expectPalette(member.page,'command');
  await member.page.getByRole('button',{name:/Configuración|Settings/,exact:true}).first().click();
  assert.equal(await member.page.getByRole('button',{name:'Apariencia',exact:true}).count(),0);
  await member.context.close();
 }
 // Theme refresh must not replace a live form or lose its unsaved input.
 await admin.page.setViewportSize({width:1280,height:900});await admin.page.getByRole('button',{name:'Plantas',exact:true}).click();
 await admin.page.getByRole('button',{name:/Agregar Planta|Nueva Planta/}).click();
 const field=admin.page.getByRole('textbox').first();await field.fill('Dato sin guardar');
 sharedPalette='original';await admin.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expectPalette(admin.page,'original');assert.equal(await field.inputValue(),'Dato sin guardar');
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('Appearance browser: Admin/Super Admin, other roles, shared settings, save failures, stale reads, cached fallback, mobile and unsaved form preservation passed.');
 await admin.context.close();await second.context.close();
} finally {await browser?.close();for(const s of servers)await new Promise(r=>s.close(r));}
