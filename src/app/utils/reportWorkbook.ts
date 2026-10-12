import * as XLSX from 'xlsx';
import {consolidateInventoryReports,reportSectionLabel,unitLabel,type InventoryReport} from './inventoryReportModel';
import {consolidatedMeasurementColumns} from './reportConsolidatedColumns';
export const REPORT_STATUS:Record<string,string>={IN_PROGRESS:'En progreso',SUBMITTED:'Enviado',APPROVED:'Aprobado'};
export function uniqueReportSheetName(label:string,names:Set<string>){
 const base=label.replace(/[\\/?*:\[\]\x00-\x1f]/g,' ').replace(/^'+|'+$/g,'').trim()||'Inventario';let name=base.slice(0,31),n=1;
 while(names.has(name.toLowerCase())){const suffix=` (${++n})`;name=base.slice(0,31-suffix.length)+suffix;}names.add(name.toLowerCase());return name;
}
export interface PhotoAvailability {reportId:string;section:string;label:string;url:string;available:boolean;image?:{dataUrl:string;format:'PNG'|'JPEG';width:number;height:number}}
const EXCEL_TEXT_LIMIT=32767;
const photoReference=(value:any)=>typeof value==='string'&&/^data:image\//i.test(value)?'Fotografía integrada en el inventario; consultar en la aplicación o en el PDF.':value;
export function createReportWorkbook(details:InventoryReport[],filters:Record<string,any>,photos:PhotoAvailability[]=[],generatedAt=new Date().toISOString()){
 const workbook=XLSX.utils.book_new();const names=new Set<string>();
 const longTextSheetName=uniqueReportSheetName('Textos extensos',names);
 const longTexts:any[][]=[['Hoja','Celda','Parte','Texto']];
 const append=(label:string,rows:any[][])=>{
  const name=uniqueReportSheetName(label,names);
  const safeRows=rows.map((row,r)=>row.map((value,c)=>{
   if(typeof value!=='string'||value.length<=EXCEL_TEXT_LIMIT)return value;
   const address=XLSX.utils.encode_cell({r,c});let offset=0,part=0;
   while(offset<value.length){
    let end=Math.min(offset+EXCEL_TEXT_LIMIT,value.length);
    // Keep Unicode characters intact when a part ends between a surrogate pair.
    if(end<value.length&&value.charCodeAt(end-1)>=0xD800&&value.charCodeAt(end-1)<=0xDBFF&&value.charCodeAt(end)>=0xDC00&&value.charCodeAt(end)<=0xDFFF)end--;
    longTexts.push([name,address,++part,value.slice(offset,end)]);offset=end;
   }
   return `Texto completo en «${longTextSheetName}»: ${name}!${address} (${part} partes).`;
  }));
  const sheet=XLSX.utils.aoa_to_sheet(safeRows);for(const key of Object.keys(sheet)){const cell=sheet[key];if(cell?.t==='n')cell.z='#,##0.00####';}
  sheet['!cols']=Array.from({length:Math.max(...safeRows.map(row=>row.length))},()=>({wch:22}));XLSX.utils.book_append_sheet(workbook,sheet,name);
 };
 append('Información',[
  ['PROMIX · Inventarios guardados'],['Generado',generatedAt],['Filtros',JSON.stringify(filters)],['Inventarios',details.length],
  ['Lectura','Solo valores persistidos; las celdas vacías indican ausencia de dato. No se suman unidades diferentes ni existencias entre períodos.'],
  ['Avance','Capturas y completitud provienen de recibos de guardado. Sin auditoría histórica suficiente, se indica por verificar.'],
  ['Fotografías','Las evidencias con URL se incluyen como enlaces con disponibilidad verificada. Las fotografías integradas en los datos se consultan en la aplicación o en el PDF; no se incluyen como texto de imagen en las celdas.'],
  ['Textos extensos','Los textos que exceden el límite de una celda se conservan completos en la hoja Textos extensos, separados en partes por hoja y celda de origen.'],
  ['Mediciones','El consolidado incluye lecturas originales y cantidades convertidas guardadas. Las lecturas múltiples se identifican por planta y registro. Las cantidades alternas solo se suman cuando todos los registros tienen dato y la misma unidad.'],
  ...details.flatMap(detail=>detail.warnings.map(warning=>['Advertencia',`${detail.report.plant_id} / ${detail.report.year_month}: ${warning}`])),
 ]);
 append('Resumen',[
  ['Planta','Período','Estado','Iniciado por','Inicio','Registros guardados','Con información','Completos','Pendientes','Primera captura recibida','Primera captura informada por el móvil','Último guardado recibido','Aprobado por','Aprobación'],
  ...details.map(({report:r,progress:p})=>[r.plant_name||r.plant_id,r.year_month,REPORT_STATUS[r.status]||r.status,r.created_by,r.created_at,p.saved_count,p.captured_count??'Por verificar',p.complete_count??'Por verificar',p.pending_count??'Por verificar',p.first_capture_received_at||'',p.first_capture_client_at||'',p.last_save_received_at||'',r.approved_by||'',r.approved_at||'']),
 ]);
 append('Consolidado',[
  ['Período','Sección','Material / producto','Métrica','Cantidad convertida','Unidad de conversión','Unidad de medida','Lectura / medición','Cantidad alterna','Unidad alterna','Período anterior','Diferencia','Comparación','Plantas'],
  ...consolidateInventoryReports(details).map(m=>[m.period,reportSectionLabel(m.section),m.material,m.metric,m.value,unitLabel(m.unit),...consolidatedMeasurementColumns(details,m),m.previous,m.difference,m.comparison,[...new Set(m.plants)].join(', ')]),
 ]);
 for(const detail of details){const rows:any[][]=[['Planta',detail.report.plant_name||detail.report.plant_id],['Período',detail.report.year_month],['Estado',REPORT_STATUS[detail.report.status]],['Revisión guardada',detail.report.write_revision],[]];
  for(const section of detail.sections)rows.push([section.name],[section.note],section.headers,...section.rows.map(row=>row.map((cell,index)=>section.headers[index]==='Foto'?photoReference(cell):cell)),[]);
  append(`${detail.report.plant_id}-${detail.report.year_month}`,rows);
 }
 append('Evidencias',[['Planta','Período','Sección','Registro','Enlace','Estado'],...photos.map(photo=>{const detail=details.find(d=>d.report.id===photo.reportId)!;return [detail.report.plant_id,detail.report.year_month,photo.section,photo.label,photoReference(photo.url),photo.available?'Disponible':'Fotografía no disponible; no se pudo cargar'];})]);
 if(longTexts.length>1){const sheet=XLSX.utils.aoa_to_sheet(longTexts);sheet['!cols']=[{wch:31},{wch:12},{wch:10},{wch:80}];XLSX.utils.book_append_sheet(workbook,sheet,longTextSheetName);}
 return workbook;
}
