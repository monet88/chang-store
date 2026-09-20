/**
 * Wardrobe generation engine.
 *
 * Owns the batch generation with concurrency and result aggregation.
 * Driver seam for editImage to support future direct unit tests with mock driver.
 */

import { useCallback } from 'react';
import {
  Feature,
  type AspectRatio,
  type ImageEditModel,
  type ImageEngineId,
  type ImageFile,
  type ImageResolution,
  type WardrobeResultSet,
  type WardrobeSet,
} from '../types';
import { editImage } from '../services/imageEditingService';
import { buildGeminiVirtualTryOnParts } from '../utils/gemini-virtual-try-on-prompt';
import { buildGptVirtualTryOnParts } from '../utils/gpt-virtual-try-on-prompt';
import { runBoundedWorkers } from '../utils/run-bounded-workers';
import { getErrorMessage } from '../utils/imageUtils';
import { aiScanSourceSet } from '../utils/ai-scan-blueprint';
import { useAiScan } from '../contexts/AiScanContext';

export interface WardrobeImageDriver {
  editImage: typeof editImage;
}

export interface UseWardrobeModeEngineConfig {
  driver: WardrobeImageDriver;
  sets: WardrobeSet[];
  subject: ImageFile | null;
  extraPrompt: string;
  backgroundPrompt: string;
  numImages: number;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  imageEditModel: ImageEditModel;
  isParentGenerating: boolean;
  isGenerating: boolean;
  t: (key: string, options?: any) => string;
  setResults: React.Dispatch<React.SetStateAction<WardrobeResultSet[]>>;
  setIsGenerating: (v: boolean) => void;
  setError: (e: string | null) => void;
  setLoadingMessage: (m: string) => void;
  addImage?: (image: ImageFile, feature?: Feature, engine?: ImageEngineId) => void;
  engineId?: ImageEngineId;
}

export interface UseWardrobeModeEngineReturn {
  generate: () => Promise<void>;
}

const WARDROBE_CONCURRENCY = 3;

export const useWardrobeModeEngine = (config: UseWardrobeModeEngineConfig): UseWardrobeModeEngineReturn => {
  const {
    driver,
    sets,
    subject,
    extraPrompt,
    backgroundPrompt,
    numImages,
    aspectRatio,
    resolution,
    imageEditModel,
    isParentGenerating,
    isGenerating,
    t,
    setResults,
    setIsGenerating,
    setError,
    setLoadingMessage,
    addImage,
    engineId,
  } = config;

  // AI Scan (issue #162): the wardrobe lane builds the same try-on prompt, so it
  // consumes the same blueprint; a disabled or failed scan leaves it unchanged.
  const { scan } = useAiScan();

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

    const jobs: { setId: string; items: any[] }[] = validSets.map((s) => ({
      setId: s.id,
      items: s.items.filter((i) => i.image !== null),
    }));

    try {
      await runBoundedWorkers(jobs, WARDROBE_CONCURRENCY, async (job) => {
        setResults((prev) =>
          prev.map((r) => (r.setId === job.setId ? { ...r, status: 'processing' } : r)),
        );

        try {
          const sourceItems = job.items.map((item: any) => ({
            image: item.image as ImageFile,
            sourceItemType: item.sourceItemType,
            sourcePrompt: item.sourcePrompt,
          }));

          // One analysis per set, over that set's own garments: each set is its
          // own outfit, so a shared blueprint would describe another set's
          // fabrics in this prompt.
          const blueprint = await scan(aiScanSourceSet(sourceItems.map((item) => item.image), [capturedSubject]));

          const promptInput = {
            subjectImage: capturedSubject,
            sourceItems,
            extraPrompt,
            backgroundPrompt,
            isMultiPersonMode: false,
            outfitBlueprint: blueprint ?? undefined,
          };
          const interleavedParts = engineId === 'gptImage'
            ? buildGptVirtualTryOnParts(promptInput)
            : buildGeminiVirtualTryOnParts(promptInput);

          const images = await driver.editImage(
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
          images.forEach((image) => addImage?.(image, Feature.TryOn, engineId));
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
    subject,
    sets,
    scan,
    extraPrompt,
    backgroundPrompt,
    numImages,
    aspectRatio,
    resolution,
    imageEditModel,
    t,
    driver,
    isParentGenerating,
    isGenerating,
    setResults,
    setIsGenerating,
    setError,
    setLoadingMessage,
    addImage,
    engineId,
  ]);

  return { generate };
};
