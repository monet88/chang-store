import { useCallback, useEffect, useRef, useState } from 'react';
import { Feature, ImageFile, StudioMode } from '../types';
import { useApi } from '../contexts/ApiProviderContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getErrorMessage } from '../utils/imageUtils';
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
import { useProviderStudioFields, UseProviderStudioFieldsReturn } from './useProviderStudioFields';

export interface UseGptImageStudioReturn extends UseProviderStudioFieldsReturn {
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
    return () => {
      controller.abort();
    };
  }, [activeFeature]);

  const handleGenerate = useCallback(async (): Promise<void> => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setResults([]);

    const signal = abortControllerRef.current?.signal;
    const config = { apiKey: settings.apiKey, baseUrl: settings.baseUrl };

    // Compose the builder-enriched prompt transiently; the textarea state keeps
    // showing the user's raw words.
    const composedPrompt = buildProviderStudioPrompt(activeFeature, prompt, images, fields.buildPromptOptions());

    try {
      const generated = images.length > 0
        ? await editGptImage(
          { model: DEFAULT_GPT_IMAGE_MODEL, prompt: composedPrompt, images, size, quality },
          config,
          signal,
        )
        : await generateGptImage(
          { model: DEFAULT_GPT_IMAGE_MODEL, prompt: composedPrompt, size, quality },
          config,
          signal,
        );

      setResults(generated);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Silent on studio switch / unmount.
      }
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, images, prompt, size, quality, activeFeature, fields, settings.apiKey, settings.baseUrl, t]);

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
    maxReferenceImages: MAX_GPT_REFERENCE_IMAGES,
  };
};
