import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePlantPrefill } from '../contexts/PlantPrefillContext';
import { getInventoryMonth } from '../utils/api';
const labels: Record<string,string> = { aggregates:'Agregados',silos:'Silos',additives:'Aditivos',diesel:'Diésel',products:'Productos',utilities:'Utilidades','petty-cash':'Caja chica' };
const states: Record<string,string> = { 'saving-local':'Guardando en este dispositivo',local:'Guardado en este dispositivo',pending:'Pendiente de sincronizar',syncing:'Sincronizando',server:'Guardado en servidor',attention:'Requiere atención' };
const properties: Record<string,string> = { aggregates:'agregados', additives:'aditivos',products:'productos','petty-cash':'pettyCash' };
const localFields: Record<string,string> = {aggregates:'agregadosEntries',silos:'silosEntries',additives:'aditivosEntries',diesel:'dieselEntry',products:'productosEntries',utilities:'utilitiesEntries','petty-cash':'pettyCashEntry'};
function compareRows(value: any) {
  const rows = Array.isArray(value) ? value : value ? [value] : [];
  return rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => /name|reading|quantity|length|height|cone_|cash|receipts|purchases|notes|photo_url/.test(key)).map(([key,val]) => [key,key === 'photo_url' ? (val ? 'Fotografía adjunta' : 'Sin fotografía') : val])));
}
export function InventorySyncStatus({ section }: { section?: string | null }) {
  const { prefillData, syncStates, saveSection, resolveDraft, exportDrafts } = usePlantPrefill();
  const { user } = useAuth();
  const scope = `${user?.id}:${prefillData.inventoryMonth?.id}`;
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const [comparison, setComparison] = useState<{section:string;server:any;revision:number} | null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  useEffect(() => { setComparison(null); setError(''); setBusy(false); }, [scope]);
  const candidate = ({agregados:'aggregates',aditivos:'additives',aceites:'products',productos:'products',utilidades:'utilities',pettyCash:'petty-cash'} as Record<string,string>)[section || ''] || section;
  const selected = candidate && labels[candidate] ? candidate : undefined;
  const entries = Object.entries(syncStates).filter(([key,state]) => selected ? key === selected : state.state !== 'server');
  if (!prefillData.inventoryMonth || !entries.length) return null;
  const run = async (operation: () => Promise<any>) => {const initial=scopeRef.current;setBusy(true);setError('');try {await operation();} catch(error:any){if(scopeRef.current===initial)setError(error.message);} finally{if(scopeRef.current===initial)setBusy(false);}};
  const compare = async (section:string) => {
    const initial=scopeRef.current;
    const month = prefillData.inventoryMonth!;
    const reply = await getInventoryMonth(month.plant_id,month.year_month);
    if (initial !== scopeRef.current) return;
    if (!reply.success || !reply.data) throw new Error(reply.error || 'No se pudo consultar el servidor.');
    setComparison({section,server:(reply.data as any)[properties[section] || section],revision:reply.data.section_revisions?.[section] || 0});
  };
  return <aside className="shrink-0 border-b bg-white px-3 py-2 text-sm max-h-[40vh] overflow-y-auto" aria-label="Estado del borrador">
    <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
      {entries.map(([key,state]) => <div key={key} className="min-w-0 flex-1 basis-48">
        <p className={state.state === 'attention' ? 'font-semibold text-red-700' : 'font-semibold text-slate-700'}>{labels[key]}: {states[state.state]}</p>
        {state.message && <p className="break-words text-xs">{state.message}</p>}
        {state.state === 'attention' && <button className="min-h-11 underline" disabled={busy} onClick={()=>run(()=>compare(key))}>Consultar diferencias</button>}
      </div>)}
      <button className="min-h-11 rounded bg-[#2475C7] px-3 text-white disabled:opacity-50" disabled={busy} onClick={()=>run(async()=>{
        const replies=await Promise.all(entries.map(([key])=>saveSection(key)));
        const failed=replies.find(reply=>!reply.success);if(failed)throw new Error(failed.error || 'Hay cambios pendientes.');
      })}>Guardar ahora</button>
      {entries.some(([,state])=>state.state === 'attention') && <button className="min-h-11 underline" onClick={exportDrafts}>Exportar borrador</button>}
    </div>
    {comparison && entries.some(([key])=>key===comparison.section) && <details open className="mt-2 border rounded p-2">
      <summary>Comparar {labels[comparison.section]} antes de decidir</summary>
      <div className="grid gap-2 sm:grid-cols-2">
        <div><p>Mi borrador</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(compareRows((prefillData as any)[localFields[comparison.section]]),null,2)}</pre></div>
        <div><p>Guardado en servidor</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(compareRows(comparison.server),null,2)}</pre></div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="min-h-11 underline" disabled={busy} onClick={()=>run(async()=>{
          if (!window.confirm('Se reemplazará tu borrador local con los datos guardados en servidor. ¿Continuar?')) return;
          await resolveDraft(comparison.section,false);setComparison(null);
        })}>Usar los datos del servidor</button>
        <button className="min-h-11 underline" disabled={busy} onClick={()=>run(async()=>{
          if (!window.confirm('¿Revisaste las diferencias y deseas guardar tu borrador sobre esa revisión del servidor?')) return;
          await resolveDraft(comparison.section,true,comparison.revision);setComparison(null);
        })}>Guardar mi borrador tras revisar</button>
      </div>
    </details>}
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  </aside>;
}
