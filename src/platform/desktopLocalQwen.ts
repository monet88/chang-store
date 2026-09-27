import type { DesktopBridgeResult } from './desktopGateway';

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

/** Workflow routing mode for Local Qwen generation (identity transfer / face swap / plain edit). */
export type LocalQwenWorkflow = 'identity-transfer' | 'face-swap' | 'standard';

/**
 * Whether a resolved unet filename is the Uncensored (UC) build.
 * Single source of truth: the main-process manager and the renderer badges
 * must agree on the heuristic, so neither re-derives it inline.
 */
export const isUncensoredModel = (modelName: string | undefined | null): boolean =>
  Boolean(modelName?.includes('UC'));

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
  /** Unet actually loaded for this generation (resolved when `unetName` was not passed). */
  activeUnetName?: string;
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

export const getDesktopLocalQwenApi = (): DesktopLocalQwenApi | undefined =>
  typeof window === 'undefined' ? undefined : window.desktopLocalQwen;

export {
  classifyLocalQwenError,
  type LocalQwenErrorKind,
  type ClassifiedLocalQwenError,
} from '../utils/localQwenErrors';
