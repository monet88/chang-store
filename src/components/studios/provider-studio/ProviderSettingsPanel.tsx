import React, { useMemo, useState } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { validateProviderBaseUrl } from '../../../utils/provider-url-validation';
import { panelClass } from './provider-studio-styles';

interface ProviderSettingsPanelProps {
  /** Provider display label (e.g. "Grok", "GPT Image"). */
  providerLabel: string;
  apiKey: string;
  baseUrl: string;
  onApiKeyChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onReset: () => void;
}

/**
 * Thin settings UI for a provider studio. Renders base URL + API key inputs and
 * surfaces a confirmation warning when the base URL targets a non-allowlisted
 * domain. Reads/writes nothing directly — all persistence is owned by
 * `ApiProviderContext` via the supplied callbacks.
 */
const ProviderSettingsPanel: React.FC<ProviderSettingsPanelProps> = ({
  providerLabel,
  apiKey,
  baseUrl,
  onApiKeyChange,
  onBaseUrlChange,
  onReset,
}) => {
  const { t } = useLanguage();
  const [showKey, setShowKey] = useState(false);

  const urlValidation = useMemo(() => validateProviderBaseUrl(baseUrl), [baseUrl]);

  return (
    <div className={`${panelClass} flex flex-col gap-4`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
          {t('studio.settings.title', { provider: providerLabel })}
        </h3>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          {t('studio.settings.reset')}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="provider-base-url"
          className="text-sm font-medium text-zinc-300"
        >
          {t('studio.settings.baseUrlLabel')}
        </label>
        <input
          id="provider-base-url"
          type="url"
          value={baseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          placeholder="https://api.example.com/v1"
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
        />
        {urlValidation.status === 'invalid' && (
          <p className="text-xs text-red-400">
            {t('studio.settings.urlInvalid')}
          </p>
        )}
        {urlValidation.status === 'custom' && (
          <p className="text-xs text-amber-400">
            {t('studio.settings.urlCustomWarning', { host: urlValidation.host })}
          </p>
        )}
        {providerLabel === 'GPT' && (
          <p className="text-xs text-zinc-500">
            {t('studio.settings.gptLocalRecommendation')}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="provider-api-key"
          className="text-sm font-medium text-zinc-300"
        >
          {t('studio.settings.apiKeyLabel')}
        </label>
        <div className="flex gap-2">
          <input
            id="provider-api-key"
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            autoComplete="off"
            placeholder={t('studio.settings.apiKeyPlaceholder')}
            className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/30 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowKey((current) => !current)}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-pressed={showKey}
          >
            {showKey ? t('studio.settings.hideKey') : t('studio.settings.showKey')}
          </button>
        </div>
        <p className="text-xs text-zinc-500">{t('studio.settings.apiKeyHint')}</p>
      </div>
    </div>
  );
};

export default ProviderSettingsPanel;
