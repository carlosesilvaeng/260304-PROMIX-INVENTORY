// Configuración de cajones por planta
// Cada cajón tiene dimensiones predefinidas (Alto y Ancho)

export interface CajonConfig {
  id: string;
  name: string;
  ancho: number; // en pies
  alto: number; // en pies
  plantId: string;
}

export const CAJONES_BY_PLANT: Record<string, CajonConfig[]> = {
  'CAROLINA': [
    { id: 'carolina-cajon-1', name: 'Cajón 1', ancho: 30, alto: 12, plantId: 'CAROLINA' },
    { id: 'carolina-cajon-2', name: 'Cajón 2', ancho: 25, alto: 10, plantId: 'CAROLINA' },
    { id: 'carolina-cajon-3', name: 'Cajón 3', ancho: 35, alto: 15, plantId: 'CAROLINA' },
  ],
  'CEIBA': [
    { id: 'ceiba-cajon-1', name: 'Cajón 1', ancho: 28, alto: 11, plantId: 'CEIBA' },
    { id: 'ceiba-cajon-2', name: 'Cajón 2', ancho: 32, alto: 13, plantId: 'CEIBA' },
    { id: 'ceiba-cajon-3', name: 'Cajón 3', ancho: 26, alto: 10, plantId: 'CEIBA' },
  ],
  'GUAYNABO': [
    { id: 'guaynabo-cajon-1', name: 'Cajón 1', ancho: 30, alto: 12, plantId: 'GUAYNABO' },
    { id: 'guaynabo-cajon-2', name: 'Cajón 2', ancho: 28, alto: 11, plantId: 'GUAYNABO' },
    { id: 'guaynabo-cajon-3', name: 'Cajón 3', ancho: 33, alto: 14, plantId: 'GUAYNABO' },
  ],
  'GURABO': [
    { id: 'gurabo-cajon-1', name: 'Cajón 1', ancho: 31, alto: 12, plantId: 'GURABO' },
    { id: 'gurabo-cajon-2', name: 'Cajón 2', ancho: 27, alto: 11, plantId: 'GURABO' },
    { id: 'gurabo-cajon-3', name: 'Cajón 3', ancho: 34, alto: 13, plantId: 'GURABO' },
  ],
  'VEGA BAJA': [
    { id: 'vegabaja-cajon-1', name: 'Cajón 1', ancho: 29, alto: 11, plantId: 'VEGA BAJA' },
    { id: 'vegabaja-cajon-2', name: 'Cajón 2', ancho: 32, alto: 12, plantId: 'VEGA BAJA' },
    { id: 'vegabaja-cajon-3', name: 'Cajón 3', ancho: 30, alto: 13, plantId: 'VEGA BAJA' },
  ],
  'HUMACAO': [
    { id: 'humacao-cajon-1', name: 'Cajón 1', ancho: 28, alto: 11, plantId: 'HUMACAO' },
    { id: 'humacao-cajon-2', name: 'Cajón 2', ancho: 31, alto: 12, plantId: 'HUMACAO' },
    { id: 'humacao-cajon-3', name: 'Cajón 3', ancho: 29, alto: 10, plantId: 'HUMACAO' },
  ],
};

/**
 * Obtiene los cajones disponibles para una planta específica
 */
export function getCajonesByPlant(plantId: string): CajonConfig[] {
  return CAJONES_BY_PLANT[plantId] || [];
}

/**
 * Obtiene un cajón específico por su ID
 */
export function getCajonById(cajonId: string): CajonConfig | undefined {
  for (const plantCajones of Object.values(CAJONES_BY_PLANT)) {
    const cajon = plantCajones.find(c => c.id === cajonId);
    if (cajon) return cajon;
  }
  return undefined;
}
