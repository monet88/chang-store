import { useCallback, useRef, useState } from 'react';
import {
  ImageFile,
  VirtualTryOnClothingItem,
  VirtualTryOnSourceItemType,
  WardrobeResultSet,
  WardrobeSet,
} from '../types';
import { getErrorMessage } from '../utils/imageUtils';
import { runBoundedWorkers } from '../utils/run-bounded-workers';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

/** Build one set's results from its subject + items (provider service injected). */
export type GenerateSet = (
  subject: ImageFile,
  items: VirtualTryOnClothingItem[],
  prompts: { backgroundPrompt: string; extraPrompt: string },
  signal?: AbortSignal,
) => Promise<ImageFile[]>;

export interface ProviderWardrobeConfig {
  maxSets: number;
  maxItemsPerSet: number;
  concurrency: number;
}

export interface UseProviderWardrobeReturn {
  sets: WardrobeSet[];
  subject: ImageFile | null;
  extraPrompt: string;
  setExtraPrompt: (value: string) => void;
  backgroundPrompt: string;
  setBackgroundPrompt: (value: string) => void;
  results: WardrobeResultSet[];
  isGenerating: boolean;
  error: string | null;
  addSet: () => void;
  removeSet: (setId: string) => void;
  addItem: (setId: string) => void;
  removeItem: (setId: string, itemId: number) => void;
  updateItem: (
    setId: string,
    itemId: number,
    updates: Partial<Pick<VirtualTryOnClothingItem, 'image' | 'sourceItemType' | 'sourcePrompt'>>,
  ) => void;
  setSubject: (image: ImageFile | null) => void;
  generate: (signal?: AbortSignal) => Promise<void>;
  reset: () => void;
  maxSets: number;
  maxItemsPerSet: number;
}

/**
 * Service-agnostic wardrobe engine for provider studios. Mirrors Gemini's
 * `useWardrobeMode` (sets × items, per-set batch) but takes a `generateSet`
 * callback so the provider service import stays in the STUDIO hook, never here
 * (Red Team #2 — keeps `src/hooks/useProvider*.ts` boundary-clean). Caps and
 * concurrency are injected (GPT: maxSets 2, concurrency 1).
 */
export const useProviderWardrobe = (
  generateSet: GenerateSet,
  config: ProviderWardrobeConfig,
  t: TranslateFn,
): UseProviderWardrobeReturn => {
  const { maxSets, maxItemsPerSet, concurrency } = config;
  const setIdCounter = useRef(1);
  const itemIdCounter = useRef(0);

  const [sets, setSets] = useState<WardrobeSet[]>([{ id: 'pws-1', items: [] }]);
  const [subject, setSubjectState] = useState<ImageFile | null>(null);
  const [extraPrompt, setExtraPrompt] = useState('');
  const [backgroundPrompt, setBackgroundPrompt] = useState('');
  const [results, setResults] = useState<WardrobeResultSet[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSet = useCallback(() => {
    setSets((prev) => (prev.length >= maxSets ? prev : [...prev, { id: `pws-${++setIdCounter.current}`, items: [] }]));
  }, [maxSets]);

  const removeSet = useCallback((setId: string) => {
    setSets((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== setId)));
  }, []);

  const addItem = useCallback((setId: string) => {
    setSets((prev) =>
      prev.map((s) => {
        if (s.id !== setId || s.items.length >= maxItemsPerSet) return s;
        const newItem: VirtualTryOnClothingItem = {
          id: ++itemIdCounter.current,
          image: null,
          sourceItemType: 'clothing' as VirtualTryOnSourceItemType,
          sourcePrompt: '',
        };
        return { ...s, items: [...s.items, newItem] };
      }),
    );
  }, [maxItemsPerSet]);

  const removeItem = useCallback((setId: string, itemId: number) => {
    setSets((prev) =>
      prev.map((s) => (s.id === setId ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s)),
    );
  }, []);

  const updateItem = useCallback(
    (
      setId: string,
      itemId: number,
      updates: Partial<Pick<VirtualTryOnClothingItem, 'image' | 'sourceItemType' | 'sourcePrompt'>>,
    ) => {
      setSets((prev) =>
        prev.map((s) =>
          s.id === setId ? { ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, ...updates } : i)) } : s,
        ),
      );
    },
    [],
  );

  const setSubject = useCallback((image: ImageFile | null) => {
    setSubjectState(image);
    setError(null);
  }, []);

  const generate = useCallback(
    async (signal?: AbortSignal) => {
      if (isGenerating) return;
      if (!subject) {
        setError(t('studio.workflows.wardrobe.subjectRequired'));
        return;
      }
      const validSets = sets.filter((s) => s.items.some((i) => i.image !== null));
      if (validSets.length === 0) {
        setError(t('studio.workflows.wardrobe.emptySetWarning'));
        return;
      }

      const capturedSubject = subject;
      setIsGenerating(true);
      setError(null);
      setResults(validSets.map((s) => ({ setId: s.id, status: 'pending', results: [] })));

      const jobs = validSets.map((s) => ({ setId: s.id, items: s.items.filter((i) => i.image !== null) }));

      try {
        await runBoundedWorkers(jobs, Math.min(concurrency, jobs.length), async (job) => {
          setResults((prev) => prev.map((r) => (r.setId === job.setId ? { ...r, status: 'processing' } : r)));
          try {
            const images = await generateSet(capturedSubject, job.items, { backgroundPrompt, extraPrompt }, signal);
            setResults((prev) =>
              prev.map((r) => (r.setId === job.setId ? { ...r, status: 'completed', results: images } : r)),
            );
          } catch (jobErr) {
            if (jobErr instanceof Error && jobErr.name === 'AbortError') {
              setResults((prev) => prev.map((r) => (r.setId === job.setId ? { ...r, status: 'pending' } : r)));
              return;
            }
            setResults((prev) =>
              prev.map((r) => (r.setId === job.setId ? { ...r, status: 'error', error: getErrorMessage(jobErr, t) } : r)),
            );
          }
        });
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, subject, sets, concurrency, generateSet, backgroundPrompt, extraPrompt, t],
  );

  const reset = useCallback(() => {    setIdCounter.current = 1;
    itemIdCounter.current = 0;
    setSets([{ id: 'pws-1', items: [] }]);
    setSubjectState(null);
    setExtraPrompt('');
    setBackgroundPrompt('');
    setResults([]);
    setError(null);
    setIsGenerating(false);
  }, []);

  return {
    sets,
    subject,
    extraPrompt,
    setExtraPrompt,
    backgroundPrompt,
    setBackgroundPrompt,
    results,
    isGenerating,
    error,
    addSet,
    removeSet,
    addItem,
    removeItem,
    updateItem,
    setSubject,
    generate,
    reset,
    maxSets,
    maxItemsPerSet,
  };
};
