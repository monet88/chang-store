import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Feature } from '../../src/types';

const addImageMock = vi.fn();

vi.mock('../../src/services/imageEditingService', () => ({
  editImage: vi.fn(),
}));

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));
const activeEngine = vi.hoisted(() => ({
  id: 'gemini' as 'gemini' | 'gptImage',
  model: 'gemini-3.1-flash-image',
}));

// The hook takes its transport from the studio-scoped engine (issue #152
// Decision 3), so the same service spy feeds the engine mock.
vi.mock('../../src/contexts/ImageEngineContext', async () => {
  const { mockUseImageEngine: createEngineMock } = await import('../__mocks__/contexts');
  const services = await import('../../src/services/imageEditingService');
  return createEngineMock({
    editImage: services.editImage,
    get id() {
      return activeEngine.id;
    },
    get model() {
      return activeEngine.model;
    },
  });
});

vi.mock('../../src/contexts/ImageGalleryContext', () => ({
  useImageGallery: () => ({ addImage: addImageMock }),
}));

const defaultsMock = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock('../../src/utils/identity-transfer-defaults', () => ({
  loadDefaultIdentityReferences: defaultsMock.load,
}));

import { editImage } from '../../src/services/imageEditingService';
import { AiScanProvider, type AiScanAnalyzer } from '../../src/contexts/AiScanContext';
import { useIdentityTransfer } from '../../src/hooks/useIdentityTransfer';
import type { DefaultIdentityReferences } from '../../src/utils/identity-transfer-defaults';
import type { ReactNode } from 'react';

const DESTINATION_A = { base64: 'destination-a', mimeType: 'image/png' };
const DESTINATION_B = { base64: 'destination-b', mimeType: 'image/png' };
const FACE = { base64: 'face-reference', mimeType: 'image/jpeg' };
const BODY = { base64: 'body-reference', mimeType: 'image/jpeg' };
const RESULT_A = { base64: 'result-a', mimeType: 'image/png' };
const RESULT_B = { base64: 'result-b', mimeType: 'image/png' };
const EXTRA_RESULT = { base64: 'unexpected-extra', mimeType: 'image/png' };

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
};

const imageData = (callIndex: number) =>
  vi.mocked(editImage).mock.calls[callIndex][0].interleavedParts
    ?.filter((part) => part.inlineData)
    .map((part) => part.inlineData?.data);

const textData = (callIndex: number) =>
  vi.mocked(editImage).mock.calls[callIndex][0].interleavedParts
    ?.filter((part) => part.text)
    .map((part) => part.text)
    .join('\n') ?? '';

