import type { Plant } from '../contexts/AuthContext';
import { getPlantConfig, type PlantConfigPackage } from './api';

type CellValue = string | number | boolean | null | undefined;

interface SectionDefinition {
  title: string;
  headers: string[];
  rows: CellValue[][];
}

const SECTION_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'DCEBFA' },
} as const;

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'EEF4FB' },
} as const;

const THIN_BORDER = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
} as const;

function getAggregateInventoryBehavior(method: string | null | undefined) {
  return String(method || '').toUpperCase() === 'CONE'
    ? 'Captura 6 medidas M y 2 diámetros D; el sistema calcula el volumen.'
    : 'Captura largo variable; ancho y alto quedan fijos desde configuración.';
}

function getSiloInventoryBehavior(entry: any) {
  const allowedProducts = Array.isArray(entry?.allowed_products) && entry.allowed_products.length > 0
    ? `Productos permitidos: ${entry.allowed_products.join(', ')}.`
    : 'Producto definido según silo/configuración.';

  return `Captura nivel del silo y usa curva de conversión para calcular volumen disponible. ${allowedProducts}`;
}

function getAdditiveInventoryBehavior(entry: any) {
  const additiveType = String(entry?.additive_type || '').toUpperCase();
  if (additiveType === 'TANK') {
    return 'Captura lectura del tanque; usa curva o tabla de conversión para calcular cantidad.';
  }
  return 'Captura cantidad manual directamente.';
}

function getDieselInventoryBehavior() {
  return 'Captura lectura del tanque, compras y calcula inventario final y consumo.';
}

function getProductInventoryBehavior(entry: any) {
  const mode = String(entry?.measure_mode || '').toUpperCase();
  if (mode === 'TANK_READING') {
    return 'Captura lectura del tanque y calcula cantidad con tabla de calibración.';
  }
  if (mode === 'DRUM') {
    return 'Captura número de tambores y calcula volumen total por unidad.';
  }
  if (mode === 'PAIL') {
    return 'Captura número de pailas y calcula volumen total por unidad.';
  }
  return 'Captura cantidad directamente.';
}

function getUtilitiesInventoryBehavior(entry: any) {
  return `Captura lectura actual${entry?.requires_photo ? ' con fotografía obligatoria' : ''} y calcula consumo contra lectura previa.`;
}

function getPettyCashInventoryBehavior() {
  return 'Captura recibos y efectivo para cuadrar el balance final de caja menor.';
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

function getCalibrationTablePointCount(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  return Object.keys(value as Record<string, number>).length;
}

function getCalibrationTableSummary(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '-';
  const entries = Object.entries(value as Record<string, number>)
    .map(([level, amount]) => ({ level: Number(level), amount: Number(amount) }))
    .filter((point) => Number.isFinite(point.level) && Number.isFinite(point.amount))
    .sort((left, right) => left.level - right.level);

  if (entries.length === 0) return '-';
  const first = entries[0];
  const last = entries[entries.length - 1];
  return `${entries.length} punto${entries.length === 1 ? '' : 's'} · ${first.level}→${last.level}`;
}

function findCurveForTable(config: PlantConfigPackage, table: unknown) {
  if (!table || typeof table !== 'object' || Array.isArray(table)) return null;
  const tableSignature = JSON.stringify(table);
  const curves = Object.values(config.calibration_curves || {});
  return curves.find((curve: any) => JSON.stringify(curve?.data_points || {}) === tableSignature) || null;
}

function buildTablePointRows(options: {
  owner: string;
  table: unknown;
  curve?: any;
}) {
  const curvePoints = Array.isArray(options.curve?.points) ? options.curve.points : [];
  if (curvePoints.length > 0) {
    return curvePoints
      .slice()
      .sort((left: any, right: any) => Number(left.point_key) - Number(right.point_key))
      .map((point: any) => [
        options.owner,
        point.point_key,
        point.available_gallons ?? point.point_value,
        point.consumed_gallons ?? '-',
        point.percentage ?? '-',
        point.status || '-',
      ]);
  }

  if (!options.table || typeof options.table !== 'object' || Array.isArray(options.table)) {
    return [];
  }

  return Object.entries(options.table as Record<string, number>)
    .map(([level, amount]) => ({ level: Number(level), amount }))
    .filter((point) => Number.isFinite(point.level))
    .sort((left, right) => left.level - right.level)
    .map((point) => [options.owner, point.level, point.amount, '-', '-', '-']);
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
    headers: ['Nombre', 'Método', 'Unidad lectura', 'Curva', 'Puntos', 'Productos permitidos', 'Cómo se usa en inventario'],
    rows: (config.silos || []).map((entry: any) => [
      entry.silo_name || entry.name,
      entry.measurement_method,
      entry.reading_uom,
      entry.calibration_curve_name || findCurveForTable(config, entry.conversion_table)?.curve_name || '-',
      getCalibrationTableSummary(entry.conversion_table),
      entry.allowed_products,
      getSiloInventoryBehavior(entry),
    ]),
  };
}

