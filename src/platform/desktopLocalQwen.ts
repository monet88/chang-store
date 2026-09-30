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
 * Canonical phrases that explicitly REFUSE a face swap ("no face swap", "không đổi mặt").
 * Preserved for backward compatibility and fast-path substring check.
 */
export const FACE_SWAP_REFUSAL_PHRASES = [
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
] as const;

/**
 * Normalizes user prompt for robust refusal and intent matching:
 * 1. Lowercases the string.
 * 2. Strips apostrophes (e.g. "don't" -> "dont").
 * 3. Replaces hyphens/underscores with space (e.g. "face-swap" -> "face swap").
 * 4. Strips Vietnamese diacritics via NFD normalization into ASCII (e.g. "đừng" -> "dung", "đổi" -> "doi").
 * 5. Unifies compound "faceswap" into "face swap".
 * 6. Collapses multiple whitespace.
 */
export const normalizePromptForRefusal = (text: string): string =>
  text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[-_]/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/\bfaceswap\b/g, 'face swap')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Regex patterns matching refusal intent on normalized ASCII text:
 * - English negations & imperatives: no, without, do not, dont, never, not, stop, skip + face swap/swap face
 * - English retention: keep (the)? original face, keep face original
 * - Vietnamese negations & imperatives: khong, dung, cho + doi, thay, ghep, chuyen, hoan doi + mat, khuon mat, danh tinh
 * - Mixed language code-switching: khong/dung/cho + face swap
 * - Vietnamese retention: giu (nguyen)? (mat|khuon mat|mat goc)
 */
const REFUSAL_PATTERNS = [
  /\b(no|without|do not|dont|never|not|stop|skip)\s+(face\s*swap|swap\s*(the\s*)?face|swapping\s*face|head\s*swap)\b/i,
  /\b(do not|dont)\s+swap\b/i,
  /\bkeep\s+(the\s*)?original\s*face\b/i,
  /\bkeep\s+face\s+original\b/i,
  /\b(khong|dung|cho)\s+((doi|thay|ghep|chuyen|hoan\s*doi)\s+(khuon\s*mat|mat|danh\s*tinh)|face\s*swap)\b/i,
  /\bgiu\s+(nguyen\s+)?(mat(\s+goc)?|khuon\s*mat)\b/i,
];

/** Whether a prompt explicitly forbids face swapping. */
export const isFaceSwapRefusal = (prompt: string): boolean => {
  if (!prompt) return false;
  const promptLower = prompt.toLowerCase();
  if (FACE_SWAP_REFUSAL_PHRASES.some((phrase) => promptLower.includes(phrase))) {
    return true;
  }
  const norm = normalizePromptForRefusal(prompt);
  return REFUSAL_PATTERNS.some((pattern) => pattern.test(norm));
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
  // No preload, so only the dev bridge can answer, and only when the dev
  // server was started with LOCAL_QWEN_DEV_BRIDGE=true. It answers with the
  // same `DesktopBridgeResult` envelope, so the studio behaves identically.
  if (!import.meta.env.DEV || !import.meta.env.LOCAL_QWEN_DEV_BRIDGE) return undefined;
  devBridgeApi ??= createDevBridgeApi();
  return devBridgeApi;
};

export {
  classifyLocalQwenError,
  LOCAL_QWEN_UNAVAILABLE_MESSAGE,
  type LocalQwenErrorKind,
  type ClassifiedLocalQwenError,
} from '../utils/localQwenErrors';

export type { DesktopBridgeResult } from './desktopGateway';

