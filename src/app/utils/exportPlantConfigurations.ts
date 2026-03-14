import * as XLSX from 'xlsx';
import type { Plant } from '../contexts/AuthContext';
import { getPlantConfig, type PlantConfigPackage } from './api';

type CellValue = string | number | boolean | null | undefined;

interface SectionDefinition {
  title: string;
  headers: string[];
  rows: CellValue[][];
}

function getAggregateInventoryBehavior(method: string | null | undefined) {
  return String(method || '').toUpperCase() === 'CONE'
    ? 'En inventario captura 6 medidas M y 2 diametros D; el sistema calcula volumen.'
    : 'En inventario captura largo variable; ancho y alto quedan fijos desde configuracion.';
}

function getSiloInventoryBehavior(entry: any) {
  const allowedProducts = Array.isArray(entry?.allowed_products) && entry.allowed_products.length > 0
    ? `Producto permitido: ${entry.allowed_products.join(', ')}.`
    : 'Producto definido segun el silo/configuracion.';

  return `En inventario captura lectura del silo y el sistema calcula resultado. ${allowedProducts}`;
}

function getAdditiveInventoryBehavior(entry: any) {
  const additiveType = String(entry?.additive_type || '').toUpperCase();
  if (additiveType === 'TANK') {
    return 'En inventario captura lectura del tanque; usa curva/tabla de conversion para calcular cantidad.';
  }
  return 'En inventario captura cantidad manual directamente.';
}

function getDieselInventoryBehavior() {
  return 'En inventario captura lectura del tanque, compras y calcula inventario final/consumo.';
}

function getProductInventoryBehavior(entry: any) {
  const mode = String(entry?.measure_mode || '').toUpperCase();
  if (mode === 'TANK_READING') {
    return 'En inventario captura lectura del tanque y calcula cantidad con tabla de calibracion.';
  }
  if (mode === 'DRUM') {
    return 'En inventario captura numero de tambores y calcula volumen total por unidad.';
  }
  if (mode === 'PAIL') {
    return 'En inventario captura numero de pailas y calcula volumen total por unidad.';
  }
  return 'En inventario captura cantidad directamente.';
}

function getUtilitiesInventoryBehavior(entry: any) {
  return `En inventario captura lectura actual del medidor${entry?.requires_photo ? ' con fotografia obligatoria' : ''} y calcula consumo contra lectura previa.`;
}

function getPettyCashInventoryBehavior() {
  return 'En inventario captura recibos y efectivo para cuadrar el balance final de caja menor.';
}

