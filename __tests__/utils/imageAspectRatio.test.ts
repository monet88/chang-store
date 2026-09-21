import { describe, it, expect } from 'vitest';
import {
  detectClosestAspectRatio,
  detectImageAspectRatio,
  extractDimensionsFromHeader,
} from '@/utils/imageAspectRatio';

describe('imageAspectRatio', () => {
  describe('detectClosestAspectRatio', () => {
    it('detects 1:1 for square or near-square images', () => {
      expect(detectClosestAspectRatio(1000, 1000)).toBe('1:1');
      expect(detectClosestAspectRatio(924, 925)).toBe('1:1');
      expect(detectClosestAspectRatio(1080, 1079)).toBe('1:1');
    });

    it('detects 3:4 for portrait catalog images', () => {
      expect(detectClosestAspectRatio(750, 1000)).toBe('3:4');
      expect(detectClosestAspectRatio(850, 1135)).toBe('3:4');
      expect(detectClosestAspectRatio(1080, 1440)).toBe('3:4');
    });

    it('detects 4:3 for standard landscape images', () => {
      expect(detectClosestAspectRatio(1000, 750)).toBe('4:3');
      expect(detectClosestAspectRatio(800, 600)).toBe('4:3');
      expect(detectClosestAspectRatio(1200, 900)).toBe('4:3');
    });

    it('detects 9:16 for smartphone vertical images', () => {
      expect(detectClosestAspectRatio(1080, 1920)).toBe('9:16');
      expect(detectClosestAspectRatio(720, 1280)).toBe('9:16');
    });

    it('detects 16:9 for widescreen landscape images', () => {
      expect(detectClosestAspectRatio(1920, 1080)).toBe('16:9');
      expect(detectClosestAspectRatio(1280, 720)).toBe('16:9');
    });

    it('returns default 3:4 for invalid or zero dimensions', () => {
      expect(detectClosestAspectRatio(0, 0)).toBe('3:4');
      expect(detectClosestAspectRatio(-100, 500)).toBe('3:4');
    });
  });

  describe('extractDimensionsFromHeader', () => {
    it('extracts dimensions from PNG base64 header', () => {
      // 1x1 transparent PNG
      const png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const dims = extractDimensionsFromHeader(png1x1);
      expect(dims).toEqual({ width: 1, height: 1 });
    });

    it('returns null for non-image or corrupted data', () => {
      expect(extractDimensionsFromHeader('bm90YW5pbWFnZQ==')).toBeNull();
    });
  });

  describe('detectImageAspectRatio', () => {
    it('returns fallback for null or undefined input', async () => {
      expect(await detectImageAspectRatio(null)).toBe('3:4');
      expect(await detectImageAspectRatio(undefined, '16:9')).toBe('16:9');
    });

    it('detects 1:1 from a square PNG image', async () => {
      const png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const ratio = await detectImageAspectRatio({ base64: png1x1, mimeType: 'image/png' });
      expect(ratio).toBe('1:1');
    });
  });
});
