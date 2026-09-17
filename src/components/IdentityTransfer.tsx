import React from 'react';
import HoverableImage from './HoverableImage';
import ImageOptionsPanel from './ImageOptionsPanel';
import ImageUploader from './ImageUploader';
import MultiImageUploader from './MultiImageUploader';
import ResultPlaceholder from './shared/ResultPlaceholder';
import Spinner from './Spinner';
import { useIdentityTransfer } from '../hooks/useIdentityTransfer';
import { useLanguage } from '../contexts/LanguageContext';
import { Feature } from '../types';

const IdentityTransfer: React.FC = () => {
  const { t } = useLanguage();
  const {
    destinationItems, destinationImages, faceReference, bodyReference,
    backgroundPrompt, extraPrompt, aspectRatio, resolution, isLoading,
    loadingMessage, error, canGenerate, completedCount, failedCount, imageEditModel,
    setFaceReference, setBodyReference, setBackgroundPrompt, setExtraPrompt,
    setAspectRatio, setResolution, setError, handleDestinationImagesUpload,
    handleGenerate, handleRegenerateSingle,
  } = useIdentityTransfer();

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(520px,0.95fr)_minmax(0,1.05fr)] xl:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="workspace-stage rounded-[2rem] p-5 sm:p-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="workspace-label mb-1">{t('identityTransfer.step1')}</p>
              <h3 className="workspace-title text-xl font-medium text-white">{t('identityTransfer.sharedReferencesTitle')}</h3>
            </div>
            <p className="text-xs text-zinc-500">{t('identityTransfer.providerNotice')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="workspace-panel rounded-[1.5rem] p-4">
              <ImageUploader image={faceReference} onImageUpload={setFaceReference} id="identity-face-reference" title={t('identityTransfer.faceReferenceTitle')} />
              <p className="mt-2 text-xs leading-5 text-zinc-500">{t('identityTransfer.faceReferenceHint')}</p>
            </div>
            <div className="workspace-panel rounded-[1.5rem] p-4">
              <ImageUploader image={bodyReference} onImageUpload={setBodyReference} id="identity-body-reference" title={t('identityTransfer.bodyReferenceTitle')} />
              <p className="mt-2 text-xs leading-5 text-zinc-500">{t('identityTransfer.bodyReferenceHint')}</p>
            </div>
          </div>
        </section>

        <section className="workspace-stage rounded-[2rem] p-5 sm:p-6">
          <div className="mb-4">
            <p className="workspace-label mb-1">{t('identityTransfer.step2')}</p>
            <h3 className="workspace-title text-xl font-medium text-white">{t('identityTransfer.destinationsTitle')}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{t('identityTransfer.destinationsHint')}</p>
          </div>
          <MultiImageUploader images={destinationImages} onImagesUpload={handleDestinationImagesUpload} id="identity-destinations" title={t('identityTransfer.destinationsTitle')} hideTitle />
        </section>

        <section className="workspace-panel space-y-5 rounded-[2rem] p-5 sm:p-6">
          <div>
            <p className="workspace-label mb-1">{t('identityTransfer.step3')}</p>
            <h3 className="text-xl font-medium tracking-[-0.03em] text-white">{t('identityTransfer.generateButton')}</h3>
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">{t('identityTransfer.backgroundPromptLabel')}</span>
            <textarea value={backgroundPrompt} onChange={(event) => setBackgroundPrompt(event.target.value)} rows={2} placeholder={t('identityTransfer.backgroundPromptPlaceholder')} className="workspace-input p-3" />
            <span className="block text-xs leading-5 text-zinc-500">{t('identityTransfer.backgroundPromptHint')}</span>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">{t('identityTransfer.extraPromptLabel')}</span>
            <textarea value={extraPrompt} onChange={(event) => setExtraPrompt(event.target.value)} rows={2} placeholder={t('identityTransfer.extraPromptPlaceholder')} className="workspace-input p-3" />
            <span className="block text-xs leading-5 text-zinc-500">{t('identityTransfer.extraPromptHint')}</span>
          </label>
          <ImageOptionsPanel aspectRatio={aspectRatio} setAspectRatio={setAspectRatio} resolution={resolution} setResolution={setResolution} model={imageEditModel} />
          <button type="button" onClick={handleGenerate} disabled={isLoading || !canGenerate} className="flex min-h-[48px] w-full items-center justify-center rounded-[1.25rem] bg-[var(--workspace-accent)] px-4 py-3.5 text-base font-semibold text-[var(--workspace-accent-text)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-500">
            {isLoading ? <Spinner /> : t('identityTransfer.generateButton')}
          </button>
        </section>
      </div>

      <section className="workspace-stage rounded-[2rem] p-5 sm:p-6 xl:sticky xl:top-6">
        {destinationItems.length === 0 ? (
          <div className="flex min-h-[32rem] items-center justify-center"><ResultPlaceholder description={t('identityTransfer.outputPanelDescription')} /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 border-b border-white/8 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="workspace-label">{t('workspace.panels.resultStage')}</p>
                <h3 className="text-2xl font-medium tracking-[-0.04em] text-zinc-50">{t('identityTransfer.batchResultsTitle')}</h3>
                <p className="mt-2 text-sm text-zinc-400">{t('identityTransfer.batchProgress', { completed: completedCount, total: destinationItems.length, failed: failedCount })}</p>
              </div>
              {isLoading && <p className="animate-pulse text-xs uppercase tracking-[0.18em] text-zinc-400">{loadingMessage || t('identityTransfer.generatingStatus')}</p>}
            </div>
            {error && <div className="flex items-start justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"><span>{error}</span><button type="button" onClick={() => setError(null)} className="text-xs hover:text-white">{t('common.close')}</button></div>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {destinationItems.map((item, index) => {
                const result = item.results[0];
                const label = t('identityTransfer.destinationBatchLabel', { index: index + 1 });
                if (result) return <HoverableImage key={item.id} image={result} altText={label} downloadPrefix={Feature.IdentityTransfer} onRegenerate={() => handleRegenerateSingle(item.id)} isGenerating={isLoading || item.status === 'processing'} />;
                if (item.status === 'error') return (
                  <div key={item.id} className="flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-red-500/20 bg-red-500/5 p-5 text-center">
                    <p className="text-sm font-medium text-red-200">{label}</p><p className="text-xs leading-5 text-red-300/80">{item.error}</p>
                    <button type="button" onClick={() => handleRegenerateSingle(item.id)} disabled={isLoading} className="runway-action-secondary px-4 py-2 text-xs font-medium disabled:opacity-50">{t('identityTransfer.regenerateButton')}</button>
                  </div>
                );
                return (
                  <div key={item.id} className={`flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-white/8 ${item.status === 'processing' ? 'animate-pulse bg-white/5' : 'bg-white/[0.03]'}`}>
                    {item.status === 'processing' && <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-zinc-100" />}
                    <p className="text-xs text-zinc-500">{item.status === 'processing' ? t('identityTransfer.processingStatus') : t('identityTransfer.waitingStatus')}</p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">{label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default IdentityTransfer;
