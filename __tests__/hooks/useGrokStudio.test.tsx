import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetProviderSettings = vi.fn();
const mockResetProviderSettings = vi.fn();

vi.mock('@/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    providerSettings: {
      grok: { apiKey: 'xai-key', baseUrl: 'https://api.x.ai/v1' },
      gptImage: { apiKey: '', baseUrl: 'https://api.openai.com/v1' },
    },
    setProviderSettings: mockSetProviderSettings,
    resetProviderSettings: mockResetProviderSettings,
  }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('@/services/providers/grok/grokImageService', () => ({
  generateGrokImage: vi.fn(),
  editGrokImage: vi.fn(),
}));

import { useGrokStudio } from '@/hooks/useGrokStudio';
import { generateGrokImage, editGrokImage } from '@/services/providers/grok/grokImageService';
import { Feature, ImageFile } from '@/types';

const RESULT: ImageFile = { base64: 'OUT', mimeType: 'image/png' };
const SOURCE: ImageFile = { base64: 'SRC', mimeType: 'image/jpeg' };

describe('useGrokStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateGrokImage).mockResolvedValue([RESULT]);
    vi.mocked(editGrokImage).mockResolvedValue([RESULT]);
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
});
