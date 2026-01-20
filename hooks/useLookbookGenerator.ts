


import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import debounce from 'lodash-es/debounce';
import { Feature, ImageFile, AspectRatio, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { getErrorMessage } from '../utils/imageUtils';
import { editImage, upscaleImage, createImageChatSession, ImageChatSession, RefinementHistoryItem } from '../services/imageEditingService';
import { generateClothingDescription } from '../services/textService';

// This would contain the large prompt strings
import { LookbookStyle, GarmentType, FoldedPresentationType, MannequinBackgroundStyleKey } from '../components/LookbookGenerator.prompts';
import { buildLookbookPrompt, buildVariationPrompt, buildCloseUpPrompts, buildCloseUpNegativePrompt, LookbookFormState as PromptFormState } from '../utils/lookbookPromptBuilder';

export interface LookbookSet {
  main: ImageFile;
  variations: ImageFile[];
  closeups: ImageFile[];
}

export interface ClothingItem {
  id: number;
  image: ImageFile | null;
}

export interface LookbookFormState {
  clothingImages: ClothingItem[];
  fabricTextureImage: ImageFile | null;
  fabricTexturePrompt: string;
  clothingDescription: string;
  lookbookStyle: LookbookStyle;
  garmentType: GarmentType;
  foldedPresentationType: FoldedPresentationType;
  mannequinBackgroundStyle: MannequinBackgroundStyleKey;
  negativePrompt: string;
}

const DRAFT_STORAGE_KEY = 'lookbookGeneratorDraft';

const initialFormState: LookbookFormState = {
  clothingImages: [{ id: Date.now(), image: null }],
  fabricTextureImage: null,
  fabricTexturePrompt: '',
  clothingDescription: '',
  lookbookStyle: 'flat lay',
  garmentType: 'one-piece',
  foldedPresentationType: 'boxed',
  mannequinBackgroundStyle: 'minimalistShowroom',
  negativePrompt: '',
};


export const useLookbookGenerator = () => {
    // ... all state from the component
    const [formState, setFormState] = useState<LookbookFormState>(() => {
        // ... logic to load from localStorage
        if (typeof window === 'undefined') {
            return initialFormState;
        }
        try {
            const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
            return saved ? JSON.parse(saved) : initialFormState;
        } catch {
            return initialFormState;
        }
    });

    const [generatedLookbook, setGeneratedLookbook] = useState<LookbookSet | null>(null);
    const [upscalingStates, setUpscalingStates] = useState<Record<string, boolean>>({});

    // Refinement state for iterative image editing
    const [chatSession, setChatSession] = useState<ImageChatSession | null>(null);
    const [refinementHistory, setRefinementHistory] = useState<RefinementHistoryItem[]>([]);
    const [isRefining, setIsRefining] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
    const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
    const [isGeneratingCloseUp, setIsGeneratingCloseUp] = useState(false);
    
    const [error, setError] = useState<string | null>(null);
    const [variationCount, setVariationCount] = useState<number>(2);
    const [activeOutputTab, setActiveOutputTab] = useState<'main' | 'variations' | 'closeup'>('main');

    // Aspect ratio and resolution state
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
    const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);
    const [refinementVersions, setRefinementVersions] = useState<Array<{ image: ImageFile; prompt: string; timestamp: number }>>([]);
    const [selectedVersionIndex, setSelectedVersionIndex] = useState<number>(-1);

    // Ref for original image before refinements
    const originalImageRef = useRef<ImageFile | null>(null);

    const { t } = useLanguage();
    const { aivideoautoAccessToken, aivideoautoImageModels, localApiBaseUrl, localApiKey, textGenerateModel, getModelsForFeature } = useApi();
    const { imageEditModel } = getModelsForFeature(Feature.Lookbook);
    const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
        onStatusUpdate,
        aivideoautoAccessToken,
        aivideoautoImageModels,
        localApiBaseUrl,
        localApiKey,
    });

    // Debounced localStorage save - prevents 200ms typing lag
    const debouncedSave = useMemo(
        () => debounce((state: LookbookFormState) => {
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state));
                } catch (error) {
                    console.error('Failed to save draft to localStorage:', error);
                    // Silently fail - draft saving is non-critical
                }
            }
        }, 1000), // 1 second debounce - balance between UX and data safety
        []
    );

    useEffect(() => {
        debouncedSave(formState);

        // Cleanup: cancel pending debounced calls on unmount
        return () => {
            debouncedSave.cancel();
        };
    }, [formState, debouncedSave]);

    // Initialize chat session if lookbook exists but session doesn't
    useEffect(() => {
        if (generatedLookbook && !chatSession) {
            const session = createImageChatSession(imageEditModel);
            setChatSession(session);
        }
    }, [generatedLookbook, chatSession, imageEditModel]);

    const updateForm = useCallback((updates: Partial<LookbookFormState>) => {
        setFormState(prev => ({...prev, ...updates}));
    }, []);

    const handleClearForm = useCallback(() => {
        setFormState(initialFormState);
    }, []);

    const handleSelectVersion = useCallback((index: number) => {
        if (index === -1 && originalImageRef.current) {
            // Select original
            setGeneratedLookbook(prev => prev ? {
                ...prev,
                main: originalImageRef.current!,
                variations: [],
                closeups: []
            } : null);
        } else if (index >= 0 && index < refinementVersions.length) {
            // Select a refined version
            setGeneratedLookbook(prev => prev ? {
                ...prev,
                main: refinementVersions[index].image,
                variations: [],
                closeups: []
            } : null);
        }
        setSelectedVersionIndex(index);
    }, [refinementVersions]);

    const handleGenerateDescription = useCallback(async () => {
        const firstImage = formState.clothingImages.find(item => item.image)?.image;
        if (!firstImage) {
            setError(t('lookbook.descriptionError'));
            return;
        }
        setIsGeneratingDescription(true);
        setError(null);
        try {
            const description = await generateClothingDescription(firstImage, textGenerateModel, { localApiBaseUrl, localApiKey });
            updateForm({ clothingDescription: description });
        } catch (err) {
          setError(getErrorMessage(err, t));
        } finally {
            setIsGeneratingDescription(false);
        }
    }, [formState.clothingImages, t, updateForm, textGenerateModel, localApiBaseUrl, localApiKey]);

    const handleGenerate = useCallback(async () => {
        const { clothingImages, lookbookStyle, foldedPresentationType, garmentType, mannequinBackgroundStyle, fabricTextureImage, fabricTexturePrompt, clothingDescription, negativePrompt } = formState;
        const validClothingImages = clothingImages.filter(item => item.image !== null);
        if (validClothingImages.length === 0) {
          setError(t('lookbook.inputError'));
          return;
        }
        if (imageEditModel.startsWith('aivideoauto--') && !aivideoautoAccessToken) {
          setError(t('error.api.aivideoautoAuth'));
          return;
        }
    
        setIsLoading(true);
        setLoadingMessage(t('lookbook.generatingStatus'));
        setError(null);
        setGeneratedLookbook(null);
    
        const imagesForApi: ImageFile[] = validClothingImages.map(item => item.image as ImageFile);
    
        if (fabricTextureImage) {
            imagesForApi.push(fabricTextureImage);
        }
    
        const prompt = buildLookbookPrompt(
            formState as PromptFormState,
            imagesForApi,
            fabricTextureImage
        );
        
        try {
          const results = await editImage({
            images: imagesForApi,
            prompt,
            negativePrompt,
            numberOfImages: 1
          }, imageEditModel, buildImageServiceConfig(setLoadingMessage));
          if (results.length > 0) {
            const generatedImage = results[0];
            
            // Store original for version selection
            originalImageRef.current = generatedImage;
            setRefinementVersions([]);
            setSelectedVersionIndex(-1);
            
            setGeneratedLookbook({ main: generatedImage, variations: [], closeups: [] });
            setActiveOutputTab('main');

            // Create new chat session for image refinement
            const session = createImageChatSession(imageEditModel);
            setChatSession(session);
            setRefinementHistory([]);
          }
        } catch (err) {
          setError(getErrorMessage(err, t));
        } finally {
          setIsLoading(false);
          setLoadingMessage('');
        }
    }, [formState, imageEditModel, aivideoautoAccessToken, buildImageServiceConfig, t]);
    
    const handleUpscale = useCallback(async (imageToUpscale: ImageFile, imageKey: string) => {
        setUpscalingStates(prev => ({ ...prev, [imageKey]: true }));
        setError(null);
        try {
            const result = await upscaleImage(
                imageToUpscale,
                imageEditModel,
                buildImageServiceConfig(() => {})
            );
            
            setGeneratedLookbook(prev => {
                if (!prev) return null;
                const newState = { ...prev };
                if (prev.main.base64 === imageToUpscale.base64) {
                    newState.main = result;
                } else {
                    const variationIndex = prev.variations.findIndex(v => v.base64 === imageToUpscale.base64);
                    if (variationIndex > -1) newState.variations[variationIndex] = result;
    
                    const closeupIndex = prev.closeups.findIndex(c => c.base64 === imageToUpscale.base64);
                    if (closeupIndex > -1) newState.closeups[closeupIndex] = result;
                }
                return newState;
            });
        } catch (err) {
          setError(getErrorMessage(err, t));
        } finally {
            setUpscalingStates(prev => ({ ...prev, [imageKey]: false }));
        }
    }, [imageEditModel, buildImageServiceConfig, t]);
    
    const handleGenerateVariations = useCallback(async () => {
        if (!generatedLookbook) {
            setError(t('lookbook.variationError'));
            return;
        }
        setIsGeneratingVariations(true);
        setError(null);
    
        const baseImage = generatedLookbook.main;
        const prompt = buildVariationPrompt(formState.lookbookStyle, variationCount);
        
        try {
            const newVariations = await editImage({ 
                images: [baseImage], 
                prompt, 
                negativePrompt: formState.negativePrompt, 
                numberOfImages: variationCount 
            }, imageEditModel, buildImageServiceConfig(setLoadingMessage));
            setGeneratedLookbook(prev => prev ? { ...prev, variations: newVariations } : null);
        } catch (err) {
          setError(getErrorMessage(err, t));
        } finally {
            setIsGeneratingVariations(false);
            setLoadingMessage('');
        }
    }, [generatedLookbook, formState.negativePrompt, formState.lookbookStyle, variationCount, imageEditModel, buildImageServiceConfig, t]);

    const handleGenerateCloseUp = useCallback(async () => {
        if (!generatedLookbook) {
            setError(t('lookbook.closeUpError'));
            return;
        }
        setIsGeneratingCloseUp(true);
        setError(null);
        setGeneratedLookbook(prev => prev ? { ...prev, closeups: [] } : null);
    
        const baseImage = generatedLookbook.main;
        
        const closeUpPrompts = buildCloseUpPrompts();
        const combinedNegativePrompt = buildCloseUpNegativePrompt(formState.negativePrompt);
    
        try {
            const closeups: ImageFile[] = [];
            for (const closeUpPrompt of closeUpPrompts) {
                setLoadingMessage(t('lookbook.generatingCloseUp', { current: closeups.length + 1, total: closeUpPrompts.length }));
                const results = await editImage({
                    images: [baseImage],
                    prompt: closeUpPrompt,
                    negativePrompt: combinedNegativePrompt,
                    numberOfImages: 1
                }, imageEditModel, buildImageServiceConfig(() => {}));
                if (results.length > 0) {
                    closeups.push(results[0]);
                    setGeneratedLookbook(prev => prev ? { ...prev, closeups: [...closeups] } : null);
                }
            }
        } catch (err) {
          setError(getErrorMessage(err, t));
        } finally {
            setIsGeneratingCloseUp(false);
            setLoadingMessage('');
        }
    }, [generatedLookbook, formState.negativePrompt, imageEditModel, buildImageServiceConfig, t]);

    const handleRefineImage = useCallback(async (prompt: string) => {
        if (!chatSession || !generatedLookbook) {
            setError(t('lookbook.refineError'));
            return;
        }

        setIsRefining(true);
        setError(null);

        try {
            const refinedImage = await chatSession.sendRefinement(
                prompt,
                generatedLookbook.main
            );

            // Add to refinement versions history
            setRefinementVersions(prev => [...prev, {
                image: refinedImage,
                prompt,
                timestamp: Date.now()
            }]);
            setSelectedVersionIndex(prev => prev + 1);

            // Update lookbook with refined image
            setGeneratedLookbook(prev => prev ? {
                ...prev,
                main: refinedImage,
                // Clear variations/closeups as they're based on old image
                variations: [],
                closeups: []
            } : null);

            // Update history from session
            setRefinementHistory(chatSession.getHistory());

        } catch (err) {
            setError(getErrorMessage(err, t));
        } finally {
            setIsRefining(false);
        }
    }, [chatSession, generatedLookbook, t]);

    const handleResetRefinement = useCallback(() => {
        if (chatSession) {
            chatSession.reset();
            setChatSession(null);
            setRefinementHistory([]);
        }
    }, [chatSession]);

    return {
        formState,
        updateForm,
        handleClearForm,
        handleSelectVersion,
        generatedLookbook,
        isLoading,
        loadingMessage,
        isGeneratingDescription,
        isGeneratingVariations,
        isGeneratingCloseUp,
        error,
        setError,
        variationCount,
        setVariationCount,
        activeOutputTab,
        setActiveOutputTab,
        upscalingStates,
        handleGenerateDescription,
        handleGenerate,
        handleUpscale,
        handleGenerateVariations,
        handleGenerateCloseUp,
        // Refinement exports
        chatSession,
        refinementHistory,
        isRefining,
        handleRefineImage,
        handleResetRefinement,
        // Aspect ratio and resolution exports
        aspectRatio,
        setAspectRatio,
        resolution,
        setResolution,
        refinementVersions,
        setRefinementVersions,
        selectedVersionIndex,
        setSelectedVersionIndex,
        originalImageRef,
        imageEditModel,
    }
}
