import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const addImageMock = vi.fn();

vi.mock('../../src/services/imageEditingService', () => ({
  editImage: vi.fn(),
}));

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('../../src/contexts/ApiProviderContext', () => ({
  useApi: () => ({ imageEditModel: 'gemini-3.1-flash-image' }),
}));

vi.mock('../../src/contexts/ImageGalleryContext', () => ({
  useImageGallery: () => ({ addImage: addImageMock }),
}));

import { editImage } from '../../src/services/imageEditingService';
import { useIdentityTransfer } from '../../src/hooks/useIdentityTransfer';

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
    addImageMock.mockReset();
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
});
