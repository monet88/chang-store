import React from 'react';
import { Feature, StudioMode } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useGptImageStudio } from '../../hooks/useGptImageStudio';
import MultiImageUploader from '../MultiImageUploader';
import Spinner, { ErrorDisplay } from '../Spinner';
import ProviderSettingsPanel from './provider-studio/ProviderSettingsPanel';
import ProviderResultsGrid from './provider-studio/ProviderResultsGrid';
import ProviderSourceFields from './provider-studio/ProviderSourceFields';
import ProviderTryOnExtras from './provider-studio/ProviderTryOnExtras';
import { getProviderWorkflow } from './provider-studio/providerWorkflows';

interface GptImageStudioProps {
  activeFeature: Feature;
  studioMode: StudioMode;
}

/**
 * GPT Image provider studio. Renders its own complete content area. Supports the
 * five provider workflows via a unified prompt + image input that dispatches to
 * JSON generation or multipart edit in the hook.
 */
const GptImageStudio: React.FC<GptImageStudioProps> = ({ activeFeature, studioMode }) => {
  const { t } = useLanguage();
  const studio = useGptImageStudio(activeFeature, studioMode);
  const workflow = getProviderWorkflow(activeFeature);

  const submitDisabled =
    studio.isLoading ||
    !studio.apiKey ||
    (workflow.requiresImages && studio.images.length === 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:gap-8 items-start pb-12">
      {/* Left: controls */}
      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            {t('studio.switch.gptImage')}
          </p>
          <h2 className="text-3xl font-medium tracking-[-0.04em] text-zinc-50">
            {t(workflow.titleKey)}
          </h2>
          <p className="max-w-xl text-base leading-7 text-zinc-300">
            {t(workflow.descriptionKey)}
          </p>
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            {t('studio.workflows.slowResponseWarning')}
          </p>
        </div>

        <ProviderSettingsPanel
          providerLabel={t('studio.switch.gptImage')}
          apiKey={studio.apiKey}
          baseUrl={studio.baseUrl}
          onApiKeyChange={studio.setApiKey}
          onBaseUrlChange={studio.setBaseUrl}
          onReset={studio.resetSettings}
        />

        {workflow.acceptsImages && (
          <div className="workspace-panel p-5">
            <MultiImageUploader
              images={studio.images}
              onImagesUpload={studio.setImages}
              title={t(workflow.uploadLabelKey)}
              id="gpt-image-studio-upload"
              maxImages={studio.maxReferenceImages}
            />
            <p className="mt-2 text-xs text-zinc-500">
              {t('studio.workflows.maxReferenceHint', { max: studio.maxReferenceImages })}
            </p>
          </div>
        )}

        <ProviderSourceFields
          workflow={workflow}
          images={studio.images}
          idPrefix="gpt-image"
          sourceItemTypes={studio.sourceItemTypes}
          setSourceItemType={studio.setSourceItemType}
          sourceItemNotes={studio.sourceItemNotes}
          setSourceItemNote={studio.setSourceItemNote}
          backgroundPrompt={studio.backgroundPrompt}
          setBackgroundPrompt={studio.setBackgroundPrompt}
          extraInstructions={studio.extraInstructions}
          setExtraInstructions={studio.setExtraInstructions}
        />

        {activeFeature === Feature.TryOn && (
          <ProviderTryOnExtras
            idPrefix="gpt-image"
            subjectImage={studio.images[0] ?? null}
            maxReferenceImages={studio.maxReferenceImages}
            isMultiPersonMode={studio.isMultiPersonMode}
            setIsMultiPersonMode={studio.setIsMultiPersonMode}
            markerPosition={studio.markerPosition}
            setMarkerPosition={studio.setMarkerPosition}
            clearMarker={studio.clearMarker}
            batchSubjects={studio.batchSubjects}
            setBatchSubjects={studio.setBatchSubjects}
            batchItems={studio.batchItems}
            batchCompletedCount={studio.batchCompletedCount}
            batchFailedCount={studio.batchFailedCount}
          />
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="gpt-prompt" className="text-sm font-medium text-zinc-300">
            {t('studio.workflows.promptLabel')}
          </label>
          <textarea
            id="gpt-prompt"
            value={studio.prompt}
            onChange={(e) => studio.setPrompt(e.target.value)}
            rows={3}
            placeholder={t(workflow.promptPlaceholderKey)}
            className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
          />
        </div>

        {/* Generation options */}
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-zinc-900/40 p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="gpt-quality" className="text-sm font-medium text-zinc-300">
              {t('studio.workflows.qualityLabel')}
            </label>
            <select
              id="gpt-quality"
              value={studio.quality}
              onChange={(e) => studio.setQuality(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
            >
              {studio.qualityOptions.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="gpt-size" className="text-sm font-medium text-zinc-300">
              {t('studio.workflows.sizeLabel')}
            </label>
            <select
              id="gpt-size"
              value={studio.size}
              onChange={(e) => studio.setSize(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
            >
              {studio.sizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={studio.handleGenerate}
            disabled={submitDisabled}
            className="brand-button"
          >
            {studio.isLoading ? <Spinner /> : t('studio.workflows.generateButton')}
          </button>
          {!studio.apiKey && (
            <p className="mt-2 text-xs text-amber-400">{t('error.provider.missingApiKey')}</p>
          )}
        </div>
      </div>

      {/* Right: results */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-8">
        {studio.isLoading && (
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-zinc-900/50">
            <Spinner />
            <p className="text-zinc-400">{t('studio.workflows.generatingStatus')}</p>
            <p className="text-xs text-zinc-500">{t('studio.workflows.slowResponseWarning')}</p>
          </div>
        )}

        {!studio.isLoading && studio.error && (
          <ErrorDisplay
            title={t('common.generationFailed')}
            message={studio.error}
            onClear={studio.clearError}
          />
        )}

        {!studio.isLoading && !studio.error && studio.results.length === 0 && (
          <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/50 p-6 text-center text-zinc-400">
            {t('studio.provider.results.empty')}
          </div>
        )}

        {!studio.isLoading && studio.results.length > 0 && (
          <ProviderResultsGrid
            results={studio.results}
            downloadPrefix="gpt-image"
            showActions
            busyIndex={studio.busyIndex}
            onRefine={studio.refine}
            onUpscale={studio.upscale}
            onRegenerate={studio.regenerate}
          />
        )}
        {studio.actionError && (
          <ErrorDisplay
            title={t('common.generationFailed')}
            message={studio.actionError}
            onClear={studio.clearActionError}
          />
        )}
      </div>
    </div>
  );
};

export default GptImageStudio;
