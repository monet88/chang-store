import { describe, it, expect } from 'vitest';
import {
  computeLetterboxBounds,
  calculateLetterboxedMarkerCoordinates,
} from '@/utils/imageUtils';

describe('Letterbox / Pillarbox marker coordinate calculation', () => {
  const containerWidth = 300;
  const containerHeight = 400; // 3:4 aspect ratio (0.75)

  describe('computeLetterboxBounds', () => {
    it('calculates letterbox margins for 1:1 square image (wider than 3:4)', () => {
      const bounds = computeLetterboxBounds(containerWidth, containerHeight, 1000, 1000);
      expect(bounds.width).toBe(300);
      expect(bounds.height).toBe(300);
      expect(bounds.left).toBe(0);
      expect(bounds.top).toBe(50);
    });

    it('calculates letterbox margins for 16:9 landscape image', () => {
      const bounds = computeLetterboxBounds(containerWidth, containerHeight, 1600, 900);
      expect(bounds.width).toBe(300);
      expect(bounds.height).toBeCloseTo(168.75);
      expect(bounds.left).toBe(0);
      expect(bounds.top).toBeCloseTo((400 - 168.75) / 2);
    });

    it('calculates pillarbox margins for 9:16 portrait image (taller than 3:4)', () => {
      const bounds = computeLetterboxBounds(containerWidth, containerHeight, 900, 1600);
      expect(bounds.height).toBe(400);
      expect(bounds.width).toBeCloseTo(225);
      expect(bounds.left).toBeCloseTo(37.5);
      expect(bounds.top).toBe(0);
    });

    it('calculates letterbox margins for 4:5 image', () => {
      const bounds = computeLetterboxBounds(containerWidth, containerHeight, 800, 1000);
      expect(bounds.width).toBe(300);
      expect(bounds.height).toBe(375);
      expect(bounds.left).toBe(0);
      expect(bounds.top).toBe(12.5);
    });

    it('has zero margins when image aspect matches container (3:4)', () => {
      const bounds = computeLetterboxBounds(containerWidth, containerHeight, 3000, 4000);
      expect(bounds.width).toBe(300);
      expect(bounds.height).toBe(400);
      expect(bounds.left).toBe(0);
      expect(bounds.top).toBe(0);
    });

    it('handles zero or invalid dimensions gracefully without throwing', () => {
      const bounds = computeLetterboxBounds(0, 0, 0, 0);
      expect(bounds.width).toBe(0);
      expect(bounds.height).toBe(0);
      expect(bounds.left).toBe(0);
      expect(bounds.top).toBe(0);
    });
  });

  describe('calculateLetterboxedMarkerCoordinates', () => {
    it('normalizes center click accurately on 1:1 image', () => {
      const coords = calculateLetterboxedMarkerCoordinates({
        clickX: 150,
        clickY: 200, // exact center of container
        containerWidth,
        containerHeight,
        naturalWidth: 1000,
        naturalHeight: 1000,
      });

      expect(coords.relX).toBe(0.5);
      expect(coords.relY).toBe(0.5);
      expect(coords.x).toBe(150);
      expect(coords.y).toBe(200);
    });

    it('clamps clicks on top letterbox margin to top edge of 1:1 image', () => {
      const coords = calculateLetterboxedMarkerCoordinates({
        clickX: 150,
        clickY: 10, // within the top 50px letterbox margin
        containerWidth,
        containerHeight,
        naturalWidth: 1000,
        naturalHeight: 1000,
      });

      expect(coords.relX).toBe(0.5);
      expect(coords.relY).toBe(0);
      expect(coords.x).toBe(150);
      expect(coords.y).toBe(50); // clamped to top of rendered image
    });

    it('clamps clicks on bottom letterbox margin to bottom edge of 1:1 image', () => {
      const coords = calculateLetterboxedMarkerCoordinates({
        clickX: 150,
        clickY: 390, // within the bottom 50px letterbox margin
        containerWidth,
        containerHeight,
        naturalWidth: 1000,
        naturalHeight: 1000,
      });

      expect(coords.relX).toBe(0.5);
      expect(coords.relY).toBe(1);
      expect(coords.x).toBe(150);
      expect(coords.y).toBe(350); // clamped to bottom of rendered image
    });

    it('clamps clicks on left pillarbox margin to left edge of 9:16 image', () => {
      const coords = calculateLetterboxedMarkerCoordinates({
        clickX: 10, // within left 37.5px pillarbox margin
        clickY: 200,
        containerWidth,
        containerHeight,
        naturalWidth: 900,
        naturalHeight: 1600,
      });

      expect(coords.relX).toBe(0);
      expect(coords.relY).toBe(0.5);
      expect(coords.x).toBeCloseTo(37.5);
      expect(coords.y).toBe(200);
    });

    it('clamps clicks on right pillarbox margin to right edge of 9:16 image', () => {
      const coords = calculateLetterboxedMarkerCoordinates({
        clickX: 295, // within right pillarbox margin (262.5px to 300px)
        clickY: 200,
        containerWidth,
        containerHeight,
        naturalWidth: 900,
        naturalHeight: 1600,
      });

      expect(coords.relX).toBe(1);
      expect(coords.relY).toBe(0.5);
      expect(coords.x).toBeCloseTo(262.5);
      expect(coords.y).toBe(200);
    });

    it('normalizes 16:9 landscape image correctly', () => {
      const coords = calculateLetterboxedMarkerCoordinates({
        clickX: 150,
        clickY: 200,
        containerWidth,
        containerHeight,
        naturalWidth: 1600,
        naturalHeight: 900,
      });

      expect(coords.relX).toBe(0.5);
      expect(coords.relY).toBeCloseTo(0.5);
    });
  });
});
