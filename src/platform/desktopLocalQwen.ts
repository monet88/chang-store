import type { DesktopBridgeResult } from './desktopGateway';

export const DESKTOP_LOCAL_QWEN_CHANNELS = {
  getStatus: 'desktop-local-qwen:get-status',
  startServer: 'desktop-local-qwen:start-server',
  stopServer: 'desktop-local-qwen:stop-server',
  generateImage: 'desktop-local-qwen:generate-image',
  upscaleImage: 'desktop-local-qwen:upscale-image',
} as const;

export type DesktopLocalQwenState = 'stopped' | 'starting' | 'ready' | 'error';

export interface DesktopLocalQwenStatus {
  state: DesktopLocalQwenState;
  isAppOwned: boolean;
  port: number;
  error?: string;
}

export interface DesktopLocalQwenStopResult {
  stopped: boolean;
  wasExternal: boolean;
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
}

export interface DesktopLocalQwenApi {
  getStatus(): Promise<DesktopBridgeResult<DesktopLocalQwenStatus>>;
  startServer(folder?: string): Promise<DesktopBridgeResult<DesktopLocalQwenStatus>>;
  stopServer(): Promise<DesktopBridgeResult<DesktopLocalQwenStopResult>>;
  generateImage(params: LocalQwenGenerateParams): Promise<DesktopBridgeResult<LocalQwenGenerateResult>>;
  upscaleImage(params: { image: string; scale?: number }): Promise<DesktopBridgeResult<{ image: string }>>;
}

declare global {
  interface Window {
    desktopLocalQwen?: DesktopLocalQwenApi;
  }
}

export const getDesktopLocalQwenApi = (): DesktopLocalQwenApi | undefined =>
  typeof window === 'undefined' ? undefined : window.desktopLocalQwen;
