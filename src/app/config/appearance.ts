import { projectId } from '/utils/supabase/info';
import { isPaletteId as validPalette, type PaletteId } from '../../../supabase/functions/make-server/appearance_config';
export { isPaletteId } from '../../../supabase/functions/make-server/appearance_config';
export type { PaletteId, AppearanceConfig } from '../../../supabase/functions/make-server/appearance_config';
export const PALETTES = [
  { id: 'original', name: 'Original', description: 'Los colores actuales de PROMIX.', colors: ['#F2F3F5', '#FFFFFF', '#3B3A36', '#2475C7', '#9D9B9A'] },
  { id: 'command', name: 'Command', description: 'Superficies claras y acentos azul petróleo, inspirados en Command Cloud.', colors: ['#FAFCFC', '#FFFFFF', '#F0FAFC', '#006B91', '#AAA5B8'] },
] as const;

export const APPEARANCE_CACHE_KEY = `promix_appearance:${projectId}`;
export function readCachedPalette(): PaletteId {
  try { const value = localStorage.getItem(APPEARANCE_CACHE_KEY); return validPalette(value) ? value : 'original'; }
  catch { return 'original'; }
}