describe('useIdentityTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeEngine.id = 'gemini';
    activeEngine.model = 'gemini-3.1-flash-image';
    addImageMock.mockReset();
    defaultsMock.load.mockReset().mockReturnValue(createDeferred<DefaultIdentityReferences>().promise);
  });

  it('requires destination images and a shared Face Reference', async () => {
    const { result } = renderHook(() => useIdentityTransfer());

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.error).toBe('identityTransfer.inputError');
    expect(editImage).not.toHaveBeenCalled();
  });

  it('runs one single-output request per destination with shared references and settings', async () => {
    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A, EXTRA_RESULT])
      .mockResolvedValueOnce([RESULT_B, EXTRA_RESULT]);

    const { result } = renderHook(() => useIdentityTransfer());

    act(() => {
      result.current.handleDestinationImagesUpload([DESTINATION_A, DESTINATION_B]);
      result.current.setFaceReference(FACE);
      result.current.setBodyReference(BODY);
      result.current.setBackgroundPrompt('soft grey studio');
      result.current.setExtraPrompt('keep necklace visible');
      result.current.setAspectRatio('3:4');
      result.current.setResolution('2K');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImage).toHaveBeenCalledTimes(2);
    expect(imageData(0)).toEqual(['destination-a', 'face-reference', 'body-reference']);
    expect(imageData(1)).toEqual(['destination-b', 'face-reference', 'body-reference']);
    expect(textData(0)).toContain('soft grey studio');
    expect(textData(0)).toContain('keep necklace visible');
    expect(textData(1)).toContain('soft grey studio');
    expect(textData(1)).toContain('keep necklace visible');

    for (const [input] of vi.mocked(editImage).mock.calls) {
      expect(input.images).toEqual([]);
      expect(input.prompt).toBe('');
      expect(input.numberOfImages).toBe(1);
      expect(input.aspectRatio).toBe('3:4');
      expect(input.resolution).toBe('2K');
    }

    expect(result.current.destinationItems.map((item) => item.results)).toEqual([
      [RESULT_A],
      [RESULT_B],
    ]);
    expect(result.current.completedCount).toBe(2);
    expect(result.current.failedCount).toBe(0);
    expect(addImageMock).toHaveBeenCalledTimes(2);
    expect(addImageMock).toHaveBeenNthCalledWith(1, RESULT_A, Feature.IdentityTransfer, 'gemini');
    expect(addImageMock).toHaveBeenNthCalledWith(2, RESULT_B, Feature.IdentityTransfer, 'gemini');
  });

  it('caps active destination requests at four and queues destinations beyond the cap', async () => {
    const destinations = Array.from({ length: 7 }, (_, index) => ({
      base64: `destination-${index}`,
      mimeType: 'image/png',
    }));
    const deferred = destinations.map(() => createDeferred<Array<typeof RESULT_A>>());
    let activeRequests = 0;
    let maxActiveRequests = 0;

    vi.mocked(editImage).mockImplementation((input) => {
      const destination = input.interleavedParts?.[1]?.inlineData?.data;
      const index = destinations.findIndex((image) => image.base64 === destination);
      if (index < 0) throw new Error(`Unexpected destination ${destination}`);

      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      return deferred[index].promise.finally(() => {
        activeRequests -= 1;
      });
    });

    const { result } = renderHook(() => useIdentityTransfer());
    act(() => {
      result.current.handleDestinationImagesUpload(destinations);
      result.current.setFaceReference(FACE);
    });

    let generationPromise!: Promise<void>;
    act(() => {
      generationPromise = result.current.handleGenerate();
    });

    await vi.waitFor(() => expect(editImage).toHaveBeenCalledTimes(4));
    expect(activeRequests).toBe(4);

    await act(async () => {
      deferred.slice(0, 4).forEach(({ resolve }, index) => resolve([
        { base64: `result-${index}`, mimeType: 'image/png' },
      ]));
      await Promise.resolve();
    });

    await vi.waitFor(() => expect(editImage).toHaveBeenCalledTimes(7));
    await act(async () => {
      deferred.slice(4).forEach(({ resolve }, offset) => resolve([
        { base64: `result-${offset + 4}`, mimeType: 'image/png' },
      ]));
      await generationPromise;
    });
    expect(maxActiveRequests).toBe(4);
    expect(result.current.completedCount).toBe(7);
  });

  it('keeps successful destination results when one destination fails', async () => {
    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A])
      .mockRejectedValueOnce(new Error('destination failed'))
      .mockResolvedValueOnce([RESULT_B]);

    const { result } = renderHook(() => useIdentityTransfer());
    act(() => {
      result.current.handleDestinationImagesUpload([
        DESTINATION_A,
        DESTINATION_B,
        { base64: 'destination-c', mimeType: 'image/png' },
      ]);
      result.current.setFaceReference(FACE);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.destinationItems.map((item) => item.status)).toEqual([
      'completed',
      'error',
      'completed',
    ]);
    expect(result.current.destinationItems[0].results).toEqual([RESULT_A]);
    expect(result.current.destinationItems[1].error).toBe('destination failed');
    expect(result.current.destinationItems[2].results).toEqual([RESULT_B]);
    expect(result.current.completedCount).toBe(2);
    expect(result.current.failedCount).toBe(1);
  });

  it('regenerates only the requested destination item', async () => {
    const regenerated = { base64: 'result-b-regenerated', mimeType: 'image/png' };
    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A])
      .mockResolvedValueOnce([RESULT_B])
      .mockResolvedValueOnce([regenerated]);

    const { result } = renderHook(() => useIdentityTransfer());
    act(() => {
      result.current.handleDestinationImagesUpload([DESTINATION_A, DESTINATION_B]);
      result.current.setFaceReference(FACE);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    const secondId = result.current.destinationItems[1].id;
    await act(async () => {
      await result.current.handleRegenerateSingle(secondId);
    });

    expect(editImage).toHaveBeenCalledTimes(3);
    expect(result.current.destinationItems[0].results).toEqual([RESULT_A]);
    expect(result.current.destinationItems[1].results).toEqual([regenerated]);
  });

  it('ignores a new generation operation while a single regeneration is still in flight', async () => {
    const regenerated = { base64: 'result-b-regenerated', mimeType: 'image/png' };
    const deferred = createDeferred<Array<typeof RESULT_A>>();

    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A])
      .mockResolvedValueOnce([RESULT_B])
      .mockImplementationOnce(() => deferred.promise);

    const { result } = renderHook(() => useIdentityTransfer());
    act(() => {
      result.current.handleDestinationImagesUpload([DESTINATION_A, DESTINATION_B]);
      result.current.setFaceReference(FACE);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });
    expect(editImage).toHaveBeenCalledTimes(2);

    const secondId = result.current.destinationItems[1].id;
    let regeneration!: Promise<void>;
    act(() => {
      regeneration = result.current.handleRegenerateSingle(secondId);
    });
    await vi.waitFor(() => expect(editImage).toHaveBeenCalledTimes(3));

    await act(async () => {
      await result.current.handleRegenerateSingle(secondId);
      await result.current.handleGenerate();
    });
    expect(editImage).toHaveBeenCalledTimes(3);

    await act(async () => {
      deferred.resolve([regenerated]);
      await regeneration;
    });

    expect(editImage).toHaveBeenCalledTimes(3);
    expect(result.current.destinationItems[0].results).toEqual([RESULT_A]);
    expect(result.current.destinationItems[1].results).toEqual([regenerated]);
  });

  it('allows a later regeneration once the in-flight one resolves', async () => {
    const first = { base64: 'result-b-first', mimeType: 'image/png' };
    const second = { base64: 'result-b-second', mimeType: 'image/png' };
    const deferred = createDeferred<Array<typeof RESULT_A>>();

    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A])
      .mockResolvedValueOnce([RESULT_B])
      .mockImplementationOnce(() => deferred.promise)
      .mockResolvedValueOnce([second]);

    const { result } = renderHook(() => useIdentityTransfer());
    act(() => {
      result.current.handleDestinationImagesUpload([DESTINATION_A, DESTINATION_B]);
      result.current.setFaceReference(FACE);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    const secondId = result.current.destinationItems[1].id;
    let regeneration!: Promise<void>;
    act(() => {
      regeneration = result.current.handleRegenerateSingle(secondId);
    });
    await vi.waitFor(() => expect(editImage).toHaveBeenCalledTimes(3));

    await act(async () => {
      deferred.resolve([first]);
      await regeneration;
    });

    await act(async () => {
      await result.current.handleRegenerateSingle(secondId);
    });

    expect(editImage).toHaveBeenCalledTimes(4);
    expect(result.current.destinationItems[1].results).toEqual([second]);
  });

  it('uses the no-body prompt branch when Body Reference is omitted', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
    const { result } = renderHook(() => useIdentityTransfer());

    act(() => {
      result.current.handleDestinationImagesUpload([DESTINATION_A]);
      result.current.setFaceReference(FACE);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(imageData(0)).toEqual(['destination-a', 'face-reference']);
    expect(textData(0)).toContain('No Body Reference is provided');
    expect(textData(0)).toContain('Preserve the Destination Image body morphology and proportions');
  });

  it('pre-fills the built-in Face and Body references on mount', async () => {
    const deferred = createDeferred<DefaultIdentityReferences>();
    defaultsMock.load.mockReturnValue(deferred.promise);

    const { result } = renderHook(() => useIdentityTransfer());
    expect(result.current.faceReference).toBeNull();

    await act(async () => {
      deferred.resolve({ face: FACE, body: BODY });
      await deferred.promise;
    });

    expect(result.current.faceReference).toEqual(FACE);
    expect(result.current.bodyReference).toEqual(BODY);
  });

  it('keeps a user-uploaded reference that lands before the default resolves', async () => {
    const deferred = createDeferred<DefaultIdentityReferences>();
    defaultsMock.load.mockReturnValue(deferred.promise);
    const userFace = { base64: 'user-face', mimeType: 'image/jpeg' };

    const { result } = renderHook(() => useIdentityTransfer());
    act(() => {
      result.current.setFaceReference(userFace);
    });

    await act(async () => {
      deferred.resolve({ face: FACE, body: BODY });
      await deferred.promise;
    });

    expect(result.current.faceReference).toEqual(userFace);
    expect(result.current.bodyReference).toEqual(BODY);
  });

  it('does not restore the default body after the user clears it', async () => {
    const deferred = createDeferred<DefaultIdentityReferences>();
    defaultsMock.load.mockReturnValue(deferred.promise);

    const { result } = renderHook(() => useIdentityTransfer());
    act(() => {
      result.current.setBodyReference(null);
    });

    await act(async () => {
      deferred.resolve({ face: FACE, body: BODY });
      await deferred.promise;
    });

    expect(result.current.bodyReference).toBeNull();
    expect(result.current.faceReference).toEqual(FACE);
  });

  describe('AI scan', () => {
    const BLUEPRINT = 'WEAVE & MATERIAL: plissé accordion pleats; satin facing at the neckline.';

    const scanWrapper = (analyze: AiScanAnalyzer, enabled: boolean) =>
      function Wrapper({ children }: { children: ReactNode }) {
        return (
          <AiScanProvider analyze={analyze} initialEnabled={enabled}>
            {children}
          </AiScanProvider>
        );
      };

    it('scans the destination photos and splices the blueprint into every prompt', async () => {
      const analyze = vi.fn<AiScanAnalyzer>().mockResolvedValue(BLUEPRINT);
      vi.mocked(editImage)
        .mockResolvedValueOnce([RESULT_A])
        .mockResolvedValueOnce([RESULT_B]);

      const { result } = renderHook(() => useIdentityTransfer(), { wrapper: scanWrapper(analyze, true) });
      act(() => {
        result.current.handleDestinationImagesUpload([DESTINATION_A, DESTINATION_B]);
        result.current.setFaceReference(FACE);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(analyze).toHaveBeenCalledTimes(2);
      expect(textData(0)).toContain('AI SCAN — TEXTILE & GARMENT DECONSTRUCTION');
      expect(textData(0)).toContain(BLUEPRINT);
      expect(textData(1)).toContain(BLUEPRINT);
      expect(result.current.completedCount).toBe(2);
    });

    it('deconstructs each destination on its own, never another photo\'s outfit', async () => {
      const analyze = vi.fn<AiScanAnalyzer>(async (image) =>
        image === DESTINATION_A ? 'DESTINATION A BLUEPRINT: silk satin' : 'DESTINATION B BLUEPRINT: raw denim');
      vi.mocked(editImage).mockResolvedValue([RESULT_A]);

      const { result } = renderHook(() => useIdentityTransfer(), { wrapper: scanWrapper(analyze, true) });
      act(() => {
        result.current.handleDestinationImagesUpload([DESTINATION_A, DESTINATION_B]);
        result.current.setFaceReference(FACE);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      const prompts = [textData(0), textData(1)];

      // A destination prompt must carry its own fabrics only.
      expect(prompts.filter((prompt) => prompt.includes('DESTINATION A BLUEPRINT'))).toHaveLength(1);
      expect(prompts.filter((prompt) => prompt.includes('DESTINATION B BLUEPRINT'))).toHaveLength(1);
    });

    it('leaves the prompts untouched when the layer is off', async () => {
      const analyze = vi.fn<AiScanAnalyzer>().mockResolvedValue(BLUEPRINT);
      vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);

      const { result } = renderHook(() => useIdentityTransfer(), { wrapper: scanWrapper(analyze, false) });
      act(() => {
        result.current.handleDestinationImagesUpload([DESTINATION_A]);
        result.current.setFaceReference(FACE);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(analyze).not.toHaveBeenCalled();
      expect(textData(0)).not.toContain('AI SCAN');
      expect(result.current.destinationItems[0].results).toEqual([RESULT_A]);
    });

    it('still generates when the analysis fails', async () => {
      const analyze = vi.fn<AiScanAnalyzer>().mockRejectedValue(new Error('scan down'));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);

      const { result } = renderHook(() => useIdentityTransfer(), { wrapper: scanWrapper(analyze, true) });
      act(() => {
        result.current.handleDestinationImagesUpload([DESTINATION_A]);
        result.current.setFaceReference(FACE);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(result.current.destinationItems[0].status).toBe('completed');
      expect(result.current.destinationItems[0].results).toEqual([RESULT_A]);
      expect(textData(0)).not.toContain('AI SCAN');
      warn.mockRestore();
    });
  });

  describe('GPT Studio Mode', () => {
    beforeEach(() => {
      activeEngine.id = 'gptImage';
      activeEngine.model = 'gpt-image-2';
    });

    it('uses GPT-owned flat prompt policy, exposes engineId, and tags gallery images with gptImage', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);

      const { result } = renderHook(() => useIdentityTransfer());
      expect(result.current.engineId).toBe('gptImage');

      act(() => {
        result.current.handleDestinationImagesUpload([DESTINATION_A]);
        result.current.setFaceReference(FACE);
        result.current.setBodyReference(BODY);
        result.current.setBackgroundPrompt('dramatic night studio');
        result.current.setExtraPrompt('soft rim lighting');
        result.current.setAspectRatio('3:4');
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(editImage).toHaveBeenCalledTimes(1);
      const callInput = vi.mocked(editImage).mock.calls[0][0];
      const parts = callInput.interleavedParts ?? [];

      // GPT Image lane: single leading text part with role map, followed by referenced images in order
      expect(parts).toHaveLength(4);
      expect(parts[0].text).toContain('IMAGE 1 = DESTINATION IMAGE:');
      expect(parts[0].text).toContain('IMAGE 2 = FACE REFERENCE:');
      expect(parts[0].text).toContain('IMAGE 3 = BODY REFERENCE:');
      expect(parts[0].text).toContain('dramatic night studio');
      expect(parts[0].text).toContain('soft rim lighting');
      expect(parts[1].inlineData?.data).toBe('destination-a');
      expect(parts[2].inlineData?.data).toBe('face-reference');
      expect(parts[3].inlineData?.data).toBe('body-reference');

      expect(addImageMock).toHaveBeenCalledTimes(1);
      expect(addImageMock).toHaveBeenCalledWith(RESULT_A, Feature.IdentityTransfer, 'gptImage');
      expect(result.current.completedCount).toBe(1);
    });

    it('preserves regenerate-one gating and successful siblings in GPT Studio Mode', async () => {
      vi.mocked(editImage)
        .mockResolvedValueOnce([RESULT_A])
        .mockRejectedValueOnce(new Error('gpt destination failed'));

      const { result } = renderHook(() => useIdentityTransfer());
      act(() => {
        result.current.handleDestinationImagesUpload([DESTINATION_A, DESTINATION_B]);
        result.current.setFaceReference(FACE);
      });

      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(result.current.destinationItems[0].status).toBe('completed');
      expect(result.current.destinationItems[0].results).toEqual([RESULT_A]);
      expect(result.current.destinationItems[1].status).toBe('error');
      expect(result.current.destinationItems[1].error).toBe('gpt destination failed');
      expect(result.current.completedCount).toBe(1);
      expect(result.current.failedCount).toBe(1);

      // Regenerate the failed sibling
      const regenerated = { base64: 'result-b-retry', mimeType: 'image/png' };
      vi.mocked(editImage).mockResolvedValueOnce([regenerated]);

      const secondId = result.current.destinationItems[1].id;
      await act(async () => {
        await result.current.handleRegenerateSingle(secondId);
      });

      expect(result.current.destinationItems[0].results).toEqual([RESULT_A]);
      expect(result.current.destinationItems[1].results).toEqual([regenerated]);
      expect(result.current.destinationItems[1].status).toBe('completed');
      expect(addImageMock).toHaveBeenLastCalledWith(regenerated, Feature.IdentityTransfer, 'gptImage');
    });
  });
});
