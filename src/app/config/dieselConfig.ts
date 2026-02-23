// Configuración de tanques de diesel para cada planta
// Define tablas de calibración (lectura en pulgadas → galones)

export interface DieselCalibrationTable {
  // Conversion from reading (inches) to volume (gallons)
  // Key: reading in inches (as string), Value: gallons
  [reading: string]: number;
}

export interface DieselTankConfig {
  plantId: string;
  plantName: string;
  tank_capacity_gallons: number; // Capacidad total del tanque
  reading_uom: string; // Unidad de lectura (typically "inches")
  calibration_table: DieselCalibrationTable;
  initial_inventory_gallons?: number; // Inventario inicial para el primer mes (opcional)
}

// ============================================================================
// TABLAS DE CALIBRACIÓN POR TAMAÑO DE TANQUE
// ============================================================================

// Tanque estándar de 5000 galones
const DIESEL_5000_GAL_TANK: DieselCalibrationTable = {
  '0': 0,
  '6': 250,
  '12': 520,
  '18': 810,
  '24': 1120,
  '30': 1450,
  '36': 1800,
  '42': 2170,
  '48': 2560,
  '54': 2970,
  '60': 3400,
  '66': 3850,
  '72': 4320,
  '78': 4810,
  '84': 5000,
};

// Tanque estándar de 8000 galones
const DIESEL_8000_GAL_TANK: DieselCalibrationTable = {
  '0': 0,
  '8': 400,
  '16': 832,
  '24': 1296,
  '32': 1792,
  '40': 2320,
  '48': 2880,
  '56': 3472,
  '64': 4096,
  '72': 4752,
  '80': 5440,
  '88': 6160,
  '96': 6912,
  '104': 7696,
  '112': 8000,
};

// Tanque estándar de 10000 galones
const DIESEL_10000_GAL_TANK: DieselCalibrationTable = {
  '0': 0,
  '10': 500,
  '20': 1040,
  '30': 1620,
  '40': 2240,
  '50': 2900,
  '60': 3600,
  '70': 4340,
  '80': 5120,
  '90': 5940,
  '100': 6800,
  '110': 7700,
  '120': 8640,
  '130': 9620,
  '140': 10000,
};

// Tanque pequeño de 3000 galones
const DIESEL_3000_GAL_TANK: DieselCalibrationTable = {
  '0': 0,
  '6': 150,
  '12': 312,
  '18': 486,
  '24': 672,
  '30': 870,
  '36': 1080,
  '42': 1302,
  '48': 1536,
  '54': 1782,
  '60': 2040,
  '66': 2310,
  '72': 2592,
  '78': 2886,
  '84': 3000,
};

// ============================================================================
// CONFIGURACIONES POR PLANTA
// ============================================================================

export const DIESEL_CONFIG: DieselTankConfig[] = [
  {
    plantId: 'CAROLINA',
    plantName: 'CAROLINA',
    tank_capacity_gallons: 8000,
    reading_uom: 'inches',
    calibration_table: DIESEL_8000_GAL_TANK,
    initial_inventory_gallons: 5000, // Valor inicial sugerido para primer mes
  },
  {
    plantId: 'CEIBA',
    plantName: 'CEIBA',
    tank_capacity_gallons: 5000,
    reading_uom: 'inches',
    calibration_table: DIESEL_5000_GAL_TANK,
    initial_inventory_gallons: 3000,
  },
  {
    plantId: 'GUAYNABO',
    plantName: 'GUAYNABO',
    tank_capacity_gallons: 10000,
    reading_uom: 'inches',
    calibration_table: DIESEL_10000_GAL_TANK,
    initial_inventory_gallons: 6000,
  },
  {
    plantId: 'GURABO',
    plantName: 'GURABO',
    tank_capacity_gallons: 5000,
    reading_uom: 'inches',
    calibration_table: DIESEL_5000_GAL_TANK,
    initial_inventory_gallons: 3500,
  },
  {
    plantId: 'VEGA_BAJA',
    plantName: 'VEGA BAJA',
    tank_capacity_gallons: 8000,
    reading_uom: 'inches',
    calibration_table: DIESEL_8000_GAL_TANK,
    initial_inventory_gallons: 5500,
  },
  {
    plantId: 'HUMACAO',
    plantName: 'HUMACAO',
    tank_capacity_gallons: 3000,
    reading_uom: 'inches',
    calibration_table: DIESEL_3000_GAL_TANK,
    initial_inventory_gallons: 2000,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Obtiene la configuración de diesel para una planta específica
 */
export function getDieselConfig(plantId: string): DieselTankConfig | undefined {
  return DIESEL_CONFIG.find(config => config.plantId === plantId);
}

/**
 * Convierte una lectura a volumen usando la tabla de calibración
 * Usa interpolación lineal si el valor exacto no está en la tabla
 */
export function convertDieselReadingToGallons(
  reading: number,
  calibrationTable: DieselCalibrationTable
): number {
  // Si la lectura exacta existe en la tabla, retornarla
  const exactValue = calibrationTable[reading.toString()];
  if (exactValue !== undefined) {
    return exactValue;
  }

  // Convertir las claves a números y ordenar
  const readings = Object.keys(calibrationTable).map(Number).sort((a, b) => a - b);
  
  // Si la lectura es menor que el mínimo, retornar 0
  if (reading <= readings[0]) {
    return calibrationTable[readings[0].toString()];
  }
  
  // Si la lectura es mayor que el máximo, retornar el máximo
  if (reading >= readings[readings.length - 1]) {
    return calibrationTable[readings[readings.length - 1].toString()];
  }

  // Encontrar los dos puntos más cercanos para interpolar
  let lowerReading = readings[0];
  let upperReading = readings[1];
  
  for (let i = 0; i < readings.length - 1; i++) {
    if (reading >= readings[i] && reading <= readings[i + 1]) {
      lowerReading = readings[i];
      upperReading = readings[i + 1];
      break;
    }
  }

  // Interpolación lineal
  const lowerGallons = calibrationTable[lowerReading.toString()];
  const upperGallons = calibrationTable[upperReading.toString()];
  
  const ratio = (reading - lowerReading) / (upperReading - lowerReading);
  const interpolatedGallons = lowerGallons + ratio * (upperGallons - lowerGallons);
  
  return Math.round(interpolatedGallons * 100) / 100; // Redondear a 2 decimales
}

/**
 * Calcula el consumo de diesel
 * Consumo = Inventario Inicial + Compras - Inventario Final
 */
export function calculateDieselConsumption(
  beginningInventory: number,
  purchases: number,
  endingInventory: number
): number {
  const consumption = beginningInventory + purchases - endingInventory;
  return Math.round(consumption * 100) / 100;
}
