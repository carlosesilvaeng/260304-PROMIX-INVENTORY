// Configuración de Petty Cash por planta
// Define el monto establecido de Petty Cash que cada planta debe mantener

export interface PettyCashConfig {
  plantId: string;
  plantName: string;
  established_amount: number; // Monto fijo establecido en $USD
  currency: string; // 'USD'
  notes?: string; // Notas sobre el manejo de petty cash
}

// ============================================================================
// CONFIGURACIONES POR PLANTA
// ============================================================================

export const PETTY_CASH_CONFIG: PettyCashConfig[] = [
  {
    plantId: 'CAROLINA',
    plantName: 'CAROLINA',
    established_amount: 1000.00,
    currency: 'USD',
    notes: 'Monto establecido para gastos operacionales menores',
  },
  {
    plantId: 'CEIBA',
    plantName: 'CEIBA',
    established_amount: 800.00,
    currency: 'USD',
    notes: 'Monto establecido para gastos operacionales menores',
  },
  {
    plantId: 'GUAYNABO',
    plantName: 'GUAYNABO',
    established_amount: 1200.00,
    currency: 'USD',
    notes: 'Monto establecido para gastos operacionales menores',
  },
  {
    plantId: 'GURABO',
    plantName: 'GURABO',
    established_amount: 900.00,
    currency: 'USD',
    notes: 'Monto establecido para gastos operacionales menores',
  },
  {
    plantId: 'VEGA_BAJA',
    plantName: 'VEGA BAJA',
    established_amount: 1000.00,
    currency: 'USD',
    notes: 'Monto establecido para gastos operacionales menores',
  },
  {
    plantId: 'HUMACAO',
    plantName: 'HUMACAO',
    established_amount: 750.00,
    currency: 'USD',
    notes: 'Monto establecido para gastos operacionales menores',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Obtiene la configuración de Petty Cash para una planta específica
 */
export function getPettyCashConfig(plantId: string): PettyCashConfig | undefined {
  return PETTY_CASH_CONFIG.find(config => config.plantId === plantId);
}

/**
 * Calcula el total de Petty Cash
 * Total = Recibos + Efectivo
 */
export function calculatePettyCashTotal(receipts: number, cash: number): number {
  return receipts + cash;
}

/**
 * Calcula la diferencia de Petty Cash
 * Diferencia = Establecido - Total
 * - Si diferencia > 0: FALTANTE
 * - Si diferencia < 0: SOBRANTE
 * - Si diferencia = 0: CORRECTO
 */
export function calculatePettyCashDifference(
  established: number,
  total: number
): number {
  return established - total;
}

/**
 * Obtiene el estado de Petty Cash basado en la diferencia
 */
export function getPettyCashStatus(difference: number): {
  status: 'CORRECT' | 'SHORT' | 'OVER';
  label: string;
  color: string;
} {
  if (difference === 0) {
    return {
      status: 'CORRECT',
      label: 'Cuadra Perfecto',
      color: 'text-green-600',
    };
  } else if (difference > 0) {
    return {
      status: 'SHORT',
      label: 'Faltante',
      color: 'text-red-600',
    };
  } else {
    return {
      status: 'OVER',
      label: 'Sobrante',
      color: 'text-orange-600',
    };
  }
}

/**
 * Formatea un monto en USD
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
