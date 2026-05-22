import { ImageFile, MarkerPosition } from "../types";

/**
 * Allowed MIME types for image uploads
 */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Maximum upload file size: 20 MB
 */
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

/**
 * Magic byte signatures for supported image formats
 */
const MAGIC_BYTES = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF
} as const;

/**
 * Validation result for image file uploads
 */
export interface ImageValidationResult {
  readonly isValid: boolean;
  readonly errorKey?: string;
  readonly errorParams?: Record<string, any>;
}

/**
 * Validate file size, MIME type, and magic bytes for image uploads.
 * Rejects SVG, unknown MIME types, oversized files, and signature mismatches.
 */
export const validateImageFile = async (file: File): Promise<ImageValidationResult> => {
  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      errorKey: 'error.upload.fileTooLarge',
      errorParams: { maxSize: '20MB' },
    };
  }

  // Check MIME type allowlist
  if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
    return {
      isValid: false,
      errorKey: 'error.upload.unsupportedType',
      errorParams: { type: file.type || 'unknown' },
    };
  }

  // Read magic bytes to verify file signature
  try {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const isJpeg = bytes[0] === MAGIC_BYTES.jpeg[0] &&
                   bytes[1] === MAGIC_BYTES.jpeg[1] &&
                   bytes[2] === MAGIC_BYTES.jpeg[2];

    const isPng = bytes[0] === MAGIC_BYTES.png[0] &&
                  bytes[1] === MAGIC_BYTES.png[1] &&
                  bytes[2] === MAGIC_BYTES.png[2] &&
                  bytes[3] === MAGIC_BYTES.png[3];

    const isWebp = bytes[0] === MAGIC_BYTES.webp[0] &&
                   bytes[1] === MAGIC_BYTES.webp[1] &&
                   bytes[2] === MAGIC_BYTES.webp[2] &&
                   bytes[3] === MAGIC_BYTES.webp[3] &&
                   bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;

    if (!isJpeg && !isPng && !isWebp) {
      return {
        isValid: false,
        errorKey: 'error.upload.invalidSignature',
      };
    }
  } catch (error) {
    return {
      isValid: false,
      errorKey: 'error.upload.invalidSignature',
    };
  }

  return { isValid: true };
};

export const getImageDimensions = (base64: string, mimeType: string): Promise<{ width: number, height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = (err) => {
      console.error("Failed to load image for dimension check", err);
      reject(new Error("Could not determine image dimensions."));
    };
    img.src = `data:${mimeType};base64,${base64}`;
  });
};


export const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            } else {
                reject(new Error("Failed to read blob as Base64 string."));
            }
        };
        reader.onerror = (error) => {
            reject(error);
        };
        reader.readAsDataURL(blob);
    });
};

export const getErrorMessage = (error: unknown, t: (key: string, options?: any) => any): string => {
    const rawMessage = error instanceof Error ? error.message : 'error.unknown';
    
    if (rawMessage.startsWith('error.api.textOnlyResponse:')) {
        const reason = rawMessage.substring('error.api.textOnlyResponse:'.length);
        return t('error.api.textOnlyResponse', { reason });
    }
    if (rawMessage.startsWith('error.api.geminiFailed:')) {
        const reason = rawMessage.substring('error.api.geminiFailed:'.length);
        return t('error.api.geminiFailed', { error: reason });
    }

    return t(rawMessage, { default: rawMessage });
};

export const compressImage = (file: File, quality: number = 0.8): Promise<ImageFile> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        return reject(new Error("Could not get canvas context"));
      }
      
      const maxWidth = 1920;
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxWidth) {
        if (width > height) {
            const ratio = maxWidth / width;
            width = maxWidth;
            height *= ratio;
        } else {
            const ratio = maxWidth / height;
            height = maxWidth;
            width *= ratio;
        }
      }
      
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const compressedBase64 = dataUrl.split(',')[1];
      
      resolve({
        base64: compressedBase64,
        mimeType: 'image/jpeg'
      });
      URL.revokeObjectURL(objectUrl);
    };
    
    img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
    }
    
    img.src = objectUrl;
  });
};

export const cropAndCompressImage = (file: File, targetAspectRatio: number, quality: number = 0.8, maxWidth: number = 1080): Promise<ImageFile> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        return reject(new Error("Could not get canvas context"));
      }

      const originalWidth = img.width;
      const originalHeight = img.height;
      const originalAspectRatio = originalWidth / originalHeight;

      let sx = 0, sy = 0, sw = originalWidth, sh = originalHeight;

      if (originalAspectRatio > targetAspectRatio) {
        // Image is wider than target, crop the sides (center crop)
        sw = originalHeight * targetAspectRatio;
        sx = (originalWidth - sw) / 2;
      } else if (originalAspectRatio < targetAspectRatio) {
        // Image is taller than target, crop top and bottom (center crop)
        sh = originalWidth / targetAspectRatio;
        sy = (originalHeight - sh) / 2;
      }
      
      const targetHeight = Math.round(maxWidth / targetAspectRatio);
      canvas.width = maxWidth;
      canvas.height = targetHeight;
      
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const compressedBase64 = dataUrl.split(',')[1];
      
      resolve({
        base64: compressedBase64,
        mimeType: 'image/jpeg'
      });
      URL.revokeObjectURL(objectUrl);
    };
    
    img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
    }
    
    img.src = objectUrl;
  });
};

export const compositeMarkerOnImage = (image: ImageFile, marker: MarkerPosition): Promise<ImageFile> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }
      
      ctx.drawImage(img, 0, 0);
      
      const x = marker.relX * img.width;
      const y = marker.relY * img.height;
      
      const maxDim = Math.max(img.width, img.height);
      const radius = Math.min(Math.max(maxDim * 0.015, 10), 40);
      
      // Draw white outline
      ctx.beginPath();
      ctx.arc(x, y, radius + 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      
      // Draw red inner dot
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#EF4444';
      ctx.fill();

      // Ensure mimeType fallback since some test cases might lack it
      const mimeType = image.mimeType || 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, 0.95);
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mimeType });
    };
    img.onerror = () => reject(new Error('Failed to composite marker image'));
    img.src = `data:${image.mimeType || 'image/jpeg'};base64,${image.base64}`;
  });
};
