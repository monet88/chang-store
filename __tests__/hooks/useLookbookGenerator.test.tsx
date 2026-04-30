import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Feature, type ImageFile, type Job } from '../../src/types';
import {
  mockUseLanguage,
  mockUseImageGallery,
  mockUseApi,
} from '../__mocks__/contexts';

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
const queuedJobOutcomes: Array<
  | { type: 'success'; images: ImageFile[] }
  | { type: 'error'; error: Error }
> = [];

vi.mock('../../src/services/imageEditingService', () => ({
  editImage: vi.fn(),
  upscaleImage: vi.fn(),
  createImageChatSession: vi.fn(),
}));

vi.mock('../../src/services/textService', () => ({
  generateClothingDescription: vi.fn(),
}));

vi.mock('../../src/services/jobService', () => ({
  submitJob: (...args: unknown[]) => submitJobMock(...args),
  pollJob: (...args: unknown[]) => pollJobMock(...args),
  getJobResults: (...args: unknown[]) => getJobResultsMock(...args),
  downloadJobResultBlob: (...args: unknown[]) => downloadJobResultBlobMock(...args),
}));

vi.mock('../../src/utils/imageUtils', () => ({
  getErrorMessage: vi.fn((err: Error) => err.message),
}));

vi.mock('../../src/utils/zipDownload', () => ({
  downloadImagesAsZip: vi.fn(),
}));

vi.mock('../../src/contexts/LanguageContext', () => mockUseLanguage());
vi.mock('../../src/contexts/ImageGalleryContext', () => mockUseImageGallery());
vi.mock('../../src/contexts/ApiProviderContext', () => mockUseApi());

vi.mock('../../src/components/LookbookGenerator.prompts', () => ({
  BOXED_PROMPT: 'boxed prompt template',
  FOLDED_PROMPT: 'folded prompt template',
  MANNEQUIN_BACKGROUND_PROMPTS: {
    minimalistShowroom: 'minimalist showroom prompt',
  },
  LookbookStyle: {},
  GarmentType: {},
  FoldedPresentationType: {},
  MannequinBackgroundStyleKey: {},
}));

import { useLookbookGenerator } from '../../src/hooks/useLookbookGenerator';
import { createImageChatSession, upscaleImage } from '../../src/services/imageEditingService';
import { generateClothingDescription } from '../../src/services/textService';
import { downloadImagesAsZip } from '../../src/utils/zipDownload';

const TEST_CLOTHING_IMAGE: ImageFile = {
  base64: 'Y2xvdGhpbmctaW1hZ2U=',
  mimeType: 'image/png',
};

const TEST_FABRIC_IMAGE: ImageFile = {
  base64: 'ZmFicmljLXRleHR1cmU=',
  mimeType: 'image/jpeg',
};

const GENERATED_IMAGE: ImageFile = {
  base64: 'Z2VuZXJhdGVkLXJlc3VsdA==',
  mimeType: 'image/png',
};

const UPSCALED_IMAGE: ImageFile = {
  base64: 'dXBzY2FsZWQtcmVzdWx0',
  mimeType: 'image/png',
};

const REFINED_IMAGE: ImageFile = {
  base64: 'cmVmaW5lZC1pbWFnZQ==',
  mimeType: 'image/png',
};

const VARIATION_IMAGE: ImageFile = {
  base64: 'dmFyaWF0aW9uLWltYWdl',
  mimeType: 'image/png',
};

const DRAFT_STORAGE_KEY = 'lookbookGeneratorDraft';

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

const refineSessionMock = {
  sendRefinement: vi.fn(),
  getHistory: vi.fn(),
  reset: vi.fn(),
};

