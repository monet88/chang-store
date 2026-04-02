/**
 * LookbookForm - Form UI for lookbook generation
 *
 * Extracted from LookbookGenerator.tsx for better separation of concerns.
 * Memoized to prevent re-renders when output changes.
 */

import React, { useCallback, useState } from 'react';
import { ImageFile, AspectRatio, ImageResolution } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import ImageUploader from './ImageUploader';
import MultiImageUploader from './MultiImageUploader';
import Tooltip from './Tooltip';
import Spinner from './Spinner';
import ImageOptionsPanel from './ImageOptionsPanel';
import { AddIcon, DeleteIcon, MagicWandIcon } from './Icons';
import {
  LookbookStyle,
  GarmentType,
  FoldedPresentationType,
  MannequinBackgroundStyleKey,
  ProductShotSubType
} from './LookbookGenerator.prompts';
import { LookbookFormState } from '../utils/lookbookPromptBuilder';

/**
 * Clothing item interface (used in LookbookFormState)
 */
export interface ClothingItem {
  id: number;
  image: ImageFile | null;
}

/**
 * Props for LookbookForm component
 */
interface LookbookFormProps {
  formState: LookbookFormState;
  onFormChange: (updates: Partial<LookbookFormState>) => void;
  onGenerateDescription: () => void;
  onGenerate: () => void;
  onClearForm: () => void;
  isGeneratingDescription: boolean;
  isLoading: boolean;
  aspectRatio: AspectRatio;
  setAspectRatio: (ratio: AspectRatio) => void;
  resolution: ImageResolution;
  setResolution: (resolution: ImageResolution) => void;
  imageEditModel: string;
  mannequinBackgroundStyles: Array<{ key: MannequinBackgroundStyleKey; label: string }>;
}

/**
 * LookbookForm component
 * Handles all form inputs and user interactions for lookbook generation
 */
