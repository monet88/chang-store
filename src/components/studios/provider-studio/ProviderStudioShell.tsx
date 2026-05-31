import React from 'react';
import { Feature } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import MultiImageUploader from '../../MultiImageUploader';
import Spinner, { ErrorDisplay } from '../../Spinner';
import ProviderSettingsPanel from './ProviderSettingsPanel';
import ProviderResultsGrid from './ProviderResultsGrid';
import ProviderSourceFields from './ProviderSourceFields';
import ProviderSourceItemGrid from './ProviderSourceItemGrid';
import ProviderTryOnExtras from './ProviderTryOnExtras';
import ProviderLookbookControls from './ProviderLookbookControls';
import ProviderWardrobePanel from './ProviderWardrobePanel';
import StepPanel from './StepPanel';
import { ProviderWorkflowConfig } from './providerWorkflows';
import { ProviderStudioController } from './provider-studio-controller';

interface ProviderStudioShellProps {
  studio: ProviderStudioController;
  workflow: ProviderWorkflowConfig;
  activeFeature: Feature;
  /** i18n key for the provider name (e.g. 'studio.switch.grok'). */
  providerLabelKey: string;
  /** Prefix for element ids + download filenames (e.g. 'grok', 'gpt-image'). */
  idPrefix: string;
  /** Provider-specific generation options block (Grok vs GPT differ here). */
  optionsSlot: React.ReactNode;
  /** Show the ~60-90s slow-response warning (GPT Image). */
  showSlowWarning?: boolean;
}

/**
 * Shared layout for both provider studios. Holds every piece of JSX that Grok
 * and GPT have in common; the only provider-specific surface is `optionsSlot`
 * (model/aspect/resolution/n vs quality/size) and the slow-response warning.
 */