function sanitizeSheetName(input: string, used: Set<string>) {
  const base = input.replace(/[\\/*?:[\]]/g, ' ').trim() || 'Planta';
  let candidate = base.slice(0, 31);
  let suffix = 1;

  while (used.has(candidate)) {
    const suffixLabel = `-${suffix}`;
    candidate = `${base.slice(0, Math.max(1, 31 - suffixLabel.length))}${suffixLabel}`;
    suffix += 1;
  }

  used.add(candidate);
  return candidate;
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return value;
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function appendSection(rows: CellValue[][], section: SectionDefinition) {
  rows.push([section.title]);

  if (section.rows.length === 0) {
    rows.push(['Sin configuración activa']);
    rows.push([]);
    return;
  }

  rows.push(section.headers);
  section.rows.forEach((row) => rows.push(row.map(stringifyValue)));
  rows.push([]);
}

function buildGeneralInfoSection(plant: Plant): SectionDefinition {
  return {
    title: 'Datos generales',
    headers: ['Campo', 'Valor'],
    rows: [
      ['Nombre', plant.name],
      ['Código', plant.code],
      ['Ubicación', plant.location || '-'],
      ['Estado planta', plant.isActive ? 'Activa' : 'Inactiva'],
      ['Método cono habilitado', plant.methods?.hasConeMeasurement ? 'Sí' : 'No'],
      ['Método cajón habilitado', plant.methods?.hasCajonMeasurement ? 'Sí' : 'No'],
      ['Petty cash establecido', plant.pettyCashEstablished ?? 0],
    ],
  };
}

function buildAggregatesSection(config: PlantConfigPackage): SectionDefinition {
  const source = (config.aggregates?.length || 0) > 0 ? config.aggregates : config.cajones;

  if ((config.aggregates?.length || 0) > 0) {
    return {
      title: 'Agregados',
      headers: ['Nombre', 'Material', 'Procedencia/Área', 'Método', 'Unidad', 'Ancho', 'Alto', 'Cómo se usa en inventario'],
      rows: (source || []).map((entry: any) => [
        entry.aggregate_name,
        entry.material_type,
        entry.location_area,
        entry.measurement_method,
        entry.unit,
        entry.box_width_ft,
        entry.box_height_ft,
        getAggregateInventoryBehavior(entry.measurement_method),
      ]),
    };
  }

  return {
    title: 'Agregados',
    headers: ['Nombre', 'Material', 'Procedencia', 'Ancho', 'Alto', 'Cómo se usa en inventario'],
    rows: (source || []).map((entry: any) => [
      entry.name,
      entry.material,
      entry.procedencia,
      entry.ancho,
      entry.alto,
      getAggregateInventoryBehavior('BOX'),
    ]),
  };
}

function buildSilosSection(config: PlantConfigPackage): SectionDefinition {
  return {
    title: 'Silos',
    headers: ['Nombre', 'Método', 'Productos permitidos', 'Cómo se usa en inventario'],
    rows: (config.silos || []).map((entry: any) => [
      entry.silo_name || entry.name,
      entry.measurement_method,
      entry.allowed_products,
      getSiloInventoryBehavior(entry),
    ]),
  };
}

function buildAdditivesSection(config: PlantConfigPackage): SectionDefinition {
  return {
    title: 'Aditivos',
    headers: ['Nombre', 'Tipo', 'Marca', 'Unidad', 'Método', 'Tanque', 'Unidad lectura', 'Requiere foto', 'Curva/Tabla', 'Cómo se usa en inventario'],
    rows: (config.additives || []).map((entry: any) => [
      entry.additive_name || entry.product_name,
      entry.additive_type,
      entry.brand,
      entry.uom,
      entry.measurement_method,
      entry.tank_name,
      entry.reading_uom,
      entry.requires_photo,
      entry.calibration_curve_name || entry.conversion_table,
      getAdditiveInventoryBehavior(entry),
    ]),
  };
}

function buildDieselSection(config: PlantConfigPackage): SectionDefinition {
  const diesel = config.diesel;
  return {
    title: 'Diesel',
    headers: ['Método', 'Unidad lectura', 'Capacidad tanque', 'Inventario inicial', 'Curva', 'Tabla calibración', 'Cómo se usa en inventario'],
    rows: diesel ? [[
      diesel.measurement_method,
      diesel.reading_uom,
      diesel.tank_capacity_gallons,
      diesel.initial_inventory_gallons,
      diesel.calibration_curve_name,
      diesel.calibration_table,
      getDieselInventoryBehavior(),
    ]] : [],
  };
}

function buildProductsSection(config: PlantConfigPackage): SectionDefinition {
  return {
    title: 'Aceites y productos',
    headers: ['Nombre', 'Categoría', 'Modo medición', 'Unidad', 'Unidad lectura', 'Capacidad tanque', 'Volumen unidad', 'Requiere foto', 'Notas', 'Tabla calibración', 'Cómo se usa en inventario'],
    rows: (config.products || []).map((entry: any) => [
      entry.product_name,
      entry.category,
      entry.measure_mode,
      entry.uom || entry.unit,
      entry.reading_uom,
      entry.tank_capacity,
      entry.unit_volume,
      entry.requires_photo,
      entry.notes,
      entry.calibration_table,
      getProductInventoryBehavior(entry),
    ]),
  };
}

function buildUtilitiesSection(config: PlantConfigPackage): SectionDefinition {
  return {
    title: 'Utilidades',
    headers: ['Medidor', 'Número', 'Tipo', 'Unidad', 'Proveedor', 'Requiere foto', 'Cómo se usa en inventario'],
    rows: (config.utilities_meters || []).map((entry: any) => [
      entry.meter_name,
      entry.meter_number,
      entry.utility_type || entry.meter_type,
      entry.uom || entry.unit,
      entry.provider,
      entry.requires_photo,
      getUtilitiesInventoryBehavior(entry),
    ]),
  };
}

function buildPettyCashSection(config: PlantConfigPackage): SectionDefinition {
  const pettyCash = config.petty_cash;
  return {
    title: 'Petty cash',
    headers: ['Monto mensual', 'Monto inicial', 'Cómo se usa en inventario'],
    rows: pettyCash ? [[pettyCash.monthly_amount, pettyCash.initial_amount, getPettyCashInventoryBehavior()]] : [],
  };
}

function createSheetRows(plant: Plant, config: PlantConfigPackage) {
  const rows: CellValue[][] = [];
  appendSection(rows, buildGeneralInfoSection(plant));
  appendSection(rows, buildSilosSection(config));
  appendSection(rows, buildAggregatesSection(config));
  appendSection(rows, buildAdditivesSection(config));
  appendSection(rows, buildDieselSection(config));
  appendSection(rows, buildProductsSection(config));
  appendSection(rows, buildUtilitiesSection(config));
  appendSection(rows, buildPettyCashSection(config));
  return rows;
}

export async function exportPlantConfigurations(plants: Plant[]) {
  const sortedPlants = [...plants].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const configs = await Promise.all(
    sortedPlants.map(async (plant) => {
      const response = await getPlantConfig(plant.id);
      if (!response.success || !response.data) {
        throw new Error(`No se pudo cargar la configuración de ${plant.name}. ${response.error || ''}`.trim());
      }
      return { plant, config: response.data };
    })
  );

  const workbook = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();

  configs.forEach(({ plant, config }) => {
    const sheetRows = createSheetRows(plant, config);
    const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
    sheet['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 34 }, { wch: 48 }];
    XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(plant.name, usedSheetNames));
  });

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `PROMIX-Configuracion-Activa-V2-${date}.xlsx`);
}
