import type { DesktopBridgeResult } from './desktopGateway';
import type { LocalQwenWorkflow } from '../utils/engineDispatch';
import { LOCAL_QWEN_UNAVAILABLE_MESSAGE } from '../utils/localQwenErrors';


export const DESKTOP_LOCAL_QWEN_CHANNELS = {
  getStatus: 'desktop-local-qwen:get-status',
  startServer: 'desktop-local-qwen:start-server',
  stopServer: 'desktop-local-qwen:stop-server',
  generateImage: 'desktop-local-qwen:generate-image',
  cancelJob: 'desktop-local-qwen:cancel-job',
  upscaleImage: 'desktop-local-qwen:upscale-image',
  verifyFolder: 'desktop-local-qwen:verify-folder',
} as const;

export type DesktopLocalQwenState = 'starting' | 'ready' | 'generating' | 'error' | 'stopped';

/** `UC` only counts as a standalone name segment (`qwen-image-2.1-UC-Q4_K_M.gguf`). */
const UC_SEGMENT = /(^|[-_.])uc([-_.]|$)/i;

/**
 * Whether a resolved unet filename is the Uncensored (UC) build.
 * Single source of truth: the main-process manager and the renderer badges
 * must agree on the heuristic, so neither re-derives it inline; a filename that
 * merely contains those letters can never be reported as UC.
 */
export const isUncensoredModel = (modelName: string | undefined | null): boolean =>
  Boolean(modelName && UC_SEGMENT.test(modelName));

/**
 * Phrases that explicitly REFUSE a face swap ("no face swap", "không đổi mặt").
 * Checked first so a prompt that merely bans swapping never triggers the LoRA.
 */
const FACE_SWAP_REFUSAL_PHRASES = [
  'no face swap',
  'without face swap',
  'do not swap',
  "don't swap",
  'not swap face',
  'keep the original face',
  'không đổi mặt',
  'không thay mặt',
  'không ghép mặt',
  'không đổi khuôn mặt',
  'không thay khuôn mặt',
  'không chuyển mặt',
  'không chuyển danh tính',
];

/** Whether a prompt explicitly forbids face swapping. */
export const isFaceSwapRefusal = (prompt: string): boolean => {
  if (!prompt) return false;
  const promptLower = prompt.toLowerCase();
  return FACE_SWAP_REFUSAL_PHRASES.some((phrase) => promptLower.includes(phrase));
};

/**
 * Whether a prompt asks for a face swap. The main-process manager routes on
 * this, so the keyword list lives here (next to the refusal guard it defers
 * to) instead of being re-derived at each call site.
 */
export const isFaceSwapPrompt = (prompt: string): boolean => {
  if (!prompt) return false;
  if (isFaceSwapRefusal(prompt)) return false;
  const promptLower = prompt.toLowerCase();
  return (
    prompt.includes('QWEN IDENTITY TRANSFER SPECIFICATION') ||
    prompt.includes('QWEN BRAND MODEL SPECIFICATION') ||
    prompt.includes('IDENTITY TRANSFER') ||
    prompt.includes('head_swap') ||
    promptLower.includes('face swap') ||
    promptLower.includes('faceswap') ||
    promptLower.includes('swap face') ||
    promptLower.includes('head swap') ||
    promptLower.includes('replace face') ||
    promptLower.includes('facial identity') ||
    promptLower.includes('đổi mặt') ||
    promptLower.includes('hoán đổi mặt') ||
    promptLower.includes('ghép mặt') ||
    promptLower.includes('thay mặt') ||
    promptLower.includes('đổi khuôn mặt') ||
    promptLower.includes('thay khuôn mặt') ||
    promptLower.includes('chuyển mặt') ||
    promptLower.includes('chuyển danh tính')
  );
};

/**
 * Whether the studio may show an Uncensored (UC) / Standard badge.
 * Returns `undefined` while detection has not resolved a unet on disk, so no
 * badge is rendered before the manager has actually reported a model.
 */
export const resolveUncensoredState = (
  status?: Pick<DesktopLocalQwenStatus, 'isUncensored' | 'activeModel'> | null,
): boolean | undefined => {
  if (!status) return undefined;
  if (typeof status.isUncensored === 'boolean') return status.isUncensored;
  return status.activeModel ? isUncensoredModel(status.activeModel) : undefined;
};

export interface LocalQwenProgress {
  step: number;
  maxSteps: number;
}

