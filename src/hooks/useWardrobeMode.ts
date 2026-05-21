import { useCallback, useRef, useState } from 'react';
import type {
  ImageFile,
  ImageResolution,
  AspectRatio,
  WardrobeSet,
  WardrobeResultSet,
  VirtualTryOnClothingItem,
  ImageEditModel,
} from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { getErrorMessage } from '../utils/imageUtils';
import { editImage } from '../services/imageEditingService';
import { buildVirtualTryOnParts } from '../utils/virtual-try-on-prompt-builder';
import { runBoundedWorkers } from '../utils/run-bounded-workers';
import { downloadImagesAsZip } from '../utils/zipDownload';
import { Feature } from '../types';

const MAX_WARDROBE_SETS = 4;
const MAX_ITEMS_PER_SET = 4;
const WARDROBE_CONCURRENCY = 4;

interface UseWardrobeModeParams {
  imageEditModel: ImageEditModel;
  numImages: number;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  isParentGenerating: boolean;
}

export const useWardrobeMode = ({
  imageEditModel,
  numImages,
  aspectRatio,
  resolution,
  isParentGenerating,
}: UseWardrobeModeParams) => {
  const setIdCounter = useRef(1);
  const itemIdCounter = useRef(0);

  const [sets, setSets] = useState<WardrobeSet[]>([
    { id: `ws-${setIdCounter.current}`, items: [] },
  ]);
  const [subject, setSubject] = useState<ImageFile | null>(null);
  const [extraPrompt, setExtraPrompt] = useState('');
  const [backgroundPrompt, setBackgroundPrompt] = useState('');
  const [results, setResults] = useState<WardrobeResultSet[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');

  const { t } = useLanguage();

  const addSet = useCallback(() => {
    setSets((prev) => {
      if (prev.length >= MAX_WARDROBE_SETS) return prev;
      return [...prev, { id: `ws-${++setIdCounter.current}`, items: [] }];
    });
  }, []);

  const removeSet = useCallback((setId: string) => {
    setSets((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((s) => s.id !== setId);
    });
  }, []);

  const addItem = useCallback((setId: string) => {
    setSets((prev) =>
      prev.map((s) => {
        if (s.id !== setId || s.items.length >= MAX_ITEMS_PER_SET) return s;
        const newItem: VirtualTryOnClothingItem = {
          id: ++itemIdCounter.current,
          image: null,
          sourceItemType: 'clothing',
          sourcePrompt: '',
        };
        return { ...s, items: [...s.items, newItem] };
      }),
    );
  }, []);

  const removeItem = useCallback((setId: string, itemId: number) => {
    setSets((prev) =>
      prev.map((s) => {
        if (s.id !== setId) return s;
        return { ...s, items: s.items.filter((i) => i.id !== itemId) };
      }),
    );
  }, []);

  const updateItem = useCallback(
    (setId: string, itemId: number, updates: Partial<Pick<VirtualTryOnClothingItem, 'image' | 'sourceItemType' | 'sourcePrompt'>>) => {
      setSets((prev) =>
        prev.map((s) => {
          if (s.id !== setId) return s;
          return {
            ...s,
            items: s.items.map((i) => (i.id === itemId ? { ...i, ...updates } : i)),
          };
        }),
      );
    },
    [],
  );

  const setWardrobeSubject = useCallback((image: ImageFile | null) => {
    setSubject(image);
    setError(null);
  }, []);

  const clearSubject = useCallback(() => {
    setSubject(null);
  }, []);

  const generate = useCallback(async () => {
    if (isParentGenerating || isGenerating) return;
    if (!subject) {
      setError(t('virtualTryOn.inputError'));
      return;
    }

    const validSets = sets.filter((s) => s.items.some((i) => i.image !== null));
    if (validSets.length === 0) {
      setError(t('virtualTryOn.wardrobeEmptySetWarning') || t('virtualTryOn.inputError'));
      return;
    }

    const capturedSubject = subject;
    setIsGenerating(true);
    setError(null);
    setLoadingMessage(t('virtualTryOn.generatingStatus'));

    const initialResults: WardrobeResultSet[] = validSets.map((s) => ({
      setId: s.id,
      status: 'pending',
      results: [],
    }));
    setResults(initialResults);

    const jobs: { setId: string; items: VirtualTryOnClothingItem[] }[] = validSets.map((s) => ({
      setId: s.id,
      items: s.items.filter((i) => i.image !== null),
    }));

    try {
      await runBoundedWorkers(jobs, WARDROBE_CONCURRENCY, async (job) => {
        setResults((prev) =>
          prev.map((r) => (r.setId === job.setId ? { ...r, status: 'processing' } : r)),
        );

        try {
          const sourceItems = job.items.map((item) => ({
            image: item.image as ImageFile,
            sourceItemType: item.sourceItemType,
            sourcePrompt: item.sourcePrompt,
          }));

          const interleavedParts = buildVirtualTryOnParts({
            subjectImage: capturedSubject,
            sourceItems,
            extraPrompt,
            backgroundPrompt,
            isMultiPersonMode: false,
          });

          const images = await editImage(
            {
              images: [],
              prompt: '',
              numberOfImages: numImages,
              aspectRatio,
              resolution,
              interleavedParts,
            },
            imageEditModel,
            { onStatusUpdate: setLoadingMessage },
          );

          setResults((prev) =>
            prev.map((r) =>
              r.setId === job.setId ? { ...r, status: 'completed', results: images } : r,
            ),
          );
        } catch (jobErr) {
          setResults((prev) =>
            prev.map((r) =>
              r.setId === job.setId
                ? { ...r, status: 'error', error: getErrorMessage(jobErr, t) }
                : r,
            ),
          );
        }
      });
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsGenerating(false);
      setLoadingMessage('');
    }
  }, [
    isParentGenerating,
    isGenerating,
    subject,
    sets,
    extraPrompt,
    backgroundPrompt,
    numImages,
    aspectRatio,
    resolution,
    imageEditModel,
    t,
  ]);

  const download = useCallback(async () => {
    const allImages = results
      .filter((r) => r.status === 'completed')
      .flatMap((r) => r.results);
    if (allImages.length === 0) return;

    try {
      await downloadImagesAsZip(allImages, `${Feature.TryOn}-wardrobe`);
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  }, [results, t]);

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
    loadingMessage,
    addSet,
    removeSet,
    addItem,
    removeItem,
    updateItem,
    setSubject: setWardrobeSubject,
    clearSubject,
    generate,
    download,
    maxSets: MAX_WARDROBE_SETS,
    maxItemsPerSet: MAX_ITEMS_PER_SET,
  };
};

export type WardrobeModeReturn = ReturnType<typeof useWardrobeMode>;
