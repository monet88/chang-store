import type { DesktopBridgeErrorShape, DesktopBridgeResult } from '../src/platform/desktopGateway';

/**
 * Result envelope every desktop transport returns, so the renderer's
 * `DesktopBridgeResult<T>` contract holds no matter how the call reached the
 * manager: IPC (trustedBridge) or the dev-server HTTP bridge.
 */
export const bridgeError = (error: unknown): DesktopBridgeErrorShape => {
  const shaped = error as { message?: unknown; status?: unknown; code?: unknown };
  return {
    message: typeof shaped?.message === 'string' ? shaped.message : 'Desktop gateway request failed.',
    ...(typeof shaped?.status === 'number' ? { status: shaped.status } : {}),
    ...(typeof shaped?.code === 'string' ? { code: shaped.code } : {}),
  };
};

export const bridge = async <T>(task: () => Promise<T> | T): Promise<DesktopBridgeResult<T>> => {
  try {
    return { ok: true, value: await task() };
  } catch (error) {
    return { ok: false, error: bridgeError(error) };
  }
};
