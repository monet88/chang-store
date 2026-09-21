import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { IMAGE_DRIVER_OPTIONS, type EditorProfile, type ProfileProbeState } from '../../hooks/useGatewayProfileEditor';

export const fieldLabelClassName = 'text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400';
export const inputClassName = 'workspace-input min-h-[44px] w-full px-3 py-2 text-sm text-zinc-100';

/** `ok · 32 mô hình · 0.23s`, or the mapped failure — never a raw status code. */
export const ProbeLine: React.FC<{ state?: ProfileProbeState }> = ({ state }) => {
  const { t } = useLanguage();
  if (!state) {
    return null;
  }
  if (state.phase === 'probing') {
    return <p className="text-xs text-zinc-500">{t('settingsModal.gatewayProfiles.status.probing')}</p>;
  }
  if (state.phase === 'invalid') {
    return <p className="text-xs text-red-400">{t('settingsModal.cpaGateway.urlInvalid')}</p>;
  }

  const { status, modelIds, latencyMs } = state.result;
  if (status !== 'ok') {
    return <p className="text-xs text-red-400">{t(`error.gateway.${status}`)}</p>;
  }
  return (
    <p className="text-xs text-emerald-400">
      {t('settingsModal.gatewayProfiles.status.ok', {
        count: modelIds.length,
        seconds: (latencyMs / 1000).toFixed(2),
      })}
    </p>
  );
};

export interface GatewayProfileRowProps {
  profile: EditorProfile;
  isActive: boolean;
  probeState?: ProfileProbeState;
  onPatch: (patch: Partial<EditorProfile>) => void;
  onSelect?: () => void;
  onRemove: () => void;
  onProbe: () => void;
}

/** One image-lane gateway: name, API shape, address, key, enable toggle, its own check. */
export const GatewayProfileRow: React.FC<GatewayProfileRowProps> = ({
  profile,
  isActive,
  probeState,
  onPatch,
  onSelect,
  onRemove,
  onProbe,
}) => {
  const { t } = useLanguage();
  return (
    <div className="space-y-3 rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className={fieldLabelClassName}>
            {profile.label || t('settingsModal.gatewayProfiles.unnamedProfile')}
          </p>
          {isActive ? (
            <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              ● {t('settingsModal.gatewayProfiles.activeBadge')}
            </span>
          ) : (
            <button
              type="button"
              onClick={onSelect}
              className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
            >
              {t('settingsModal.gatewayProfiles.activateButton')}
            </button>
          )}
        </div>
        <button onClick={onRemove} className="text-xs text-red-300 hover:text-red-200">
          {t('settingsModal.gatewayProfiles.removeProfile')}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={fieldLabelClassName}>{t('settingsModal.gatewayProfiles.labelField')}</span>
          <input
            aria-label={t('settingsModal.gatewayProfiles.labelField')}
            value={profile.label}
            onChange={(e) => onPatch({ label: e.target.value })}
            className={inputClassName}
          />
        </label>
        <label className="block space-y-1.5">
          <span className={fieldLabelClassName}>{t('settingsModal.gatewayProfiles.driverField')}</span>
          <select
            aria-label={t('settingsModal.gatewayProfiles.driverField')}
            value={profile.driver}
            onChange={(e) => onPatch({ driver: e.target.value as EditorProfile['driver'] })}
            className={inputClassName}
          >
            {IMAGE_DRIVER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className={fieldLabelClassName}>{t('settingsModal.gatewayProfiles.baseUrlField')}</span>
        <input
          aria-label={t('settingsModal.gatewayProfiles.baseUrlField')}
          type="url"
          value={profile.baseUrl}
          onChange={(e) => onPatch({ baseUrl: e.target.value })}
          placeholder="https://api.xompet.io.vn/v1"
          className={inputClassName}
        />
      </label>

      <label className="block space-y-1.5">
        <span className={fieldLabelClassName}>{t('settingsModal.gatewayProfiles.apiKeyField')}</span>
        <input
          aria-label={t('settingsModal.gatewayProfiles.apiKeyField')}
          type="password"
          autoComplete="new-password"
          placeholder="sk-..."
          value={profile.apiKey}
          onChange={(e) => onPatch({ apiKey: e.target.value })}
          className={inputClassName}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onProbe} className="workspace-button px-4 py-2 text-sm font-medium">
          {t('settingsModal.gatewayProfiles.testButton')}
        </button>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={profile.enabled}
            onChange={(e) => onPatch({ enabled: e.target.checked })}
            aria-label={t('settingsModal.gatewayProfiles.enabledField')}
          />
          {t('settingsModal.gatewayProfiles.enabledField')}
        </label>
        <ProbeLine state={probeState} />
      </div>
    </div>
  );
};
