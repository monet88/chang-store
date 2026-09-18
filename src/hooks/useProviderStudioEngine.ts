import { useEffect, useMemo } from 'react';
import { Feature, ImageFile, VirtualTryOnMode } from '../types';
import { buildProviderRefinePrompt } from '../utils/provider-refine-prompt';
import { buildVariationPrompt, buildCloseUpPrompts, buildCloseUpNegativePrompt } from '../utils/lookbookPromptBuilder';
import { useProviderStudioFields, UseProviderStudioFieldsReturn } from './useProviderStudioFields';
import { useProviderResultActions, UseProviderResultActionsReturn } from './useProviderResultActions';
import { useProviderTryOnBatch, UseProviderTryOnBatchReturn } from './useProviderTryOnBatch';
import { useProviderLookbookFields, UseProviderLookbookFieldsReturn } from './useProviderLookbookFields';
import { useProviderWardrobe, UseProviderWardrobeReturn, ProviderWardrobeConfig } from './useProviderWardrobe';
import { useProviderLookbookOutput, UseProviderLookbookOutputReturn } from './useProviderLookbookOutput';
import type { ProviderImageDriver } from './useProviderStudioGeneration';
import { useProviderStudioGeneration } from './useProviderStudioGeneration';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

/**
 * Provider image primitives the engine orchestrates.
 * The generation hook owns the driver contract; re-export the type here so
 * callers (useGptImageStudio) keep a stable import path.
 */
export type { ProviderImageDriver } from './useProviderStudioGeneration';

export interface ProviderStudioEngineConfig {
  activeFeature: Feature;
  driver: ProviderImageDriver;
  wardrobeConfig: ProviderWardrobeConfig;
  /** Lookbook variation cap (GPT 1). */
  maxVariations: number;
  /** Requested output count for main/batch/set generation (GPT 1). */
  mainCount: number;
  /**
   * When true, variations are produced one call at a time (GPT: slow multipart
   * edits). When false, a single request asks for all variations at once.
   */
  serialVariations: boolean;
}

/**
 * Shared control surface both provider studios expose (minus provider-specific
 * option fields, which the provider hooks add).
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
 * Shared orchestration for GPT Image provider studios.
 *
 * Delegates prompt/images/results + generation + per-tile actions to
 * `useProviderStudioGeneration`. Owns wardrobe wiring, lookbook handlers/output,
 * feature-switch reset coordination, and the public return surface.
 */
export const useProviderStudioEngine = (
  config: ProviderStudioEngineConfig,
  t: TranslateFn,
): UseProviderStudioEngineReturn => {
  const { activeFeature, driver, wardrobeConfig, maxVariations, mainCount, serialVariations } = config;

  const fields = useProviderStudioFields();
  const batch = useProviderTryOnBatch(t);
  const lookbook = useProviderLookbookFields();

  const gen = useProviderStudioGeneration({
    activeFeature,
    driver,
    fields,
    batch,
    lookbook,
    mainCount,
    t,
  });

  // Wardrobe receives the generation surface's generateSet (injected driver call
  // lives inside the generation hook; wardrobe stays service-agnostic).
  const wardrobe = useProviderWardrobe(gen.generateSet, wardrobeConfig, t);

  // Lookbook rich output: variations / close-ups / refine built on the shared
  // prompt builders + the injected driver.
  const lookbookStyle = lookbook.lookbookState.lookbookStyle;
  const lookbookNegativePrompt = lookbook.lookbookState.negativePrompt;

  const lookbookHandlers = useMemo(() => ({
    generateVariations: async (base: ImageFile, count: number, signal?: AbortSignal) => {
      if (serialVariations) {
        const out: ImageFile[] = [];
        for (let i = 0; i < count; i++) {
          const [img] = await driver.edit(buildVariationPrompt(lookbookStyle), [base], 1, signal);
          if (img) out.push(img);
        }
        return out;
      }
      return driver.edit(buildVariationPrompt(lookbookStyle), [base], count, signal);
    },
    generateCloseUps: async (base: ImageFile, signal?: AbortSignal) => {
      const negative = buildCloseUpNegativePrompt(lookbookNegativePrompt);
      const out: ImageFile[] = [];
      for (const closeUpPrompt of buildCloseUpPrompts()) {
        const [img] = await driver.edit(`${closeUpPrompt}\n\nAvoid: ${negative}`, [base], 1, signal);
        if (img) out.push(img);
      }
      return out;
    },
    refine: async (base: ImageFile, instruction: string, signal?: AbortSignal) => {
      const [edited] = await driver.edit(buildProviderRefinePrompt(instruction), [base], 1, signal);
      return edited;
    },
  }), [driver, serialVariations, lookbookStyle, lookbookNegativePrompt]);

  const lookbookConfig = useMemo(() => ({ maxVariations, getSignal: gen.getSignal }), [maxVariations, gen.getSignal]);
  const lookbookOutput = useProviderLookbookOutput(lookbookHandlers, lookbookConfig, t);

  // Sync the lookbook main image when the active feature produces new results.
  useEffect(() => {
    if (activeFeature === Feature.Lookbook) {
      lookbookOutput.setMain(gen.results[0] ?? null);
    }
  }, [gen.results, activeFeature]);

  // Full reset when switching features inside the provider studio.
  // Delegates generation state + controller to the generation hook; coordinates
  // the other sub-hooks (fields, batch extras, lookbook, wardrobe, output).
  useEffect(() => {
    gen.abortCurrent();
    gen.reset();
    fields.resetFields();
    batch.resetExtras();
    lookbook.resetLookbookFields();
    wardrobe.reset();
    lookbookOutput.reset();
  }, [activeFeature]);

  // Strip generation-hook internals from the public surface before returning.
  const {
    generateSet: _generateSet,
    getSignal: _getSignal,
    reset: _genReset,
    abortCurrent: _abortCurrent,
    ...genSurface
  } = gen;

  return {
    ...fields,
    ...genSurface,
    ...batch,
    ...lookbook,
    wardrobe,
    lookbookOutput,
  };
};
