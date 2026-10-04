import * as XLSX from 'xlsx';
import {consolidateInventoryReports,reportSectionLabel,unitLabel,type InventoryReport} from './inventoryReportModel';
export const REPORT_STATUS:Record<string,string>={IN_PROGRESS:'En progreso',SUBMITTED:'Enviado',APPROVED:'Aprobado'};
export function uniqueReportSheetName(label:string,names:Set<string>){
 const base=label.replace(/[\\/?*:\[\]\x00-\x1f]/g,' ').replace(/^'+|'+$/g,'').trim()||'Inventario';let name=base.slice(0,31),n=1;
 while(names.has(name.toLowerCase())){const suffix=` (${++n})`;name=base.slice(0,31-suffix.length)+suffix;}names.add(name.toLowerCase());return name;
}
export interface PhotoAvailability {reportId:string;section:string;label:string;url:string;available:boolean;image?:{dataUrl:string;format:'PNG'|'JPEG';width:number;height:number}}
export function createReportWorkbook(details:InventoryReport[],filters:Record<string,any>,photos:PhotoAvailability[]=[],generatedAt=new Date().toISOString()){
 const workbook=XLSX.utils.book_new();const names=new Set<string>();
 const append=(label:string,rows:any[][])=>{const sheet=XLSX.utils.aoa_to_sheet(rows);for(const key of Object.keys(sheet)){const cell=sheet[key];if(cell?.t==='n')cell.z='#,##0.00####';}sheet['!cols']=Array.from({length:Math.max(...rows.map(row=>row.length))},()=>({wch:22}));XLSX.utils.book_append_sheet(workbook,sheet,uniqueReportSheetName(label,names));};
 append('Información',[
  ['PROMIX · Inventarios guardados'],['Generado',generatedAt],['Filtros',JSON.stringify(filters)],['Inventarios',details.length],
  ['Lectura','Solo valores persistidos; las celdas vacías indican ausencia de dato. No se suman unidades diferentes ni existencias entre períodos.'],
  ['Avance','Capturas y completitud provienen de recibos de guardado. Sin auditoría histórica suficiente, se indica por verificar.'],
  ['Fotografías','Las evidencias se incluyen como enlaces con disponibilidad verificada al generar el archivo.'],
  ...details.flatMap(detail=>detail.warnings.map(warning=>['Advertencia',`${detail.report.plant_id} / ${detail.report.year_month}: ${warning}`])),
 ]);
 append('Resumen',[
  ['Planta','Período','Estado','Iniciado por','Inicio','Registros guardados','Con información','Completos','Pendientes','Primera captura recibida','Primera captura informada por el móvil','Último guardado recibido','Aprobado por','Aprobación'],
  ...details.map(({report:r,progress:p})=>[r.plant_name||r.plant_id,r.year_month,REPORT_STATUS[r.status]||r.status,r.created_by,r.created_at,p.saved_count,p.captured_count??'Por verificar',p.complete_count??'Por verificar',p.pending_count??'Por verificar',p.first_capture_received_at||'',p.first_capture_client_at||'',p.last_save_received_at||'',r.approved_by||'',r.approved_at||'']),
 ]);
 append('Consolidado',[
  ['Período','Sección','Material / producto','Métrica','Cantidad','Unidad','Período anterior','Diferencia','Comparación','Plantas'],
  ...consolidateInventoryReports(details).map(m=>[m.period,reportSectionLabel(m.section),m.material,m.metric,m.value,unitLabel(m.unit),m.previous,m.difference,m.comparison,[...new Set(m.plants)].join(', ')]),
 ]);
 for(const detail of details){const rows:any[][]=[['Planta',detail.report.plant_name||detail.report.plant_id],['Período',detail.report.year_month],['Estado',REPORT_STATUS[detail.report.status]],['Revisión guardada',detail.report.write_revision],[]];
  for(const section of detail.sections)rows.push([section.name],[section.note],section.headers,...section.rows,[]);
  append(`${detail.report.plant_id}-${detail.report.year_month}`,rows);
 }
 append('Evidencias',[['Planta','Período','Sección','Registro','Enlace','Estado'],...photos.map(photo=>{const detail=details.find(d=>d.report.id===photo.reportId)!;return [detail.report.plant_id,detail.report.year_month,photo.section,photo.label,photo.url,photo.available?'Disponible':'Fotografía no disponible; no se pudo cargar'];})]);
 return workbook;
}
