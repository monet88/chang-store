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

vi.mock('@/services/jobService', () => ({
  submitJob: vi.fn(),
  pollJob: vi.fn(),
  getJobResults: vi.fn(),
  downloadJobResultBlob: vi.fn(),
}));

import { useAIEditor } from '@/hooks/useAIEditor';
import { submitJob, getJobResults, downloadJobResultBlob } from '@/services/jobService';
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

const COMPLETED_JOB = {
  id: 'job-ai-editor-1',
  status: 'completed',
  error_message: null,
};

const OUTPUT_RESULT = {
  kind: 'output',
  blob_path: 'jobs/output-1',
  mime_type: 'image/png',
};

describe('useAIEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(submitJob).mockResolvedValue(COMPLETED_JOB as never);
    vi.mocked(getJobResults).mockResolvedValue({ results: [OUTPUT_RESULT] } as never);
    vi.mocked(downloadJobResultBlob).mockResolvedValue(OUTPUT_IMAGE.base64);
  });

  it('rejects invalid image references without calling submitJob', async () => {
    const { result } = renderHook(() => useAIEditor());

    act(() => {
      result.current.setImages([FIRST_IMAGE, SECOND_IMAGE]);
      result.current.setPrompt('Use @img99 as the outfit reference');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(submitJob).not.toHaveBeenCalled();
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

    expect(submitJob).toHaveBeenCalledWith(
      'ai-editor',
      expect.objectContaining({
        images: [SECOND_IMAGE.base64],
        prompt: expect.stringContaining('- Image 1 is @img2'),
      }),
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

    expect(submitJob).toHaveBeenCalledWith(
      'ai-editor',
      expect.objectContaining({
        images: [FIRST_IMAGE.base64, SECOND_IMAGE.base64],
        prompt: expect.stringContaining('# INSTRUCTION: IMAGE EDITING'),
      }),
    );
    expect(vi.mocked(submitJob).mock.calls[0][1].prompt).not.toContain('MULTI-IMAGE EDITING');
  });

  it('reports an error when the image edit service returns no image', async () => {
    vi.mocked(getJobResults).mockResolvedValueOnce({ results: [] } as never);
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
    let resolveSubmit!: (job: typeof COMPLETED_JOB) => void;
    vi.mocked(submitJob).mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveSubmit = resolve;
      }) as never,
    );

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

    expect(submitJob).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubmit(COMPLETED_JOB);
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

    expect(submitJob).not.toHaveBeenCalled();
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

    expect(submitJob).not.toHaveBeenCalled();
    expect(result.current.error).toBe('aiEditor.error.noPrompt');
    expect(result.current.isLoading).toBe(false);
  });

  it('propagates service errors as user-facing messages', async () => {
    vi.mocked(submitJob).mockRejectedValueOnce(new Error('error.api.safetyBlock'));
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

    expect(submitJob).not.toHaveBeenCalled();
    expect(result.current.error).toBe('aiEditor.error.invalidImageReferences:@img3');
  });
});
