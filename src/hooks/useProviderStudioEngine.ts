import { useCallback, useEffect, useRef, useState } from 'react';
import { Feature, ImageFile, UpscaleQuality, VirtualTryOnClothingItem, VirtualTryOnMode } from '../types';
import { getErrorMessage, compositeMarkerOnImage } from '../utils/imageUtils';
import { buildProviderStudioPrompt } from '../utils/provider-studio-prompt-adapter';
import { buildProviderRefinePrompt } from '../utils/provider-refine-prompt';
import { buildVariationPrompt, buildCloseUpPrompts, buildCloseUpNegativePrompt } from '../utils/lookbookPromptBuilder';
import { useProviderStudioFields, UseProviderStudioFieldsReturn } from './useProviderStudioFields';
import { useProviderResultActions, UseProviderResultActionsReturn } from './useProviderResultActions';
import { useProviderTryOnBatch, UseProviderTryOnBatchReturn } from './useProviderTryOnBatch';
import { useProviderLookbookFields, UseProviderLookbookFieldsReturn } from './useProviderLookbookFields';
import { useProviderWardrobe, UseProviderWardrobeReturn, ProviderWardrobeConfig } from './useProviderWardrobe';
import { useProviderLookbookOutput, UseProviderLookbookOutputReturn } from './useProviderLookbookOutput';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

/**
 * Provider image primitives the engine orchestrates. Each provider studio hook
 * builds a driver from its own service + option state (model/aspect/resolution
 * for Grok; size/quality for GPT). The engine never imports a provider service
 * itself, so `src/hooks/useProvider*.ts` stays boundary-clean (Red Team #2).
 *
 * `count` is the requested output count. Grok honours it (maps to `n`); GPT
 * ignores it (its edit/generate endpoints always emit `GPT_IMAGE_OUTPUT_COUNT`).
 */
export interface ProviderImageDriver {
  /** Edit `images` with `prompt`, requesting `count` outputs. */
  edit: (prompt: string, images: ImageFile[], count: number, signal?: AbortSignal) => Promise<ImageFile[]>;
  /** Text-to-image generate from `prompt`, requesting `count` outputs. */
  generate: (prompt: string, count: number, signal?: AbortSignal) => Promise<ImageFile[]>;
  /** Preservation-first upscale of a single result (provider param overrides live here). */
  upscale: (source: ImageFile, quality: UpscaleQuality, signal?: AbortSignal) => Promise<ImageFile[]>;
}

export interface ProviderStudioEngineConfig {
  activeFeature: Feature;
  driver: ProviderImageDriver;
  wardrobeConfig: ProviderWardrobeConfig;
  /** Lookbook variation cap (Grok 4, GPT 1). */
  maxVariations: number;
  /** Requested output count for main/batch/set generation (Grok `n`, GPT 1). */
  mainCount: number;
  /**
   * When true, variations are produced one call at a time (GPT: slow multipart
   * edits). When false, a single request asks for all variations at once (Grok).
   */
  serialVariations: boolean;
}

/**
 * Shared control surface both provider studios expose (minus provider-specific
 * option fields, which the provider hooks add). Kept as the intersection of the
 * composed sub-hook returns plus the engine-owned workflow state.
 */
export interface UseProviderStudioEngineReturn
  extends UseProviderStudioFieldsReturn,
    UseProviderResultActionsReturn,
    UseProviderTryOnBatchReturn,
    UseProviderLookbookFieldsReturn {
  prompt: string;
  setPrompt: (value: string) => void;
  images: ImageFile[];
  setImages: (images: ImageFile[]) => void;
  isLoading: boolean;
  error: string | null;
  results: ImageFile[];
  clearError: () => void;
  handleGenerate: () => Promise<void>;
  tryOnMode: VirtualTryOnMode;
  setTryOnMode: (mode: VirtualTryOnMode) => void;
  wardrobe: UseProviderWardrobeReturn;
  lookbookOutput: UseProviderLookbookOutputReturn;
}

/**
 * Shared orchestration + state for the Grok and GPT Image provider studios.
 *
 * Owns the common workflow: prompt/images/results state, per-source-item fields,
 * Try-On batch, wardrobe, lookbook fields + rich output, per-tile result actions,
 * the active-feature reset/abort effect, and the generate flow (single / batch).
 * The only provider-specific piece is the injected `driver`; everything routed
 * through it stays identical across providers.
 */
