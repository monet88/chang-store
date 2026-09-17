import React from 'react';
import { type SelectableModel } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSettingsModal } from '../../hooks/useSettingsModal';
import { CloseIcon } from '../Icons';
import { GoogleDriveSettings } from '../GoogleDriveSettings';

const sectionTitleClassName = 'text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400';

const SectionCard: React.FC<{
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

const ModelSelector: React.FC<{
  label: string;
  models: SelectableModel[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}> = ({ label, models, selectedModel, onModelChange }) => (
  <label className="block space-y-2">
    <span className={sectionTitleClassName}>{label}</span>
    <div className="relative">
      <select
        aria-label={label}
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        className="workspace-input min-h-[46px] w-full appearance-none px-4 py-3 pr-10 text-sm text-zinc-100"
      >
        {models.map((opt) => (
          <option key={opt.modelId} value={opt.modelId}>
            {opt.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-500">⌄</span>
    </div>
  </label>
);

export const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const {
    imageEditModels,
    imageGenerateModels,
    textGenerateModels,
    localImageEditModel,
    localImageGenerateModel,
    localTextGenerateModel,
    localCpaGatewayUrl,
    localCpaGatewayApiKey,
    isCpaGatewayUrlInvalid,
    isCpaGatewayUrlCustom,
    isCpaGatewayApiKeyMissing,
    customCpaGatewayHost,
    setLocalImageEditModel,
    setLocalImageGenerateModel,
    setLocalTextGenerateModel,
    setLocalCpaGatewayUrl,
    setLocalCpaGatewayApiKey,
    debugMode,
    handleDebugToggle,
    restoreInputRef,
    handleRestore,
    handleClear,
    handleSave,
    handleBackup,
    usageMB,
    quotaMB,
    storagePercentage,
  } = useSettingsModal({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="workspace-shell flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
          <div className="space-y-2">
            <p className="workspace-label">{t('settingsModal.eyebrow')}</p>
            <div className="space-y-2">
              <h2 className="workspace-title text-3xl font-medium text-zinc-50 sm:text-4xl">{t('settingsModal.title')}</h2>
              <p className="max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                {t('settingsModal.description')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="workspace-button h-11 w-11 shrink-0 rounded-full border-white/10 bg-white/[0.03] p-0 text-zinc-300 hover:text-white"
            aria-label={t('settingsModal.closeAria')}
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 pb-24 pt-5 sm:px-6 sm:pb-28 sm:pt-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-4">
              <SectionCard
                title={t('settingsModal.sections.models.title')}
                description={t('settingsModal.sections.models.description')}
              >
                <div className="space-y-4">
                  <ModelSelector
                    label={t('settingsModal.fields.textGeneration')}
                    models={textGenerateModels}
                    selectedModel={localTextGenerateModel}
                    onModelChange={setLocalTextGenerateModel}
                  />
                  <ModelSelector
                    label={t('settingsModal.fields.imageEditing')}
                    models={imageEditModels}
                    selectedModel={localImageEditModel}
                    onModelChange={setLocalImageEditModel}
                  />
                  <ModelSelector
                    label={t('settingsModal.fields.imageGeneration')}
                    models={imageGenerateModels}
                    selectedModel={localImageGenerateModel}
                    onModelChange={setLocalImageGenerateModel}
                  />
                </div>
              </SectionCard>

              <SectionCard
                title={t('settingsModal.sections.cpaGateway.title')}
                description={t('settingsModal.sections.cpaGateway.description')}
              >
                <div className="space-y-4">
                  <label className="block space-y-2">
                    <span className={sectionTitleClassName}>{t('settingsModal.cpaGateway.urlLabel')}</span>
                    <input
                      aria-label={t('settingsModal.cpaGateway.urlLabel')}
                      type="url"
                      value={localCpaGatewayUrl}
                      onChange={(e) => setLocalCpaGatewayUrl(e.target.value)}
                      placeholder="https://cliproxy.monet.uno"
                      className="workspace-input min-h-[46px] w-full px-4 py-3 text-sm text-zinc-100"
                    />
                    {isCpaGatewayUrlInvalid && (
                      <p className="text-xs text-red-400">{t('settingsModal.cpaGateway.urlInvalid')}</p>
                    )}
                    {isCpaGatewayUrlCustom && customCpaGatewayHost && (
                      <p className="text-xs text-amber-400">
                        {t('settingsModal.cpaGateway.urlCustomWarning', { host: customCpaGatewayHost })}
                      </p>
                    )}
                  </label>

                  <label className="block space-y-2">
                    <span className={sectionTitleClassName}>{t('settingsModal.cpaGateway.apiKeyLabel')}</span>
                    <input
                      aria-label={t('settingsModal.cpaGateway.apiKeyLabel')}
                      type="password"
                      value={localCpaGatewayApiKey}
                      onChange={(e) => setLocalCpaGatewayApiKey(e.target.value)}
                      autoComplete="off"
                      placeholder={t('settingsModal.cpaGateway.apiKeyPlaceholder')}
                      className="workspace-input min-h-[46px] w-full px-4 py-3 text-sm text-zinc-100"
                    />
                    {isCpaGatewayApiKeyMissing && (
                      <p className="text-xs text-red-400">{t('settingsModal.cpaGateway.apiKeyMissing')}</p>
                    )}
                    <p className="text-xs text-zinc-500">{t('settingsModal.cpaGateway.apiKeyHint')}</p>
                    <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-200">
                      {t('settingsModal.cpaGateway.storageWarning')}
                    </p>
                  </label>
                </div>
              </SectionCard>

              <SectionCard
                title={t('settingsModal.sections.cloud.title')}
                description={t('settingsModal.sections.cloud.description')}
              >
                <GoogleDriveSettings />
              </SectionCard>
            </div>

            <div className="space-y-4">
              <SectionCard
                title={t('settingsModal.sections.data.title')}
                description={t('settingsModal.sections.data.description')}
              >
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
                    <button onClick={handleBackup} className="workspace-button px-4 py-3 text-sm font-medium">
                      {t('settingsModal.actions.backup')}
                    </button>
                    <button onClick={() => restoreInputRef.current?.click()} className="workspace-button px-4 py-3 text-sm font-medium">
                      {t('settingsModal.actions.restore')}
                    </button>
                    <input type="file" ref={restoreInputRef} onChange={handleRestore} className="hidden" accept=".json" />
                    <button onClick={handleClear} className="workspace-button px-4 py-3 text-sm font-medium text-red-300 hover:text-red-200">
                      {t('settingsModal.actions.clear')}
                    </button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title={t('settingsModal.sections.developer.title')}
                description={t('settingsModal.sections.developer.description')}
              >
                <div className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4">
                  <div className="min-w-0 space-y-1 pr-2">
                    <p className={sectionTitleClassName}>{t('settingsModal.developer.debugTitle')}</p>
                    <p className="text-sm leading-6 text-zinc-400">{t('settingsModal.developer.debugDescription')}</p>
                  </div>
                  <button
                    onClick={handleDebugToggle}
                    className={`relative h-8 w-14 shrink-0 rounded-full border shadow-inner transition-colors ${debugMode ? 'border-emerald-400/50 bg-emerald-400/20' : 'border-white/15 bg-zinc-800/80'}`}
                    aria-pressed={debugMode}
                    aria-label={t('settingsModal.developer.toggleDebugAria')}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.45)] transition-transform ${debugMode ? 'translate-x-6' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
              </SectionCard>
            </div>
          </div>
        </div>

        <footer className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{t('settingsModal.footerHint')}</p>
          <div className="flex gap-3 self-end">
            <button onClick={onClose} className="workspace-button px-5 py-2.5 text-sm font-medium">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} className="workspace-button workspace-button-primary px-5 py-2.5 text-sm font-medium">
              {t('common.save')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
