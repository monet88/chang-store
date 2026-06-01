import { useCallback, useState } from 'react';
import { ImageFile } from '../types';
import { getErrorMessage } from '../utils/imageUtils';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

/** One refined version in the step-back history. */
export interface ProviderLookbookVersion {
  image: ImageFile;
  prompt: string;
  timestamp: number;
}

export interface ProviderLookbookOutputCallbacks {
  /** Produce `count` variations from the base image. */
  generateVariations: (base: ImageFile, count: number, signal?: AbortSignal) => Promise<ImageFile[]>;
  /** Produce close-up crops from the base image. */
  generateCloseUps: (base: ImageFile, signal?: AbortSignal) => Promise<ImageFile[]>;
  /** Refine the base image with a free-text instruction (one result). */
  refine: (base: ImageFile, instruction: string, signal?: AbortSignal) => Promise<ImageFile>;
}

export interface ProviderLookbookOutputConfig {
  /** Max variations (GPT capped at 1). */
  maxVariations: number;
  getSignal?: () => AbortSignal | undefined;
}

export interface UseProviderLookbookOutputReturn {
  main: ImageFile | null;
  variations: ImageFile[];
  closeUps: ImageFile[];
  versions: ProviderLookbookVersion[];
  selectedVersionIndex: number;
  variationCount: number;
  setVariationCount: (count: number) => void;
  isGeneratingVariations: boolean;
  isGeneratingCloseUp: boolean;
  isRefining: boolean;
  error: string | null;
  clearError: () => void;
  /** Seed/replace the main image (called when a new lookbook is generated). */
  setMain: (image: ImageFile | null) => void;
  generateVariations: () => Promise<void>;
  generateCloseUps: () => Promise<void>;
  refine: (instruction: string) => Promise<void>;
  selectVersion: (index: number) => void;
  reset: () => void;
  maxVariations: number;
}

/**
 * Provider-specific Lookbook rich-output engine. Owns main + variations +
 * close-ups + a refinement version history (step back/forward via index).
 * Service-agnostic: the provider service calls are injected as callbacks so the
 * shared hook never imports a provider service (boundary-safe). GPT caps
 * variations at 1 via `maxVariations`.
 */
export const useProviderLookbookOutput = (
  callbacks: ProviderLookbookOutputCallbacks,
  config: ProviderLookbookOutputConfig,
  t: TranslateFn,
): UseProviderLookbookOutputReturn => {
  const { maxVariations, getSignal } = config;
  const [original, setOriginal] = useState<ImageFile | null>(null);
  const [main, setMainState] = useState<ImageFile | null>(null);
  const [variations, setVariations] = useState<ImageFile[]>([]);
  const [closeUps, setCloseUps] = useState<ImageFile[]>([]);
  const [versions, setVersions] = useState<ProviderLookbookVersion[]>([]);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(-1);
  const [variationCount, setVariationCount] = useState(Math.min(2, maxVariations));
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [isGeneratingCloseUp, setIsGeneratingCloseUp] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setMain = useCallback((image: ImageFile | null) => {
    setOriginal(image);
    setMainState(image);
    setVariations([]);
    setCloseUps([]);
    setVersions([]);
    setSelectedVersionIndex(-1);
    setError(null);
  }, []);

  const generateVariations = useCallback(async () => {
    if (!main || isGeneratingVariations) return;
    setIsGeneratingVariations(true);
    setError(null);
    try {
      const count = Math.min(variationCount, maxVariations);
      const next = await callbacks.generateVariations(main, count, getSignal?.());
      setVariations(next);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(getErrorMessage(err, t));
    } finally {
      setIsGeneratingVariations(false);
    }
  }, [main, isGeneratingVariations, variationCount, maxVariations, callbacks, getSignal, t]);

  const generateCloseUps = useCallback(async () => {
    if (!main || isGeneratingCloseUp) return;
    setIsGeneratingCloseUp(true);
    setError(null);
    try {
      const next = await callbacks.generateCloseUps(main, getSignal?.());
      setCloseUps(next);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(getErrorMessage(err, t));
    } finally {
      setIsGeneratingCloseUp(false);
    }
  }, [main, isGeneratingCloseUp, callbacks, getSignal, t]);

  const refine = useCallback(
    async (instruction: string) => {
      if (!main || isRefining || !instruction.trim()) return;
      setIsRefining(true);
      setError(null);
      try {
        const refined = await callbacks.refine(main, instruction, getSignal?.());
        // Refining invalidates variations/close-ups (they were from the old main).
        setVersions((prev) => [...prev, { image: refined, prompt: instruction, timestamp: Date.now() }]);
        setSelectedVersionIndex((prev) => prev + 1);
        setMainState(refined);
        setVariations([]);
        setCloseUps([]);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(getErrorMessage(err, t));
      } finally {
        setIsRefining(false);
      }
    },
    [main, isRefining, callbacks, getSignal, t],
  );

  const selectVersion = useCallback(
    (index: number) => {
      if (index === -1) {
        setMainState(original);
      } else if (index >= 0 && index < versions.length) {
        setMainState(versions[index].image);
      }
      setSelectedVersionIndex(index);
      setVariations([]);
      setCloseUps([]);
    },
    [original, versions],
  );

  const reset = useCallback(() => {
    setOriginal(null);
    setMainState(null);
    setVariations([]);
    setCloseUps([]);
    setVersions([]);
    setSelectedVersionIndex(-1);
    setVariationCount(Math.min(2, maxVariations));
    setIsGeneratingVariations(false);
    setIsGeneratingCloseUp(false);
    setIsRefining(false);
    setError(null);
  }, [maxVariations]);

  return {
    main,
    variations,
    closeUps,
    versions,
    selectedVersionIndex,
    variationCount,
    setVariationCount,
    isGeneratingVariations,
    isGeneratingCloseUp,
    isRefining,
    error,
    clearError: () => setError(null),
    setMain,
    generateVariations,
    generateCloseUps,
    refine,
    selectVersion,
    reset,
    maxVariations,
  };
};
