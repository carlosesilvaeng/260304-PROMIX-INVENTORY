import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { Alert } from '../components/Alert';
import { Modal } from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server`;

// Broken image placeholder (grey camera icon)
const PLACEHOLDER_SVG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%239D9B9A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>'
)}`;

const MONTH_NAMES: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo',  '06': 'Junio',   '07': 'Julio',  '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

function formatPeriod(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${MONTH_NAMES[month] || month} ${year}`;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${date} ${time}`;
  } catch {
    return iso;
  }
}

function computeBase64Size(dataUrl: string): string {
  try {
    const base64Part = dataUrl.split(',')[1] || '';
    const bytes = Math.round((base64Part.length * 3) / 4);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } catch {
    return 'N/A';
  }
}

// Section color map for badges
const SECTION_COLORS: Record<string, string> = {
  'Agregados':  'bg-amber-100 text-amber-800',
  'Silos':      'bg-blue-100 text-blue-800',
  'Aditivos':   'bg-purple-100 text-purple-800',
  'Diesel':     'bg-orange-100 text-orange-800',
  'Productos': 'bg-green-100 text-green-800',
  'Aceites y Productos': 'bg-green-100 text-green-800',
  'Utilidades': 'bg-cyan-100 text-cyan-800',
  'Petty Cash': 'bg-pink-100 text-pink-800',
};

interface PhotoRecord {
  id: string;
  section: string;
  item_name: string;
  plant_id: string;
  plant_name: string;
  year_month: string;
  photo_url: string;
  notes: string | null;
  created_at: string;
}

interface PlantOption {
  id: string;
  name: string;
}

