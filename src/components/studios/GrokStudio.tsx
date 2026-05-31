import React from 'react';
import { Feature, StudioMode } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useGrokStudio } from '../../hooks/useGrokStudio';
import MultiImageUploader from '../MultiImageUploader';
import Spinner, { ErrorDisplay } from '../Spinner';
import ProviderSettingsPanel from './provider-studio/ProviderSettingsPanel';
import ProviderResultsGrid from './provider-studio/ProviderResultsGrid';
import ProviderSourceFields from './provider-studio/ProviderSourceFields';
import { getProviderWorkflow } from './provider-studio/providerWorkflows';

interface GrokStudioProps {
  activeFeature: Feature;
  studioMode: StudioMode;
}

/**
 * Grok provider studio. Renders its own complete content area (no Gemini
 * workspace header). Supports the five provider workflows through a unified
 * prompt + image input, dispatching to generate or edit in the hook.
 */
const GrokStudio: React.FC<GrokStudioProps> = ({ activeFeature, studioMode }) => {
  const { t } = useLanguage();
  const studio = useGrokStudio(activeFeature, studioMode);
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
            {t('studio.switch.grok')}
          </p>
          <h2 className="text-3xl font-medium tracking-[-0.04em] text-zinc-50">
            {t(workflow.titleKey)}
          </h2>
          <p className="max-w-xl text-base leading-7 text-zinc-300">
            {t(workflow.descriptionKey)}
          </p>
        </div>

        <ProviderSettingsPanel
          providerLabel={t('studio.switch.grok')}
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
              id="grok-studio-upload"
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
          idPrefix="grok"
          sourceItemTypes={studio.sourceItemTypes}
          setSourceItemType={studio.setSourceItemType}
          sourceItemNotes={studio.sourceItemNotes}
          setSourceItemNote={studio.setSourceItemNote}
          backgroundPrompt={studio.backgroundPrompt}
          setBackgroundPrompt={studio.setBackgroundPrompt}
          extraInstructions={studio.extraInstructions}
          setExtraInstructions={studio.setExtraInstructions}
        />

        <div className="flex flex-col gap-2">
          <label htmlFor="grok-prompt" className="text-sm font-medium text-zinc-300">
            {t('studio.workflows.promptLabel')}
          </label>
          <textarea
            id="grok-prompt"
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
            <label htmlFor="grok-model" className="text-sm font-medium text-zinc-300">
              {t('studio.workflows.modelLabel')}
            </label>
            <select
              id="grok-model"
              value={studio.model}
              onChange={(e) => studio.setModel(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
            >
              {studio.modelOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="grok-aspect" className="text-sm font-medium text-zinc-300">
              {t('studio.workflows.aspectRatioLabel')}
            </label>
            <select
              id="grok-aspect"
              value={studio.aspectRatio}
              onChange={(e) => studio.setAspectRatio(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
            >
              {studio.aspectRatioOptions.map((ratio) => (
                <option key={ratio} value={ratio}>
                  {ratio}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="grok-resolution" className="text-sm font-medium text-zinc-300">
              {t('studio.workflows.resolutionLabel')}
            </label>
            <select
              id="grok-resolution"
              value={studio.resolution}
              onChange={(e) => studio.setResolution(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
            >
              {studio.resolutionOptions.map((res) => (
                <option key={res} value={res}>
                  {res.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="grok-n" className="text-sm font-medium text-zinc-300">
              {t('studio.workflows.outputCountLabel', { count: studio.n })}
            </label>
            <input
              id="grok-n"
              type="range"
              min={studio.minOutputs}
              max={studio.maxOutputs}
              step={1}
              value={studio.n}
              onChange={(e) => studio.setN(Number(e.target.value))}
              className="w-full accent-white"
            />
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
          <ProviderResultsGrid results={studio.results} downloadPrefix="grok" />
        )}
      </div>
    </div>
  );
};

export default GrokStudio;
