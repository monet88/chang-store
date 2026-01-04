/**
 * LookbookGenerator - Main orchestrator component
 *
 * Refactored to delegate UI to LookbookForm and LookbookOutput,
 * manages state via custom hook (will be created in Phase 02b).
 * This is a thin orchestrator that composes child components.
 */

import React, { useState, useCallback } from 'react';
import { editImage, upscaleImage } from '../services/imageEditingService';
import { generateClothingDescription } from '../services/gemini/text';
import { Feature, ImageFile, AspectRatio, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { getErrorMessage } from '../utils/imageUtils';
import { MannequinBackgroundStyleKey } from './LookbookGenerator.prompts';
import { LookbookForm, LookbookFormState, ClothingItem } from './LookbookForm';
import { LookbookOutput, LookbookSet } from './LookbookOutput';
import {
  buildLookbookPrompt,
  buildVariationPrompt,
  buildCloseUpPrompts,
  buildCloseUpNegativePrompt
} from '../utils/lookbookPromptBuilder';

// Initial form state
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

/**
 * LookbookGenerator orchestrator component
 */
export const LookbookGenerator: React.FC = () => {
  // State management
  const [formState, setFormState] = useState<LookbookFormState>(initialFormState);
  const [generatedLookbook, setGeneratedLookbook] = useState<LookbookSet | null>(null);
  const [upscalingStates, setUpscalingStates] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [isGeneratingCloseUp, setIsGeneratingCloseUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variationCount, setVariationCount] = useState<number>(2);
  const [activeOutputTab, setActiveOutputTab] = useState<'main' | 'variations' | 'closeup'>('main');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);

  // Hooks
  const { t } = useLanguage();
  const { aivideoautoAccessToken, aivideoautoImageModels, getModelsForFeature } = useApi();
  const { imageEditModel } = getModelsForFeature(Feature.Lookbook);

  // Helper functions - memoized to prevent recreation on every render
  const isAivideoautoModel = imageEditModel.startsWith('aivideoauto--');

  const requireAivideoautoConfig = useCallback(() => {
    if (isAivideoautoModel && !aivideoautoAccessToken) {
      setError(t('error.api.aivideoautoAuth'));
      return false;
    }
    return true;
  }, [isAivideoautoModel, aivideoautoAccessToken, t]);

  const buildImageServiceConfig = useCallback((onStatusUpdate: (message: string) => void) => ({
    onStatusUpdate,
    aivideoautoAccessToken,
    aivideoautoImageModels,
  }), [aivideoautoAccessToken, aivideoautoImageModels]);

  // Mannequin background styles
  const MANNEQUIN_BACKGROUND_STYLES: { key: MannequinBackgroundStyleKey; label: string }[] = (
    Object.keys(t('lookbook.mannequinBackgroundStyles', { returnObjects: true })) as MannequinBackgroundStyleKey[]
  ).map(key => ({
    key,
    label: t(`lookbook.mannequinBackgroundStyles.${key}`),
  }));

  // Form handlers - wrapped in useCallback for memoization
  const updateForm = useCallback((updates: Partial<LookbookFormState>) => {
    setFormState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleClearForm = useCallback(() => {
    setFormState(initialFormState);
  }, []);

  const handleGenerateDescription = useCallback(async () => {
    const firstImage = formState.clothingImages.find(item => item.image)?.image;
    if (!firstImage) {
      setError(t('lookbook.descriptionError'));
      return;
    }
    setIsGeneratingDescription(true);
    setError(null);
    try {
      const description = await generateClothingDescription(firstImage);
      updateForm({ clothingDescription: description });
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsGeneratingDescription(false);
    }
  }, [formState.clothingImages, t, updateForm]);

  const handleGenerate = useCallback(async () => {
    const validClothingImages = formState.clothingImages.filter(item => item.image !== null);
    if (validClothingImages.length === 0) {
      setError(t('lookbook.inputError'));
      return;
    }
    if (!requireAivideoautoConfig()) {
      return;
    }

    setIsLoading(true);
    setLoadingMessage(t('lookbook.generatingStatus'));
    setError(null);
    setGeneratedLookbook(null);

    const imagesForApi: ImageFile[] = validClothingImages.map(item => item.image as ImageFile);
    if (formState.fabricTextureImage) {
      imagesForApi.push(formState.fabricTextureImage);
    }

    // Build prompt using prompt builder
    const prompt = buildLookbookPrompt(formState, imagesForApi, formState.fabricTextureImage);

    try {
      const results = await editImage({
        images: imagesForApi,
        prompt,
        negativePrompt: formState.negativePrompt,
        numberOfImages: 1,
        aspectRatio,
        resolution,
      }, imageEditModel, buildImageServiceConfig(setLoadingMessage));

      if (results.length > 0) {
        setGeneratedLookbook({ main: results[0], variations: [], closeups: [] });
        setActiveOutputTab('main');
      }
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [formState, aspectRatio, resolution, imageEditModel, requireAivideoautoConfig, buildImageServiceConfig, t]);

  const handleUpscale = useCallback(async (imageToUpscale: ImageFile, imageKey: string) => {
    setUpscalingStates(prev => ({ ...prev, [imageKey]: true }));
    setError(null);
    try {
      const result = await upscaleImage(
        imageToUpscale,
        imageEditModel,
        buildImageServiceConfig(() => { })
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
    if (!requireAivideoautoConfig()) {
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
        numberOfImages: variationCount,
        aspectRatio,
        resolution,
      }, imageEditModel, buildImageServiceConfig(setLoadingMessage));

      setGeneratedLookbook(prev => prev ? { ...prev, variations: newVariations } : null);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsGeneratingVariations(false);
      setLoadingMessage('');
    }
  }, [generatedLookbook, formState.lookbookStyle, formState.negativePrompt, variationCount, aspectRatio, resolution, imageEditModel, requireAivideoautoConfig, buildImageServiceConfig, t]);

  const handleGenerateCloseUp = useCallback(async () => {
    if (!generatedLookbook) {
      setError(t('lookbook.closeUpError'));
      return;
    }
    if (!requireAivideoautoConfig()) {
      return;
    }

    setIsGeneratingCloseUp(true);
    setError(null);
    setGeneratedLookbook(prev => prev ? { ...prev, closeups: [] } : null);

    const baseImage = generatedLookbook.main;
    const closeUpPrompts = buildCloseUpPrompts();
    const combinedNegativePrompt = buildCloseUpNegativePrompt(formState.negativePrompt);

    try {
      const results: ImageFile[] = [];
      for (const [index, prompt] of closeUpPrompts.entries()) {
        setLoadingMessage(t('lookbook.generatingCloseUpStatus', { progress: index + 1, total: 3 }));

        const [result] = await editImage({
          images: [baseImage],
          prompt,
          aspectRatio: '1:1' as AspectRatio,
          negativePrompt: combinedNegativePrompt,
          numberOfImages: 1
        }, imageEditModel, buildImageServiceConfig((msg) =>
          setLoadingMessage(`${t('lookbook.generatingCloseUpStatus', { progress: index + 1, total: 3 })} - ${msg}`)
        ));

        results.push(result);
        setGeneratedLookbook(prev => prev ? { ...prev, closeups: [...results] } : null);
      }
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsGeneratingCloseUp(false);
      setLoadingMessage('');
    }
  }, [generatedLookbook, formState.negativePrompt, imageEditModel, requireAivideoautoConfig, buildImageServiceConfig, t]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
      {/* Left Column: Form */}
      <div>
        <LookbookForm
          formState={formState}
          onFormChange={updateForm}
          onGenerateDescription={handleGenerateDescription}
          onGenerate={handleGenerate}
          onClearForm={handleClearForm}
          isGeneratingDescription={isGeneratingDescription}
          isLoading={isLoading}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          resolution={resolution}
          setResolution={setResolution}
          imageEditModel={imageEditModel}
          mannequinBackgroundStyles={MANNEQUIN_BACKGROUND_STYLES}
        />
      </div>

      {/* Right Column: Output */}
      <div>
        <LookbookOutput
          lookbook={generatedLookbook}
          activeTab={activeOutputTab}
          onTabChange={setActiveOutputTab}
          onUpscale={handleUpscale}
          onGenerateVariations={handleGenerateVariations}
          onGenerateCloseUp={handleGenerateCloseUp}
          upscalingStates={upscalingStates}
          isGeneratingVariations={isGeneratingVariations}
          isGeneratingCloseUp={isGeneratingCloseUp}
          isLoading={isLoading}
          loadingMessage={loadingMessage}
          error={error}
          onClearError={() => setError(null)}
          variationCount={variationCount}
          onVariationCountChange={setVariationCount}
        />
      </div>
    </div>
  );
};
