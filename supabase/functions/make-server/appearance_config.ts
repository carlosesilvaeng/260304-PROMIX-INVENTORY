export type PaletteId = 'original' | 'command';
export interface AppearanceConfig {
  palette: PaletteId;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}
export function isPaletteId(value: unknown): value is PaletteId {
  return value === 'original' || value === 'command';
}
export function canManageAppearance(role?: string | null): boolean {
  return role === 'admin' || role === 'super_admin';
}

// Separate key and handlers keep appearance writes isolated from operational settings.
export function createAppearanceHandlers(store: {
  get: (key: string) => Promise<any>;
  set: (key: string, value: AppearanceConfig) => Promise<void>;
}) {
  return {
    async read(c: any) {
      if (!c.get('user')) return c.json({ success: false, error: 'Unauthorized' }, 401);
      try {
        const saved = await store.get('appearance_config');
        const data: AppearanceConfig = isPaletteId(saved?.palette) ? saved : { palette: 'original' };
        return c.json({ success: true, data });
      } catch {
        return c.json({ success: false, error: 'No se pudo cargar la apariencia.' }, 500);
      }
    },
    async write(c: any) {
      const user = c.get('user');
      if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);
      if (!canManageAppearance(user.role)) return c.json({ success: false, error: 'Se requiere acceso Admin o Super Admin.' }, 403);
      let body: any;
      try { body = await c.req.json(); } catch {
        return c.json({ success: false, error: 'Solicitud inválida.' }, 400);
      }
      if (!isPaletteId(body?.palette)) return c.json({ success: false, error: 'Paleta inválida.' }, 400);
      const data: AppearanceConfig = { palette: body.palette, lastUpdatedBy: user.id, lastUpdatedAt: new Date().toISOString() };
      try {
        await store.set('appearance_config', data);
        return c.json({ success: true, data });
      } catch {
        return c.json({ success: false, error: 'No se pudo guardar la apariencia.' }, 500);
      }
    },
  };
}
