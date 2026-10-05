import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../../contexts/AuthContext';
import {Button} from '../../components/Button';
import {Card} from '../../components/Card';
import {CONFIG_TABLE_LABELS,validateConfigurationPackage,type ConfigurationPackage} from '../../utils/configurationPackages';
import {configurationFieldLabel} from '../../utils/configurationWorkbook';
import {getConfigurationPackage,previewConfiguration,applyConfiguration,type ConfigurationPreview} from '../../utils/configurationTransport';
import {downloadConfigurationJSON,exportPlantConfigurations} from '../../utils/exportPlantConfigurations';
import {readConfigurationWorkbook,type ExcelConfiguration} from '../../utils/configurationWorkbookImport';
import {MAX_EXCEL_BYTES,plantExcelLabel} from '../../utils/configurationExcelFormat';
const actions:Record<string,string>={create:'Crear',update:'Actualizar',reuse:'Reutilizar',retain:'Conservar adicional',deactivate:'Desactivar',remove_relation:'Retirar relación anterior'};
function changedFields(change:ConfigurationPreview['changes'][number]){
  const before=change.before||{},after=change.after||{};
  return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key])).map(key=>({field:configurationFieldLabel(key),before:before[key],after:after[key]}));
}
const display=(value:any)=>value===null||value===undefined?'Sin dato':typeof value==='boolean'?(value?'Sí':'No'):typeof value==='object'?JSON.stringify(value):String(value);
export function ConfigurationTransferPanel(){
  const {user,allPlants,accessToken,refreshPlants}=useAuth();
  const [source,setSource]=useState(''),[target,setTarget]=useState('');
  const [file,setFile]=useState<ConfigurationPackage|null>(null),[fileName,setFileName]=useState('');
  const [advanced,setAdvanced]=useState(false),[excelFiles,setExcelFiles]=useState<ExcelConfiguration[]>([]),[excelOrigin,setExcelOrigin]=useState('');
  const [fileStatus,setFileStatus]=useState('');
  const [createDependencies,setCreateDependencies]=useState(false),[deactivateExtras,setDeactivateExtras]=useState(false);
  const [preview,setPreview]=useState<ConfigurationPreview|null>(null),[busy,setBusy]=useState('');
  const [error,setError]=useState(''),[message,setMessage]=useState('');
  const controller=useRef<AbortController|null>(null),generation=useRef(0),owner=useRef(user?.id);owner.current=user?.id;
  const options={create_dependencies:createDependencies,deactivate_extras:deactivateExtras};
  const invalidate=()=>{generation.current++;controller.current?.abort();setPreview(null);setError('');setMessage('');setBusy('');};
  useEffect(()=>()=>{controller.current?.abort();generation.current++;},[]);
  useEffect(()=>{invalidate();setFile(null);setFileName('');setFileStatus('');setExcelFiles([]);setExcelOrigin('');setAdvanced(false);setSource('');setTarget('');setCreateDependencies(false);setDeactivateExtras(false);},[user?.id]);
  const run=async(label:string,work:(signal:AbortSignal,current:()=>boolean)=>Promise<void>)=>{
    controller.current?.abort();const abort=new AbortController();controller.current=abort;const id=++generation.current,account=owner.current;
    const current=()=>generation.current===id&&owner.current===account&&!abort.signal.aborted;
    setBusy(label);setError('');setMessage('');
    try{await work(abort.signal,current);}catch(error:any){if(current())setError(error.message);}finally{if(current())setBusy('');}
  };
  const selectExcel=(origin:string,entries=excelFiles)=>{
    const entry=entries.find(entry=>entry.configuration.origin.plant_id===origin);
    setExcelOrigin(origin);setFile(entry?.configuration||null);
    setFileStatus(entry?`Excel validado · ${entry.modified?'Con modificaciones respecto a la exportación':'Sin modificaciones respecto a la exportación'}`:'');
  };
  const loadFile=async(selected:File|undefined,format:'excel'|'json')=>{
    invalidate();setFile(null);setFileName('');setFileStatus('');setExcelFiles([]);setExcelOrigin('');if(!selected)return;
    await run(format==='excel'?'Leyendo Excel':'Leyendo JSON',async(signal,current)=>{
      if(selected.size>MAX_EXCEL_BYTES)throw Error('El archivo supera el máximo de 10 MB.');
      if(format==='excel'){
        if(!/\.xlsx$/i.test(selected.name))throw Error('Carga un archivo Excel .xlsx exportado por PROMIX.');
        const entries=await readConfigurationWorkbook(await selected.arrayBuffer(),signal);
        if(!current())return;setExcelFiles(entries);setFileName(selected.name);
        if(entries.length===1)selectExcel(entries[0].configuration.origin.plant_id,entries);
        else setMessage('Selecciona una configuración de origen del Excel para revisar y aplicar una planta por operación.');
      }else{
        const parsed=await validateConfigurationPackage(JSON.parse(await selected.text()));
        if(current()){setFile(parsed);setFileName(selected.name);setFileStatus('Integridad verificada');}
      }
    });
  };
  const useSource=()=>{invalidate();setFile(null);setFileName('');setFileStatus('');setExcelFiles([]);setExcelOrigin('');return run('Consultando origen',async(signal,current)=>{const data=await getConfigurationPackage(source,accessToken||'',signal);if(current()){setFile(data);setFileName(`Configuración actual de ${data.origin.plant_name}`);setFileStatus('Integridad verificada');}});};
  const exportJSON=()=>run('Preparando JSON',async(signal,current)=>{const data=await getConfigurationPackage(source,accessToken||'',signal);if(current()){downloadConfigurationJSON(data);setMessage('JSON completo descargado, con versión e integridad verificadas.');}});
  const exportExcel=(all=false)=>run('Preparando Excel',async(signal,current)=>{await exportPlantConfigurations(all?allPlants:allPlants.filter(plant=>plant.id===source),{signal,token:accessToken||''});if(current())setMessage('Excel completo descargado, con registros activos, inactivos y dependencias.');});
  const inspect=()=>run('Validando diferencias',async(signal,current)=>{setPreview(null);const plan=await previewConfiguration(target,file!,options,accessToken||'',signal);if(current())setPreview(plan);});
  const apply=()=>run('Aplicando configuración',async(signal,current)=>{
    const result=await applyConfiguration(target,file!,options,preview!.preview_token!,accessToken||'',signal);
    if(!current())return;setPreview(null);setMessage(`Configuración aplicada en ${allPlants.find(plant=>plant.id===target)?.name||target}. ${result.replayed?'Se recuperó la confirmación del intento anterior.':'El resultado quedó registrado en auditoría.'}`);
    // Refresh is separate from confirmation: a refresh failure is not a failed import.
    try{await refreshPlants();}catch{if(current())setMessage(previous=>previous+' Actualiza las plantas para consultar los cambios.');}
  });
  if(!['admin','super_admin'].includes(user?.role||''))return null;
  return <Card><div className="space-y-4" aria-label="Exportar y reutilizar configuraciones">
    <h3 className="text-lg font-semibold">Exportar y reutilizar configuraciones</h3>
    <p className="text-sm text-slate-600">Exporta, edita y carga las configuraciones con Excel. Incluye las siete secciones y sus dependencias, con registros activos e inactivos. Revisa las diferencias antes de aplicar.</p>
    {error&&<p role="alert" className="whitespace-pre-wrap text-red-700">{error}</p>}{message&&<p role="status" className="text-green-800">{message}</p>}
    <div className="grid gap-3 sm:grid-cols-2 min-w-0">
      <label className="min-w-0">Planta de origen<select aria-label="Planta de origen" value={source} disabled={!!busy} onChange={event=>{invalidate();setSource(event.target.value);}} className="mt-1 w-full min-h-11 rounded border px-3"><option value="">Selecciona una planta</option>{allPlants.map(plant=><option key={plant.id} value={plant.id}>{plant.name}{plant.isActive===false?' (inactiva)':''}</option>)}</select></label>
      <div className="flex flex-wrap items-end gap-2"><Button disabled={!!busy||!source} onClick={()=>exportExcel()}>Exportar Excel</Button><Button variant="outline" disabled={!!busy||!allPlants.length} onClick={()=>exportExcel(true)}>Excel de todas las plantas</Button></div>
    </div>
    <label className="flex gap-2 items-center"><input type="checkbox" checked={advanced} disabled={busy==='Aplicando configuración'} onChange={event=>setAdvanced(event.target.checked)}/>Mostrar opciones avanzadas (JSON)</label>
    {advanced&&<Button variant="outline" disabled={!!busy||!source} onClick={exportJSON}>Guardar JSON</Button>}
    <div className="border-t pt-4 space-y-3">
      <h4 className="font-semibold">Restaurar o copiar una configuración</h4>
      <div className="flex flex-wrap gap-3 items-center"><label className="min-w-0 max-w-full">Cargar Excel<input aria-label="Cargar Excel de configuración" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy==='Aplicando configuración'} onChange={event=>{const selected=event.target.files?.[0];event.target.value='';void loadFile(selected,'excel');}} className="block w-full max-w-full min-w-0 min-h-11 mt-1"/></label><Button variant="outline" disabled={!!busy||!source} onClick={useSource}>Copiar desde otra planta</Button></div>
      <p className="text-sm text-slate-600">Para retirar un equipo, cambia Activo a No en el Excel. Para agregarlo, completa una fila vacía. Las curvas y datos estructurados se editan desde sus pantallas.</p>
      {advanced&&<label className="block min-w-0 max-w-full">Cargar JSON<input aria-label="Cargar JSON de configuración" type="file" accept=".json,application/json" disabled={busy==='Aplicando configuración'} onChange={event=>{const selected=event.target.files?.[0];event.target.value='';void loadFile(selected,'json');}} className="block w-full max-w-full min-w-0 min-h-11 mt-1"/></label>}
      {excelFiles.length>1&&<label className="block min-w-0">Configuración de origen del Excel<select aria-label="Configuración de origen del Excel" value={excelOrigin} disabled={busy==='Aplicando configuración'} onChange={event=>{invalidate();selectExcel(event.target.value);}} className="mt-1 w-full min-h-11 rounded border px-3"><option value="">Selecciona una configuración del archivo</option>{excelFiles.map(entry=><option key={entry.configuration.origin.plant_id} value={entry.configuration.origin.plant_id}>{plantExcelLabel(entry.configuration)}</option>)}</select></label>}
      {file&&<p className="text-sm break-words">{fileName} · Origen: {file.origin.plant_name} · Exportado: {new Date(file.generated_at).toLocaleString('es-PR',{timeZone:'America/Puerto_Rico'})} · {fileStatus}</p>}
      <label className="block">Planta destino<select aria-label="Planta destino" value={target} disabled={busy==='Aplicando configuración'} onChange={event=>{invalidate();setTarget(event.target.value);}} className="mt-1 w-full min-h-11 rounded border px-3"><option value="">Selecciona explícitamente el destino</option>{allPlants.map(plant=><option key={plant.id} value={plant.id}>{plant.name}{plant.isActive===false?' (inactiva)':''}</option>)}</select></label>
      <label className="flex gap-2 items-start"><input type="checkbox" checked={createDependencies} disabled={busy==='Aplicando configuración'} onChange={event=>{invalidate();setCreateDependencies(event.target.checked);}} className="mt-1"/><span>Autorizar la creación de dependencias compartidas faltantes. Se mostrarán en la vista previa; las existentes incompatibles no se sobrescriben.</span></label>
      <label className="flex gap-2 items-start"><input type="checkbox" checked={deactivateExtras} disabled={busy==='Aplicando configuración'} onChange={event=>{invalidate();setDeactivateExtras(event.target.checked);}} className="mt-1"/><span>Desactivar configuraciones adicionales de la planta destino que no estén en el paquete. Por defecto se conservan.</span></label>
      <div className="flex flex-wrap gap-2"><Button disabled={!!busy||!file||!target} onClick={inspect}>Revisar diferencias</Button>{busy&&<p role="status" className="self-center">{busy}…</p>}{busy&&busy!=='Aplicando configuración'&&<Button variant="outline" onClick={()=>{invalidate();setMessage('Operación cancelada.');}}>Cancelar operación</Button>}</div>
    </div>
    {preview&&<div className="space-y-3 border-t pt-4" aria-label="Vista previa de configuración">
      <h4 className="font-semibold">Destino: {preview.destination.name}</h4>
      <p className="text-sm">Esta revisión no ha modificado la configuración. Caduca a las {new Date(preview.expires_at).toLocaleTimeString('es-PR',{timeZone:'America/Puerto_Rico'})} (Puerto Rico).</p>
      <p>{Object.entries(preview.summary).map(([action,count])=>`${actions[action]||action}: ${count}`).join(' · ')}</p>
      {preview.warnings.map(warning=><p key={warning} className="text-sm text-amber-800">{warning}</p>)}
      {preview.errors.map(error=><p role="alert" key={error} className="text-red-700">{error}</p>)}
      <div className="max-h-96 overflow-auto"><table className="w-full text-sm"><thead><tr>{['Sección / dependencia','Elemento','Acción','Diferencias'].map(label=><th className="p-2 text-left" key={label}>{label}</th>)}</tr></thead><tbody>{preview.changes.map((change,index)=><tr key={index} className="border-t">
        <td className="p-2">{CONFIG_TABLE_LABELS[change.table]||'Parámetros de planta'}{change.shared?' (compartida)':''}</td><td className="p-2">{change.after?.aggregate_name||change.after?.silo_name||change.after?.product_name||change.after?.additive_name||change.after?.meter_name||change.after?.curve_name||change.after?.name_es||change.after?.nombre||change.before?.product_name||change.after?.code||change.source_id||change.target_id}</td><td className="p-2">{actions[change.action]}</td>
        <td className="p-2">{['reuse','retain'].includes(change.action)?'Sin cambios':<details><summary className="min-h-11 cursor-pointer">Ver {changedFields(change).length} campos</summary><dl>{changedFields(change).map(field=><div key={field.field} className="max-w-lg break-words mb-2"><dt className="font-semibold">{field.field}</dt><dd>Antes: {display(field.before)}</dd><dd>Después: {display(field.after)}</dd></div>)}</dl></details>}</td>
      </tr>)}</tbody></table></div>
      <Button variant="secondary" disabled={!!busy||!!preview.errors.length||!preview.preview_token} onClick={apply}>Aplicar configuración revisada</Button>
    </div>}
    <p className="text-sm text-slate-600">Este paquete no sustituye el respaldo de la base de datos, usuarios y fotografías. La importación conserva los inventarios históricos.</p>
  </div></Card>;
}
