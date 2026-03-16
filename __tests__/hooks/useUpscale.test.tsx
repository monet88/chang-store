/**
 * Unit Tests for useUpscale Hook
 *
 * Regression coverage for the Phase 1 + Phase 2 multi-image session contract:
 * 1. Session management — adding, removing, switching images
 * 2. Active-image rule — newest upload becomes active
 * 3. Per-image state isolation — quality, model, and studio step survive image switching
 * 4. Mode preservation — Quick Upscale / AI Studio drafts survive mode switches
 * 5. Quick Upscale action — loading, error, result lifecycle
 * 6. AI Studio step navigation — step ordering and lock rules
 * 7. Phase 2: Model selection, confirmation flow, glow trigger, error suggestions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ImageFile, UpscaleStudioStep, DEFAULT_UPSCALE_QUICK_MODEL } from '../../types';
import {
  mockUseLanguage,
  mockUseImageGallery,
  mockUseApi,
} from '../__mocks__/contexts';

// ============================================================================
// Mock Setup — Must be before imports
// ============================================================================

/** Mock upscaleImage from imageEditingService */
vi.mock('../../services/imageEditingService', () => ({
  upscaleImage: vi.fn(),
}));

/** Mock getErrorMessage from imageUtils */
vi.mock('../../utils/imageUtils', () => ({
  getErrorMessage: vi.fn((err: Error) => err.message),
}));

/** Mock contexts */
vi.mock('../../contexts/LanguageContext', () => mockUseLanguage());
vi.mock('../../contexts/ImageGalleryContext', () => mockUseImageGallery());
vi.mock('../../contexts/ApiProviderContext', () => mockUseApi());

// Import hook and mocked services after mocking
import { useUpscale } from '../../hooks/useUpscale';
import { upscaleImage } from '../../services/imageEditingService';

// ============================================================================
// Test Constants
// ============================================================================

const TEST_IMAGE_A: ImageFile = { base64: 'aW1hZ2VBZGF0YQ==', mimeType: 'image/png' };
const TEST_IMAGE_B: ImageFile = { base64: 'aW1hZ2VCZGchdYQ==', mimeType: 'image/jpeg' };
const TEST_IMAGE_C: ImageFile = { base64: 'aW1hZ2VDZGRkZA==', mimeType: 'image/png' };
const UPSCALED_RESULT: ImageFile = { base64: 'dXBzY2FsZWQtcmVzdWx0', mimeType: 'image/png' };

// ============================================================================
// Test Suite
// ============================================================================

