import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Job, ImageFile } from '../../src/types';

const addImageMock = vi.fn();
const submitJobMock = vi.fn();
const pollJobMock = vi.fn();
const getJobResultsMock = vi.fn();
const downloadJobResultBlobMock = vi.fn();
let jobCounter = 0;
const jobResultsStore = new Map<string, Array<{
  id: string;
  job_id: string;
  kind: 'output';
  blob_path: string;
  mime_type: string;
  created_at: string;
  base64: string;
}>>();

vi.mock('../../src/services/imageEditingService', () => ({
  editImage: vi.fn(),
  upscaleImage: vi.fn(),
  createImageChatSession: vi.fn(),
}));

vi.mock('../../src/utils/imageUtils', () => ({
  getErrorMessage: vi.fn((error: Error) => error.message),
}));

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../src/contexts/ImageGalleryContext', () => ({
  useImageGallery: () => ({
    images: [],
    addImage: addImageMock,
    deleteImage: vi.fn(),
    clearImages: vi.fn(),
  }),
}));

vi.mock('../../src/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    imageEditModel: 'gemini-2.5-flash-image',
    getModelsForFeature: vi.fn(() => ({
      imageEditModel: 'gemini-2.5-flash-image',
    })),
  }),
}));

vi.mock('../../src/utils/zipDownload', () => ({
  downloadImagesAsZip: vi.fn(),
}));

vi.mock('../../src/services/jobService', () => ({
  submitJob: (...args: unknown[]) => submitJobMock(...args),
  pollJob: (...args: unknown[]) => pollJobMock(...args),
  getJobResults: (...args: unknown[]) => getJobResultsMock(...args),
  downloadJobResultBlob: (...args: unknown[]) => downloadJobResultBlobMock(...args),
}));

import { useClothingTransfer } from '../../src/hooks/useClothingTransfer';
import { createImageChatSession, editImage, upscaleImage } from '../../src/services/imageEditingService';
import { downloadImagesAsZip } from '../../src/utils/zipDownload';

const CONCEPT_A: ImageFile = { base64: 'concept-a', mimeType: 'image/png' };
const CONCEPT_B: ImageFile = { base64: 'concept-b', mimeType: 'image/png' };
const REF_A: ImageFile = { base64: 'ref-a', mimeType: 'image/jpeg' };
const REF_B: ImageFile = { base64: 'ref-b', mimeType: 'image/jpeg' };
const RESULT_A: ImageFile = { base64: 'result-a', mimeType: 'image/png' };
const RESULT_B: ImageFile = { base64: 'result-b', mimeType: 'image/png' };
const UPSCALED: ImageFile = { base64: 'upscaled', mimeType: 'image/png' };
const REFINED: ImageFile = { base64: 'refined', mimeType: 'image/png' };

const refineSessionMock = {
  sendRefinement: vi.fn(),
};

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
};

function makeJob(id: string, status: Job['status'] = 'completed', errorMessage: string | null = null): Job {
  return {
    id,
    user_id: 'demo',
    feature: 'clothing-transfer',
    status,
    idempotency_key: `key-${id}`,
    input_payload_json: {},
    workflow_run_id: null,
    progress_total: 1,
    progress_done: status === 'completed' ? 1 : 0,
    created_at: '2026-01-01T00:00:00.000Z',
    started_at: '2026-01-01T00:00:00.000Z',
    completed_at: status === 'completed' ? '2026-01-01T00:00:01.000Z' : null,
    error_code: errorMessage ? 'FAILED' : null,
    error_message: errorMessage,
  };
}

