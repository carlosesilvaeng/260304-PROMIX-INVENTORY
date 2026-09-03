/** Add new equipment to an open inventory without copying readings between containers. */
export function appendConfiguredEntries<T>(
  saved: T[],
  configured: T[],
  key: (entry: T) => string | undefined,
  status: string,
): T[] {
  if (status !== 'IN_PROGRESS') return saved;
  const known = new Set(saved.map(key).filter(Boolean));
  const missing = configured.filter((entry) => {
    const id = key(entry);
    if (!id || known.has(id)) return false;
    known.add(id);
    return true;
  });
  return [...saved, ...missing];
}
