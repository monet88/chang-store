import { useCallback, useRef, useState } from 'react';
import type { Part } from '@google/genai';
import {
  AspectRatio,
  EComPackCategory,
  EComPackItem,
  Feature,
  GarmentScope,
  ImageEngineId,
  ImageFile,
  ImageResolution,
} from '../types';
import { ClothingTransferImageDriver } from './useClothingTransferEngine';
import { BrandModelProfile } from '../config/brandModelRoster';
import { DisplayTemplate } from '../config/displayTemplates';
import {
  buildGeminiBrandModelParts,
  buildGeminiClothingTransferParts,
  buildGeminiProductStagingParts,
} from '../utils/gemini-clothing-transfer-prompt';
import {
  buildGptBrandModelParts,
  buildGptClothingTransferParts,
  buildGptProductStagingParts,
} from '../utils/gpt-clothing-transfer-prompt';
import { resolveEngineConcurrency } from '../utils/engineDispatch';
import {
  buildQwenBrandModelParts,
  buildQwenClothingTransferParts,
  buildQwenProductStagingParts,
} from '../utils/qwen-clothing-transfer-prompt';
import { formatGarmentScope } from '../utils/clothing-transfer-prompt-types';
import { runBoundedWorkers } from '../utils/run-bounded-workers';
import { getErrorMessage } from '../utils/imageUtils';

/** Worker ceiling for one pack run; a single run never exceeds this many in-flight requests. */
export const ECOM_PACK_BATCH_MAX_CONCURRENCY = 3;

/** The user's live E-Com Pack selection, the only input target planning reads. */
export interface EComPackPlanInput {
  displayTemplates: DisplayTemplate[];
  selectedTemplateIds: string[];
  brandModels: BrandModelProfile[];
  selectedBrandModelIds: string[];
  customDestinations: ImageFile[];
  garmentScopes: GarmentScope[];
}

/**
 * One resolved generation target. The definition travels with the planned item so
 * regenerate-one reruns that exact definition even if the selection moved since.
 */
export type EComPackTarget =
  | { kind: 'product'; template: DisplayTemplate; scope: GarmentScope }
  | { kind: 'brand-model'; model: BrandModelProfile }
  | { kind: 'custom-destination'; destination: ImageFile };

export interface EComPackPlannedTarget {
  item: EComPackItem;
  target: EComPackTarget;
}

/**
 * Resolve the current selection into the ordered pack cards of one run:
 * product display assets, then brand models, then custom destinations.
 */
export const planEComPackTargets = (input: EComPackPlanInput): EComPackPlannedTarget[] => {
  const garmentScopes = input.garmentScopes.length > 0 ? input.garmentScopes : ['full-set' as GarmentScope];
  const productTargets = input.displayTemplates
    .filter((template) => input.selectedTemplateIds.includes(template.id))
    .flatMap((template): EComPackPlannedTarget[] =>
      garmentScopes.map((scope) => {
        const scoped = garmentScopes.length > 1 || scope !== 'full-set';
        return {
          item: {
            id: scoped ? `template-${template.id}-${scope}` : `template-${template.id}`,
            category: 'product',
            title: scoped ? `${template.name} · ${formatGarmentScope(scope)}` : template.name,
            subtitle: template.category === 'hanger' ? 'Hanger' : 'Flat Lay',
            status: 'pending',
            results: [],
          },
          target: { kind: 'product', template, scope },
        };
      }),
    );

  const brandModelTargets = input.brandModels
    .filter((model) => input.selectedBrandModelIds.includes(model.id))
    .map((model): EComPackPlannedTarget => ({
      item: {
        id: `brand-${model.id}`,
        category: 'brand-models',
        title: model.name,
        subtitle: model.metadata.styleVibe,
        status: 'pending',
        results: [],
      },
      target: { kind: 'brand-model', model },
    }));

  const destinationTargets = input.customDestinations.map(
    (destination, index): EComPackPlannedTarget => ({
      item: {
        id: `custom-${index}`,
        category: 'custom-destinations',
        title: `Concept #${index + 1}`,
        subtitle: 'Custom Scene',
        status: 'pending',
        results: [],
      },
      target: { kind: 'custom-destination', destination },
    }),
  );

  return [...productTargets, ...brandModelTargets, ...destinationTargets];
};

