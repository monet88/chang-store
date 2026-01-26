import { ImageFile } from "../types";

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
