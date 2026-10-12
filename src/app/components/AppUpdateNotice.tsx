import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { canReloadApplication, claimAutomaticReload, fetchPublishedBuild, updatePhotoActivity } from '../utils/appUpdate';

declare const __PROMIX_BUILD_ID__: string;
const currentBuild = __PROMIX_BUILD_ID__;

export function useApplicationUpdate({ account, authLoading, pending, loading }: {
  account: string; authLoading: boolean; pending: boolean; loading: boolean;
}) {
  const photos = useSyncExternalStore(updatePhotoActivity.subscribe, updatePhotoActivity.getSnapshot);
  const [checkedAccount, setCheckedAccount] = useState<string | null>(null);
  const [available, setAvailable] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [reloading, setReloading] = useState(false);
  const safety = useRef({ pending, loading, photos });
  safety.current = { pending, loading, photos };
  const safeNow = () => canReloadApplication(safety.current.pending, safety.current.loading,
    updatePhotoActivity.getSnapshot(), navigator.onLine);

  const reload = useCallback((build: string) => {
    if (!safeNow()) return false;
    setReloading(true);
    const url = new URL(window.location.href);
    // A fresh navigation also bypasses a cached document in older workers.
    url.searchParams.set('promix_update', build);
    window.location.replace(url.toString());
    return true;
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    void (async () => {
      const published = import.meta.env.PROD && navigator.onLine ? await fetchPublishedBuild() : null;
      if (cancelled) return;
      if (published && published !== currentBuild) {
        setAvailable(published);
        if (safeNow() && claimAutomaticReload(sessionStorage, currentBuild, published) && reload(published)) return;
      } else if (published === currentBuild) setAvailable(null);
      setCheckedAccount(account);
    })();
    return () => { cancelled = true; };
  }, [account, authLoading, reload]);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let cancelled = false;
    let checking = false;
    const check = async () => {
      if (checking || !navigator.onLine || document.visibilityState === 'hidden') return;
      checking = true;
      const published = await fetchPublishedBuild();
      checking = false;
      if (!cancelled && published) setAvailable(published !== currentBuild ? published : null);
    };
    const connectivity = () => { setOnline(navigator.onLine); void check(); };
    const timer = setInterval(check, 60000);
    window.addEventListener('online', connectivity);
    window.addEventListener('offline', connectivity);
    document.addEventListener('visibilitychange', check);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('online', connectivity);
      window.removeEventListener('offline', connectivity);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return {
    checking: !authLoading && (checkedAccount !== account || reloading),
    available,
    blocked: !canReloadApplication(pending, loading, photos, online),
    reload: () => { if (available) reload(available); },
  };
}

export function AppUpdateNotice({ update }: { update: ReturnType<typeof useApplicationUpdate> }) {
  if (!update.available) return null;
  return (
    <div role="status" className="border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p><strong>Hay una actualización disponible.</strong>{' '}
          {update.blocked
            ? 'Guarda el progreso y espera a que las lecturas y fotos estén guardadas en el servidor antes de actualizar.'
            : 'Tu progreso está guardado. Puedes actualizar la aplicación.'}</p>
        <button type="button" disabled={update.blocked} onClick={update.reload}
          className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          Actualizar ahora
        </button>
      </div>
    </div>
  );
}