export const useProviderStudioEngine = (
  config: ProviderStudioEngineConfig,
  t: TranslateFn,
): UseProviderStudioEngineReturn => {
  const { activeFeature, driver, wardrobeConfig, maxVariations, mainCount, serialVariations } = config;

  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<ImageFile[]>([]);
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

  // Single provider call for the current inputs. `count` lets regenerate request
  // exactly one image while the main generate uses the provider's main count.
  // `subjectOverride` swaps image[0] for a batch subject.
  const runGeneration = useCallback(
    async (count: number, signal?: AbortSignal, subjectOverride?: ImageFile): Promise<ImageFile[]> => {
      const requestImages = await prepareImages(subjectOverride);
      const multiPerson = activeFeature === Feature.TryOn && batch.isMultiPersonMode && batch.markerPosition !== null;
      const composedPrompt = buildProviderStudioPrompt(activeFeature, prompt, requestImages, {
        ...fields.buildPromptOptions(),
        isMultiPersonMode: multiPerson,
        lookbookState: lookbook.lookbookState,
        fabricTextureImage: lookbook.lookbookFabricImage,
      });
      return requestImages.length > 0
        ? driver.edit(composedPrompt, requestImages, count, signal)
        : driver.generate(composedPrompt, count, signal);
    },
    [activeFeature, prompt, fields, batch.isMultiPersonMode, batch.markerPosition, lookbook.lookbookState, lookbook.lookbookFabricImage, prepareImages, driver],
  );

  // Wardrobe: generate one set as a Try-On edit (subject + the set's items as
  // source images). Service call goes through the injected driver so
  // `useProviderWardrobe` stays service-agnostic (Red Team #2).
  const generateSet = useCallback(
    async (
      subject: ImageFile,
      items: VirtualTryOnClothingItem[],
      prompts: { backgroundPrompt: string; extraPrompt: string },
      signal?: AbortSignal,
    ): Promise<ImageFile[]> => {
      const withImage = items.filter((i) => i.image !== null);
      const requestImages = [subject, ...withImage.map((i) => i.image as ImageFile)];
      const composedPrompt = buildProviderStudioPrompt(Feature.TryOn, '', requestImages, {
        sourceItemTypes: withImage.map((i) => i.sourceItemType),
        sourceItemNotes: withImage.map((i) => i.sourcePrompt),
        backgroundPrompt: prompts.backgroundPrompt,
        extraPrompt: prompts.extraPrompt,
      });
      return driver.edit(composedPrompt, requestImages, mainCount, signal);
    },
    [driver, mainCount],
  );

  const wardrobe = useProviderWardrobe(generateSet, wardrobeConfig, t);

  // Lookbook rich output: variations / close-ups / refine built on the shared
  // prompt builders + the injected driver (no service import here).
  const lookbookOutput = useProviderLookbookOutput(
    {
      generateVariations: async (base, count, signal) => {
        if (serialVariations) {
          // Serial — slow multipart edits; each call asks for a single variation.
          const out: ImageFile[] = [];
          for (let i = 0; i < count; i++) {
            const [img] = await driver.edit(buildVariationPrompt(lookbook.lookbookState.lookbookStyle, 1), [base], 1, signal);
            if (img) out.push(img);
          }
          return out;
        }
        return driver.edit(buildVariationPrompt(lookbook.lookbookState.lookbookStyle, count), [base], count, signal);
      },
      generateCloseUps: async (base, signal) => {
        const negative = buildCloseUpNegativePrompt(lookbook.lookbookState.negativePrompt);
        const out: ImageFile[] = [];
        for (const closeUpPrompt of buildCloseUpPrompts()) {
          const [img] = await driver.edit(`${closeUpPrompt}\n\nAvoid: ${negative}`, [base], 1, signal);
          if (img) out.push(img);
        }
        return out;
      },
      refine: async (base, instruction, signal) => {
        const [edited] = await driver.edit(buildProviderRefinePrompt(instruction), [base], 1, signal);
        return edited;
      },
    },
    { maxVariations, getSignal: () => abortControllerRef.current?.signal },
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

  // Per-tile result actions (refine / upscale / regenerate). Results feed back
  // as the edit source (provider endpoints are stateless, like Gemini chat-
  // refine). Declared before handleGenerate so the generate flow can block on
  // `actions.busyIndex` (mutual exclusion — no concurrent requests).
  const actions = useProviderResultActions({
    results,
    setResults,
    getSignal: () => abortControllerRef.current?.signal,
    isBusy: isLoading || batch.isBatchRunning,
    t,
    editOne: async (source, instruction, signal) => {
      const [edited] = await driver.edit(buildProviderRefinePrompt(instruction), [source], 1, signal);
      return edited;
    },
    upscaleOne: async (source, quality, signal) => {
      const [upscaled] = await driver.upscale(source, quality, signal);
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
        (subject, signal) => runGeneration(mainCount, signal, subject),
        abortControllerRef.current?.signal,
      );
      return;
    }

    setIsLoading(true);
    setResults([]);

    try {
      const generated = await runGeneration(mainCount, abortControllerRef.current?.signal);
      setResults(generated);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Silent on studio switch / unmount.
      }
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, batch, actions.busyIndex, activeFeature, images, runGeneration, mainCount, t]);

  return {
    ...fields,
    prompt,
    setPrompt,
    images,
    setImages,
    isLoading,
    error,
    results,
    clearError: () => setError(null),
    handleGenerate,
    ...actions,
    ...batch,
    ...lookbook,
    tryOnMode,
    setTryOnMode,
    wardrobe,
    lookbookOutput,
  };
};
