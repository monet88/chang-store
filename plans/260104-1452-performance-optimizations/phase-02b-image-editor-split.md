# Phase 02b: Split ImageEditor + Canvas Cleanup

**Agent Type:** fullstack-developer
**Priority:** P1 High
**Estimated Time:** 2-3 days
**Issue Reference:** ISSUE 3 + ISSUE 8 from performance report
**Dependencies:** Requires Phase 1 completion

---

## Objectives

1. **Split ImageEditor monolith:** 1329 lines → 4 modular files
2. **Implement canvas cleanup:** Prevent memory leaks on unmount
3. **Optimize render performance:** 15-30ms → <10ms per canvas operation

**Target Structure:**
- `ImageEditor.tsx` (orchestrator, ~200 lines)
- `ImageEditorCanvas.tsx` (canvas rendering, ~400 lines, memoized)
- `ImageEditorToolbar.tsx` (tool UI, ~300 lines, memoized)
- `useCanvasDrawing.ts` (canvas logic + cleanup, ~400 lines)

---

## Current Problems

### Problem 1: Monolithic Component
```typescript
// components/ImageEditor.tsx:628-1328 (1329 lines)
export const ImageEditor: React.FC<ImageEditorProps> = ({ onClose, initialImage }) => {
  // ❌ 20+ useState hooks
  const [history, setHistory] = useState<ImageFile[]>(/* ... */);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  // ... 17 more

  // ❌ Canvas refs never cleaned up
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(new Image()); // Memory leak risk

  // ❌ Complex useEffect with broad dependencies
  useEffect(() => { /* 50 lines of canvas drawing */ }, [activeTool, cropRect, /* ... */]);
};
```

### Problem 2: Memory Leaks (ISSUE 8)
```typescript
// Animation frames cleaned up ✅
useEffect(() => {
  let animationFrameId: number;
  const animate = () => { /* ... */ };
  return () => cancelAnimationFrame(animationFrameId); // Good
}, [activeTool]);

// Canvas contexts NOT cleaned up ❌
// Image refs NOT freed ❌
```

---

## Implementation Plan

### Step 1: Extract Canvas Drawing Hook

**File:** `hooks/useCanvasDrawing.ts` (~400 lines)

```typescript
import { useEffect, useRef, useCallback, useState } from 'react';
import { ImageFile } from '../types';

interface UseCanvasDrawingProps {
  currentImage: ImageFile | null;
  activeTool: string | null;
  cropRect: { x: number; y: number; width: number; height: number } | null;
  selectionPath: { x: number; y: number }[] | null;
  // ... other drawing-related props
}

interface UseCanvasDrawingReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  previewCanvasRef: React.RefObject<HTMLCanvasElement>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  drawOnCanvas: () => void;
  clearCanvas: () => void;
  // ... other methods
}

/**
 * Custom hook for canvas drawing operations
 * Handles canvas lifecycle, drawing logic, and cleanup
 */
export const useCanvasDrawing = (props: UseCanvasDrawingProps): UseCanvasDrawingReturn => {
  const {
    currentImage,
    activeTool,
    cropRect,
    selectionPath
  } = props;

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(new Image());

  // Animation state
  const [lineDashOffset, setLineDashOffset] = useState(0);
  const animationFrameIdRef = useRef<number | null>(null);

  /**
   * Draw image on main canvas
   */
  const drawOnCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !currentImage) return;

    const img = imageRef.current;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = `data:${currentImage.mimeType};base64,${currentImage.base64}`;
  }, [currentImage]);

  /**
   * Draw overlay (selection, crop rect, etc.)
   */
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw crop rectangle
    if (cropRect) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = lineDashOffset;
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
    }

    // Draw selection path
    if (selectionPath && selectionPath.length > 0) {
      ctx.beginPath();
      ctx.moveTo(selectionPath[0].x, selectionPath[0].y);
      selectionPath.forEach(point => ctx.lineTo(point.x, point.y));
      ctx.closePath();
      ctx.strokeStyle = '#00ff00';
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = lineDashOffset;
      ctx.stroke();
    }
  }, [cropRect, selectionPath, lineDashOffset]);

  /**
   * Animation loop for dashed line effects
   */
  useEffect(() => {
    const needsAnimation = ['crop', 'marquee', 'ellipse', 'lasso'].includes(activeTool || '') ||
                          cropRect !== null ||
                          selectionPath !== null;

    if (needsAnimation) {
      const animate = () => {
        setLineDashOffset(prev => (prev + 0.5) % 16);
        animationFrameIdRef.current = requestAnimationFrame(animate);
      };
      animate();
    }

    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [activeTool, cropRect, selectionPath]);

  /**
   * Update overlay when drawing state changes
   */
  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  /**
   * Update main canvas when image changes
   */
  useEffect(() => {
    drawOnCanvas();
  }, [drawOnCanvas]);

  /**
   * ✅ CRITICAL CLEANUP (ISSUE 8 FIX)
   * Clean up canvas contexts and image references on unmount
   */
  useEffect(() => {
    return () => {
      // Clear all canvas contexts
      [canvasRef, previewCanvasRef, overlayCanvasRef].forEach(ref => {
        const canvas = ref.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
      });

      // Free image reference
      if (imageRef.current) {
        imageRef.current.src = '';
        imageRef.current.onload = null;
        imageRef.current.onerror = null;
        // Force garbage collection by removing reference
        imageRef.current = new Image();
      }

      // Cancel any pending animations
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []); // Run only on unmount

  /**
   * Handle window resize
   */
  useEffect(() => {
    const handleResize = () => {
      drawOnCanvas();
      drawOverlay();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawOnCanvas, drawOverlay]);

  return {
    canvasRef,
    previewCanvasRef,
    overlayCanvasRef,
    drawOnCanvas,
    clearCanvas: () => {
      [canvasRef, previewCanvasRef, overlayCanvasRef].forEach(ref => {
        const canvas = ref.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
      });
    }
  };
};
```

