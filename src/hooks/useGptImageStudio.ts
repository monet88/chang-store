import { useCallback, useEffect, useRef, useState } from 'react';
import { Feature, ImageFile, StudioMode } from '../types';
import { useApi } from '../contexts/ApiProviderContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getErrorMessage, compositeMarkerOnImage } from '../utils/imageUtils';
import {
  GptImageModelId,
  GptImageQuality,
  GptImageSize,
  DEFAULT_GPT_IMAGE_MODEL,
  DEFAULT_GPT_IMAGE_QUALITY,
  DEFAULT_GPT_IMAGE_SIZE,
  GPT_IMAGE_QUALITIES,
  GPT_IMAGE_SIZES,
  MAX_GPT_REFERENCE_IMAGES,
} from '../config/gptImageModelRegistry';
import { generateGptImage, editGptImage } from '../services/providers/gpt-image/gptImageService';
import { buildProviderStudioPrompt } from '../utils/provider-studio-prompt-adapter';
import { buildProviderRefinePrompt, PROVIDER_UPSCALE_PROMPTS } from '../utils/provider-refine-prompt';
import { useProviderStudioFields, UseProviderStudioFieldsReturn } from './useProviderStudioFields';
import { useProviderResultActions, UseProviderResultActionsReturn } from './useProviderResultActions';
import { useProviderTryOnBatch, UseProviderTryOnBatchReturn } from './useProviderTryOnBatch';
import { useProviderLookbookFields, UseProviderLookbookFieldsReturn } from './useProviderLookbookFields';
import { useProviderWardrobe, UseProviderWardrobeReturn } from './useProviderWardrobe';
import { useProviderLookbookOutput, UseProviderLookbookOutputReturn } from './useProviderLookbookOutput';
import { buildVariationPrompt, buildCloseUpPrompts, buildCloseUpNegativePrompt } from '../utils/lookbookPromptBuilder';
import { VirtualTryOnMode, VirtualTryOnClothingItem } from '../types';

/** GPT wardrobe caps: 2 sets, concurrency 1 — GPT multipart edits are slow and
 * tunnel-timeout-prone, so wardrobe is bounded hard (Red Team #3 / plan caps). */
const GPT_WARDROBE_CONFIG = { maxSets: 2, maxItemsPerSet: 4, concurrency: 1 };
/** GPT lookbook: exactly 1 variation, serial (Red Team #3 / plan caps). */
const GPT_LOOKBOOK_MAX_VARIATIONS = 1;

export interface UseGptImageStudioReturn extends UseProviderStudioFieldsReturn, UseProviderResultActionsReturn, UseProviderTryOnBatchReturn, UseProviderLookbookFieldsReturn {
  apiKey: string;
  baseUrl: string;
  setApiKey: (value: string) => void;
  setBaseUrl: (value: string) => void;
  resetSettings: () => void;
  model: GptImageModelId;
  prompt: string;
  setPrompt: (value: string) => void;
  images: ImageFile[];
  setImages: (images: ImageFile[]) => void;
  quality: GptImageQuality;
  setQuality: (value: string) => void;
  size: GptImageSize;
  setSize: (value: string) => void;
  qualityOptions: string[];
  sizeOptions: string[];
  isLoading: boolean;
  error: string | null;
  results: ImageFile[];
  clearError: () => void;
  handleGenerate: () => Promise<void>;
  maxReferenceImages: number;
  tryOnMode: VirtualTryOnMode;
  setTryOnMode: (mode: VirtualTryOnMode) => void;
  wardrobe: UseProviderWardrobeReturn;
  lookbookOutput: UseProviderLookbookOutputReturn;
}

/**
 * State + logic for the GPT Image provider studio.
 *
 * Receives `studioMode` and `activeFeature` as arguments (props drilling). When
 * source images are present the request is a multipart edit, otherwise a JSON
 * text-to-image generation.
 */
