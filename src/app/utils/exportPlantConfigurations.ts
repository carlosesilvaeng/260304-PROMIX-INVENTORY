import type {Plant} from '../contexts/AuthContext';
import {getConfigurationPackage} from './configurationTransport';
import {createConfigurationWorkbook} from './configurationWorkbook';
import {checkCancellation} from './reportTransport';
import type {ConfigurationPackage} from './configurationPackages';
export function downloadConfigurationJSON(file:ConfigurationPackage){
  const pretty=JSON.stringify(file,null,2),content=new TextEncoder().encode(pretty).length<=10*1024*1024?pretty:JSON.stringify(file);
  download(new Blob([content],{type:'application/json'}),`PROMIX-Configuracion-${file.payload.plant.code.replace(/[^a-z0-9_-]/gi,'_')}-${file.generated_at.slice(0,10)}.json`);
}
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function exportPlantConfigurations(plants:Plant[],options:{signal?:AbortSignal;token?:string}={}){
  if(!plants.length)throw Error('Selecciona al menos una planta para exportar.');
  const files:ConfigurationPackage[]=new Array(plants.length),failures:string[]=[];let next=0;
  await Promise.all(Array.from({length:Math.min(3,plants.length)},async()=>{while(next<plants.length){checkCancellation(options.signal);const index=next++,plant=plants[index];try{files[index]=await getConfigurationPackage(plant.id,options.token||localStorage.getItem('promix_access_token')||'',options.signal);}catch(error:any){checkCancellation(options.signal);failures.push(`${plant.name}: ${error.message}`);}}}));
  if(failures.length)throw Error(`No se generó el archivo. Falló la configuración de:\n${failures.join('\n')}`);
  checkCancellation(options.signal);const workbook=await createConfigurationWorkbook(files);const buffer=await workbook.xlsx.writeBuffer();checkCancellation(options.signal);
  download(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`PROMIX-Configuracion-Completa-${new Date().toISOString().slice(0,10)}.xlsx`);
}
