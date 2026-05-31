/**
 * AIEditor - Multi-image AI editing with @mention references
 *
 * Features:
 * - Upload multiple images (no limit)
 * - Mention images in prompt with @img1, @img2, etc.
 * - Autocomplete dropdown when typing @
 * - Extract mentioned images and send to API
 * - Display single result image
 */

import React from 'react';
import { Feature } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAIEditor } from '../hooks/useAIEditor';
import MultiImageUploader from './MultiImageUploader';
import MentionTextarea from './MentionTextarea';
import ImageOptionsPanel from './ImageOptionsPanel';
import HoverableImage from './HoverableImage';
import Spinner, { ErrorDisplay } from './Spinner';
import ResultPlaceholder from './shared/ResultPlaceholder';

/**
 * AIEditor component
 * Provides multi-image editing with @mention reference system
 */
const AIEditor: React.FC = () => {
  const { t } = useLanguage();
  const {
    images,
    setImages,
    prompt,
    setPrompt,
    isLoading,
    error,
    resultImage,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    imageEditModel,
    handleGenerate,
    clearError,
  } = useAIEditor();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
      {/* Left Column: Inputs */}
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-xl md:text-2xl font-bold mb-1">{t('aiEditor.title')}</h2>
          <p className="text-zinc-400 max-w-lg mx-auto">{t('aiEditor.description')}</p>
        </div>

        {/* Multi-image uploader */}
        <div className="workspace-panel p-5">
          <MultiImageUploader
            images={images}
            onImagesUpload={setImages}
            title={t('aiEditor.uploadTitle')}
            id="ai-editor-upload"
          />
        </div>

        {/* Prompt with mentions */}
        <div>
          <label htmlFor="ai-editor-prompt" className="block text-sm font-medium text-zinc-300 mb-2">
            {t('aiEditor.promptLabel')}
          </label>
          <MentionTextarea
            value={prompt}
            onChange={setPrompt}
            images={images}
            placeholder={t('aiEditor.promptPlaceholder')}
            rows={3}
            id="ai-editor-prompt"
          />
        </div>

        {/* Options panel */}
        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <ImageOptionsPanel
            aspectRatio={aspectRatio}
            setAspectRatio={setAspectRatio}
            resolution={resolution}
            setResolution={setResolution}
            model={imageEditModel}
          />
        </div>

        {/* Generate button */}
        <div className="text-center">
          <button
            onClick={handleGenerate}
            disabled={isLoading || images.length === 0}
            className="brand-button"
          >
            {isLoading ? <Spinner /> : t('aiEditor.generateButton')}
          </button>
        </div>
      </div>

      {/* Right Column: Output */}
      <div className="lg:sticky lg:top-8">
        <div className="relative w-full min-h-[400px] lg:aspect-[4/5] bg-zinc-900/50 rounded-2xl border border-zinc-800 flex items-center justify-center p-4">
          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center gap-4">
              <Spinner />
              <p className="text-zinc-400">{t('aiEditor.generatingStatus')}</p>
            </div>
          )}

          {/* Result image */}
          {!isLoading && resultImage && (
            <HoverableImage
              image={resultImage}
              altText="AI Editor result"
              downloadPrefix={Feature.AIEditor}
              onRegenerate={handleGenerate}
              isGenerating={isLoading}
            />
          )}

          {/* Placeholder */}
          {!isLoading && !resultImage && !error && (
            <ResultPlaceholder description={t('aiEditor.outputPanelDescription')} />
          )}

          {/* Error display */}
          {error && !isLoading && (
            <ErrorDisplay
              title={t('common.generationFailed')}
              message={error}
              onClear={clearError}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AIEditor;
