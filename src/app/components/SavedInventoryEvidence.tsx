import {useEffect,useState} from 'react';
import {Card} from './Card';
import {Button} from './Button';
import {InventoryReportView} from './InventoryReportView';
import {useAuth} from '../contexts/AuthContext';
import {getInventoryReport,getReportPage} from '../utils/reportTransport';
import type {InventoryReport} from '../utils/inventoryReportModel';
import {projectId} from '/utils/supabase/info';
const base=`https://${projectId}.supabase.co/functions/v1/make-server`;
export function SavedInventoryEvidence({plantId,yearMonth,monthId}:{plantId:string;yearMonth:string;monthId?:string}){
 const {accessToken}=useAuth();const [data,setData]=useState<InventoryReport|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setData(null);setError('');
  void(async()=>{try{let summary:any={id:monthId,plant_id:plantId,year_month:yearMonth};if(!monthId){const page=await getReportPage(base,accessToken||'',{plant_id:plantId,year_month:yearMonth},0,controller.signal);summary=page.data[0];if(!summary)throw Error('No hay inventario guardado en este período.');}const report=await getInventoryReport(base,accessToken||'',summary,controller.signal);if(!controller.signal.aborted)setData(report);}catch(error:any){if(!controller.signal.aborted)setError(error.message);}finally{if(!controller.signal.aborted)setLoading(false);}})();return()=>controller.abort();
 },[plantId,yearMonth,monthId,revision,accessToken]);
 return <Card><div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xl font-semibold">Datos guardados del inventario</h3><Button size="sm" variant="outline" disabled={loading} onClick={()=>setRevision(value=>value+1)}>Actualizar datos guardados</Button></div>{loading&&<p role="status">Consultando datos guardados…</p>}{error&&<p role="alert" className="text-red-700">{error}</p>}{data&&<InventoryReportView detail={data}/>}</div></Card>;
}
