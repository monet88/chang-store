import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { mockUseImageEngine } from '../__mocks__/contexts';

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

vi.mock('../../src/contexts/ImageEngineContext', () =>
  mockUseImageEngine({ editImage, model: 'gemini-2.5-flash-image' }),
);

import { editImage } from '../../src/services/imageEditingService';
import { useWardrobeMode, type WardrobeModeReturn } from '../../src/hooks/useWardrobeMode';
import { downloadImagesAsZip } from '../../src/utils/zipDownload';
import { AiScanProvider } from '../../src/contexts/AiScanContext';
import type { AiScanAnalyzer } from '../../src/contexts/AiScanContext';
import { AI_SCAN_BLOCK_HEADER } from '../../src/utils/ai-scan-blueprint';
import type { ReactNode } from 'react';

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

  describe('AI Scan blueprint', () => {
    const BLUEPRINT = 'DRAPE PHYSICS: fluid fall with a matte hand.';

    const wrapperFor =
      (analyze: AiScanAnalyzer, enabled: boolean) =>
      function AiScanWrapper({ children }: { children: ReactNode }) {
        return (
          <AiScanProvider analyze={analyze} initialEnabled={enabled}>
            {children}
          </AiScanProvider>
        );
      };

    const setUpWardrobe = (result: { current: WardrobeModeReturn }) => {
      const setId = result.current.sets[0].id;
      act(() => {
        result.current.setSubject(SUBJECT);
        result.current.addItem(setId);
      });
      const itemId = result.current.sets[0].items[0].id;
      act(() => {
        result.current.updateItem(setId, itemId, { image: OUTFIT_A });
      });
    };

    const textSent = () =>
      (vi.mocked(editImage).mock.calls[0][0].interleavedParts ?? [])
        .filter((part) => part.text)
        .map((part) => part.text)
        .join('\n');

    it('splices the scanned blueprint into the wardrobe prompt', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
      const analyze = vi.fn<AiScanAnalyzer>().mockResolvedValue(BLUEPRINT);

      const { result } = renderHook(() => useWardrobeMode(defaultParams), {
        wrapper: wrapperFor(analyze, true),
      });

      setUpWardrobe(result);

      await act(async () => {
        await result.current.generate();
      });

      expect(analyze).toHaveBeenCalled();
      expect(textSent()).toContain(AI_SCAN_BLOCK_HEADER);
      expect(textSent()).toContain(BLUEPRINT);
      expect(result.current.results[0].status).toBe('completed');
    });

    it('uses the GPT-owned prompt family for wardrobe jobs in GPT Studio Mode', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
      const analyze = vi.fn<AiScanAnalyzer>().mockResolvedValue(BLUEPRINT);

      const { result } = renderHook(
        () => useWardrobeMode({ ...defaultParams, engineId: 'gptImage' }),
        { wrapper: wrapperFor(analyze, true) },
      );

      setUpWardrobe(result);

      await act(async () => {
        await result.current.generate();
      });

      const prompt = textSent();
      expect(prompt).toContain('/* VIRTUAL_TRY_ON_CONFIG */');
      expect(prompt).toContain('"AI_SCAN_BLUEPRINT"');
      expect(prompt).not.toContain('CRITICAL OUTFIT DECONSTRUCTION (5-LAYER TECHNICAL BRIEF)');
      expect(result.current.results[0].status).toBe('completed');
    });

    it('never analyses and keeps the base prompt when the layer is switched off', async () => {
      vi.mocked(editImage).mockResolvedValueOnce([RESULT_A]);
      const analyze = vi.fn<AiScanAnalyzer>().mockResolvedValue('unused blueprint');

      const { result } = renderHook(() => useWardrobeMode(defaultParams), {
        wrapper: wrapperFor(analyze, false),
      });

      setUpWardrobe(result);

      await act(async () => {
        await result.current.generate();
      });

      expect(analyze).not.toHaveBeenCalled();
      expect(textSent()).not.toContain('AI SCAN');
      expect(textSent()).toContain('## TASK');
      expect(result.current.results[0].status).toBe('completed');
    });

    it('analyses each set on its own, never another set\'s garments', async () => {
      vi.mocked(editImage).mockResolvedValue([RESULT_A]);
      const analyze = vi.fn<AiScanAnalyzer>(async (image) => {
        if (image === OUTFIT_A) return 'SET A BLUEPRINT: silk satin';
        if (image === OUTFIT_B) return 'SET B BLUEPRINT: raw denim';
        return 'SUBJECT BLUEPRINT: standing body';
      });

      const { result } = renderHook(() => useWardrobeMode(defaultParams), {
        wrapper: wrapperFor(analyze, true),
      });

      act(() => result.current.setSubject(SUBJECT));
      const setAId = result.current.sets[0].id;
      act(() => result.current.addItem(setAId));
      act(() => result.current.updateItem(setAId, result.current.sets[0].items[0].id, { image: OUTFIT_A }));
      act(() => result.current.addSet());
      const setBId = result.current.sets[1].id;
      act(() => result.current.addItem(setBId));
      act(() => result.current.updateItem(setBId, result.current.sets[1].items[0].id, { image: OUTFIT_B }));

      await act(async () => {
        await result.current.generate();
      });

      const prompts = vi.mocked(editImage).mock.calls.map((call) =>
        (call[0].interleavedParts ?? [])
          .filter((part) => part.text)
          .map((part) => part.text)
          .join('\n'),
      );

      // Each outfit's deconstruction lands in exactly its own set's prompt.
      expect(prompts.filter((prompt) => prompt.includes('SET A BLUEPRINT'))).toHaveLength(1);
      expect(prompts.filter((prompt) => prompt.includes('SET B BLUEPRINT'))).toHaveLength(1);
      expect(prompts[0]).not.toContain('SET B BLUEPRINT');
      expect(prompts[1]).not.toContain('SET A BLUEPRINT');
    });
  });
});
