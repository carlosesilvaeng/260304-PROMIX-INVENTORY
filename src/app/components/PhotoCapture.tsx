import React, { useRef, useState } from 'react';
import { Button } from './Button';
import { compressInventoryPhoto } from '../utils/imageCompression';

interface PhotoCaptureProps {
  label: string;
  required?: boolean;
  onPhotoCapture: (photo: string) => void;
  currentPhoto?: string;
  error?: string;
  compress?: boolean; // Default true - compress photos before callback
  compressionQuality?: 'high' | 'medium' | 'low'; // Default 'medium'
}

export function PhotoCapture({ 
  label, 
  required = false, 
  onPhotoCapture, 
  currentPhoto, 
  error,
  compress = true, // Enable compression by default
  compressionQuality = 'medium'
}: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | undefined>(currentPhoto);
  const [compressing, setCompressing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const result = reader.result as string;
          
          // Show preview immediately (uncompressed)
          setPreview(result);
          
          // Compress if enabled
          if (compress) {
            setCompressing(true);
            console.log('[PhotoCapture] Compressing photo...');
            
            try {
              const compressed = await compressInventoryPhoto(result);
              console.log('[PhotoCapture] Photo compressed successfully');
              onPhotoCapture(compressed);
            } catch (error) {
              console.error('[PhotoCapture] Compression failed, using original:', error);
              onPhotoCapture(result);
            } finally {
              setCompressing(false);
            }
          } else {
            // No compression
            onPhotoCapture(result);
          }
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('[PhotoCapture] Error reading file:', error);
      }
    }
  };

  const handleRemove = () => {
    setPreview(undefined);
    onPhotoCapture('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      <label className="block text-[#3B3A36] mb-2">
        {label}
        {required && <span className="text-[#C94A4A] ml-1">*</span>}
      </label>
      
      {/* COMPRESSION INDICATOR */}
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
      
      <div className="space-y-3">
        {preview ? (
          <div className="relative">
            <img 
              src={preview} 
              alt="Captura" 
              className="w-full h-48 object-cover rounded border-2 border-[#9D9B9A]"
            />
            <button
              onClick={handleRemove}
              disabled={compressing}
              className={`absolute top-2 right-2 bg-[#C94A4A] text-white p-2 rounded-full hover:bg-[#a03838] transition-colors ${
                compressing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
          </div>
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`
              w-full h-48 
              border-2 border-dashed rounded 
              flex flex-col items-center justify-center 
              cursor-pointer 
              transition-all
              ${error ? 'border-[#C94A4A] bg-[#fee]' : 'border-[#9D9B9A] bg-[#F2F3F5] hover:bg-[#e5e7eb]'}
            `}
          >
            <svg className="w-12 h-12 text-[#5F6773] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-[#5F6773]">Click para tomar/cargar foto</p>
            {compress && (
              <p className="text-xs text-[#5F6773] mt-2 px-4 text-center">
                💡 La imagen se optimizará automáticamente
              </p>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        disabled={compressing}
      />
      
      {error && (
        <p className="mt-2 text-sm text-[#C94A4A]">{error}</p>
      )}
    </div>
  );
}
