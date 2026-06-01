import React, { useState } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useImageViewer } from '../../../contexts/ImageViewerContext';
import Spinner, { ErrorDisplay } from '../../Spinner';
import { UseProviderLookbookOutputReturn } from '../../../hooks/useProviderLookbookOutput';

interface ProviderLookbookOutputProps {
  output: UseProviderLookbookOutputReturn;
  idPrefix: string;
  showSlowWarning?: boolean;
}

type OutputTab = 'main' | 'variations' | 'closeup';

const tabButton = (active: boolean) =>
  `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
    active ? 'bg-white text-black' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100'
  }`;
const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50';

const preview = (img: { mimeType: string; base64: string }) => `data:${img.mimeType};base64,${img.base64}`;

/**
 * Provider-specific Lookbook rich output: main image + refinement (with a
 * version-history strip the user can step back through) + variations + close-up
 * tabs. Local-only; all generation flows through the provider engine callbacks.
 * `LookbookOutput.tsx` (Gemini) is the visual reference; this is independent.
 */
const ProviderLookbookOutput: React.FC<ProviderLookbookOutputProps> = ({ output, idPrefix, showSlowWarning = false }) => {
  const { t } = useLanguage();
  const { openImageViewer } = useImageViewer();
  const [activeTab, setActiveTab] = useState<OutputTab>('main');
  const [refineText, setRefineText] = useState('');

  if (!output.main) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/50 p-6 text-center text-zinc-400">
        {t('studio.provider.results.empty')}
      </div>
    );
  }

  const busy = output.isGeneratingVariations || output.isGeneratingCloseUp || output.isRefining;
  const tabs: { id: OutputTab; label: string }[] = [
    { id: 'main', label: t('studio.workflows.lookbookOutput.tabMain') },
    { id: 'variations', label: t('studio.workflows.lookbookOutput.tabVariations') },
    { id: 'closeup', label: t('studio.workflows.lookbookOutput.tabCloseup') },
  ];

  return (
    <div className="flex flex-col gap-5">
      {showSlowWarning && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {t('studio.workflows.lookbookOutput.gptCapNotice')}
        </p>
      )}

      <div className="flex flex-wrap gap-2 rounded-[20px] border border-white/10 bg-black/30 p-2">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={tabButton(activeTab === tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {output.error && (
        <ErrorDisplay title={t('common.generationFailed')} message={output.error} onClear={output.clearError} />
      )}

      {activeTab === 'main' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => output.main && openImageViewer(output.main)}
            className="block w-full overflow-hidden rounded-[24px] border border-white/10 bg-black/30"
          >
            <img src={preview(output.main)} alt={t('studio.workflows.lookbookOutput.tabMain')} className="h-full w-full object-contain" />
          </button>

          <div className="flex flex-col gap-2">
            <label htmlFor={`${idPrefix}-lb-refine`} className="text-sm font-medium text-zinc-300">
              {t('studio.workflows.lookbookOutput.refineLabel')}
            </label>
            <div className="flex gap-2">
              <input
                id={`${idPrefix}-lb-refine`}
                type="text"
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                placeholder={t('studio.workflows.lookbookOutput.refinePlaceholder')}
                className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
              />
              <button
                type="button"
                disabled={busy || !refineText.trim()}
                onClick={() => {
                  void output.refine(refineText);
                  setRefineText('');
                }}
                className={secondaryButtonClass}
              >
                {output.isRefining ? <Spinner /> : t('studio.workflows.lookbookOutput.refine')}
              </button>
            </div>
          </div>

          {output.versions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500">
                {t('studio.workflows.lookbookOutput.versionHistory')}
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                <button
                  type="button"
                  onClick={() => output.selectVersion(-1)}
                  className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border ${
                    output.selectedVersionIndex === -1 ? 'border-white/30 bg-white/[0.06]' : 'border-white/10 bg-black/30'
                  }`}
                  title={t('studio.workflows.lookbookOutput.original')}
                >
                  <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent p-1 text-[9px] uppercase tracking-[0.18em] text-white">
                    {t('studio.workflows.lookbookOutput.original')}
                  </span>
                </button>
                {output.versions.map((version, index) => (
                  <button
                    key={version.timestamp}
                    type="button"
                    onClick={() => output.selectVersion(index)}
                    title={version.prompt}
                    className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border ${
                      output.selectedVersionIndex === index ? 'border-white/30 bg-white/[0.06]' : 'border-white/10 bg-black/30'
                    }`}
                  >
                    <img src={preview(version.image)} alt={`v${index + 1}`} className="h-full w-full object-cover" />
                    <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent p-1 text-[9px] uppercase tracking-[0.18em] text-white">
                      v{index + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'variations' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-[20px] border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            {output.maxVariations > 1 ? (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={output.maxVariations}
                  step={1}
                  value={output.variationCount}
                  onChange={(e) => output.setVariationCount(Number(e.target.value))}
                  className="w-40 cursor-pointer accent-white"
                  aria-label={t('studio.workflows.lookbookOutput.variationCount')}
                />
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs text-zinc-100">
                  {output.variationCount}
                </span>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">{t('studio.workflows.lookbookOutput.gptCapNotice')}</p>
            )}
            <button type="button" onClick={() => void output.generateVariations()} disabled={busy} className={secondaryButtonClass}>
              {output.isGeneratingVariations ? <Spinner /> : t('studio.workflows.lookbookOutput.generateVariations')}
            </button>
          </div>
          {output.variations.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {output.variations.map((img, i) => (
                <button
                  key={`${idPrefix}-var-${i}`}
                  type="button"
                  onClick={() => openImageViewer(img)}
                  className="overflow-hidden rounded-[20px] border border-white/10 bg-black/30"
                >
                  <img src={preview(img)} alt={t('studio.workflows.lookbookOutput.variationAlt', { index: i + 1 })} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'closeup' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button type="button" onClick={() => void output.generateCloseUps()} disabled={busy} className={secondaryButtonClass}>
              {output.isGeneratingCloseUp ? <Spinner /> : t('studio.workflows.lookbookOutput.generateCloseUp')}
            </button>
          </div>
          {output.closeUps.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {output.closeUps.map((img, i) => (
                <button
                  key={`${idPrefix}-close-${i}`}
                  type="button"
                  onClick={() => openImageViewer(img)}
                  className="overflow-hidden rounded-[20px] border border-white/10 bg-black/30"
                >
                  <img src={preview(img)} alt={t('studio.workflows.lookbookOutput.closeUpAlt', { index: i + 1 })} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProviderLookbookOutput;
