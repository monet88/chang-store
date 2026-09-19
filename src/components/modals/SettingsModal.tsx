import React from 'react';
import { type SelectableModel } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSettingsModal } from '../../hooks/useSettingsModal';
import { CloseIcon } from '../Icons';
import { GatewayProfileEditor } from './GatewayProfileEditor';
import { ModelOptionGroups } from '../ModelOptionGroups';
import { SectionCard, SettingsDataSection, sectionTitleClassName } from './SettingsDataSection';

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
        <ModelOptionGroups options={models} />
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
    geminiProfileId,
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
      aria-labelledby="settings-modal-title"
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
              <h2 id="settings-modal-title" className="workspace-title text-3xl font-medium text-zinc-50 sm:text-4xl">{t('settingsModal.title')}</h2>
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
                title={t('settingsModal.sections.gatewayProfiles.title')}
                description={t('settingsModal.sections.gatewayProfiles.description')}
              >
                <GatewayProfileEditor
                  geminiProfileId={geminiProfileId}
                  geminiUrl={localCpaGatewayUrl}
                  geminiApiKey={localCpaGatewayApiKey}
                  isGeminiUrlInvalid={isCpaGatewayUrlInvalid}
                  customGeminiHost={customCpaGatewayHost}
                  isGeminiApiKeyMissing={isCpaGatewayApiKeyMissing}
                  onGeminiUrlChange={setLocalCpaGatewayUrl}
                  onGeminiApiKeyChange={setLocalCpaGatewayApiKey}
                />
              </SectionCard>
            </div>

            <div className="space-y-4">
              <SettingsDataSection
                usageMB={usageMB}
                quotaMB={quotaMB}
                storagePercentage={storagePercentage}
                restoreInputRef={restoreInputRef}
                onBackup={handleBackup}
                onRestore={handleRestore}
                onClear={handleClear}
              />

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
