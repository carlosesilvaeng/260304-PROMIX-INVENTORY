import type {InventoryReport} from '../utils/inventoryReportModel';
import {unitLabel} from '../utils/inventoryReportModel';
const statuses:Record<string,string>={IN_PROGRESS:'En progreso',SUBMITTED:'Enviado',APPROVED:'Aprobado'};
const number=(value:number|null)=>value===null?'Por verificar':value.toLocaleString('es-PR');
const date=(value?:string)=>value?new Date(value).toLocaleString('es-PR',{timeZone:'America/Puerto_Rico'}):'Sin evento registrado';
function photoLink(url:string){return /^(https?:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(url);}
export function InventoryReportView({detail}:{detail:InventoryReport}){
 const {report,progress}=detail;
 return <div className="space-y-4" aria-label="Datos guardados del inventario">
  <h3 className="text-xl font-semibold">{report.plant_name||report.plant_id} · {report.year_month}</h3>
  <dl className="grid gap-3 sm:grid-cols-3 text-sm">
   <div><dt>Estado del proceso</dt><dd className="font-semibold">{statuses[report.status]}</dd></div>
   <div><dt>Avance guardado</dt><dd>{number(progress.captured_count)} con información · {number(progress.complete_count)} completos · {number(progress.pending_count)} pendientes</dd></div>
   <div><dt>Registros persistidos</dt><dd>{progress.saved_count}</dd></div>
   <div><dt>Inicio del inventario</dt><dd>{date(report.created_at)} · {report.created_by}</dd></div>
   <div><dt>Primera captura recibida</dt><dd>{date(progress.first_capture_received_at)}</dd></div>
   <div><dt>Último guardado recibido</dt><dd>{date(progress.last_save_received_at)}</dd></div>
   <div><dt>Primera captura informada por el móvil</dt><dd>{date(progress.first_capture_client_at)} (hora del dispositivo)</dd></div>
  </dl>
  <p className="text-sm text-slate-600">Fechas mostradas en hora de Puerto Rico. Solo se conoce la actividad recibida por el servidor; puede haber borradores pendientes en el móvil.</p>
  {progress.saved_count===0&&<p className="text-amber-800">Inventario iniciado sin registros guardados.</p>}
  {detail.warnings.map(warning=><p key={warning} className="text-amber-800">{warning}</p>)}
  {detail.sections.map(section=><details key={section.code} className="rounded border p-3">
   <summary className="min-h-11 cursor-pointer font-semibold">{section.name} · {section.note}</summary>
   <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr>{section.headers.map(header=><th key={header} className="p-2 text-left bg-slate-100">{header}</th>)}</tr></thead>
    <tbody>{section.rows.map((row,index)=><tr key={index}>{row.map((cell,column)=><td key={column} className="p-2 border-b">{section.headers[column]==='Foto'?cell&&photoLink(String(cell))?<a className="text-blue-700 underline" href={String(cell)} target="_blank" rel="noopener noreferrer">Ver evidencia</a>:'Sin fotografía':cell===null?'Sin dato':typeof cell==='number'?cell.toLocaleString('es-PR',{maximumFractionDigits:6}):cell}</td>)}</tr>)}</tbody></table></div>
   {section.photos.map((photo,index)=><figure key={index} className="mt-3"><figcaption>{photo.label}</figcaption>{photoLink(photo.url)?<img loading="lazy" src={photo.url} alt={`Evidencia: ${photo.label}`} className="max-h-48 max-w-full object-contain" onError={event=>{event.currentTarget.hidden=true;const message=event.currentTarget.parentElement?.querySelector('[data-missing-photo]') as HTMLElement|null;if(message)message.hidden=false;}}/>:null}<p data-missing-photo hidden={photoLink(photo.url)} className="text-amber-800">Fotografía no disponible; no se pudo cargar.</p></figure>)}
  </details>)}
  <details className="rounded border p-3"><summary className="min-h-11 cursor-pointer font-semibold">Cantidades y comparación con el período anterior</summary><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Material / producto','Métrica','Cantidad','Unidad','Anterior','Diferencia','Comparación'].map(label=><th key={label} className="p-2 text-left">{label}</th>)}</tr></thead><tbody>{detail.metrics.map((metric,index)=><tr key={index} className="border-t">{[metric.material,metric.metric,metric.value===null?'Sin dato':metric.value,unitLabel(metric.unit),metric.previous===null?'Sin comparación':metric.previous,metric.difference===null?'Sin comparación':metric.difference,metric.comparison].map((cell,col)=><td key={col} className="p-2">{typeof cell==='number'?cell.toLocaleString('es-PR',{maximumFractionDigits:6}):cell}</td>)}</tr>)}</tbody></table></div></details>
 </div>;
}