const ProviderStudioShell: React.FC<ProviderStudioShellProps> = ({
  studio,
  workflow,
  activeFeature,
  providerLabelKey,
  idPrefix,
  optionsSlot,
  showSlowWarning = false,
}) => {
  const { t } = useLanguage();

  const submitDisabled =
    studio.isLoading ||
    studio.isBatchRunning ||
    studio.busyIndex !== null ||
    !studio.apiKey ||
    (workflow.requiresImages && studio.images.length === 0);

  // The Customize step shows only when the workflow exposes any customization
  // surface (source-item fields, background/extra, multi-person/batch, lookbook).
  const hasCustomizeStep =
    Boolean(
      workflow.hasSourceItemTypes ||
        workflow.hasSourceItemNotes ||
        workflow.hasBackgroundField ||
        workflow.hasExtraInstructionsField,
    ) ||
    activeFeature === Feature.TryOn ||
    activeFeature === Feature.Lookbook;

  // Source-item workflows (Try-On, Clothing Transfer) use per-item cards instead
  // of the flat MultiImageUploader.
  const hasSourceItems = Boolean(workflow.hasSourceItemTypes || workflow.hasSourceItemNotes);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:gap-8 items-start pb-12">
      {/* Left: controls */}
      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            {t(providerLabelKey)}
          </p>
          <h2 className="text-3xl font-medium tracking-[-0.04em] text-zinc-50">
            {t(workflow.titleKey)}
          </h2>
          <p className="max-w-xl text-base leading-7 text-zinc-300">
            {t(workflow.descriptionKey)}
          </p>
          {showSlowWarning && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              {t('studio.workflows.slowResponseWarning')}
            </p>
          )}
        </div>

        <ProviderSettingsPanel
          providerLabel={t(providerLabelKey)}
          apiKey={studio.apiKey}
          baseUrl={studio.baseUrl}
          onApiKeyChange={studio.setApiKey}
          onBaseUrlChange={studio.setBaseUrl}
          onReset={studio.resetSettings}
        />

        {activeFeature === Feature.TryOn && (
          <div className="flex gap-2 rounded-2xl border border-white/10 bg-zinc-900/40 p-1.5" role="tablist">
            {(['multi-model', 'wardrobe'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={studio.tryOnMode === mode}
                onClick={() => studio.setTryOnMode(mode)}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  studio.tryOnMode === mode
                    ? 'bg-white/[0.12] text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t(`studio.workflows.tryOnMode.${mode}`)}
              </button>
            ))}
          </div>
        )}

        {activeFeature === Feature.TryOn && studio.tryOnMode === 'wardrobe' ? (
          <StepPanel
            eyebrow={t('studio.workflows.wardrobe.eyebrow')}
            title={t('studio.workflows.wardrobe.title')}
            hint={t('studio.workflows.wardrobe.hint')}
          >
            <ProviderWardrobePanel
              wardrobe={studio.wardrobe}
              idPrefix={idPrefix}
              isParentBusy={studio.isLoading || studio.isBatchRunning}
              onGenerate={() => studio.wardrobe.generate()}
              showSlowWarning={showSlowWarning}
            />
          </StepPanel>
        ) : (
          <>
        {workflow.acceptsImages && (
          <StepPanel
            eyebrow={t('studio.workflows.steps.uploadEyebrow')}
            title={t('studio.workflows.steps.uploadTitle')}
            hint={t(workflow.uploadLabelKey)}
          >
            {hasSourceItems ? (
              <ProviderSourceItemGrid
                idPrefix={idPrefix}
                images={studio.images}
                subjectLabelKey={workflow.uploadLabelKey}
                maxImages={studio.maxReferenceImages}
                showType={Boolean(workflow.hasSourceItemTypes)}
                showNote={Boolean(workflow.hasSourceItemNotes)}
                sourceItemTypes={studio.sourceItemTypes}
                sourceItemNotes={studio.sourceItemNotes}
                onSetSubject={(image) => studio.setSubjectImage(studio.images, studio.setImages, image)}
                onAddItem={(image) => studio.addSourceItem(studio.images, studio.setImages, image)}
                onRemoveItem={(index) => studio.removeSourceItem(studio.images, studio.setImages, index)}
                onReplaceItem={(index, image) => studio.updateSourceItem(studio.images, studio.setImages, index, image)}
                onTypeChange={studio.setSourceItemType}
                onNoteChange={studio.setSourceItemNote}
              />
            ) : (
              <>
                <MultiImageUploader
                  images={studio.images}
                  onImagesUpload={studio.setImages}
                  title={t(workflow.uploadLabelKey)}
                  id={`${idPrefix}-studio-upload`}
                  maxImages={studio.maxReferenceImages}
                />
                <p className="text-xs text-zinc-500">
                  {t('studio.workflows.maxReferenceHint', { max: studio.maxReferenceImages })}
                </p>
              </>
            )}
          </StepPanel>
        )}

        {hasCustomizeStep && (
          <StepPanel
            eyebrow={t('studio.workflows.steps.customizeEyebrow')}
            title={t('studio.workflows.steps.customizeTitle')}
          >
            <ProviderSourceFields
              workflow={workflow}
              idPrefix={idPrefix}
              backgroundPrompt={studio.backgroundPrompt}
              setBackgroundPrompt={studio.setBackgroundPrompt}
              extraInstructions={studio.extraInstructions}
              setExtraInstructions={studio.setExtraInstructions}
            />

            {activeFeature === Feature.TryOn && (
              <ProviderTryOnExtras
                idPrefix={idPrefix}
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

            {activeFeature === Feature.Lookbook && (
              <ProviderLookbookControls
                idPrefix={idPrefix}
                state={studio.lookbookState}
                onChange={studio.setLookbookField}
                fabricImage={studio.lookbookFabricImage}
                setFabricImage={studio.setLookbookFabricImage}
              />
            )}
          </StepPanel>
        )}

        <StepPanel
          eyebrow={t('studio.workflows.steps.generateEyebrow')}
          title={t('studio.workflows.steps.generateTitle')}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor={`${idPrefix}-prompt`} className="text-sm font-medium text-zinc-300">
              {t('studio.workflows.promptLabel')}
            </label>
            <textarea
              id={`${idPrefix}-prompt`}
              value={studio.prompt}
              onChange={(e) => studio.setPrompt(e.target.value)}
              rows={3}
              placeholder={t(workflow.promptPlaceholderKey)}
              className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
            />
          </div>

          {optionsSlot}

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
        </StepPanel>
          </>
        )}
      </div>

      {/* Right: results */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-8">
        {studio.isLoading && (
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-zinc-900/50">
            <Spinner />
            <p className="text-zinc-400">{t('studio.workflows.generatingStatus')}</p>
            {showSlowWarning && (
              <p className="text-xs text-zinc-500">{t('studio.workflows.slowResponseWarning')}</p>
            )}
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
            downloadPrefix={idPrefix}
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

export default ProviderStudioShell;
