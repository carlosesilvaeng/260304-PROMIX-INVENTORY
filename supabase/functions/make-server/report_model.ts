// Shared by the read-only portal and both exporters. Uses stored values only;
// it never loads today's configuration or recalculates historical inventories.
export type ReportCell = string | number | null;
export interface ReportSection { code:string; name:string; headers:string[]; rows:ReportCell[][]; photos:{label:string;url:string}[]; note?:string }
export interface ReportMetric { section:string; material:string; metric:string; unit:string; value:number|null; previous:number|null; difference:number|null; comparison:string }
export interface InventoryReport { version:3; report:any; progress:any; sections:ReportSection[]; metrics:ReportMetric[]; warnings:string[] }
export const REPORT_SECTIONS = [
 ['aggregates','agregados','Agregados'],['silos','silos','Silos'],['additives','aditivos','Aditivos'],['diesel','diesel','Diésel'],
 ['products','productos','Aceites y Productos'],['utilities','utilities','Utilidades'],['petty-cash','pettyCash','Caja chica'],
] as const;
export function storedNumber(value:any):number|null {
 if(value===null||value===undefined||value==='')return null;
 if((typeof value!=='number'&&typeof value!=='string')||!String(value).trim()||!Number.isFinite(Number(value)))throw Error('Hay una cantidad guardada inválida; no se puede generar un reporte confiable.');
 return Number(value);
}
export function storedUnit(value:any):string {
 const unit=String(value||'').trim();const aliases:Record<string,string>={gallons:'gal_us',gallon:'gal_us',galones:'gal_us',gal:'gal_us',lbs:'lb',units:'unit',cubic_yards:'yd3'};
 return aliases[unit.toLowerCase()]||unit||'Sin unidad registrada';
}
export function unitLabel(value:any):string {
 const unit=storedUnit(value);const labels:Record<string,string>={ft3:'ft³',m3:'m³',yd3:'yd³',gal_us:'gal',unit:'unidades',sack:'sacos',metric_ton:'t',short_ton:'ton corta'};return labels[unit]||unit;
}
export function reportSectionLabel(code:string){return REPORT_SECTIONS.find(section=>section[0]===code)?.[2]||code;}
function rowsOf(snapshot:any,property:string){const value=snapshot[property];return Array.isArray(value)?value:value?[value]:[];}
const configKey=(row:any)=>Object.keys(row).find(key=>key.endsWith('_config_id')&&row[key]);
export function reportingMetadata(rows:any[]){return rows.map(row=>({config_id:row[configKey(row)||''],...Object.fromEntries(['capture_unit_id','reading_uom','unit','uom','inventory_unit_id','calculation_unit_id','display_unit_id','calculated_result_unit_id','measure_mode'].map(key=>[key,row[key]??null]))}));}
function storedRows(snapshot:any,code:string,property:string) {
 const metadata=snapshot.progress?.sections?.find((s:any)=>s.section===code)?.reporting_metadata||[];
 return rowsOf(snapshot,property).map(row=>{const meta=metadata.find((m:any)=>m.config_id&&m.config_id===row[configKey(row)||'']);return {...row,...(meta||{})};});
}
function nameOf(row:any,fallback:string){return row.aggregate_name||row.silo_name||row.tank_name||row.product_name||row.meter_name||fallback;}
function metricsFor(snapshot:any):ReportMetric[]{
 const metrics:ReportMetric[]=[];
 for(const [code,property,label] of REPORT_SECTIONS){for(const row of storedRows(snapshot,code,property)){
  const material=code==='silos'?row.product_name||nameOf(row,label):code==='additives'?[row.product_name,row.brand].filter(Boolean).join(' · ')||label:code==='aggregates'?row.material_type||nameOf(row,label):nameOf(row,label);
  const add=(metric:string,value:any,unit:any)=>metrics.push({section:code,material,metric,unit:storedUnit(unit),value:storedNumber(value),previous:null,difference:null,comparison:'Sin comparación'});
  if(code==='aggregates')add('Existencia',row.calculated_volume_cy,row.unit);
  if(code==='silos')add('Existencia',row.calculated_result??row.calculated_result_cy??row.calculated_volume,row.calculated_result_unit_id);
  if(code==='additives')add('Existencia',row.inventory_quantity??(row.additive_type==='MANUAL'?row.quantity:row.calculated_volume),row.inventory_unit_id||row.capacity_unit_id||row.uom);
  if(code==='diesel'){add('Existencia',row.ending_inventory,row.unit);add('Consumo',row.consumption_gallons,row.unit);add('Compras',row.purchases_gallons,row.unit);}
  if(code==='products'){
   if(['DRUM','PAIL'].includes(row.measure_mode)){add('Envases',row.unit_count??row.quantity,'envase');add('Volumen en envases',row.total_volume,row.uom);}
   else add('Existencia',row.quantity??row.calculated_quantity,row.uom);
  }
  if(code==='utilities')add('Consumo',row.consumption,row.uom);
  if(code==='petty-cash'){add('Efectivo',row.cash,row.currency);add('Recibos',row.receipts,row.currency);}
 }}return metrics;
}
const savedSum=(a:number|null,b:number|null)=>a===null||b===null?null:storedNumber(a+b);
const metricKey=(m:ReportMetric)=>JSON.stringify([m.section,m.material,m.metric,m.unit]);
function grouped(metrics:ReportMetric[]){const groups=new Map<string,ReportMetric>();for(const metric of metrics){const key=metricKey(metric),old=groups.get(key);if(!old)groups.set(key,{...metric});else old.value=savedSum(old.value,metric.value);}return [...groups.values()];}
export function buildInventoryReport(snapshot:any):InventoryReport {
 if(!snapshot?.month?.id||snapshot.reporting_version!==3||!snapshot.progress)throw Error('Actualiza el servidor para consultar reportes completos.');
 const warnings:string[]=[];const sections:ReportSection[]=[];
 for(const [code,property,label] of REPORT_SECTIONS){
  const records=storedRows(snapshot,code,property);const progress=snapshot.progress.sections.find((s:any)=>s.section===code);
  const num=(row:any,key:string)=>storedNumber(row[key]);
  const rows:ReportCell[][]=[];let headers:string[]=[];
  for(const row of records){
   const common=[row.notes||'',row.photo_url||''];
   if(code==='aggregates'){
    headers=['Nombre','Material','Método','Ancho','Alto','Largo','M1','M2','M3','M4','M5','M6','D1','D2','Unidad de medición','Existencia','Unidad de existencia','Observaciones','Foto'];
    rows.push([nameOf(row,label),row.material_type||'',row.measurement_method||'',...['box_width_ft','box_height_ft','box_length_ft','cone_m1','cone_m2','cone_m3','cone_m4','cone_m5','cone_m6','cone_d1','cone_d2'].map(key=>num(row,key)),unitLabel(row.capture_unit_id),num(row,'calculated_volume_cy'),unitLabel(row.unit),...common]);
   }else if(code==='silos'){
    headers=['Silo','Producto','Método','Lectura','Unidad de lectura','Referencia','Existencia','Unidad de existencia','Libras','Sacos','Toneladas métricas','Observaciones','Foto'];
    rows.push([nameOf(row,label),row.product_name||row.product_in_silo||'',row.calculation_method||'',storedNumber(row.reading_value??row.reading),unitLabel(row.reading_uom),row.reading_reference||'',storedNumber(row.calculated_result??row.calculated_result_cy??row.calculated_volume),unitLabel(row.calculated_result_unit_id),num(row,'presentation_lbs'),num(row,'presentation_sacks'),num(row,'presentation_metric_tons'),...common]);
   }else if(code==='additives'){
    headers=['Producto','Tanque','Marca','Método','Lectura','Unidad de lectura','Existencia','Unidad de existencia','Observaciones','Foto'];
    rows.push([row.product_name||'',row.tank_name||'',row.brand||'',row.measurement_method||row.additive_type||'',storedNumber(row.reading_value??row.reading),unitLabel(row.capture_unit_id||row.reading_uom),storedNumber(row.inventory_quantity??(row.additive_type==='MANUAL'?row.quantity:row.calculated_volume)),unitLabel(row.inventory_unit_id||row.capacity_unit_id||row.uom),...common]);
   }else if(code==='diesel'){
    headers=['Lectura','Unidad de lectura','Inicial','Compras','Existencia final','Consumo','Unidad de volumen','Observaciones','Foto'];
    rows.push([storedNumber(row.reading_inches??row.reading),unitLabel(row.reading_uom),num(row,'beginning_inventory'),num(row,'purchases_gallons'),num(row,'ending_inventory'),num(row,'consumption_gallons'),unitLabel(row.unit),...common]);
   }else if(code==='products'){
    headers=['Producto','Categoría','Método','Lectura','Unidad de lectura','Existencia directa','Unidad','Envases','Volumen por envase','Volumen total','Observaciones','Foto'];
    const envases=['DRUM','PAIL'].includes(row.measure_mode);
    rows.push([nameOf(row,label),row.category||'',row.measure_mode||'',num(row,'reading_value'),unitLabel(row.reading_uom),envases?null:storedNumber(row.quantity??row.calculated_quantity),unitLabel(row.uom),envases?storedNumber(row.unit_count??row.quantity):null,num(row,'unit_volume'),num(row,'total_volume'),...common]);
   }else if(code==='utilities'){
    headers=['Medidor','Tipo','Lectura anterior','Lectura actual','Consumo','Unidad','Observaciones','Foto'];
    rows.push([nameOf(row,label),row.utility_type||'',num(row,'previous_reading'),num(row,'current_reading'),num(row,'consumption'),unitLabel(row.uom),...common]);
   }else{
    headers=['Establecido','Recibos','Efectivo','Total','Diferencia','Moneda','Observaciones','Foto'];
    rows.push([num(row,'established_amount'),num(row,'receipts'),num(row,'cash'),num(row,'total'),num(row,'difference'),row.currency||'Sin moneda registrada',...common]);
   }
  }
  if(!headers.length){headers=['Estado'];rows.push(['Sin registros guardados en esta sección.']);}
  const note=!progress?'Avance por verificar: no se recibió el registro de completitud.':progress?.source==='legacy'?'Registros históricos sin recibo de avance; completitud por verificar.':progress?.pending_count===null?'Alcance histórico sin registro completo; pendientes por verificar.':`${progress?.captured_count??0} con información · ${progress?.complete_count??0} completos · ${progress?.pending_count??0} pendientes`;
  if(progress?.source==='legacy')warnings.push(`${label}: no existe auditoría suficiente para acreditar la captura ni su completitud.`);
  for(const row of records)if((code==='aggregates'&&!row.capture_unit_id)||(['aggregates','silos','additives','products','utilities'].includes(code)&&!row.unit&&!row.uom&&!row.inventory_unit_id&&!row.calculated_result_unit_id))warnings.push(`${label}: una unidad no está registrada; no se infiere desde la configuración actual.`);
  sections.push({code,name:label,headers,rows,note,photos:records.filter(row=>row.photo_url).map(row=>({label:nameOf(row,label),url:row.photo_url}))});
 }
 const metrics=grouped(metricsFor(snapshot));const prior=snapshot.previous?new Map(grouped(metricsFor(snapshot.previous)).map(metric=>[metricKey(metric),metric])):null;
 for(const metric of metrics){const previous=prior?.get(metricKey(metric));if(metric.unit==='Sin unidad registrada')metric.comparison='Sin comparación: unidad no registrada';else if(previous&&previous.value!==null&&metric.value!==null){metric.previous=previous.value;metric.difference=metric.value-previous.value;metric.comparison='Período anterior de la misma planta';}else metric.comparison=snapshot.previous?'Sin comparación: dato o unidad anterior no disponible':'Sin comparación: período anterior no disponible';}
 return {version:3,report:{...snapshot.month,plant_name:snapshot.plant_name||snapshot.month.plant_id},progress:snapshot.progress,sections,metrics,warnings:[...new Set(warnings)]};
}
export function consolidateInventoryReports(details:InventoryReport[]){
 const results=new Map<string,any>();
 for(const detail of details)for(const metric of detail.metrics){
  const key=JSON.stringify([detail.report.year_month,metricKey(metric)]),existing=results.get(key);
  if(!existing)results.set(key,{...metric,period:detail.report.year_month,plants:[detail.report.plant_id]});
  else {existing.plants.push(detail.report.plant_id);existing.value=savedSum(existing.value,metric.value);existing.previous=savedSum(existing.previous,metric.previous);existing.difference=existing.previous===null||existing.value===null?null:existing.value-existing.previous;if(existing.previous===null)existing.comparison='Sin comparación: faltan datos equivalentes de una o más plantas';}
 }return [...results.values()];
}
