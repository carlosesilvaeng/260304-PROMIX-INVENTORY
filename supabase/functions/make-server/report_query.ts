import { InventoryError } from './inventory_guard.ts';
export function parseReportingQuery(query:Record<string,string>,audit=false){
 const integer=(key:string,fallback:number,max:number)=>{const raw=query[key];if(raw===undefined)return fallback;if(!/^\d+$/.test(raw)||Number(raw)>max)throw new InventoryError(`Parámetro ${key} inválido.`);return Number(raw);};
 const offset=integer('offset',0,10000000),limit=integer('limit',50,100);if(limit<1)throw new InventoryError('Límite inválido.');
 const filters:Record<string,string>={};for(const key of ['plant_id','year_month','year','month','status','as_of','activity_order',...(audit?['user_id','inventory_month_id']:[])])if(query[key])filters[key]=query[key];
 if(filters.year_month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(filters.year_month))throw new InventoryError('Período inválido.');
 if(filters.year&&!/^\d{4}$/.test(filters.year))throw new InventoryError('Año inválido.');
 if(filters.month&&!/^(0[1-9]|1[0-2])$/.test(filters.month))throw new InventoryError('Mes inválido.');
 if(filters.status&&!['IN_PROGRESS','SUBMITTED','APPROVED'].includes(filters.status))throw new InventoryError('Estado inválido.');
 if(filters.activity_order&&!['asc','desc'].includes(filters.activity_order))throw new InventoryError('Orden de actividad inválido.');
 if(filters.as_of&&!Number.isFinite(Date.parse(filters.as_of)))throw new InventoryError('Fecha de consulta inválida.');
 return {filters,offset,limit};
}