function makeJob(id: string, feature = 'lookbook', status: Job['status'] = 'completed', errorMessage: string | null = null): Job {
  return {
    id,
    user_id: 'demo',
    feature,
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

function queueJobSuccess(images: ImageFile[]) {
  queuedJobOutcomes.push({ type: 'success', images });
}

function queueJobError(message: string) {
  queuedJobOutcomes.push({ type: 'error', error: new Error(message) });
}

describe('useLookbookGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
    refineSessionMock.sendRefinement.mockReset();
    refineSessionMock.getHistory.mockReset();
    refineSessionMock.reset.mockReset();
    refineSessionMock.getHistory.mockReturnValue([]);
    jobCounter = 0;
    jobResultsStore.clear();
    queuedJobOutcomes.length = 0;

    submitJobMock.mockImplementation(async (feature: string) => {
      const outcome = queuedJobOutcomes.shift() ?? { type: 'success' as const, images: [GENERATED_IMAGE] };
      if (outcome.type === 'error') {
        throw outcome.error;
      }
      const jobId = `job-${++jobCounter}`;
      const storedResults = outcome.images.map((image, index) => ({
        id: `result-${jobId}-${index}`,
        job_id: jobId,
        kind: 'output' as const,
        blob_path: `outputs/${jobId}/${index}.png`,
        mime_type: image.mimeType,
        created_at: '2026-01-01T00:00:00.000Z',
        base64: image.base64,
      }));
      jobResultsStore.set(jobId, storedResults);
      return makeJob(jobId, feature);
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns correct initial state', () => {
    const { result } = renderHook(() => useLookbookGenerator());

    expect(result.current.formState.clothingImages).toHaveLength(1);
    expect(result.current.generatedLookbook).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('loads saved draft from localStorage', () => {
    mockLocalStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      clothingSlotCount: 2,
      clothingDescription: 'A blue dress',
      lookbookStyle: 'mannequin',
      garmentType: 'tops',
      foldedPresentationType: 'boxed',
      mannequinBackgroundStyle: 'minimalistShowroom',
      negativePrompt: 'wrinkles',
      productShotSubType: 'ghost-mannequin',
      includeAccessories: false,
      includeFootwear: false,
      fabricTexturePrompt: '',
    }));

    const { result } = renderHook(() => useLookbookGenerator());

    expect(result.current.formState.clothingDescription).toBe('A blue dress');
    expect(result.current.formState.clothingImages).toHaveLength(2);
    expect(result.current.formState.negativePrompt).toBe('wrinkles');
  });

  it('generates clothing description successfully', async () => {
    vi.mocked(generateClothingDescription).mockResolvedValueOnce('A beautiful red dress');
    const { result } = renderHook(() => useLookbookGenerator());

    act(() => {
      result.current.updateForm({
        clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
      });
    });

    await act(async () => {
      await result.current.handleGenerateDescription();
    });

    expect(generateClothingDescription).toHaveBeenCalledWith(TEST_CLOTHING_IMAGE, 'gemini-2.5-pro');
    expect(result.current.formState.clothingDescription).toBe('A beautiful red dress');
  });

  it('generates main lookbook image through job pipeline', async () => {
    queueJobSuccess([GENERATED_IMAGE]);
    const { result } = renderHook(() => useLookbookGenerator());

    act(() => {
      result.current.updateForm({
        clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
        clothingDescription: 'A red dress',
      });
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(submitJobMock).toHaveBeenCalledWith('lookbook', expect.objectContaining({
      images: [TEST_CLOTHING_IMAGE.base64],
      numberOfImages: 1,
      aspectRatio: result.current.aspectRatio,
      resolution: result.current.resolution,
    }));
    expect(result.current.generatedLookbook?.main).toEqual(GENERATED_IMAGE);
    expect(result.current.activeOutputTab).toBe('main');
  });

  it('includes fabric texture image when provided', async () => {
    queueJobSuccess([GENERATED_IMAGE]);
    const { result } = renderHook(() => useLookbookGenerator());

    act(() => {
      result.current.updateForm({
        clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
        fabricTextureImage: TEST_FABRIC_IMAGE,
        fabricTexturePrompt: 'Silk texture',
      });
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(submitJobMock.mock.calls[0]?.[1]?.images).toEqual([
      TEST_CLOTHING_IMAGE.base64,
      TEST_FABRIC_IMAGE.base64,
    ]);
  });

  it('handles generation error from submitJob', async () => {
    queueJobError('Generation failed');
    const { result } = renderHook(() => useLookbookGenerator());

    act(() => {
      result.current.updateForm({
        clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
      });
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.error).toBe('Generation failed');
    expect(result.current.isLoading).toBe(false);
  });

  it('generates variations successfully', async () => {
    queueJobSuccess([GENERATED_IMAGE]);
    queueJobSuccess([VARIATION_IMAGE, { ...VARIATION_IMAGE, base64: 'variation-2' }]);
    const { result } = renderHook(() => useLookbookGenerator());

    act(() => {
      result.current.updateForm({
        clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
      });
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    await act(async () => {
      await result.current.handleGenerateVariations();
    });

    expect(result.current.generatedLookbook?.variations).toHaveLength(2);
    expect(result.current.isGeneratingVariations).toBe(false);
  });

  it('generates close-ups successfully', async () => {
    queueJobSuccess([GENERATED_IMAGE]);
    queueJobSuccess([{ ...VARIATION_IMAGE, base64: 'closeup-1' }]);
    queueJobSuccess([{ ...VARIATION_IMAGE, base64: 'closeup-2' }]);
    queueJobSuccess([{ ...VARIATION_IMAGE, base64: 'closeup-3' }]);
    const { result } = renderHook(() => useLookbookGenerator());

    act(() => {
      result.current.updateForm({
        clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
      });
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    await act(async () => {
      await result.current.handleGenerateCloseUp();
    });

    expect(result.current.generatedLookbook?.closeups.length).toBeGreaterThan(0);
    expect(result.current.isGeneratingCloseUp).toBe(false);
  });

  it('upscales main image successfully', async () => {
    queueJobSuccess([GENERATED_IMAGE]);
    vi.mocked(upscaleImage).mockResolvedValueOnce(UPSCALED_IMAGE);
    const { result } = renderHook(() => useLookbookGenerator());

    act(() => {
      result.current.updateForm({
        clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
      });
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    await act(async () => {
      await result.current.handleUpscale(GENERATED_IMAGE, 'main-0');
    });

    expect(upscaleImage).toHaveBeenCalledWith(GENERATED_IMAGE, expect.any(String), expect.any(Object));
    expect(result.current.generatedLookbook?.main).toEqual(UPSCALED_IMAGE);
  });

  it('refines generated image and tracks history', async () => {
    queueJobSuccess([GENERATED_IMAGE]);
    vi.mocked(createImageChatSession).mockReturnValue(refineSessionMock as never);
    refineSessionMock.sendRefinement.mockResolvedValueOnce(REFINED_IMAGE);
    refineSessionMock.getHistory.mockReturnValue([{ prompt: 'make it cinematic', timestamp: 1 }]);

    const { result } = renderHook(() => useLookbookGenerator());

    act(() => {
      result.current.updateForm({
        clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
      });
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    await waitFor(() => {
      expect(result.current.chatSession).toBe(refineSessionMock);
    });

    await act(async () => {
      await result.current.handleRefineImage('make it cinematic');
    });

    expect(refineSessionMock.sendRefinement).toHaveBeenCalledWith('make it cinematic', GENERATED_IMAGE);
    expect(result.current.generatedLookbook?.main).toEqual(REFINED_IMAGE);
    expect(result.current.refinementHistory).toEqual([{ prompt: 'make it cinematic', timestamp: 1 }]);
  });

  it('resets refinement session and history', async () => {
    queueJobSuccess([GENERATED_IMAGE]);
    vi.mocked(createImageChatSession).mockReturnValue(refineSessionMock as never);

    const { result } = renderHook(() => useLookbookGenerator());

    act(() => {
      result.current.updateForm({
        clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
      });
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    await waitFor(() => {
      expect(result.current.chatSession).toBe(refineSessionMock);
    });

    act(() => {
      result.current.handleResetRefinement();
    });

    expect(refineSessionMock.reset).toHaveBeenCalledTimes(1);
    expect(result.current.refinementHistory).toEqual([]);
  });

  it('downloads all generated lookbook images as zip', async () => {
    queueJobSuccess([GENERATED_IMAGE]);
    queueJobSuccess([VARIATION_IMAGE]);
    const { result } = renderHook(() => useLookbookGenerator());

    act(() => {
      result.current.updateForm({
        clothingImages: [{ id: 1, image: TEST_CLOTHING_IMAGE }],
      });
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    await act(async () => {
      await result.current.handleGenerateVariations();
    });

    await act(async () => {
      await result.current.handleDownloadAll();
    });

    expect(downloadImagesAsZip).toHaveBeenCalledWith([
      GENERATED_IMAGE,
      VARIATION_IMAGE,
    ], `${Feature.Lookbook}-batch`);
  });
});