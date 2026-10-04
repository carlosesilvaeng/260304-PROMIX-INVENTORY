import { InventoryError } from './inventory_guard.ts';

export async function preparePendingInventoryPhoto(base64: unknown, photoId: unknown, plantId: string, userId: string) {
  if (typeof base64 !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(base64)) throw new InventoryError('Formato de fotografía no permitido.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(base64));
  const expected = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (photoId !== expected) throw new InventoryError('Identificador de fotografía inválido.');
  const [header, raw] = base64.split(',');
  let binary: string;
  try { binary = atob(raw); } catch { throw new InventoryError('Datos de fotografía inválidos.'); }
  if (!binary.length) throw new InventoryError('La fotografía está vacía.');
  if (binary.length > 3 * 1024 * 1024) throw new InventoryError('Imagen demasiado grande (máx 3 MB).');
  const contentType = header.slice(5).replace(';base64', '');
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  return { bytes: Uint8Array.from(binary, character => character.charCodeAt(0)), contentType,
    path: `phase2/${encodeURIComponent(plantId)}/${encodeURIComponent(userId)}/${expected}.${ext}` };
}

export function pendingInventoryPhotoPath(url: string, root: string, plantId: string) {
  const path = url.startsWith(root) ? url.slice(root.length) : '';
  const prefix = `phase2/${encodeURIComponent(plantId)}/`;
  if (!path.startsWith(prefix) || !/^[^/]+\/[0-9a-f]{64}\.(jpg|png|webp)$/.test(path.slice(prefix.length)) || /\.\.|[?#]/.test(path)) {
    throw new InventoryError('La fotografía pertenece a otra planta o entorno, o su ruta no es válida.');
  }
  return path;
}
