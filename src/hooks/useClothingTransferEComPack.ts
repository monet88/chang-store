import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AspectRatio,
  EComPackItem,
  Feature,
  GarmentScope,
  ImageEngineId,
  ImageFile,
  ImageResolution,
} from '../types';
import { GeminiImageDriver } from './useClothingTransferEngine';
import {
  BrandModelProfile,
  BrandModelMetadata,
  DEFAULT_BRAND_MODEL_DEFINITIONS,
  loadDefaultBrandModels,
  loadCustomBrandModels,
  saveCustomBrandModel,
  deleteCustomBrandModel,
  isCustomBrandModel,
} from '../config/brandModelRoster';
import { DEFAULT_DISPLAY_TEMPLATES, DisplayTemplate } from '../config/displayTemplates';
import {
  buildBrandModelParts,
  buildClothingTransferParts,
  buildProductStagingParts,
  formatGarmentScope,
} from '../utils/clothing-transfer-prompt-builder';
import { promptFormatFor } from '../utils/promptFormat';
import { runBoundedWorkers } from '../utils/run-bounded-workers';
import { getErrorMessage } from '../utils/imageUtils';

export interface UseClothingTransferEComPackConfig {
  driver: GeminiImageDriver;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  numImages: number;
  imageEditModel: string;
  engineId?: ImageEngineId;
  extraPrompt: string;
  addImage: (image: ImageFile, feature?: Feature, engine?: ImageEngineId) => void;
  setError: (msg: string | null) => void;
  t: (key: string, options?: Record<string, string | number>) => string;
}

export interface UseClothingTransferEComPackReturn {
  sourceOutfitImage: ImageFile | null;
  setSourceOutfitImage: (image: ImageFile | null) => void;
  garmentScope: GarmentScope;
  setGarmentScope: (scope: GarmentScope) => void;
  brandModels: BrandModelProfile[];
  selectedBrandModelId: string | null;
  selectedBrandModelIds: string[];
  selectBrandModel: (id: string) => void;
  toggleBrandModel: (id: string) => void;
  handleAddCustomModel: (data: {
    name: string;
    faceImage: ImageFile;
    bodyImage?: ImageFile | null;
    metadata?: Partial<BrandModelMetadata>;
  }) => void;
  handleRemoveCustomModel: (id: string) => void;
  isCustomBrandModel: (id: string) => boolean;
  displayTemplates: DisplayTemplate[];
  selectedTemplateIds: string[];
  toggleDisplayTemplate: (id: string) => void;
  customStagingImages: ImageFile[];
  handleCustomStagingUpload: (files: ImageFile[]) => void;
  handleRemoveCustomStaging: (index: number) => void;
  customDestinations: ImageFile[];
  handleCustomDestinationsUpload: (files: ImageFile[]) => void;
  handleRemoveCustomDestination: (index: number) => void;
  packItems: EComPackItem[];
  isGenerating: boolean;
  handleGeneratePack: () => Promise<void>;
  handleRegeneratePackItem: (itemId: string) => Promise<void>;
}

