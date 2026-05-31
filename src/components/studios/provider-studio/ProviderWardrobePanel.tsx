import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import ImageUploader from '../../ImageUploader';
import WardrobeSetCard from '../../WardrobeSetCard';
import Spinner, { ErrorDisplay } from '../../Spinner';
import { AddIcon } from '../../Icons';
import ProviderResultsGrid from './ProviderResultsGrid';
import { UseProviderWardrobeReturn } from '../../../hooks/useProviderWardrobe';
import { fieldClass } from './provider-studio-styles';

interface ProviderWardrobePanelProps {
  wardrobe: UseProviderWardrobeReturn;
  idPrefix: string;
  /** Disable inputs while a non-wardrobe generation is running. */
  isParentBusy: boolean;
  onGenerate: () => void;
  /** GPT: show the ~60-90s slow warning + the hard-cap notice. */
  showSlowWarning?: boolean;
}

const secondaryButtonClass =
  'inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-medium text-zinc-100 transition-colors hover:border-white/25 hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Wardrobe-mode layout for provider Try-On: a single subject, N sets × M items
 * (reusing the presentational `WardrobeSetCard`), background/extra prompts, and
 * per-set results. Service-agnostic — generation is driven by the studio hook's
 * `generate` callback.
 */
const ProviderWardrobePanel: React.FC<ProviderWardrobePanelProps> = ({
  wardrobe,
  idPrefix,
  isParentBusy,
  onGenerate,
  showSlowWarning = false,
}) => {
  const { t } = useLanguage();
  const busy = wardrobe.isGenerating || isParentBusy;

  return (
    <div className="flex flex-col gap-5">
      {showSlowWarning && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {t('studio.workflows.wardrobe.gptCapNotice', { sets: wardrobe.maxSets })}
        </p>
      )}

      <ImageUploader
        image={wardrobe.subject}
        id={`${idPrefix}-wardrobe-subject`}
        title={t('studio.workflows.wardrobe.subjectLabel')}
        onImageUpload={(file) => wardrobe.setSubject(file)}
      />

      <div className="flex flex-col gap-4">
        {wardrobe.sets.map((set, idx) => (
          <WardrobeSetCard
            key={set.id}
            setIndex={idx}
            items={set.items}
            maxItems={wardrobe.maxItemsPerSet}
            disabled={busy}
            canRemove={wardrobe.sets.length > 1}
            onAddItem={() => wardrobe.addItem(set.id)}
            onRemoveItem={(itemId) => wardrobe.removeItem(set.id, itemId)}
            onUpdateItem={(itemId, updates) => wardrobe.updateItem(set.id, itemId, updates)}
            onRemoveSet={() => wardrobe.removeSet(set.id)}
          />
        ))}

        <button
          type="button"
          onClick={wardrobe.addSet}
          disabled={busy || wardrobe.sets.length >= wardrobe.maxSets}
          className={`${secondaryButtonClass} w-full gap-2`}
        >
          <AddIcon className="h-4 w-4" />
          <span>
            {wardrobe.sets.length >= wardrobe.maxSets
              ? t('studio.workflows.wardrobe.maxSetsReached')
              : t('studio.workflows.wardrobe.addSet')}
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-wardrobe-bg`} className="text-sm font-medium text-zinc-300">
          {t('studio.workflows.backgroundField.label')}
        </label>
        <textarea
          id={`${idPrefix}-wardrobe-bg`}
          value={wardrobe.backgroundPrompt}
          onChange={(e) => wardrobe.setBackgroundPrompt(e.target.value)}
          rows={2}
          placeholder={t('studio.workflows.backgroundField.placeholder')}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-wardrobe-extra`} className="text-sm font-medium text-zinc-300">
          {t('studio.workflows.extraInstructions.label')}
        </label>
        <textarea
          id={`${idPrefix}-wardrobe-extra`}
          value={wardrobe.extraPrompt}
          onChange={(e) => wardrobe.setExtraPrompt(e.target.value)}
          rows={2}
          placeholder={t('studio.workflows.extraInstructions.placeholder')}
          className={fieldClass}
        />
      </div>

      <div>
        <button type="button" onClick={onGenerate} disabled={busy || !wardrobe.subject} className="brand-button">
          {wardrobe.isGenerating ? <Spinner /> : t('studio.workflows.wardrobe.generate')}
        </button>
      </div>

      {wardrobe.error && (
        <ErrorDisplay title={t('common.generationFailed')} message={wardrobe.error} onClear={() => undefined} />
      )}

      {wardrobe.results.length > 0 && (
        <div className="flex flex-col gap-5">
          {wardrobe.results.map((resultSet, idx) => (
            <div key={resultSet.setId} className="flex flex-col gap-3">
              <p className="text-sm font-medium text-zinc-300">
                {t('studio.workflows.wardrobe.setResultLabel', { number: idx + 1 })}
              </p>
              {resultSet.status === 'processing' && (
                <div className="flex items-center gap-3 text-zinc-400">
                  <Spinner />
                  <span>{t('studio.workflows.generatingStatus')}</span>
                </div>
              )}
              {resultSet.status === 'error' && (
                <p className="text-sm text-red-400">{resultSet.error}</p>
              )}
              {resultSet.results.length > 0 && (
                <ProviderResultsGrid results={resultSet.results} downloadPrefix={`${idPrefix}-wardrobe`} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProviderWardrobePanel;
