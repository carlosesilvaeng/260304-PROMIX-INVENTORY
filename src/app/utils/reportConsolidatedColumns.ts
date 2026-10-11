import {storedNumber, unitLabel, type InventoryReport, type ReportCell, type ReportMetric, type ReportSection} from './inventoryReportModel';

// Read the saved detail, so existing servers and historical reports also expose
// their measurements without consulting today's conversion configuration.
export function consolidatedMeasurementColumns(details:InventoryReport[], metric:ReportMetric & {period:string}):ReportCell[] {
 const readings:{label:string;value:ReportCell;unit:string}[]=[];
 const alternates:{value:number|null;unit:string}[]=[];
 for(const detail of details){
  if(detail.report.year_month!==metric.period)continue;
  const section=detail.sections.find(s=>s.code===metric.section);
  if(!section)continue;
  for(const row of section.rows){
   const get=(header:string):ReportCell=>row[section.headers.indexOf(header)]??null;
   if(materialOf(section,get)!==metric.material||resultUnit(section,get,metric.metric)!==unitLabel(metric.unit))continue;
   const recordLabel=['diesel','petty-cash'].includes(metric.section)?section.name:get(section.headers[0]);
   const label=`${detail.report.plant_name||detail.report.plant_id} / ${recordLabel||section.name}`;
   let value:ReportCell=null,unit='';
   if(metric.section==='aggregates'){
    const fields=get('Método')==='BOX'?['Ancho','Alto','Largo']:get('Método')==='CONE'?['M1','M2','M3','M4','M5','M6','D1','D2']:['Ancho','Alto','Largo','M1','M2','M3','M4','M5','M6','D1','D2'].filter(field=>get(field)!==null);
    value=fields.length?fields.map(field=>`${field}: ${get(field)??'Sin dato'}`).join('; '):null;
    unit=String(get('Unidad de medición')||'Sin unidad registrada');
   }else if(metric.section==='utilities'){
    value=`Anterior: ${get('Lectura anterior')??'Sin dato'}; actual: ${get('Lectura actual')??'Sin dato'}`;
    unit=String(get('Unidad')||'Sin unidad registrada');
   }else if(metric.section==='products'&&['Envases','Volumen en envases'].includes(metric.metric)){
    value=get('Envases');unit=get('Método')==='DRUM'?'drums':'pails';
   }else if(metric.section==='diesel'&&metric.metric!=='Existencia'){
    // Purchases and consumption are separate from the physical tank reading.
    value=metric.metric==='Compras'?get('Compras'):null;
    unit=value===null?'':String(get('Unidad de volumen'));
   }else if(metric.section!=='petty-cash'){
    value=get('Lectura');unit=String(get('Unidad de lectura')||'Sin unidad registrada');
    if(metric.section==='products'&&get('Método')!=='TANK_READING'){value=get('Existencia directa');unit=String(get('Unidad'));}
    if(metric.section==='additives'&&get('Método')==='MANUAL'){value=get('Existencia');unit=String(get('Unidad de existencia'));}
   }
   readings.push({label,value,unit});
   if(metric.section==='silos')alternates.push({value:storedNumber(get('Sacos')),unit:'sacos'});
   if(metric.section==='products'&&metric.metric==='Volumen en envases')alternates.push({value:storedNumber(get('Envases')),unit:get('Método')==='DRUM'?'drums':'pails'});
   if(metric.section==='products'&&metric.metric==='Envases')alternates.push({value:storedNumber(get('Volumen total')),unit:String(get('Unidad'))});
  }
 }
 const units=[...new Set(readings.filter(r=>r.unit).map(r=>r.unit))];
 const reading=readings.every(r=>r.value===null)?null:readings.length===1?readings[0].value:readings.map(r=>`${r.label}: ${r.value??'Sin dato'}${r.unit?` ${r.unit}`:''}`).join('\n');
 const alternateUnits=[...new Set(alternates.map(a=>a.unit))];
 // A partial or mixed-unit sum must never look like a complete alternative total.
 const alternate=alternates.length&&alternateUnits.length===1&&alternates.every(a=>a.value!==null)
  ?storedNumber(alternates.reduce((sum,a)=>sum+a.value!,0)):null;
 return [units.join(' / ')||null,reading,alternate,alternateUnits.join(' / ')||null];
}

function materialOf(section:ReportSection,get:(header:string)=>ReportCell):string {
 if(['diesel','petty-cash'].includes(section.code))return section.name;
 if(section.code==='aggregates')return String(get('Material')||get('Nombre')||section.name);
 if(section.code==='silos')return String(get('Producto')||get('Silo')||section.name);
 if(section.code==='additives')return [get('Producto'),get('Marca')].filter(Boolean).join(' · ')||section.name;
 return String(get(section.headers[0])||section.name);
}

function resultUnit(section:ReportSection,get:(header:string)=>ReportCell,metric:string):string {
 if(['aggregates','silos','additives'].includes(section.code))return String(get('Unidad de existencia'));
 if(section.code==='products')return metric==='Envases'?'envase':String(get('Unidad'));
 if(section.code==='diesel')return String(get('Unidad de volumen'));
 if(section.code==='petty-cash')return String(get('Moneda'));
 return String(get('Unidad'));
}
