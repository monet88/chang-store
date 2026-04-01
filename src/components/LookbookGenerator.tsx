/**
 * LookbookGenerator - Main orchestrator component
 *
 * Thin orchestrator that uses useLookbookGenerator hook as single source of truth.
 */

import React, { useCallback } from 'react';
import { useLookbookGenerator } from '../hooks/useLookbookGenerator';
import { useLanguage } from '../contexts/LanguageContext';
import { Feature, ImageFile } from '../types';
import { MannequinBackgroundStyleKey } from './LookbookGenerator.prompts';
import { LookbookForm } from './LookbookForm';
import { LookbookOutput } from './LookbookOutput';

interface LookbookGeneratorProps {
  onSendToFeature?: (feature: Feature, image: ImageFile) => void;
}

export const LookbookGenerator: React.FC<LookbookGeneratorProps> = ({ onSendToFeature }) => {
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
    resolution,
    setResolution,
    refinementVersions,
    selectedVersionIndex,
    originalImageRef,
    imageEditModel,
    handleDownloadAll,
  } = useLookbookGenerator();

  const { t } = useLanguage();

  // Mannequin background styles derived from translations
  const MANNEQUIN_BACKGROUND_STYLES: { key: MannequinBackgroundStyleKey; label: string }[] = (
    Object.keys(t('lookbook.mannequinBackgroundStyles', { returnObjects: true })) as MannequinBackgroundStyleKey[]
  ).map(key => ({
    key,
    label: t(`lookbook.mannequinBackgroundStyles.${key}`),
  }));

  const handleSendToAlbum = useCallback((image: ImageFile) => {
    onSendToFeature?.(Feature.PhotoAlbum, image);
  }, [onSendToFeature]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
      {/* Form columns: at xl display:contents makes the 2 inner divs direct grid items */}
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

      {/* Right Column: Output */}
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
      />
    </div>
  );
};
