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

export interface UseGptImageStudioReturn extends UseProviderStudioFieldsReturn, UseProviderResultActionsReturn, UseProviderTryOnBatchReturn {
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

  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset transient workflow state when the active feature changes, and abort
  // any request that was started for the previous feature so a late-arriving
  // response cannot overwrite the new feature's state.
  useEffect(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setPrompt('');
    setImages([]);
    setResults([]);
    setError(null);
    fields.resetFields();
    batch.resetExtras();
    return () => {
      controller.abort();
    };
  }, [activeFeature]);

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
      });
      return requestImages.length > 0
        ? editGptImage({ model: DEFAULT_GPT_IMAGE_MODEL, prompt: composedPrompt, images: requestImages, size, quality }, config, signal)
        : generateGptImage({ model: DEFAULT_GPT_IMAGE_MODEL, prompt: composedPrompt, size, quality }, config, signal);
    },
    [activeFeature, prompt, images, fields, batch.isMultiPersonMode, batch.markerPosition, prepareImages, size, quality, settings.apiKey, settings.baseUrl],
  );

  const handleGenerate = useCallback(async (): Promise<void> => {
    if (isLoading || batch.isBatchRunning) return;

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
  }, [isLoading, batch, activeFeature, images, runGeneration, t]);

  // Per-tile result actions (refine / upscale / regenerate). GPT Image has no
  // native resolution flag, so upscale relies on a preservation prompt at the
  // largest quality; results feed back as the edit source (stateless endpoint).
  const actions = useProviderResultActions({
    results,
    setResults,
    getSignal: () => abortControllerRef.current?.signal,
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
    maxReferenceImages: MAX_GPT_REFERENCE_IMAGES,
  };
};
