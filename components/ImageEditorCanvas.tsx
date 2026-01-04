/**
 * ImageEditorCanvas Component
 *
 * Renders the canvas layers for the ImageEditor:
 * - Main canvas: Base image rendering
 * - Preview canvas: Image with filters/adjustments applied
 * - Overlay canvas: Interactive elements (crop rect, selection path, perspective points)
 *
 * Extracted from ImageEditor.tsx to separate canvas rendering from orchestration.
 * Wrapped with React.memo to prevent unnecessary re-renders.
 */

import React, { RefObject } from 'react';
import { ImageFile } from '../types';

/**
 * Overlay styles for temperature and tint adjustments
 */
interface OverlayStyles {
  warmOpacity: number;
  coolOpacity: number;
  magentaOpacity: number;
  greenOpacity: number;
}

/**
 * Props for ImageEditorCanvas
 */
export interface ImageEditorCanvasProps {
  /** Main canvas ref for base image */
  canvasRef: RefObject<HTMLCanvasElement>;

  /** Preview canvas ref for filtered image */
  previewCanvasRef: RefObject<HTMLCanvasElement>;

  /** Overlay canvas ref for interactive elements */
  overlayCanvasRef: RefObject<HTMLCanvasElement>;

  /** Current image being edited */
  currentImage: ImageFile | null;

  /** CSS styles for preview canvas (filters, masks) */
  imagePreviewStyles: React.CSSProperties;

  /** Opacity values for temperature overlay */
  temperatureOverlayStyles: { warmOpacity: number; coolOpacity: number };

  /** Opacity values for tint overlay */
  tintOverlayStyles: { magentaOpacity: number; greenOpacity: number };

  /** Loading state indicator */
  isLoading: boolean;

  /** Mouse down handler for interactive canvas */
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;

  /** Mouse move handler for interactive canvas */
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;

  /** Mouse up handler for interactive canvas */
  onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;

  /** Mouse leave handler (same as mouse up) */
  onMouseLeave: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}

/**
 * ImageEditorCanvas Component
 *
 * Renders three canvas layers:
 * 1. Main canvas - base image rendering
 * 2. Preview canvas - image with CSS filters and masks applied
 * 3. Overlay canvas - interactive elements (selections, crop rect)
 *
 * Color adjustment overlays (temperature/tint) are rendered as div elements
 * with mix-blend-mode for better visual effects.
 *
 * @param props - Canvas props
 */
const ImageEditorCanvasComponent: React.FC<ImageEditorCanvasProps> = ({
  canvasRef,
  previewCanvasRef,
  overlayCanvasRef,
  currentImage,
  imagePreviewStyles,
  temperatureOverlayStyles,
  tintOverlayStyles,
  isLoading,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
}) => {
  return (
    <div className="flex-grow flex items-center justify-center bg-black/30 rounded-lg relative overflow-hidden">
      {currentImage && (
        <>
          {/* Main canvas - base image rendering */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
          />

          {/* Preview canvas - image with filters and masks applied */}
          <canvas
            ref={previewCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={imagePreviewStyles}
          />

          {/* Temperature overlay - warm tone (orange) */}
          <div
            className="absolute inset-0 w-full h-full pointer-events-none mix-blend-color"
            style={{
              backgroundColor: 'rgb(255, 165, 0)',
              opacity: temperatureOverlayStyles.warmOpacity,
            }}
          />

          {/* Temperature overlay - cool tone (blue) */}
          <div
            className="absolute inset-0 w-full h-full pointer-events-none mix-blend-color"
            style={{
              backgroundColor: 'rgb(0, 127, 255)',
              opacity: temperatureOverlayStyles.coolOpacity,
            }}
          />

          {/* Tint overlay - magenta tone */}
          <div
            className="absolute inset-0 w-full h-full pointer-events-none mix-blend-color"
            style={{
              backgroundColor: 'magenta',
              opacity: tintOverlayStyles.magentaOpacity,
            }}
          />

          {/* Tint overlay - green tone */}
          <div
            className="absolute inset-0 w-full h-full pointer-events-none mix-blend-color"
            style={{
              backgroundColor: 'green',
              opacity: tintOverlayStyles.greenOpacity,
            }}
          />

          {/* Overlay canvas - interactive elements (crop, selections, perspective) */}
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 w-full h-full"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
          />
        </>
      )}

      {/* Loading spinner overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent" />
        </div>
      )}
    </div>
  );
};

/**
 * Memoized ImageEditorCanvas
 *
 * Prevents unnecessary re-renders when parent updates.
 * Only re-renders when props change.
 */
export const ImageEditorCanvas = React.memo(ImageEditorCanvasComponent);
ImageEditorCanvas.displayName = 'ImageEditorCanvas';
