// Shared with photo preparation, which starts before a draft becomes dirty.
let activePhotos = 0;
const listeners = new Set<() => void>();
export function beginUpdateProtectedPhoto() {
  activePhotos++;
  listeners.forEach(listener => listener());
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    activePhotos--;
    listeners.forEach(listener => listener());
  };
}
export const updatePhotoActivity = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot() { return activePhotos; },
};

export function canReloadApplication(pending: boolean, loading: boolean, photos: number, online: boolean) {
  return !pending && !loading && photos === 0 && online;
}

export async function fetchPublishedBuild(fetcher: typeof fetch = fetch): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetcher(`/app-version.json?t=${Date.now()}`, {
      cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.buildId === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(data.buildId) ? data.buildId : null;
  } catch {
    // Unavailable checks must never prevent offline capture or login.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function claimAutomaticReload(storage: Pick<Storage, 'getItem' | 'setItem'>, current: string, target: string) {
  const key = 'promix-version-reload';
  const attempt = `${current}:${target}`;
  try {
    if (storage.getItem(key) === attempt) return false;
    storage.setItem(key, attempt);
    return true;
  } catch {
    // Without a persisted guard, automatic reloads could loop.
    return false;
  }
}
