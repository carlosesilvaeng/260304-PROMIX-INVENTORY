// Configuración de aditivos para cada planta
// Define tanques con tabla de conversión y productos manuales

export type AdditiveType = 'TANK' | 'MANUAL';

export interface TankConversionTable {
  // Conversion from reading (inches) to volume (gallons)
  // Key: reading in inches (as string), Value: gallons
  [reading: string]: number;
}

export interface AdditiveConfig {
  id: string;
  type: AdditiveType;
  product_name: string; // Nombre del aditivo/producto
  brand?: string; // Marca o procedencia
  uom: string; // Unidad de medida (gallons, liters, bags, pails, lbs, etc.)
  requires_photo: boolean;
  
  // For TANK type
  tank_name?: string; // Nombre del tanque físico
  reading_uom?: string; // Unidad de lectura (inches, cm, etc.)
  conversion_table?: TankConversionTable; // Tabla de conversión lectura → volumen
  
  // For MANUAL type
  // No conversion needed - direct quantity input
}

export interface PlantAdditivesConfig {
  plantId: string;
  plantName: string;
  additives: AdditiveConfig[];
}

// ============================================================================
// TABLA DE CONVERSIÓN EJEMPLO
// ============================================================================
// Ejemplo de conversión de pulgadas a galones para un tanque cilíndrico vertical
// Estos valores deben ser calculados según las dimensiones reales del tanque