**Key Features:**
- ✅ Canvas lifecycle management
- ✅ Animation frame cleanup
- ✅ Image reference cleanup
- ✅ Window resize handling
- ✅ All drawing logic centralized

---

### Step 2: Extract Canvas Component

**File:** `components/ImageEditorCanvas.tsx` (~400 lines)

```typescript
import React, { useEffect } from 'react';
import { ImageFile } from '../types';

interface ImageEditorCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  previewCanvasRef: React.RefObject<HTMLCanvasElement>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  currentImage: ImageFile | null;
  activeTool: string | null;
  onCanvasClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}

/**
 * ImageEditorCanvas - Canvas rendering component
 * Memoized to prevent re-renders when toolbar state changes
 */
export const ImageEditorCanvas = React.memo<ImageEditorCanvasProps>(({
  canvasRef,
  previewCanvasRef,
  overlayCanvasRef,
  currentImage,
  activeTool,
  onCanvasClick,
  onCanvasMouseDown,
  onCanvasMouseMove,
  onCanvasMouseUp
}) => {
  return (
    <div className="image-editor-canvas-container relative w-full h-full">
      {/* Main canvas - displays the image */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full"
        style={{ zIndex: 1 }}
      />

      {/* Preview canvas - shows drawing in progress */}
      <canvas
        ref={previewCanvasRef}
        className="absolute top-0 left-0 w-full h-full"
        style={{ zIndex: 2, pointerEvents: 'none' }}
      />

      {/* Overlay canvas - shows selection, crop rect, etc. */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute top-0 left-0 w-full h-full"
        style={{ zIndex: 3 }}
        onClick={onCanvasClick}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
      />

      {/* Cursor indicator */}
      {activeTool && (
        <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded">
          Tool: {activeTool}
        </div>
      )}
    </div>
  );
});

ImageEditorCanvas.displayName = 'ImageEditorCanvas';
```

---

### Step 3: Extract Toolbar Component

**File:** `components/ImageEditorToolbar.tsx` (~300 lines)

