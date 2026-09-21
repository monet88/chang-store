import { AspectRatio, ImageFile, IMAGE_ASPECT_RATIOS } from '../types';

/**
 * Fast synchronous dimension extractor from base64 image headers.
 * Extracts PNG/JPEG dimensions without waiting for DOM Image or jsdom load event.
 */
export const extractDimensionsFromHeader = (base64: string): { width: number; height: number } | null => {
  try {
    if (typeof atob !== 'function') return null;
    const binary = atob(base64.slice(0, 512));
    // PNG signature: \x89PNG
    if (binary.charCodeAt(0) === 0x89 && binary.charCodeAt(1) === 0x50 && binary.length >= 24) {
      const b16 = binary.charCodeAt(16);
      const b17 = binary.charCodeAt(17);
      const b18 = binary.charCodeAt(18);
      const b19 = binary.charCodeAt(19);
      const width = ((b16 << 24) >>> 0) + (b17 << 16) + (b18 << 8) + b19;
      const b20 = binary.charCodeAt(20);
      const b21 = binary.charCodeAt(21);
      const b22 = binary.charCodeAt(22);
      const b23 = binary.charCodeAt(23);
      const height = ((b20 << 24) >>> 0) + (b21 << 16) + (b22 << 8) + b23;
      if (width > 0 && height > 0) return { width, height };
    }
    // JPEG signature: \xFF\xD8
    if (binary.charCodeAt(0) === 0xFF && binary.charCodeAt(1) === 0xD8) {
      let offset = 2;
      while (offset < binary.length - 8) {
        if (binary.charCodeAt(offset) !== 0xFF) {
          offset++;
          continue;
        }
        const marker = binary.charCodeAt(offset + 1);
        if (marker >= 0xC0 && marker <= 0xC2) {
          const height = (binary.charCodeAt(offset + 5) << 8) | binary.charCodeAt(offset + 6);
          const width = (binary.charCodeAt(offset + 7) << 8) | binary.charCodeAt(offset + 8);
          if (width > 0 && height > 0) return { width, height };
          break;
        }
        const length = (binary.charCodeAt(offset + 2) << 8) | binary.charCodeAt(offset + 3);
        if (length <= 0) break;
        offset += 2 + length;
      }
    }
  } catch {
    // Fall back to Image element or default
  }
  return null;
};

const ASPECT_RATIO_TARGETS: Record<typeof IMAGE_ASPECT_RATIOS[number], number> = {
  '1:1': 1,
  '3:4': 3 / 4,
  '4:3': 4 / 3,
  '9:16': 9 / 16,
  '16:9': 16 / 9,
};

/**
 * Calculates the closest supported AspectRatio given image pixel dimensions.
 */
export const detectClosestAspectRatio = (width: number, height: number): AspectRatio => {
  if (!width || !height || width <= 0 || height <= 0) {
    return '3:4';
  }
  const ratio = width / height;
  let closestRatio: AspectRatio = '3:4';
  let minDiff = Infinity;

  for (const [key, target] of Object.entries(ASPECT_RATIO_TARGETS)) {
    const diff = Math.abs(Math.log(ratio / target));
    if (diff < minDiff) {
      minDiff = diff;
      closestRatio = key as AspectRatio;
    }
  }

  return closestRatio;
};

/**
 * Detects the closest supported AspectRatio for an uploaded image.
 */
export const detectImageAspectRatio = async (
  image: ImageFile | null | undefined,
  fallback: AspectRatio = '3:4',
): Promise<AspectRatio> => {
  if (!image?.base64) return fallback;
  const headerDims = extractDimensionsFromHeader(image.base64);
  if (headerDims) {
    return detectClosestAspectRatio(headerDims.width, headerDims.height);
  }
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(fallback);
      return;
    }
    const img = new Image();
    img.onload = () => {
      resolve(detectClosestAspectRatio(img.width, img.height));
    };
    img.onerror = () => {
      resolve(fallback);
    };
    img.src = `data:${image.mimeType};base64,${image.base64}`;
  });
};
