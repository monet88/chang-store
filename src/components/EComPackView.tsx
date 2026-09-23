import React from 'react';
import ImageUploader from './ImageUploader';
import MultiImageUploader from './MultiImageUploader';
import Spinner from './Spinner';
import HoverableImage from './HoverableImage';
import GptImageOptionsPanel from './studios/GptImageOptionsPanel';
import ImageOptionsPanel from './ImageOptionsPanel';
import ResultPlaceholder from './shared/ResultPlaceholder';
import { AddIcon, DeleteIcon, CloseIcon } from './Icons';
import { AspectRatio, GarmentScope, ImageFile, ImageResolution, UpscaleQuality } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { UseClothingTransferEComPackReturn } from '../hooks/useClothingTransferEComPack';

type DisplayTemplateCategory =
  Parameters<UseClothingTransferEComPackReturn['handleAddTextTemplate']>[0]['category'];

type EComPackViewModel = UseClothingTransferEComPackReturn & {
  handleUpscale: (
    image: ImageFile,
    index: number,
    itemId?: string,
    quality?: UpscaleQuality,
  ) => Promise<void>;
  handleRefine: (image: ImageFile, index: number, itemId: string, prompt: string) => Promise<void>;
  handleDownloadAll: () => Promise<void>;
  refinePrompts: Record<string, string>;
  setRefinePrompts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isRefining: Record<string, boolean>;
  upscalingStates: Record<string, boolean>;
};

interface EComPackViewProps {
  ecomPack: EComPackViewModel;
  aspectRatio: AspectRatio;
  setAspectRatio: (ar: AspectRatio) => void;
  resolution: ImageResolution;
  setResolution: (res: ImageResolution) => void;
  imageEditModel: string;
  error: string | null;
  isGptImageStudio: boolean;
  isLocalQwen?: boolean;
}

const GARMENT_SCOPES: { id: GarmentScope; labelKey: string }[] = [
  { id: 'full-set', labelKey: 'clothingTransfer.ecomPack.garmentScopes.full-set' },
  { id: 'top', labelKey: 'clothingTransfer.ecomPack.garmentScopes.top' },
  { id: 'bottom', labelKey: 'clothingTransfer.ecomPack.garmentScopes.bottom' },
  { id: 'dress', labelKey: 'clothingTransfer.ecomPack.garmentScopes.dress' },
  { id: 'outerwear', labelKey: 'clothingTransfer.ecomPack.garmentScopes.outerwear' },
];