```typescript
import React, { useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface ImageEditorToolbarProps {
  activeTool: string | null;
  onToolChange: (tool: string | null) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onClose: () => void;
  onCrop: () => void;
  onRotate: () => void;
  onFlip: () => void;
  // ... other toolbar actions
}

/**
 * ImageEditorToolbar - Toolbar UI component
 * Memoized to prevent re-renders when canvas state changes
 */
export const ImageEditorToolbar = React.memo<ImageEditorToolbarProps>(({
  activeTool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onClose,
  onCrop,
  onRotate,
  onFlip
}) => {
  const { t } = useLanguage();

  const handleToolClick = useCallback((tool: string) => {
    onToolChange(activeTool === tool ? null : tool);
  }, [activeTool, onToolChange]);

  return (
    <div className="image-editor-toolbar bg-slate-800 p-4 rounded-lg">
      {/* Main Actions */}
      <div className="toolbar-section mb-4">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="btn-toolbar"
          title={t('imageEditor.undo')}
        >
          ↶ Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="btn-toolbar"
          title={t('imageEditor.redo')}
        >
          ↷ Redo
        </button>
      </div>

      {/* Selection Tools */}
      <div className="toolbar-section mb-4">
        <h3 className="text-sm font-medium mb-2">{t('imageEditor.selectionTools')}</h3>
        <button
          onClick={() => handleToolClick('marquee')}
          className={activeTool === 'marquee' ? 'btn-toolbar-active' : 'btn-toolbar'}
        >
          ▭ Marquee
        </button>
        <button
          onClick={() => handleToolClick('ellipse')}
          className={activeTool === 'ellipse' ? 'btn-toolbar-active' : 'btn-toolbar'}
        >
          ⬭ Ellipse
        </button>
        <button
          onClick={() => handleToolClick('lasso')}
          className={activeTool === 'lasso' ? 'btn-toolbar-active' : 'btn-toolbar'}
        >
          ✂ Lasso
        </button>
      </div>

      {/* Transform Tools */}
      <div className="toolbar-section mb-4">
        <h3 className="text-sm font-medium mb-2">{t('imageEditor.transformTools')}</h3>
        <button
          onClick={() => handleToolClick('crop')}
          className={activeTool === 'crop' ? 'btn-toolbar-active' : 'btn-toolbar'}
        >
          ✂ Crop
        </button>
        <button onClick={onRotate} className="btn-toolbar">
          ↻ Rotate
        </button>
        <button onClick={onFlip} className="btn-toolbar">
          ⇄ Flip
        </button>
      </div>

      {/* Drawing Tools */}
      <div className="toolbar-section mb-4">
        <h3 className="text-sm font-medium mb-2">{t('imageEditor.drawingTools')}</h3>
        <button
          onClick={() => handleToolClick('brush')}
          className={activeTool === 'brush' ? 'btn-toolbar-active' : 'btn-toolbar'}
        >
          ✎ Brush
        </button>
        <button
          onClick={() => handleToolClick('eraser')}
          className={activeTool === 'eraser' ? 'btn-toolbar-active' : 'btn-toolbar'}
        >
          ⌫ Eraser
        </button>
      </div>

      {/* Actions */}
      <div className="toolbar-section">
        <button onClick={onSave} className="btn-primary w-full mb-2">
          {t('common.save')}
        </button>
        <button onClick={onClose} className="btn-secondary w-full">
          {t('common.close')}
        </button>
      </div>
    </div>
  );
});

ImageEditorToolbar.displayName = 'ImageEditorToolbar';
```

---

### Step 4: Refactor Main Orchestrator

**File:** `components/ImageEditor.tsx` (~200 lines)

