import {useState,useEffect,useCallback,useRef} from 'react';
import {Card} from '../components/Card';
import {Button} from '../components/Button';
import {Select} from '../components/Select';
import {Modal} from '../components/Modal';
import {InventoryReportView} from '../components/InventoryReportView';
import {useAuth} from '../contexts/AuthContext';
import {PromixLogo} from '../components/PromixLogo';
import {projectId} from '/utils/supabase/info';
import {exportToExcel,exportToPDF} from '../utils/exportReports';
import {getReportPage,getAllReportRows,getInventoryReport,type ReportPage,type ReportFilters} from '../utils/reportTransport';
import type {InventoryReport} from '../utils/inventoryReportModel';
import {canApproveInventory,isPlantManagerLike} from '../utils/permissions';
const base=`https://${projectId}.supabase.co/functions/v1/make-server`;
const statuses:Record<string,string>={IN_PROGRESS:'En progreso',SUBMITTED:'Enviado',APPROVED:'Aprobado'};
const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const date=(value?:string)=>value?new Date(value).toLocaleString('es-PR',{timeZone:'America/Puerto_Rico'}):'Sin evento recibido';
const count=(value:number|null)=>value===null||value===undefined?'Por verificar':String(value);
interface ReportsProps {onNavigate?:(view:string,sectionId?:string,context?:{plantId?:string;yearMonth?:string})=>void}
export function Reports({onNavigate}:ReportsProps){
 const {user,currentPlant,allPlants,accessToken}=useAuth();
 const [selectedPlant,setSelectedPlant]=useState(''),[year,setYear]=useState(''),[month,setMonth]=useState(''),[status,setStatus]=useState('');
 const [activityOrder,setActivityOrder]=useState<'asc'|'desc'>('desc');
 const [page,setPage]=useState<ReportPage|null>(null),[offset,setOffset]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 const [detail,setDetail]=useState<InventoryReport|null>(null),[detailLoading,setDetailLoading]=useState(false),[detailError,setDetailError]=useState(''),[detailOpen,setDetailOpen]=useState(false);
 const [timeline,setTimeline]=useState<any[]>([]),[timelineTotal,setTimelineTotal]=useState(0),[timelineError,setTimelineError]=useState(''),[timelineLoading,setTimelineLoading]=useState(false);
 const [exporting,setExporting]=useState(''),[exportProgress,setExportProgress]=useState(''),[exportError,setExportError]=useState(''),[exportSuccess,setExportSuccess]=useState(''),[pdfUrl,setPdfUrl]=useState<string|null>(null);
 const [confirmDelete,setConfirmDelete]=useState<any>(null),[deleting,setDeleting]=useState(false);
 const exportController=useRef<AbortController|null>(null),detailController=useRef<AbortController|null>(null);
 const identityRef=useRef(user?.id);identityRef.current=user?.id;
 const filters:ReportFilters={plant_id:currentPlant?.id||selectedPlant||undefined,year:year||undefined,month:month||undefined,status:status||undefined,activity_order:activityOrder||undefined};
 const filterKey=JSON.stringify(filters);
 useEffect(()=>{setOffset(0);},[filterKey,user?.id]);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');setPage(null);
  getReportPage(base,accessToken||'',JSON.parse(filterKey),offset,controller.signal).then(reply=>{if(!controller.signal.aborted)setPage(reply);}).catch(error=>{if(!controller.signal.aborted)setError(error.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
 },[accessToken,user?.id,filterKey,offset,refresh]);
 useEffect(()=>()=>{exportController.current?.abort();detailController.current?.abort();},[]);
 useEffect(()=>{exportController.current?.abort();detailController.current?.abort();setDetail(null);setDetailOpen(false);setTimeline([]);setConfirmDelete(null);setExportSuccess('');setExportError('');setExporting('');setExportProgress('');setPdfUrl(null);},[user?.id]);
 useEffect(()=>()=>{if(pdfUrl)URL.revokeObjectURL(pdfUrl);},[pdfUrl]);
 const loadTimeline=useCallback(async(report:any,start=0)=>{setTimelineLoading(true);setTimelineError('');const owner=identityRef.current,controller=detailController.current;
  try{const events=await getReportPage(base,accessToken||'',{inventory_month_id:report.id},start,controller?.signal,'/audit/logs');if(owner!==identityRef.current||controller!==detailController.current||controller?.signal.aborted)return;setTimeline(previous=>start?[...previous,...events.data]:events.data);setTimelineTotal(events.pagination.total);}catch(error:any){if(owner===identityRef.current&&controller===detailController.current&&!controller?.signal.aborted)setTimelineError(error.message);}finally{if(controller===detailController.current)setTimelineLoading(false);}
 },[accessToken]);
 const openDetail=async(report:any)=>{detailController.current?.abort();const controller=new AbortController();detailController.current=controller;setDetailOpen(true);setDetail(null);setDetailError('');setTimeline([]);setTimelineTotal(0);setDetailLoading(true);
  try{const saved=await getInventoryReport(base,accessToken||'',report,controller.signal);if(controller.signal.aborted)return;setDetail(saved);await loadTimeline(report);}catch(error:any){if(!controller.signal.aborted)setDetailError(error.message);}finally{if(!controller.signal.aborted)setDetailLoading(false);}
 };
 const runExport=async(kind:'excel'|'pdf'|'preview',row?:any)=>{if(exporting)return;const controller=new AbortController();exportController.current=controller;const owner=identityRef.current;setExporting(kind);setExportError('');setExportSuccess('');
  try{
   let reports:any[],frozenFilters:ReportFilters;
   if(row){reports=[row];frozenFilters={plant_id:row.plant_id,year_month:row.year_month,status:row.status};}
   else{setExportProgress('Consultando todos los resultados filtrados…');const all=await getAllReportRows(base,accessToken||'',JSON.parse(filterKey),{signal:controller.signal});reports=all.rows;frozenFilters=all.filters;}
   if(!reports.length)throw Error('No hay inventarios para exportar con estos filtros.');
   const options={signal:controller.signal,filters:frozenFilters,onProgress:(done:number,total:number)=>setExportProgress(`Verificando detalle ${done} de ${total}…`),...(row&&detail?.report.id===row.id?{details:[detail]}:{})};
   if(kind==='excel')await exportToExcel(reports,base,accessToken||'',options);else{const url=await exportToPDF(reports,base,accessToken||'',user?.name||user?.email||'Sistema',{...options,mode:kind==='preview'?'preview':'download'});if(url&&!controller.signal.aborted)setPdfUrl(url);}
   if(!controller.signal.aborted&&owner===identityRef.current)setExportSuccess(kind==='preview'?'Vista previa generada con los datos guardados.':'Archivo generado con todos los inventarios seleccionados. Las omisiones de fotos se indican en el archivo.');
  }catch(error:any){if(owner===identityRef.current)setExportError(error.name==='AbortError'?'Exportación cancelada.':error.message);}finally{if(owner===identityRef.current){setExporting('');setExportProgress('');}if(exportController.current===controller)exportController.current=null;}
 };
 const deleteReport=async()=>{if(!confirmDelete||deleting)return;setDeleting(true);setError('');try{const response=await fetch(`${base}/reports/${encodeURIComponent(confirmDelete.id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({confirm:true,plant_id:confirmDelete.plant_id,year_month:confirmDelete.year_month,write_revision:confirmDelete.write_revision})});const reply=await response.json();if(!response.ok||!reply.success)throw Error(reply.error||'No se pudo eliminar el reporte.');setConfirmDelete(null);setExportSuccess(`Inventario eliminado y registrado en Auditoría.${reply.warnings?.length?' '+reply.warnings.join(' '):''}`);setOffset(0);setRefresh(value=>value+1);}catch(error:any){setError(error.message);}finally{setDeleting(false);}};
 const reports=page?.data||[];const availablePlants=allPlants.filter(plant=>user?.role!=='plant_manager'||user.assigned_plants.includes(plant.id));
 return <div className="p-4 sm:p-6 space-y-5">
  <div className="flex justify-center"><PromixLogo size="lg"/></div><h2 className="text-2xl">Reportes y avance de inventarios</h2>
  <p className="text-slate-600">Consulta de datos guardados{currentPlant?` · ${currentPlant.name}`:''}. El estado del proceso no acredita por sí solo el ingreso de mediciones.</p>
  {(error||exportError)&&<p role="alert" className="whitespace-pre-wrap text-red-700">{error||exportError}</p>}{exportSuccess&&<p role="status" className="text-green-800">{exportSuccess}</p>}
  <Card><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   {!currentPlant&&<Select label="Planta" value={selectedPlant} onChange={event=>setSelectedPlant(event.target.value)} options={[{value:'',label:'Todas las plantas autorizadas'},...availablePlants.map(plant=>({value:plant.id,label:plant.name}))]}/>}
   <Select label="Año" value={year} onChange={event=>setYear(event.target.value)} options={[{value:'',label:'Todos los años'},...[...new Set([...(page?.years||[]),String(new Date().getFullYear()),...(year?[year]:[])])].sort().reverse().map(value=>({value,label:value}))]}/>
   <Select label="Mes" value={month} onChange={event=>setMonth(event.target.value)} options={[{value:'',label:'Todos los meses'},...months.map((label,index)=>({value:String(index+1).padStart(2,'0'),label}))]}/>
   <Select label="Estado" value={status} onChange={event=>setStatus(event.target.value)} options={[{value:'',label:'Todos los estados'},...Object.entries(statuses).map(([value,label])=>({value,label}))]}/>
  </div><p className="mt-3 text-sm text-slate-600">Pulsa Actividad recibida para alternar entre más reciente y más antigua. Se usa la última fecha de guardado, evento o actualización recibida.</p><div className="mt-4 flex flex-wrap gap-2">
   <Button variant="outline" disabled={loading||!!exporting} onClick={()=>setRefresh(value=>value+1)}>Actualizar</Button>
   <Button variant="secondary" disabled={loading||!!exporting||!page?.pagination.total} onClick={()=>runExport('excel')}>Excel · todos los resultados</Button>
   <Button variant="secondary" disabled={loading||!!exporting||!page?.pagination.total} onClick={()=>runExport('pdf')}>Descargar PDF</Button>
   <Button variant="outline" disabled={loading||!!exporting||!page?.pagination.total} onClick={()=>runExport('preview')}>Vista PDF</Button>
   {exporting&&<><p role="status" className="self-center">{exportProgress||'Preparando evidencias…'}</p><Button variant="outline" onClick={()=>exportController.current?.abort()}>Cancelar exportación</Button></>}
  </div></Card>
  {page&&<div className="grid gap-3 sm:grid-cols-4">{[['Inventarios filtrados',page.totals.total],['En progreso',page.totals.in_progress],['Enviados',page.totals.submitted],['Aprobados',page.totals.approved]].map(([label,value])=><Card key={label}><p className="text-sm">{label}</p><p className="text-2xl font-bold">{value}</p></Card>)}</div>}
  <Card noPadding><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[var(--ui-text-3b3a36)] text-white"><tr>{['Planta / período','Estado del proceso','Avance guardado','Actividad recibida','Acciones'].map(label=><th className="p-3 text-left" key={label} aria-sort={label==='Actividad recibida' ? (activityOrder==='asc'?'ascending':activityOrder==='desc'?'descending':'none') : undefined}>{label==='Actividad recibida'?<button type="button" onClick={()=>setActivityOrder(value=>value==='desc'?'asc':'desc')} aria-label="Ordenar por actividad recibida">{label} <span aria-hidden="true">{activityOrder==='asc'?'↑':activityOrder==='desc'?'↓':'⇅'}</span></button>:label}</th>)}</tr></thead><tbody>
   {loading?<tr><td colSpan={5} className="p-6">Consultando reportes…</td></tr>:error?<tr><td colSpan={5} className="p-6">No se pudieron consultar los inventarios. Intenta actualizar.</td></tr>:reports.length===0?<tr><td colSpan={5} className="p-6">No hay inventarios para estos filtros.</td></tr>:reports.map(report=><tr className="border-b" key={report.id}>
    <td className="p-3"><p className="font-semibold">{report.plant_name||report.plant_id}</p><p>{report.year_month}</p></td><td className={`p-3 ${report.status==='IN_PROGRESS'?'text-red-700 font-semibold':''}`}>{statuses[report.status]}</td>
    <td className="p-3"><p>{count(report.progress.captured_count)} con información</p><p>{count(report.progress.complete_count)} completos · {count(report.progress.pending_count)} pendientes</p><p className="text-xs text-slate-500">{report.progress.saved_count} registros guardados</p></td>
    <td className="p-3"><p className="font-semibold">Última actividad: {date(report.activity_at)}</p><p>Inicio: {date(report.created_at)}</p><p>Primera captura: {date(report.progress.first_capture_received_at)}</p><p>Guardado: {date(report.progress.last_save_received_at)}</p></td>
    <td className="p-3"><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={()=>openDetail(report)}>Ver detalle y cronología</Button>
     {isPlantManagerLike(user?.role)&&report.status==='IN_PROGRESS'&&<Button variant="outline" size="sm" onClick={()=>onNavigate?.('inventory',undefined,{plantId:report.plant_id,yearMonth:report.year_month})}>Continuar</Button>}
     {canApproveInventory(user?.role)&&report.status==='SUBMITTED'&&<Button variant="outline" size="sm" onClick={()=>onNavigate?.('review',undefined,{plantId:report.plant_id,yearMonth:report.year_month})}>Revisar / Aprobar</Button>}
     <Button variant="outline" size="sm" disabled={!!exporting} onClick={()=>runExport('preview',report)}>Ver PDF</Button>
     {['admin','super_admin'].includes(user?.role||'')&&<Button variant="dangerOutline" size="sm" onClick={()=>setConfirmDelete(report)}>Eliminar</Button>}
    </div></td>
   </tr>)}
  </tbody></table></div></Card>
  {page&&<div className="flex flex-wrap items-center justify-between gap-3"><p>Mostrando {page.data.length?offset+1:0}–{offset+page.data.length} de {page.pagination.total}. Los indicadores y exportaciones incluyen todo el filtro.</p><div className="flex gap-2"><Button variant="outline" disabled={loading||offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>Anterior</Button><Button variant="outline" disabled={loading||!page.pagination.has_more} onClick={()=>setOffset(offset+50)}>Siguiente</Button></div></div>}
  <Modal isOpen={detailOpen} onClose={()=>{detailController.current?.abort();setDetailOpen(false);}} title="Datos guardados y cronología" size="xl">
   {detailLoading&&<p role="status">Consultando el inventario…</p>}{detailError&&<p role="alert" className="text-red-700">{detailError}</p>}{detail&&<><InventoryReportView detail={detail}/><div className="mt-4 flex gap-2"><Button disabled={!!exporting} onClick={()=>runExport('excel',detail.report)}>Excel de este inventario</Button><Button disabled={!!exporting} onClick={()=>runExport('preview',detail.report)}>PDF de este inventario</Button></div>
    <h4 className="mt-5 font-semibold">Cronología recibida por el servidor</h4><p className="text-sm text-slate-600">La hora informada por el móvil puede diferir de la recepción y depende del reloj del dispositivo.</p>{timelineError&&<p role="alert" className="text-red-700">{timelineError}</p>}
    <ol className="mt-3 space-y-3">{timeline.map(event=><li key={event.id} className="border-l-2 pl-3"><p className="font-semibold">{({'INVENTORY_STARTED':'Inventario iniciado','INVENTORY_CAPTURE_STARTED':'Primera captura informada','SECTION_SAVED':'Sección guardada','SECTION_SAVE_FAILED':'Guardado fallido','INVENTORY_SUBMITTED':'Enviado','INVENTORY_APPROVED':'Aprobado','INVENTORY_REJECTED':'Rechazado','INVENTORY_PHOTO_UPLOAD_CONFIRMED':'Subida de fotografía confirmada'} as Record<string,string>)[event.action]||event.action} {event.details?.section?`· ${event.details.section}`:''}</p><p>Recibido: {date(event.timestamp)} · {event.user_name||event.user_email}</p>{(event.details?.client_occurred_at||event.details?.occurred_at)&&<p>Informado por el móvil: {date(event.details.client_occurred_at||event.details.occurred_at)}</p>}{event.details?.captured_count!==undefined&&<p>{event.details.captured_count} con información · {event.details.complete_count} completos · {event.details.pending_count} pendientes</p>}</li>)}</ol>
    {!timeline.length&&!timelineLoading&&!timelineError&&<p>Sin eventos visibles registrados.</p>}{timeline.length<timelineTotal&&<Button variant="outline" disabled={timelineLoading} onClick={()=>loadTimeline(detail.report,timeline.length)}>Cargar más eventos ({timeline.length} de {timelineTotal})</Button>}
   </>}
  </Modal>
  <Modal isOpen={!!pdfUrl} onClose={()=>setPdfUrl(null)} title="Vista PDF" size="xl">{pdfUrl&&<iframe src={pdfUrl} title="Reporte PDF" className="w-full h-[75vh]"/>}</Modal>
  <Modal isOpen={!!confirmDelete} onClose={()=>!deleting&&setConfirmDelete(null)} title="Eliminar inventario"><p>¿Eliminar el inventario de {confirmDelete?.plant_name||confirmDelete?.plant_id} / {confirmDelete?.year_month}? Esta acción elimina sus registros y fotografías y no puede deshacerse. La eliminación quedará registrada en Auditoría; las fotos compartidas con otros inventarios se conservarán.</p><div className="mt-4 flex gap-2"><Button variant="outline" disabled={deleting} onClick={()=>setConfirmDelete(null)}>Cancelar</Button><Button variant="destructive" disabled={deleting} onClick={deleteReport}>{deleting?'Eliminando…':'Eliminar inventario'}</Button></div></Modal>
 </div>;
}