interface EComPackPromptContext {
  sourceOutfitImage: ImageFile;
  garmentScopes: GarmentScope[];
  extraPrompt: string;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  engineId?: ImageEngineId;
  blueprint: string;
}

/**
 * Assemble one target's request through the prompt family that owns its policy.
 * Both families receive the same model-agnostic blueprint, and each expresses it
 * its own way (ADR-0002).
 */
const buildTargetParts = (
  target: EComPackTarget,
  context: EComPackPromptContext,
): Part[] => {
  const isGptImage = context.engineId === 'gptImage';
  const isLocalQwen = context.engineId === 'localQwen';
  switch (target.kind) {
    case 'product':
      return isLocalQwen
        ? buildQwenProductStagingParts(
            context.sourceOutfitImage,
            target.template,
            target.scope,
            context.extraPrompt,
            context.blueprint,
            context.aspectRatio,
            context.resolution,
          )
        : isGptImage
        ? buildGptProductStagingParts(
            context.sourceOutfitImage,
            target.template,
            target.scope,
            context.extraPrompt,
            context.blueprint,
            context.aspectRatio,
            context.resolution,
          )
        : buildGeminiProductStagingParts(
            context.sourceOutfitImage,
            target.template,
            target.scope,
            context.extraPrompt,
            context.blueprint,
          );
    case 'brand-model':
      return isLocalQwen
        ? buildQwenBrandModelParts(
            context.sourceOutfitImage,
            target.model,
            context.extraPrompt,
            context.blueprint,
            context.garmentScopes,
          )
        : isGptImage
        ? buildGptBrandModelParts(
            context.sourceOutfitImage,
            target.model,
            context.garmentScopes,
            context.extraPrompt,
            context.blueprint,
          )
        : buildGeminiBrandModelParts(
            context.sourceOutfitImage,
            target.model,
            context.extraPrompt,
            context.blueprint,
            context.garmentScopes,
          );
    case 'custom-destination': {
      const sourceReferences = context.garmentScopes.map((scope) => ({
        image: context.sourceOutfitImage,
        label: formatGarmentScope(scope),
      }));
      return isLocalQwen
        ? buildQwenClothingTransferParts(
            target.destination,
            sourceReferences,
            context.extraPrompt,
            context.blueprint,
          )
        : isGptImage
        ? buildGptClothingTransferParts(
            target.destination,
            sourceReferences,
            context.extraPrompt,
            context.blueprint,
          )
        : buildGeminiClothingTransferParts(
            target.destination,
            sourceReferences,
            context.extraPrompt,
            context.blueprint,
          );
    }
  }
};

export interface UseClothingTransferEComPackRunConfig {
  driver: ClothingTransferImageDriver;
  sourceOutfitImage: ImageFile | null;
  selection: EComPackPlanInput;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  numImages: number;
  imageEditModel: string;
  engineId?: ImageEngineId;
  extraPrompt: string;
  /**
   * The active model-agnostic blueprint for this source outfit, analyzed on demand
   * when the run has none yet. Null falls back to the base prompt.
   */
  resolveOutfitBlueprint: () => Promise<string | null>;
  addImage: (image: ImageFile, feature?: Feature, engine?: ImageEngineId) => void;
  setError: (msg: string | null) => void;
  t: (key: string, options?: Record<string, string | number>) => string;
}

export interface UseClothingTransferEComPackRunReturn {
  packItems: EComPackItem[];
  isGenerating: boolean;
  handleGeneratePack: () => Promise<void>;
  handleGenerateCategory: (category: EComPackCategory) => Promise<void>;
  handleRegeneratePackItem: (itemId: string) => Promise<void>;
  commitPackResult: (itemId: string, index: number, image: ImageFile) => void;
}

/**
 * The E-Com Pack run: owned target planning, active-blueprint consumption, bounded
 * batch execution, per-item result state, and regenerate-one. Form and selection
 * state stay in `useClothingTransferEComPack`; this seam only executes them.
 */