describe('useClothingTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addImageMock.mockReset();
    refineSessionMock.sendRefinement.mockReset();
    jobCounter = 0;
    jobResultsStore.clear();

    submitJobMock.mockImplementation(async (_feature: string, payload: Record<string, unknown>) => {
      const conceptBase64 = payload.conceptImage as string;
      const bridgedInput = {
        images: [
          { base64: conceptBase64, mimeType: 'image/png' },
          ...((payload.referenceImages as string[] | undefined) ?? []).map((base64) => ({ base64, mimeType: 'image/png' })),
        ],
        prompt: '',
        numberOfImages: payload.numImages as number,
        aspectRatio: payload.aspectRatio,
        resolution: payload.resolution,
        interleavedParts: payload.interleavedParts,
      } as any;
      const generatedImages = await vi.mocked(editImage)(bridgedInput, 'gemini-2.5-flash-image', { onStatusUpdate: vi.fn() });
      const jobId = `job-${++jobCounter}-${conceptBase64}`;
      const storedResults = (generatedImages as ImageFile[]).map((image, index) => ({
        id: `result-${jobId}-${index}`,
        job_id: jobId,
        kind: 'output' as const,
        blob_path: `outputs/${jobId}/${index}.png`,
        mime_type: image.mimeType,
        created_at: '2026-01-01T00:00:00.000Z',
        base64: image.base64,
      }));
      jobResultsStore.set(jobId, storedResults);
      return makeJob(jobId);
    });

    pollJobMock.mockImplementation(async (jobId: string) => makeJob(jobId));
    getJobResultsMock.mockImplementation(async (jobId: string) => ({
      job: makeJob(jobId),
      results: (jobResultsStore.get(jobId) ?? []).map(({ base64, ...result }) => result),
    }));
    downloadJobResultBlobMock.mockImplementation(async (blobPath: string) => {
      for (const results of jobResultsStore.values()) {
        const match = results.find((result) => result.blob_path === blobPath);
        if (match) return match.base64;
      }
      throw new Error(`Blob not found: ${blobPath}`);
    });
  });

  it('sets input error when generate is called without required images', async () => {
    const { result } = renderHook(() => useClothingTransfer());

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.error).toBe('clothingTransfer.inputError');
    expect(editImage).not.toHaveBeenCalled();
  });

  it('tracks multiple concept images as batch items', () => {
    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_A, CONCEPT_B]);
    });

    expect(result.current.conceptItems).toHaveLength(2);
    expect(result.current.conceptImages).toEqual([CONCEPT_A, CONCEPT_B]);
    expect(result.current.selectedConceptItemId).toBe(result.current.conceptItems[0].id);
    expect(result.current.canGenerate).toBe(false);
  });

  it('sends one request per concept image with concept-first ordering', async () => {
    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A])
      .mockResolvedValueOnce([RESULT_B]);

    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_A, CONCEPT_B]);
      result.current.handleReferenceUpload(REF_A, result.current.referenceItems[0].id);
      result.current.handleReferenceLabel('top', result.current.referenceItems[0].id);
      result.current.addReference();
    });

    act(() => {
      result.current.handleReferenceUpload(REF_B, result.current.referenceItems[1].id);
      result.current.handleReferenceLabel('pants', result.current.referenceItems[1].id);
      result.current.setExtraPrompt('keep jewelry visible');
      result.current.setNumImages(2);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(editImage).toHaveBeenCalledTimes(2);
    const images0 = vi.mocked(editImage).mock.calls[0][0].images;
    expect(images0[0]).toEqual(CONCEPT_A);
    expect(images0).toHaveLength(3);
    expect(images0[1]?.base64).toBe(REF_A.base64);
    expect(images0[2]?.base64).toBe(REF_B.base64);

    const images1 = vi.mocked(editImage).mock.calls[1][0].images;
    expect(images1[0]).toEqual(CONCEPT_B);
    expect(images1).toHaveLength(3);
    expect(images1[1]?.base64).toBe(REF_A.base64);
    expect(images1[2]?.base64).toBe(REF_B.base64);

    const textParts = vi.mocked(editImage).mock.calls[0][0].interleavedParts
      ?.filter((part: { text?: string }) => part.text)
      .map((part: { text?: string }) => part.text)
      .join('\n');

    expect(textParts).toContain('DESTINATION SCENE');
    expect(textParts).toContain('SOURCE OUTFIT 1');
    expect(textParts).toContain('keep jewelry visible');
  });

  it('stores per-item errors without aborting sibling concept jobs', async () => {
    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A])
      .mockRejectedValueOnce(new Error('concept failed'));

    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_A, CONCEPT_B]);
      result.current.handleReferenceUpload(REF_A, result.current.referenceItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.completedCount).toBe(1);
    expect(result.current.failedCount).toBe(1);
    expect(result.current.conceptItems[0].status).toBe('completed');
    expect(result.current.conceptItems[1].status).toBe('error');
    expect(result.current.conceptItems[1].error).toBe('concept failed');
  });

  it('starts all concept image requests in the same run before any resolve', async () => {
    const conceptImages = Array.from({ length: 10 }, (_, index) => ({
      base64: `concept-${index}`,
      mimeType: 'image/png',
    }));
    const deferredResults = conceptImages.map(() => createDeferred<Array<typeof RESULT_A>>());

    vi.mocked(editImage).mockImplementation((input) => {
      const conceptBase64 = input.images[0]?.base64;
      const deferredIndex = conceptImages.findIndex((image) => image.base64 === conceptBase64);
      if (deferredIndex === -1) {
        throw new Error(`Unexpected concept image: ${conceptBase64}`);
      }
      return deferredResults[deferredIndex].promise;
    });

    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload(conceptImages);
      result.current.handleReferenceUpload(REF_A, result.current.referenceItems[0].id);
    });

    await act(async () => {
      const pending = result.current.handleGenerate();
      await vi.waitFor(() => {
        expect(editImage).toHaveBeenCalledTimes(10);
      });
      deferredResults.forEach(({ resolve }, index) => {
        resolve([{ base64: `result-${index}`, mimeType: 'image/png' }]);
      });
      await pending;
    });

    conceptImages.forEach((image, index) => {
      expect(vi.mocked(editImage).mock.calls[index][0].images[0]).toEqual(image);
    });
  });

  it('upscales a result inside a concept batch item and saves it to gallery', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
    vi.mocked(upscaleImage).mockResolvedValueOnce(UPSCALED);

    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_A]);
      result.current.handleReferenceUpload(REF_A, result.current.referenceItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    addImageMock.mockClear();
    const itemId = result.current.conceptItems[0].id;

    await act(async () => {
      await result.current.handleUpscale(RESULT_A, 0, itemId);
    });

    expect(upscaleImage).toHaveBeenCalledWith(
      RESULT_A,
      'gemini-2.5-flash-image',
      expect.objectContaining({ onStatusUpdate: expect.any(Function) }),
    );
    expect(result.current.conceptItems[0].results[0]).toEqual(UPSCALED);
    expect(addImageMock).toHaveBeenCalledWith(UPSCALED);
    expect(result.current.upscalingStates[`${itemId}:0`]).toBe(false);
  });

  it('allows unlimited references and keeps one uploader minimum', () => {
    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.addReference();
      result.current.addReference();
      result.current.addReference();
    });
    expect(result.current.referenceItems).toHaveLength(4);

    act(() => {
      result.current.removeReference(result.current.referenceItems[3].id);
      result.current.removeReference(result.current.referenceItems[2].id);
      result.current.removeReference(result.current.referenceItems[1].id);
      result.current.removeReference(result.current.referenceItems[0].id);
    });
    expect(result.current.referenceItems).toHaveLength(1);
  });

  it('refines a generated image and clears the stored prompt when refinement succeeds', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
    vi.mocked(createImageChatSession).mockReturnValue(refineSessionMock as never);
    refineSessionMock.sendRefinement.mockResolvedValueOnce(REFINED);

    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_A]);
      result.current.handleReferenceUpload(REF_A, result.current.referenceItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    const itemId = result.current.conceptItems[0].id;
    const refineKey = `${itemId}:0`;

    act(() => {
      result.current.setRefinePrompts({ [refineKey]: 'make it sharper' });
    });

    await act(async () => {
      await result.current.handleRefine(RESULT_A, 0, itemId, 'make it sharper');
    });

    expect(refineSessionMock.sendRefinement).toHaveBeenCalledWith('make it sharper', RESULT_A);
    expect(result.current.conceptItems[0].results[0]).toEqual(REFINED);
    expect(result.current.refinePrompts[refineKey]).toBe('');
    expect(result.current.isRefining[refineKey]).toBe(false);
    expect(addImageMock).toHaveBeenCalledWith(REFINED);
  });

  it('downloads all completed results as a zip', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A, RESULT_B]);

    const { result } = renderHook(() => useClothingTransfer());

    act(() => {
      result.current.handleConceptImagesUpload([CONCEPT_A]);
      result.current.handleReferenceUpload(REF_A, result.current.referenceItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    await act(async () => {
      await result.current.handleDownloadAll();
    });

    expect(downloadImagesAsZip).toHaveBeenCalledWith([RESULT_A, RESULT_B], 'clothing-transfer-batch');
  });
});
