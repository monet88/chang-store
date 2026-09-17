import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetProviderSettings = vi.fn();
const mockResetProviderSettings = vi.fn();

const mockImageProfiles: Array<{
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  lane: 'image';
  driver: 'grok-images';
  enabled: boolean;
}> = [];

vi.mock('@/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    providerSettings: {
      grok: { apiKey: 'xai-key', baseUrl: 'https://api.x.ai/v1' },
      gptImage: { apiKey: '', baseUrl: 'https://api.openai.com/v1' },
    },
    setProviderSettings: mockSetProviderSettings,
    resetProviderSettings: mockResetProviderSettings,
    imageProfiles: mockImageProfiles,
    activeImageProfileId: mockImageProfiles[0]?.id ?? null,
    servedModelsVersion: 0,
    saveGatewayProfiles: vi.fn(),
    selectImageProfile: vi.fn(),
    imageProfileForDriver: () => undefined,
    notifyServedModelsChanged: vi.fn(),
  }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('@/services/providers/grok/grokImageService', () => ({
  generateGrokImage: vi.fn(),
  editGrokImage: vi.fn(),
}));

vi.mock('@/utils/imageUtils', async () => {
  const actual = await vi.importActual<typeof import('@/utils/imageUtils')>('@/utils/imageUtils');
  return { ...actual, compositeMarkerOnImage: vi.fn() };
});

import { useGrokStudio } from '@/hooks/useGrokStudio';
import { generateGrokImage, editGrokImage } from '@/services/providers/grok/grokImageService';
import { listGatewayModels } from '@/services/gatewayDiscoveryService';
import { compositeMarkerOnImage } from '@/utils/imageUtils';
import { Feature, ImageFile } from '@/types';

const RESULT: ImageFile = { base64: 'OUT', mimeType: 'image/png' };
const SOURCE: ImageFile = { base64: 'SRC', mimeType: 'image/jpeg' };
const SUBJECT: ImageFile = { base64: 'SUBJ', mimeType: 'image/jpeg' };

/** Seed the served-model cache through the real probe: the hook reads it synchronously. */
const seedServedModels = async (baseUrl: string, apiKey: string, modelIds: string[]): Promise<void> => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ object: 'list', data: modelIds.map((id) => ({ id })) }),
  })));
  await listGatewayModels({ baseUrl, apiKey });
  vi.unstubAllGlobals();
};