function buildAdditivesSection(config: PlantConfigPackage): SectionDefinition {
  return {
    title: 'Aditivos',
    headers: ['Nombre', 'Tipo', 'Marca', 'Unidad', 'Método', 'Tanque', 'Unidad lectura', 'Requiere foto', 'Curva', 'Puntos', 'Cómo se usa en inventario'],
    rows: (config.additives || []).map((entry: any) => [
      entry.additive_name || entry.product_name,
      entry.additive_type,
      entry.brand,
      entry.uom,
      entry.measurement_method,
      entry.tank_name,
      entry.reading_uom,
      entry.requires_photo,
      entry.calibration_curve_name || findCurveForTable(config, entry.conversion_table)?.curve_name || '-',
      getCalibrationTableSummary(entry.conversion_table),
      getAdditiveInventoryBehavior(entry),
    ]),
  };
}

function buildDieselSection(config: PlantConfigPackage): SectionDefinition {
  const diesel = config.diesel;
  return {
    title: 'Diesel',
    headers: ['Método', 'Unidad lectura', 'Capacidad tanque', 'Inventario inicial', 'Curva', 'Puntos', 'Cómo se usa en inventario'],
    rows: diesel ? [[
      diesel.measurement_method,
      diesel.reading_uom,
      diesel.tank_capacity_gallons,
      diesel.initial_inventory_gallons,
      diesel.calibration_curve_name || findCurveForTable(config, diesel.calibration_table)?.curve_name || '-',
      getCalibrationTableSummary(diesel.calibration_table),
      getDieselInventoryBehavior(),
    ]] : [],
  };
}

function buildProductsSection(config: PlantConfigPackage): SectionDefinition {
  return {
    title: 'Aceites y productos',
    headers: ['Nombre', 'Categoría', 'Modo medición', 'Unidad', 'Unidad lectura', 'Capacidad tanque', 'Volumen unidad', 'Requiere foto', 'Notas', 'Puntos calibración', 'Cómo se usa en inventario'],
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
      getCalibrationTableSummary(entry.calibration_table),
      getProductInventoryBehavior(entry),
    ]),
  };
}

function buildCalibrationCurvesSection(config: PlantConfigPackage): SectionDefinition {
  const curves = Object.values(config.calibration_curves || {})
    .filter((curve: any, index, all) => curve?.id && all.findIndex((item: any) => item?.id === curve.id) === index)
    .sort((left: any, right: any) => String(left.curve_name || '').localeCompare(String(right.curve_name || ''), 'es'));

  return {
    title: 'Curvas de conversión',
    headers: ['Curva', 'Método', 'Unidad lectura', 'Puntos', 'Rango nivel'],
    rows: curves.map((curve: any) => {
      const points = Array.isArray(curve.points) ? curve.points : [];
      const sortedLevels = points.map((point: any) => Number(point.point_key)).filter(Number.isFinite).sort((left, right) => left - right);
      const first = sortedLevels[0];
      const last = sortedLevels[sortedLevels.length - 1];
      return [
        curve.curve_name,
        curve.measurement_type,
        curve.reading_uom,
        points.length || getCalibrationTablePointCount(curve.data_points),
        first === undefined ? '-' : `${first} → ${last}`,
      ];
    }),
  };
}

