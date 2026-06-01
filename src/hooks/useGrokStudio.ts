import { useCallback, useEffect, useRef, useState } from 'react';
import { Feature, ImageFile, StudioMode, UpscaleQuality } from '../types';
import { useApi } from '../contexts/ApiProviderContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getErrorMessage, compositeMarkerOnImage } from '../utils/imageUtils';
import {
  GrokModelId,
  GrokAspectRatio,
  GrokResolution,
  DEFAULT_GROK_MODEL,
  DEFAULT_GROK_ASPECT_RATIO,
  DEFAULT_GROK_RESOLUTION,
  GROK_MODELS,
  GROK_ASPECT_RATIOS,
  GROK_RESOLUTIONS,
  GROK_MAX_REFERENCE_IMAGES,
  GROK_MIN_OUTPUTS,
  GROK_MAX_OUTPUTS,
  isKnownGrokModel,
} from '../config/grokModelRegistry';
import { generateGrokImage, editGrokImage } from '../services/providers/grok/grokImageService';
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

/** Grok wardrobe caps: 4 sets, 4 items/set, concurrency 4 (Grok handles parallel). */
const GROK_WARDROBE_CONFIG = { maxSets: 4, maxItemsPerSet: 4, concurrency: 4 };
/** Grok lookbook: up to 4 variations. */
const GROK_LOOKBOOK_MAX_VARIATIONS = 4;

export interface ProviderOption {
  value: string;
  label: string;
}

export interface UseGrokStudioReturn extends UseProviderStudioFieldsReturn, UseProviderResultActionsReturn, UseProviderTryOnBatchReturn, UseProviderLookbookFieldsReturn {
  // Settings (from ApiProviderContext)
  apiKey: string;
  baseUrl: string;
  setApiKey: (value: string) => void;
  setBaseUrl: (value: string) => void;
  resetSettings: () => void;
  // Workflow inputs
  model: GrokModelId;
  setModel: (model: string) => void;
  prompt: string;
  setPrompt: (value: string) => void;
  images: ImageFile[];
  setImages: (images: ImageFile[]) => void;
  n: number;
  setN: (value: number) => void;
  aspectRatio: GrokAspectRatio;
  setAspectRatio: (value: string) => void;
  resolution: GrokResolution;
  setResolution: (value: string) => void;
  // Option lists (sourced from registry, exposed so the UI never imports config)
  modelOptions: ProviderOption[];
  aspectRatioOptions: string[];
  resolutionOptions: string[];
  // Execution state
  isLoading: boolean;
  error: string | null;
  results: ImageFile[];
  clearError: () => void;
  handleGenerate: () => Promise<void>;
  // Bounds
  maxReferenceImages: number;
  minOutputs: number;
  maxOutputs: number;
  // Try-On mode (multi-model vs wardrobe) + wardrobe engine
  tryOnMode: VirtualTryOnMode;
  setTryOnMode: (mode: VirtualTryOnMode) => void;
  wardrobe: UseProviderWardrobeReturn;
  lookbookOutput: UseProviderLookbookOutputReturn;
}

/**
 * State + logic for the Grok provider studio.
 *
 * Receives `studioMode` and `activeFeature` as arguments (props drilling — no
 * new context). Builds Grok payloads directly: when source images are present
 * the request is an edit, otherwise a text-to-image generation.
 */
