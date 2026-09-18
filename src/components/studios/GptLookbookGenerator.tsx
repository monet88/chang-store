import React, { useCallback } from 'react';
import { useLookbookGenerator } from '../../hooks/useLookbookGenerator';
import { useLanguage } from '../../contexts/LanguageContext';
import { Feature, ImageFile } from '../../types';
import { MannequinBackgroundStyleKey } from '../LookbookGenerator.prompts';
import { GptLookbookForm } from './GptLookbookForm';
import { LookbookOutput } from '../LookbookOutput';

interface GptLookbookGeneratorProps {
  onSendToFeature?: (feature: Feature, image: ImageFile) => void;
}

export const GptLookbookGenerator: React.FC<GptLookbookGeneratorProps> = ({ onSendToFeature }) => {
  const {
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
    refinementHistory,
    isRefining,
    handleRefineImage,
    handleResetRefinement,
    aspectRatio,
    setAspectRatio,
    refinementVersions,
    selectedVersionIndex,
    originalImageRef,
    handleDownloadAll,
  } = useLookbookGenerator();

  const { t } = useLanguage();

  const mannequinBackgroundStyles = React.useMemo(() => {
    return (
      Object.keys(t('lookbook.mannequinBackgroundStyles', { returnObjects: true })) as MannequinBackgroundStyleKey[]
    ).map((key) => ({
      key,
      label: t(`lookbook.mannequinBackgroundStyles.${key}`),
    }));
  }, [t]);

  const handleSendToAlbum = useCallback((image: ImageFile) => {
    onSendToFeature?.(Feature.PhotoAlbum, image);
  }, [onSendToFeature]);

  const handleClearError = useCallback(() => setError(null), [setError]);

  return (
    <div className="space-y-6 pb-12">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
        <GptLookbookForm
          formState={formState}
          onFormChange={updateForm}
          onGenerateDescription={handleGenerateDescription}
          onGenerate={handleGenerate}
          onClearForm={handleClearForm}
          isGeneratingDescription={isGeneratingDescription}
          isLoading={isLoading}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          mannequinBackgroundStyles={mannequinBackgroundStyles}
        />

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
          onClearError={handleClearError}
          variationCount={variationCount}
          onVariationCountChange={setVariationCount}
          refinementHistory={refinementHistory}
          refinementVersions={refinementVersions}
          selectedVersionIndex={selectedVersionIndex}
          originalImage={originalImageRef.current}
          onSelectVersion={handleSelectVersion}
          isRefining={isRefining}
          onRefineImage={handleRefineImage}
          onResetRefinement={handleResetRefinement}
          onSendToFeature={onSendToFeature ? handleSendToAlbum : undefined}
          onDownloadAll={handleDownloadAll}
          onRegenerate={isRefining ? undefined : handleGenerate}
        />
      </div>
    </div>
  );
};

export default GptLookbookGenerator;
