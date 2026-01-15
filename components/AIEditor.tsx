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

import React, { useState, useCallback } from 'react';
import { Feature, ImageFile, AspectRatio, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { editImage } from '../services/imageEditingService';
import { getErrorMessage } from '../utils/imageUtils';
import MultiImageUploader from './MultiImageUploader';
import MentionTextarea from './MentionTextarea';
import ImageOptionsPanel from './ImageOptionsPanel';
import HoverableImage from './HoverableImage';
import Spinner, { ErrorDisplay } from './Spinner';
import ResultPlaceholder from './shared/ResultPlaceholder';

/** Regex to extract @img mentions from prompt */
const MENTION_REGEX = /@img(\d+)/g;

/**
 * AIEditor component
 * Provides multi-image editing with @mention reference system
 */
const AIEditor: React.FC = () => {
  const { t } = useLanguage();
  const { getModelsForFeature, aivideoautoAccessToken, aivideoautoImageModels } = useApi();
  const { imageEditModel } = getModelsForFeature(Feature.AIEditor);

  // State
  const [images, setImages] = useState<ImageFile[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<ImageFile | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);

  /**
   * Extract mentioned images from prompt
   * Returns unique images in mention order
   */
  const extractMentionedImages = useCallback((promptText: string): ImageFile[] => {
    const matches = [...promptText.matchAll(MENTION_REGEX)];
    // Get unique indices (1-based in prompt, convert to 0-based)
    const indices = [...new Set(matches.map(m => parseInt(m[1]) - 1))];
    // Filter valid indices and map to images
    return indices
      .filter(i => i >= 0 && i < images.length)
      .map(i => images[i]);
  }, [images]);

  /**
   * Build API prompt with image roles based on mentions
   */
  const buildApiPrompt = useCallback((userPrompt: string, mentionedImages: ImageFile[]): string => {
    if (mentionedImages.length === 0) {
      // Fallback: use all images, no specific roles
      return `# INSTRUCTION: IMAGE EDITING

## USER REQUEST:
${userPrompt}

## OUTPUT:
Return the edited image as the final result.`;
    }

    // Build image roles based on mentioned images
    const imageRoles = mentionedImages.map((_, idx) => {
      // Find original index in images array
      const originalIndex = images.indexOf(mentionedImages[idx]);
      const tag = `@img${originalIndex + 1}`;
      return `- Image ${idx + 1} (${tag}): Reference image`;
    }).join('\n');

    return `# INSTRUCTION: MULTI-IMAGE EDITING

## IMAGE ROLES:
${imageRoles}

## USER REQUEST:
${userPrompt}

## CRITICAL RULES:
1. Analyze all provided images based on the user's request
2. Apply edits as described, using referenced images appropriately
3. Maintain image quality and natural appearance

## OUTPUT:
Return the final edited image.`;
  }, [images]);

  /**
   * Handle generate button click
   */
  const handleGenerate = useCallback(async () => {
    // Validation
    if (images.length === 0) {
      setError(t('aiEditor.error.noImages'));
      return;
    }
    if (!prompt.trim()) {
      setError(t('aiEditor.error.noPrompt'));
      return;
    }

    // Check API auth for aivideoauto models
    if (imageEditModel.startsWith('aivideoauto--') && !aivideoautoAccessToken) {
      setError(t('error.api.aivideoautoAuth'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Extract mentioned images or use all if no mentions
      const mentionedImages = extractMentionedImages(prompt);
      const imagesToSend = mentionedImages.length > 0 ? mentionedImages : images;
      const apiPrompt = buildApiPrompt(prompt, imagesToSend);

      console.log('🎨 AIEditor Request:', {
        aspectRatio,
        resolution,
        model: imageEditModel,
        totalImages: images.length,
        mentionedImages: mentionedImages.length,
        imagesToSend: imagesToSend.length,
      });

      const [result] = await editImage(
        {
          images: imagesToSend,
          prompt: apiPrompt,
          numberOfImages: 1,
          aspectRatio,
          resolution,
        },
        imageEditModel,
        {
          onStatusUpdate: () => {},
          aivideoautoAccessToken,
          aivideoautoImageModels,
        }
      );

      setResultImage(result);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [
    images,
    prompt,
    imageEditModel,
    aivideoautoAccessToken,
    aivideoautoImageModels,
    aspectRatio,
    resolution,
    extractMentionedImages,
    buildApiPrompt,
    t,
  ]);

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
        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
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
            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30"
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
              onClear={() => setError(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AIEditor;
