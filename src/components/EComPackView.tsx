import React from 'react';
import ImageUploader from './ImageUploader';
import MultiImageUploader from './MultiImageUploader';
import Spinner from './Spinner';
import HoverableImage from './HoverableImage';
import ImageOptionsPanel from './ImageOptionsPanel';
import ResultPlaceholder from './shared/ResultPlaceholder';
import { AddIcon, DeleteIcon, CloseIcon } from './Icons';
import { isCustomBrandModel } from '../config/brandModelRoster';
import { AspectRatio, GarmentScope, ImageFile, ImageResolution } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { UseClothingTransferEComPackReturn } from '../hooks/useClothingTransferEComPack';

interface EComPackViewProps {
  ecomPack: UseClothingTransferEComPackReturn;
  aspectRatio: AspectRatio;
  setAspectRatio: (ar: AspectRatio) => void;
  resolution: ImageResolution;
  setResolution: (res: ImageResolution) => void;
  imageEditModel: string;
  error: string | null;
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
}) => {
  const { t } = useLanguage();
  const {
    sourceOutfitImage,
    setSourceOutfitImage,
    garmentScope,
    setGarmentScope,
    brandModels,
    selectedBrandModelId,
    selectBrandModel,
    handleAddCustomModel,
    handleRemoveCustomModel,
    displayTemplates,
    selectedTemplateIds,
    toggleDisplayTemplate,
    customStagingImages,
    handleCustomStagingUpload,
    handleRemoveCustomStaging,
    customDestinations,
    handleCustomDestinationsUpload,
    packItems,
    isGenerating,
    handleGeneratePack,
    handleRegeneratePackItem,
  } = ecomPack;

  const [isAddingModel, setIsAddingModel] = React.useState(false);
  const [newModelName, setNewModelName] = React.useState('');
  const [newModelFace, setNewModelFace] = React.useState<ImageFile | null>(null);
  const [newModelBody, setNewModelBody] = React.useState<ImageFile | null>(null);
  const [newModelAge, setNewModelAge] = React.useState('22');
  const [newModelHeight, setNewModelHeight] = React.useState('1m65');
  const [formError, setFormError] = React.useState<string | null>(null);

  const handleSaveModel = () => {
    if (!newModelName.trim() || !newModelFace) {
      setFormError(t('clothingTransfer.ecomPack.customModelForm.nameRequiredError'));
      return;
    }
    handleAddCustomModel({
      name: newModelName.trim(),
      faceImage: newModelFace,
      bodyImage: newModelBody,
      metadata: {
        age: Number(newModelAge) || 22,
        height: newModelHeight.trim() || '1m65',
        weight: '48kg',
        bodyType: 'natural build from body reference',
        skinTone: 'natural skin tone',
        facialFeatures: 'natural features from face reference',
        styleVibe: '',
      },
    });
    setNewModelName('');
    setNewModelFace(null);
    setNewModelBody(null);
    setNewModelAge('22');
    setNewModelHeight('1m65');
    setFormError(null);
    setIsAddingModel(false);
  };

  const productItems = packItems.filter((it) => it.category === 'product');
  const brandModelItems = packItems.filter((it) => it.category === 'brand-models');
  const customItems = packItems.filter((it) => it.category === 'custom-destinations');

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
            </div>

            {/* Garment Scope Selector */}
            <div className="workspace-panel rounded-[1.5rem] p-4">
              <p className="workspace-label mb-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {t('clothingTransfer.ecomPack.garmentScopeLabel')}
              </p>
              <div className="flex flex-wrap gap-2">
                {GARMENT_SCOPES.map((scope) => {
                  const isSelected = garmentScope === scope.id;
                  return (
                    <button
                      key={scope.id}
                      type="button"
                      onClick={() => setGarmentScope(scope.id)}
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

        {/* 2. Product Staging (Hanger & Flat Lay) */}
        <section className="workspace-stage rounded-[2rem] p-5 sm:p-6">
          <div className="mb-3">
            <h4 className="workspace-title text-lg font-medium text-white">
              {t('clothingTransfer.ecomPack.productStagingTitle')}
            </h4>
            <p className="text-xs leading-5 text-zinc-400">
              {t('clothingTransfer.ecomPack.productStagingHint')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {displayTemplates.map((tpl) => {
              const isSelected = selectedTemplateIds.includes(tpl.id);
              const isCustomStaging = tpl.id.startsWith('custom-staging-');
              const customIndex = isCustomStaging ? parseInt(tpl.id.replace('custom-staging-', ''), 10) : -1;

              return (
                <div
                  key={tpl.id}
                  className={`group relative flex items-center justify-between rounded-xl border p-3.5 transition-all ${
                    isSelected
                      ? 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/40'
                      : 'border-white/10 bg-black/25 hover:border-white/20'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleDisplayTemplate(tpl.id)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    {tpl.image ? (
                      <img
                        src={`data:${tpl.image.mimeType};base64,${tpl.image.base64}`}
                        alt={tpl.name}
                        className="h-11 w-11 rounded-lg object-cover ring-1 ring-white/10"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-100 truncate">{tpl.name}</p>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        {isCustomStaging ? t('clothingTransfer.ecomPack.customBadge') : tpl.category === 'hanger' ? 'Hanger' : 'Flat Lay'}
                      </span>
                    </div>
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs font-bold ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500 text-black'
                          : 'border-white/20 bg-transparent text-transparent'
                      }`}
                    >
                      ✓
                    </div>
                  </button>
                  {isCustomStaging && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCustomStaging(customIndex);
                      }}
                      className="ml-2 rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-red-400 transition-all"
                      title={t('common.delete')}
                    >
                      <DeleteIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Upload Custom Staging Images */}
          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="mb-2.5">
              <p className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                {t('clothingTransfer.ecomPack.customStagingUploadTitle')}
              </p>
              <p className="text-[11px] leading-4 text-zinc-400 mt-0.5">
                {t('clothingTransfer.ecomPack.customStagingUploadHint')}
              </p>
            </div>
            <MultiImageUploader
              images={customStagingImages}
              id="custom-staging-uploader"
              title={t('clothingTransfer.ecomPack.customStagingUploadTitle')}
              hideTitle
              maxImages={4}
              onImagesUpload={handleCustomStagingUpload}
            />
          </div>
        </section>

        {/* 3. Brand Models */}
        <section className="workspace-stage rounded-[2rem] p-5 sm:p-6">
          <div className="mb-3">
            <h4 className="workspace-title text-lg font-medium text-white">
              {t('clothingTransfer.ecomPack.brandModelsTitle')}
            </h4>
            <p className="text-xs leading-5 text-zinc-400">
              {t('clothingTransfer.ecomPack.brandModelsHint')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {brandModels.map((model) => {
              const isSelected = selectedBrandModelId === model.id;
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
              );
            })}

            {/* Add Custom Model Button */}
            <button
              type="button"
              onClick={() => setIsAddingModel(true)}
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
          <div className="mb-3">
            <h4 className="workspace-title text-lg font-medium text-white">
              {t('clothingTransfer.ecomPack.customDestinationsTitle')}
            </h4>
            <p className="text-xs leading-5 text-zinc-400">
              {t('clothingTransfer.ecomPack.customDestinationsHint')}
            </p>
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
          <ImageOptionsPanel
            aspectRatio={aspectRatio}
            setAspectRatio={setAspectRatio}
            resolution={resolution}
            setResolution={setResolution}
            model={imageEditModel}
          />

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
          <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-zinc-400">
            {packItems.filter((i) => i.status === 'completed').length} / {packItems.length} hoàn tất
          </span>
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
                  {t('clothingTransfer.ecomPack.customModelForm.title')}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {t('clothingTransfer.ecomPack.brandModelsHint')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddingModel(false);
                  setFormError(null);
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

              {/* Images: Face (required) and Body (optional) */}
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
                    {t('clothingTransfer.ecomPack.customModelForm.bodyLabel')}
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
              <div className="grid grid-cols-2 gap-3">
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
                  setFormError(null);
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
}> = ({ item, onRetry }) => {
  const resultImage = item.results[0];

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

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-black/40">
        {item.status === 'processing' && (
          <div className="flex h-full w-full items-center justify-center">
            <Spinner className="h-6 w-6 text-amber-400" />
          </div>
        )}

        {item.status === 'error' && (
          <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
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

        {item.status === 'completed' && resultImage && (
          <HoverableImage
            image={resultImage}
            altText={item.title}
            containerClassName="h-full w-full"
          />
        )}
      </div>
    </div>
  );
};

export default EComPackView;
