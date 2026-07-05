import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../src/services/imageEditingService', () => ({
  editImage: vi.fn(),
}));

vi.mock('../../src/utils/imageUtils', () => ({
  getErrorMessage: vi.fn((error: Error) => error.message),
}));

vi.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../src/utils/zipDownload', () => ({
  downloadImagesAsZip: vi.fn(),
}));

vi.mock('../../src/utils/run-bounded-workers', () => ({
  runBoundedWorkers: async (jobs: unknown[], _concurrency: number, handler: (job: unknown) => Promise<void>) => {
    for (const job of jobs) {
      await handler(job);
    }
  },
}));

import { useWardrobeMode } from '../../src/hooks/useWardrobeMode';
import { editImage } from '../../src/services/imageEditingService';
import { downloadImagesAsZip } from '../../src/utils/zipDownload';

const SUBJECT = { base64: 'subject-image', mimeType: 'image/png' };
const OUTFIT_A = { base64: 'outfit-a', mimeType: 'image/jpeg' };
const OUTFIT_B = { base64: 'outfit-b', mimeType: 'image/jpeg' };
const RESULT_A = { base64: 'result-a', mimeType: 'image/png' };
const RESULT_B = { base64: 'result-b', mimeType: 'image/png' };

const defaultParams = {
  imageEditModel: 'gemini-2.5-flash-image',
  numImages: 1,
  aspectRatio: '3:4' as const,
  resolution: '2K' as const,
  isParentGenerating: false,
};

