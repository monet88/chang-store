import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

export const sectionTitleClassName = 'text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400';

/** The modal's card wrapper; shared by every settings section. */
export const SectionCard: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <section className="workspace-panel rounded-[1.5rem] p-5 sm:p-6">
    <div className="mb-4 space-y-2">
      <p className="workspace-label">{title}</p>
      {description && <p className="text-sm leading-6 text-zinc-400">{description}</p>}
    </div>
    {children}
  </section>
);

export interface SettingsDataSectionProps {
  usageMB: string;
  quotaMB: string;
  storagePercentage: number;
  restoreInputRef: React.RefObject<HTMLInputElement>;
  onBackup: () => void;
  onRestore: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onClear: () => void;
}

/** Storage usage, backup / restore / clear — the workspace-level actions. */
export const SettingsDataSection: React.FC<SettingsDataSectionProps> = ({
  usageMB,
  quotaMB,
  storagePercentage,
  restoreInputRef,
  onBackup,
  onRestore,
  onClear,
}) => {
  const { t } = useLanguage();
  return (
    <SectionCard title={t('settingsModal.sections.data.title')} description={t('settingsModal.sections.data.description')}>
      <div className="space-y-4">
        <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className={sectionTitleClassName}>{t('settingsModal.storage.title')}</p>
            <span className="workspace-chip px-3 py-1 text-xs font-medium text-zinc-300">
              {usageMB} MB / {quotaMB} MB
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-zinc-100 transition-all"
              style={{ width: `${Math.min(storagePercentage, 100)}%` }}
            />
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            {t('settingsModal.storage.usageHint', { percent: storagePercentage.toFixed(1) })}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <button onClick={onBackup} className="workspace-button px-4 py-3 text-sm font-medium">
            {t('settingsModal.actions.backup')}
          </button>
          <button onClick={() => restoreInputRef.current?.click()} className="workspace-button px-4 py-3 text-sm font-medium">
            {t('settingsModal.actions.restore')}
          </button>
          <input type="file" ref={restoreInputRef} onChange={onRestore} className="hidden" accept=".json" />
          <button onClick={onClear} className="workspace-button px-4 py-3 text-sm font-medium text-red-300 hover:text-red-200">
            {t('settingsModal.actions.clear')}
          </button>
        </div>
      </div>
    </SectionCard>
  );
};
