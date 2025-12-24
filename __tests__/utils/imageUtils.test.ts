/**
 * Unit Tests for imageUtils.ts
 *
 * Tests utility functions for image processing:
 * - getImageDimensions: Extract dimensions from base64 image
 * - blobToBase64: Convert Blob to base64 string
 * - getErrorMessage: Translate error messages with API-specific patterns
 *
 * Canvas-heavy functions (compressImage, cropAndCompressImage) are excluded
 * as they require extensive DOM/Canvas mocking with minimal ROI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getImageDimensions, blobToBase64, getErrorMessage } from '@/utils/imageUtils';

// ============================================================================
// Mock Translation Function
// ============================================================================

/**
 * Creates a mock translation function that interpolates options into the key.
 * Mimics i18n behavior for testing purposes.
 */
const createMockT = () => {
  return vi.fn((key: string, options?: Record<string, unknown>) => {
    if (options?.default !== undefined) {
      return options.default as string;
    }
    if (options?.reason) {
      return `${key}:${options.reason}`;
    }
    if (options?.error) {
      return `${key}:${options.error}`;
    }
    return key;
  });
};

// ============================================================================
// getErrorMessage Tests
// ============================================================================

describe('getErrorMessage', () => {
  let mockT: ReturnType<typeof createMockT>;

  beforeEach(() => {
    mockT = createMockT();
  });

  describe('standard Error objects', () => {
    it('should translate simple error message key', () => {
      const error = new Error('error.network.timeout');
      const result = getErrorMessage(error, mockT);

      expect(mockT).toHaveBeenCalledWith('error.network.timeout', {
        default: 'error.network.timeout',
      });
      expect(result).toBe('error.network.timeout');
    });

    it('should return raw message as default when key not found', () => {
      const error = new Error('Some raw error message');
      const result = getErrorMessage(error, mockT);

      expect(mockT).toHaveBeenCalledWith('Some raw error message', {
        default: 'Some raw error message',
      });
      expect(result).toBe('Some raw error message');
    });
  });

  describe('API-specific error patterns', () => {
    it('should extract reason from error.api.textOnlyResponse pattern', () => {
      const error = new Error('error.api.textOnlyResponse:Model returned text instead of image');
      const result = getErrorMessage(error, mockT);

      expect(mockT).toHaveBeenCalledWith('error.api.textOnlyResponse', {
        reason: 'Model returned text instead of image',
      });
      expect(result).toBe('error.api.textOnlyResponse:Model returned text instead of image');
    });

    it('should extract reason from error.api.geminiFailed pattern', () => {
      const error = new Error('error.api.geminiFailed:Rate limit exceeded');
      const result = getErrorMessage(error, mockT);

      expect(mockT).toHaveBeenCalledWith('error.api.geminiFailed', {
        error: 'Rate limit exceeded',
      });
      expect(result).toBe('error.api.geminiFailed:Rate limit exceeded');
    });

    it('should extract reason from error.api.aivideoautoFailed pattern', () => {
      const error = new Error('error.api.aivideoautoFailed:Invalid API token');
      const result = getErrorMessage(error, mockT);

      expect(mockT).toHaveBeenCalledWith('error.api.aivideoautoFailed', {
        error: 'Invalid API token',
      });
      expect(result).toBe('error.api.aivideoautoFailed:Invalid API token');
    });

    it('should handle empty reason after colon', () => {
      const error = new Error('error.api.textOnlyResponse:');
      const result = getErrorMessage(error, mockT);

      expect(mockT).toHaveBeenCalledWith('error.api.textOnlyResponse', {
        reason: '',
      });
    });

    it('should handle reason with multiple colons', () => {
      const error = new Error('error.api.geminiFailed:Error: Connection: timeout');
      const result = getErrorMessage(error, mockT);

      expect(mockT).toHaveBeenCalledWith('error.api.geminiFailed', {
        error: 'Error: Connection: timeout',
      });
    });
  });

  describe('non-Error objects', () => {
    it('should return error.unknown for null', () => {
      const result = getErrorMessage(null, mockT);

      expect(mockT).toHaveBeenCalledWith('error.unknown', {
        default: 'error.unknown',
      });
      expect(result).toBe('error.unknown');
    });

    it('should return error.unknown for undefined', () => {
      const result = getErrorMessage(undefined, mockT);

      expect(mockT).toHaveBeenCalledWith('error.unknown', {
        default: 'error.unknown',
      });
      expect(result).toBe('error.unknown');
    });

    it('should return error.unknown for string', () => {
      const result = getErrorMessage('some string error', mockT);

      expect(mockT).toHaveBeenCalledWith('error.unknown', {
        default: 'error.unknown',
      });
      expect(result).toBe('error.unknown');
    });

    it('should return error.unknown for number', () => {
      const result = getErrorMessage(404, mockT);

      expect(mockT).toHaveBeenCalledWith('error.unknown', {
        default: 'error.unknown',
      });
      expect(result).toBe('error.unknown');
    });

    it('should return error.unknown for plain object', () => {
      const result = getErrorMessage({ message: 'error' }, mockT);

      expect(mockT).toHaveBeenCalledWith('error.unknown', {
        default: 'error.unknown',
      });
      expect(result).toBe('error.unknown');
    });
  });
});

