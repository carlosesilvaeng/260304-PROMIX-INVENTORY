import logoUrl from '@/assets/logo-promix.png';
import * as XLSX from 'xlsx';
import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import {consolidateInventoryReports,reportSectionLabel,unitLabel,type InventoryReport} from './inventoryReportModel';
import {checkCancellation,loadReportDetails,type ReportOptions} from './reportTransport';
import {createReportWorkbook,REPORT_STATUS,type PhotoAvailability} from './reportWorkbook';
export interface ReportSummary {id:string;plant_id:string;year_month:string;status:'IN_PROGRESS'|'SUBMITTED'|'APPROVED';created_by:string;created_at:string;updated_at:string;approved_by?:string;approved_at?:string;write_revision?:number}
async function loadPhoto(url:string,signal?:AbortSignal):Promise<PhotoAvailability['image']>{
 checkCancellation(signal);if(!/^(https?:\/\/|data:image\/(png|jpeg|webp);base64,|\/assets\/)/i.test(url))return undefined;
 const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,15000);
 try{
  // Public evidence URLs need no bearer token. Never send credentials to images.
  const response=await fetch(url,{signal:controller.signal});if(!response.ok)return undefined;const blob=await response.blob();if(blob.size>15*1024*1024)return undefined;
  if(controller.signal.aborted)return undefined;
  const dataUrl=await new Promise<string>((resolve,reject)=>{
   const reader=new FileReader();const cancel=()=>{reader.abort();reject(new Error('Lectura de imagen cancelada.'));};
   const cleanup=()=>controller.signal.removeEventListener('abort',cancel);
   reader.onload=()=>{cleanup();resolve(String(reader.result));};reader.onerror=()=>{cleanup();reject(reader.error);};
   controller.signal.addEventListener('abort',cancel,{once:true});reader.readAsDataURL(blob);
  });
  if(controller.signal.aborted)return undefined;
  const image=new Image();await new Promise<void>((resolve,reject)=>{
   const cancel=()=>{cleanup();image.src='';reject(new Error('La imagen tardó demasiado.'));};
   const cleanup=()=>controller.signal.removeEventListener('abort',cancel);
   image.onload=()=>{cleanup();resolve();};image.onerror=()=>{cleanup();reject(new Error('Imagen no disponible.'));};
   controller.signal.addEventListener('abort',cancel,{once:true});image.src=dataUrl;
  });
  if(!image.naturalWidth||!image.naturalHeight)return undefined;
  const scale=Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d');if(!ctx)return undefined;ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return {dataUrl:canvas.toDataURL('image/jpeg',0.85),format:'JPEG',width:canvas.width,height:canvas.height};
 }catch(error){checkCancellation(signal);return undefined;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function prepareExport(reports:ReportSummary[],base:string,token:string,options:ReportOptions={}){
 const details=options.details||await loadReportDetails(reports,base,token,options);
 if(details.length!==reports.length||details.some((detail,index)=>detail.report.id!==reports[index].id))throw Error('El detalle de exportación no coincide con los inventarios seleccionados.');
 const photos:PhotoAvailability[]=details.flatMap(detail=>detail.sections.flatMap(section=>section.photos.map(photo=>({reportId:detail.report.id,section:section.name,...photo,available:false}))));let next=0;
 await Promise.all(Array.from({length:Math.min(3,photos.length)},async()=>{while(next<photos.length){checkCancellation(options.signal);const photo=photos[next++];photo.image=await loadPhoto(photo.url,options.signal);photo.available=!!photo.image;}}));checkCancellation(options.signal);
 return {details,photos};
}
export async function exportToExcel(reports:ReportSummary[],base:string,token:string,options:ReportOptions={}){
 const {details,photos}=await prepareExport(reports,base,token,options);checkCancellation(options.signal);
 const workbook=createReportWorkbook(details,options.filters||{},photos);
 XLSX.writeFile(workbook,`PROMIX-Inventarios-${new Date().toISOString().slice(0,10)}.xlsx`);
}
export interface PdfExportOptions extends ReportOptions {mode?:'download'|'preview';fileName?:string}
export async function exportToPDF(reports:ReportSummary[],base:string,token:string,generatedBy='Sistema',options:PdfExportOptions={}):Promise<string|void>{
 const {details,photos}=await prepareExport(reports,base,token,options);checkCancellation(options.signal);
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight();
 const generatedAt=new Date().toISOString();let y=18;
 const logo=await loadPhoto(logoUrl,options.signal);checkCancellation(options.signal);
 if(logo){const scale=Math.min(40/logo.width,14/logo.height);doc.addImage(logo.dataUrl,logo.format,10,8,logo.width*scale,logo.height*scale);y=30;}
 const text=(value:string,size=8)=>{if(y>height-18){doc.addPage();y=14;}doc.setFontSize(size);const lines=doc.splitTextToSize(value,width-20);doc.text(lines,10,y);y+=lines.length*(size*0.4)+3;};
 const table=(headers:string[],rows:any[][])=>{if(y>height-28){doc.addPage();y=14;}autoTable(doc,{startY:y,head:[headers],body:rows.map(row=>row.map(cell=>cell===null||cell===undefined?'Sin dato':typeof cell==='number'?cell.toLocaleString('es-PR',{maximumFractionDigits:6}):String(cell))),headStyles:{fillColor:[36,117,199],fontSize:7},bodyStyles:{fontSize:7,overflow:'linebreak'},margin:{left:10,right:10,bottom:15}});y=(doc as any).lastAutoTable.finalY+7;};
 text('PROMIX · Reporte de inventarios guardados',14);text(`Generado: ${generatedAt} · ${generatedBy}`);text(`Filtros: ${JSON.stringify(options.filters||{})}`);
 text('Solo valores guardados. Las unidades y cantidades históricas no se recalculan con la configuración actual. La actividad sin conexión solo es conocida cuando llega al servidor.');
 table(['Planta','Período','Estado','Registros guardados','Con información','Completos','Pendientes','Último guardado recibido'],details.map(d=>[d.report.plant_name||d.report.plant_id,d.report.year_month,REPORT_STATUS[d.report.status],d.progress.saved_count,d.progress.captured_count??'Por verificar',d.progress.complete_count??'Por verificar',d.progress.pending_count??'Por verificar',d.progress.last_save_received_at||'Sin guardado confirmado']));
 text('Consolidado por período, material, métrica y unidad',11);
 table(['Período','Sección','Material / producto','Métrica','Cantidad','Unidad','Anterior','Diferencia','Comparación'],consolidateInventoryReports(details).map(m=>[m.period,reportSectionLabel(m.section),m.material,m.metric,m.value,unitLabel(m.unit),m.previous,m.difference,m.comparison]));
 for(const detail of details){checkCancellation(options.signal);doc.addPage();y=14;text(`${detail.report.plant_name||detail.report.plant_id} · ${detail.report.year_month} · ${REPORT_STATUS[detail.report.status]}`,12);
  text(`Iniciado: ${detail.report.created_at} · ${detail.report.created_by||'Sin usuario registrado'} · Revisión: ${detail.report.write_revision??'Sin registro'}`);
  text(`Primera captura recibida: ${detail.progress.first_capture_received_at||'Sin evento recibido'} · Primera captura informada por el móvil: ${detail.progress.first_capture_client_at||'Sin hora de origen registrada'}`);
  for(const warning of detail.warnings)text(`Advertencia: ${warning}`);
  for(const section of detail.sections){if(y>height-65){doc.addPage();y=14;}text(section.name,10);if(section.note)text(section.note);
   table(section.headers,section.rows.map(row=>row.map((cell,index)=>section.headers[index]==='Foto'?(cell?'Evidencia vinculada':'Sin fotografía'):cell)));
   for(const photo of photos.filter(p=>p.reportId===detail.report.id&&p.section===section.name)){
    if(y+43>height-15){doc.addPage();y=14;}text(`Evidencia: ${photo.label}`);
    if(!photo.image){text('Fotografía no disponible; no se pudo cargar.');continue;}
    const scale=Math.min((width-20)/photo.image.width,30/photo.image.height);doc.addImage(photo.image.dataUrl,photo.image.format,10,y,photo.image.width*scale,photo.image.height*scale);y+=photo.image.height*scale+6;
   }
  }
 }
 const total=doc.getNumberOfPages();for(let page=1;page<=total;page++){doc.setPage(page);doc.setFontSize(7);doc.text(`Generado ${generatedAt} · ${generatedBy}`,10,height-5);doc.text(`${page} / ${total}`,width-10,height-5,{align:'right'});}checkCancellation(options.signal);
 if(options.mode==='preview')return URL.createObjectURL(doc.output('blob'));
 doc.save(options.fileName||`PROMIX-Inventarios-${generatedAt.slice(0,10)}.pdf`);
}
