import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AiScanProvider } from '../../src/contexts/AiScanContext';
import type { AiScanAnalyzer } from '../../src/contexts/AiScanContext';

const addImageMock = vi.fn();

vi.mock('../../src/services/imageEditingService', () => ({
  editImage: vi.fn(),
  upscaleImage: vi.fn(),
}));

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

// vi.mock factories are hoisted above the imports, so the shared context mocks
// have to be pulled in from inside the factory.
vi.mock('../../src/contexts/ApiProviderContext', async () => {
  const { mockUseApi } = await import('../__mocks__/contexts');
  return mockUseApi({ imageEditModel: 'gemini-3.1-flash-image' });
});

vi.mock('../../src/contexts/ImageEngineContext', async () => {
  const { mockUseImageEngine } = await import('../__mocks__/contexts');
  const services = await import('../../src/services/imageEditingService');
  return mockUseImageEngine({ editImage: services.editImage, model: 'gemini-3.1-flash-image' });
});

vi.mock('../../src/contexts/ImageGalleryContext', () => ({
  useImageGallery: () => ({ addImage: addImageMock }),
}));

import { editImage } from '../../src/services/imageEditingService';
import { useBackgroundReplacer } from '../../src/hooks/useBackgroundReplacer';

const SUBJECT = { base64: 'subject-photo', mimeType: 'image/png' };
const RESULT = { base64: 'result-a', mimeType: 'image/png' };

const wrapperFor =
  (analyze: AiScanAnalyzer, initialEnabled?: boolean) =>
  function AiScanWrapper({ children }: { children: ReactNode }) {
    return (
      <AiScanProvider analyze={analyze} initialEnabled={initialEnabled}>
        {children}
      </AiScanProvider>
    );
  };

const promptSent = (callIndex = 0) => vi.mocked(editImage).mock.calls[callIndex][0].prompt;

describe('useBackgroundReplacer + AI Scan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addImageMock.mockReset();
    localStorage.clear();
    vi.mocked(editImage).mockResolvedValue([RESULT]);
  });

  it('sends the scanned blueprint into the generation prompt', async () => {
    const analyze = vi.fn().mockResolvedValue('WEAVE & MATERIAL: matte silk twill with a dry hand.');
    const { result } = renderHook(() => useBackgroundReplacer(), { wrapper: wrapperFor(analyze) });

    act(() => {
      result.current.setSubjectImage(SUBJECT);
      result.current.setPromptText('a sunlit loft');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(editImage).toHaveBeenCalledTimes(1);
    expect(promptSent()).toContain('AI SCAN — TEXTILE & GARMENT DECONSTRUCTION');
    expect(promptSent()).toContain('WEAVE & MATERIAL: matte silk twill with a dry hand.');
    expect(result.current.generatedImages).toEqual([RESULT]);
  });

  it('never analyses and keeps the base prompt when the layer is switched off', async () => {
    const analyze = vi.fn().mockResolvedValue('unused blueprint');
    const { result } = renderHook(() => useBackgroundReplacer(), {
      wrapper: wrapperFor(analyze, false),
    });

    act(() => {
      result.current.setSubjectImage(SUBJECT);
      result.current.setPromptText('a sunlit loft');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(analyze).not.toHaveBeenCalled();
    expect(editImage).toHaveBeenCalledTimes(1);
    expect(promptSent()).toContain('Generate a new photorealistic background: "a sunlit loft".');
    expect(promptSent()).not.toContain('AI SCAN');
  });

  it('still reaches the image model when the analysis fails', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const analyze = vi.fn().mockRejectedValue(new Error('analyzer down'));
    const { result } = renderHook(() => useBackgroundReplacer(), { wrapper: wrapperFor(analyze) });

    act(() => {
      result.current.setSubjectImage(SUBJECT);
      result.current.setPromptText('a sunlit loft');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(editImage).toHaveBeenCalledTimes(1);
    expect(promptSent()).toContain('Generate a new photorealistic background: "a sunlit loft".');
    expect(promptSent()).not.toContain('AI SCAN');
    expect(result.current.generatedImages).toEqual([RESULT]);
    consoleSpy.mockRestore();
  });
});
