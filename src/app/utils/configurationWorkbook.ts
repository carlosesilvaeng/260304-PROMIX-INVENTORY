import {CONFIG_TABLES,validateConfigurationPackage,type ConfigurationPackage} from './configurationPackages';
import {EXCEL_FORMAT,EXCEL_VERSION,METADATA_SHEET,OPTIONS_SHEET,EXTRA_INPUT_ROWS,PLANT_FIELDS,
  tableColumns,tableSheetName,plantExcelLabel,fieldKind,readOnlyField,hiddenField,projectedCell,
  referenceChoices,fieldOptions,excelNumber,encodeExcelBaseline,escapeExcelText} from './configurationExcelFormat';
const labels:Record<string,string>={
 id:'Identificador',plant_id:'Planta (referencia)',is_active:'Activo',active:'Activo',sort_order:'Orden',
 created_at:'Creado',updated_at:'Actualizado',code:'Código',name_es:'Nombre en español',name_en:'Nombre en inglés',
 nombre:'Nombre',clase:'Clase',category_id:'Categoría (referencia)',base_unit_id:'Unidad base (referencia)',
 factor_to_base:'Factor a unidad base',decimal_precision:'Decimales',measurement_system:'Sistema de medida',symbol:'Símbolo',
 aggregate_name:'Agregado',material_type:'Material',location_area:'Procedencia / área',measurement_method:'Método de medición',
 unit:'Unidad',uom:'Unidad del producto',reading_uom:'Unidad de lectura',box_width_ft:'Ancho del cajón',box_height_ft:'Alto del cajón',
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
export function configurationFieldLabel(field:string){return labels[field]||field.replace(/_/g,' ');}
export async function createConfigurationWorkbook(files:ConfigurationPackage[]){
  if(!files.length)throw Error('Selecciona al menos una planta.');
  if(files.length>100)throw Error('Exporta hasta 100 plantas por archivo.');
  for(const file of files)await validateConfigurationPackage(file);
  if(new Set(files.map(file=>file.origin.plant_id)).size!==files.length||new Set(files.map(plantExcelLabel)).size!==files.length)throw Error('Las plantas de origen deben tener identificadores y códigos distintos.');
  const ExcelJS=await import('exceljs');const Workbook=ExcelJS.Workbook||ExcelJS.default?.Workbook;const workbook=new Workbook();workbook.creator='PROMIX';workbook.created=new Date();
  const options=workbook.addWorksheet(OPTIONS_SHEET,{state:'veryHidden'});
  let optionColumn=0;
  const list=(values:string[])=>{
    const unique=[...new Set(values)].filter(Boolean);if(!unique.length)return undefined;
    const col=options.getColumn(++optionColumn);unique.forEach((value,index)=>options.getCell(index+1,col.number).value=escapeExcelText(value));
    return `'${OPTIONS_SHEET}'!$${col.letter}$1:$${col.letter}$${unique.length}`;
  };
  const plantList=list(files.map(plantExcelLabel));
  const validation=(formula:string,strict=true)=>({type:'list' as const,allowBlank:true,formulae:[formula],showErrorMessage:strict,errorTitle:'Valor no permitido',error:'Selecciona un valor de la lista.',showInputMessage:true,promptTitle:'Configuración',prompt:strict?'Selecciona un valor de la lista.':'Selecciona una referencia o escribe el nombre/código de una fila nueva.'});
  const add=(title:string,headers:string[],rows:any[][])=>{
    const sheet=workbook.addWorksheet(title,{views:[{state:'frozen',ySplit:3,showGridLines:false}]});
    sheet.mergeCells(1,1,1,Math.max(headers.length,1));sheet.getCell('A1').value=title;sheet.getCell('A1').font={bold:true,size:14,color:{argb:'FFFFFFFF'}};sheet.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2475C7'}};sheet.getRow(1).height=26;
    const head=sheet.getRow(3);head.values=headers;head.font={bold:true};head.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFDCEBFA'}};head.alignment={wrapText:true,vertical:'middle'};head.height=44;
    sheet.columns=headers.map(header=>({width:Math.min(42,Math.max(20,header.length+2))}));
    for(const values of rows){const row=sheet.addRow(values.map(value=>typeof value==='string'?escapeExcelText(value):value??null));row.alignment={vertical:'top',wrapText:true};row.height=42;row.eachCell(cell=>{if(typeof cell.value==='number')cell.numFmt=cell.value!==0&&Math.abs(cell.value)<1e-12?'0.############E+00':'#,##0.00############';else if(cell.value instanceof Date)cell.numFmt='yyyy-mm-dd hh:mm:ss';else if(typeof cell.value==='string')cell.numFmt='@';});}
    if(rows.length)sheet.autoFilter={from:{row:3,column:1},to:{row:3+rows.length,column:headers.length}};
    return sheet;
  };
  const summary=add('Resumen',['Planta','Código','Exportado (UTC)','Formato','Integridad','Activos','Inactivos'],files.map(file=>{
    const configs=CONFIG_TABLES.filter(table=>table.startsWith('plant_')).flatMap(table=>file.payload.tables[table]);
    return [file.origin.plant_name,file.payload.plant.code,new Date(file.generated_at),file.version,file.integrity.digest,configs.filter(row=>row.is_active!==false).length,configs.filter(row=>row.is_active===false).length];
  }));
  for(const column of [4,6,7])summary.getColumn(column).numFmt='0';
  summary.getColumn(5).width=68;
  summary.getCell('A2').value='Excel editable v1. Consulta Instrucciones antes de modificar o agregar filas.';
  const instructions=add('Instrucciones',['Acción','Cómo hacerlo'],[
    ['Editar','Las celdas azules son editables. Las grises y columnas ocultas están protegidas. No cambies encabezados ni nombres de hojas.'],
    ['Agregar equipos','Usa las 100 filas vacías preparadas al final de cada hoja. Selecciona Planta de origen y completa los parámetros. No copies identificadores ocultos.'],
    ['Referencias','Selecciona una referencia de la lista. Para una dependencia nueva, escribe su nombre o código único. Una referencia ambigua o inexistente bloquea la carga.'],
    ['Retirar equipos','Cambia Activo a No. Borrar filas no elimina equipos del destino; por defecto se conservan.'],
    ['Decimales','Los valores que exceden la precisión de Excel se guardan como texto exacto. Conserva ese formato y usa punto decimal, sin separadores de miles.'],
    ['Datos protegidos','Curvas, sus puntos y datos estructurados se editan desde las pantallas existentes del sistema. Los catálogos compartidos incompatibles no se sobrescriben.'],
    ['Cargar','Guarda como .xlsx, carga el archivo, selecciona origen si hay varias plantas y selecciona destino. Revisa las diferencias antes de aplicar.'],
    ['Fórmulas','Escribe valores directos. No se admiten fórmulas en campos importables.'],
    ['Respaldo','El archivo no incluye usuarios, inventarios históricos ni fotografías y no sustituye un respaldo completo.'],
  ]);
  instructions.getColumn(2).width=100;instructions.eachRow((row,index)=>{if(index>=4)row.height=60;});
  const parameters=add('Parámetros de planta',['Planta','Parámetro','Valor','Origen interno','Campo interno'],files.flatMap(file=>
    Object.entries(PLANT_FIELDS).map(([field,label])=>[plantExcelLabel(file),label,file.payload.plant[field]==null?null:field==='petty_cash_established'?excelNumber(file.payload.plant[field]):file.payload.plant[field]?'Sí':'No',file.origin.plant_id,field])
  ));
  parameters.getColumn(3).width=32;parameters.getColumn(4).hidden=true;parameters.getColumn(5).hidden=true;
  for(let row=4;row<=parameters.rowCount;row++){
    const cell=parameters.getCell(row,3);cell.protection={locked:false};cell.font={color:{argb:'FF2475C7'}};
    if(parameters.getCell(row,5).value!=='petty_cash_established')cell.dataValidation=validation('"Sí,No"');
  }
  const orderedTables=[...CONFIG_TABLES.filter(table=>table.startsWith('plant_')),...CONFIG_TABLES.filter(table=>!table.startsWith('plant_'))];
  for(const table of orderedTables){
    if(files.reduce((count,file)=>count+file.payload.tables[table].length,0)+EXTRA_INPUT_ROWS>50000)throw Error('El Excel contiene demasiadas filas. Exporta menos plantas por archivo.');
    const columns=tableColumns(files,table);
    const sheet=add(tableSheetName(table),['Planta de origen',...columns.map(configurationFieldLabel),'Origen interno'],files.flatMap(file=>file.payload.tables[table].map(row=>[
      plantExcelLabel(file),...columns.map(column=>projectedCell(file,table,column,row[column])),file.origin.plant_id,
    ])));
    const dataEnd=sheet.rowCount,inputEnd=dataEnd+EXTRA_INPUT_ROWS;
    sheet.getColumn(columns.length+2).hidden=true;
    for(const [index,field] of columns.entries()){
      sheet.getColumn(index+2).hidden=hiddenField(files,table,field);
      const enumOptions=fieldOptions(table,field);
      const choices=list([...files.flatMap(file=>referenceChoices(file,field).map(choice=>choice.label)),...(enumOptions||[]),
        ...(field==='calibration_curve_name'?files.flatMap(file=>file.payload.tables.calibration_curves.map(row=>row.curve_name)):[])]);
      for(let row=4;row<=inputEnd;row++){
        const origin=files.find(file=>file.origin.plant_id===sheet.getCell(row,columns.length+2).value);
        const readonly=origin?readOnlyField(origin,table,field):files.some(file=>readOnlyField(file,table,field));
        const cell=sheet.getCell(row,index+2);cell.protection={locked:readonly};
        if(files.some(file=>fieldKind(file,table,field)==='integer'))cell.numFmt='0';
        cell.font={color:{argb:readonly?'FF64748B':'FF2475C7'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:readonly?'FFF1F5F9':'FFF7FBFF'}};
        if(!readonly){
          if(files.some(file=>fieldKind(file,table,field)==='boolean'))cell.dataValidation=validation('"Sí,No"');
          else if(choices)cell.dataValidation=validation(choices,!!enumOptions);
        }
      }
    }
    for(let row=dataEnd+1;row<=inputEnd;row++){
      const cell=sheet.getCell(row,1);cell.protection={locked:false};cell.font={color:{argb:'FF2475C7'}};cell.dataValidation=validation(plantList!);
    }
    sheet.getCell('A2').value='Celdas azules: editables. Para agregar, usa las filas vacías y selecciona la planta. Activo = No para desactivar.';
    await sheet.protect('PROMIX',{spinCount:100,selectLockedCells:true,selectUnlockedCells:true,autoFilter:true,sort:true});
  }
  await parameters.protect('PROMIX',{spinCount:100,selectLockedCells:true,selectUnlockedCells:true});
  const metadata=workbook.addWorksheet(METADATA_SHEET,{state:'veryHidden'});
  metadata.getCell('A1').value=EXCEL_FORMAT;metadata.getCell('B1').value=EXCEL_VERSION;
  // Base64 prevents XML/Excel escape decoding from changing the original JSON
  // (including Unicode, carriage returns and literal _xNNNN_ text).
  const serialized=encodeExcelBaseline(files);
  if(serialized.length>30_000_000)throw Error('Las configuraciones son demasiado grandes. Exporta menos plantas por archivo.');
  for(let offset=0;offset<serialized.length;offset+=30000)metadata.addRow([offset/30000+1,serialized.slice(offset,offset+30000)]);
  await metadata.protect('PROMIX',{spinCount:100});await options.protect('PROMIX',{spinCount:100});
  // Move the options worksheet out of the user's initial view.
  workbook.views=[{x:0,y:0,width:1200,height:800,firstSheet:1,activeTab:1,visibility:'visible'}];
  return workbook;
}
