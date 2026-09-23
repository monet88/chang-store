export type LocalQwenResolution = 512 | 768 | 1024;
export type LocalQwenSampler = 'Euler' | 'Euler a' | 'DPM++ 2M' | 'DPM++ 2M SDE';
export type LocalQwenScheduler = 'Simple' | 'Normal' | 'Karras';

export interface LocalQwenSettings {
  resolution: LocalQwenResolution;
  steps: number;
  cfg: number;
  sampler: LocalQwenSampler;
  scheduler: LocalQwenScheduler;
  comfyUiPath: string;
}

export const LOCAL_QWEN_RESOLUTIONS: readonly LocalQwenResolution[] = [512, 768, 1024] as const;
export const LOCAL_QWEN_SAMPLERS: readonly LocalQwenSampler[] = [
  'Euler',
  'Euler a',
  'DPM++ 2M',
  'DPM++ 2M SDE',
] as const;
export const LOCAL_QWEN_SCHEDULERS: readonly LocalQwenScheduler[] = [
  'Simple',
  'Normal',
  'Karras',
] as const;

export const LOCAL_QWEN_MIN_STEPS = 1;
export const LOCAL_QWEN_MAX_STEPS = 50;
export const LOCAL_QWEN_MIN_CFG = 0.1;
export const LOCAL_QWEN_MAX_CFG = 10.0;

export const LOCAL_QWEN_SETTINGS_KEY = 'local_qwen_settings_v1';
export const KNOWN_PORTABLE_COMFYUI_PATH = 'D:\\ComfyUI_windows_portable';
export const DEFAULT_COMFYUI_PORT = 8188;

export const detectPortableComfyUiPath = (platform?: string): string => {
  const desktopEnvPlatform =
    typeof window !== 'undefined' && 'desktopEnv' in window
      ? (window as Window & { desktopEnv?: { platform?: string } }).desktopEnv?.platform
      : undefined;

  const currentPlatform =
    platform ?? desktopEnvPlatform ?? (typeof process !== 'undefined' ? process.platform : undefined);

  return currentPlatform === 'win32' ? KNOWN_PORTABLE_COMFYUI_PATH : '';
};

export const DEFAULT_LOCAL_QWEN_SETTINGS: LocalQwenSettings = Object.freeze({
  resolution: 512,
  steps: 16,
  cfg: 1.0,
  sampler: 'Euler',
  scheduler: 'Simple',
  comfyUiPath: detectPortableComfyUiPath(),
});

export const sanitizeLocalQwenSettings = (raw: unknown): LocalQwenSettings => {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_LOCAL_QWEN_SETTINGS };
  }

  const obj = raw as Record<string, unknown>;

  const resolution: LocalQwenResolution =
    obj.resolution === 768 || obj.resolution === 1024
      ? obj.resolution
      : DEFAULT_LOCAL_QWEN_SETTINGS.resolution;

  let steps =
    typeof obj.steps === 'number' && !Number.isNaN(obj.steps)
      ? Math.round(obj.steps)
      : DEFAULT_LOCAL_QWEN_SETTINGS.steps;
  steps = Math.max(LOCAL_QWEN_MIN_STEPS, Math.min(LOCAL_QWEN_MAX_STEPS, steps));

  let cfg =
    typeof obj.cfg === 'number' && !Number.isNaN(obj.cfg)
      ? Number(obj.cfg.toFixed(1))
      : DEFAULT_LOCAL_QWEN_SETTINGS.cfg;
  cfg = Math.max(LOCAL_QWEN_MIN_CFG, Math.min(LOCAL_QWEN_MAX_CFG, cfg));

  const sampler: LocalQwenSampler =
    typeof obj.sampler === 'string' &&
    (LOCAL_QWEN_SAMPLERS as readonly string[]).includes(obj.sampler)
      ? (obj.sampler as LocalQwenSampler)
      : DEFAULT_LOCAL_QWEN_SETTINGS.sampler;

  const scheduler: LocalQwenScheduler =
    typeof obj.scheduler === 'string' &&
    (LOCAL_QWEN_SCHEDULERS as readonly string[]).includes(obj.scheduler)
      ? (obj.scheduler as LocalQwenScheduler)
      : DEFAULT_LOCAL_QWEN_SETTINGS.scheduler;

  const comfyUiPath =
    typeof obj.comfyUiPath === 'string'
      ? obj.comfyUiPath.trim()
      : DEFAULT_LOCAL_QWEN_SETTINGS.comfyUiPath;

  return {
    resolution,
    steps,
    cfg,
    sampler,
    scheduler,
    comfyUiPath,
  };
};

export const loadLocalQwenSettings = (): LocalQwenSettings => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { ...DEFAULT_LOCAL_QWEN_SETTINGS };
  }

  try {
    const raw = localStorage.getItem(LOCAL_QWEN_SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_LOCAL_QWEN_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    return sanitizeLocalQwenSettings(parsed);
  } catch {
    return { ...DEFAULT_LOCAL_QWEN_SETTINGS };
  }
};

export const saveLocalQwenSettings = (settings: Partial<LocalQwenSettings>): LocalQwenSettings => {
  const current = loadLocalQwenSettings();
  const merged = sanitizeLocalQwenSettings({ ...current, ...settings });
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_QWEN_SETTINGS_KEY, JSON.stringify(merged));
    } catch {
      // Storage unavailable or quota exceeded
    }
  }
  return merged;
};

export const snapshotLocalQwenSettings = (): Readonly<LocalQwenSettings> => {
  return Object.freeze({ ...loadLocalQwenSettings() });
};