export const LookbookForm = React.memo<LookbookFormProps>(({
  formState,
  onFormChange,
  onGenerateDescription,
  onGenerate,
  onClearForm,
  isGeneratingDescription,
  isLoading,
  aspectRatio,
  setAspectRatio,
  resolution,
  setResolution,
  imageEditModel,
  mannequinBackgroundStyles
}) => {
  const { t } = useLanguage();
  // Local state for upload mode toggle
  const [useMultiUpload, setUseMultiUpload] = useState(false);

  const {
    clothingImages,
    fabricTextureImage,
    fabricTexturePrompt,
    clothingDescription,
    lookbookStyle,
    garmentType,
    foldedPresentationType,
    mannequinBackgroundStyle,
    negativePrompt,
    productShotSubType,
    includeAccessories,
    includeFootwear
  } = formState;

  // Memoized handlers
  const handleClothingUpload = useCallback((file: ImageFile | null, id: number) => {
    const newClothingImages = clothingImages.map(item =>
      item.id === id ? { ...item, image: file } : item
    );
    onFormChange({ clothingImages: newClothingImages });
  }, [clothingImages, onFormChange]);

  /**
   * Handle multi-upload: convert ImageFile[] to ClothingItem[]
   */
  const handleMultiClothingUpload = useCallback((files: ImageFile[]) => {
    const newClothingImages = files.map(file => ({
      id: Date.now() + Math.random(),
      image: file
    }));
    onFormChange({ clothingImages: newClothingImages });
  }, [onFormChange]);

  const addClothingUploader = useCallback(() => {
    onFormChange({
      clothingImages: [...clothingImages, { id: Date.now(), image: null }]
    });
  }, [clothingImages, onFormChange]);

  const removeClothingUploader = useCallback((id: number) => {
    onFormChange({
      clothingImages: clothingImages.filter(item => item.id !== id)
    });
  }, [clothingImages, onFormChange]);

  const handleFabricTextureUpload = useCallback((file: ImageFile | null) => {
    onFormChange({ fabricTextureImage: file });
  }, [onFormChange]);

  const handleFabricTexturePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onFormChange({ fabricTexturePrompt: e.target.value });
  }, [onFormChange]);

  const handleClothingDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onFormChange({ clothingDescription: e.target.value });
  }, [onFormChange]);

  const handleNegativePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onFormChange({ negativePrompt: e.target.value });
  }, [onFormChange]);

  const handleStyleChange = useCallback((style: LookbookStyle) => {
    const updates: Partial<LookbookFormState> = { lookbookStyle: style };
    // Auto-select product shot sub-type based on current garment type
    if (style === 'product shot') {
      updates.productShotSubType = garmentType === 'one-piece'
        ? 'ghost-mannequin'
        : 'clean-flat-lay';
    }
    onFormChange(updates);
  }, [onFormChange, garmentType]);

  const handlePresentationTypeChange = useCallback((type: FoldedPresentationType) => {
    onFormChange({ foldedPresentationType: type });
  }, [onFormChange]);

  const handleGarmentTypeChange = useCallback((type: GarmentType) => {
    onFormChange({ garmentType: type });
  }, [onFormChange]);

  const handleMannequinBackgroundChange = useCallback((style: MannequinBackgroundStyleKey) => {
    onFormChange({ mannequinBackgroundStyle: style });
  }, [onFormChange]);

  const handleProductShotSubTypeChange = useCallback((subType: ProductShotSubType) => {
    onFormChange({ productShotSubType: subType });
  }, [onFormChange]);

  const handleIncludeAccessoriesChange = useCallback((checked: boolean) => {
    onFormChange({ includeAccessories: checked });
  }, [onFormChange]);

  const handleIncludeFootwearChange = useCallback((checked: boolean) => {
    onFormChange({ includeFootwear: checked });
  }, [onFormChange]);

  const validClothingImages = clothingImages.filter(item => item.image !== null);
  const anyLoading = isLoading || isGeneratingDescription;

  const lookbookStyles: { key: LookbookStyle, label: string }[] = [
    { key: 'flat lay', label: t('lookbook.styleFlatLay') },
    { key: 'mannequin', label: t('lookbook.styleMannequin') },
    { key: 'hanger', label: t('lookbook.styleHanger') },
    { key: 'folded', label: t('lookbook.styleFolded') },
    { key: 'studio background', label: t('lookbook.styleStudioBackground') },
    { key: 'minimalist showroom', label: t('lookbook.styleMinimalistShowroom') },
    { key: 'product shot', label: t('lookbook.styleProductShot') },
  ];


  return (
    <div className="xl:[display:contents] flex flex-col gap-6">
      {/* Column 1 (Visual Assets): Header + Clothing Images + Fabric Texture */}
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-center text-center gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold mb-1">{t('lookbook.title')}</h2>
            <p className="text-zinc-400">{t('lookbook.description')}</p>
          </div>
          <button
            onClick={onClearForm}
            className="text-xs text-zinc-400 hover:text-white bg-zinc-700/50 hover:bg-zinc-700 px-3 py-1.5 rounded-md transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Clothing Images Section */}
        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base md:text-lg font-semibold text-amber-400">
              {t('lookbook.uploadTitle')}
            </h3>
            {/* Toggle button for upload mode */}
            <button
              onClick={() => setUseMultiUpload(!useMultiUpload)}
              className="text-xs text-zinc-400 hover:text-amber-400 bg-zinc-700/50 hover:bg-zinc-700 px-3 py-1.5 rounded-md transition-colors"
            >
              {useMultiUpload ? 'Single Upload' : 'Multi Upload'}
            </button>
          </div>

          {useMultiUpload ? (
            /* Multi-upload mode */
            <MultiImageUploader
              images={clothingImages.filter(item => item.image !== null).map(item => item.image!)}
              onImagesUpload={handleMultiClothingUpload}
              title=""
              id="clothing-multi-upload"
            />
          ) : (
            /* Single upload mode (original grid) */
            <>
              <div className="grid grid-cols-2 gap-4">
                {clothingImages.map((item, index) => (
                  <div key={item.id} className="relative group">
                    <Tooltip content={t('tooltips.lookbookClothing')} position="top">
                      <ImageUploader
                        image={item.image}
                        id={`clothing-${item.id}`}
                        title={t('lookbook.clothingItemTitle', { index: index + 1 })}
                        onImageUpload={(file) => handleClothingUpload(file, item.id)}
                      />
                    </Tooltip>
                    {clothingImages.length > 1 && (
                      <button
                        onClick={() => removeClothingUploader(item.id)}
                        className="absolute -top-2 -right-2 z-10 p-1 bg-red-600 rounded-full text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove view"
                      >
                        <DeleteIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Tooltip content={t('tooltips.lookbookAddView')} position="bottom" className="w-full">
                <button
                  onClick={addClothingUploader}
                  className="w-full mt-4 bg-zinc-700/80 text-zinc-200 font-semibold py-2.5 px-4 rounded-lg hover:bg-zinc-700 transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <AddIcon className="w-5 h-5" />
                  <span>{t('lookbook.addView')}</span>
                </button>
              </Tooltip>
            </>
          )}
        </div>

        {/* Fabric Texture Section */}
        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-4">
          <h3 className="text-base md:text-lg font-semibold text-center text-amber-400">
            {t('lookbook.fabricTextureTitle')}
          </h3>
          {/* At xl (narrow 3-col column) stack vertically; at md+ side-by-side otherwise */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6 items-start">
            <Tooltip content={t('tooltips.lookbookFabricTexture')} position="right">
              <ImageUploader
                image={fabricTextureImage}
                id="fabric-texture-upload"
                title={t('lookbook.fabricTextureUploadTitle')}
                onImageUpload={handleFabricTextureUpload}
              />
            </Tooltip>
            <Tooltip content={t('tooltips.lookbookFabricDescription')} position="left" className="w-full">
              <label htmlFor="fabric-texture-prompt" className="block text-sm font-medium text-zinc-300 mb-2">
                {t('lookbook.fabricTexturePromptLabel')}
              </label>
              <textarea
                id="fabric-texture-prompt"
                value={fabricTexturePrompt}
                onChange={handleFabricTexturePromptChange}
                placeholder={t('lookbook.fabricTexturePromptPlaceholder')}
                rows={4}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
              />
            </Tooltip>
          </div>
          <p className="text-xs text-zinc-500 text-center">{t('lookbook.fabricTextureHelp')}</p>
        </div>
      </div>

      {/* Column 2 (Configuration): Description + Negative Prompt + Style Selection + Options + Generate */}
      <div className="flex flex-col gap-6">
        {/* Clothing Description Section */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="clothing-description" className="block text-sm font-medium text-zinc-300">
              {t('lookbook.clothingDescriptionLabel')}
            </label>
            <Tooltip content={t('tooltips.lookbookGenerateDescription')} position="left">
              <button
                onClick={onGenerateDescription}
                disabled={isGeneratingDescription || validClothingImages.length === 0}
                className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors"
                aria-label={t('lookbook.generateDescriptionAria')}
              >
                {isGeneratingDescription ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-400"></div>
                ) : (
                  <>
                    <MagicWandIcon className="w-4 h-4" />
                    <span>{t('lookbook.generateDescriptionButton')}</span>
                  </>
                )}
              </button>
            </Tooltip>
          </div>
          <textarea
            id="clothing-description"
            value={clothingDescription}
            onChange={handleClothingDescriptionChange}
            placeholder={t('lookbook.clothingDescriptionPlaceholder')}
            rows={2}
            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
          />
          <p className="text-xs text-zinc-500 mt-1">{t('lookbook.clothingDescriptionHelp')}</p>
        </div>

        {/* Negative Prompt Section */}
        <Tooltip content={t('tooltips.lookbookNegativePrompt')} position="top" className="w-full">
          <label htmlFor="negative-prompt-lookbook" className="block text-sm font-medium text-zinc-300 mb-2">
            {t('common.negativePromptLabel')}
          </label>
          <textarea
            id="negative-prompt-lookbook"
            value={negativePrompt}
            onChange={handleNegativePromptChange}
            placeholder={t('lookbook.negativePromptPlaceholder')}
            rows={2}
            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
          />
          <p className="text-xs text-zinc-500 mt-1">{t('common.negativePromptHelp')}</p>
        </Tooltip>

        {/* Style Selection Section */}
        <div className="space-y-4">
          <Tooltip content={t('tooltips.lookbookStyle')} position="bottom">
            <div className="flex flex-col items-center gap-2">
              <span className="text-zinc-300 font-medium">{t('lookbook.styleLabel')}:</span>
              <div className="flex flex-wrap justify-center gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
                {lookbookStyles.map(style => (
                  <button
                    key={style.key}
                    onClick={() => handleStyleChange(style.key)}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-md capitalize transition-colors duration-200 ${
                      lookbookStyle === style.key
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                        : 'text-zinc-300 hover:bg-zinc-700/50'
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>
          </Tooltip>

          {/* Conditional: Folded Presentation Type */}
          {lookbookStyle === 'folded' && (
            <div className="flex flex-col items-center gap-2 pt-4 border-t border-zinc-700/50 animate-fade-in">
              <span className="text-zinc-300 font-medium">{t('lookbook.presentationTypeLabel')}:</span>
              <div className="flex gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
                <button
                  onClick={() => handlePresentationTypeChange('boxed')}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
                    foldedPresentationType === 'boxed'
                      ? 'bg-amber-600 text-white'
                      : 'text-zinc-300 hover:bg-zinc-700/50'
                  }`}
                >
                  {t('lookbook.presentationTypeBoxed')}
                </button>
                <button
                  onClick={() => handlePresentationTypeChange('folded')}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
                    foldedPresentationType === 'folded'
                      ? 'bg-amber-600 text-white'
                      : 'text-zinc-300 hover:bg-zinc-700/50'
                  }`}
                >
                  {t('lookbook.presentationTypeFolded')}
                </button>
              </div>
            </div>
          )}

          {/* Conditional: Garment Type */}
          {['hanger', 'flat lay', 'minimalist showroom', 'folded', 'product shot'].includes(lookbookStyle) && (
            <div className="flex flex-col items-center gap-2 pt-4 border-t border-zinc-700/50 animate-fade-in">
              <span className="text-zinc-300 font-medium">{t('lookbook.garmentTypeLabel')}:</span>
              <div className="flex gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
                <button
                  onClick={() => handleGarmentTypeChange('one-piece')}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
                    garmentType === 'one-piece'
                      ? 'bg-amber-600 text-white'
                      : 'text-zinc-300 hover:bg-zinc-700/50'
                  }`}
                >
                  {t('lookbook.garmentTypeOnePiece')}
                </button>
                <button
                  onClick={() => handleGarmentTypeChange('two-piece')}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
                    garmentType === 'two-piece'
                      ? 'bg-amber-600 text-white'
                      : 'text-zinc-300 hover:bg-zinc-700/50'
                  }`}
                >
                  {t('lookbook.garmentTypeTwoPiece')}
                </button>
                <button
                  onClick={() => handleGarmentTypeChange('three-piece')}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
                    garmentType === 'three-piece'
                      ? 'bg-amber-600 text-white'
                      : 'text-zinc-300 hover:bg-zinc-700/50'
                  }`}
                >
                  {t('lookbook.garmentTypeThreePiece')}
                </button>
              </div>
            </div>
          )}

          {/* Conditional: Mannequin Background Style */}
          {lookbookStyle === 'mannequin' && (
            <div className="flex flex-col items-center gap-2 pt-4 border-t border-zinc-700/50 animate-fade-in">
              <span className="text-zinc-300 font-medium">{t('lookbook.mannequinBackgroundStyleLabel')}:</span>
              <div className="flex flex-wrap justify-center gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
                {mannequinBackgroundStyles.map(style => (
                  <button
                    key={style.key}
                    onClick={() => handleMannequinBackgroundChange(style.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors duration-200 ${
                      mannequinBackgroundStyle === style.key
                        ? 'bg-amber-600 text-white'
                        : 'text-zinc-300 hover:bg-zinc-700/50'
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conditional: Product Shot Sub-Type & Options */}
          {lookbookStyle === 'product shot' && (
            <div className="flex flex-col items-center gap-4 pt-4 border-t border-zinc-700/50 animate-fade-in">
              {/* Sub-type radio */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-zinc-300 font-medium">{t('lookbook.productShotSubTypeLabel')}:</span>
                <div className="flex gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
                  <button
                    onClick={() => handleProductShotSubTypeChange('ghost-mannequin')}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
                      productShotSubType === 'ghost-mannequin'
                        ? 'bg-amber-600 text-white'
                        : 'text-zinc-300 hover:bg-zinc-700/50'
                    }`}
                  >
                    {t('lookbook.productShotGhostMannequin')}
                  </button>
                  <button
                    onClick={() => handleProductShotSubTypeChange('clean-flat-lay')}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
                      productShotSubType === 'clean-flat-lay'
                        ? 'bg-amber-600 text-white'
                        : 'text-zinc-300 hover:bg-zinc-700/50'
                    }`}
                  >
                    {t('lookbook.productShotCleanFlatLay')}
                  </button>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAccessories}
                    onChange={(e) => handleIncludeAccessoriesChange(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500"
                  />
                  {t('lookbook.includeAccessories')}
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFootwear}
                    onChange={(e) => handleIncludeFootwearChange(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500"
                  />
                  {t('lookbook.includeFootwear')}
                </label>
              </div>
            </div>
          )}

          {/* Image Options Panel */}
          <div className="pt-4 border-t border-zinc-700/50 animate-fade-in space-y-3">
            <ImageOptionsPanel
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              resolution={resolution}
              setResolution={setResolution}
              model={imageEditModel}
            />
          </div>
        </div>

        {/* Generate Button */}
        <div className="text-center pt-2">
          <Tooltip content={t('tooltips.lookbookGenerate')} position="top">
            <button
              onClick={onGenerate}
              disabled={anyLoading || validClothingImages.length === 0}
              className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105"
            >
              {isLoading ? <Spinner /> : t('lookbook.generateButton')}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
});

LookbookForm.displayName = 'LookbookForm';
