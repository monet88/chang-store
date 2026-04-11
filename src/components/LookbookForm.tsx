import React, { useCallback, useState } from 'react';
import { ImageFile, AspectRatio, ImageResolution } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import ImageUploader from './ImageUploader';
import MultiImageUploader from './MultiImageUploader';
import Spinner from './Spinner';
import ImageOptionsPanel from './ImageOptionsPanel';
import { AddIcon, DeleteIcon, MagicWandIcon } from './Icons';
import {
  LookbookStyle,
  GarmentType,
  MannequinBackgroundStyleKey,
} from './LookbookGenerator.prompts';
import { LookbookFormState } from '../utils/lookbookPromptBuilder';

export interface ClothingItem {
  id: number;
  image: ImageFile | null;
}

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

const panelClass = 'rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-6';
const labelClass = 'text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500';
const sectionTitleClass = 'text-xl font-medium tracking-[-0.03em] text-zinc-50';
const helperClass = 'text-sm leading-6 text-zinc-400';
const textareaClass = 'w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-zinc-100 placeholder:text-zinc-500 focus:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20';
const choiceWrapClass = 'flex flex-wrap gap-2 rounded-[20px] border border-white/10 bg-black/30 p-2';
const choiceButton = (active: boolean) => `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
  active ? 'bg-white text-black' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100'
}`;
const secondaryButtonClass = 'inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50';
const primaryButtonClass = 'inline-flex items-center justify-center rounded-full bg-[#f4f4f2] px-5 py-3 text-sm font-semibold tracking-[-0.01em] text-[#09090b] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40';

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
  mannequinBackgroundStyles,
}) => {
  const { t } = useLanguage();
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
    includeFootwear,
  } = formState;

  const handleClothingUpload = useCallback((file: ImageFile | null, id: number) => {
    const newClothingImages = clothingImages.map((item) =>
      item.id === id ? { ...item, image: file } : item,
    );
    onFormChange({ clothingImages: newClothingImages });
  }, [clothingImages, onFormChange]);

  const handleMultiClothingUpload = useCallback((files: ImageFile[]) => {
    const newClothingImages = files.map((file) => ({
      id: Date.now() + Math.random(),
      image: file,
    }));
    onFormChange({ clothingImages: newClothingImages });
  }, [onFormChange]);

  const addClothingUploader = useCallback(() => {
    onFormChange({
      clothingImages: [...clothingImages, { id: Date.now(), image: null }],
    });
  }, [clothingImages, onFormChange]);

  const removeClothingUploader = useCallback((id: number) => {
    onFormChange({
      clothingImages: clothingImages.filter((item) => item.id !== id),
    });
  }, [clothingImages, onFormChange]);

  const validClothingImages = clothingImages.filter((item) => item.image !== null);
  const anyLoading = isLoading || isGeneratingDescription;
  const hasFabricOverride = Boolean(fabricTextureImage || fabricTexturePrompt.trim());

  const lookbookStyles: { key: LookbookStyle; label: string }[] = [
    { key: 'flat lay', label: t('lookbook.styleFlatLay') },
    { key: 'mannequin', label: t('lookbook.styleMannequin') },
    { key: 'hanger', label: t('lookbook.styleHanger') },
    { key: 'folded', label: t('lookbook.styleFolded') },
    { key: 'studio background', label: t('lookbook.styleStudioBackground') },
    { key: 'minimalist showroom', label: t('lookbook.styleMinimalistShowroom') },
    { key: 'product shot', label: t('lookbook.styleProductShot') },
  ];

  return (
    <div className="space-y-6">
      <section className={`${panelClass} space-y-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className={labelClass}>{t('workspace.panels.visualSources')}</p>
            <h3 className={sectionTitleClass}>{t('lookbook.uploadTitle')}</h3>
            <p className={helperClass}>{t('lookbook.editorialDescription')}</p>
          </div>
          <button type="button" onClick={onClearForm} className={secondaryButtonClass}>
            {t('common.clear')}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setUseMultiUpload(!useMultiUpload)}
          className={secondaryButtonClass}
        >
          {useMultiUpload ? t('lookbook.singleUpload') : t('lookbook.multiUpload')}
        </button>

        {useMultiUpload ? (
          <MultiImageUploader
            images={clothingImages.filter((item) => item.image !== null).map((item) => item.image!)}
            onImagesUpload={handleMultiClothingUpload}
            title={t('lookbook.uploadTitle')}
            id="clothing-multi-upload"
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-5">
              {clothingImages.map((item, index) => (
                <div key={item.id} className="relative group rounded-[24px] border border-white/10 bg-black/30 p-3">
                  <ImageUploader
                    image={item.image}
                    id={`clothing-${item.id}`}
                    title={t('lookbook.clothingItemTitle', { index: index + 1 })}
                    onImageUpload={(file) => handleClothingUpload(file, item.id)}
                  />
                  {clothingImages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeClothingUploader(item.id)}
                      className="absolute right-3 top-12 rounded-full border border-white/10 bg-black/60 p-1.5 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Remove view"
                    >
                      <DeleteIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button type="button" onClick={addClothingUploader} className={`${secondaryButtonClass} w-full gap-2`}>
              <AddIcon className="h-4 w-4" />
              {t('lookbook.addView')}
            </button>
          </div>
        )}
      </section>

      <details className="overflow-hidden rounded-[20px] border border-white/10 bg-black/25" open={hasFabricOverride || undefined}>
        <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-left marker:hidden hover:bg-white/[0.03]">
          <span>
            <span className={labelClass}>{t('lookbook.fabricTextureTitle')}</span>
            <span className="mt-1 block text-xs leading-5 text-zinc-500">{t('lookbook.fabricTextureHelp')}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
            {hasFabricOverride ? t('common.save') : 'Optional'}
            <span aria-hidden="true">⌄</span>
          </span>
        </summary>

        <div className="grid gap-4 border-t border-white/8 px-4 py-4 md:grid-cols-[14rem_minmax(0,1fr)]">
          <div className="compact-uploader">
            <ImageUploader
              image={fabricTextureImage}
              id="fabric-texture-upload"
              title={t('lookbook.fabricTextureUploadTitle')}
              onImageUpload={(file) => onFormChange({ fabricTextureImage: file })}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="fabric-texture-prompt" className="text-sm font-medium text-zinc-200">
              {t('lookbook.fabricTexturePromptLabel')}
            </label>
            <textarea
              id="fabric-texture-prompt"
              value={fabricTexturePrompt}
              onChange={(e) => onFormChange({ fabricTexturePrompt: e.target.value })}
              placeholder={t('lookbook.fabricTexturePromptPlaceholder')}
              rows={4}
              className={textareaClass}
            />
          </div>
        </div>
      </details>

      <section className={`${panelClass} space-y-5`}>
        <div className="space-y-2">
          <p className={labelClass}>{t('workspace.panels.controlRail')}</p>
          <h3 className={sectionTitleClass}>{t('workspace.panels.configuration')}</h3>
          <p className={helperClass}>{t('workspace.flows.lookbook')}</p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label htmlFor="clothing-description" className="text-sm font-medium text-zinc-200">
                {t('lookbook.clothingDescriptionLabel')}
              </label>
              <button
                type="button"
                onClick={onGenerateDescription}
                disabled={isGeneratingDescription || validClothingImages.length === 0}
                className={secondaryButtonClass}
                aria-label={t('lookbook.generateDescriptionAria')}
              >
                {isGeneratingDescription ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                ) : (
                  <>
                    <MagicWandIcon className="mr-2 h-4 w-4" />
                    {t('lookbook.generateDescriptionButton')}
                  </>
                )}
              </button>
            </div>
            <textarea
              id="clothing-description"
              value={clothingDescription}
              onChange={(e) => onFormChange({ clothingDescription: e.target.value })}
              placeholder={t('lookbook.clothingDescriptionPlaceholder')}
              rows={3}
              className={textareaClass}
            />
            <p className="text-sm leading-6 text-zinc-500">{t('lookbook.clothingDescriptionHelp')}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="negative-prompt-lookbook" className="text-sm font-medium text-zinc-200">
              {t('common.negativePromptLabel')}
            </label>
            <textarea
              id="negative-prompt-lookbook"
              value={negativePrompt}
              onChange={(e) => onFormChange({ negativePrompt: e.target.value })}
              placeholder={t('lookbook.negativePromptPlaceholder')}
              rows={3}
              className={textareaClass}
            />
            <p className="text-sm leading-6 text-zinc-500">{t('common.negativePromptHelp')}</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-200">{t('lookbook.styleLabel')}</p>
              <div className={choiceWrapClass}>
                {lookbookStyles.map((style) => (
                  <button
                    key={style.key}
                    type="button"
                    onClick={() => {
                      const updates: Partial<LookbookFormState> = { lookbookStyle: style.key };
                      if (style.key === 'product shot') {
                        updates.productShotSubType = garmentType === 'one-piece' ? 'ghost-mannequin' : 'clean-flat-lay';
                      }
                      onFormChange(updates);
                    }}
                    className={choiceButton(lookbookStyle === style.key)}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {lookbookStyle === 'folded' && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-200">{t('lookbook.presentationTypeLabel')}</p>
                <div className={choiceWrapClass}>
                  <button type="button" onClick={() => onFormChange({ foldedPresentationType: 'boxed' })} className={choiceButton(foldedPresentationType === 'boxed')}>
                    {t('lookbook.presentationTypeBoxed')}
                  </button>
                  <button type="button" onClick={() => onFormChange({ foldedPresentationType: 'folded' })} className={choiceButton(foldedPresentationType === 'folded')}>
                    {t('lookbook.presentationTypeFolded')}
                  </button>
                </div>
              </div>
            )}

            {['hanger', 'flat lay', 'minimalist showroom', 'folded', 'product shot'].includes(lookbookStyle) && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-200">{t('lookbook.garmentTypeLabel')}</p>
                <div className={choiceWrapClass}>
                  {(['one-piece', 'two-piece', 'three-piece'] as GarmentType[]).map((type) => (
                    <button key={type} type="button" onClick={() => onFormChange({ garmentType: type })} className={choiceButton(garmentType === type)}>
                      {t(`lookbook.garmentType${type === 'one-piece' ? 'OnePiece' : type === 'two-piece' ? 'TwoPiece' : 'ThreePiece'}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {lookbookStyle === 'mannequin' && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-200">{t('lookbook.mannequinBackgroundStyleLabel')}</p>
                <div className={choiceWrapClass}>
                  {mannequinBackgroundStyles.map((style) => (
                    <button
                      key={style.key}
                      type="button"
                      onClick={() => onFormChange({ mannequinBackgroundStyle: style.key })}
                      className={choiceButton(mannequinBackgroundStyle === style.key)}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {lookbookStyle === 'product shot' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-zinc-200">{t('lookbook.productShotSubTypeLabel')}</p>
                  <div className={choiceWrapClass}>
                    <button type="button" onClick={() => onFormChange({ productShotSubType: 'ghost-mannequin' })} className={choiceButton(productShotSubType === 'ghost-mannequin')}>
                      {t('lookbook.productShotGhostMannequin')}
                    </button>
                    <button type="button" onClick={() => onFormChange({ productShotSubType: 'clean-flat-lay' })} className={choiceButton(productShotSubType === 'clean-flat-lay')}>
                      {t('lookbook.productShotCleanFlatLay')}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={includeAccessories}
                      onChange={(e) => onFormChange({ includeAccessories: e.target.checked })}
                      className="h-4 w-4 rounded border-white/20 bg-black/30 text-white focus:ring-white/20"
                    />
                    {t('lookbook.includeAccessories')}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={includeFootwear}
                      onChange={(e) => onFormChange({ includeFootwear: e.target.checked })}
                      className="h-4 w-4 rounded border-white/20 bg-black/30 text-white focus:ring-white/20"
                    />
                    {t('lookbook.includeFootwear')}
                  </label>
                </div>
              </div>
            )}

            <ImageOptionsPanel
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              resolution={resolution}
              setResolution={setResolution}
              model={imageEditModel}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onGenerate}
            disabled={anyLoading || validClothingImages.length === 0}
            className={primaryButtonClass}
          >
            {isLoading ? <Spinner /> : t('lookbook.generateButton')}
          </button>
        </div>
      </section>
    </div>
  );
});

LookbookForm.displayName = 'LookbookForm';
