/**
 * useCanvasDrawing Hook
 *
 * Manages canvas drawing operations, metrics calculation, and cleanup for ImageEditor.
 * Extracted from ImageEditor.tsx to separate canvas logic from UI orchestration.
 *
 * Features:
 * - Canvas drawing with image scaling and positioning
 * - Metrics calculation (container/image dimensions)
 * - Marching ants animation for selections
 * - Critical cleanup on unmount (prevents memory leaks)
 */

import { useCallback, useEffect, useRef, RefObject } from 'react';

/**
 * Point represents a 2D coordinate on the canvas
 */
export type Point = { x: number; y: number };

/**
 * Rect represents a rectangular region on the canvas
 */
export type Rect = { x: number; y: number; width: number; height: number };

/**
 * Canvas metrics for image rendering
 * Contains dimensions and scaling information
 */
export interface CanvasMetrics {
  iw: number;  // Image natural width
  ih: number;  // Image natural height
  cw: number;  // Container width
  ch: number;  // Container height
  scale: number;  // Scale factor to fit image in container
  dw: number;  // Display width (scaled)
  dh: number;  // Display height (scaled)
  dx: number;  // Display X offset (for centering)
  dy: number;  // Display Y offset (for centering)
}

/**
 * Props for useCanvasDrawing hook
 */
export interface UseCanvasDrawingProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  previewCanvasRef: RefObject<HTMLCanvasElement>;
  overlayCanvasRef: RefObject<HTMLCanvasElement>;
  imageRef: RefObject<HTMLImageElement>;
}

/**
 * Return type for useCanvasDrawing hook
 */
export interface UseCanvasDrawingReturn {
  drawOnscreenCanvas: (source: HTMLImageElement) => void;
  getCanvasAndImageMetrics: () => CanvasMetrics | null;
  getPointOnCanvas: (e: React.MouseEvent<HTMLCanvasElement>) => Point | null;
}

/**
 * useCanvasDrawing Hook
 *
 * Provides canvas drawing utilities and automatic cleanup.
 * Handles image rendering, metrics calculation, and prevents memory leaks.
 *
 * @param props - Canvas and image refs
 * @returns Canvas drawing utilities
 */
export function useCanvasDrawing({
  canvasRef,
  previewCanvasRef,
  overlayCanvasRef,
  imageRef,
}: UseCanvasDrawingProps): UseCanvasDrawingReturn {

  // Animation frame ID for marching ants cleanup
  const animationFrameId = useRef<number | null>(null);

  /**
   * Calculate canvas and image metrics for rendering
   *
   * Determines:
   * - Image natural dimensions
   * - Container dimensions
   * - Scale factor to fit image in container
   * - Display dimensions and offset for centering
   *
   * @returns Metrics object or null if not ready
   */
  const getCanvasAndImageMetrics = useCallback((): CanvasMetrics | null => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    const img = imageRef.current;

    if (!container || !img.src || !img.naturalWidth) return null;

    const { naturalWidth: iw, naturalHeight: ih } = img;
    const { clientWidth: cw, clientHeight: ch } = container;

    if (iw === 0 || ih === 0) return null;

    // Calculate scale to fit image in container (maintain aspect ratio)
    const scale = Math.min(cw / iw, ch / ih);

    // Calculate display dimensions
    const dw = iw * scale;
    const dh = ih * scale;

    // Calculate offset for centering
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    return { iw, ih, cw, ch, scale, dw, dh, dx, dy };
  }, [canvasRef, imageRef]);

  /**
   * Draw image on main and preview canvases
   *
   * Renders the source image on both canvases at the correct
   * position and scale to fit the container.
   *
   * @param source - Image element to draw
   */
  const drawOnscreenCanvas = useCallback((source: HTMLImageElement) => {
    const canvases = [canvasRef.current, previewCanvasRef.current, overlayCanvasRef.current];
    const metrics = getCanvasAndImageMetrics();

    if (!canvases[0] || !metrics) return;

    const { cw, ch, dx, dy, dw, dh } = metrics;

    // Resize all canvases to container size
    canvases.forEach(c => {
      if (c) {
        c.width = cw;
        c.height = ch;
      }
    });

    // Draw on main canvas
    const ctx = canvases[0].getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(source, dx, dy, dw, dh);
    }

    // Draw on preview canvas (for adjustments preview)
    const pctx = canvases[1]?.getContext('2d');
    if (pctx) {
      pctx.clearRect(0, 0, cw, ch);
      pctx.drawImage(source, dx, dy, dw, dh);
    }
  }, [canvasRef, previewCanvasRef, overlayCanvasRef, getCanvasAndImageMetrics]);

  /**
   * Get point coordinates on canvas from mouse event
   *
   * Converts client coordinates to canvas-relative coordinates.
   *
   * @param e - Mouse event
   * @returns Point on canvas or null if canvas not available
   */
  const getPointOnCanvas = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point | null => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    if (!rect) return null;

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  /**
   * CRITICAL: Canvas cleanup on unmount
   *
   * Prevents memory leaks by:
   * 1. Canceling animation frames (marching ants)
   * 2. Clearing canvas contexts
   * 3. Resetting canvas dimensions to 0
   * 4. Clearing image source
   *
   * This is essential to prevent canvas memory accumulation
   * when the ImageEditor is opened/closed repeatedly.
   */
  useEffect(() => {
    return () => {
      // 1. Cancel animation frame (marching ants)
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }

      // 2. Clear all canvas contexts and reset dimensions
      [canvasRef, previewCanvasRef, overlayCanvasRef].forEach(ref => {
        const canvas = ref.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Clear entire canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
          // Reset dimensions to free memory
          canvas.width = 0;
          canvas.height = 0;
        }
      });

      // 3. Clear image reference to stop loading/prevent memory leak
      if (imageRef.current) {
        imageRef.current.src = '';
        imageRef.current.onload = null;
      }
    };
  }, []); // Run only on unmount

  return {
    drawOnscreenCanvas,
    getCanvasAndImageMetrics,
    getPointOnCanvas,
  };
}