describe('useGrokStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockImageProfiles.length = 0;
    vi.mocked(generateGrokImage).mockResolvedValue([RESULT]);
    vi.mocked(editGrokImage).mockResolvedValue([RESULT]);
  });

  it('lists the models the active profile serves', async () => {
    const mirror = {
      id: 'grok-mirror',
      label: 'grok mirror',
      baseUrl: 'https://api.xai-mirror.test',
      apiKey: 'k',
      lane: 'image' as const,
      driver: 'grok-images' as const,
      enabled: true,
    };
    mockImageProfiles.push(mirror);
    await seedServedModels(mirror.baseUrl, mirror.apiKey, ['grok-imagine-image-2.0']);

    const { result } = renderHook(() => useGrokStudio(Feature.PatternGenerator, 'grok'));

    expect(result.current.modelOptions.map((option) => option.modelId)).toEqual(['grok-imagine-image-2.0']);
    expect(result.current.model).toBe('grok-imagine-image-2.0');
  });

  it('keeps the two pinned models while discovery has not run', () => {
    const { result } = renderHook(() => useGrokStudio(Feature.PatternGenerator, 'grok'));

    expect(result.current.modelOptions.map((option) => option.modelId)).toEqual([
      'grok-imagine-image-quality',
      'grok-imagine-image',
    ]);
  });

  it('reads provider settings from context', () => {
    const { result } = renderHook(() => useGrokStudio(Feature.AIEditor, 'grok'));
    expect(result.current.apiKey).toBe('xai-key');
    expect(result.current.baseUrl).toBe('https://api.x.ai/v1');
  });

  it('routes prompt-only requests to generate', async () => {
    const { result } = renderHook(() => useGrokStudio(Feature.PatternGenerator, 'grok'));

    act(() => {
      result.current.setPrompt('seamless floral pattern');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(generateGrokImage).toHaveBeenCalledTimes(1);
    expect(editGrokImage).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([RESULT]);
  });

  it('routes image requests to edit', async () => {
    const { result } = renderHook(() => useGrokStudio(Feature.AIEditor, 'grok'));

    act(() => {
      result.current.setPrompt('make it black');
      result.current.setImages([SOURCE]);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editGrokImage).toHaveBeenCalledTimes(1);
    expect(generateGrokImage).not.toHaveBeenCalled();
  });

  it('surfaces service errors via getErrorMessage', async () => {
    vi.mocked(generateGrokImage).mockRejectedValue(new Error('error.provider.networkError'));
    const { result } = renderHook(() => useGrokStudio(Feature.PatternGenerator, 'grok'));

    act(() => {
      result.current.setPrompt('x');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.error).toBe('error.provider.networkError');
    expect(result.current.isLoading).toBe(false);
  });

  it('stays silent when the request is aborted', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    vi.mocked(generateGrokImage).mockRejectedValue(abortError);

    const { result } = renderHook(() => useGrokStudio(Feature.PatternGenerator, 'grok'));
    act(() => {
      result.current.setPrompt('x');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.error).toBeNull();
  });

  it('clears workflow state when the active feature changes', async () => {
    const { result, rerender } = renderHook(
      ({ feature }) => useGrokStudio(feature, 'grok'),
      { initialProps: { feature: Feature.AIEditor } },
    );

    act(() => {
      result.current.setPrompt('keep me?');
      result.current.setImages([SOURCE]);
    });

    rerender({ feature: Feature.Lookbook });

    await waitFor(() => {
      expect(result.current.prompt).toBe('');
      expect(result.current.images).toEqual([]);
    });
  });

  it('persists settings changes through context callbacks', () => {
    const { result } = renderHook(() => useGrokStudio(Feature.AIEditor, 'grok'));

    act(() => {
      result.current.setApiKey('new-key');
      result.current.setBaseUrl('https://api.x.ai/v1');
      result.current.resetSettings();
    });

    expect(mockSetProviderSettings).toHaveBeenCalledWith('grok', { apiKey: 'new-key' });
    expect(mockSetProviderSettings).toHaveBeenCalledWith('grok', { baseUrl: 'https://api.x.ai/v1' });
    expect(mockResetProviderSettings).toHaveBeenCalledWith('grok');
  });

  it('refines a result via edit with a preservation prompt and single source', async () => {
    const { result } = renderHook(() => useGrokStudio(Feature.AIEditor, 'grok'));

    act(() => {
      result.current.setPrompt('a cat');
    });
    await act(async () => {
      await result.current.handleGenerate();
    });

    vi.mocked(editGrokImage).mockClear();
    vi.mocked(editGrokImage).mockResolvedValue([{ base64: 'REFINED', mimeType: 'image/png' }]);

    await act(async () => {
      await result.current.refine(0, 'make it blue');
    });

    expect(editGrokImage).toHaveBeenCalledTimes(1);
    const params = vi.mocked(editGrokImage).mock.calls[0][0];
    expect(params.images).toHaveLength(1);
    expect(params.prompt).toContain('make it blue');
    expect(params.prompt).toContain('Preserve everything else');
    expect(result.current.results[0]).toEqual({ base64: 'REFINED', mimeType: 'image/png' });
  });

  it('upscales a result using native 2k resolution', async () => {
    const { result } = renderHook(() => useGrokStudio(Feature.AIEditor, 'grok'));

    act(() => {
      result.current.setPrompt('a dog');
    });
    await act(async () => {
      await result.current.handleGenerate();
    });

    vi.mocked(editGrokImage).mockClear();
    await act(async () => {
      await result.current.upscale(0, '4K');
    });

    const params = vi.mocked(editGrokImage).mock.calls[0][0];
    expect(params.resolution).toBe('2k');
    expect(params.prompt).toContain('4K');
  });

  it('runs a batch job per subject in Try-On mode', async () => {
    const { result } = renderHook(() => useGrokStudio(Feature.TryOn, 'grok'));

    act(() => {
      // image[0] = subject #1, image[1] = clothing source
      result.current.setImages([SUBJECT, SOURCE]);
      result.current.setBatchSubjects([{ base64: 'SUBJ2', mimeType: 'image/jpeg' }]);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    // 2 subjects (image[0] + 1 batch subject) → 2 edit calls.
    await waitFor(() => {
      expect(result.current.batchItems).toHaveLength(2);
      expect(result.current.batchCompletedCount).toBe(2);
    });
    expect(editGrokImage).toHaveBeenCalledTimes(2);
  });

  it('composites the marker when multi-person mode is active', async () => {
    vi.mocked(compositeMarkerOnImage).mockResolvedValue({ base64: 'MARKED', mimeType: 'image/jpeg' });
    const { result } = renderHook(() => useGrokStudio(Feature.TryOn, 'grok'));

    act(() => {
      result.current.setImages([SUBJECT, SOURCE]);
      result.current.setIsMultiPersonMode(true);
      result.current.setMarkerPosition({ x: 1, y: 1, relX: 0.5, relY: 0.5 });
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(compositeMarkerOnImage).toHaveBeenCalledWith(SUBJECT, expect.objectContaining({ relX: 0.5 }));
    const params = vi.mocked(editGrokImage).mock.calls[0][0];
    // image[0] swapped for the marked composite.
    expect(params.images[0]).toEqual({ base64: 'MARKED', mimeType: 'image/jpeg' });
  });
});