export const useGptImageStudio = (
  activeFeature: Feature,
  _studioMode: StudioMode,
): UseGptImageStudioReturn => {
  const { t } = useLanguage();
  const { providerSettings, setProviderSettings, resetProviderSettings } = useApi();
  const settings = providerSettings.gptImage;

  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<ImageFile[]>([]);
  const [quality, setQuality] = useState<GptImageQuality>(DEFAULT_GPT_IMAGE_QUALITY);
  const [size, setSize] = useState<GptImageSize>(DEFAULT_GPT_IMAGE_SIZE);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ImageFile[]>([]);

  const fields = useProviderStudioFields();
  const batch = useProviderTryOnBatch(t);
  const lookbook = useProviderLookbookFields();

  const [tryOnMode, setTryOnMode] = useState<VirtualTryOnMode>('multi-model');

  const abortControllerRef = useRef<AbortController | null>(null);

  // Build the request images for one Try-On run: optionally swap the subject
  // (image[0]) for a batch subject and composite the multi-person marker.
  const prepareImages = useCallback(
    async (subjectOverride?: ImageFile): Promise<ImageFile[]> => {
      if (activeFeature !== Feature.TryOn || images.length === 0) {
        return images;
      }
      const [defaultSubject, ...sourceItems] = images;
      let subject = subjectOverride ?? defaultSubject;
      if (batch.isMultiPersonMode && batch.markerPosition) {
        subject = await compositeMarkerOnImage(subject, batch.markerPosition);
      }
      return [subject, ...sourceItems];
    },
    [activeFeature, images, batch.isMultiPersonMode, batch.markerPosition],
  );

  // Single GPT Image call for the current inputs. `subjectOverride` swaps
  // image[0] for a batch subject.
  const runGeneration = useCallback(
    async (signal?: AbortSignal, subjectOverride?: ImageFile): Promise<ImageFile[]> => {
      const config = { apiKey: settings.apiKey, baseUrl: settings.baseUrl };
      const requestImages = await prepareImages(subjectOverride);
      const multiPerson = activeFeature === Feature.TryOn && batch.isMultiPersonMode && batch.markerPosition !== null;
      const composedPrompt = buildProviderStudioPrompt(activeFeature, prompt, requestImages, {
        ...fields.buildPromptOptions(),
        isMultiPersonMode: multiPerson,
        lookbookState: lookbook.lookbookState,
        fabricTextureImage: lookbook.lookbookFabricImage,
      });
      return requestImages.length > 0
        ? editGptImage({ model: DEFAULT_GPT_IMAGE_MODEL, prompt: composedPrompt, images: requestImages, size, quality }, config, signal)
        : generateGptImage({ model: DEFAULT_GPT_IMAGE_MODEL, prompt: composedPrompt, size, quality }, config, signal);
    },
    [activeFeature, prompt, images, fields, batch.isMultiPersonMode, batch.markerPosition, lookbook.lookbookState, lookbook.lookbookFabricImage, prepareImages, size, quality, settings.apiKey, settings.baseUrl],
  );

  // Wardrobe: generate one set as a multipart edit (subject + the set's items).
  // Service call lives here so `useProviderWardrobe` stays service-agnostic
  // (Red Team #2). GPT runs serially with a 2-set cap (config above).
  const generateSet = useCallback(
    async (
      subject: ImageFile,
      items: VirtualTryOnClothingItem[],
      prompts: { backgroundPrompt: string; extraPrompt: string },
      signal?: AbortSignal,
    ): Promise<ImageFile[]> => {
      const config = { apiKey: settings.apiKey, baseUrl: settings.baseUrl };
      const withImage = items.filter((i) => i.image !== null);
      const requestImages = [subject, ...withImage.map((i) => i.image as ImageFile)];
      const composedPrompt = buildProviderStudioPrompt(Feature.TryOn, '', requestImages, {
        sourceItemTypes: withImage.map((i) => i.sourceItemType),
        sourceItemNotes: withImage.map((i) => i.sourcePrompt),
        backgroundPrompt: prompts.backgroundPrompt,
        extraPrompt: prompts.extraPrompt,
      });
      return editGptImage({ model: DEFAULT_GPT_IMAGE_MODEL, prompt: composedPrompt, images: requestImages, size, quality }, config, signal);
    },
    [settings.apiKey, settings.baseUrl, size, quality],
  );

  const wardrobe = useProviderWardrobe(generateSet, GPT_WARDROBE_CONFIG, t);

  // Lookbook rich output: variations (capped at 1) / close-ups / refine via GPT
  // multipart edit. Service import stays here, not in the engine (boundary-safe).
  const lookbookOutput = useProviderLookbookOutput(
    {
      generateVariations: async (base, count, signal) => {
        const config = { apiKey: settings.apiKey, baseUrl: settings.baseUrl };
        const out: ImageFile[] = [];
        // Serial — GPT multipart edits are slow; count is capped at 1.
        for (let i = 0; i < count; i++) {
          const [img] = await editGptImage(
            { model: DEFAULT_GPT_IMAGE_MODEL, prompt: buildVariationPrompt(lookbook.lookbookState.lookbookStyle, 1), images: [base], size, quality },
            config,
            signal,
          );
          if (img) out.push(img);
        }
        return out;
      },
      generateCloseUps: async (base, signal) => {
        const config = { apiKey: settings.apiKey, baseUrl: settings.baseUrl };
        const negative = buildCloseUpNegativePrompt(lookbook.lookbookState.negativePrompt);
        const out: ImageFile[] = [];
        for (const prompt of buildCloseUpPrompts()) {
          const [img] = await editGptImage(
            { model: DEFAULT_GPT_IMAGE_MODEL, prompt: `${prompt}\n\nAvoid: ${negative}`, images: [base], size, quality },
            config,
            signal,
          );
          if (img) out.push(img);
        }
        return out;
      },
      refine: async (base, instruction, signal) => {
        const config = { apiKey: settings.apiKey, baseUrl: settings.baseUrl };
        const [edited] = await editGptImage(
          { model: DEFAULT_GPT_IMAGE_MODEL, prompt: buildProviderRefinePrompt(instruction), images: [base], size, quality },
          config,
          signal,
        );
        return edited;
      },
    },
    { maxVariations: GPT_LOOKBOOK_MAX_VARIATIONS, getSignal: () => abortControllerRef.current?.signal },
    t,
  );

  // Sync the lookbook rich-output main image from the latest generate result.
  useEffect(() => {
    if (activeFeature === Feature.Lookbook) {
      lookbookOutput.setMain(results[0] ?? null);
    }
  }, [results, activeFeature]);

  // Reset transient workflow state on active-feature change + abort in-flight
  // requests. Covers tryOnMode + wardrobe + lookbook output (Red Team #5, #6).
  useEffect(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setPrompt('');
    setImages([]);
    setResults([]);
    setError(null);
    setTryOnMode('multi-model');
    fields.resetFields();
    batch.resetExtras();
    lookbook.resetLookbookFields();
    wardrobe.reset();
    lookbookOutput.reset();
    return () => {
      controller.abort();
    };
  }, [activeFeature]);

  // Per-tile result actions (refine / upscale / regenerate). GPT Image has no
  // native resolution flag, so upscale relies on a preservation prompt at the
  // largest quality; results feed back as the edit source (stateless endpoint).
  // Declared before handleGenerate so the generate flow can block on
  // `actions.busyIndex` (mutual exclusion — no concurrent requests).
  const actions = useProviderResultActions({
    results,
    setResults,
    getSignal: () => abortControllerRef.current?.signal,
    isBusy: isLoading || batch.isBatchRunning,
    t,
    editOne: async (source, instruction, signal) => {
      const config = { apiKey: settings.apiKey, baseUrl: settings.baseUrl };
      const [edited] = await editGptImage(
        { model: DEFAULT_GPT_IMAGE_MODEL, prompt: buildProviderRefinePrompt(instruction), images: [source], size, quality },
        config,
        signal,
      );
      return edited;
    },
    upscaleOne: async (source, qualityLevel, signal) => {
      const config = { apiKey: settings.apiKey, baseUrl: settings.baseUrl };
      const [upscaled] = await editGptImage(
        { model: DEFAULT_GPT_IMAGE_MODEL, prompt: PROVIDER_UPSCALE_PROMPTS[qualityLevel], images: [source], size, quality: 'high' },
        config,
        signal,
      );
      return upscaled;
    },
    regenerateOne: async (signal) => {
      const [regenerated] = await runGeneration(signal);
      return regenerated;
    },
  });

  const handleGenerate = useCallback(async (): Promise<void> => {
    // Block while a full/batch generate OR a per-tile action is running.
    if (isLoading || batch.isBatchRunning || actions.busyIndex !== null) return;

    setError(null);

    // Batch path: image[0] is subject #1, extra subjects run with the same
    // shared source set (image[1..]). Results are tracked per subject.
    if (batch.batchActive && activeFeature === Feature.TryOn && images.length > 0) {
      setResults([]);
      const subjects = [images[0], ...batch.batchSubjects];
      await batch.runBatch(
        subjects,
        (subject, signal) => runGeneration(signal, subject),
        abortControllerRef.current?.signal,
      );
      return;
    }

    setIsLoading(true);
    setResults([]);

    try {
      const generated = await runGeneration(abortControllerRef.current?.signal);
      setResults(generated);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Silent on studio switch / unmount.
      }
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, batch, actions.busyIndex, activeFeature, images, runGeneration, t]);

  return {
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    setApiKey: (value: string) => setProviderSettings('gptImage', { apiKey: value }),
    setBaseUrl: (value: string) => setProviderSettings('gptImage', { baseUrl: value }),
    resetSettings: () => resetProviderSettings('gptImage'),
    ...fields,
    model: DEFAULT_GPT_IMAGE_MODEL,
    prompt,
    setPrompt,
    images,
    setImages,
    quality,
    setQuality: (value: string) => setQuality(value as GptImageQuality),
    size,
    setSize: (value: string) => setSize(value as GptImageSize),
    qualityOptions: [...GPT_IMAGE_QUALITIES],
    sizeOptions: [...GPT_IMAGE_SIZES],
    isLoading,
    error,
    results,
    clearError: () => setError(null),
    handleGenerate,
    ...actions,
    ...batch,
    ...lookbook,
    maxReferenceImages: MAX_GPT_REFERENCE_IMAGES,
    tryOnMode,
    setTryOnMode,
    wardrobe,
    lookbookOutput,
  };
};
