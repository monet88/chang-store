import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AspectRatio,
  EComPackItem,
  Feature,
  GarmentScope,
  ImageEngineId,
  ImageFile,
  ImageResolution,
} from '../types';
import { ClothingTransferImageDriver } from './useClothingTransferEngine';
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
import { DisplayTemplate } from '../config/displayTemplates';
import {
  EComPackPlanInput,
  useClothingTransferEComPackRun,
} from './useClothingTransferEComPackRun';
import { analyzeOutfitBlueprint } from '../services/textService';

export interface UseClothingTransferEComPackConfig {
  driver: ClothingTransferImageDriver;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  numImages: number;
  imageEditModel: string;
  textGenerateModel?: string;
  engineId?: ImageEngineId;
  extraPrompt: string;
  addImage: (image: ImageFile, feature?: Feature, engine?: ImageEngineId) => void;
  setError: (msg: string | null) => void;
  t: (key: string, options?: Record<string, string | number>) => string;
  analyzeOutfitBlueprintFn?: (image: ImageFile, model?: string) => Promise<string>;
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
  outfitBlueprint: string | null;
  isAnalyzingOutfit: boolean;
  setOutfitBlueprint: (blueprint: string | null) => void;
  handleReanalyzeOutfit: () => Promise<void>;
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
    textGenerateModel = 'gemini-3.8-flash',
    engineId,
    extraPrompt,
    addImage,
    setError,
    t,
    analyzeOutfitBlueprintFn,
  } = config;

  const [sourceOutfitImage, setSourceOutfitImage] = useState<ImageFile | null>(null);
  const sourceOutfitImageRef = useRef<ImageFile | null>(null);
  const [garmentScope, setGarmentScope] = useState<GarmentScope>('full-set');
  const [outfitBlueprint, setOutfitBlueprint] = useState<string | null>(null);
  const [isAnalyzingOutfit, setIsAnalyzingOutfit] = useState(false);

  const analyzeBlueprint = useCallback(
    async (image: ImageFile): Promise<string | null> => {
      setIsAnalyzingOutfit(true);
      try {
        const fn = analyzeOutfitBlueprintFn || analyzeOutfitBlueprint;
        const blueprint = await fn(image, textGenerateModel);
        // Only publish when this analysis still belongs to the active outfit:
        // swapping the photo while an earlier analysis is in flight must never
        // label the new outfit with the old blueprint.
        if (sourceOutfitImageRef.current === image) {
          setOutfitBlueprint(blueprint);
        }
        return blueprint;
      } catch (err) {
        console.warn('Outfit blueprint analysis skipped/failed:', err);
        return null;
      } finally {
        if (sourceOutfitImageRef.current === image) {
          setIsAnalyzingOutfit(false);
        }
      }
    },
    [analyzeOutfitBlueprintFn, textGenerateModel],
  );

  const handleSetSourceOutfitImage = useCallback(
    (img: ImageFile | null) => {
      sourceOutfitImageRef.current = img;
      setSourceOutfitImage(img);
      setOutfitBlueprint(null);
      if (img) {
        analyzeBlueprint(img).catch(() => {});
      }
    },
    [analyzeBlueprint],
  );

  const handleReanalyzeOutfit = useCallback(async () => {
    if (sourceOutfitImage) {
      await analyzeBlueprint(sourceOutfitImage);
    }
  }, [sourceOutfitImage, analyzeBlueprint]);

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
    return customTemplates;
  }, [customStagingImages, t]);

  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [customDestinations, setCustomDestinations] = useState<ImageFile[]>([]);

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
      const isAppend = prev.length > 0 && files.length > 0 && !files.includes(prev[0]);
      const next = isAppend ? [...prev, ...files].slice(0, 4) : files.slice(0, 4);
      setSelectedTemplateIds(next.map((_, i) => `custom-staging-${i}`));
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

  const selection = useMemo<EComPackPlanInput>(
    () => ({
      displayTemplates,
      selectedTemplateIds,
      brandModels,
      selectedBrandModelIds,
      customDestinations,
    }),
    [
      displayTemplates,
      selectedTemplateIds,
      brandModels,
      selectedBrandModelIds,
      customDestinations,
    ],
  );

  const resolveOutfitBlueprint = useCallback(async (): Promise<string | null> => {
    if (outfitBlueprint) return outfitBlueprint;
    return sourceOutfitImage ? analyzeBlueprint(sourceOutfitImage) : null;
  }, [outfitBlueprint, sourceOutfitImage, analyzeBlueprint]);

  const {
    packItems,
    isGenerating,
    handleGeneratePack,
    handleRegeneratePackItem,
  } = useClothingTransferEComPackRun({
    driver,
    sourceOutfitImage,
    garmentScope,
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
  });

  return {
    sourceOutfitImage,
    setSourceOutfitImage: handleSetSourceOutfitImage,
    outfitBlueprint,
    isAnalyzingOutfit,
    setOutfitBlueprint,
    handleReanalyzeOutfit,
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
