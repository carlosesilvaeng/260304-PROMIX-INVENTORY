import type {InventoryReport} from './inventoryReportModel';
export interface ReportFilters {plant_id?:string;year_month?:string;year?:string;month?:string;status?:string;as_of?:string;user_id?:string;inventory_month_id?:string}
export interface ReportPage {reporting_version:number;data:any[];pagination:{offset:number;limit:number;total:number;has_more:boolean};totals?:any;years?:string[];snapshot_id?:string;as_of?:string}
export interface ReportOptions {signal?:AbortSignal;onProgress?:(done:number,total:number)=>void;filters?:ReportFilters;details?:InventoryReport[]}
export function checkCancellation(signal?:AbortSignal){if(signal?.aborted)throw new DOMException('Exportación cancelada.','AbortError');}
export async function reportRequest(url:string,token:string,signal?:AbortSignal){
 checkCancellation(signal);const controller=new AbortController();const abort=()=>controller.abort(signal?.reason);signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>controller.abort(),45000);
 try{const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});const reply=await response.json();
  if(!response.ok||!reply.success)throw Error(reply.error||`La consulta falló (${response.status}).`);return reply;
 }catch(error){checkCancellation(signal);if(controller.signal.aborted)throw Error('La consulta tardó demasiado. Intenta nuevamente.');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function getReportPage(base:string,token:string,filters:ReportFilters={},offset=0,signal?:AbortSignal,path='/reports'):Promise<ReportPage>{
 const params=new URLSearchParams({...Object.fromEntries(Object.entries(filters).filter(([,value])=>value)),offset:String(offset),limit:'50'} as Record<string,string>);
 const reply=await reportRequest(`${base}${path}?${params}`,token,signal);
 if(reply.reporting_version!==3||!Array.isArray(reply.data)||!Number.isSafeInteger(reply.pagination?.total)||reply.pagination.total<0||reply.pagination.offset!==offset||typeof reply.pagination.has_more!=='boolean')throw Error('Actualiza el servidor para consultar el conjunto completo de reportes y auditoría.');
 return reply;
}
export async function getAllReportRows(base:string,token:string,filters:ReportFilters={},options:ReportOptions={},path='/reports'){
 const frozenFilters={...filters};const rows:any[]=[];const ids=new Set<string>();let offset=0,total:number|undefined,snapshot:string|undefined;
 while(true){checkCancellation(options.signal);const page=await getReportPage(base,token,frozenFilters,offset,options.signal,path);
  if(total!==undefined&&page.pagination.total!==total||snapshot&&snapshot!==page.snapshot_id)throw Error('Los datos cambiaron durante la consulta. Actualiza los reportes y vuelve a exportar.');
  if(!frozenFilters.as_of){if(!page.as_of||!Number.isFinite(Date.parse(page.as_of)))throw Error('El servidor no indicó la fecha de corte de la consulta.');frozenFilters.as_of=page.as_of;}
  total=page.pagination.total;snapshot=page.snapshot_id;
  for(const row of page.data){if(!row.id||ids.has(row.id))throw Error('La paginación devolvió registros duplicados; se detuvo la exportación.');ids.add(row.id);rows.push(row);}
  options.onProgress?.(rows.length,total);
  if(!page.pagination.has_more){if(rows.length!==total)throw Error('Faltan registros del conjunto filtrado; se detuvo la exportación.');return {rows,filters:frozenFilters};}
  if(!page.data.length)throw Error('La consulta no avanzó a la página siguiente.');offset+=page.data.length;
 }
}
export async function getInventoryReport(base:string,token:string,summary:any,signal?:AbortSignal):Promise<InventoryReport>{
 const reply=await reportRequest(`${base}/reports/${encodeURIComponent(summary.id)}`,token,signal);const detail=reply.data;
 if(reply.reporting_version!==3||detail?.version!==3||detail.report?.id!==summary.id||summary.plant_id&&detail.report.plant_id!==summary.plant_id||summary.year_month&&detail.report.year_month!==summary.year_month)throw Error('El detalle no corresponde al inventario solicitado. Actualiza el servidor.');
 if(summary.write_revision!==undefined&&(detail.report.write_revision!==summary.write_revision||detail.report.status!==summary.status))throw Error('El inventario cambió después de consultar el listado. Actualiza antes de exportar.');
 return detail;
}
export async function loadReportDetails(reports:any[],base:string,token:string,options:ReportOptions={}):Promise<InventoryReport[]>{
 const details:InventoryReport[]=new Array(reports.length);const failures:string[]=[];let next=0,done=0;
 await Promise.all(Array.from({length:Math.min(3,reports.length)},async()=>{
  while(next<reports.length){checkCancellation(options.signal);const index=next++,report=reports[index];try{details[index]=await getInventoryReport(base,token,report,options.signal);}catch(error:any){checkCancellation(options.signal);failures.push(`${report.plant_id} / ${report.year_month}: ${error.message}`);}done++;options.onProgress?.(done,reports.length);}
 }));checkCancellation(options.signal);
 if(failures.length)throw Error(`No se generó el archivo. Fallaron ${failures.length} inventarios:\n${failures.join('\n')}`);return details;
}