export function PhotosReport() {
  const { accessToken } = useAuth();

  const [photos, setPhotos]     = useState<PhotoRecord[]>([]);
  const [plants, setPlants]     = useState<PlantOption[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Filters
  const [filterPlant, setFilterPlant]   = useState('all');
  const [filterMonth, setFilterMonth]   = useState('');   // "YYYY-MM" or ''

  // Lightbox
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(null);

  // Lazy size loading for storage URLs
  const [sizes, setSizes]       = useState<Record<string, string>>({});
  const sizeFetchedRef          = useRef<Set<string>>(new Set());

  // ── Fetch helper ────────────────────────────────────────────────────────────
  const authHeader = { Authorization: `Bearer ${accessToken || publicAnonKey}` };

  const fetchPlants = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/plants`, { headers: authHeader });
      const json = await res.json();
      if (json.success) {
        setPlants((json.data || []).map((p: any) => ({ id: p.id, name: p.name || p.id })));
      }
    } catch {
      // Plant filter will just show IDs if this fails
    }
  }, [accessToken]);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterPlant !== 'all') params.set('plant_id', filterPlant);
      if (filterMonth) params.set('year_month', filterMonth);

      const res = await fetch(
        `${API_BASE_URL}/photos/report?${params.toString()}`,
        { headers: authHeader }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Error al cargar fotos');
      setPhotos(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, filterPlant, filterMonth]);

  useEffect(() => { fetchPlants(); }, [fetchPlants]);
  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  // ── Size helpers ────────────────────────────────────────────────────────────
  function fetchStorageSize(photoId: string, url: string) {
    if (sizeFetchedRef.current.has(photoId)) return;
    sizeFetchedRef.current.add(photoId);
    fetch(url, { method: 'HEAD' })
      .then(res => {
        const len = res.headers.get('content-length');
        if (len) {
          const bytes = parseInt(len, 10);
          let label: string;
          if (bytes < 1024) label = `${bytes} B`;
          else if (bytes < 1024 * 1024) label = `${(bytes / 1024).toFixed(1)} KB`;
          else label = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
          setSizes(prev => ({ ...prev, [photoId]: label }));
        } else {
          setSizes(prev => ({ ...prev, [photoId]: 'N/A' }));
        }
      })
      .catch(() => {
        setSizes(prev => ({ ...prev, [photoId]: 'N/A' }));
      });
  }

  function getPhotoType(url: string): string {
    return url.startsWith('data:image/') ? 'Base64' : 'URL';
  }

  function getPhotoSize(photo: PhotoRecord): string {
    if (photo.photo_url.startsWith('data:image/')) {
      return computeBase64Size(photo.photo_url);
    }
    // Storage URL — fetch lazily
    if (!sizes[photo.id]) {
      fetchStorageSize(photo.id, photo.photo_url);
      return '...';
    }
    return sizes[photo.id];
  }

  // ── Derived stats ───────────────────────────────────────────────────────────
  const uniquePlants   = new Set(photos.map(p => p.plant_id)).size;
  const uniqueSections = new Set(photos.map(p => p.section)).size;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#3B3A36]">🖼️ Reporte de Fotos</h2>
          <p className="text-[#5F6773] mt-1">
            Todas las fotografías capturadas durante el inventario
          </p>
        </div>
        <Button onClick={fetchPhotos} loading={loading} variant="secondary" size="sm">
          Actualizar
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Alert type="error" message={`Error al cargar fotos: ${error}`} onClose={() => setError(null)} />
      )}

      {/* Filters */}
      <Card>
        <h3 className="text-base font-semibold text-[#3B3A36] mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <Select
            label="Planta"
            value={filterPlant}
            onChange={(e) => setFilterPlant(e.target.value)}
            options={[
              { value: 'all', label: 'Todas las plantas' },
              ...plants.map(p => ({ value: p.id, label: p.name })),
            ]}
          />
          <div>
            <label className="block text-[#3B3A36] mb-1.5">Período</label>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#F2F3F5] border border-[#9D9B9A] rounded text-[#3B3A36] focus:outline-none focus:ring-2 focus:ring-[#2475C7] focus:border-transparent transition-all"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => { setFilterPlant('all'); setFilterMonth(''); }}
            >
              Limpiar
            </Button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-[#5F6773] mb-1">Total Fotos</p>
          <p className="text-3xl font-bold text-[#2475C7]">{loading ? '—' : photos.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-[#5F6773] mb-1">Plantas</p>
          <p className="text-3xl font-bold text-[#2475C7]">{loading ? '—' : uniquePlants}</p>
        </Card>
        <Card>
          <p className="text-sm text-[#5F6773] mb-1">Secciones</p>
          <p className="text-3xl font-bold text-[#2475C7]">{loading ? '—' : uniqueSections}</p>
        </Card>
      </div>

      {/* Table */}
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#3B3A36] text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Planta</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Sección</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Ítem</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Período</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Fecha / Hora</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Notas</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Foto</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Tipo / Tamaño</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[#5F6773]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#2475C7]" />
                      <span>Cargando fotos...</span>
                    </div>
                  </td>
                </tr>
              ) : photos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[#5F6773]">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl">📷</span>
                      <p className="font-medium">No hay fotos con los filtros seleccionados</p>
                      <p className="text-sm">Prueba cambiando los filtros o agrega fotos durante el inventario.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                photos.map(photo => (
                  <tr
                    key={photo.id}
                    className="border-b border-[#9D9B9A] hover:bg-[#F2F3F5] transition-colors"
                  >
                    {/* Planta */}
                    <td className="px-4 py-3">
                      <p className="text-[#3B3A36] font-medium text-sm">{photo.plant_name}</p>
                    </td>

                    {/* Sección */}
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${SECTION_COLORS[photo.section] || 'bg-gray-100 text-gray-700'}`}>
                        {photo.section}
                      </span>
                    </td>

                    {/* Ítem */}
                    <td className="px-4 py-3 text-[#3B3A36] text-sm">
                      {photo.item_name}
                    </td>

                    {/* Período */}
                    <td className="px-4 py-3 text-[#3B3A36] text-sm whitespace-nowrap">
                      {formatPeriod(photo.year_month)}
                    </td>

                    {/* Fecha / Hora */}
                    <td className="px-4 py-3 text-[#5F6773] text-xs whitespace-nowrap">
                      {formatDateTime(photo.created_at)}
                    </td>

                    {/* Notas */}
                    <td className="px-4 py-3 max-w-[160px]">
                      {photo.notes ? (
                        <p className="text-[#5F6773] text-xs truncate" title={photo.notes}>
                          {photo.notes}
                        </p>
                      ) : (
                        <span className="text-[#9D9B9A] text-xs italic">Sin notas</span>
                      )}
                    </td>

                    {/* Foto thumbnail */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedPhoto(photo)}
                        className="inline-block rounded overflow-hidden hover:ring-2 hover:ring-[#2475C7] hover:ring-offset-1 transition-all focus:outline-none focus:ring-2 focus:ring-[#2475C7]"
                        title="Click para ver foto completa"
                        aria-label={`Ver foto: ${photo.section} - ${photo.item_name}`}
                      >
                        <img
                          src={photo.photo_url}
                          alt={`${photo.section} - ${photo.item_name}`}
                          className="w-12 h-12 object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = PLACEHOLDER_SVG;
                          }}
                        />
                      </button>
                    </td>

                    {/* Tipo / Tamaño */}
                    <td className="px-4 py-3">
                      <p className="text-xs text-[#5F6773]">{getPhotoType(photo.photo_url)}</p>
                      <p className="text-xs text-[#9D9B9A] mt-0.5">{getPhotoSize(photo)}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer with count */}
        {!loading && photos.length > 0 && (
          <div className="px-4 py-3 border-t border-[#9D9B9A] bg-[#F2F3F5]">
            <p className="text-xs text-[#5F6773]">
              Mostrando {photos.length} foto{photos.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </Card>

      {/* ── Lightbox Modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        title={selectedPhoto ? `${selectedPhoto.section} — ${selectedPhoto.item_name}` : ''}
        size="xl"
      >
        {selectedPhoto && (
          <div className="flex flex-col items-center gap-5">
            {/* Full-size image */}
            <div className="w-full flex justify-center bg-[#F2F3F5] rounded-lg p-2">
              <img
                src={selectedPhoto.photo_url}
                alt={`${selectedPhoto.section} - ${selectedPhoto.item_name}`}
                className="max-w-full max-h-[55vh] object-contain rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = PLACEHOLDER_SVG;
                }}
              />
            </div>

            {/* Metadata */}
            <div className="w-full space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#F2F3F5] rounded p-3">
                  <p className="text-xs text-[#9D9B9A] mb-1">Planta</p>
                  <p className="text-sm font-semibold text-[#3B3A36]">{selectedPhoto.plant_name}</p>
                </div>
                <div className="bg-[#F2F3F5] rounded p-3">
                  <p className="text-xs text-[#9D9B9A] mb-1">Sección</p>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${SECTION_COLORS[selectedPhoto.section] || 'bg-gray-100 text-gray-700'}`}>
                    {selectedPhoto.section}
                  </span>
                </div>
                <div className="bg-[#F2F3F5] rounded p-3">
                  <p className="text-xs text-[#9D9B9A] mb-1">Período</p>
                  <p className="text-sm font-semibold text-[#3B3A36]">{formatPeriod(selectedPhoto.year_month)}</p>
                </div>
                <div className="bg-[#F2F3F5] rounded p-3">
                  <p className="text-xs text-[#9D9B9A] mb-1">Fecha</p>
                  <p className="text-xs text-[#3B3A36]">{formatDateTime(selectedPhoto.created_at)}</p>
                </div>
              </div>

              {selectedPhoto.notes && (
                <div className="bg-[#fffbeb] border border-[#f59e0b] rounded p-3">
                  <p className="text-xs font-semibold text-[#b45309] mb-1">📝 Notas</p>
                  <p className="text-sm text-[#3B3A36]">{selectedPhoto.notes}</p>
                </div>
              )}

              {/* Open in new tab link */}
              {!selectedPhoto.photo_url.startsWith('data:') && (
                <div className="flex justify-end">
                  <a
                    href={selectedPhoto.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#2475C7] hover:underline flex items-center gap-1"
                  >
                    Abrir foto original ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
