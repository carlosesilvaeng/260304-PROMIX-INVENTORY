import {CONFIG_TABLES,CONFIG_TABLE_LABELS,type ConfigurationPackage} from './configurationPackages';
const labels:Record<string,string>={
 id:'Identificador',plant_id:'Planta (referencia)',is_active:'Activo',active:'Activo',sort_order:'Orden',
 created_at:'Creado',updated_at:'Actualizado',code:'Código',name_es:'Nombre en español',name_en:'Nombre en inglés',
 nombre:'Nombre',clase:'Clase',category_id:'Categoría (referencia)',base_unit_id:'Unidad base (referencia)',
 factor_to_base:'Factor a unidad base',decimal_precision:'Decimales',measurement_system:'Sistema de medida',symbol:'Símbolo',
 aggregate_name:'Agregado',material_type:'Material',location_area:'Procedencia / área',measurement_method:'Método de medición',
 unit:'Unidad',uom:'Unidad',reading_uom:'Unidad de lectura',box_width_ft:'Ancho del cajón',box_height_ft:'Alto del cajón',
 silo_name:'Silo',cajon_name:'Cajón',material:'Material',procedencia:'Procedencia',additive_name:'Aditivo',product_name:'Producto',
 additive_type:'Tipo de aditivo',brand:'Marca',marca:'Marca',tank_name:'Tanque / envase',requires_photo:'Foto obligatoria',
 calculation_method:'Método de cálculo',geometry_model:'Modelo geométrico',capacity_fraction:'Fracción de capacidad',
 diameter_in:'Diámetro (pulgadas)',total_height_in:'Altura total (pulgadas)',cone_height_in:'Altura del cono (pulgadas)',
 bottom_diameter_in:'Diámetro inferior (pulgadas)',cylinder_height_mode:'Modo de altura',slope_divisor_mode:'Modo del divisor',
 reading_reference:'Referencia de lectura',material_id:'Material (referencia)',material_conversion_factor_id:'Factor de conversión (referencia)',
 calibration_curve_id:'Curva (referencia)',calibration_curve_name:'Nombre de curva',curve_name:'Curva',
 conversion_table:'Tabla de conversión completa',calibration_table:'Tabla de calibración completa',data_points:'Datos completos de la curva',
 point_key:'Nivel',point_value:'Valor',available_gallons:'Galones disponibles',consumed_gallons:'Galones consumidos',percentage:'Porcentaje',status:'Estado',
 curve_id:'Curva (referencia)',silo_config_id:'Silo (referencia)',equipment_id:'Equipo (referencia)',section_code:'Sección',
 capture_unit_id:'Unidad de captura (referencia)',calculation_unit_id:'Unidad de cálculo (referencia)',display_unit_id:'Unidad de pantalla (referencia)',inventory_unit_id:'Unidad de inventario (referencia)',
 input_unit_id:'Unidad de entrada (referencia)',output_unit_id:'Unidad de salida (referencia)',from_unit_id:'Unidad de origen (referencia)',to_unit_id:'Unidad de destino (referencia)',
 factor:'Factor',factor_source:'Fuente del factor',effective_from:'Vigente desde',effective_to:'Vigente hasta',
 monthly_amount:'Monto mensual',initial_amount:'Monto inicial',initial_inventory_gallons:'Inventario inicial (gal)',tank_capacity_gallons:'Capacidad (gal)',
 meter_name:'Medidor',meter_type:'Tipo de medidor',meter_number:'Número de medidor',provider:'Proveedor',
 category:'Categoría',measure_mode:'Modo de medición',unit_volume:'Volumen por envase',tank_capacity:'Capacidad del tanque',notes:'Notas',
 catalog_additive_id:'Aditivo de catálogo (referencia)',dimension_unit_id:'Unidad de dimensiones (referencia)',capacity_unit_id:'Unidad de capacidad (referencia)',
 diameter:'Diámetro',length:'Largo',width:'Ancho',total_height:'Altura total',capacity:'Capacidad',method:'Método',inventory_type_id:'Tipo de inventario (referencia)',
};
function decimalSignature(value:string):string {
  const match=/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(value);
  if(!match)return value;
  let digits=(match[2]+(match[3]||'')).replace(/^0+/,'');if(!digits)return '0';
  let exponent=Number(match[4]||0)-(match[3]||'').length;
  while(digits.endsWith('0')){digits=digits.slice(0,-1);exponent++;}
  return (match[1]==='-'?'-':'')+digits+'e'+exponent;
}
export function configurationFieldLabel(field:string){return labels[field]||field.replace(/_/g,' ');}
function sheetName(label:string,names:Set<string>){const base=label.replace(/[\\/?*:\[\]\x00-\x1f]/g,' ').replace(/^'+|'+$/g,'').trim();let name=base.slice(0,31),i=1;while(names.has(name.toLowerCase())){const suffix=` (${++i})`;name=base.slice(0,31-suffix.length)+suffix;}names.add(name.toLowerCase());return name;}
export async function createConfigurationWorkbook(files:ConfigurationPackage[]){
  const ExcelJS=await import('exceljs');const Workbook=ExcelJS.Workbook||ExcelJS.default?.Workbook;const workbook=new Workbook();workbook.creator='PROMIX';workbook.created=new Date();const names=new Set<string>();const exactRows:any[][]=[],extendedRows:any[][]=[];
  const add=(title:string,headers:string[],rows:any[][])=>{
    const sheet=workbook.addWorksheet(sheetName(title,names),{views:[{state:'frozen',ySplit:3,showGridLines:false}]});
    sheet.mergeCells(1,1,1,Math.max(headers.length,1));sheet.getCell('A1').value=title;sheet.getCell('A1').font={bold:true,size:14,color:{argb:'FFFFFFFF'}};sheet.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2475C7'}};sheet.getRow(1).height=26;
    const head=sheet.getRow(3);head.values=headers;head.font={bold:true};head.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFDCEBFA'}};head.alignment={wrapText:true,vertical:'middle'};head.height=44;
    sheet.columns=headers.map(header=>({width:Math.min(42,Math.max(20,header.length+2))}));
    for(const values of rows){const row=sheet.addRow(values.map(value=>value&&typeof value==='object'&&!(value instanceof Date)?JSON.stringify(value):value??null));row.alignment={vertical:'top',wrapText:true};row.height=42;row.eachCell(cell=>{if(typeof cell.value==='number')cell.numFmt=cell.value!==0&&Math.abs(cell.value)<1e-12?'0.############E+00':'#,##0.00############';else if(cell.value instanceof Date)cell.numFmt='yyyy-mm-dd hh:mm:ss';});}
    if(rows.length)sheet.autoFilter={from:{row:3,column:1},to:{row:3+rows.length,column:headers.length}};
    return sheet;
  };
  const summary=add('Resumen',['Planta','Código','Exportado (UTC)','Formato','Integridad','Activos','Inactivos'],files.map(file=>{
    const configs=CONFIG_TABLES.filter(table=>table.startsWith('plant_')).flatMap(table=>file.payload.tables[table]);
    return [file.origin.plant_name,file.payload.plant.code,new Date(file.generated_at),file.version,file.integrity.digest,configs.filter(row=>row.is_active!==false).length,configs.filter(row=>row.is_active===false).length];
  }));
  for(const column of [4,6,7])summary.getColumn(column).numFmt='0';
  summary.getColumn(5).width=68;
  const parameters=add('Parámetros de planta',['Planta','Parámetro','Valor'],files.flatMap(file=>[
    [file.origin.plant_name,'Método cono habilitado',file.payload.plant.has_cone_measurement],
    [file.origin.plant_name,'Método cajón habilitado',file.payload.plant.has_cajon_measurement],
    [file.origin.plant_name,'Caja chica establecida',file.payload.plant.petty_cash_established],
    [file.origin.plant_name,'Origen',file.origin.environment],
    [file.origin.plant_name,'Restauración','Usar el JSON versionado. Este Excel documenta parámetros; no sustituye un respaldo de base, usuarios y fotografías.'],
  ]));
  parameters.getColumn(3).width=80;
  for(const table of CONFIG_TABLES){
    const columns=[...new Set(files.flatMap(file=>file.payload.schema[table]))];
    add(CONFIG_TABLE_LABELS[table],['Planta de origen',...columns.map(configurationFieldLabel)],files.flatMap(file=>file.payload.tables[table].map(row=>[file.origin.plant_name,...columns.map(column=>{
      const value=row[column];
      if(value!==null&&value!==undefined&&file.payload.numeric_fields[table].includes(column)){
        const numeric=Number(value);
        if(!Number.isFinite(numeric)||decimalSignature(String(value)).split('e')[0].replace('-','').length>15||decimalSignature(String(value))!==decimalSignature(String(numeric)))exactRows.push([file.origin.plant_name,CONFIG_TABLE_LABELS[table],row.id,configurationFieldLabel(column),String(value)]);
        return Number.isFinite(numeric)?numeric:'Ver valores exactos';
      }
      const text=value&&typeof value==='object'?JSON.stringify(value):typeof value==='string'?value:null;
      if(text&&text.length>30000){for(let offset=0;offset<text.length;offset+=30000)extendedRows.push([file.origin.plant_name,CONFIG_TABLE_LABELS[table],row.id,configurationFieldLabel(column),offset/30000+1,text.slice(offset,offset+30000)]);return 'Ver datos extendidos';}
      return value&&['created_at','updated_at','effective_from','effective_to'].includes(column)?new Date(value):value;
    })])));
  }
  if(exactRows.length){add('Valores exactos',['Planta','Sección','Registro','Parámetro','Valor decimal exacto'],exactRows);workbook.getWorksheet('Resumen').getCell('A2').value='Algunos decimales exceden la precisión de Excel. Consulte Valores exactos; el JSON conserva todos los decimales originales.';}
  if(extendedRows.length)add('Datos extendidos',['Planta','Sección','Registro','Parámetro','Parte','Contenido completo'],extendedRows);
  return workbook;
}
