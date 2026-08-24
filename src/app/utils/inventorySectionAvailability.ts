type InventoryAvailabilityData = {
  agregadosEntries?: unknown[];
  silosEntries?: unknown[];
  aditivosEntries?: unknown[];
  dieselEntry?: unknown | null;
  productosEntries?: unknown[];
  utilitiesEntries?: unknown[];
  pettyCashEntry?: unknown | null;
};

const SECTION_ALIASES: Record<string, string> = {
  aggregates: 'agregados',
  additives: 'aditivos',
  products: 'aceites',
  utilities: 'utilidades',
  petty_cash: 'petty-cash',
};

/**
 * Returns whether a section has effective rows/configuration for the selected
 * plant and inventory period. Supports both dashboard routes and validation
 * section IDs so Dashboard and Review always use the same availability rule.
 */
export function hasInventorySectionConfiguration(
  prefillData: InventoryAvailabilityData,
  sectionId: string,
): boolean {
  const normalizedSectionId = SECTION_ALIASES[sectionId] || sectionId;

  const availability: Record<string, boolean> = {
    agregados: (prefillData.agregadosEntries?.length || 0) > 0,
    silos: (prefillData.silosEntries?.length || 0) > 0,
    aditivos: (prefillData.aditivosEntries?.length || 0) > 0,
    diesel: Boolean(prefillData.dieselEntry),
    aceites: (prefillData.productosEntries?.length || 0) > 0,
    utilidades: (prefillData.utilitiesEntries?.length || 0) > 0,
    'petty-cash': Boolean(prefillData.pettyCashEntry),
  };

  return availability[normalizedSectionId] ?? true;
}
