import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  type LocalQwenSampler,
  type LocalQwenScheduler,
  LOCAL_QWEN_RESOLUTIONS,
  LOCAL_QWEN_SAMPLERS,
  LOCAL_QWEN_SCHEDULERS,
  KNOWN_PORTABLE_COMFYUI_PATH,
  detectPortableComfyUiPath,
  useLocalQwenSettings,
} from '../../hooks/useLocalQwenSettings';
import { getDesktopLocalQwenApi } from '../../platform/desktopLocalQwen';
import { SectionCard } from './SettingsDataSection';
import { fieldLabelClassName, inputClassName } from './GatewayProfileRow';

export const LocalQwenSettingsSection: React.FC = () => {
  const { t } = useLanguage();
  const { settings, updateSetting } = useLocalQwenSettings();

  const [isDetectedPathExisting, setIsDetectedPathExisting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const checkDetection = async () => {
      const isKnown =
        Boolean(settings.comfyUiPath) &&
        (settings.comfyUiPath === KNOWN_PORTABLE_COMFYUI_PATH ||
          settings.comfyUiPath === detectPortableComfyUiPath());
      if (!isKnown) {
        if (active) setIsDetectedPathExisting(false);
        return;
      }
      const api = getDesktopLocalQwenApi();
      if (!api?.verifyFolder) {
        if (active) setIsDetectedPathExisting(false);
        return;
      }
      try {
        const res = await api.verifyFolder(settings.comfyUiPath);
        if (active) {
          setIsDetectedPathExisting(Boolean(res.ok && res.value.exists && res.value.hasComfyUiMain));
        }
      } catch {
        if (active) setIsDetectedPathExisting(false);
      }
    };
    void checkDetection();
    return () => {
      active = false;
    };
  }, [settings.comfyUiPath]);

  const isAutoDetected = isDetectedPathExisting;

  return (
    <SectionCard
      title={t('settingsModal.localQwen.title')}
      description={t('settingsModal.localQwen.description')}
    >
      <div className="space-y-4">
        {/* ComfyUI Folder Path */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="local-qwen-folder" className={fieldLabelClassName}>
              {t('settingsModal.localQwen.folderLabel')}
            </label>
            <div className="flex items-center gap-2">
              {isAutoDetected && (
                <span className="text-xs font-medium text-emerald-400">
                  {t('settingsModal.localQwen.autoDetected')}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  const detected = detectPortableComfyUiPath() || KNOWN_PORTABLE_COMFYUI_PATH;
                  updateSetting('comfyUiPath', detected);
                }}
                className="workspace-button px-2.5 py-1 text-xs text-zinc-300"
              >
                {t('settingsModal.localQwen.autoDetectButton')}
              </button>
            </div>
          </div>
          <input
            id="local-qwen-folder"
            type="text"
            value={settings.comfyUiPath}
            onChange={(e) => updateSetting('comfyUiPath', e.target.value)}
            placeholder={t('settingsModal.localQwen.folderPlaceholder')}
            className={inputClassName}
          />
        </div>

        {/* Resolution */}
        <div className="space-y-1.5">
          <span className={fieldLabelClassName}>
            {t('settingsModal.localQwen.resolutionLabel')}
          </span>
          <div className="grid grid-cols-3 gap-2">
            {LOCAL_QWEN_RESOLUTIONS.map((res) => {
              const active = settings.resolution === res;
              return (
                <button
                  key={res}
                  type="button"
                  onClick={() => updateSetting('resolution', res)}
                  className={`workspace-button py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                    active
                      ? 'border-white/40 bg-white/10 text-white shadow-sm'
                      : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:text-zinc-200'
                  }`}
                  aria-pressed={active}
                >
                  {res}px
                </button>
              );
            })}
          </div>
          {settings.resolution === 1024 && (
            <div
              data-testid="local-qwen-1024-warning"
              className="mt-2 rounded-[1rem] border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-200"
            >
              {t('settingsModal.localQwen.warning1024')}
            </div>
          )}
        </div>

        {/* Steps & CFG */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="local-qwen-steps" className={fieldLabelClassName}>
              {t('settingsModal.localQwen.stepsLabel')}
            </label>
            <input
              id="local-qwen-steps"
              type="number"
              min={1}
              max={50}
              value={settings.steps}
              onChange={(e) => {
                const val = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(val)) {
                  updateSetting('steps', Math.max(1, Math.min(50, val)));
                }
              }}
              className={inputClassName}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="local-qwen-cfg" className={fieldLabelClassName}>
              {t('settingsModal.localQwen.cfgLabel')}
            </label>
            <input
              id="local-qwen-cfg"
              type="number"
              step={0.1}
              min={0.1}
              max={10.0}
              value={settings.cfg}
              onChange={(e) => {
                const val = Number.parseFloat(e.target.value);
                if (!Number.isNaN(val)) {
                  updateSetting('cfg', Math.max(0.1, Math.min(10.0, val)));
                }
              }}
              className={inputClassName}
            />
          </div>
        </div>

        {/* Sampler & Scheduler */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="local-qwen-sampler" className={fieldLabelClassName}>
              {t('settingsModal.localQwen.samplerLabel')}
            </label>
            <select
              id="local-qwen-sampler"
              value={settings.sampler}
              onChange={(e) => updateSetting('sampler', e.target.value as LocalQwenSampler)}
              className={inputClassName}
            >
              {LOCAL_QWEN_SAMPLERS.map((s) => (
                <option key={s} value={s} className="bg-zinc-900 text-zinc-100">
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="local-qwen-scheduler" className={fieldLabelClassName}>
              {t('settingsModal.localQwen.schedulerLabel')}
            </label>
            <select
              id="local-qwen-scheduler"
              value={settings.scheduler}
              onChange={(e) => updateSetting('scheduler', e.target.value as LocalQwenScheduler)}
              className={inputClassName}
            >
              {LOCAL_QWEN_SCHEDULERS.map((s) => (
                <option key={s} value={s} className="bg-zinc-900 text-zinc-100">
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </SectionCard>
  );
};
