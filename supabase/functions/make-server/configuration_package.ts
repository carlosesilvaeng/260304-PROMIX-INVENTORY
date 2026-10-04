/** Portable plant configuration. No users, inventories or photograph objects. */
export const CONFIG_TABLES = [
  'unit_categories', 'units', 'materiales_catalog', 'procedencias_catalog', 'additives_catalog',
  'material_conversion_factors', 'calibration_curves',
  'plant_aggregates_config', 'plant_cajones_config', 'plant_silos_config', 'plant_additives_config',
  'plant_diesel_config', 'plant_products_config', 'plant_utilities_meters_config', 'plant_petty_cash_config',
  'measurement_configs', 'calibration_curve_points', 'silo_allowed_products',
] as const;
export const CONFIG_TABLE_LABELS: Record<string, string> = {
  unit_categories:'Categorías de unidades', units:'Unidades', materiales_catalog:'Materiales',
  procedencias_catalog:'Procedencias', additives_catalog:'Catálogo de aditivos',
  material_conversion_factors:'Factores de conversión', calibration_curves:'Curvas de calibración',
  plant_aggregates_config:'Agregados', plant_cajones_config:'Cajones', plant_silos_config:'Silos',
  plant_additives_config:'Aditivos', plant_diesel_config:'Diésel', plant_products_config:'Aceites y productos',
  plant_utilities_meters_config:'Utilidades', plant_petty_cash_config:'Caja chica',
  measurement_configs:'Reglas de medición', calibration_curve_points:'Puntos de calibración',
  silo_allowed_products:'Productos permitidos por silo',
};
export interface ConfigurationPayload { plant:Record<string,any>; tables:Record<string,any[]>; schema:Record<string,string[]>; numeric_fields:Record<string,string[]>; json_fields:Record<string,string[]> }
export interface ConfigurationPackage {
  format:'promix-plant-configuration'; version:1; generated_at:string;
  origin:{environment:string;plant_id:string;plant_name:string};
  payload:ConfigurationPayload; integrity:{algorithm:'SHA-256';digest:string};
}
export class ConfigurationError extends Error { status=400; code='INVALID_CONFIGURATION_PACKAGE'; }
export function canonicalJSON(value:any,depth=0):string {
  if(depth>50)throw new ConfigurationError('El archivo contiene demasiados niveles de datos.');
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(item=>canonicalJSON(item,depth+1)).join(',')+']';
  if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype){
    return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalJSON(value[key],depth+1)).join(',')+'}';
  }
  throw new ConfigurationError('El archivo contiene valores que no se pueden representar en JSON.');
}
export async function configurationDigest(value:any) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalJSON(value))))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export function validateConfigurationPayload(payload:any):asserts payload is ConfigurationPayload {
  if(!payload||typeof payload!=='object'||!payload.plant?.id||!payload.plant?.name||!payload.tables||!payload.schema||!payload.numeric_fields||!payload.json_fields)throw new ConfigurationError('Faltan datos de origen, tablas o esquema en la configuración.');
  if(Object.keys(payload).some(key=>!['plant','tables','schema','numeric_fields','json_fields'].includes(key)))throw new ConfigurationError('El contenido tiene una sección no soportada.');
  if(Object.keys(payload.tables).length!==CONFIG_TABLES.length||Object.keys(payload.schema).length!==CONFIG_TABLES.length||Object.keys(payload.numeric_fields).length!==CONFIG_TABLES.length||Object.keys(payload.json_fields).length!==CONFIG_TABLES.length)throw new ConfigurationError('El paquete debe contener todas las secciones y dependencias de configuración.');
  for(const table of CONFIG_TABLES){
    const rows=payload.tables[table],columns=payload.schema[table];
    if(!Array.isArray(rows)||!Array.isArray(columns)||!columns.every(column=>typeof column==='string')||!columns.includes('id'))throw new ConfigurationError(`Sección inválida: ${CONFIG_TABLE_LABELS[table]}.`);
    if(!Array.isArray(payload.numeric_fields[table])||payload.numeric_fields[table].some((field:any)=>typeof field!=='string'||!columns.includes(field)))throw new ConfigurationError(`Metadatos numéricos inválidos: ${CONFIG_TABLE_LABELS[table]}.`);
    if(!Array.isArray(payload.json_fields[table])||payload.json_fields[table].some((field:any)=>typeof field!=='string'||!columns.includes(field)))throw new ConfigurationError(`Metadatos JSON inválidos: ${CONFIG_TABLE_LABELS[table]}.`);
    if(rows.length>10000)throw new ConfigurationError(`Demasiados registros en ${CONFIG_TABLE_LABELS[table]}.`);
    const ids=new Set();
    for(const row of rows){
      if(!row||Array.isArray(row)||typeof row!=='object'||typeof row.id!=='string'||!row.id||ids.has(row.id))throw new ConfigurationError(`${CONFIG_TABLE_LABELS[table]} contiene registros sin identificador o duplicados.`);
      ids.add(row.id);
      for(const field of payload.json_fields[table])if(row[field]!==null&&row[field]!==undefined){
        if(typeof row[field]!=='string')throw new ConfigurationError(`Datos JSON sin representación exacta: ${CONFIG_TABLE_LABELS[table]} / ${field}.`);
        try{JSON.parse(row[field]);}catch{throw new ConfigurationError(`Datos JSON inválidos: ${CONFIG_TABLE_LABELS[table]} / ${field}.`);}
      }
      for(const field of payload.numeric_fields[table])if(row[field]!==null&&row[field]!==undefined&&typeof row[field]!=='number'&&!(typeof row[field]==='string'&&/^[+-]?\d+(\.\d+)?$/.test(row[field])))throw new ConfigurationError(`Decimal inválido: ${CONFIG_TABLE_LABELS[table]} / ${field}.`);
      if(Object.keys(row).some(key=>!columns.includes(key)))throw new ConfigurationError(`${CONFIG_TABLE_LABELS[table]} contiene campos no declarados.`);
      if('plant_id' in row&&row.plant_id!==null&&row.plant_id!==payload.plant.id)throw new ConfigurationError(`${CONFIG_TABLE_LABELS[table]} incluye datos de otra planta.`);
    }
  }
  canonicalJSON(payload);
}
export async function createConfigurationPackage(payload:ConfigurationPayload,environment:string,generatedAt=new Date().toISOString()):Promise<ConfigurationPackage> {
  validateConfigurationPayload(payload);
  const unsigned={format:'promix-plant-configuration' as const,version:1 as const,generated_at:generatedAt,origin:{environment,plant_id:payload.plant.id,plant_name:payload.plant.name},payload};
  return {...unsigned,integrity:{algorithm:'SHA-256',digest:await configurationDigest(unsigned)}};
}
export async function validateConfigurationPackage(value:any):Promise<ConfigurationPackage> {
  if(!value||value.format!=='promix-plant-configuration'||value.version!==1)throw new ConfigurationError('El formato o la versión del paquete no son compatibles.');
  if(Object.keys(value).some(key=>!['format','version','generated_at','origin','payload','integrity'].includes(key)))throw new ConfigurationError('El paquete contiene campos de formato no soportados.');
  validateConfigurationPayload(value.payload);
  if(!Number.isFinite(Date.parse(value.generated_at))||typeof value.origin?.environment!=='string'||value.origin.plant_id!==value.payload.plant.id||value.origin.plant_name!==value.payload.plant.name)throw new ConfigurationError('Los datos de origen no corresponden a la configuración.');
  if(value.integrity?.algorithm!=='SHA-256'||!(/^[a-f0-9]{64}$/.test(value.integrity.digest)))throw new ConfigurationError('Falta una comprobación de integridad válida.');
  const {integrity,...unsigned}=value;
  if(await configurationDigest(unsigned)!==integrity.digest)throw new ConfigurationError('El archivo cambió o está dañado. Su comprobación de integridad no coincide.');
  if(new TextEncoder().encode(JSON.stringify(value)).length>10*1024*1024)throw new ConfigurationError('El paquete supera el máximo de 10 MB.');
  return value;
}