// ============================================================================
// blobToBase64 Tests
// ============================================================================

describe('blobToBase64', () => {
  /** Original FileReader for restoration after tests */
  const OriginalFileReader = global.FileReader;

  afterEach(() => {
    // Restore original FileReader
    global.FileReader = OriginalFileReader;
  });

  /**
   * Creates a mock FileReader class that can be used as constructor.
   * @param mockResult - The result value to set after readAsDataURL
   * @param shouldError - If true, triggers onerror instead of onloadend
   */
  const createMockFileReaderClass = (
    mockResult: string | ArrayBuffer | null,
    shouldError: boolean = false,
    errorValue: unknown = new Error('FileReader error')
  ) => {
    return class MockFileReader {
      result: string | ArrayBuffer | null = mockResult;
      onloadend: (() => void) | null = null;
      onerror: ((error: unknown) => void) | null = null;

      readAsDataURL = vi.fn(() => {
        setTimeout(() => {
          if (shouldError && this.onerror) {
            this.onerror(errorValue);
          } else if (this.onloadend) {
            this.onloadend();
          }
        }, 0);
      });
    };
  };

  it('should convert blob to base64 string', async () => {
    const mockBase64 = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64
    const mockDataUrl = `data:text/plain;base64,${mockBase64}`;

    global.FileReader = createMockFileReaderClass(mockDataUrl) as unknown as typeof FileReader;

    const blob = new Blob(['Hello World'], { type: 'text/plain' });
    const result = await blobToBase64(blob);

    expect(result).toBe(mockBase64);
  });

  it('should handle image blob correctly', async () => {
    const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ';
    const mockDataUrl = `data:image/png;base64,${imageBase64}`;

    global.FileReader = createMockFileReaderClass(mockDataUrl) as unknown as typeof FileReader;

    const blob = new Blob(['fake image data'], { type: 'image/png' });
    const result = await blobToBase64(blob);

    expect(result).toBe(imageBase64);
  });

  it('should reject when result is not a string', async () => {
    global.FileReader = createMockFileReaderClass(null) as unknown as typeof FileReader;

    const blob = new Blob(['test'], { type: 'text/plain' });

    await expect(blobToBase64(blob)).rejects.toThrow(
      'Failed to read blob as Base64 string.'
    );
  });

  it('should reject when FileReader encounters an error', async () => {
    const mockError = new Error('FileReader error');
    global.FileReader = createMockFileReaderClass(null, true, mockError) as unknown as typeof FileReader;

    const blob = new Blob(['test'], { type: 'text/plain' });

    await expect(blobToBase64(blob)).rejects.toThrow('FileReader error');
  });

  it('should handle ArrayBuffer result as rejection', async () => {
    global.FileReader = createMockFileReaderClass(new ArrayBuffer(8)) as unknown as typeof FileReader;

    const blob = new Blob(['test'], { type: 'text/plain' });

    await expect(blobToBase64(blob)).rejects.toThrow(
      'Failed to read blob as Base64 string.'
    );
  });
});