describe('useUpscale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock crypto.randomUUID for stable IDs in tests
    let counter = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `test-uuid-${++counter}` as `${string}-${string}-${string}-${string}-${string}`);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Session Management
  // ============================================================================

  describe('Session Management', () => {
    it('should start with an empty session', () => {
      const { result } = renderHook(() => useUpscale());

      expect(result.current.sessionImages).toHaveLength(0);
      expect(result.current.activeImageId).toBeNull();
      expect(result.current.activeImage).toBeNull();
      expect(result.current.mode).toBe('quick');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should add image and auto-activate it', () => {
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });

      expect(result.current.sessionImages).toHaveLength(1);
      expect(result.current.activeImageId).toBe('test-uuid-1');
      expect(result.current.activeImage?.original).toEqual(TEST_IMAGE_A);
    });

    it('should make the newest upload the active image', () => {
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });
      act(() => {
        result.current.addSessionImage(TEST_IMAGE_B);
      });

      // Second image should be active
      expect(result.current.activeImageId).toBe('test-uuid-2');
      expect(result.current.activeImage?.original).toEqual(TEST_IMAGE_B);
      // But both images remain in session
      expect(result.current.sessionImages).toHaveLength(2);
    });

    it('should keep multiple images available in session', () => {
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });
      act(() => {
        result.current.addSessionImage(TEST_IMAGE_B);
      });
      act(() => {
        result.current.addSessionImage(TEST_IMAGE_C);
      });

      expect(result.current.sessionImages).toHaveLength(3);
      // Newest first
      expect(result.current.sessionImages[0].original).toEqual(TEST_IMAGE_C);
      expect(result.current.sessionImages[1].original).toEqual(TEST_IMAGE_B);
      expect(result.current.sessionImages[2].original).toEqual(TEST_IMAGE_A);
    });

    it('should remove an image and keep others intact', () => {
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });
      act(() => {
        result.current.addSessionImage(TEST_IMAGE_B);
      });

      // Remove image A (uuid-1)
      act(() => {
        result.current.removeSessionImage('test-uuid-1');
      });

      expect(result.current.sessionImages).toHaveLength(1);
      expect(result.current.sessionImages[0].original).toEqual(TEST_IMAGE_B);
    });

    it('should shift active to next image when active image is removed', () => {
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });
      act(() => {
        result.current.addSessionImage(TEST_IMAGE_B);
      });

      // B is active (uuid-2), remove it
      act(() => {
        result.current.removeSessionImage('test-uuid-2');
      });

      // Should shift to A (uuid-1)
      expect(result.current.activeImageId).toBe('test-uuid-1');
      expect(result.current.activeImage?.original).toEqual(TEST_IMAGE_A);
    });

    it('should set activeImageId to null when last image is removed', () => {
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });
      act(() => {
        result.current.removeSessionImage('test-uuid-1');
      });

      expect(result.current.activeImageId).toBeNull();
      expect(result.current.activeImage).toBeNull();
    });
  });

  // ============================================================================
  // Active-Image Switching
  // ============================================================================

  describe('Active-Image Switching', () => {
    it('should switch active image without losing other images', () => {
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });
      act(() => {
        result.current.addSessionImage(TEST_IMAGE_B);
      });

      // Switch back to A
      act(() => {
        result.current.setActiveImageId('test-uuid-1');
      });

      expect(result.current.activeImageId).toBe('test-uuid-1');
      expect(result.current.activeImage?.original).toEqual(TEST_IMAGE_A);
      // Both still in session
      expect(result.current.sessionImages).toHaveLength(2);
    });

    it('should preserve per-image quality across switches', () => {
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A); // uuid-1
      });
      // Set A's quality to 4K
      act(() => {
        result.current.setActiveQuality('4K');
      });

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_B); // uuid-2, now active
      });
      // B should have default 2K
      expect(result.current.activeImage?.quickQuality).toBe('2K');

      // Switch back to A
      act(() => {
        result.current.setActiveImageId('test-uuid-1');
      });
      // A should still have 4K
      expect(result.current.activeImage?.quickQuality).toBe('4K');
    });

    it('should preserve per-image studio step across switches', () => {
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A); // uuid-1
      });
      // Advance A to Enhance step
      act(() => {
        result.current.setActiveStudioStep(UpscaleStudioStep.Enhance);
      });

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_B); // uuid-2, now active
      });
      // B should start at Analyze
      expect(result.current.activeImage?.studioStep).toBe(UpscaleStudioStep.Analyze);

      // Switch back to A
      act(() => {
        result.current.setActiveImageId('test-uuid-1');
      });
      // A should still be at Enhance
      expect(result.current.activeImage?.studioStep).toBe(UpscaleStudioStep.Enhance);
    });
  });

  // ============================================================================
  // Mode Preservation
  // ============================================================================

  describe('Mode Preservation', () => {
    it('should switch mode without resetting session state', () => {
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });

      // Start in quick mode (default)
      expect(result.current.mode).toBe('quick');

      // Switch to studio
      act(() => {
        result.current.setMode('studio');
      });

      expect(result.current.mode).toBe('studio');
      // Session still intact
      expect(result.current.sessionImages).toHaveLength(1);
      expect(result.current.activeImage?.original).toEqual(TEST_IMAGE_A);
    });

    it('should preserve Quick Upscale result when switching to studio and back', () => {
      const { result } = renderHook(() => useUpscale());
      vi.mocked(upscaleImage).mockResolvedValueOnce(UPSCALED_RESULT);

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });

      // Upscale in quick mode
      let upscalePromise: Promise<void>;
      act(() => {
        upscalePromise = result.current.handleQuickUpscale();
      });

      return act(async () => {
        await upscalePromise;
      }).then(() => {
        expect(result.current.activeImage?.quickResult).toEqual(UPSCALED_RESULT);

        // Switch to studio
        act(() => {
          result.current.setMode('studio');
        });

        // Switch back to quick
        act(() => {
          result.current.setMode('quick');
        });

        // Result should still be there
        expect(result.current.activeImage?.quickResult).toEqual(UPSCALED_RESULT);
      });
    });
  });

  // ============================================================================
  // Quick Upscale Action
  // ============================================================================

  describe('Quick Upscale', () => {
    it('should set error when no active image', async () => {
      const { result } = renderHook(() => useUpscale());

      await act(async () => {
        await result.current.handleQuickUpscale();
      });

      expect(result.current.error).toBe('upscale.inputError');
      expect(upscaleImage).not.toHaveBeenCalled();
    });

    it('should upscale active image successfully', async () => {
      vi.mocked(upscaleImage).mockResolvedValueOnce(UPSCALED_RESULT);
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });

      await act(async () => {
        await result.current.handleQuickUpscale();
      });

      expect(upscaleImage).toHaveBeenCalledWith(
        TEST_IMAGE_A,
        expect.any(String),
        expect.any(Object),
        '2K',
        DEFAULT_UPSCALE_QUICK_MODEL,
      );
      expect(result.current.activeImage?.quickResult).toEqual(UPSCALED_RESULT);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle upscale error', async () => {
      vi.mocked(upscaleImage).mockRejectedValueOnce(new Error('Network error'));
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });

      await act(async () => {
        await result.current.handleQuickUpscale();
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isLoading).toBe(false);
    });

    it('should show loading state during upscale', async () => {
      let resolvePromise: (value: ImageFile) => void;
      vi.mocked(upscaleImage).mockImplementation(
        () => new Promise<ImageFile>((resolve) => { resolvePromise = resolve; }),
      );

      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });

      let upscalePromise: Promise<void>;
      act(() => {
        upscalePromise = result.current.handleQuickUpscale();
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolvePromise!(UPSCALED_RESULT);
        await upscalePromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should clear error on new upload', () => {
      const { result } = renderHook(() => useUpscale());

      // Set error
      act(() => {
        result.current.handleQuickUpscale(); // No image → error
      });

      // Upload clears error
      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });

      expect(result.current.error).toBeNull();
    });
  });

  // ============================================================================
  // AI Studio Step Navigation
  // ============================================================================

  describe('AI Studio Step Navigation', () => {
    it('should start at Analyze step', () => {
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });

      expect(result.current.activeImage?.studioStep).toBe(UpscaleStudioStep.Analyze);
    });

    it('should allow navigating to any step', () => {
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });

      act(() => {
        result.current.setActiveStudioStep(UpscaleStudioStep.Enhance);
      });

      expect(result.current.activeImage?.studioStep).toBe(UpscaleStudioStep.Enhance);

      act(() => {
        result.current.setActiveStudioStep(UpscaleStudioStep.Export);
      });

      expect(result.current.activeImage?.studioStep).toBe(UpscaleStudioStep.Export);
    });

    it('should not change step when no active image', () => {
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.setActiveStudioStep(UpscaleStudioStep.Enhance);
      });

      // No crash, no active image to update
      expect(result.current.activeImage).toBeNull();
    });
  });

  // ============================================================================
  // Error Management
  // ============================================================================

  describe('Error Management', () => {
    it('should clear error via clearError', () => {
      const { result } = renderHook(() => useUpscale());

      // Trigger an error
      act(() => {
        result.current.handleQuickUpscale();
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  // ============================================================================
  // Phase 2: Model Selection
  // ============================================================================

  describe('Model Selection (Phase 2)', () => {
    it('should default to Flash model when adding a session image', () => {
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });

      expect(result.current.activeImage?.quickModel).toBe(DEFAULT_UPSCALE_QUICK_MODEL);
    });

    it('should update active image model via setActiveModel', () => {
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });
      act(() => {
        result.current.setActiveModel('gemini-2.5-pro-preview-06-05' as any);
      });

      expect(result.current.activeImage?.quickModel).toBe('gemini-2.5-pro-preview-06-05');
    });

    it('should preserve per-image model across image switching', () => {
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A); // uuid-1
      });
      act(() => {
        result.current.setActiveModel('gemini-2.5-pro-preview-06-05' as any);
      });
      act(() => {
        result.current.addSessionImage(TEST_IMAGE_B); // uuid-2
      });
      // B should have default
      expect(result.current.activeImage?.quickModel).toBe(DEFAULT_UPSCALE_QUICK_MODEL);

      // Switch back to A
      act(() => {
        result.current.setActiveImageId('test-uuid-1');
      });
      expect(result.current.activeImage?.quickModel).toBe('gemini-2.5-pro-preview-06-05');
    });
  });

  // ============================================================================
  // Phase 2: Confirmation Flow
  // ============================================================================

  describe('Re-upscale Confirmation (Phase 2)', () => {
    it('should upscale directly when no result exists', async () => {
      vi.mocked(upscaleImage).mockResolvedValueOnce(UPSCALED_RESULT);
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });

      // requestReupscale should call upscale directly (no confirm)
      await act(async () => {
        result.current.requestReupscale();
        // wait for async
      });

      // Should NOT show confirmation
      expect(result.current.showReupscaleConfirm).toBe(false);
    });

    it('should show confirmation dialog when result exists', async () => {
      vi.mocked(upscaleImage).mockResolvedValueOnce(UPSCALED_RESULT);
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });

      // First upscale
      await act(async () => {
        await result.current.handleQuickUpscale();
      });

      // Now request re-upscale — should show confirm
      act(() => {
        result.current.requestReupscale();
      });

      expect(result.current.showReupscaleConfirm).toBe(true);
    });

    it('should close dialog on cancelReupscale', async () => {
      vi.mocked(upscaleImage).mockResolvedValueOnce(UPSCALED_RESULT);
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });
      await act(async () => {
        await result.current.handleQuickUpscale();
      });
      act(() => {
        result.current.requestReupscale();
      });

      act(() => {
        result.current.cancelReupscale();
      });

      expect(result.current.showReupscaleConfirm).toBe(false);
    });
  });

  // ============================================================================
  // Phase 2: Glow Trigger
  // ============================================================================

  describe('Result Glow (Phase 2)', () => {
    it('should trigger glow after successful upscale', async () => {
      vi.useFakeTimers();
      vi.mocked(upscaleImage).mockResolvedValueOnce(UPSCALED_RESULT);
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });

      await act(async () => {
        await result.current.handleQuickUpscale();
      });

      expect(result.current.showResultGlow).toBe(true);

      // Should auto-reset after 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.showResultGlow).toBe(false);

      vi.useRealTimers();
    });
  });

  // ============================================================================
  // Phase 2: Error Suggestions
  // ============================================================================

  describe('Error Suggestions (Phase 2)', () => {
    it('should provide no suggestion for generic errors', async () => {
      vi.mocked(upscaleImage).mockRejectedValueOnce(new Error('Something went wrong'));
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });

      await act(async () => {
        await result.current.handleQuickUpscale();
      });

      expect(result.current.error).toBe('Something went wrong');
      expect(result.current.errorSuggestion).toBeNull();
    });

    it('should clear error suggestion on clearError', async () => {
      vi.mocked(upscaleImage).mockRejectedValueOnce(new Error('network failure'));
      const { result } = renderHook(() => useUpscale());

      act(() => {
        result.current.addSessionImage(TEST_IMAGE_A);
      });
      await act(async () => {
        await result.current.handleQuickUpscale();
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.errorSuggestion).toBeNull();
    });
  });
});