export const EComPackView: React.FC<EComPackViewProps> = ({
  ecomPack,
  aspectRatio,
  setAspectRatio,
  resolution,
  setResolution,
  imageEditModel,
  error,
  isGptImageStudio,
  isLocalQwen = false,
}) => {
  const { t } = useLanguage();
  const {
    sourceOutfitImage,
    setSourceOutfitImage,
    outfitBlueprint,
    isAnalyzingOutfit,
    handleReanalyzeOutfit,
    selectedGarmentScopes,
    toggleGarmentScope,
    brandModels,
    selectedBrandModelIds,
    selectBrandModel,
    handleAddCustomModel,
    handleUpdateBrandModel,
    handleRemoveCustomModel,
    isCustomBrandModel,
    displayTemplates,
    selectedTemplateIds,
    toggleDisplayTemplate,
    handleAddTextTemplate,
    handleRemoveDisplayTemplate,
    handleCustomStagingUpload,
    customDestinations,
    handleCustomDestinationsUpload,
    packItems,
    isGenerating,
    handleGeneratePack,
    handleGenerateCategory,
    handleRegeneratePackItem,
    handleUpscale,
    handleRefine,
    handleDownloadAll,
    refinePrompts,
    setRefinePrompts,
    isRefining,
    upscalingStates,
  } = ecomPack;

  const [isAddingModel, setIsAddingModel] = React.useState(false);
  const [editingModelId, setEditingModelId] = React.useState<string | null>(null);
  const [newModelName, setNewModelName] = React.useState('');
  const [newModelFace, setNewModelFace] = React.useState<ImageFile | null>(null);
  const [newModelBody, setNewModelBody] = React.useState<ImageFile | null>(null);
  const [newModelAge, setNewModelAge] = React.useState('22');
  const [newModelHeight, setNewModelHeight] = React.useState('1m65');
  const [newModelWeight, setNewModelWeight] = React.useState('48kg');
  const [newModelSkinTone, setNewModelSkinTone] = React.useState('natural skin tone');
  const [newModelBodyType, setNewModelBodyType] = React.useState('natural build from body reference');
  const [newModelFacialFeatures, setNewModelFacialFeatures] = React.useState('natural features from face reference');
  const [newModelStyleVibe, setNewModelStyleVibe] = React.useState('');
  const [showTextTemplateForm, setShowTextTemplateForm] = React.useState(false);
  const [textTemplateName, setTextTemplateName] = React.useState('');
  const [textTemplatePrompt, setTextTemplatePrompt] = React.useState('');
  const [textTemplateCategory, setTextTemplateCategory] = React.useState<DisplayTemplateCategory>('flat-lay');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [showBlueprint, setShowBlueprint] = React.useState(false);

  const resetModelForm = () => {
    setEditingModelId(null);
    setNewModelName('');
    setNewModelFace(null);
    setNewModelBody(null);
    setNewModelAge('22');
    setNewModelHeight('1m65');
    setNewModelWeight('48kg');
    setNewModelSkinTone('natural skin tone');
    setNewModelBodyType('natural build from body reference');
    setNewModelFacialFeatures('natural features from face reference');
    setNewModelStyleVibe('');
    setFormError(null);
  };

  const openEditModel = (modelId: string) => {
    const model = brandModels.find((item) => item.id === modelId);
    if (!model) return;
    setEditingModelId(model.id);
    setNewModelName(model.name);
    setNewModelFace(model.faceImage);
    setNewModelBody(model.bodyImage);
    setNewModelAge(String(model.metadata.age));
    setNewModelHeight(model.metadata.height);
    setNewModelWeight(model.metadata.weight);
    setNewModelSkinTone(model.metadata.skinTone);
    setNewModelBodyType(model.metadata.bodyType);
    setNewModelFacialFeatures(model.metadata.facialFeatures);
    setNewModelStyleVibe(model.metadata.styleVibe);
    setFormError(null);
    setIsAddingModel(true);
  };

  const handleSaveModel = () => {
    if (!newModelName.trim() || !newModelFace || !newModelBody) {
      setFormError(t('clothingTransfer.ecomPack.customModelForm.nameRequiredError'));
      return;
    }
    const profile = {
      name: newModelName.trim(),
      faceImage: newModelFace,
      bodyImage: newModelBody,
      metadata: {
        age: Number(newModelAge) || 22,
        height: newModelHeight.trim() || '1m65',
        weight: newModelWeight.trim() || '48kg',
        bodyType: newModelBodyType.trim() || 'natural build from body reference',
        skinTone: newModelSkinTone.trim() || 'natural skin tone',
        facialFeatures: newModelFacialFeatures.trim() || 'natural features from face reference',
        styleVibe: newModelStyleVibe.trim(),
      },
    };
    if (editingModelId) {
      handleUpdateBrandModel(editingModelId, profile);
    } else {
      handleAddCustomModel(profile);
    }
    resetModelForm();
    setIsAddingModel(false);
  };

  const productItems = packItems.filter((it) => it.category === 'product');
  const brandModelItems = packItems.filter((it) => it.category === 'brand-models');
  const customItems = packItems.filter((it) => it.category === 'custom-destinations');
  const customHangerImages = displayTemplates
    .filter((template) => template.modality === 'image' && template.category === 'hanger' && template.image)
    .map((template) => template.image as ImageFile);
  const customFlatLayImages = displayTemplates
    .filter((template) => template.modality === 'image' && template.category === 'flat-lay' && template.image)
    .map((template) => template.image as ImageFile);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(520px,0.95fr)_minmax(0,1.05fr)] xl:items-start">
      {/* LEFT COLUMN: Input & Target Configurations */}
      <div className="flex min-w-0 flex-col gap-6">
        {/* 1. Source Outfit & Garment Scope */}
        <section className="workspace-stage rounded-[2rem] p-5 sm:p-6">
          <div className="mb-4">
            <p className="workspace-label mb-1">{t('clothingTransfer.ecomPack.sourceTitle')}</p>
            <p className="text-sm leading-6 text-zinc-400">{t('clothingTransfer.ecomPack.sourceHint')}</p>
          </div>

          <div className="grid grid-cols-1 gap-5">
            <div className="workspace-panel rounded-[1.5rem] p-5">
              <ImageUploader
                image={sourceOutfitImage}
                id="source-outfit-uploader"
                title="Outfit Gốc"
                onImageUpload={setSourceOutfitImage}
              />
              {sourceOutfitImage && (
                <div className="mt-3">
                  {isAnalyzingOutfit && (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-300">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                      </span>
                      <span>{t('clothingTransfer.ecomPack.blueprintAnalyzing')}</span>
                    </div>
                  )}
                  {!isAnalyzingOutfit && outfitBlueprint && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-emerald-400 font-medium">
                          <span>✨</span>
                          <span>{t('clothingTransfer.ecomPack.blueprintReady')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowBlueprint(!showBlueprint)}
                            className="text-zinc-400 hover:text-white transition-colors underline text-[11px]"
                          >
                            {showBlueprint
                              ? t('clothingTransfer.ecomPack.blueprintHide')
                              : t('clothingTransfer.ecomPack.blueprintView')}
                          </button>
                          <button
                            type="button"
                            onClick={handleReanalyzeOutfit}
                            disabled={isAnalyzingOutfit}
                            className="text-zinc-400 hover:text-amber-400 transition-colors text-xs ml-1"
                            title={t('clothingTransfer.ecomPack.blueprintReanalyze')}
                          >
                            🔄
                          </button>
                        </div>
                      </div>
                      {showBlueprint && (
                        <div className="mt-2.5 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed text-zinc-300">
                          {outfitBlueprint}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Garment Scope Selector */}
            <div className="workspace-panel rounded-[1.5rem] p-4">
              <p className="workspace-label mb-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {t('clothingTransfer.ecomPack.garmentScopeLabel')}
              </p>
              <div className="flex flex-wrap gap-2">
                {GARMENT_SCOPES.map((scope) => {
                  const isSelected = selectedGarmentScopes.includes(scope.id);
                  return (
                    <button
                      key={scope.id}
                      type="button"
                      onClick={() => toggleGarmentScope(scope.id)}
                      className={`rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-amber-500 text-black shadow-md font-semibold ring-2 ring-amber-500/50'
                          : 'border border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/20 hover:bg-white/[0.08]'
                      }`}
                    >
                      {t(scope.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 2. Product Staging */}
        <section className="workspace-stage rounded-[2rem] p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h4 className="workspace-title text-lg font-medium text-white">
                {t('clothingTransfer.ecomPack.productStagingTitle')}
              </h4>
              <p className="text-xs leading-5 text-zinc-400">
                {t('clothingTransfer.ecomPack.productStagingHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleGenerateCategory('product')}
              disabled={isGenerating || !sourceOutfitImage || selectedTemplateIds.length === 0}
              className="workspace-button shrink-0 px-3 py-2 text-xs disabled:opacity-50"
            >
              {t('clothingTransfer.ecomPack.generateProduct')}
            </button>
          </div>

          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            {displayTemplates.map((template) => {
              const selected = selectedTemplateIds.includes(template.id);
              const isCustom = template.id.startsWith('custom-');
              return (
                <div
                  key={template.id}
                  className={'flex items-center gap-2 rounded-xl border p-3 ' + (
                    selected ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/10 bg-black/25'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleDisplayTemplate(template.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-medium text-white">{template.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {template.category === 'hanger' ? 'Hanger' : 'Flat Lay'} · {template.modality === 'image' ? 'Image' : 'Text'}
                    </p>
                  </button>
                  {isCustom && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDisplayTemplate(template.id)}
                      className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-red-400"
                      aria-label={t('common.delete')}
                    >
                      <DeleteIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-xs font-medium text-zinc-300">
                {t('clothingTransfer.ecomPack.customImageTemplate')} · Hanger
              </p>
              <MultiImageUploader
                images={customHangerImages}
                id="custom-hanger-staging-uploader"
                title={t('clothingTransfer.ecomPack.productStagingTitle')}
                hideTitle
                maxImages={4}
                onImagesUpload={(files) => handleCustomStagingUpload(files, 'hanger')}
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-xs font-medium text-zinc-300">
                {t('clothingTransfer.ecomPack.customImageTemplate')} · Flat Lay
              </p>
              <MultiImageUploader
                images={customFlatLayImages}
                id="custom-flat-lay-staging-uploader"
                title={t('clothingTransfer.ecomPack.productStagingTitle')}
                hideTitle
                maxImages={4}
                onImagesUpload={(files) => handleCustomStagingUpload(files, 'flat-lay')}
              />
            </div>
          </div>

          {showTextTemplateForm ? (
            <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={textTemplateName}
                  onChange={(event) => setTextTemplateName(event.target.value)}
                  placeholder={t('clothingTransfer.ecomPack.textTemplateName')}
                  className="workspace-input px-3 py-2 text-sm"
                />
                <select
                  value={textTemplateCategory}
                  onChange={(event) => setTextTemplateCategory(event.target.value as DisplayTemplateCategory)}
                  className="workspace-input px-3 py-2 text-sm"
                >
                  <option value="hanger">Hanger</option>
                  <option value="flat-lay">Flat Lay</option>
                </select>
              </div>
              <textarea
                value={textTemplatePrompt}
                onChange={(event) => setTextTemplatePrompt(event.target.value)}
                placeholder={t('clothingTransfer.ecomPack.textTemplatePrompt')}
                className="workspace-input min-h-20 w-full px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowTextTemplateForm(false)} className="workspace-button px-3 py-2 text-xs">
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={!textTemplateName.trim() || !textTemplatePrompt.trim()}
                  onClick={() => {
                    handleAddTextTemplate({
                      name: textTemplateName,
                      category: textTemplateCategory,
                      prompt: textTemplatePrompt,
                    });
                    setTextTemplateName('');
                    setTextTemplatePrompt('');
                    setShowTextTemplateForm(false);
                  }}
                  className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-black disabled:opacity-50"
                >
                  {t('clothingTransfer.ecomPack.saveTextTemplate')}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowTextTemplateForm(true)} className="workspace-button w-full px-3 py-2 text-xs">
              {t('clothingTransfer.ecomPack.addTextTemplate')}
            </button>
          )}
        </section>

        {/* 3. Brand Models */}
        <section className="workspace-stage rounded-[2rem] p-5 sm:p-6">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h4 className="workspace-title text-lg font-medium text-white">
                {t('clothingTransfer.ecomPack.brandModelsTitle')}
              </h4>
              <p className="text-xs leading-5 text-zinc-400">
                {t('clothingTransfer.ecomPack.brandModelsHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleGenerateCategory('brand-models')}
              disabled={isGenerating || !sourceOutfitImage || selectedBrandModelIds.length === 0}
              className="workspace-button shrink-0 px-3 py-2 text-xs disabled:opacity-50"
            >
              {t('clothingTransfer.ecomPack.generateBrandModels')}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {brandModels.map((model) => {
              const isSelected = selectedBrandModelIds.includes(model.id);
              const isCustom = isCustomBrandModel(model.id);

              return (
                <div
                  key={model.id}
                  className={`group relative flex items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-all ${
                    isSelected
                      ? 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/40'
                      : 'border-white/10 bg-black/25 hover:border-white/20'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectBrandModel(model.id)}
                    className="flex flex-1 items-center gap-3.5 text-left min-w-0"
                  >
                    {model.faceImage ? (
                      <img
                        src={`data:${model.faceImage.mimeType};base64,${model.faceImage.base64}`}
                        alt={model.name}
                        className="h-14 w-14 rounded-full object-cover ring-2 ring-white/10 shrink-0"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-base font-bold text-zinc-300 shrink-0">
                        {model.name[0]}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white truncate">{model.name}</p>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                            isCustom
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {isCustom ? t('clothingTransfer.ecomPack.customBadge') : t('clothingTransfer.ecomPack.defaultBadge')}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {model.metadata.age} tuổi · {model.metadata.height}
                      </p>
                    </div>
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border shrink-0 transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500 text-black shadow-sm'
                          : 'border-white/20 bg-transparent'
                      }`}
                    >
                      {isSelected && <div className="h-2 w-2 rounded-full bg-black" />}
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModel(model.id);
                      }}
                      className="rounded-lg px-2 py-1.5 text-[10px] text-zinc-400 hover:bg-white/10 hover:text-white transition-all"
                      title={t('clothingTransfer.ecomPack.editModel')}
                    >
                      {t('clothingTransfer.ecomPack.editModel')}
                    </button>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCustomModel(model.id);
                        }}
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-red-400 transition-all"
                        title={t('common.delete')}
                      >
                        <DeleteIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add Custom Model Button */}
            <button
              type="button"
              onClick={() => {
                resetModelForm();
                setIsAddingModel(true);
              }}
              className="flex items-center justify-center gap-2.5 rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-4 text-center text-zinc-400 hover:border-amber-500/50 hover:bg-white/[0.05] hover:text-white transition-all min-h-[82px]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                <AddIcon className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold">{t('clothingTransfer.ecomPack.addCustomModel')}</span>
            </button>
          </div>
        </section>

        {/* 4. Custom Destinations */}
        <section className="workspace-stage rounded-[2rem] p-5 sm:p-6">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h4 className="workspace-title text-lg font-medium text-white">
                {t('clothingTransfer.ecomPack.customDestinationsTitle')}
              </h4>
              <p className="text-xs leading-5 text-zinc-400">
                {t('clothingTransfer.ecomPack.customDestinationsHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleGenerateCategory('custom-destinations')}
              disabled={isGenerating || !sourceOutfitImage || customDestinations.length === 0}
              className="workspace-button shrink-0 px-3 py-2 text-xs disabled:opacity-50"
            >
              {t('clothingTransfer.ecomPack.generateDestinations')}
            </button>
          </div>
          <MultiImageUploader
            images={customDestinations}
            id="custom-destinations-uploader"
            title={t('clothingTransfer.ecomPack.customDestinationsTitle')}
            hideTitle
            maxImages={4}
            onImagesUpload={handleCustomDestinationsUpload}
          />
        </section>

        {/* Action Panel & Generation Trigger */}
        <section className="workspace-panel space-y-4 rounded-[2rem] p-5 sm:p-6">
          {isGptImageStudio ? (
            <GptImageOptionsPanel
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
            />
          ) : isLocalQwen ? null : (
            <ImageOptionsPanel
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              resolution={resolution}
              setResolution={setResolution}
              model={imageEditModel}
            />
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGeneratePack}
            disabled={isGenerating || !sourceOutfitImage}
            className="brand-button flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold text-black shadow-lg transition-all hover:scale-[1.01] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Spinner className="h-5 w-5" />
                <span>{t('clothingTransfer.ecomPack.generatingStatus')}</span>
              </>
            ) : (
              <span>{t('clothingTransfer.ecomPack.generateButton')}</span>
            )}
          </button>
        </section>
      </div>

      {/* RIGHT COLUMN: Output Live Cards */}
      <div className="workspace-stage flex min-w-0 flex-col gap-6 rounded-[2rem] p-5 sm:p-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h4 className="workspace-title text-xl font-medium text-white">
            {t('clothingTransfer.batchResultsTitle')}
          </h4>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-zinc-400">
              {packItems.filter((i) => i.status === 'completed').length} / {packItems.length} hoàn tất
            </span>
            <button
              type="button"
              onClick={() => void handleDownloadAll()}
              disabled={!packItems.some((item) => item.status === 'completed' && item.results.length > 0)}
              className="workspace-button px-3 py-1.5 text-xs disabled:opacity-40"
            >
              {t('clothingTransfer.ecomPack.downloadAll')}
            </button>
          </div>
        </div>

        {packItems.length === 0 ? (
          <div className="py-12">
            <ResultPlaceholder description={t('clothingTransfer.ecomPack.emptyResults')} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Group 1: Product Staging */}
            {productItems.length > 0 && (
              <div className="space-y-3">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  {t('clothingTransfer.ecomPack.sections.product')}
                </h5>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {productItems.map((item) => (
                    <PackResultCard
                      key={item.id}
                      item={item}
                      onRetry={() => handleRegeneratePackItem(item.id)}
                      onUpscale={(image, index, quality) => handleUpscale(image, index, item.id, quality)}
                      onRefine={(image, index, prompt) => handleRefine(image, index, item.id, prompt)}
                      refinePrompts={refinePrompts}
                      setRefinePrompts={setRefinePrompts}
                      isRefining={isRefining}
                      upscalingStates={upscalingStates}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Group 2: Brand Models */}
            {brandModelItems.length > 0 && (
              <div className="space-y-3">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  {t('clothingTransfer.ecomPack.sections.brandModels')}
                </h5>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {brandModelItems.map((item) => (
                    <PackResultCard
                      key={item.id}
                      item={item}
                      onRetry={() => handleRegeneratePackItem(item.id)}
                      onUpscale={(image, index, quality) => handleUpscale(image, index, item.id, quality)}
                      onRefine={(image, index, prompt) => handleRefine(image, index, item.id, prompt)}
                      refinePrompts={refinePrompts}
                      setRefinePrompts={setRefinePrompts}
                      isRefining={isRefining}
                      upscalingStates={upscalingStates}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Group 3: Custom Destinations */}
            {customItems.length > 0 && (
              <div className="space-y-3">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  {t('clothingTransfer.ecomPack.sections.customDestinations')}
                </h5>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {customItems.map((item) => (
                    <PackResultCard
                      key={item.id}
                      item={item}
                      onRetry={() => handleRegeneratePackItem(item.id)}
                      onUpscale={(image, index, quality) => handleUpscale(image, index, item.id, quality)}
                      onRefine={(image, index, prompt) => handleRefine(image, index, item.id, prompt)}
                      refinePrompts={refinePrompts}
                      setRefinePrompts={setRefinePrompts}
                      isRefining={isRefining}
                      upscalingStates={upscalingStates}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Add Custom Model Form */}
      {isAddingModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/15 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {editingModelId
                    ? t('clothingTransfer.ecomPack.customModelForm.editTitle')
                    : t('clothingTransfer.ecomPack.customModelForm.title')}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {t('clothingTransfer.ecomPack.brandModelsHint')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddingModel(false);
                  resetModelForm();
                }}
                className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-all"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              {/* Model Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  {t('clothingTransfer.ecomPack.customModelForm.nameLabel')} <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder={t('clothingTransfer.ecomPack.customModelForm.namePlaceholder')}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Images: Face + Body */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    {t('clothingTransfer.ecomPack.customModelForm.faceLabel')} <span className="text-amber-400">*</span>
                  </label>
                  <div className="h-44 rounded-xl border border-white/10 bg-black/30 p-2">
                    <ImageUploader
                      image={newModelFace}
                      id="new-model-face-uploader"
                      title={t('clothingTransfer.ecomPack.customModelForm.faceLabel')}
                      onImageUpload={setNewModelFace}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-zinc-500">
                    {t('clothingTransfer.ecomPack.customModelForm.faceHint')}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    {t('clothingTransfer.ecomPack.customModelForm.bodyLabel')} <span className="text-amber-400">*</span>
                  </label>
                  <div className="h-44 rounded-xl border border-white/10 bg-black/30 p-2">
                    <ImageUploader
                      image={newModelBody}
                      id="new-model-body-uploader"
                      title={t('clothingTransfer.ecomPack.customModelForm.bodyLabel')}
                      onImageUpload={setNewModelBody}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-zinc-500">
                    {t('clothingTransfer.ecomPack.customModelForm.bodyHint')}
                  </p>
                </div>
              </div>

              {/* Metadata Fields */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    {t('clothingTransfer.ecomPack.customModelForm.ageLabel')}
                  </label>
                  <input
                    type="number"
                    value={newModelAge}
                    onChange={(e) => setNewModelAge(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    {t('clothingTransfer.ecomPack.customModelForm.heightLabel')}
                  </label>
                  <input
                    type="text"
                    value={newModelHeight}
                    onChange={(e) => setNewModelHeight(e.target.value)}
                    placeholder="1m65"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    {t('clothingTransfer.ecomPack.customModelForm.weightLabel')}
                  </label>
                  <input
                    type="text"
                    value={newModelWeight}
                    onChange={(e) => setNewModelWeight(e.target.value)}
                    placeholder="48kg"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  {t('clothingTransfer.ecomPack.customModelForm.skinToneLabel')}
                </label>
                <input
                  type="text"
                  value={newModelSkinTone}
                  onChange={(e) => setNewModelSkinTone(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  {t('clothingTransfer.ecomPack.customModelForm.bodyTypeLabel')}
                </label>
                <textarea
                  value={newModelBodyType}
                  onChange={(e) => setNewModelBodyType(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  {t('clothingTransfer.ecomPack.customModelForm.facialFeaturesLabel')}
                </label>
                <textarea
                  value={newModelFacialFeatures}
                  onChange={(e) => setNewModelFacialFeatures(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  {t('clothingTransfer.ecomPack.customModelForm.styleVibeLabel')}
                </label>
                <textarea
                  value={newModelStyleVibe}
                  onChange={(e) => setNewModelStyleVibe(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {formError && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
                  {formError}
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsAddingModel(false);
                  resetModelForm();
                }}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-white/5 hover:text-white transition-all"
              >
                {t('clothingTransfer.ecomPack.customModelForm.cancelButton')}
              </button>
              <button
                type="button"
                onClick={handleSaveModel}
                className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-semibold text-black shadow-md hover:bg-amber-400 transition-all"
              >
                {t('clothingTransfer.ecomPack.customModelForm.saveButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PackResultCard: React.FC<{
  item: {
    id: string;
    title: string;
    subtitle?: string;
    status: string;
    results: ImageFile[];
    error?: string;
  };
  onRetry: () => void;
  onUpscale: (image: ImageFile, index: number, quality: UpscaleQuality) => Promise<void>;
  onRefine: (image: ImageFile, index: number, prompt: string) => Promise<void>;
  refinePrompts: Record<string, string>;
  setRefinePrompts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isRefining: Record<string, boolean>;
  upscalingStates: Record<string, boolean>;
}> = ({
  item,
  onRetry,
  onUpscale,
  onRefine,
  refinePrompts,
  setRefinePrompts,
  isRefining,
  upscalingStates,
}) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-3.5 transition-all hover:border-white/20">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">{item.title}</p>
          {item.subtitle && <p className="text-[11px] text-zinc-400">{item.subtitle}</p>}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            item.status === 'completed'
              ? 'bg-emerald-500/10 text-emerald-400'
              : item.status === 'processing'
              ? 'bg-amber-500/10 text-amber-400'
              : item.status === 'error'
              ? 'bg-red-500/10 text-red-400'
              : 'bg-zinc-500/10 text-zinc-400'
          }`}
        >
          {item.status}
        </span>
      </div>

      <div className="w-full">
        {item.status === 'processing' && (
          <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-black/40">
            <Spinner className="h-6 w-6 text-amber-400" />
          </div>
        )}

        {item.status === 'error' && (
          <div className="flex aspect-[3/4] w-full flex-col items-center justify-center rounded-xl bg-black/40 p-4 text-center">
            <p className="mb-2 text-xs text-red-400">{item.error || 'Lỗi tạo ảnh'}</p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white hover:bg-white/10"
            >
              Thử lại
            </button>
          </div>
        )}

        {item.status === 'completed' && item.results.length > 0 && (
          <div className="space-y-3">
            {item.results.map((resultImage, index) => {
              const key = item.id + ':' + index;
              const prompt = refinePrompts[key] || '';
              return (
                <div key={key} className="space-y-2">
                  <HoverableImage
                    image={resultImage}
                    altText={item.title}
                    onRegenerate={onRetry}
                    isUpscaling={Boolean(upscalingStates[key])}
                    containerClassName="aspect-[3/4] w-full overflow-hidden rounded-xl bg-black/40"
                  />
                  <div className="flex justify-end gap-2">
                    {(['2K', '4K'] as UpscaleQuality[]).map((quality) => (
                      <button
                        key={quality}
                        type="button"
                        onClick={() => void onUpscale(resultImage, index, quality)}
                        disabled={Boolean(upscalingStates[key])}
                        className="workspace-button px-3 py-1.5 text-[11px] disabled:opacity-50"
                      >
                        {t('imageActions.upscale')} {quality}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={prompt}
                      onChange={(event) => setRefinePrompts((prev) => ({ ...prev, [key]: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && prompt.trim()) {
                          void onRefine(resultImage, index, prompt);
                        }
                      }}
                      placeholder={t('imageActions.refinePromptPlaceholder')}
                      className="workspace-input min-w-0 flex-1 px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void onRefine(resultImage, index, prompt)}
                      disabled={Boolean(isRefining[key]) || !prompt.trim()}
                      className="workspace-button px-3 py-2 text-xs disabled:opacity-50"
                    >
                      {isRefining[key] ? <Spinner className="h-4 w-4" /> : t('imageActions.refineButton')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EComPackView;