export const useClothingTransferEComPack = (
  config: UseClothingTransferEComPackConfig,
): UseClothingTransferEComPackReturn => {
  const {
    driver,
    aspectRatio,
    resolution,
    numImages,
    imageEditModel,
    engineId,
    extraPrompt,
    addImage,
    setError,
    t,
  } = config;

  const [sourceOutfitImage, setSourceOutfitImage] = useState<ImageFile | null>(null);
  const [garmentScope, setGarmentScope] = useState<GarmentScope>('full-set');

  const [brandModels, setBrandModels] = useState<BrandModelProfile[]>(() => {
    const defaultProfiles: BrandModelProfile[] = DEFAULT_BRAND_MODEL_DEFINITIONS.map((def) => ({
      id: def.id,
      name: def.name,
      metadata: { ...def.metadata },
      faceImage: null,
      bodyImage: null,
    }));
    const savedCustom = loadCustomBrandModels();
    return [...defaultProfiles, ...savedCustom];
  });

  const [selectedBrandModelId, setSelectedBrandModelId] = useState<string | null>(null);
  const selectedBrandModelIds = useMemo(
    () => (selectedBrandModelId ? [selectedBrandModelId] : []),
    [selectedBrandModelId],
  );
  const [customStagingImages, setCustomStagingImages] = useState<ImageFile[]>([]);

  const displayTemplates = useMemo<DisplayTemplate[]>(() => {
    const customTemplates: DisplayTemplate[] = customStagingImages.map((img, idx) => ({
      id: `custom-staging-${idx}`,
      name: `${t('clothingTransfer.ecomPack.customStagingPrefix')} #${idx + 1}`,
      category: 'flat-lay',
      modality: 'image',
      prompt: 'A professional e-commerce staging photo reproducing the exact staging surface, hanger, or backdrop shown in the STAGING REFERENCE image.',
      image: img,
    }));
    return [...DEFAULT_DISPLAY_TEMPLATES, ...customTemplates];
  }, [customStagingImages, t]);

  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [customDestinations, setCustomDestinations] = useState<ImageFile[]>([]);
  const [packItems, setPackItems] = useState<EComPackItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load starter assets for Linh and Mai on mount, preserving custom models
  useEffect(() => {
    let mounted = true;
    loadDefaultBrandModels()
      .then((loaded) => {
        if (mounted && loaded.length > 0) {
          setBrandModels((prev) => {
            const custom = prev.filter((m) => isCustomBrandModel(m.id));
            return [...loaded, ...custom];
          });
        }
      })
      .catch(() => {
        // Fallback silently kept
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleAddCustomModel = useCallback(
    (data: {
      name: string;
      faceImage: ImageFile;
      bodyImage?: ImageFile | null;
      metadata?: Partial<BrandModelMetadata>;
    }) => {
      const newId = `custom-model-${Date.now()}`;
      const newProfile: BrandModelProfile = {
        id: newId,
        name: data.name.trim() || 'Custom Model',
        faceImage: data.faceImage,
        bodyImage: data.bodyImage || null,
        metadata: {
          age: data.metadata?.age ?? 22,
          height: data.metadata?.height ?? '1m65',
          weight: data.metadata?.weight ?? '48kg',
          bodyType: data.metadata?.bodyType ?? 'slender balanced build',
          skinTone: data.metadata?.skinTone ?? 'natural skin tone',
          facialFeatures: data.metadata?.facialFeatures ?? 'natural facial features',
          styleVibe: data.metadata?.styleVibe ?? 'modern commercial fashion',
        },
      };

      saveCustomBrandModel(newProfile);
      setBrandModels((prev) => [...prev, newProfile]);
      setSelectedBrandModelId(newId);
    },
    [],
  );

  const handleRemoveCustomModel = useCallback((id: string) => {
    deleteCustomBrandModel(id);
    setBrandModels((prev) => prev.filter((m) => m.id !== id));
    setSelectedBrandModelId((prev) => (prev === id ? null : prev));
  }, []);

  const handleCustomStagingUpload = useCallback((files: ImageFile[]) => {
    setCustomStagingImages((prev) => {
      const startIdx = prev.length;
      const next = [...prev, ...files].slice(0, 4);
      const newIds: string[] = [];
      for (let i = startIdx; i < next.length; i++) {
        newIds.push(`custom-staging-${i}`);
      }
      if (newIds.length > 0) {
        // Auto-uncheck all presets and exclusively select the newly uploaded staging photos
        setSelectedTemplateIds(newIds);
      }
      return next;
    });
  }, []);

  const handleRemoveCustomStaging = useCallback((index: number) => {
    const targetId = `custom-staging-${index}`;
    setCustomStagingImages((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      setSelectedTemplateIds((sel) => sel.filter((id) => id !== targetId));
      return filtered;
    });
  }, []);

  const selectBrandModel = useCallback((id: string) => {
    setSelectedBrandModelId((prev) => (prev === id ? null : id));
  }, []);

  const toggleBrandModel = selectBrandModel;

  const toggleDisplayTemplate = useCallback((id: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const handleCustomDestinationsUpload = useCallback((files: ImageFile[]) => {
    setCustomDestinations((prev) => [...prev, ...files].slice(0, 4));
  }, []);

  const handleRemoveCustomDestination = useCallback((index: number) => {
    setCustomDestinations((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updatePackItem = useCallback((id: string, patch: Partial<EComPackItem>) => {
    setPackItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const runItemGeneration = useCallback(
    async (item: EComPackItem) => {
      if (!sourceOutfitImage) return;
      updatePackItem(item.id, { status: 'processing', results: [], error: undefined });

      try {
        let parts;
        const format = promptFormatFor(engineId);

        if (item.category === 'product') {
          const templateId = item.id.replace('template-', '');
          const template = displayTemplates.find((t) => t.id === templateId);
          if (!template) throw new Error('Template not found');
          parts = buildProductStagingParts(sourceOutfitImage, template, garmentScope, extraPrompt, format);
        } else if (item.category === 'brand-models') {
          const modelId = item.id.replace('brand-', '');
          const model = brandModels.find((m) => m.id === modelId);
          if (!model) throw new Error('Model profile not found');
          parts = buildBrandModelParts(sourceOutfitImage, model, garmentScope, extraPrompt, format);
        } else {
          // custom destinations
          const destIndex = parseInt(item.id.replace('custom-', ''), 10);
          const destImage = customDestinations[destIndex];
          if (!destImage) throw new Error('Destination image not found');
          parts = buildClothingTransferParts(
            destImage,
            [{ image: sourceOutfitImage, label: formatGarmentScope(garmentScope) }],
            extraPrompt,
            format,
          );
        }

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

        updatePackItem(item.id, { status: 'completed', results, error: undefined });
        results.forEach((img) => addImage(img, Feature.ClothingTransfer, engineId));
      } catch (err) {
        updatePackItem(item.id, {
          status: 'error',
          results: [],
          error: getErrorMessage(err, t),
        });
      }
    },
    [
      sourceOutfitImage,
      displayTemplates,
      brandModels,
      customDestinations,
      garmentScope,
      extraPrompt,
      engineId,
      driver,
      numImages,
      aspectRatio,
      resolution,
      imageEditModel,
      addImage,
      updatePackItem,
      t,
    ],
  );

  const handleGeneratePack = useCallback(async () => {
    if (!sourceOutfitImage) {
      setError(t('clothingTransfer.ecomPack.inputError'));
      return;
    }

    const selectedTemplates = displayTemplates.filter((t) =>
      selectedTemplateIds.includes(t.id),
    );
    const selectedModels = brandModels.filter((m) =>
      selectedBrandModelIds.includes(m.id),
    );

    if (
      selectedTemplates.length === 0 &&
      selectedModels.length === 0 &&
      customDestinations.length === 0
    ) {
      setError(t('clothingTransfer.ecomPack.inputError'));
      return;
    }

    setError(null);
    setIsGenerating(true);

    const initialItems: EComPackItem[] = [
      ...selectedTemplates.map((tpl) => ({
        id: `template-${tpl.id}`,
        category: 'product' as const,
        title: tpl.name,
        subtitle: tpl.category === 'hanger' ? 'Hanger' : 'Flat Lay',
        status: 'pending' as const,
        results: [],
      })),
      ...selectedModels.map((m) => ({
        id: `brand-${m.id}`,
        category: 'brand-models' as const,
        title: m.name,
        subtitle: m.metadata.styleVibe,
        status: 'pending' as const,
        results: [],
      })),
      ...customDestinations.map((_, idx) => ({
        id: `custom-${idx}`,
        category: 'custom-destinations' as const,
        title: `Concept #${idx + 1}`,
        subtitle: 'Custom Scene',
        status: 'pending' as const,
        results: [],
      })),
    ];

    setPackItems(initialItems);

    try {
      await runBoundedWorkers(initialItems, 3, async (item) => {
        await runItemGeneration(item);
      });
    } finally {
      setIsGenerating(false);
    }
  }, [
    sourceOutfitImage,
    displayTemplates,
    selectedTemplateIds,
    brandModels,
    selectedBrandModelIds,
    customDestinations,
    setError,
    t,
    runItemGeneration,
  ]);

  const handleRegeneratePackItem = useCallback(
    async (itemId: string) => {
      const targetItem = packItems.find((it) => it.id === itemId);
      if (!targetItem) return;
      await runItemGeneration(targetItem);
    },
    [packItems, runItemGeneration],
  );

  return {
    sourceOutfitImage,
    setSourceOutfitImage,
    garmentScope,
    setGarmentScope,
    brandModels,
    selectedBrandModelId,
    selectedBrandModelIds,
    selectBrandModel,
    toggleBrandModel,
    handleAddCustomModel,
    handleRemoveCustomModel,
    isCustomBrandModel,
    displayTemplates,
    selectedTemplateIds,
    toggleDisplayTemplate,
    customStagingImages,
    handleCustomStagingUpload,
    handleRemoveCustomStaging,
    customDestinations,
    handleCustomDestinationsUpload,
    handleRemoveCustomDestination,
    packItems,
    isGenerating,
    handleGeneratePack,
    handleRegeneratePackItem,
  };
};