function buildCalibrationCurvePointsSection(config: PlantConfigPackage): SectionDefinition {
  const curves = Object.values(config.calibration_curves || {})
    .filter((curve: any, index, all) => curve?.id && all.findIndex((item: any) => item?.id === curve.id) === index)
    .sort((left: any, right: any) => String(left.curve_name || '').localeCompare(String(right.curve_name || ''), 'es'));

  return {
    title: 'Puntos de curvas',
    headers: ['Curva', 'Nivel', 'Disponible', 'Consumido', 'Porcentaje', 'Status'],
    rows: curves.flatMap((curve: any) => buildTablePointRows({
      owner: curve.curve_name,
      table: curve.data_points,
      curve,
    })),
  };
}

function buildProductTankPointsSection(config: PlantConfigPackage): SectionDefinition {
  const tankProducts = (config.products || []).filter((entry: any) => String(entry?.measure_mode || '').toUpperCase() === 'TANK_READING');
  return {
    title: 'Puntos tanques de productos',
    headers: ['Producto', 'Nivel', 'Valor', 'Galones consumidos', 'Porcentaje', 'Status'],
    rows: tankProducts.flatMap((entry: any) => buildTablePointRows({
      owner: entry.product_name,
      table: entry.calibration_table,
    })),
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

function createSections(plant: Plant, config: PlantConfigPackage) {
  return [
    buildGeneralInfoSection(plant),
    buildSilosSection(config),
    buildAggregatesSection(config),
    buildAdditivesSection(config),
    buildDieselSection(config),
    buildProductsSection(config),
    buildCalibrationCurvesSection(config),
    buildCalibrationCurvePointsSection(config),
    buildProductTankPointsSection(config),
    buildUtilitiesSection(config),
    buildPettyCashSection(config),
  ];
}

function downloadBuffer(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob(
    [buffer],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportPlantConfigurations(plants: Plant[]) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PROMIX Plant Inventory';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

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

  const usedSheetNames = new Set<string>();

  configs.forEach(({ plant, config }) => {
    const worksheet = workbook.addWorksheet(sanitizeSheetName(plant.name, usedSheetNames), {
      views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }],
    });

    worksheet.properties.defaultRowHeight = 22;
    worksheet.columns = [
      { width: 24 },
      { width: 22 },
      { width: 22 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 24 },
      { width: 28 },
      { width: 48 },
    ];

    let currentRow = 1;

    createSections(plant, config).forEach((section) => {
      const titleRow = worksheet.getRow(currentRow);
      titleRow.getCell(1).value = section.title;
      titleRow.getCell(1).font = { bold: true, color: { argb: '1F2937' } };
      titleRow.getCell(1).fill = SECTION_FILL;
      titleRow.getCell(1).border = THIN_BORDER;
      worksheet.mergeCells(currentRow, 1, currentRow, section.headers.length);
      for (let column = 2; column <= section.headers.length; column += 1) {
        const cell = titleRow.getCell(column);
        cell.fill = SECTION_FILL;
        cell.border = THIN_BORDER;
      }
      currentRow += 1;

      if (section.rows.length === 0) {
        const emptyRow = worksheet.getRow(currentRow);
        emptyRow.getCell(1).value = 'Sin configuración activa';
        emptyRow.getCell(1).font = { italic: true, color: { argb: '6B7280' } };
        emptyRow.getCell(1).alignment = { vertical: 'middle' };
        emptyRow.getCell(1).border = THIN_BORDER;
        worksheet.mergeCells(currentRow, 1, currentRow, section.headers.length);
        for (let column = 2; column <= section.headers.length; column += 1) {
          emptyRow.getCell(column).border = THIN_BORDER;
        }
        currentRow += 2;
        return;
      }

      const headerRow = worksheet.getRow(currentRow);
      section.headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.font = { bold: true, color: { argb: '1F2937' } };
        cell.fill = HEADER_FILL;
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      });
      currentRow += 1;

      section.rows.forEach((rowValues) => {
        const row = worksheet.getRow(currentRow);
        rowValues.map(stringifyValue).forEach((value, index) => {
          const cell = row.getCell(index + 1);
          cell.value = value as ExcelJS.CellValue;
          cell.border = THIN_BORDER;
          cell.alignment = { vertical: 'top', wrapText: true };
        });
        currentRow += 1;
      });

      currentRow += 1;
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  downloadBuffer(buffer as ArrayBuffer, `PROMIX-Configuracion-Activa-Formato-${date}.xlsx`);
}
