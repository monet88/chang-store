import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    imageEditModel: 'gemini-2.5-flash-image',
  }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string>) => (
      params?.refs ? `${key}:${params.refs}` : key
    ),
  }),
}));

vi.mock('@/services/imageEditingService', () => ({
  editImage: vi.fn(),
}));

import { useAIEditor } from '@/hooks/useAIEditor';
import { editImage } from '@/services/imageEditingService';
import { ImageFile } from '@/types';

const FIRST_IMAGE: ImageFile = {
  base64: 'Zmlyc3Q=',
  mimeType: 'image/png',
};

const SECOND_IMAGE: ImageFile = {
  base64: 'c2Vjb25k',
  mimeType: 'image/png',
};

const OUTPUT_IMAGE: ImageFile = {
  base64: 'b3V0cHV0',
  mimeType: 'image/png',
};

describe('useAIEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(editImage).mockResolvedValue([OUTPUT_IMAGE]);
  });

  it('rejects invalid image references without calling the image edit service', async () => {
    const { result } = renderHook(() => useAIEditor());

    act(() => {
      result.current.setImages([FIRST_IMAGE, SECOND_IMAGE]);
      result.current.setPrompt('Use @img99 as the outfit reference');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImage).not.toHaveBeenCalled();
    expect(result.current.error).toBe('aiEditor.error.invalidImageReferences:@img99');
    expect(result.current.isLoading).toBe(false);
  });

  it('sends only valid mentioned images when references are in range', async () => {
    const { result } = renderHook(() => useAIEditor());

    act(() => {
      result.current.setImages([FIRST_IMAGE, SECOND_IMAGE]);
      result.current.setPrompt('Make @img2 match the campaign styling');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImage).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [SECOND_IMAGE],
        prompt: expect.stringContaining('- Image 1 is @img2'),
      }),
      'gemini-2.5-flash-image',
      expect.objectContaining({ onStatusUpdate: expect.any(Function) }),
    );
  });

  it('sends all uploaded images when the prompt has no image mentions', async () => {
    const { result } = renderHook(() => useAIEditor());

    act(() => {
      result.current.setImages([FIRST_IMAGE, SECOND_IMAGE]);
      result.current.setPrompt('Make these images feel more editorial');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImage).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [FIRST_IMAGE, SECOND_IMAGE],
        prompt: expect.stringContaining('# INSTRUCTION: IMAGE EDITING'),
      }),
      'gemini-2.5-flash-image',
      expect.objectContaining({ onStatusUpdate: expect.any(Function) }),
    );
    expect(vi.mocked(editImage).mock.calls[0][0].prompt).not.toContain('MULTI-IMAGE EDITING');
  });

  it('reports an error when the image edit service returns no image', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([]);
    const { result } = renderHook(() => useAIEditor());

    act(() => {
      result.current.setImages([FIRST_IMAGE]);
      result.current.setPrompt('Make this image feel more editorial');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.resultImage).toBeNull();
    expect(result.current.error).toBe('error.api.noImageGenerated');
    expect(result.current.isLoading).toBe(false);
  });

  it('ignores re-entrant generate calls while a request is pending', async () => {
    let resolveEdit!: (images: ImageFile[]) => void;
    vi.mocked(editImage).mockImplementationOnce(() => new Promise((resolve) => {
      resolveEdit = resolve;
    }));
    const { result } = renderHook(() => useAIEditor());

    act(() => {
      result.current.setImages([FIRST_IMAGE]);
      result.current.setPrompt('Make this image feel more editorial');
    });

    let firstGenerate!: Promise<void>;
    let secondGenerate!: Promise<void>;
    await act(async () => {
      firstGenerate = result.current.handleGenerate();
      secondGenerate = result.current.handleGenerate();
      await Promise.resolve();
    });

    expect(editImage).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveEdit([OUTPUT_IMAGE]);
      await firstGenerate;
      await secondGenerate;
    });
  });

  it('sets error when no images are uploaded', async () => {
    const { result } = renderHook(() => useAIEditor());

    act(() => {
      result.current.setPrompt('Edit this image');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImage).not.toHaveBeenCalled();
    expect(result.current.error).toBe('aiEditor.error.noImages');
    expect(result.current.isLoading).toBe(false);
  });

  it('sets error when prompt is empty or whitespace', async () => {
    const { result } = renderHook(() => useAIEditor());

    act(() => {
      result.current.setImages([FIRST_IMAGE]);
      result.current.setPrompt('   ');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImage).not.toHaveBeenCalled();
    expect(result.current.error).toBe('aiEditor.error.noPrompt');
    expect(result.current.isLoading).toBe(false);
  });

  it('propagates service errors as user-facing messages', async () => {
    vi.mocked(editImage).mockRejectedValueOnce(new Error('error.api.safetyBlock'));
    const { result } = renderHook(() => useAIEditor());

    act(() => {
      result.current.setImages([FIRST_IMAGE]);
      result.current.setPrompt('Edit this image');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.resultImage).toBeNull();
    expect(result.current.error).toBe('error.api.safetyBlock');
    expect(result.current.isLoading).toBe(false);
  });

  it('sends only in-range mentioned images when some refs are invalid', async () => {
    const { result } = renderHook(() => useAIEditor());

    act(() => {
      result.current.setImages([FIRST_IMAGE, SECOND_IMAGE]);
      // @img3 is invalid, @img1 and @img2 are valid
      result.current.setPrompt('Combine @img1 with @img3 material');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImage).not.toHaveBeenCalled();
    expect(result.current.error).toBe('aiEditor.error.invalidImageReferences:@img3');
  });
});
