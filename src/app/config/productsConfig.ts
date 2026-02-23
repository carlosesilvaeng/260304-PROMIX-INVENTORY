// Configuración de productos (aceites, lubricantes, consumibles) por planta
// Define el listado fijo de productos que cada planta debe inventariar

export type ProductMeasureMode = 
  | 'TANK_READING'  // Lectura de tanque con tabla de calibración
  | 'DRUM'          // Tambores/Barriles (55 gal típicamente)
  | 'PAIL'          // Pailas/Cubetas (5 gal típicamente)
  | 'COUNT';        // Conteo de unidades

export interface ProductCalibrationTable {
  // Conversion from reading to volume/quantity
  // Key: reading value (as string), Value: calculated quantity
  [reading: string]: number;
}

export interface ProductConfig {
  id: string;
  product_name: string;
  category: string; // 'OIL', 'LUBRICANT', 'CONSUMABLE', 'EQUIPMENT', 'OTHER'
  measure_mode: ProductMeasureMode;
  uom: string; // Unit of measure: 'gallons', 'drums', 'pails', 'units', 'liters', etc.
  requires_photo: boolean;
  
  // For TANK_READING mode
  reading_uom?: string; // Unit for reading (e.g., 'inches', 'cm')
  calibration_table?: ProductCalibrationTable;
  tank_capacity?: number; // Optional: tank capacity in uom
  
  // For DRUM/PAIL mode
  unit_volume?: number; // Volume per unit (e.g., 55 gal per drum)
  
  // Common
  notes?: string; // Additional info or instructions
}

export interface PlantProductsConfig {
  plantId: string;
  plantName: string;
  products: ProductConfig[];
}

// ============================================================================
// CALIBRATION TABLES
// ============================================================================

// Tanque de aceite hidráulico de 500 galones
const HYDRAULIC_OIL_500_GAL_TANK: ProductCalibrationTable = {
  '0': 0,
  '6': 25,
  '12': 52,
  '18': 81,
  '24': 112,
  '30': 145,
  '36': 180,
  '42': 217,
  '48': 256,
  '54': 297,
  '60': 340,
  '66': 385,
  '72': 432,
  '78': 481,
  '84': 500,
};

// Tanque de aceite de motor de 300 galones
const MOTOR_OIL_300_GAL_TANK: ProductCalibrationTable = {
  '0': 0,
  '6': 15,
  '12': 31,
  '18': 49,
  '24': 67,
  '30': 87,
  '36': 108,
  '42': 130,
  '48': 154,
  '54': 178,
  '60': 204,
  '66': 231,
  '72': 259,
  '78': 289,
  '84': 300,
};

// ============================================================================
// PRODUCTOS COMUNES POR CATEGORÍA
// ============================================================================

// Aceites
const COMMON_OILS: ProductConfig[] = [
  {
    id: 'oil_hydraulic',
    product_name: 'Aceite Hidráulico',
    category: 'OIL',
    measure_mode: 'DRUM',
    uom: 'drums',
    unit_volume: 55, // 55 gallons per drum
    requires_photo: true,
    notes: 'Tambores de 55 galones',
  },
  {
    id: 'oil_motor_15w40',
    product_name: 'Aceite de Motor 15W-40',
    category: 'OIL',
    measure_mode: 'PAIL',
    uom: 'pails',
    unit_volume: 5, // 5 gallons per pail
    requires_photo: true,
    notes: 'Pailas de 5 galones',
  },
  {
    id: 'oil_motor_10w30',
    product_name: 'Aceite de Motor 10W-30',
    category: 'OIL',
    measure_mode: 'PAIL',
    uom: 'pails',
    unit_volume: 5,
    requires_photo: true,
    notes: 'Pailas de 5 galones',
  },
  {
    id: 'oil_transmission',
    product_name: 'Aceite de Transmisión ATF',
    category: 'OIL',
    measure_mode: 'PAIL',
    uom: 'pails',
    unit_volume: 5,
    requires_photo: true,
    notes: 'Pailas de 5 galones',
  },
];

