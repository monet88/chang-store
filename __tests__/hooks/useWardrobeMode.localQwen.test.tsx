import type * as QwenPromptModule from '../../src/utils/qwen-virtual-try-on-prompt';
import type * as GeminiPromptModule from '../../src/utils/gemini-virtual-try-on-prompt';
import type * as GptPromptModule from '../../src/utils/gpt-virtual-try-on-prompt';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { mockUseImageEngine } from '../__mocks__/contexts';

const buildQwenPartsSpy = vi.hoisted(() => vi.fn());
const buildGeminiPartsSpy = vi.hoisted(() => vi.fn());
const buildGptPartsSpy = vi.hoisted(() => vi.fn());
const editImageMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/imageEditingService', () => ({
  editImage: editImageMock,
}));

vi.mock('../../src/utils/qwen-virtual-try-on-prompt', async (importOriginal) => {
  const actual = await importOriginal<typeof QwenPromptModule>();
  return {
    ...actual,
    buildQwenVirtualTryOnParts: (...args: Parameters<typeof actual.buildQwenVirtualTryOnParts>) => {
      buildQwenPartsSpy(...args);
      return actual.buildQwenVirtualTryOnParts(...args);
    },
  };
});

vi.mock('../../src/utils/gemini-virtual-try-on-prompt', async (importOriginal) => {
  const actual = await importOriginal<typeof GeminiPromptModule>();
  return {
    ...actual,
    buildGeminiVirtualTryOnParts: (...args: Parameters<typeof actual.buildGeminiVirtualTryOnParts>) => {
      buildGeminiPartsSpy(...args);
      return actual.buildGeminiVirtualTryOnParts(...args);
    },
  };
});

vi.mock('../../src/utils/gpt-virtual-try-on-prompt', async (importOriginal) => {
  const actual = await importOriginal<typeof GptPromptModule>();
  return {
    ...actual,
    buildGptVirtualTryOnParts: (...args: Parameters<typeof actual.buildGptVirtualTryOnParts>) => {
      buildGptPartsSpy(...args);
      return actual.buildGptVirtualTryOnParts(...args);
    },
  };
});

vi.mock('../../src/utils/imageUtils', () => ({
  getErrorMessage: vi.fn((error: Error) => error.message),
}));

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../src/utils/run-bounded-workers', () => ({
  runBoundedWorkers: async (jobs: unknown[], _concurrency: number, handler: (job: unknown) => Promise<void>) => {
    for (const job of jobs) {
      await handler(job);
    }
  },
}));

vi.mock('../../src/contexts/ImageEngineContext', () =>
  mockUseImageEngine({
    id: 'localQwen',
    model: 'qwen-image-2.1',
    editImage: editImageMock,
  }),
);

import { useWardrobeMode } from '../../src/hooks/useWardrobeMode';

const SUBJECT = { base64: 'subject-image-base64', mimeType: 'image/png' };
const OUTFIT_A = { base64: 'outfit-a-base64', mimeType: 'image/jpeg' };
const RESULT_A = { base64: 'result-a-base64', mimeType: 'image/png' };

const defaultParams = {
  imageEditModel: 'qwen-image-2.1',
  numImages: 1,
  aspectRatio: '3:4' as const,
  resolution: '2K' as const,
  isParentGenerating: false,
};

describe('useWardrobeMode - Local Qwen prompt routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildQwenPartsSpy.mockClear();
    buildGeminiPartsSpy.mockClear();
    buildGptPartsSpy.mockClear();
    editImageMock.mockResolvedValue([RESULT_A]);
  });

  it('routes through buildQwenVirtualTryOnParts when engineId is localQwen', async () => {
    const { result } = renderHook(() => useWardrobeMode(defaultParams));

    const setId = result.current.sets[0].id;
    act(() => {
      result.current.setSubject(SUBJECT);
      result.current.addItem(setId);
    });
    const itemId = result.current.sets[0].items[0].id;
    act(() => {
      result.current.updateItem(setId, itemId, { image: OUTFIT_A });
    });
    await act(async () => {
      await result.current.generate();
    });

    // 1. Must invoke Qwen VTO builder
    expect(buildQwenPartsSpy).toHaveBeenCalledTimes(1);
    expect(buildQwenPartsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectImage: SUBJECT,
        sourceItems: [
          expect.objectContaining({
            image: OUTFIT_A,
          }),
        ],
      }),
    );

    // 2. Must NEVER fall through to Gemini or GPT builders
    expect(buildGeminiPartsSpy).not.toHaveBeenCalled();
    expect(buildGptPartsSpy).not.toHaveBeenCalled();

    // 3. Driver receives generated result
    expect(editImageMock).toHaveBeenCalledTimes(1);
    expect(result.current.results[0].status).toBe('completed');
  });
});
