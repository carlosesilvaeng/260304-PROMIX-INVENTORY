import {projectId} from '/utils/supabase/info';
import {checkCancellation} from './reportTransport';
import {validateConfigurationPackage,type ConfigurationPackage} from './configurationPackages';
export const configurationBase=`https://${projectId}.supabase.co/functions/v1/make-server`;
export interface ConfigurationOptions {create_dependencies:boolean;deactivate_extras:boolean}
export interface ConfigurationPreview {
  preview_token:string|null;expires_at:string;fingerprint:string;destination:any;
  summary:Record<string,number>;errors:string[];warnings:string[];
  changes:{table:string;action:string;shared?:boolean;source_id?:string;target_id:string;before:any;after:any}[];
}
export async function configurationRequest(path:string,token:string,signal?:AbortSignal,body?:any){
  checkCancellation(signal);const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  const timeout=setTimeout(abort,60000);
  try {
    const response=await fetch(`${configurationBase}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal});
    const reply=await response.json();
    if(!response.ok||!reply.success)throw new Error(reply.error||`La consulta falló (${response.status}).`);
    if(reply.configuration_version!==1)throw new Error('Actualiza el servidor para exportar e importar configuraciones completas.');
    return reply.data;
  }catch(error){checkCancellation(signal);if(controller.signal.aborted)throw Error('La consulta tardó demasiado. Consulta la configuración antes de reintentar una aplicación.');throw error;}
  finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
export async function getConfigurationPackage(plantId:string,token:string,signal?:AbortSignal):Promise<ConfigurationPackage>{
  const file=await validateConfigurationPackage(await configurationRequest(`/plants/${encodeURIComponent(plantId)}/configuration-package`,token,signal));
  if(file.origin.plant_id!==plantId)throw Error('El archivo recibido no corresponde a la planta solicitada.');return file;
}
export async function previewConfiguration(target:string,file:ConfigurationPackage,options:ConfigurationOptions,token:string,signal?:AbortSignal):Promise<ConfigurationPreview>{
  const result=await configurationRequest(`/plants/${encodeURIComponent(target)}/configuration-package/preview`,token,signal,{package:file,options});
  if(!Array.isArray(result?.changes)||!Array.isArray(result?.errors)||!Array.isArray(result?.warnings)||!result.summary||typeof result.summary!=='object'||Array.isArray(result.summary)||Object.values(result.summary).some(value=>!Number.isInteger(value)||Number(value)<0)||!Number.isFinite(Date.parse(result.expires_at))||(!result.errors.length&&(typeof result.preview_token!=='string'||!/^[0-9a-f-]{36}$/i.test(result.preview_token)))||result.destination?.id!==target)throw Error('El servidor devolvió una vista previa incompleta.');return result;
}
export async function applyConfiguration(target:string,file:ConfigurationPackage,options:ConfigurationOptions,previewToken:string,token:string,signal?:AbortSignal){
  const result=await configurationRequest(`/plants/${encodeURIComponent(target)}/configuration-package/execute`,token,signal,{package:file,options,preview_token:previewToken});
  if(result?.plant_id!==target)throw Error('El servidor no confirmó la planta destino. Consulta la configuración antes de reintentar.');return result;
}