// Lubricantes
const COMMON_LUBRICANTS: ProductConfig[] = [
  {
    id: 'grease_multipurpose',
    product_name: 'Grasa Multiuso',
    category: 'LUBRICANT',
    measure_mode: 'COUNT',
    uom: 'units',
    requires_photo: false,
    notes: 'Cartuchos o cubetas',
  },
  {
    id: 'grease_lithium',
    product_name: 'Grasa de Litio',
    category: 'LUBRICANT',
    measure_mode: 'COUNT',
    uom: 'units',
    requires_photo: false,
    notes: 'Cartuchos',
  },
];

// Consumibles
const COMMON_CONSUMABLES: ProductConfig[] = [
  {
    id: 'filter_oil',
    product_name: 'Filtros de Aceite',
    category: 'CONSUMABLE',
    measure_mode: 'COUNT',
    uom: 'units',
    requires_photo: false,
  },
  {
    id: 'filter_air',
    product_name: 'Filtros de Aire',
    category: 'CONSUMABLE',
    measure_mode: 'COUNT',
    uom: 'units',
    requires_photo: false,
  },
  {
    id: 'filter_fuel',
    product_name: 'Filtros de Combustible',
    category: 'CONSUMABLE',
    measure_mode: 'COUNT',
    uom: 'units',
    requires_photo: false,
  },
  {
    id: 'coolant',
    product_name: 'Anticongelante/Coolant',
    category: 'CONSUMABLE',
    measure_mode: 'PAIL',
    uom: 'pails',
    unit_volume: 5,
    requires_photo: true,
    notes: 'Pailas de 5 galones',
  },
  {
    id: 'brake_fluid',
    product_name: 'Líquido de Frenos',
    category: 'CONSUMABLE',
    measure_mode: 'COUNT',
    uom: 'units',
    requires_photo: false,
    notes: 'Botellas de 1 litro',
  },
];

// Equipos y herramientas
const COMMON_EQUIPMENT: ProductConfig[] = [
  {
    id: 'welding_rods',
    product_name: 'Electrodos de Soldadura',
    category: 'EQUIPMENT',
    measure_mode: 'COUNT',
    uom: 'boxes',
    requires_photo: false,
    notes: 'Cajas de electrodos',
  },
  {
    id: 'cutting_discs',
    product_name: 'Discos de Corte',
    category: 'EQUIPMENT',
    measure_mode: 'COUNT',
    uom: 'units',
    requires_photo: false,
  },
  {
    id: 'grinding_discs',
    product_name: 'Discos de Esmeril',
    category: 'EQUIPMENT',
    measure_mode: 'COUNT',
    uom: 'units',
    requires_photo: false,
  },
];

// ============================================================================
// CONFIGURACIONES POR PLANTA
// ============================================================================

