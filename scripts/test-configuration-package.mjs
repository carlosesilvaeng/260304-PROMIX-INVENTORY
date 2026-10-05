import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {canonicalJSON,configurationDigest,validateConfigurationPackage,createConfigurationPackage,CONFIG_TABLES} from '../supabase/functions/make-server/configuration_package.ts';
import {configurationFixture} from './configuration-fixtures.mjs';
const require=createRequire(import.meta.url),XLSX=require('xlsx');
const bundled=await build({stdin:{contents:"export * from './src/app/utils/configurationWorkbook.ts';export * from './src/app/utils/configurationWorkbookImport.ts';export * from './src/app/utils/configurationExcelFormat.ts';export * from './src/app/utils/configurationTransport.ts';export * from './src/app/utils/exportPlantConfigurations.ts';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,logLevel:'silent',plugins:[{name:'synthetic',setup(builder){builder.onResolve({filter:/^\/utils\/supabase\/info$/},()=>({path:'fixture',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"export const projectId='synthetic';",loader:'js'}));}}]});
const compiled={exports:{}};new Function('require','module','exports',bundled.outputFiles[0].text)(require,compiled,compiled.exports);
const {createConfigurationWorkbook,readConfigurationWorkbook,plantExcelLabel,configurationFieldLabel,tableSheetName,getConfigurationPackage,previewConfiguration,applyConfiguration,exportPlantConfigurations}=compiled.exports;
test('canonical integrity is independent of object order and covers metadata',async()=>{assert.equal(canonicalJSON({b:2,a:1}),canonicalJSON({a:1,b:2}));assert.equal(await configurationDigest({a:1}),await configurationDigest({a:1}));const file=await configurationFixture();assert.equal((await validateConfigurationPackage(JSON.parse(JSON.stringify(file)))).payload.plant.id,'A');const altered=structuredClone(file);altered.origin.environment='other';await assert.rejects(()=>validateConfigurationPackage(altered),/integridad/);});
test('numeric, inactive rows and complete point metadata survive JSON roundtrip',async()=>{const file=await configurationFixture(),loaded=await validateConfigurationPackage(JSON.parse(JSON.stringify(file)));assert.equal(loaded.payload.tables.plant_diesel_config[0].initial_inventory_gallons,0);assert.equal(loaded.payload.tables.plant_diesel_config[0].is_active,false);assert.equal(loaded.payload.tables.calibration_curve_points[0].consumed_gallons,100);assert.equal(Object.keys(loaded.payload.tables).length,CONFIG_TABLES.length);});
test('tampering, unsupported versions and incomplete sections are rejected',async()=>{for(const mutate of [file=>file.version=2,file=>file.payload.tables.plant_products_config[0].unit_volume=99,file=>delete file.payload.tables.plant_diesel_config,file=>file.payload.tables.inventory_month=[]]){const file=await configurationFixture();mutate(file);await assert.rejects(()=>validateConfigurationPackage(file));}});
test('duplicate identities, foreign plants and undeclared fields are rejected before preview',async()=>{for(const mutate of [p=>p.tables.plant_products_config.push({...p.tables.plant_products_config[0]}),p=>p.tables.plant_products_config[0].plant_id='other',p=>p.tables.plant_products_config[0].unexpected='bad']){const file=await configurationFixture();mutate(file.payload);await assert.rejects(()=>createConfigurationPackage(file.payload,'test'));}});
test('unsupported JSON values and deep nesting cannot produce a misleading checksum',()=>{for(const value of [NaN,Infinity,undefined,()=>{},new Date()])assert.throws(()=>canonicalJSON({value}));let nested={};for(let i=0;i<51;i++)nested={nested};assert.throws(()=>canonicalJSON(nested));});
test('actual Excel preserves numerical zero, inactive rows, dimensions and all calibration points',async()=>{const file=await configurationFixture(),workbook=await createConfigurationWorkbook([file]);const saved=XLSX.read(await workbook.xlsx.writeBuffer(),{type:'buffer'});assert.equal(saved.SheetNames.length,23);const diesel=XLSX.utils.sheet_to_json(saved.Sheets['Diésel'],{header:1});assert.ok(diesel.flat().includes('No'));assert.ok(diesel.flat().includes(0));const points=XLSX.utils.sheet_to_json(saved.Sheets['Puntos de calibración'],{header:1});assert.ok(points.flat().includes('EMPTY'));assert.ok(points.flat().includes(100));assert.ok(Object.values(saved.Sheets['Agregados']).some(cell=>cell?.t==='n'&&cell.v===0));});
test('export validates server version, file integrity and requested plant identity',async()=>{const old=global.fetch;try{const file=await configurationFixture();for(const reply of [{success:true,data:file},{success:true,configuration_version:1,data:{...file,version:2}},{success:true,configuration_version:1,data:await configurationFixture('B')}]){global.fetch=async()=>new Response(JSON.stringify(reply));await assert.rejects(()=>getConfigurationPackage('A','token'));}}finally{global.fetch=old;}});
test('preview and execution send exactly the reviewed file and options with authenticated identity',async()=>{const old=global.fetch,calls=[];const file=await configurationFixture(),options={create_dependencies:false,deactivate_extras:true};global.fetch=async(url,request)=>{calls.push({url,request});return new Response(JSON.stringify({success:true,configuration_version:1,data:url.endsWith('/preview')?{changes:[],errors:[],warnings:[],destination:{id:'B'},summary:{},expires_at:'2026-10-04T21:00:00Z',preview_token:'22222222-2222-4222-8222-222222222222'}:{plant_id:'B'}}));};try{await previewConfiguration('B',file,options,'token');await applyConfiguration('B',file,options,'t','token');assert.equal(calls[0].request.headers.Authorization,'Bearer token');assert.deepEqual(JSON.parse(calls[1].request.body),{package:file,options,preview_token:'t'});global.fetch=async()=>new Response(JSON.stringify({success:true,configuration_version:1,data:{changes:[],errors:[],warnings:[],destination:{id:'B'}}}));await assert.rejects(()=>previewConfiguration('B',file,options,'token'),/vista previa incompleta/);}finally{global.fetch=old;}});
test('cancellation prevents sending an import and errors preserve permission failures',async()=>{const old=global.fetch;try{const controller=new AbortController();controller.abort();await assert.rejects(()=>getConfigurationPackage('A','token',controller.signal),{name:'AbortError'});global.fetch=async()=>new Response(JSON.stringify({success:false,error:'Acceso no autorizado'}),{status:403});await assert.rejects(()=>getConfigurationPackage('A','token'),/Acceso no autorizado/);}finally{global.fetch=old;}});
test('a failure for one plant prevents the entire Excel export',async()=>{const old=global.fetch,file=await configurationFixture();global.fetch=async url=>new Response(JSON.stringify(url.includes('/B/')?{success:false,error:'Falló B'}:{success:true,configuration_version:1,data:file}),{status:url.includes('/B/')?500:200});try{await assert.rejects(()=>exportPlantConfigurations([{id:'A',name:'Planta A'},{id:'B',name:'Planta B'}],{token:'test'}),/No se generó el archivo.*Planta B/s);}finally{global.fetch=old;}});

test('Excel stores exact decimals in editable cells and preserves long protected data',async()=>{const file=await configurationFixture();file.payload.tables.material_conversion_factors[0].factor='1234.123456789012';file.payload.tables.calibration_curves[0].data_points=JSON.stringify({complete:'x'.repeat(61000)});const signed=await createConfigurationPackage(file.payload,'test'),workbook=await createConfigurationWorkbook([signed]),saved=XLSX.read(await workbook.xlsx.writeBuffer(),{type:'buffer'});assert.ok(Object.values(saved.Sheets['Factores de conversión']).some(cell=>cell?.t==='s'&&cell.v==='1234.123456789012'));const [loaded]=await readConfigurationWorkbook(await workbook.xlsx.writeBuffer());assert.equal(loaded.modified,false);assert.deepEqual(loaded.configuration,signed);});

test('embedded curve JSON retains exact decimal tokens through package serialization',async()=>{const file=await configurationFixture();file.payload.tables.calibration_curves[0].data_points='{"0":1234.12345678901234567890}';const signed=await createConfigurationPackage(file.payload,'test'),loaded=await validateConfigurationPackage(JSON.parse(JSON.stringify(signed)));assert.equal(loaded.payload.tables.calibration_curves[0].data_points,'{"0":1234.12345678901234567890}');});

function cell(workbook,table,field,line=4){
  const sheet=workbook.getWorksheet(tableSheetName(table)),header=configurationFieldLabel(field);
  const column=sheet.getRow(3).values.findIndex(value=>value===header);
  assert.ok(column>0,`Missing ${table}.${field}`);return sheet.getCell(line,column);
}
async function excelFixture(){const file=await configurationFixture();return {file,workbook:await createConfigurationWorkbook([file])};}
test('editable Excel roundtrip is exact, also with multiple plants and shared identifiers',async()=>{
  const files=[await configurationFixture('A'),await configurationFixture('B')];
  const workbook=await createConfigurationWorkbook(files),parsed=await readConfigurationWorkbook(await workbook.xlsx.writeBuffer());
  assert.equal(parsed.length,2);assert.deepEqual(parsed.map(entry=>entry.configuration),files);assert.ok(parsed.every(entry=>!entry.modified));
  const sheet=workbook.getWorksheet('Agregados');assert.equal(sheet.getColumn(2).hidden,true);assert.equal(cell(workbook,'plant_aggregates_config','id').protection.locked,true);
  assert.equal(cell(workbook,'plant_aggregates_config','box_width_ft').protection.locked,false);assert.ok(cell(workbook,'plant_aggregates_config','is_active').dataValidation);
  assert.equal(workbook.getWorksheet('_PROMIX').state,'veryHidden');
});
test('Excel applies visible edits to names, dimensions, states, amounts and plant parameters',async()=>{
  const {file,workbook}=await excelFixture();
  cell(workbook,'plant_products_config','product_name').value='Aceite nuevo';cell(workbook,'plant_products_config','unit_volume').value=75;
  cell(workbook,'plant_products_config','is_active').value='No';cell(workbook,'plant_aggregates_config','box_width_ft').value=4;
  workbook.getWorksheet('Parámetros de planta').getCell(6,3).value=300;
  const [parsed]=await readConfigurationWorkbook(await workbook.xlsx.writeBuffer());assert.equal(parsed.modified,true);
  const payload=parsed.configuration.payload;assert.equal(payload.tables.plant_products_config[0].product_name,'Aceite nuevo');
  assert.equal(payload.tables.plant_products_config[0].unit_volume,'75');assert.equal(payload.tables.plant_products_config[0].is_active,false);
  assert.equal(payload.tables.plant_aggregates_config[0].box_width_ft,'4');assert.equal(payload.plant.petty_cash_established,'300');
  assert.notEqual(parsed.configuration.integrity.digest,file.integrity.digest);await validateConfigurationPackage(parsed.configuration);
});
test('new equipment receives an ID, omission leaves destination equipment to retain, and new references resolve',async()=>{
  const {file,workbook}=await excelFixture();const line=5;
  workbook.getWorksheet('Aceites y productos').getCell(line,1).value=plantExcelLabel(file);
  cell(workbook,'plant_products_config','product_name',line).value='Nuevo equipo';cell(workbook,'plant_products_config','unit',line).value='m3';
  cell(workbook,'plant_products_config','unit_volume',line).value=55;cell(workbook,'plant_products_config','is_active',line).value='Sí';
  const materialSheet=workbook.getWorksheet('Materiales');materialSheet.getCell(line,1).value=plantExcelLabel(file);
  cell(workbook,'materiales_catalog','nombre',line).value='Grava';cell(workbook,'materiales_catalog','clase',line).value='AGGREGATE';
  const factorSheet=workbook.getWorksheet('Factores de conversión');factorSheet.getCell(line,1).value=plantExcelLabel(file);
  for(const [field,value] of Object.entries({material_id:'Grava',from_unit_id:'m3',to_unit_id:'m3',factor:'2.12345678901234567890'}))cell(workbook,'material_conversion_factors',field,line).value=value;
  workbook.getWorksheet('Cajones').spliceRows(4,1);
  const [parsed]=await readConfigurationWorkbook(await workbook.xlsx.writeBuffer()),tables=parsed.configuration.payload.tables;
  assert.match(tables.plant_products_config[1].id,/^[a-f0-9-]{36}$/);assert.equal(tables.plant_products_config[1].plant_id,'A');
  assert.equal(tables.material_conversion_factors[1].material_id,tables.materiales_catalog[1].id);
  assert.equal(tables.material_conversion_factors[1].factor,'2.12345678901234567890');assert.equal(tables.plant_cajones_config.length,0);
});
test('a reference survives renaming its dependency and changing it selects another dependency',async()=>{
  const {file,workbook}=await excelFixture();cell(workbook,'materiales_catalog','nombre').value='Arena renombrada';
  const [parsed]=await readConfigurationWorkbook(await workbook.xlsx.writeBuffer());assert.equal(parsed.configuration.payload.tables.material_conversion_factors[0].material_id,'material');
  const updated=structuredClone(file);updated.payload.tables.materiales_catalog.push({id:'second',nombre:'Grava',clase:'AGGREGATE',is_active:true});
  const second=await createConfigurationWorkbook([await createConfigurationPackage(updated.payload,'test')]);
  cell(second,'material_conversion_factors','material_id').value='Grava';const [changed]=await readConfigurationWorkbook(await second.xlsx.writeBuffer());
  assert.equal(changed.configuration.payload.tables.material_conversion_factors[0].material_id,'second');
});
test('invalid Excel values, formulas, IDs, headers and dependencies are rejected with a cell location',async()=>{
  for(const [mutate,pattern] of [
    [workbook=>cell(workbook,'plant_products_config','unit_volume').value={formula:'1+1',result:2},/Aceites y productos.*fila 4.*columna.*fórmulas/],
    [workbook=>cell(workbook,'plant_products_config','is_active').value='quizás',/fila 4.*Activo.*Sí o No/],
    [workbook=>cell(workbook,'plant_products_config','unit_volume').value='12,34',/fila 4.*decimal/],
    [workbook=>cell(workbook,'plant_products_config','id').value='unknown',/fila 4.*Identificador.*alterado/],
    [workbook=>cell(workbook,'plant_aggregates_config','sort_order').value=1.5,/fila 4.*Orden.*entero/],
    [workbook=>cell(workbook,'plant_products_config','product_name',3).value='Otra columna',/fila 3.*encabezado/],
    [workbook=>cell(workbook,'material_conversion_factors','material_id').value='Inexistente',/fila 4.*Material.*inexistente/],
    [workbook=>cell(workbook,'calibration_curves','data_points').value='{}',/fila 4.*protegido/],
  ]){const {workbook}=await excelFixture();mutate(workbook);await assert.rejects(()=>workbook.xlsx.writeBuffer().then(readConfigurationWorkbook),pattern);}
});
test('duplicated equipment IDs, ambiguous references and duplicated natural keys block the entire workbook',async()=>{
  const {file,workbook}=await excelFixture(),sheet=workbook.getWorksheet('Aceites y productos');sheet.getRow(5).values=sheet.getRow(4).values;
  await assert.rejects(()=>workbook.xlsx.writeBuffer().then(readConfigurationWorkbook),/Identificador duplicado/);
  cell(workbook,'plant_products_config','id',5).value=null;cell(workbook,'plant_products_config','plant_id',5).value=null;
  await assert.rejects(()=>workbook.xlsx.writeBuffer().then(readConfigurationWorkbook),/Dos filas identifican/);
  const ambiguous=structuredClone(file);ambiguous.payload.tables.materiales_catalog.push({id:'another',nombre:'Arena',clase:'OTHER',is_active:true});
  const other=await createConfigurationWorkbook([await createConfigurationPackage(ambiguous.payload,'test')]);cell(other,'material_conversion_factors','material_id').value='Arena';
  await assert.rejects(()=>other.xlsx.writeBuffer().then(readConfigurationWorkbook),/Referencia ambigua/);
});
test('missing sheets, incomplete metadata, legacy spreadsheets, damaged files and cancellation are rejected',async()=>{
  const {workbook}=await excelFixture();workbook.removeWorksheet(workbook.getWorksheet('Silos').id);
  await assert.rejects(()=>workbook.xlsx.writeBuffer().then(readConfigurationWorkbook),/Falta la hoja Silos/);
  const {workbook:legacy}=await excelFixture();legacy.removeWorksheet(legacy.getWorksheet('_PROMIX').id);
  await assert.rejects(()=>legacy.xlsx.writeBuffer().then(readConfigurationWorkbook),/documental.*Vuelve a exportar/);
  const {workbook:damaged}=await excelFixture();damaged.getWorksheet('_PROMIX').getCell('B2').value='{}';
  await assert.rejects(()=>damaged.xlsx.writeBuffer().then(readConfigurationWorkbook),/datos internos/);
  await assert.rejects(()=>readConfigurationWorkbook(new Uint8Array([1,2,3]).buffer),/No se pudo leer/);
  const controller=new AbortController();controller.abort();await assert.rejects(()=>readConfigurationWorkbook(new ArrayBuffer(0),controller.signal),{name:'AbortError'});
});
test('reordering rows does not change a package, protected relations cannot disappear, and deleted allowed products are retained',async()=>{
  const {file,workbook}=await excelFixture(),sheet=workbook.getWorksheet('Puntos de calibración');
  const a=sheet.getRow(4).values,b=sheet.getRow(5).values;sheet.getRow(4).values=b;sheet.getRow(5).values=a;
  workbook.getWorksheet('Productos permitidos por silo').spliceRows(4,1);
  const [loaded]=await readConfigurationWorkbook(await workbook.xlsx.writeBuffer());assert.equal(loaded.modified,false);assert.deepEqual(loaded.configuration,file);
  sheet.spliceRows(4,1);await assert.rejects(()=>workbook.xlsx.writeBuffer().then(readConfigurationWorkbook),/Faltan datos protegidos/);
});
test('malformed rows in an unselected plant are rejected before any package can be previewed',async()=>{
  const files=[await configurationFixture('A'),await configurationFixture('B')],workbook=await createConfigurationWorkbook(files);
  cell(workbook,'plant_products_config','unit_volume',5).value='mal';
  await assert.rejects(()=>workbook.xlsx.writeBuffer().then(readConfigurationWorkbook),/fila 5.*decimal/);
});
test('small numeric edits expand exponents and values beyond Excel precision require exact text',async()=>{
  const {workbook}=await excelFixture();cell(workbook,'plant_aggregates_config','box_width_ft').value=1e-20;
  const [parsed]=await readConfigurationWorkbook(await workbook.xlsx.writeBuffer());assert.equal(parsed.configuration.payload.tables.plant_aggregates_config[0].box_width_ft,'0.00000000000000000001');
  cell(workbook,'plant_aggregates_config','box_width_ft').value=1.1234567890123457;
  await assert.rejects(()=>workbook.xlsx.writeBuffer().then(readConfigurationWorkbook),/precisión de Excel/);
  cell(workbook,'plant_aggregates_config','box_width_ft').value='1.12345678901234567890';
  const [exact]=await readConfigurationWorkbook(await workbook.xlsx.writeBuffer());assert.equal(exact.configuration.payload.tables.plant_aggregates_config[0].box_width_ft,'1.12345678901234567890');
});
test('curve selection copies the selected exact protected data and invalid method/negative values are rejected',async()=>{
  const file=await configurationFixture(),payload=file.payload,silo=payload.tables.plant_silos_config[0];
  silo.calculation_method='CALIBRATION_CURVE';silo.conversion_table=payload.tables.calibration_curves[0].data_points;
  payload.schema.plant_silos_config.push('calculation_method','conversion_table');payload.json_fields.plant_silos_config.push('conversion_table');
  payload.tables.calibration_curves.push({...payload.tables.calibration_curves[0],id:'second-curve',curve_name:'Segunda',data_points:'{"0":1234.12345678901234567890}'});
  const workbook=await createConfigurationWorkbook([await createConfigurationPackage(payload,'test')]);cell(workbook,'plant_silos_config','calibration_curve_name').value='Segunda';
  const [parsed]=await readConfigurationWorkbook(await workbook.xlsx.writeBuffer());assert.equal(parsed.configuration.payload.tables.plant_silos_config[0].conversion_table,'{"0":1234.12345678901234567890}');
  cell(workbook,'plant_silos_config','calibration_curve_name').value='No existe';await assert.rejects(()=>workbook.xlsx.writeBuffer().then(readConfigurationWorkbook),/curva seleccionada no existe/);
  const {workbook:invalid}=await excelFixture();cell(invalid,'plant_products_config','unit_volume').value=-2;await assert.rejects(()=>invalid.xlsx.writeBuffer().then(readConfigurationWorkbook),/no puede ser negativo/);
  cell(invalid,'plant_products_config','unit_volume').value=0;await assert.rejects(()=>invalid.xlsx.writeBuffer().then(readConfigurationWorkbook),/mayor que cero/);
  cell(invalid,'plant_products_config','unit_volume').value=55;cell(invalid,'plant_products_config','measure_mode').value='INVALID';await assert.rejects(()=>invalid.xlsx.writeBuffer().then(readConfigurationWorkbook),/Opción no permitida/);
});
test('metadata chunk boundaries preserve Unicode and source timestamps exactly',async()=>{
  const file=await configurationFixture();file.payload.tables.plant_products_config[0].notes='🌴'.repeat(20000);file.payload.schema.plant_products_config.push('notes');
  file.payload.tables.plant_products_config[0].updated_at='2026-10-04T12:00:00-04:00';file.payload.schema.plant_products_config.push('updated_at');
  const signed=await createConfigurationPackage(file.payload,'test'),workbook=await createConfigurationWorkbook([signed]);
  const [parsed]=await readConfigurationWorkbook(await workbook.xlsx.writeBuffer());assert.equal(parsed.modified,false);assert.deepEqual(parsed.configuration,signed);
  file.payload.tables.plant_products_config[0].notes='Caracteres ñ 🌴, literal _x0041_, salto\r\ny texto';
  const short=await createConfigurationPackage(file.payload,'test'),shortBook=await createConfigurationWorkbook([short]);
  const [roundtrip]=await readConfigurationWorkbook(await shortBook.xlsx.writeBuffer());assert.equal(roundtrip.modified,false);assert.deepEqual(roundtrip.configuration,short);
});
