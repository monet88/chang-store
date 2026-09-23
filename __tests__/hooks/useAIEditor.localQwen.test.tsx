import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { mockUseImageEngine } from '../__mocks__/contexts';
import { Feature } from '@/types';
import type { ImageFile } from '@/types';
import { useAIEditor } from '@/hooks/useAIEditor';

const addImageMock = vi.hoisted(() => vi.fn());
const localQwenEditImageMock = vi.hoisted(() => vi.fn());

// Cloud drivers to verify they are NEVER called as fallbacks
const cloudGeminiEditMock = vi.hoisted(() => vi.fn());
const cloudGptEditMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/imageEditingService', () => ({
  editImage: cloudGeminiEditMock,
  upscaleImage: vi.fn(),
  createImageChatSession: vi.fn(),
}));

vi.mock('@/services/providers/gpt-image/gptImageService', () => ({
  editGptImage: cloudGptEditMock,
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${key}:${JSON.stringify(params)}`;
      }
      return key;
    },
  }),
}));

vi.mock('@/contexts/ImageGalleryContext', () => ({
  useImageGallery: () => ({
    addImage: addImageMock,
    images: [],
    removeImage: vi.fn(),
    clearGallery: vi.fn(),
  }),
}));

vi.mock('@/contexts/ImageEngineContext', () =>
  mockUseImageEngine({
    id: 'localQwen',
    model: 'qwen-image-2.1',
    editImage: localQwenEditImageMock,
  }),
);

const IMG_1: ImageFile = { base64: 'image-1-base64', mimeType: 'image/png' };
const IMG_2: ImageFile = { base64: 'image-2-base64', mimeType: 'image/png' };
const IMG_3: ImageFile = { base64: 'image-3-base64', mimeType: 'image/png' };
const IMG_4: ImageFile = { base64: 'image-4-base64', mimeType: 'image/png' };
const IMG_5: ImageFile = { base64: 'image-5-base64', mimeType: 'image/png' };
const IMG_6: ImageFile = { base64: 'image-6-base64', mimeType: 'image/png' };

const RESULT_IMAGE: ImageFile = { base64: 'rendered-qwen-editor', mimeType: 'image/png' };

describe('useAIEditor in Local Qwen Studio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addImageMock.mockReset();
    localQwenEditImageMock.mockReset();
    cloudGeminiEditMock.mockReset();
    cloudGptEditMock.mockReset();

    localQwenEditImageMock.mockResolvedValue([RESULT_IMAGE]);
  });

  describe('4-reference cap', () => {
    it('sends at most the first 4 uploaded images when no mentions are used', async () => {
      const { result } = renderHook(() => useAIEditor());

      act(() => {
        result.current.setImages([IMG_1, IMG_2, IMG_3, IMG_4, IMG_5, IMG_6]);
        result.current.setPrompt('Apply dramatic lighting and warm tone');
      });

      // UI notice should be exposed when > 4 images are uploaded without mentions
      expect(result.current.refLimitNotice).toBe('aiEditor.localQwenRefLimitNotice');

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(localQwenEditImageMock).toHaveBeenCalledTimes(1);
      const callParams = localQwenEditImageMock.mock.calls[0][0];

      // Capped at first 4 images
      expect(callParams.images).toHaveLength(4);
      expect(callParams.images).toEqual([IMG_1, IMG_2, IMG_3, IMG_4]);
    });

    it('rejects before queueing when more than 4 valid mentions are provided', async () => {
      const { result } = renderHook(() => useAIEditor());

      act(() => {
        result.current.setImages([IMG_1, IMG_2, IMG_3, IMG_4, IMG_5, IMG_6]);
        result.current.setPrompt('Blend @img1, @img2, @img3, @img4, and @img5 together');
      });

      // When mentions are present, the 4-ref notice for unmentioned images should not be shown
      expect(result.current.refLimitNotice).toBeNull();

      await act(async () => {
        await result.current.handleGenerate();
      });

      // Must fail validation before calling editImage
      expect(localQwenEditImageMock).not.toHaveBeenCalled();
      expect(result.current.error).toBe('aiEditor.error.tooManyReferences');
      expect(result.current.isLoading).toBe(false);
    });

    it('accepts and preserves author prompt when up to 4 valid mentions are provided', async () => {
      const { result } = renderHook(() => useAIEditor());

      const promptText = 'Blend @img1, @img2, @img3, and @img4 together';
      act(() => {
        result.current.setImages([IMG_1, IMG_2, IMG_3, IMG_4, IMG_5, IMG_6]);
        result.current.setPrompt(promptText);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(localQwenEditImageMock).toHaveBeenCalledTimes(1);
      const callParams = localQwenEditImageMock.mock.calls[0][0];

      expect(callParams.images).toHaveLength(4);
      expect(callParams.images).toEqual([IMG_1, IMG_2, IMG_3, IMG_4]);
      expect(callParams.prompt).toContain(promptText);
    });
  });

  describe('mention filtering', () => {
    it('sends only the explicitly mentioned images when references are present', async () => {
      const { result } = renderHook(() => useAIEditor());

      act(() => {
        result.current.setImages([IMG_1, IMG_2, IMG_3, IMG_4, IMG_5]);
        result.current.setPrompt('Transfer garment style from @img4 to subject in @img2');
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(localQwenEditImageMock).toHaveBeenCalledTimes(1);
      const callParams = localQwenEditImageMock.mock.calls[0][0];

      // Only IMG_2 and IMG_4 should be sent
      expect(callParams.images).toHaveLength(2);
      expect(callParams.images).toEqual([IMG_2, IMG_4]);
    });
  });

  describe('invalid reference rejection before queueing', () => {
    it('rejects out-of-range mention references before calling editImage', async () => {
      const { result } = renderHook(() => useAIEditor());

      act(() => {
        result.current.setImages([IMG_1, IMG_2]);
        result.current.setPrompt('Use style from @img5 on @img1');
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      // Must fail BEFORE calling editImage
      expect(localQwenEditImageMock).not.toHaveBeenCalled();
      expect(result.current.error).toContain('aiEditor.error.invalidImageReferences');
      expect(result.current.error).toContain('@img5');
      expect(result.current.isLoading).toBe(false);
    });

    it('rejects @img0 as invalid reference before calling editImage', async () => {
      const { result } = renderHook(() => useAIEditor());

      act(() => {
        result.current.setImages([IMG_1, IMG_2]);
        result.current.setPrompt('Check @img0');
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(localQwenEditImageMock).not.toHaveBeenCalled();
      expect(result.current.error).toContain('aiEditor.error.invalidImageReferences');
      expect(result.current.error).toContain('@img0');
    });
  });

  describe('prompt authority', () => {
    it('does not silently inject strong identity, pose, or background preservation into the prompt', async () => {
      const { result } = renderHook(() => useAIEditor());

      act(() => {
        result.current.setImages([IMG_1]);
        result.current.setPrompt('Make the character look futuristic with cyberpunk jacket');
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(localQwenEditImageMock).toHaveBeenCalledTimes(1);
      const promptText: string = localQwenEditImageMock.mock.calls[0][0].prompt;

      // User request must be authoritative
      expect(promptText).toContain('Make the character look futuristic with cyberpunk jacket');
      expect(promptText).toContain('LOCAL QWEN IMAGE EDITING');

      // Must NOT silently inject strong cloud identity/background preservation rules
      expect(promptText).not.toContain('Keep subject identity, pose, framing, crop, lighting, colours, and background exactly as they are');
      expect(promptText).not.toContain('Change nothing else');
      expect(promptText).not.toContain('no beauty retouching');
    });

    it('uses minimal image roles framing for multi-image prompts without identity preservation rules', async () => {
      const { result } = renderHook(() => useAIEditor());

      act(() => {
        result.current.setImages([IMG_1, IMG_2]);
        result.current.setPrompt('Apply color palette of @img2 to @img1');
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(localQwenEditImageMock).toHaveBeenCalledTimes(1);
      const promptText: string = localQwenEditImageMock.mock.calls[0][0].prompt;

      expect(promptText).toContain('LOCAL QWEN MULTI-IMAGE EDITING');
      expect(promptText).toContain('- Image 1 is @img1');
      expect(promptText).toContain('- Image 2 is @img2');
      expect(promptText).toContain('Apply color palette of @img2 to @img1');

      // Must NOT contain silent preservation
      expect(promptText).not.toContain('Keep subject identity, pose, framing');
      expect(promptText).not.toContain('Integrate the referenced content as one photograph');
    });
  });

  describe('gallery tagging', () => {
    it('tags generated results in Gallery with localQwen engine tag', async () => {
      const { result } = renderHook(() => useAIEditor());

      act(() => {
        result.current.setImages([IMG_1]);
        result.current.setPrompt('Clean background edit');
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(addImageMock).toHaveBeenCalledTimes(1);
      expect(addImageMock).toHaveBeenCalledWith(RESULT_IMAGE, Feature.AIEditor, 'localQwen');
    });
  });

  describe('zero cloud fallback', () => {
    it('handles errors locally and NEVER calls cloud providers on failure', async () => {
      localQwenEditImageMock.mockRejectedValue(new Error('ComfyUI out of VRAM error'));

      const { result } = renderHook(() => useAIEditor());

      act(() => {
        result.current.setImages([IMG_1]);
        result.current.setPrompt('Stylize image');
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(result.current.error).toContain('ComfyUI out of VRAM error');
      expect(result.current.isLoading).toBe(false);

      // Cloud providers must NEVER be called
      expect(cloudGeminiEditMock).not.toHaveBeenCalled();
      expect(cloudGptEditMock).not.toHaveBeenCalled();
    });
  });

  describe('serialization and re-entrance', () => {
    it('ignores re-entrant generate calls while a request is pending', async () => {
      let resolveJob!: (res: ImageFile[]) => void;
      localQwenEditImageMock.mockImplementation(
        () =>
          new Promise<ImageFile[]>((res) => {
            resolveJob = res;
          }),
      );

      const { result } = renderHook(() => useAIEditor());

      act(() => {
        result.current.setImages([IMG_1]);
        result.current.setPrompt('Single edit');
      });

      let firstPromise: Promise<void>;
      act(() => {
        firstPromise = result.current.handleGenerate();
      });

      // Second re-entrant call while first is in-flight
      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(localQwenEditImageMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveJob([RESULT_IMAGE]);
        await firstPromise;
      });

      expect(result.current.resultImage).toEqual(RESULT_IMAGE);
    });
  });
});
