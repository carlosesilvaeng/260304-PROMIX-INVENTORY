import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../../contexts/AuthContext';
import {Button} from '../../components/Button';
import {Card} from '../../components/Card';
import {CONFIG_TABLE_LABELS,validateConfigurationPackage,type ConfigurationPackage} from '../../utils/configurationPackages';
import {configurationFieldLabel} from '../../utils/configurationWorkbook';
import {getConfigurationPackage,previewConfiguration,applyConfiguration,type ConfigurationPreview} from '../../utils/configurationTransport';
import {downloadConfigurationJSON,exportPlantConfigurations} from '../../utils/exportPlantConfigurations';
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
  const [createDependencies,setCreateDependencies]=useState(false),[deactivateExtras,setDeactivateExtras]=useState(false);
  const [preview,setPreview]=useState<ConfigurationPreview|null>(null),[busy,setBusy]=useState('');
  const [error,setError]=useState(''),[message,setMessage]=useState('');
  const controller=useRef<AbortController|null>(null),generation=useRef(0),owner=useRef(user?.id);owner.current=user?.id;
  const options={create_dependencies:createDependencies,deactivate_extras:deactivateExtras};
  const invalidate=()=>{generation.current++;controller.current?.abort();setPreview(null);setError('');setMessage('');setBusy('');};
  useEffect(()=>()=>{controller.current?.abort();generation.current++;},[]);
  useEffect(()=>{invalidate();setFile(null);setFileName('');setSource('');setTarget('');setCreateDependencies(false);setDeactivateExtras(false);},[user?.id]);
  const run=async(label:string,work:(signal:AbortSignal,current:()=>boolean)=>Promise<void>)=>{
    controller.current?.abort();const abort=new AbortController();controller.current=abort;const id=++generation.current,account=owner.current;
    const current=()=>generation.current===id&&owner.current===account&&!abort.signal.aborted;
    setBusy(label);setError('');setMessage('');
    try{await work(abort.signal,current);}catch(error:any){if(current())setError(error.message);}finally{if(current())setBusy('');}
  };
  const loadFile=async(selected?:File)=>{
    invalidate();setFile(null);setFileName('');if(!selected)return;
    const id=generation.current;
    try{if(selected.size>10*1024*1024)throw Error('El archivo supera el máximo de 10 MB.');const parsed=await validateConfigurationPackage(JSON.parse(await selected.text()));if(generation.current!==id)return;setFile(parsed);setFileName(selected.name);}catch(error:any){if(generation.current===id)setError(error.message);}
  };
  const useSource=()=>run('Consultando origen',async(signal,current)=>{setFile(null);setFileName('');setPreview(null);const data=await getConfigurationPackage(source,accessToken||'',signal);if(current()){setFile(data);setFileName(`Configuración actual de ${data.origin.plant_name}`);setPreview(null);}});
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
    <p className="text-sm text-slate-600">Excel documenta los parámetros. JSON permite restaurarlos o copiarlos. Incluyen las siete secciones y sus dependencias, con registros activos e inactivos.</p>
    {error&&<p role="alert" className="whitespace-pre-wrap text-red-700">{error}</p>}{message&&<p role="status" className="text-green-800">{message}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Planta de origen<select aria-label="Planta de origen" value={source} disabled={!!busy} onChange={event=>setSource(event.target.value)} className="mt-1 w-full min-h-11 rounded border px-3"><option value="">Selecciona una planta</option>{allPlants.map(plant=><option key={plant.id} value={plant.id}>{plant.name}{plant.isActive===false?' (inactiva)':''}</option>)}</select></label>
      <div className="flex flex-wrap items-end gap-2"><Button variant="secondary" disabled={!!busy||!source} onClick={()=>exportExcel()}>Excel completo</Button><Button variant="outline" disabled={!!busy||!source} onClick={exportJSON}>Guardar JSON</Button><Button variant="outline" disabled={!!busy||!allPlants.length} onClick={()=>exportExcel(true)}>Excel de todas las plantas</Button></div>
    </div>
    <div className="border-t pt-4 space-y-3">
      <h4 className="font-semibold">Restaurar o copiar una configuración</h4>
      <div className="flex flex-wrap gap-3 items-center"><label className="min-w-0 max-w-full">Cargar JSON<input aria-label="Cargar JSON de configuración" type="file" accept=".json,application/json" disabled={busy==='Aplicando configuración'} onChange={event=>void loadFile(event.target.files?.[0])} className="block w-full max-w-full min-h-11 mt-1"/></label><Button variant="outline" disabled={!!busy||!source} onClick={useSource}>Usar planta de origen para copiar</Button></div>
      {file&&<p className="text-sm break-words">{fileName} · Origen: {file.origin.plant_name} · Exportado: {new Date(file.generated_at).toLocaleString('es-PR',{timeZone:'America/Puerto_Rico'})} · Integridad verificada</p>}
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