```typescript
import React, { useState, useCallback } from 'react';
import { ImageFile } from '../types';
import { useCanvasDrawing } from '../hooks/useCanvasDrawing';
import { ImageEditorCanvas } from './ImageEditorCanvas';
import { ImageEditorToolbar } from './ImageEditorToolbar';

interface ImageEditorProps {
  onClose: () => void;
  initialImage: ImageFile | null;
}

/**
 * ImageEditor - Main orchestrator component
 * Manages state and coordinates Canvas + Toolbar
 */
export const ImageEditor: React.FC<ImageEditorProps> = ({ onClose, initialImage }) => {
  // History state
  const [history, setHistory] = useState<ImageFile[]>(initialImage ? [initialImage] : []);
  const [currentIndex, setCurrentIndex] = useState(initialImage ? 0 : -1);

  // Tool state
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectionPath, setSelectionPath] = useState<{ x: number; y: number }[] | null>(null);

  // Current image
  const currentImage = currentIndex >= 0 ? history[currentIndex] : null;

  // Canvas drawing hook (handles all canvas logic + cleanup)
  const {
    canvasRef,
    previewCanvasRef,
    overlayCanvasRef,
    drawOnCanvas,
    clearCanvas
  } = useCanvasDrawing({
    currentImage,
    activeTool,
    cropRect,
    selectionPath
  });

  // Undo/Redo
  const handleUndo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleRedo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, history.length]);

  // Tool actions
  const handleCrop = useCallback(() => {
    if (!cropRect || !currentImage) return;
    // Crop logic...
    // Add to history
  }, [cropRect, currentImage]);

  const handleRotate = useCallback(() => {
    // Rotate logic...
  }, [currentImage]);

  const handleFlip = useCallback(() => {
    // Flip logic...
  }, [currentImage]);

  // Canvas mouse handlers
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle click based on activeTool
  }, [activeTool]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle mouse down based on activeTool
  }, [activeTool]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle mouse move based on activeTool
  }, [activeTool]);

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle mouse up based on activeTool
  }, [activeTool]);

  return (
    <div className="image-editor-container fixed inset-0 z-50 bg-black/90 flex">
      {/* Toolbar */}
      <div className="w-64 p-4">
        <ImageEditorToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          canUndo={currentIndex > 0}
          canRedo={currentIndex < history.length - 1}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSave={() => {/* Save logic */}}
          onClose={onClose}
          onCrop={handleCrop}
          onRotate={handleRotate}
          onFlip={handleFlip}
        />
      </div>

      {/* Canvas */}
      <div className="flex-1 p-4">
        <ImageEditorCanvas
          canvasRef={canvasRef}
          previewCanvasRef={previewCanvasRef}
          overlayCanvasRef={overlayCanvasRef}
          currentImage={currentImage}
          activeTool={activeTool}
          onCanvasClick={handleCanvasClick}
          onCanvasMouseDown={handleCanvasMouseDown}
          onCanvasMouseMove={handleCanvasMouseMove}
          onCanvasMouseUp={handleCanvasMouseUp}
        />
      </div>
    </div>
  );
};
```

---

## Files Modified/Created

**Created:**
- `hooks/useCanvasDrawing.ts` (NEW, ~400 lines)
- `components/ImageEditorCanvas.tsx` (NEW, ~400 lines)
- `components/ImageEditorToolbar.tsx` (NEW, ~300 lines)

**Modified:**
- `components/ImageEditor.tsx` (1329 → ~200 lines)

---

## Implementation Checklist

- [ ] Create `hooks/useCanvasDrawing.ts`
  - [ ] Extract canvas lifecycle logic
  - [ ] Implement cleanup (canvas contexts, image refs, animations)
  - [ ] Add JSDoc comments
- [ ] Create `components/ImageEditorCanvas.tsx`
  - [ ] Extract canvas JSX
  - [ ] Wrap with React.memo
  - [ ] Add mouse event handlers
- [ ] Create `components/ImageEditorToolbar.tsx`
  - [ ] Extract toolbar JSX
  - [ ] Wrap with React.memo
  - [ ] All buttons use useCallback
- [ ] Update `components/ImageEditor.tsx`
  - [ ] Remove extracted code
  - [ ] Import Canvas, Toolbar, useCanvasDrawing
  - [ ] Pass props correctly
- [ ] Test memory leaks (open/close editor 20+ times)
- [ ] Verify canvas performance
- [ ] Check React DevTools for re-render patterns

---

## Testing Requirements

### Memory Leak Testing (CRITICAL)
```javascript
// Open Chrome DevTools → Performance → Memory
1. Take heap snapshot
2. Open ImageEditor
3. Close ImageEditor
4. Repeat 20 times
5. Force garbage collection (trash icon)
6. Take second heap snapshot
7. Compare: should NOT see growing canvas/image objects
```

### Functional Testing
- [ ] All tools work (crop, rotate, flip, brush, eraser, selection)
- [ ] Undo/redo functional
- [ ] Canvas renders correctly
- [ ] Mouse interactions responsive
- [ ] Animation smooth (dashed selection lines)

### Performance Testing
```bash
# React DevTools Profiler
# Before: 15-30ms per canvas operation
# After: <10ms per canvas operation
```

---

## Acceptance Criteria

✅ **ImageEditor split into 4 files**
✅ **Canvas cleanup implemented (no memory leaks)**
✅ **Canvas component memoized**
✅ **Toolbar component memoized**
✅ **useCanvasDrawing hook centralizes canvas logic**
✅ **All tools functional**
✅ **Undo/redo works**
✅ **Performance: 15-30ms → <10ms**
✅ **No memory leaks after 20+ open/close cycles**

---

**Status:** Ready for implementation
**Agent:** fullstack-developer-2b
**Prerequisites:** Phase 1 complete
