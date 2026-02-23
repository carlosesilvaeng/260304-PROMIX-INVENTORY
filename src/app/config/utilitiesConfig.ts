// Configuración de medidores de utilidades por planta
// Define el listado fijo de medidores que cada planta debe reportar

export type UtilityType = 
  | 'WATER_AAA'         // Agua de AAA (Acueductos)
  | 'WATER_WELL'        // Agua de Pozo
  | 'ELECTRICITY'       // Electricidad
  | 'GAS'               // Gas
  | 'OTHER';            // Otro servicio

export interface UtilityMeterConfig {
  id: string;
  meter_name: string;
  meter_number: string; // Número del medidor (físico)
  utility_type: UtilityType;
  uom: string; // Unit of measure: 'kWh', 'gallons', 'm³', 'cubic feet', etc.
  provider: string; // Proveedor del servicio (e.g., "AAA", "PREPA", "AEE")
  requires_photo: boolean;
  initial_reading?: number; // Lectura inicial para el primer mes (opcional)
  notes?: string; // Notas adicionales
}

export interface PlantUtilitiesConfig {
  plantId: string;
  plantName: string;
  meters: UtilityMeterConfig[];
}

// ============================================================================
// CONFIGURACIONES POR PLANTA
// ============================================================================

export const UTILITIES_CONFIG: PlantUtilitiesConfig[] = [
  {
    plantId: 'CAROLINA',
    plantName: 'CAROLINA',
    meters: [
      {
        id: 'water_aaa_main',
        meter_name: 'Agua AAA - Principal',
        meter_number: 'AAA-CAR-001',
        utility_type: 'WATER_AAA',
        uom: 'gallons',
        provider: 'AAA',
        requires_photo: true,
        initial_reading: 125000,
        notes: 'Medidor principal en entrada',
      },
      {
        id: 'water_well_backup',
        meter_name: 'Agua Pozo - Backup',
        meter_number: 'WELL-CAR-001',
        utility_type: 'WATER_WELL',
        uom: 'gallons',
        provider: 'Pozo Propio',
        requires_photo: true,
        initial_reading: 85000,
        notes: 'Medidor de pozo para emergencias',
      },
      {
        id: 'electricity_plant',
        meter_name: 'Electricidad - Planta',
        meter_number: 'LUMA-CAR-12345',
        utility_type: 'ELECTRICITY',
        uom: 'kWh',
        provider: 'LUMA Energy',
        requires_photo: true,
        initial_reading: 450000,
        notes: 'Medidor principal de electricidad',
      },
      {
        id: 'electricity_office',
        meter_name: 'Electricidad - Oficinas',
        meter_number: 'LUMA-CAR-12346',
        utility_type: 'ELECTRICITY',
        uom: 'kWh',
        provider: 'LUMA Energy',
        requires_photo: true,
        initial_reading: 35000,
        notes: 'Medidor de oficinas administrativas',
      },
    ],
  },
  {
    plantId: 'CEIBA',
    plantName: 'CEIBA',
    meters: [
      {
        id: 'water_aaa_main',
        meter_name: 'Agua AAA - Principal',
        meter_number: 'AAA-CEI-001',
        utility_type: 'WATER_AAA',
        uom: 'gallons',
        provider: 'AAA',
        requires_photo: true,
        initial_reading: 95000,
      },
      {
        id: 'water_well_primary',
        meter_name: 'Agua Pozo - Principal',
        meter_number: 'WELL-CEI-001',
        utility_type: 'WATER_WELL',
        uom: 'gallons',
        provider: 'Pozo Propio',
        requires_photo: true,
        initial_reading: 120000,
        notes: 'Pozo principal - uso frecuente',
      },
      {
        id: 'electricity_plant',
        meter_name: 'Electricidad - Planta',
        meter_number: 'LUMA-CEI-67890',
        utility_type: 'ELECTRICITY',
        uom: 'kWh',
        provider: 'LUMA Energy',
        requires_photo: true,
        initial_reading: 380000,
      },
    ],
  },
  {
    plantId: 'GUAYNABO',
    plantName: 'GUAYNABO',
    meters: [
      {
        id: 'water_aaa_main',
        meter_name: 'Agua AAA - Principal',
        meter_number: 'AAA-GUA-001',
        utility_type: 'WATER_AAA',
        uom: 'gallons',
        provider: 'AAA',
        requires_photo: true,
        initial_reading: 180000,
      },
      {
        id: 'electricity_plant',
        meter_name: 'Electricidad - Planta',
        meter_number: 'LUMA-GUA-11111',
        utility_type: 'ELECTRICITY',
        uom: 'kWh',
        provider: 'LUMA Energy',
        requires_photo: true,
        initial_reading: 520000,
      },
      {
        id: 'electricity_warehouse',
        meter_name: 'Electricidad - Almacén',
        meter_number: 'LUMA-GUA-11112',
        utility_type: 'ELECTRICITY',
        uom: 'kWh',
        provider: 'LUMA Energy',
        requires_photo: true,
        initial_reading: 42000,
      },
    ],
  },
  {
    plantId: 'GURABO',
    plantName: 'GURABO',
    meters: [
      {
        id: 'water_aaa_main',
        meter_name: 'Agua AAA - Principal',
        meter_number: 'AAA-GUR-001',
        utility_type: 'WATER_AAA',
        uom: 'gallons',
        provider: 'AAA',
        requires_photo: true,
        initial_reading: 110000,
      },
      {
        id: 'water_well_backup',
        meter_name: 'Agua Pozo - Backup',
        meter_number: 'WELL-GUR-001',
        utility_type: 'WATER_WELL',
        uom: 'gallons',
        provider: 'Pozo Propio',
        requires_photo: true,
        initial_reading: 68000,
      },
      {
        id: 'electricity_plant',
        meter_name: 'Electricidad - Planta',
        meter_number: 'LUMA-GUR-22222',
        utility_type: 'ELECTRICITY',
        uom: 'kWh',
        provider: 'LUMA Energy',
        requires_photo: true,
        initial_reading: 410000,
      },
    ],
  },
  {
    plantId: 'VEGA_BAJA',
    plantName: 'VEGA BAJA',
    meters: [
      {
        id: 'water_aaa_main',
        meter_name: 'Agua AAA - Principal',
        meter_number: 'AAA-VB-001',
        utility_type: 'WATER_AAA',
        uom: 'gallons',
        provider: 'AAA',
        requires_photo: true,
        initial_reading: 145000,
      },
      {
        id: 'electricity_plant',
        meter_name: 'Electricidad - Planta',
        meter_number: 'LUMA-VB-33333',
        utility_type: 'ELECTRICITY',
        uom: 'kWh',
        provider: 'LUMA Energy',
        requires_photo: true,
        initial_reading: 475000,
      },
      {
        id: 'electricity_office',
        meter_name: 'Electricidad - Oficinas',
        meter_number: 'LUMA-VB-33334',
        utility_type: 'ELECTRICITY',
        uom: 'kWh',
        provider: 'LUMA Energy',
        requires_photo: true,
        initial_reading: 38000,
      },
    ],
  },
  {
    plantId: 'HUMACAO',
    plantName: 'HUMACAO',
    meters: [
      {
        id: 'water_aaa_main',
        meter_name: 'Agua AAA - Principal',
        meter_number: 'AAA-HUM-001',
        utility_type: 'WATER_AAA',
        uom: 'gallons',
        provider: 'AAA',
        requires_photo: true,
        initial_reading: 88000,
      },
      {
        id: 'water_well_primary',
        meter_name: 'Agua Pozo - Principal',
        meter_number: 'WELL-HUM-001',
        utility_type: 'WATER_WELL',
        uom: 'gallons',
        provider: 'Pozo Propio',
        requires_photo: true,
        initial_reading: 102000,
      },
      {
        id: 'electricity_plant',
        meter_name: 'Electricidad - Planta',
        meter_number: 'LUMA-HUM-44444',
        utility_type: 'ELECTRICITY',
        uom: 'kWh',
        provider: 'LUMA Energy',
        requires_photo: true,
        initial_reading: 340000,
      },
    ],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Obtiene la configuración de medidores de utilidades para una planta específica
 */
export function getPlantUtilitiesConfig(plantId: string): PlantUtilitiesConfig | undefined {
  return UTILITIES_CONFIG.find(config => config.plantId === plantId);
}

/**
 * Calcula el consumo de utilidad
 * Consumo = Lectura Actual - Lectura Anterior
 */
export function calculateUtilityConsumption(
  currentReading: number,
  previousReading: number
): number {
  const consumption = currentReading - previousReading;
  return Math.max(0, consumption); // No puede ser negativo
}

/**
 * Obtiene el label apropiado para el tipo de utilidad
 */
export function getUtilityTypeLabel(utilityType: UtilityType): string {
  const labels: Record<UtilityType, string> = {
    WATER_AAA: 'Agua AAA',
    WATER_WELL: 'Agua Pozo',
    ELECTRICITY: 'Electricidad',
    GAS: 'Gas',
    OTHER: 'Otro',
  };
  return labels[utilityType] || 'Otro';
}

/**
 * Obtiene el ícono apropiado para el tipo de utilidad
 */
export function getUtilityTypeIcon(utilityType: UtilityType): string {
  const icons: Record<UtilityType, string> = {
    WATER_AAA: '💧',
    WATER_WELL: '🚰',
    ELECTRICITY: '⚡',
    GAS: '🔥',
    OTHER: '📊',
  };
  return icons[utilityType] || '📊';
}

/**
 * Obtiene el color apropiado para el tipo de utilidad
 */
export function getUtilityTypeColor(utilityType: UtilityType): string {
  const colors: Record<UtilityType, string> = {
    WATER_AAA: 'bg-blue-100 text-blue-800 border-blue-300',
    WATER_WELL: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    ELECTRICITY: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    GAS: 'bg-orange-100 text-orange-800 border-orange-300',
    OTHER: 'bg-gray-100 text-gray-800 border-gray-300',
  };
  return colors[utilityType] || 'bg-gray-100 text-gray-800 border-gray-300';
}
