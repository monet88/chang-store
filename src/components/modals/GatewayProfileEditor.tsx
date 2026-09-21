import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useGatewayProfileEditor } from '../../hooks/useGatewayProfileEditor';
import { GatewayProfileRow, ProbeLine, fieldLabelClassName, inputClassName } from './GatewayProfileRow';
import { isStoredDesktopCredential } from '../../platform/desktopGateway';

const comparableProviderUrl = (value: string): string => value.trim().replace(/\/+$/, '');

export interface GatewayProfileEditorProps {
  geminiProfileId: string;
  geminiUrl: string;
  geminiApiKey: string;
  isGeminiUrlInvalid: boolean;
  customGeminiHost: string | null;
  isGeminiApiKeyMissing: boolean;
  onGeminiUrlChange: (value: string) => void;
  onGeminiApiKeyChange: (value: string) => void;
}

/**
 * Two lists: the single Gemini-lane profile (the CPA route, saved with the modal) and the
 * image lane (GPT Image gateways, each saved as it is edited).
 */
export const GatewayProfileEditor: React.FC<GatewayProfileEditorProps> = ({
  geminiProfileId,
  geminiUrl,
  geminiApiKey,
  isGeminiUrlInvalid,
  customGeminiHost,
  isGeminiApiKeyMissing,
  onGeminiUrlChange,
  onGeminiApiKeyChange,
}) => {
  const { t } = useLanguage();
  const editor = useGatewayProfileEditor();

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <div className="space-y-1">
          <p className={fieldLabelClassName}>{t('settingsModal.gatewayProfiles.geminiLane')}</p>
          <p className="text-xs leading-5 text-zinc-500">{t('settingsModal.gatewayProfiles.geminiLaneHint')}</p>
        </div>

        <label className="block space-y-2">
          <span className={fieldLabelClassName}>{t('settingsModal.cpaGateway.urlLabel')}</span>
          <input
            aria-label={t('settingsModal.cpaGateway.urlLabel')}
            type="url"
            value={geminiUrl}
            onChange={(e) => {
              const nextUrl = e.target.value;
              onGeminiUrlChange(e.target.value);
              if (
                isStoredDesktopCredential(geminiApiKey)
                && comparableProviderUrl(nextUrl) !== comparableProviderUrl(geminiUrl)
              ) {
                onGeminiApiKeyChange('');
              }
            }}
            placeholder="https://cliproxy.monet.uno"
            className={inputClassName}
          />
          {isGeminiUrlInvalid && <p className="text-xs text-red-400">{t('settingsModal.cpaGateway.urlInvalid')}</p>}
          {customGeminiHost && (
            <p className="text-xs text-amber-400">
              {t('settingsModal.cpaGateway.urlCustomWarning', { host: customGeminiHost })}
            </p>
          )}
        </label>

        <label className="block space-y-2">
          <span className={fieldLabelClassName}>{t('settingsModal.cpaGateway.apiKeyLabel')}</span>
          <input
            aria-label={t('settingsModal.cpaGateway.apiKeyLabel')}
            type="password"
            value={isStoredDesktopCredential(geminiApiKey) ? '' : geminiApiKey}
            onChange={(e) => onGeminiApiKeyChange(e.target.value)}
            autoComplete="new-password"
            placeholder={isStoredDesktopCredential(geminiApiKey) ? '••••••••' : t('settingsModal.cpaGateway.apiKeyPlaceholder')}
            className={inputClassName}
          />
          {isGeminiApiKeyMissing && <p className="text-xs text-red-400">{t('settingsModal.cpaGateway.apiKeyMissing')}</p>}
          <p className="text-xs text-zinc-500">{t('settingsModal.cpaGateway.apiKeyHint')}</p>
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-200">
            {t('settingsModal.cpaGateway.storageWarning')}
          </p>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => void editor.probeProfile(geminiProfileId, geminiUrl, geminiApiKey)}
            className="workspace-button px-4 py-2 text-sm font-medium"
          >
            {t('settingsModal.gatewayProfiles.testButton')}
          </button>
          <ProbeLine state={editor.probeStates[geminiProfileId]} />
        </div>
      </div>

      <div className="space-y-4 border-t border-white/10 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className={fieldLabelClassName}>{t('settingsModal.gatewayProfiles.imageLane')}</p>
            <p className="text-xs leading-5 text-zinc-500">{t('settingsModal.gatewayProfiles.imageLaneHint')}</p>
          </div>
          <button onClick={editor.addImageProfile} className="workspace-button shrink-0 px-4 py-2 text-sm font-medium">
            {t('settingsModal.gatewayProfiles.addProfile')}
          </button>
        </div>

        {editor.imageProfiles.length === 0 && (
          <p className="text-sm leading-6 text-zinc-400">{t('settingsModal.gatewayProfiles.emptyLane')}</p>
        )}

        <div className="space-y-4">
          {editor.imageProfiles.map((profile) => (
            <GatewayProfileRow
              key={profile.id}
              profile={profile}
              isActive={profile.id === editor.activeImageProfileId}
              probeState={editor.probeStates[profile.id]}
              onPatch={(patch) => editor.updateImageProfile(profile.id, patch)}
              onSelect={() => editor.selectImageProfile(profile.id)}
              onRemove={() => editor.removeImageProfile(profile.id)}
              onProbe={() => void editor.probeProfile(profile.id, profile.baseUrl, profile.apiKey)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
