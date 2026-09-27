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
  loadSavedBrandModelProfiles,
  saveBrandModelProfile,
  saveCustomBrandModel,
  deleteCustomBrandModel,
  isCustomBrandModel,
} from '../config/brandModelRoster';
import {
  DEFAULT_DISPLAY_TEMPLATES,
  DisplayTemplate,
  DisplayTemplateCategory,
  deleteCustomDisplayTemplate,
  loadCustomDisplayTemplates,
  saveCustomDisplayTemplate,
} from '../config/displayTemplates';
import {
  EComPackPlanInput,
  useClothingTransferEComPackRun,
} from './useClothingTransferEComPackRun';
import { scanGarmentBlueprint } from '../services/textService';

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
  /** Test seam for the AI Scan service; production always uses `scanGarmentBlueprint`. */
  scanBlueprintFn?: (image: ImageFile, model?: string, guidance?: string) => Promise<string>;
}

interface OutfitSourceState {
  image: ImageFile | null;
  note: string;
}

export interface UseClothingTransferEComPackReturn {
  sourceOutfitImage: ImageFile | null;
  setSourceOutfitImage: (image: ImageFile | null) => void;
  sourceOutfitNote: string;
  setSourceOutfitNote: (note: string) => void;
  selectedGarmentScopes: GarmentScope[];
  toggleGarmentScope: (scope: GarmentScope) => void;
  brandModels: BrandModelProfile[];
  selectedBrandModelIds: string[];
  selectBrandModel: (id: string) => void;
  toggleBrandModel: (id: string) => void;
  handleAddCustomModel: (data: {
    name: string;
    faceImage: ImageFile;
    bodyImage: ImageFile;
    metadata?: Partial<BrandModelMetadata>;
  }) => void;
  handleUpdateBrandModel: (
    id: string,
    patch: {
      name?: string;
      faceImage?: ImageFile | null;
      bodyImage?: ImageFile | null;
      metadata?: Partial<BrandModelMetadata>;
    },
  ) => void;
  handleRemoveCustomModel: (id: string) => void;
  isCustomBrandModel: (id: string) => boolean;
  displayTemplates: DisplayTemplate[];
  selectedTemplateIds: string[];
  toggleDisplayTemplate: (id: string) => void;
  handleAddTextTemplate: (data: {
    name: string;
    category: DisplayTemplateCategory;
    prompt: string;
  }) => void;
  handleRemoveDisplayTemplate: (id: string) => void;
  customStagingImages: ImageFile[];
  handleCustomStagingUpload: (files: ImageFile[], category?: DisplayTemplateCategory) => void;
  handleRemoveCustomStaging: (index: number) => void;
  customDestinations: ImageFile[];
  handleCustomDestinationsUpload: (files: ImageFile[]) => void;
  handleRemoveCustomDestination: (index: number) => void;
  packItems: EComPackItem[];
  outfitBlueprint: string | null;
  isScanningBlueprint: boolean;
  /** Operator edit of the blueprint text; marks it hand-owned so a later note change keeps it. */
  editOutfitBlueprint: (blueprint: string) => void;
  handleScanBlueprint: () => Promise<void>;
  isGenerating: boolean;
  handleGeneratePack: () => Promise<void>;
  handleGenerateCategory: (category: 'product' | 'brand-models' | 'custom-destinations') => Promise<void>;
  handleRegeneratePackItem: (itemId: string) => Promise<void>;
  commitPackResult: (itemId: string, index: number, image: ImageFile) => void;
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
    scanBlueprintFn,
  } = config;

  const [outfitSource, setOutfitSource] = useState<OutfitSourceState>({ image: null, note: '' });
  const outfitSourceRef = useRef<OutfitSourceState>(outfitSource);
  outfitSourceRef.current = outfitSource;

  const sourceOutfitImage = outfitSource.image;
  const sourceOutfitNote = outfitSource.note;

  const [selectedGarmentScopes, setSelectedGarmentScopes] = useState<GarmentScope[]>(['full-set']);
  const toggleGarmentScope = useCallback((scope: GarmentScope) => {
    setSelectedGarmentScopes((prev) => {
      if (scope !== 'top' && scope !== 'bottom') return [scope];
      const compatible = prev.filter((item) => item === 'top' || item === 'bottom');
      const next = compatible.includes(scope)
        ? compatible.filter((item) => item !== scope)
        : [...compatible, scope];
      return next.length > 0 ? next : ['full-set'];
    });
  }, []);
  const [outfitBlueprint, setOutfitBlueprint] = useState<string | null>(null);
  // A blueprint the operator typed is their work, not a cache entry: a later
  // note change drops an untouched scan but must never discard it.
  const [isBlueprintEdited, setIsBlueprintEdited] = useState(false);
  const [isScanningBlueprint, setIsScanningBlueprint] = useState(false);

  const scanBlueprint = useCallback(
    async (image: ImageFile, guidance?: string): Promise<string | null> => {
      setIsScanningBlueprint(true);
      try {
        const fn = scanBlueprintFn || scanGarmentBlueprint;
        const sentNote = (guidance !== undefined ? guidance : outfitSourceRef.current.note)?.trim() || undefined;
        const blueprint = await fn(image, textGenerateModel, sentNote);
        // Publish only while this analysis still belongs to the active outfit:
        // swapping the photo, or retyping the note that steers the analysis,
        // must never label the current state with the previous answer.
        const currentNote = outfitSourceRef.current.note?.trim() || undefined;
        if (outfitSourceRef.current.image === image && currentNote === sentNote) {
          setOutfitBlueprint(blueprint);
          setIsBlueprintEdited(false);
        }
        return blueprint;
      } catch (err) {
        console.warn('AI Scan blueprint skipped/failed:', err);
        return null;
      } finally {
        if (outfitSourceRef.current.image === image) {
          setIsScanningBlueprint(false);
        }
      }
    },
    [scanBlueprintFn, textGenerateModel],
  );

  const handleSetSourceOutfitImage = useCallback(
    (img: ImageFile | null) => {
      setOutfitSource((prev) => {
        const next = { ...prev, image: img };
        outfitSourceRef.current = next;
        return next;
      });
      setOutfitBlueprint(null);
      setIsBlueprintEdited(false);
      // A scan in flight for the previous photo will never publish (see
      // scanBlueprint) and so never clears the flag either: without this the
      // spinner sticks forever and the rescan button stays hidden.
      setIsScanningBlueprint(false);
    },
    [],
  );

  const handleSetSourceOutfitNote = useCallback(
    (note: string) => {
      setOutfitSource((prev) => {
        const next = { ...prev, note };
        outfitSourceRef.current = next;
        return next;
      });
      // The published blueprint was analysed under the previous note, and the
      // note outranks every visual cue (CONTEXT.md, AI Scan), so an untouched
      // scan goes until the operator rescans. A hand-edited one stays: the note
      // itself still rides into the generation prompt.
      if (!isBlueprintEdited) {
        setOutfitBlueprint(null);
      }
    },
    [isBlueprintEdited],
  );

  const handleEditOutfitBlueprint = useCallback((blueprint: string) => {
    setOutfitBlueprint(blueprint);
    setIsBlueprintEdited(true);
  }, []);

  const handleScanBlueprint = useCallback(async () => {
    if (outfitSourceRef.current.image) {
      await scanBlueprint(outfitSourceRef.current.image, outfitSourceRef.current.note);
    }
  }, [scanBlueprint]);

  const [brandModels, setBrandModels] = useState<BrandModelProfile[]>(() => {
    const saved = loadSavedBrandModelProfiles();
    const defaultProfiles: BrandModelProfile[] = DEFAULT_BRAND_MODEL_DEFINITIONS.map((def) => {
      const override = saved.find((profile) => profile.id === def.id);
      return {
        id: def.id,
        name: override?.name ?? def.name,
        metadata: { ...def.metadata, ...(override?.metadata ?? {}) },
        faceImage: override?.faceImage ?? null,
        bodyImage: override?.bodyImage ?? null,
      };
    });
    const savedCustom = saved.filter((profile) => isCustomBrandModel(profile.id));
    return [...defaultProfiles, ...savedCustom];
  });

  const [selectedBrandModelIds, setSelectedBrandModelIds] = useState<string[]>([]);
  const [customDisplayTemplates, setCustomDisplayTemplates] = useState<DisplayTemplate[]>(() => loadCustomDisplayTemplates());
  const displayTemplates = useMemo<DisplayTemplate[]>(
    () => [...DEFAULT_DISPLAY_TEMPLATES, ...customDisplayTemplates],
    [customDisplayTemplates],
  );
  const customStagingImages = useMemo(
    () => customDisplayTemplates
      .filter((template) => template.modality === 'image' && template.image)
      .map((template) => template.image as ImageFile),
    [customDisplayTemplates],
  );

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
      bodyImage: ImageFile;
      metadata?: Partial<BrandModelMetadata>;
    }) => {
      const newId = `custom-model-${Date.now()}`;
      const newProfile: BrandModelProfile = {
        id: newId,
        name: data.name.trim() || 'Custom Model',
        faceImage: data.faceImage,
        bodyImage: data.bodyImage,
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
      setSelectedBrandModelIds((prev) => [...prev, newId]);
    },
    [],
  );

  const handleRemoveCustomModel = useCallback((id: string) => {
    deleteCustomBrandModel(id);
    setBrandModels((prev) => prev.filter((m) => m.id !== id));
    setSelectedBrandModelIds((prev) => prev.filter((item) => item !== id));
  }, []);

  const handleUpdateBrandModel = useCallback((
    id: string,
    patch: {
      name?: string;
      faceImage?: ImageFile | null;
      bodyImage?: ImageFile | null;
      metadata?: Partial<BrandModelMetadata>;
    },
  ) => {
    setBrandModels((prev) => prev.map((model) => {
      if (model.id !== id) return model;
      const updated: BrandModelProfile = {
        ...model,
        ...patch,
        metadata: { ...model.metadata, ...(patch.metadata ?? {}) },
      };
      saveBrandModelProfile(updated);
      return updated;
    }));
  }, []);

  const handleCustomStagingUpload = useCallback((files: ImageFile[], category: DisplayTemplateCategory = 'flat-lay') => {
    setCustomDisplayTemplates((prev) => {
      const previousImages = prev.filter(
        (template) => template.modality === 'image' && template.category === category,
      );
      const preservedTemplates = prev.filter(
        (template) => !(template.modality === 'image' && template.category === category),
      );
      const nextImages = files.slice(0, 4).map((img, idx): DisplayTemplate => ({
        id: `custom-staging-${category}-${idx}`,
        name: `${t('clothingTransfer.ecomPack.customStagingPrefix')} #${idx + 1}`,
        category,
        modality: 'image',
        prompt: 'A professional e-commerce staging photo reproducing the exact staging surface, hanger, or backdrop shown in the STAGING REFERENCE image.',
        image: img,
      }));
      previousImages.forEach((template) => deleteCustomDisplayTemplate(template.id));
      nextImages.forEach(saveCustomDisplayTemplate);
      setSelectedTemplateIds((selected) => {
        const previousImageIds = new Set(previousImages.map((template) => template.id));
        return [
          ...selected.filter((id) => !previousImageIds.has(id)),
          ...nextImages.map((template) => template.id),
        ];
      });
      return [...preservedTemplates, ...nextImages];
    });
  }, [t]);

  const handleRemoveCustomStaging = useCallback((index: number) => {
    setCustomDisplayTemplates((prev) => {
      const imageTemplates = prev.filter((template) => template.modality === 'image');
      const target = imageTemplates[index];
      if (!target) return prev;
      deleteCustomDisplayTemplate(target.id);
      setSelectedTemplateIds((selected) => selected.filter((id) => id !== target.id));
      return prev.filter((template) => template.id !== target.id);
    });
  }, []);

  const selectBrandModel = useCallback((id: string) => {
    setSelectedBrandModelIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const toggleBrandModel = selectBrandModel;

  const toggleDisplayTemplate = useCallback((id: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const handleAddTextTemplate = useCallback((data: {
    name: string;
    category: DisplayTemplateCategory;
    prompt: string;
  }) => {
    const template: DisplayTemplate = {
      id: `custom-text-${Date.now()}`,
      name: data.name.trim(),
      category: data.category,
      modality: 'text',
      prompt: data.prompt.trim(),
    };
    saveCustomDisplayTemplate(template);
    setCustomDisplayTemplates((prev) => [...prev, template]);
    setSelectedTemplateIds((prev) => [...prev, template.id]);
  }, []);

  const handleRemoveDisplayTemplate = useCallback((id: string) => {
    if (DEFAULT_DISPLAY_TEMPLATES.some((template) => template.id === id)) return;
    deleteCustomDisplayTemplate(id);
    setCustomDisplayTemplates((prev) => prev.filter((template) => template.id !== id));
    setSelectedTemplateIds((prev) => prev.filter((item) => item !== id));
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
      garmentScopes: selectedGarmentScopes,
    }),
    [
      displayTemplates,
      selectedTemplateIds,
      brandModels,
      selectedBrandModelIds,
      customDestinations,
      selectedGarmentScopes,
    ],
  );

  const resolveOutfitBlueprint = useCallback(async (): Promise<string | null> => {
    if (outfitBlueprint) return outfitBlueprint;
    return outfitSourceRef.current.image
      ? scanBlueprint(outfitSourceRef.current.image, outfitSourceRef.current.note)
      : null;
  }, [outfitBlueprint, scanBlueprint]);

  const {
    packItems,
    isGenerating,
    handleGeneratePack,
    handleGenerateCategory,
    handleRegeneratePackItem,
    commitPackResult,
  } = useClothingTransferEComPackRun({
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
  });

  return {
    sourceOutfitImage,
    setSourceOutfitImage: handleSetSourceOutfitImage,
    sourceOutfitNote,
    setSourceOutfitNote: handleSetSourceOutfitNote,
    outfitBlueprint,
    isScanningBlueprint,
    editOutfitBlueprint: handleEditOutfitBlueprint,
    handleScanBlueprint,
    selectedGarmentScopes,
    toggleGarmentScope,
    brandModels,
    selectedBrandModelIds,
    selectBrandModel,
    toggleBrandModel,
    handleAddCustomModel,
    handleUpdateBrandModel,
    handleRemoveCustomModel,
    isCustomBrandModel,
    displayTemplates,
    selectedTemplateIds,
    toggleDisplayTemplate,
    handleAddTextTemplate,
    handleRemoveDisplayTemplate,
    customStagingImages,
    handleCustomStagingUpload,
    handleRemoveCustomStaging,
    customDestinations,
    handleCustomDestinationsUpload,
    handleRemoveCustomDestination,
    packItems,
    isGenerating,
    handleGeneratePack,
    handleGenerateCategory,
    handleRegeneratePackItem,
    commitPackResult,
  };
};
