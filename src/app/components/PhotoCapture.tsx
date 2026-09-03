import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { withTimeout } from '../utils/withTimeout';
import { compressInventoryPhoto } from '../utils/imageCompression';
import { useAuth } from '../contexts/AuthContext';
import { projectId } from '/utils/supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server`;

interface PhotoCaptureProps {
  label: string;
  required?: boolean;
  onPhotoCapture: (photo: string) => void;
  currentPhoto?: string;
  error?: string;
  compress?: boolean; // Default true - compress photos before callback
  compressionQuality?: 'high' | 'medium' | 'low'; // Default 'medium'
  fit?: 'cover' | 'contain'; // Default 'contain' — show full image without cropping
}

export function PhotoCapture({
  label,
  required = false,
  onPhotoCapture,
  currentPhoto,
  error,
  compress = true, // Enable compression by default
  compressionQuality = 'medium',
  fit = 'contain'
}: PhotoCaptureProps) {
  const inputId = React.useId();
  const { accessToken, currentPlant } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | undefined>(currentPhoto);
  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const [photoMessage, setPhotoMessage] = useState('');
  const busy = compressing || uploading;
  const imageFitClass = fit === 'contain' ? 'object-contain bg-gray-100' : 'object-cover';

  useEffect(() => {
    setPreview(currentPhoto);
  }, [currentPhoto]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || busy) return;
    setPhotoMessage('');
    setCompressing(true);
    try {
      const result = await withTimeout((signal) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        signal.addEventListener('abort', () => reader.abort(), { once: true });
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('No se pudo leer la foto. Selecciónala nuevamente.'));
        reader.onabort = () => reject(new Error('La lectura de la foto se interrumpió. Intenta nuevamente.'));
        reader.readAsDataURL(file);
      }), 15000);

      let photo = result;
      if (compress) {
        photo = await withTimeout(() => compressInventoryPhoto(result), 20000);
      }
      setPreview(photo);
      setCompressing(false);
      if (compress) {
        setUploading(true);
        try {
          const json = await withTimeout(async (signal) => {
            const res = await fetch(`${API_BASE_URL}/photos/upload`, {
              method: 'POST',
              signal,
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ base64: photo, filename: file.name, plant_id: currentPlant?.id }),
            });
            if (!res.ok) throw new Error('No se pudo subir la foto.');
            return res.json();
          }, 30000);
          if (!json.success || !json.url) throw new Error('No se pudo subir la foto.');
          onPhotoCapture(json.url);
        } catch {
          // Keep the compressed evidence in the draft when storage is unavailable.
          onPhotoCapture(photo);
          setPhotoMessage('La subida no terminó. La foto está en el borrador; pulsa Guardar para conservarla antes de salir.');
        }
      } else {
        onPhotoCapture(photo);
      }
    } catch (error) {
      setPreview(currentPhoto);
      setPhotoMessage(error instanceof Error ? error.message : 'No se pudo procesar la foto. Intenta nuevamente.');
    } finally {
      setCompressing(false);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    setPhotoMessage('');
    setPreview(undefined);
    setExpanded(false);
    onPhotoCapture('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="block text-[#3B3A36] mb-2">
        {label}
        {required && <span className="text-[#C94A4A] ml-1">*</span>}
      </label>

      {/* STATUS INDICATORS */}
      {compressing && (
        <div className="mb-3 bg-blue-50 border border-blue-300 rounded p-3">
          <div className="flex items-center gap-2">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[#2475C7]"></div>
            <p className="text-sm text-[#2475C7] font-semibold">
              🖼️ Optimizando imagen... Por favor espera
            </p>
          </div>
        </div>
      )}
      {uploading && (
        <div className="mb-3 bg-green-50 border border-green-300 rounded p-3">
          <div className="flex items-center gap-2">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[#2ecc71]"></div>
            <p className="text-sm text-[#27ae60] font-semibold">
              ☁️ Subiendo foto... Por favor espera
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Captura"
              className={`w-full h-48 ${imageFitClass} rounded border-2 border-[#9D9B9A]`}
            />
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              title="Eliminar foto"
              aria-label="Eliminar foto"
              className={`absolute top-2 right-2 bg-[#C94A4A] text-white p-2 rounded-full hover:bg-[#a03838] transition-colors ${
                busy ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              disabled={busy}
              title="Ampliar foto"
              aria-label="Ampliar foto"
              className={`absolute bottom-2 right-2 bg-[#2475C7] text-white p-2 rounded-full shadow hover:bg-[#1d5fa1] transition-colors ${
                busy ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
              </svg>
            </button>
            {compressing && (
              <div className="absolute inset-0 bg-black/20 rounded flex items-center justify-center">
                <div className="bg-white rounded-lg p-4 shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#2475C7]"></div>
                    <p className="text-sm text-[#2475C7] font-semibold">Optimizando...</p>
                  </div>
                </div>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/20 rounded flex items-center justify-center">
                <div className="bg-white rounded-lg p-4 shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#2ecc71]"></div>
                    <p className="text-sm text-[#27ae60] font-semibold">Subiendo foto...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => !busy && fileInputRef.current?.click()}
            disabled={busy}
            aria-label={`${label}. Toca para tomar o cargar una foto`}
            className={`
              w-full h-48
              border-2 border-dashed rounded
              flex flex-col items-center justify-center
              transition-all
              ${busy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
              ${error ? 'border-[#C94A4A] bg-[#fee]' : 'border-[#9D9B9A] bg-[#F2F3F5] hover:bg-[#e5e7eb]'}
            `}
          >
            <svg className="w-12 h-12 text-[#5F6773] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-[#5F6773]">Toca para tomar o cargar una foto</p>
            {compress && (
              <p className="text-xs text-[#5F6773] mt-2 px-4 text-center">
                💡 La imagen se optimizará. Pulsa Guardar al terminar la sección.
              </p>
            )}
          </button>
        )}
      </div>

      <input
        id={inputId}
        aria-label={label}
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={busy}
      />

      {photoMessage && <p role="status" className="mt-2 text-sm text-amber-700">{photoMessage}</p>}
      {error && (
        <p className="mt-2 text-sm text-[#C94A4A]">{error}</p>
      )}

      {expanded && preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => setExpanded(false)}
            aria-label="Cerrar foto ampliada"
          />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-6xl items-center justify-center">
            <img
              src={preview}
              alt="Captura ampliada"
              className="max-h-[92vh] max-w-full rounded bg-white object-contain"
            />
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="absolute right-3 top-3 rounded-full bg-[#C94A4A] p-2 text-white shadow hover:bg-[#a03838] transition-colors"
              title="Cerrar"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
