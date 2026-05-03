import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ImageFile, Job } from '../../src/types';

const setSharedJobStateMock = vi.hoisted(() => vi.fn());
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
  compositeMarkerOnImage: vi.fn(),
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

let mockModelName = 'gemini-2.5-flash-image';

vi.mock('../../src/contexts/ApiProviderContext', () => ({
  useApi: () => ({
    imageEditModel: mockModelName,
    getModelsForFeature: vi.fn(() => ({
      imageEditModel: mockModelName,
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

vi.mock('../../src/hooks/useJobPoll', () => ({
  setSharedJobState: (...args: unknown[]) => setSharedJobStateMock(...args),
}));

import { useVirtualTryOn } from '../../src/hooks/useVirtualTryOn';
import { compositeMarkerOnImage } from '../../src/utils/imageUtils';
import { createImageChatSession, editImage, upscaleImage } from '../../src/services/imageEditingService';
import { downloadImagesAsZip } from '../../src/utils/zipDownload';

const SUBJECT_A: ImageFile = { base64: 'subject-a', mimeType: 'image/png' };
const SUBJECT_B: ImageFile = { base64: 'subject-b', mimeType: 'image/png' };
const OUTFIT_A: ImageFile = { base64: 'outfit-a', mimeType: 'image/jpeg' };
const OUTFIT_B: ImageFile = { base64: 'outfit-b', mimeType: 'image/jpeg' };
const RESULT_A: ImageFile = { base64: 'result-a', mimeType: 'image/png' };
const RESULT_B: ImageFile = { base64: 'result-b', mimeType: 'image/png' };
const UPSCALED: ImageFile = { base64: 'upscaled', mimeType: 'image/png' };
const REFINED: ImageFile = { base64: 'refined', mimeType: 'image/png' };
const MARKER = { x: 10, y: 20, relX: 0.25, relY: 0.5 };

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
    feature: 'try-on',
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

describe('useVirtualTryOn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    setSharedJobStateMock.mockReset();
    addImageMock.mockReset();
    mockModelName = 'gemini-2.5-flash-image';
    refineSessionMock.sendRefinement.mockReset();
    jobCounter = 0;
    jobResultsStore.clear();

    submitJobMock.mockImplementation(async (_feature: string, payload: Record<string, unknown>) => {
      const subjectBase64 = payload.personImage as string;
      const bridgedInput = {
        images: [],
        prompt: '',
        numberOfImages: payload.numImages as number,
        aspectRatio: payload.aspectRatio,
        resolution: payload.resolution,
        interleavedParts: payload.interleavedParts,
      } as any;
      const generatedImages = await vi.mocked(editImage)(bridgedInput, mockModelName, { onStatusUpdate: vi.fn() });

      const jobId = `job-${++jobCounter}-${subjectBase64}`;
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
    const { result } = renderHook(() => useVirtualTryOn());

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    expect(result.current.error).toBe('virtualTryOn.inputError');
    expect(editImage).not.toHaveBeenCalled();
  });

  it('tracks multiple subject images as batch items', () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A, SUBJECT_B]);
    });

    expect(result.current.subjectItems).toHaveLength(2);
    expect(result.current.subjectImages).toEqual([SUBJECT_A, SUBJECT_B]);
    expect(result.current.selectedSubjectItemId).toBe(result.current.subjectItems[0].id);
    expect(result.current.canGenerate).toBe(false);
  });

  it('runs one try-on request per subject image with shared outfit inputs', async () => {
    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A])
      .mockResolvedValueOnce([RESULT_B]);

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A, SUBJECT_B]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
      result.current.addClothingUploader();
    });

    act(() => {
      result.current.handleClothingUpload(OUTFIT_B, result.current.clothingItems[1].id);
      result.current.setNumImages(2);
      result.current.setAspectRatio('3:4');
      result.current.setResolution('2K');
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });



    expect(editImage).toHaveBeenCalledTimes(2);

    const call0 = vi.mocked(editImage).mock.calls[0][0];
    expect(call0.images).toEqual([]);
    expect(call0.prompt).toBe('');
    expect(call0.numberOfImages).toBe(2);
    expect(call0.aspectRatio).toBe('3:4');
    expect(call0.resolution).toBe('2K');
    expect(call0.interleavedParts?.[1].inlineData?.data).toBe('subject-a');

    const call1 = vi.mocked(editImage).mock.calls[1][0];
    expect(call1.interleavedParts?.[1].inlineData?.data).toBe('subject-b');


  });

  it('keeps successful items when one batch item fails', async () => {
    vi.mocked(editImage)
      .mockResolvedValueOnce([RESULT_A])
      .mockRejectedValueOnce(new Error('subject failed'));

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A, SUBJECT_B]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    expect(result.current.completedCount).toBe(1);
    expect(result.current.failedCount).toBe(1);
    expect(result.current.subjectItems[0].status).toBe('completed');
    expect(result.current.subjectItems[1].status).toBe('error');
    expect(result.current.subjectItems[1].error).toBe('subject failed');
  });

  it('keeps shared polling active until every subject job reaches a terminal state', async () => {
    vi.useFakeTimers();
    submitJobMock.mockImplementation(async (_feature: string, payload: Record<string, unknown>) => makeJob(`job-${payload.personImage as string}`, 'queued'));
    let secondPollCount = 0;
    pollJobMock.mockImplementation(async (jobId: string) => {
      if (jobId === 'job-subject-b') {
        secondPollCount += 1;
        return makeJob(jobId, secondPollCount === 1 ? 'running' : 'completed');
      }

      return makeJob(jobId, 'completed');
    });
    getJobResultsMock.mockResolvedValue({ job: makeJob('job'), results: [] });

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A, SUBJECT_B]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    const generationPromise = act(async () => {
      await result.current.handleGenerateImage();
    });

    await vi.waitFor(() => {
      expect(setSharedJobStateMock).toHaveBeenCalledWith(expect.objectContaining({
        job: expect.objectContaining({ id: 'job-subject-a', status: 'completed' }),
        isPolling: true,
      }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    await generationPromise;
    vi.useRealTimers();
  });

  it('starts all subject image requests in the same run before any resolve', async () => {
    const subjectImages = Array.from({ length: 10 }, (_, index) => ({
      base64: `subject-${index}`,
      mimeType: 'image/png',
    }));
    const deferredResults = subjectImages.map(() => createDeferred<Array<typeof RESULT_A>>());

    vi.mocked(editImage).mockImplementation((input) => {
      const subjectBase64 = input.interleavedParts?.[1]?.inlineData?.data;
      const deferredIndex = subjectImages.findIndex((image) => image.base64 === subjectBase64);
      if (deferredIndex === -1) {
        throw new Error(`Unexpected subject image: ${subjectBase64}`);
      }
      return deferredResults[deferredIndex].promise;
    });

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload(subjectImages);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    const generationPromise = act(async () => {
      await result.current.handleGenerateImage();
    });

    await vi.waitFor(() => {
      expect(editImage).toHaveBeenCalledTimes(10);
    });

    subjectImages.forEach((image, index) => {
      expect(vi.mocked(editImage).mock.calls[index][0].interleavedParts?.[1]?.inlineData?.data).toBe(image.base64);
    });

    deferredResults.forEach(({ resolve }, index) => {
      resolve([{ base64: `result-${index}`, mimeType: 'image/png' }]);
    });

    await generationPromise;

  });

  it('clears marker position when multi-person mode is turned off', () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.setMarkerPosition(MARKER);
      result.current.setIsMultiPersonMode(true);
    });

    act(() => {
      result.current.setIsMultiPersonMode(false);
    });

    expect(result.current.markerPosition).toBeNull();
    expect(result.current.isMultiPersonMode).toBe(false);
  });

  it('caps clothing uploaders at the shared outfit image limit', () => {
    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.addClothingUploader();
      result.current.addClothingUploader();
    });

    expect(result.current.clothingItems).toHaveLength(2);
  });

  it('upscales a result inside the selected batch item', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
    vi.mocked(upscaleImage).mockResolvedValueOnce(UPSCALED);

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    const itemId = result.current.subjectItems[0].id;

    await act(async () => {
      await result.current.handleUpscale(RESULT_A, 0, itemId);
    });

    expect(upscaleImage).toHaveBeenCalledWith(
      RESULT_A,
      'gemini-2.5-flash-image',
      expect.objectContaining({ onStatusUpdate: expect.any(Function) }),
    );
    expect(result.current.subjectItems[0].results[0]).toEqual(UPSCALED);
    expect(result.current.upscalingStates[`${itemId}:0`]).toBe(false);
  });

  it('refines a generated image and clears the stored prompt', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
    vi.mocked(createImageChatSession).mockReturnValue(refineSessionMock as never);
    refineSessionMock.sendRefinement.mockResolvedValueOnce(REFINED);

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    const itemId = result.current.subjectItems[0].id;
    const refineKey = `${itemId}:0`;

    act(() => {
      result.current.setRefinePrompts({ [refineKey]: 'make it cleaner' });
    });

    await act(async () => {
      await result.current.handleRefine(RESULT_A, 0, itemId, 'make it cleaner');
    });

    expect(refineSessionMock.sendRefinement).toHaveBeenCalledWith('make it cleaner', RESULT_A);
    expect(result.current.subjectItems[0].results[0]).toEqual(REFINED);
    expect(result.current.refinePrompts[refineKey]).toBe('');
    expect(result.current.isRefining[refineKey]).toBe(false);
  });

  it('downloads all completed results as a zip', async () => {
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A, RESULT_B]);

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    await act(async () => {
      await result.current.handleDownloadAll();
    });

    expect(downloadImagesAsZip).toHaveBeenCalledWith([RESULT_A, RESULT_B], 'try-on-batch');
  });

  it('composites marker onto subject image when multi-person mode is enabled', async () => {
    vi.mocked(compositeMarkerOnImage).mockResolvedValueOnce({
      base64: 'subject-a-marked',
      mimeType: 'image/png',
    } as never);
    vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);

    const { result } = renderHook(() => useVirtualTryOn());

    act(() => {
      result.current.handleSubjectImagesUpload([SUBJECT_A]);
      result.current.handleClothingUpload(OUTFIT_A, result.current.clothingItems[0].id);
      result.current.setMarkerPosition(MARKER);
      result.current.setIsMultiPersonMode(true);
    });

    await act(async () => {
      await result.current.handleGenerateImage();
    });

    expect(compositeMarkerOnImage).toHaveBeenCalledWith(SUBJECT_A, MARKER);
  });
});
