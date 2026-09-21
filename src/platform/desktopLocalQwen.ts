import type { DesktopBridgeResult } from './desktopGateway';

export const DESKTOP_LOCAL_QWEN_CHANNELS = {
  getStatus: 'desktop-local-qwen:get-status',
  startServer: 'desktop-local-qwen:start-server',
  stopServer: 'desktop-local-qwen:stop-server',
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

export interface DesktopLocalQwenApi {
  getStatus(): Promise<DesktopBridgeResult<DesktopLocalQwenStatus>>;
  startServer(folder?: string): Promise<DesktopBridgeResult<DesktopLocalQwenStatus>>;
  stopServer(): Promise<DesktopBridgeResult<DesktopLocalQwenStopResult>>;
}

declare global {
  interface Window {
    desktopLocalQwen?: DesktopLocalQwenApi;
  }
}

export const getDesktopLocalQwenApi = (): DesktopLocalQwenApi | undefined =>
  typeof window === 'undefined' ? undefined : window.desktopLocalQwen;
