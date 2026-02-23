/**
 * Image compression utility for optimizing photos before upload
 * Reduces file size and dimensions for better storage and performance
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 to 1.0
  mimeType?: string; // 'image/jpeg' or 'image/webp'
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.8,
  mimeType: 'image/jpeg',
};

/**
 * Compresses an image file or base64 string
 * @param input - File object or base64 string
 * @param options - Compression options
 * @returns Promise<string> - Compressed image as base64 string
 */
export async function compressImage(
  input: File | string,
  options: CompressionOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Load image
    const img = await loadImage(input);
    
    // Calculate new dimensions
    const { width, height } = calculateDimensions(
      img.width,
      img.height,
      opts.maxWidth!,
      opts.maxHeight!
    );

    // Create canvas and draw resized image
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw image
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to base64 with compression
    const compressedBase64 = canvas.toDataURL(opts.mimeType!, opts.quality);

    console.log('[ImageCompression] Original size:', getBase64Size(input), 'KB');
    console.log('[ImageCompression] Compressed size:', getBase64Size(compressedBase64), 'KB');
    console.log('[ImageCompression] Dimensions:', `${img.width}x${img.height} → ${width}x${height}`);

    return compressedBase64;
  } catch (error) {
    console.error('[ImageCompression] Error:', error);
    // If compression fails, return original (if string) or throw
    if (typeof input === 'string') {
      return input;
    }
    throw error;
  }
}

/**
 * Loads an image from File or base64 string
 */
function loadImage(input: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));

    if (input instanceof File) {
      // Convert File to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(input);
    } else {
      // Use base64 string directly
      img.src = input;
    }
  });
}

/**
 * Calculates new dimensions maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  // Check if resize is needed
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  // Calculate aspect ratio
  const aspectRatio = width / height;

  if (width > height) {
    // Landscape
    if (width > maxWidth) {
      width = maxWidth;
      height = Math.round(width / aspectRatio);
    }
  } else {
    // Portrait or square
    if (height > maxHeight) {
      height = maxHeight;
      width = Math.round(height * aspectRatio);
    }
  }

  // Double-check both dimensions
  if (width > maxWidth) {
    width = maxWidth;
    height = Math.round(width / aspectRatio);
  }
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * aspectRatio);
  }

  return { width, height };
}

/**
 * Gets the size of a base64 string in KB
 */
function getBase64Size(input: File | string): number {
  if (input instanceof File) {
    return Math.round(input.size / 1024);
  }
  
  // Remove data:image/...;base64, prefix
  const base64 = input.split(',')[1] || input;
  
  // Calculate size: base64 uses 4 chars for 3 bytes
  // So: (length * 3/4) / 1024 = KB
  const bytes = (base64.length * 3) / 4;
  return Math.round(bytes / 1024);
}

/**
 * Compresses image specifically for petty cash evidence
 * Uses moderate compression suitable for documents/receipts
 */
export async function compressPettyCashPhoto(input: File | string): Promise<string> {
  return compressImage(input, {
    maxWidth: 1600,
    maxHeight: 1200,
    quality: 0.85,
    mimeType: 'image/jpeg',
  });
}

/**
 * Compresses image for general inventory photos
 * Uses standard compression
 */
export async function compressInventoryPhoto(input: File | string): Promise<string> {
  return compressImage(input, {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8,
    mimeType: 'image/jpeg',
  });
}

/**
 * Compresses image for thumbnails
 * Uses aggressive compression
 */
export async function compressThumbnail(input: File | string): Promise<string> {
  return compressImage(input, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.7,
    mimeType: 'image/jpeg',
  });
}