export const PRODUCTS_CONFIG: PlantProductsConfig[] = [
  {
    plantId: 'CAROLINA',
    plantName: 'CAROLINA',
    products: [
      ...COMMON_OILS,
      ...COMMON_LUBRICANTS,
      ...COMMON_CONSUMABLES,
      {
        id: 'oil_compressor',
        product_name: 'Aceite de Compresor',
        category: 'OIL',
        measure_mode: 'DRUM',
        uom: 'drums',
        unit_volume: 55,
        requires_photo: true,
        notes: 'Tambores de 55 galones - Específico para Carolina',
      },
      ...COMMON_EQUIPMENT,
    ],
  },
  {
    plantId: 'CEIBA',
    plantName: 'CEIBA',
    products: [
      ...COMMON_OILS,
      ...COMMON_LUBRICANTS,
      ...COMMON_CONSUMABLES,
      ...COMMON_EQUIPMENT,
    ],
  },
  {
    plantId: 'GUAYNABO',
    plantName: 'GUAYNABO',
    products: [
      ...COMMON_OILS,
      {
        id: 'oil_hydraulic_tank',
        product_name: 'Aceite Hidráulico (Tanque)',
        category: 'OIL',
        measure_mode: 'TANK_READING',
        uom: 'gallons',
        reading_uom: 'inches',
        calibration_table: HYDRAULIC_OIL_500_GAL_TANK,
        tank_capacity: 500,
        requires_photo: true,
        notes: 'Tanque de 500 galones - Lectura en pulgadas',
      },
      ...COMMON_LUBRICANTS,
      ...COMMON_CONSUMABLES,
      ...COMMON_EQUIPMENT,
    ],
  },
  {
    plantId: 'GURABO',
    plantName: 'GURABO',
    products: [
      ...COMMON_OILS,
      ...COMMON_LUBRICANTS,
      ...COMMON_CONSUMABLES,
      ...COMMON_EQUIPMENT,
    ],
  },
  {
    plantId: 'VEGA_BAJA',
    plantName: 'VEGA BAJA',
    products: [
      ...COMMON_OILS,
      ...COMMON_LUBRICANTS,
      ...COMMON_CONSUMABLES,
      {
        id: 'degreaser',
        product_name: 'Desengrasante Industrial',
        category: 'CONSUMABLE',
        measure_mode: 'PAIL',
        uom: 'pails',
        unit_volume: 5,
        requires_photo: true,
        notes: 'Pailas de 5 galones - Específico para Vega Baja',
      },
      ...COMMON_EQUIPMENT,
    ],
  },
  {
    plantId: 'HUMACAO',
    plantName: 'HUMACAO',
    products: [
      ...COMMON_OILS,
      ...COMMON_LUBRICANTS,
      ...COMMON_CONSUMABLES,
      ...COMMON_EQUIPMENT,
    ],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Obtiene la configuración de productos para una planta específica
 */
export function getPlantProductsConfig(plantId: string): PlantProductsConfig | undefined {
  return PRODUCTS_CONFIG.find(config => config.plantId === plantId);
}

/**
 * Convierte una lectura a cantidad usando la tabla de calibración
 * Usa interpolación lineal si el valor exacto no está en la tabla
 */
export function convertProductReadingToQuantity(
  reading: number,
  calibrationTable: ProductCalibrationTable
): number {
  // Si la lectura exacta existe en la tabla, retornarla
  const exactValue = calibrationTable[reading.toString()];
  if (exactValue !== undefined) {
    return exactValue;
  }

  // Convertir las claves a números y ordenar
  const readings = Object.keys(calibrationTable).map(Number).sort((a, b) => a - b);
  
  // Si la lectura es menor que el mínimo, retornar el mínimo
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
  const lowerQuantity = calibrationTable[lowerReading.toString()];
  const upperQuantity = calibrationTable[upperReading.toString()];
  
  const ratio = (reading - lowerReading) / (upperReading - lowerReading);
  const interpolatedQuantity = lowerQuantity + ratio * (upperQuantity - lowerQuantity);
  
  return Math.round(interpolatedQuantity * 100) / 100; // Redondear a 2 decimales
}

/**
 * Calcula la cantidad total basado en el measure_mode
 */
export function calculateProductQuantity(
  measureMode: ProductMeasureMode,
  inputValue: number,
  calibrationTable?: ProductCalibrationTable,
  unitVolume?: number
): number {
  switch (measureMode) {
    case 'TANK_READING':
      if (calibrationTable) {
        return convertProductReadingToQuantity(inputValue, calibrationTable);
      }
      return inputValue;
    
    case 'DRUM':
    case 'PAIL':
      if (unitVolume) {
        return inputValue * unitVolume; // number of units * volume per unit
      }
      return inputValue;
    
    case 'COUNT':
      return inputValue;
    
    default:
      return inputValue;
  }
}

/**
 * Obtiene el label apropiado para el input basado en el measure_mode
 */
export function getProductInputLabel(
  measureMode: ProductMeasureMode,
  readingUom?: string,
  uom?: string
): string {
  switch (measureMode) {
    case 'TANK_READING':
      return `Lectura (${readingUom || 'units'})`;
    case 'DRUM':
      return `Cantidad de Tambores`;
    case 'PAIL':
      return `Cantidad de Pailas`;
    case 'COUNT':
      return `Cantidad (${uom || 'units'})`;
    default:
      return 'Cantidad';
  }
}

/**
 * Obtiene el label para la cantidad calculada
 */
export function getProductCalculatedLabel(
  measureMode: ProductMeasureMode,
  uom?: string
): string {
  switch (measureMode) {
    case 'TANK_READING':
      return `Volumen Calculado (${uom || 'units'})`;
    case 'DRUM':
      return `Total (${uom || 'gallons'})`;
    case 'PAIL':
      return `Total (${uom || 'gallons'})`;
    case 'COUNT':
      return `Total (${uom || 'units'})`;
    default:
      return `Total (${uom || 'units'})`;
  }
}