describe('useWardrobeMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('initializes with 1 empty set, no subject, no results', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));

      expect(result.current.sets).toHaveLength(1);
      expect(result.current.sets[0].items).toHaveLength(0);
      expect(result.current.subject).toBeNull();
      expect(result.current.results).toHaveLength(0);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('exposes max set and item limits', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));

      expect(result.current.maxSets).toBe(4);
      expect(result.current.maxItemsPerSet).toBe(4);
    });
  });

  describe('Set Management', () => {
    it('adds a new set up to max of 4', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));

      act(() => {
        result.current.addSet();
      });
      expect(result.current.sets).toHaveLength(2);

      act(() => {
        result.current.addSet();
        result.current.addSet();
      });
      expect(result.current.sets).toHaveLength(4);

      act(() => {
        result.current.addSet();
      });
      expect(result.current.sets).toHaveLength(4); // Capped at 4
    });

    it('generates unique set IDs', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));

      const initialSetId = result.current.sets[0].id;

      act(() => {
        result.current.addSet();
        result.current.addSet();
      });

      const setIds = result.current.sets.map((s) => s.id);
      expect(new Set(setIds).size).toBe(setIds.length); // All unique
      expect(setIds[0]).toBe(initialSetId);
    });

    it('removes a set but keeps minimum of 1', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));

      const setId = result.current.sets[0].id;

      act(() => {
        result.current.removeSet(setId);
      });

      expect(result.current.sets).toHaveLength(1); // Minimum enforced
    });

    it('removes a specific set when multiple exist', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));

      act(() => {
        result.current.addSet();
        result.current.addSet();
      });

      const setToRemove = result.current.sets[1].id;

      act(() => {
        result.current.removeSet(setToRemove);
      });

      expect(result.current.sets).toHaveLength(2);
      expect(result.current.sets.some((s) => s.id === setToRemove)).toBe(false);
    });
  });

  describe('Item Management', () => {
    it('adds item to a set up to max of 4', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));
      const setId = result.current.sets[0].id;

      act(() => {
        result.current.addItem(setId);
      });
      expect(result.current.sets[0].items).toHaveLength(1);

      act(() => {
        result.current.addItem(setId);
        result.current.addItem(setId);
        result.current.addItem(setId);
      });
      expect(result.current.sets[0].items).toHaveLength(4);

      act(() => {
        result.current.addItem(setId);
      });
      expect(result.current.sets[0].items).toHaveLength(4); // Capped at 4
    });

    it('initializes new items with default values', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));
      const setId = result.current.sets[0].id;

      act(() => {
        result.current.addItem(setId);
      });

      const item = result.current.sets[0].items[0];
      expect(item.image).toBeNull();
      expect(item.sourceItemType).toBe('clothing');
      expect(item.sourcePrompt).toBe('');
    });

    it('removes item from a set', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));
      const setId = result.current.sets[0].id;

      act(() => {
        result.current.addItem(setId);
        result.current.addItem(setId);
      });

      const itemToRemove = result.current.sets[0].items[0].id;

      act(() => {
        result.current.removeItem(setId, itemToRemove);
      });

      expect(result.current.sets[0].items).toHaveLength(1);
      expect(result.current.sets[0].items.some((i) => i.id === itemToRemove)).toBe(false);
    });

    it('updates item image', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));
      const setId = result.current.sets[0].id;

      act(() => {
        result.current.addItem(setId);
      });

      const itemId = result.current.sets[0].items[0].id;

      act(() => {
        result.current.updateItem(setId, itemId, { image: OUTFIT_A });
      });

      expect(result.current.sets[0].items[0].image).toEqual(OUTFIT_A);
    });

    it('updates item source type', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));
      const setId = result.current.sets[0].id;

      act(() => {
        result.current.addItem(setId);
      });

      const itemId = result.current.sets[0].items[0].id;

      act(() => {
        result.current.updateItem(setId, itemId, { sourceItemType: 'shoes' });
      });

      expect(result.current.sets[0].items[0].sourceItemType).toBe('shoes');
    });

    it('updates item source prompt', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));
      const setId = result.current.sets[0].id;

      act(() => {
        result.current.addItem(setId);
      });

      const itemId = result.current.sets[0].items[0].id;

      act(() => {
        result.current.updateItem(setId, itemId, { sourcePrompt: 'red leather jacket' });
      });

      expect(result.current.sets[0].items[0].sourcePrompt).toBe('red leather jacket');
    });
  });

  describe('Subject Management', () => {
    it('sets subject image', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));

      act(() => {
        result.current.setSubject(SUBJECT);
      });

      expect(result.current.subject).toEqual(SUBJECT);
    });

    it('clears subject image', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));

      act(() => {
        result.current.setSubject(SUBJECT);
      });

      act(() => {
        result.current.clearSubject();
      });

      expect(result.current.subject).toBeNull();
    });

    it('clears error when setting subject', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));

      act(() => {
        result.current.setSubject(null);
      });

      // Trigger error by generating without subject
      act(() => {
        result.current.generate();
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.setSubject(SUBJECT);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Extra Prompts', () => {
    it('sets and updates extra prompt', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));

      act(() => {
        result.current.setExtraPrompt('professional lighting');
      });

      expect(result.current.extraPrompt).toBe('professional lighting');

      act(() => {
        result.current.setExtraPrompt('studio setup');
      });

      expect(result.current.extraPrompt).toBe('studio setup');
    });

    it('sets and updates background prompt', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));

      act(() => {
        result.current.setBackgroundPrompt('white studio');
      });

      expect(result.current.backgroundPrompt).toBe('white studio');

      act(() => {
        result.current.setBackgroundPrompt('outdoor park');
      });

      expect(result.current.backgroundPrompt).toBe('outdoor park');
    });
  });

  describe('Generation Validation', () => {
    it('sets error when generate is called without subject', async () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));

      await act(async () => {
        await result.current.generate();
      });

      expect(result.current.error).toBe('virtualTryOn.inputError');
      expect(editImage).not.toHaveBeenCalled();
    });

    it('sets error when generate is called with empty sets', async () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));

      act(() => {
        result.current.setSubject(SUBJECT);
      });

      await act(async () => {
        await result.current.generate();
      });

      expect(result.current.error).toBe('virtualTryOn.wardrobeEmptySetWarning');
      expect(editImage).not.toHaveBeenCalled();
    });

    it('does not generate when parent is already generating', async () => {
      const { result } = renderHook(() =>
        useWardrobeMode({ ...defaultParams, isParentGenerating: true }),
      );

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

      expect(editImage).not.toHaveBeenCalled();
    });

    it('does not start a second generate while a request is still pending', async () => {
      let resolveEditImage: ((value: typeof RESULT_A[]) => void) | null = null;
      vi.mocked(editImage).mockImplementation(() => new Promise((resolve) => {
        resolveEditImage = resolve;
      }));

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

      let firstGenerate: Promise<void> | undefined;
      act(() => {
        firstGenerate = result.current.generate();
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isGenerating).toBe(true);
      expect(editImage).toHaveBeenCalledTimes(1);

      act(() => {
        void result.current.generate();
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(editImage).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveEditImage?.([RESULT_A]);
        await firstGenerate;
      });

      expect(result.current.isGenerating).toBe(false);
    });
  });

  describe('Download', () => {
    it('skips download when no completed results', () => {
      const { result } = renderHook(() => useWardrobeMode(defaultParams));

      expect(downloadImagesAsZip).not.toHaveBeenCalled();
    });
  });
});