export const useClothingTransferEComPackRun = (
  config: UseClothingTransferEComPackRunConfig,
): UseClothingTransferEComPackRunReturn => {
  const {
    driver,
    sourceOutfitImage,
    selection,
    aspectRatio,
    resolution,
    numImages,
    imageEditModel,
    engineId,
    extraPrompt,
    resolveOutfitBlueprint,
    addImage,
    setError,
    t,
  } = config;

  const [packItems, setPackItems] = useState<EComPackItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  /** Definition each published pack card was planned to generate. */
  const plannedTargets = useRef<Map<string, EComPackTarget>>(new Map());

  const updatePackItem = useCallback((id: string, patch: Partial<EComPackItem>) => {
    setPackItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const commitPackResult = useCallback((itemId: string, index: number, image: ImageFile) => {
    setPackItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              results: item.results.map((result, resultIndex) => (resultIndex === index ? image : result)),
            }
          : item,
      ),
    );
  }, []);

  const generateTarget = useCallback(
    async (itemId: string, target: EComPackTarget, blueprint: string): Promise<void> => {
      if (!sourceOutfitImage) return;
      updatePackItem(itemId, { status: 'processing', results: [], error: undefined });

      try {
        const parts = buildTargetParts(target, {
          sourceOutfitImage,
          garmentScopes: selection.garmentScopes.length > 0
            ? selection.garmentScopes
            : ['full-set'],
          extraPrompt,
          aspectRatio,
          resolution,
          engineId,
          blueprint,
        });

        const results = await driver.editImage(
          {
            images: [],
            prompt: '',
            numberOfImages: numImages,
            aspectRatio,
            resolution,
            interleavedParts: parts,
          },
          imageEditModel,
          { onStatusUpdate: () => {} },
        );

        updatePackItem(itemId, { status: 'completed', results, error: undefined });
        results.forEach((img) => addImage(img, Feature.ClothingTransfer, engineId));
      } catch (err) {
        updatePackItem(itemId, {
          status: 'error',
          results: [],
          error: getErrorMessage(err, t),
        });
      }
    },
    [
      sourceOutfitImage,
      selection.garmentScopes,
      extraPrompt,
      aspectRatio,
      resolution,
      engineId,
      numImages,
      imageEditModel,
      driver,
      addImage,
      updatePackItem,
      t,
    ],
  );

  const executePlan = useCallback(async (
    plan: EComPackPlannedTarget[],
    category?: EComPackCategory,
  ): Promise<void> => {
    if (!sourceOutfitImage) {
      setError(t('clothingTransfer.ecomPack.inputError'));
      return;
    }

    if (plan.length === 0) {
      setError(t('clothingTransfer.ecomPack.inputError'));
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const blueprint = (await resolveOutfitBlueprint()) ?? '';
      if (category) {
        const nextTargets = new Map(plannedTargets.current);
        packItems
          .filter((item) => item.category === category)
          .forEach((item) => nextTargets.delete(item.id));
        plan.forEach(({ item, target }) => nextTargets.set(item.id, target));
        plannedTargets.current = nextTargets;
        setPackItems((prev) => [
          ...prev.filter((item) => item.category !== category),
          ...plan.map(({ item }) => item),
        ]);
      } else {
        plannedTargets.current = new Map(plan.map(({ item, target }) => [item.id, target]));
        setPackItems(plan.map(({ item }) => item));
      }

      const batchConcurrency = resolveEngineConcurrency(engineId, ECOM_PACK_BATCH_MAX_CONCURRENCY);
      await runBoundedWorkers(
        plan,
        batchConcurrency,
        ({ item, target }) => generateTarget(item.id, target, blueprint),
      );
    } finally {
      setIsGenerating(false);
    }
  }, [sourceOutfitImage, setError, t, resolveOutfitBlueprint, generateTarget, packItems, engineId]);

  const handleGeneratePack = useCallback(async (): Promise<void> => {
    await executePlan(planEComPackTargets(selection));
  }, [selection, executePlan]);

  const handleGenerateCategory = useCallback(async (category: EComPackCategory): Promise<void> => {
    const plan = planEComPackTargets(selection).filter(({ item }) => item.category === category);
    await executePlan(plan, category);
  }, [selection, executePlan]);

  const handleRegeneratePackItem = useCallback(
    async (itemId: string): Promise<void> => {
      const target = plannedTargets.current.get(itemId);
      if (!target) return;

      const blueprint = (await resolveOutfitBlueprint()) ?? '';
      await generateTarget(itemId, target, blueprint);
    },
    [generateTarget, resolveOutfitBlueprint],
  );

  return {
    packItems,
    isGenerating,
    handleGeneratePack,
    handleGenerateCategory,
    handleRegeneratePackItem,
    commitPackResult,
  };
};