// ============================================================================
// getImageDimensions Tests
// ============================================================================

describe('getImageDimensions', () => {
  /** Original Image constructor for restoration */
  const OriginalImage = global.Image;

  afterEach(() => {
    global.Image = OriginalImage;
    vi.restoreAllMocks();
  });

  /**
   * Creates a mock Image class that can be used as constructor.
   * @param width - The mock image width
   * @param height - The mock image height
   * @param shouldError - If true, triggers onerror instead of onload
   */
  const createMockImageClass = (
    width: number,
    height: number,
    shouldError: boolean = false
  ) => {
    return class MockImage {
      width = width;
      height = height;
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      private _src = '';

      get src() {
        return this._src;
      }

      set src(value: string) {
        this._src = value;
        // Trigger load/error asynchronously after src is set
        setTimeout(() => {
          if (shouldError && this.onerror) {
            this.onerror(new Error('Load failed'));
          } else if (this.onload) {
            this.onload();
          }
        }, 0);
      }
    };
  };

  it('should resolve with image dimensions on successful load', async () => {
    global.Image = createMockImageClass(800, 600) as unknown as typeof Image;

    const result = await getImageDimensions('fakeBase64', 'image/png');

    expect(result).toEqual({ width: 800, height: 600 });
  });

  it('should set correct src data URL', async () => {
    let capturedSrc = '';
    class MockImage {
      width = 100;
      height = 100;
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      private _src = '';

      get src() {
        return this._src;
      }

      set src(value: string) {
        this._src = value;
        capturedSrc = value;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }

    global.Image = MockImage as unknown as typeof Image;

    await getImageDimensions('testBase64Data', 'image/jpeg');

    expect(capturedSrc).toBe('data:image/jpeg;base64,testBase64Data');
  });

  it('should handle different image dimensions', async () => {
    global.Image = createMockImageClass(1920, 1080) as unknown as typeof Image;

    const result = await getImageDimensions('base64data', 'image/jpeg');

    expect(result).toEqual({ width: 1920, height: 1080 });
  });

  it('should reject with error when image fails to load', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.Image = createMockImageClass(0, 0, true) as unknown as typeof Image;

    await expect(getImageDimensions('invalidBase64', 'image/png')).rejects.toThrow(
      'Could not determine image dimensions.'
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to load image for dimension check',
      expect.any(Error)
    );
  });

  it('should handle square images', async () => {
    global.Image = createMockImageClass(512, 512) as unknown as typeof Image;

    const result = await getImageDimensions('squareImage', 'image/webp');

    expect(result).toEqual({ width: 512, height: 512 });
  });

  it('should handle portrait orientation images', async () => {
    global.Image = createMockImageClass(720, 1280) as unknown as typeof Image;

    const result = await getImageDimensions('portraitBase64', 'image/jpeg');

    expect(result).toEqual({ width: 720, height: 1280 });
  });

  it('should handle very small images', async () => {
    global.Image = createMockImageClass(1, 1) as unknown as typeof Image;

    const result = await getImageDimensions('tinyImage', 'image/gif');

    expect(result).toEqual({ width: 1, height: 1 });
  });

  it('should handle very large images', async () => {
    global.Image = createMockImageClass(8192, 8192) as unknown as typeof Image;

    const result = await getImageDimensions('largeImage', 'image/png');

    expect(result).toEqual({ width: 8192, height: 8192 });
  });
});
