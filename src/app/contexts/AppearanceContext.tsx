import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { getAppearanceConfig, updateAppearanceConfig } from '../utils/api';
import { isPaletteId, type PaletteId } from '../config/appearance';
import { canManageAppearance } from '../utils/permissions';
import { APPEARANCE_CACHE_KEY as CACHE_KEY, readCachedPalette } from '../config/appearance';

interface AppearanceContextValue {
  palette: PaletteId;
  saving: boolean;
  savePalette: (palette: PaletteId) => Promise<void>;
}
const AppearanceContext = createContext<AppearanceContextValue | null>(null);
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuth();
  const [palette, setPalette] = useState<PaletteId>(readCachedPalette);
  const [saving, setSaving] = useState(false);
  const generation = useRef(0);
  const writing = useRef(false);
  const identity = useRef(accessToken);
  identity.current = accessToken;
  const apply = useCallback((value: PaletteId) => {
    // Changing one document attribute never remounts operational screens.
    document.documentElement.dataset.palette = value;
    setPalette(value);
    try { localStorage.setItem(CACHE_KEY, value); } catch { /* Appearance works without local storage. */ }
  }, []);
  useEffect(() => { document.documentElement.dataset.palette = palette; }, [palette]);
  useEffect(() => {
    if (!accessToken || !user) return;
    let disposed = false;
    let fetching = false;
    const refresh = async () => {
      if (disposed || fetching || writing.current || !navigator.onLine || document.visibilityState === 'hidden') return;
      fetching = true;
      const revision = generation.current;
      try {
        const response = await getAppearanceConfig();
        if (!disposed && revision === generation.current && response.success && isPaletteId(response.data?.palette)) apply(response.data.palette);
      } finally { fetching = false; }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === CACHE_KEY && isPaletteId(event.newValue) && !writing.current) {
        generation.current++;
        apply(event.newValue);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60000);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [accessToken, user?.id, apply]);
  const savePalette = async (value: PaletteId) => {
    if (!canManageAppearance(user?.role)) throw new Error('Se requiere acceso Admin o Super Admin.');
    if (!navigator.onLine) throw new Error('Conéctate a internet para guardar la paleta para toda la empresa.');
    if (writing.current) return;
    const token = accessToken;
    writing.current = true;
    generation.current++;
    setSaving(true);
    try {
      const response = await updateAppearanceConfig(value);
      if (!response.success || !isPaletteId(response.data?.palette)) throw new Error(response.error || 'No se pudo guardar la apariencia.');
      if (identity.current !== token) throw new Error('La sesión cambió. Vuelve a abrir Configuración.');
      apply(response.data.palette);
    } finally { writing.current = false; setSaving(false); }
  };
  return <AppearanceContext.Provider value={{ palette, saving, savePalette }}>{children}</AppearanceContext.Provider>;
}
export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('AppearanceProvider is required');
  return value;
}
