import { useState, useCallback } from 'react';
import {
  type LocalQwenSettings,
  type LocalQwenResolution,
  type LocalQwenSampler,
  type LocalQwenScheduler,
  LOCAL_QWEN_RESOLUTIONS,
  LOCAL_QWEN_SAMPLERS,
  LOCAL_QWEN_SCHEDULERS,
  KNOWN_PORTABLE_COMFYUI_PATH,
  loadLocalQwenSettings,
  saveLocalQwenSettings,
  detectPortableComfyUiPath,
} from '../config/localQwenSettings';

export type {
  LocalQwenSettings,
  LocalQwenResolution,
  LocalQwenSampler,
  LocalQwenScheduler,
};

export {
  LOCAL_QWEN_RESOLUTIONS,
  LOCAL_QWEN_SAMPLERS,
  LOCAL_QWEN_SCHEDULERS,
  KNOWN_PORTABLE_COMFYUI_PATH,
  detectPortableComfyUiPath,
};

export interface UseLocalQwenSettingsReturn {
  settings: LocalQwenSettings;
  updateSetting: <K extends keyof LocalQwenSettings>(key: K, value: LocalQwenSettings[K]) => void;
}

export const useLocalQwenSettings = (): UseLocalQwenSettingsReturn => {
  const [settings, setSettings] = useState<LocalQwenSettings>(() => loadLocalQwenSettings());

  const updateSetting = useCallback(
    <K extends keyof LocalQwenSettings>(key: K, value: LocalQwenSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        return saveLocalQwenSettings(next);
      });
    },
    [],
  );

  return {
    settings,
    updateSetting,
  };
};