const STANDARD_5000_GAL_TANK_TABLE: TankConversionTable = {
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

const STANDARD_3000_GAL_TANK_TABLE: TankConversionTable = {
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

export const ADDITIVES_CONFIG: PlantAdditivesConfig[] = [
  {
    plantId: 'CAROLINA',
    plantName: 'CAROLINA',
    additives: [
      // TANQUES
      {
        id: 'CAROLINA_TANK_WR200',
        type: 'TANK',
        product_name: 'WR 200',
        brand: 'SIKA',
        uom: 'gallons',
        requires_photo: true,
        tank_name: 'Tanque WR200',
        reading_uom: 'inches',
        conversion_table: STANDARD_5000_GAL_TANK_TABLE,
      },
      {
        id: 'CAROLINA_TANK_PLASTIMENT',
        type: 'TANK',
        product_name: 'PLASTIMENT',
        brand: 'SIKA',
        uom: 'gallons',
        requires_photo: true,
        tank_name: 'Tanque Plastiment',
        reading_uom: 'inches',
        conversion_table: STANDARD_3000_GAL_TANK_TABLE,
      },
      {
        id: 'CAROLINA_TANK_VISCOCRETE',
        type: 'TANK',
        product_name: 'VISCOCRETE 3425',
        brand: 'SIKA',
        uom: 'gallons',
        requires_photo: true,
        tank_name: 'Tanque Viscocrete',
        reading_uom: 'inches',
        conversion_table: STANDARD_5000_GAL_TANK_TABLE,
      },
      // MANUALES
      {
        id: 'CAROLINA_MANUAL_FIBRA',
        type: 'MANUAL',
        product_name: 'FIBRA SYNTHETIC',
        brand: 'FORTA',
        uom: 'bags',
        requires_photo: false,
      },
      {
        id: 'CAROLINA_MANUAL_COLOR_BLACK',
        type: 'MANUAL',
        product_name: 'COLOR BLACK',
        brand: 'SOLOMON',
        uom: 'pails',
        requires_photo: false,
      },
      {
        id: 'CAROLINA_MANUAL_COLOR_RED',
        type: 'MANUAL',
        product_name: 'COLOR RED',
        brand: 'SOLOMON',
        uom: 'pails',
        requires_photo: false,
      },
    ],
  },
  {
    plantId: 'CEIBA',
    plantName: 'CEIBA',
    additives: [
      // TANQUES
      {
        id: 'CEIBA_TANK_WR200',
        type: 'TANK',
        product_name: 'WR 200',
        brand: 'SIKA',
        uom: 'gallons',
        requires_photo: true,
        tank_name: 'Tanque WR200',
        reading_uom: 'inches',
        conversion_table: STANDARD_5000_GAL_TANK_TABLE,
      },
      {
        id: 'CEIBA_TANK_PLASTIMENT',
        type: 'TANK',
        product_name: 'PLASTIMENT',
        brand: 'SIKA',
        uom: 'gallons',
        requires_photo: true,
        tank_name: 'Tanque Plastiment',
        reading_uom: 'inches',
        conversion_table: STANDARD_3000_GAL_TANK_TABLE,
      },
      // MANUALES
      {
        id: 'CEIBA_MANUAL_FIBRA',
        type: 'MANUAL',
        product_name: 'FIBRA SYNTHETIC',
        brand: 'FORTA',
        uom: 'bags',
        requires_photo: false,
      },
      {
        id: 'CEIBA_MANUAL_COLOR_BLACK',
        type: 'MANUAL',
        product_name: 'COLOR BLACK',
        brand: 'SOLOMON',
        uom: 'pails',
        requires_photo: false,
      },
    ],
  },
  {
    plantId: 'GUAYNABO',
    plantName: 'GUAYNABO',
    additives: [
      // TANQUES
      {
        id: 'GUAYNABO_TANK_WR200',
        type: 'TANK',
        product_name: 'WR 200',
        brand: 'SIKA',
        uom: 'gallons',
        requires_photo: true,
        tank_name: 'Tanque WR200',
        reading_uom: 'inches',
        conversion_table: STANDARD_5000_GAL_TANK_TABLE,
      },
      {
        id: 'GUAYNABO_TANK_PLASTIMENT',
        type: 'TANK',
        product_name: 'PLASTIMENT',
        brand: 'SIKA',
        uom: 'gallons',
        requires_photo: true,
        tank_name: 'Tanque Plastiment',
        reading_uom: 'inches',
        conversion_table: STANDARD_3000_GAL_TANK_TABLE,
      },
      {
        id: 'GUAYNABO_TANK_VISCOCRETE',
        type: 'TANK',
        product_name: 'VISCOCRETE 3425',
        brand: 'SIKA',
        uom: 'gallons',
        requires_photo: true,
        tank_name: 'Tanque Viscocrete',
        reading_uom: 'inches',
        conversion_table: STANDARD_5000_GAL_TANK_TABLE,
      },
      // MANUALES
      {
        id: 'GUAYNABO_MANUAL_FIBRA',
        type: 'MANUAL',
        product_name: 'FIBRA SYNTHETIC',
        brand: 'FORTA',
        uom: 'bags',
        requires_photo: false,
      },
      {
        id: 'GUAYNABO_MANUAL_COLOR_BLACK',
        type: 'MANUAL',
        product_name: 'COLOR BLACK',
        brand: 'SOLOMON',
        uom: 'pails',
        requires_photo: false,
      },
      {
        id: 'GUAYNABO_MANUAL_SILICA_FUME',
        type: 'MANUAL',
        product_name: 'SILICA FUME',
        brand: 'ELKEM',
        uom: 'bags',
        requires_photo: false,
      },
    ],
  },
  {
    plantId: 'GURABO',
    plantName: 'GURABO',
    additives: [
      // TANQUES
      {
        id: 'GURABO_TANK_WR200',
        type: 'TANK',
        product_name: 'WR 200',
        brand: 'SIKA',
        uom: 'gallons',
        requires_photo: true,
        tank_name: 'Tanque WR200',
        reading_uom: 'inches',
        conversion_table: STANDARD_5000_GAL_TANK_TABLE,
      },
      {
        id: 'GURABO_TANK_PLASTIMENT',
        type: 'TANK',
        product_name: 'PLASTIMENT',
        brand: 'SIKA',
        uom: 'gallons',
        requires_photo: true,
        tank_name: 'Tanque Plastiment',
        reading_uom: 'inches',
        conversion_table: STANDARD_3000_GAL_TANK_TABLE,
      },
      // MANUALES
      {
        id: 'GURABO_MANUAL_FIBRA',
        type: 'MANUAL',
        product_name: 'FIBRA SYNTHETIC',
        brand: 'FORTA',
        uom: 'bags',
        requires_photo: false,
      },
    ],
  },
  {
    plantId: 'VEGA_BAJA',
    plantName: 'VEGA BAJA',
    additives: [
      // TANQUES
      {
        id: 'VEGA_BAJA_TANK_WR200',
        type: 'TANK',
        product_name: 'WR 200',
        brand: 'SIKA',
        uom: 'gallons',
        requires_photo: true,
        tank_name: 'Tanque WR200',
        reading_uom: 'inches',
        conversion_table: STANDARD_5000_GAL_TANK_TABLE,
      },
      {
        id: 'VEGA_BAJA_TANK_PLASTIMENT',
        type: 'TANK',
        product_name: 'PLASTIMENT',
        brand: 'SIKA',
        uom: 'gallons',
        requires_photo: true,
        tank_name: 'Tanque Plastiment',
        reading_uom: 'inches',
        conversion_table: STANDARD_3000_GAL_TANK_TABLE,
      },
      {
        id: 'VEGA_BAJA_TANK_VISCOCRETE',
        type: 'TANK',
        product_name: 'VISCOCRETE 3425',
        brand: 'SIKA',
        uom: 'gallons',
        requires_photo: true,
        tank_name: 'Tanque Viscocrete',
        reading_uom: 'inches',
        conversion_table: STANDARD_5000_GAL_TANK_TABLE,
      },
      // MANUALES
      {
        id: 'VEGA_BAJA_MANUAL_FIBRA',
        type: 'MANUAL',
        product_name: 'FIBRA SYNTHETIC',
        brand: 'FORTA',
        uom: 'bags',
        requires_photo: false,
      },
      {
        id: 'VEGA_BAJA_MANUAL_COLOR_BLACK',
        type: 'MANUAL',
        product_name: 'COLOR BLACK',
        brand: 'SOLOMON',
        uom: 'pails',
        requires_photo: false,
      },
    ],
  },
  {
    plantId: 'HUMACAO',
    plantName: 'HUMACAO',
    additives: [
      // TANQUES
      {
        id: 'HUMACAO_TANK_WR200',
        type: 'TANK',
        product_name: 'WR 200',
        brand: 'SIKA',
        uom: 'gallons',
        requires_photo: true,
        tank_name: 'Tanque WR200',
        reading_uom: 'inches',
        conversion_table: STANDARD_5000_GAL_TANK_TABLE,
      },
      {
        id: 'HUMACAO_TANK_PLASTIMENT',
        type: 'TANK',
        product_name: 'PLASTIMENT',
        brand: 'SIKA',
        uom: 'gallons',
        requires_photo: true,
        tank_name: 'Tanque Plastiment',
        reading_uom: 'inches',
        conversion_table: STANDARD_3000_GAL_TANK_TABLE,
      },
      // MANUALES
      {
        id: 'HUMACAO_MANUAL_FIBRA',
        type: 'MANUAL',
        product_name: 'FIBRA SYNTHETIC',
        brand: 'FORTA',
        uom: 'bags',
        requires_photo: false,
      },
    ],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Obtiene la configuración de aditivos para una planta específica
 */
export function getPlantAdditivesConfig(plantId: string): PlantAdditivesConfig | undefined {
  return ADDITIVES_CONFIG.find(config => config.plantId === plantId);
}

/**
 * Obtiene un aditivo específico por ID
 */
export function getAdditiveConfig(plantId: string, additiveId: string): AdditiveConfig | undefined {
  const plantConfig = getPlantAdditivesConfig(plantId);
  return plantConfig?.additives.find(add => add.id === additiveId);
}

/**
 * Obtiene todos los tanques para una planta
 */
export function getTankConfigs(plantId: string): AdditiveConfig[] {
  const plantConfig = getPlantAdditivesConfig(plantId);
  return plantConfig?.additives.filter(add => add.type === 'TANK') || [];
}

/**
 * Obtiene todos los productos manuales para una planta
 */
export function getManualConfigs(plantId: string): AdditiveConfig[] {
  const plantConfig = getPlantAdditivesConfig(plantId);
  return plantConfig?.additives.filter(add => add.type === 'MANUAL') || [];
}

/**
 * Convierte una lectura a volumen usando la tabla de conversión
 * Usa interpolación lineal si el valor exacto no está en la tabla
 */
export function convertReadingToVolume(
  reading: number,
  conversionTable: TankConversionTable
): number {
  // Si la lectura exacta existe en la tabla, retornarla
  const exactValue = conversionTable[reading.toString()];
  if (exactValue !== undefined) {
    return exactValue;
  }

  // Convertir las claves a números y ordenar
  const readings = Object.keys(conversionTable).map(Number).sort((a, b) => a - b);
  
  // Si la lectura es menor que el mínimo, retornar 0
  if (reading <= readings[0]) {
    return conversionTable[readings[0].toString()];
  }
  
  // Si la lectura es mayor que el máximo, retornar el máximo
  if (reading >= readings[readings.length - 1]) {
    return conversionTable[readings[readings.length - 1].toString()];
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
  const lowerVolume = conversionTable[lowerReading.toString()];
  const upperVolume = conversionTable[upperReading.toString()];
  
  const ratio = (reading - lowerReading) / (upperReading - lowerReading);
  const interpolatedVolume = lowerVolume + ratio * (upperVolume - lowerVolume);
  
  return Math.round(interpolatedVolume * 100) / 100; // Redondear a 2 decimales
}