export interface DesktopLocalQwenStatus {
  state: DesktopLocalQwenState;
  isAppOwned: boolean;
  port: number;
  error?: string;
  progress?: LocalQwenProgress;
  /** Unet actually resolved on disk under the configured folder; absent while detection found none. */
  activeModel?: string;
  isUncensored?: boolean;
  /**
   * Model assets next to that unet. `undefined` while no unet resolved, so a
   * missing folder can never be mistaken for a missing model.
   */
  faceSwapLoraAvailable?: boolean;
  turboLoraAvailable?: boolean;
}
export interface DesktopLocalQwenStopResult {
  stopped: boolean;
  wasExternal: boolean;
}
export interface LocalQwenFolderCheck {
  exists: boolean;
  hasComfyUiMain: boolean;
}
export interface LocalQwenGenerateParams {
  prompt: string;
  negativePrompt?: string;
  images?: Array<{ base64: string; mimeType: string }>;
  resolution?: number;
  steps?: number;
  cfg?: number;
  sampler?: string;
  scheduler?: string;
  seed?: number;
  loraName?: string;
  loraStrength?: number;
  unetName?: string;
  workflow?: LocalQwenWorkflow;
}

export interface LocalQwenGenerateResult {
  image: {
    base64: string;
    mimeType: string;
  };
}

export interface LocalQwenUpscaleParams {
  image: string;
  scale?: number;
}

export interface LocalQwenUpscaleResult {
  image: string;
  mimeType?: string;
}

export interface DesktopLocalQwenApi {
  /** `folder` is the configured ComfyUI root the status should be resolved against. */
  getStatus(folder?: string): Promise<DesktopBridgeResult<DesktopLocalQwenStatus>>;
  startServer(folder?: string): Promise<DesktopBridgeResult<DesktopLocalQwenStatus>>;
  stopServer(): Promise<DesktopBridgeResult<DesktopLocalQwenStopResult>>;
  generateImage(params: LocalQwenGenerateParams): Promise<DesktopBridgeResult<LocalQwenGenerateResult>>;
  cancelJob(): Promise<DesktopBridgeResult<{ cancelled: boolean }>>;
  upscaleImage(params: { image: string; scale?: number }): Promise<DesktopBridgeResult<LocalQwenUpscaleResult>>;
  verifyFolder?(folder: string): Promise<DesktopBridgeResult<LocalQwenFolderCheck>>;
}

declare global {
  interface Window {
    desktopLocalQwen?: DesktopLocalQwenApi;
  }
}

/**
 * Dev-server transport, used only when the Electron preload bridge is absent.
 * `vite dev` mounts the same Local Qwen manager at `/api/local-qwen`, so the
 * web build drives the local ComfyUI exactly like the packaged app does.
 */
const createDevBridgeApi = (): DesktopLocalQwenApi => {
  const call = async <T>(action: string, payload?: unknown): Promise<DesktopBridgeResult<T>> => {
    try {
      const response = await fetch('/api/local-qwen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      return (await response.json()) as DesktopBridgeResult<T>;
    } catch {
      // A dev server that cannot answer is, from the user's side, no transport
      // at all: say that instead of leaking "Failed to fetch".
      return { ok: false, error: { message: LOCAL_QWEN_UNAVAILABLE_MESSAGE } };
    }
  };
  return {
    getStatus: (folder) => call<DesktopLocalQwenStatus>('getStatus', folder),
    startServer: (folder) => call<DesktopLocalQwenStatus>('startServer', folder),
    stopServer: () => call<DesktopLocalQwenStopResult>('stopServer'),
    generateImage: (params) => call<LocalQwenGenerateResult>('generateImage', params),
    cancelJob: () => call<{ cancelled: boolean }>('cancelJob'),
    upscaleImage: (params) => call<LocalQwenUpscaleResult>('upscaleImage', params),
    verifyFolder: (folder) => call<LocalQwenFolderCheck>('verifyFolder', folder),
  };
};

let devBridgeApi: DesktopLocalQwenApi | undefined;

/**
 * The transport that owns the ComfyUI runtime for this page: the Electron
 * preload in the packaged app, or the `vite dev` bridge in a dev-served
 * browser. A static production build owns neither, so the studio stays hidden
 * there instead of offering a Start button that cannot work.
 */
export const getDesktopLocalQwenApi = (): DesktopLocalQwenApi | undefined => {
  if (typeof window === 'undefined') return undefined;
  if (window.desktopLocalQwen) return window.desktopLocalQwen;
  if (!import.meta.env.DEV) return undefined;
  // No preload, but a dev server is hosting the manager. It answers with the
  // same `DesktopBridgeResult` envelope, so the studio behaves identically.
  devBridgeApi ??= createDevBridgeApi();
  return devBridgeApi;
};

export {
  classifyLocalQwenError,
  type LocalQwenErrorKind,
  type ClassifiedLocalQwenError,
} from '../utils/localQwenErrors';