export const useGrokStudio = (activeFeature: Feature, _studioMode: StudioMode): UseGrokStudioReturn => {
  const { t } = useLanguage();
  const { providerSettings, setProviderSettings, resetProviderSettings } = useApi();
  const settings = providerSettings.grok;

  const [model, setModel] = useState<GrokModelId>(DEFAULT_GROK_MODEL);
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<ImageFile[]>([]);
  const [n, setN] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<GrokAspectRatio>(DEFAULT_GROK_ASPECT_RATIO);
  const [resolution, setResolution] = useState<GrokResolution>(DEFAULT_GROK_RESOLUTION);

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
  // Non-Try-On features pass their images through unchanged.
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

  // Single Grok call for the current inputs. `count` lets regenerate request
  // exactly one image while the main generate uses the n slider. `subjectOverride`
  // swaps image[0] for a batch subject.
  const runGeneration = useCallback(
    async (count: number, signal?: AbortSignal, subjectOverride?: ImageFile): Promise<ImageFile[]> => {
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
        ? editGrokImage({ model, prompt: composedPrompt, images: requestImages, n: count, aspectRatio, resolution }, config, signal)
        : generateGrokImage({ model, prompt: composedPrompt, n: count, aspectRatio, resolution }, config, signal);
    },
    [activeFeature, prompt, images, fields, batch.isMultiPersonMode, batch.markerPosition, lookbook.lookbookState, lookbook.lookbookFabricImage, prepareImages, model, aspectRatio, resolution, settings.apiKey, settings.baseUrl],
  );

  // Wardrobe: generate one set as a Try-On edit (subject + the set's items as
  // source images). Service call lives here so `useProviderWardrobe` stays
  // service-agnostic (Red Team #2). Composes the prompt via the shared adapter.
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
      return editGrokImage({ model, prompt: composedPrompt, images: requestImages, n, aspectRatio, resolution }, config, signal);
    },
    [settings.apiKey, settings.baseUrl, model, n, aspectRatio, resolution],
  );

  const wardrobe = useProviderWardrobe(generateSet, GROK_WARDROBE_CONFIG, t);

  // Lookbook rich output: variations / close-ups / refine built on the shared
  // prompt builders + Grok edit service (service import stays here, not in the
  // engine hook — boundary-safe).
  const lookbookOutput = useProviderLookbookOutput(
    {
      generateVariations: async (base, count, signal) => {
        const config = { apiKey: settings.apiKey, baseUrl: settings.baseUrl };
        return editGrokImage(
          { model, prompt: buildVariationPrompt(lookbook.lookbookState.lookbookStyle, count), images: [base], n: count, aspectRatio, resolution },
          config,
          signal,
        );
      },
      generateCloseUps: async (base, signal) => {
        const config = { apiKey: settings.apiKey, baseUrl: settings.baseUrl };
        const negative = buildCloseUpNegativePrompt(lookbook.lookbookState.negativePrompt);
        const out: ImageFile[] = [];
        for (const prompt of buildCloseUpPrompts()) {
          const [img] = await editGrokImage(
            { model, prompt: `${prompt}\n\nAvoid: ${negative}`, images: [base], n: 1, aspectRatio, resolution },
            config,
            signal,
          );
          if (img) out.push(img);
        }
        return out;
      },
      refine: async (base, instruction, signal) => {
        const config = { apiKey: settings.apiKey, baseUrl: settings.baseUrl };
        const [edited] = await editGrokImage(
          { model, prompt: buildProviderRefinePrompt(instruction), images: [base], n: 1, aspectRatio, resolution },
          config,
          signal,
        );
        return edited;
      },
    },
    { maxVariations: GROK_LOOKBOOK_MAX_VARIATIONS, getSignal: () => abortControllerRef.current?.signal },
    t,
  );

  // Sync the lookbook rich-output main image from the latest generate result.
  useEffect(() => {
    if (activeFeature === Feature.Lookbook) {
      lookbookOutput.setMain(results[0] ?? null);
    }
  }, [results, activeFeature]);

  // Reset transient workflow state when the active feature changes, and abort
  // any request that was started for the previous feature so a late-arriving
  // response cannot overwrite the new feature's state. Covers tryOnMode +
  // wardrobe sets/results + lookbook output (Red Team #5, #6).
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

  // Per-tile result actions (refine / upscale / regenerate). Grok upscale uses
  // the native 2k resolution plus a preservation prompt; results feed back as
  // the edit source (provider endpoints are stateless, like Gemini chat-refine).
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
      const [edited] = await editGrokImage(
        { model, prompt: buildProviderRefinePrompt(instruction), images: [source], n: 1, aspectRatio, resolution },
        config,
        signal,
      );
      return edited;
    },
    upscaleOne: async (source, quality, signal) => {
      const config = { apiKey: settings.apiKey, baseUrl: settings.baseUrl };
      const [upscaled] = await editGrokImage(
        { model, prompt: PROVIDER_UPSCALE_PROMPTS[quality], images: [source], n: 1, aspectRatio, resolution: '2k' },
        config,
        signal,
      );
      return upscaled;
    },
    regenerateOne: async (signal) => {
      const [regenerated] = await runGeneration(1, signal);
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
        (subject, signal) => runGeneration(n, signal, subject),
        abortControllerRef.current?.signal,
      );
      return;
    }

    setIsLoading(true);
    setResults([]);

    try {
      const generated = await runGeneration(n, abortControllerRef.current?.signal);
      setResults(generated);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Silent on studio switch / unmount.
      }
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, batch, actions.busyIndex, activeFeature, images, runGeneration, n, t]);

  return {
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    setApiKey: (value: string) => setProviderSettings('grok', { apiKey: value }),
    setBaseUrl: (value: string) => setProviderSettings('grok', { baseUrl: value }),
    resetSettings: () => resetProviderSettings('grok'),
    ...fields,
    model,
    setModel: (value: string) => {
      if (isKnownGrokModel(value)) {
        setModel(value);
      }
    },
    prompt,
    setPrompt,
    images,
    setImages,
    n,
    setN,
    aspectRatio,
    setAspectRatio: (value: string) => setAspectRatio(value as GrokAspectRatio),
    resolution,
    setResolution: (value: string) => setResolution(value as GrokResolution),
    modelOptions: GROK_MODELS.map((m) => ({ value: m.modelId, label: m.label })),
    aspectRatioOptions: [...GROK_ASPECT_RATIOS],
    resolutionOptions: [...GROK_RESOLUTIONS],
    isLoading,
    error,
    results,
    clearError: () => setError(null),
    handleGenerate,
    ...actions,
    ...batch,
    ...lookbook,
    maxReferenceImages: GROK_MAX_REFERENCE_IMAGES,
    minOutputs: GROK_MIN_OUTPUTS,
    maxOutputs: GROK_MAX_OUTPUTS,
    tryOnMode,
    setTryOnMode,
    wardrobe,
    lookbookOutput,
  };
};
