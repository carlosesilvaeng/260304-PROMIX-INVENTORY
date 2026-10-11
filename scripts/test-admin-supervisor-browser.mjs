// Real built app and downloads; remote requests use only synthetic fixtures.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const require=createRequire(import.meta.url),XLSX=require('xlsx');
const ExcelJS=require('exceljs');
const {chromium}=require(process.env.PROMIX_PLAYWRIGHT_MODULE||'playwright');
const output='/private/tmp/promix-admin-supervisor-ui';await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,path=resolve('dist',pathname==='/'?'index.html':'.'+pathname);if(!path.startsWith(resolve('dist')+'/'))throw Error('Invalid path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
 const user={id:'synthetic-admin',name:'Administrador de prueba',email:'admin@example.invalid',role:'admin',assigned_plants:['A'],can_capture_inventory:true,is_active:true};
 const plants=['A','B'].map(id=>({id,name:`Planta ${id}`,code:id,is_active:true,silos:[],cajones:[]}));
 const token=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:user.id})).toString('base64url')}.synthetic`;
 await context.addInitScript(({user,token})=>{localStorage.setItem('promix_access_token',token);localStorage.setItem('promix_user',JSON.stringify(user));},{user,token});
 let updated=null;
 await context.route('https://*.supabase.co/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;let reply={success:true,data:[]};
  if(path.endsWith('/auth/check-first-time'))reply={success:true,isFirstTime:false,userCount:1};
  else if(path.endsWith('/auth/verify'))reply={success:true,user};
  else if(path.endsWith('/plants'))reply={success:true,data:plants};
  else if(path.endsWith('/auth/users'))reply={success:true,users:[user]};
  else if(path.endsWith('/auth/users/'+user.id)){updated=request.postDataJSON();Object.assign(user,updated);reply={success:true,user};}
  else if(path.endsWith('/modules/config'))reply={success:true,data:{modules:{products:{enabled:true},review_approve:{enabled:true}}}};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(reply)});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('button',{name:/Inventario/,exact:false}).first().click();
 await page.getByRole('heading',{name:'Planta A',exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Planta B',exact:true}).count(),0);
 await page.getByRole('button',{name:'Volver a Inicio'}).click();
 await page.getByRole('button',{name:/Configuración/}).first().click();
 await page.getByRole('button',{name:'Usuarios',exact:true}).click();
 await page.getByText('Administrador + Supervisor',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Editar usuario'}).click();
 await page.getByLabel('También supervisor (captura y envío en plantas asignadas)').waitFor();
 assert.equal(await page.getByLabel('También supervisor (captura y envío en plantas asignadas)').isChecked(),true);
 await page.screenshot({path:output+'/admin-supervisor.png',fullPage:true});
 await page.getByLabel('También supervisor (captura y envío en plantas asignadas)').uncheck();
 await page.getByRole('button',{name:'Guardar Cambios',exact:true}).click();
 await page.getByText('Usuario actualizado exitosamente',{exact:true}).waitFor();
 assert.equal(updated.can_capture_inventory,false);assert.deepEqual(updated.assigned_plants,['A']);
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('Admin supervisor UI passed: one account, assigned plant selector, preserved settings, checkbox and revocation.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
