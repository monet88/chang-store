import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDesktopLocalQwenApi,
  type DesktopLocalQwenStatus,
} from '../platform/desktopLocalQwen';
import { loadLocalQwenSettings } from '../config/localQwenSettings';

export interface UseLocalQwenStatusOptions {
  pollIntervalMs?: number;
  activeIntervalMs?: number;
  autoRefresh?: boolean;
}

export interface UseLocalQwenStatusReturn {
  status: DesktopLocalQwenStatus;
  isCancelling: boolean;
  isStarting: boolean;
  refreshStatus: () => Promise<DesktopLocalQwenStatus | undefined>;
  startServer: (folder?: string) => Promise<boolean>;
  cancelJob: () => Promise<boolean>;
  retry: () => Promise<void>;
}

export const useLocalQwenStatus = (
  options: UseLocalQwenStatusOptions = {},
): UseLocalQwenStatusReturn => {
  const {
    pollIntervalMs = 3000,
    activeIntervalMs = 500,
    autoRefresh = true,
  } = options;

  const [status, setStatus] = useState<DesktopLocalQwenStatus>({
    state: 'stopped',
    isAppOwned: false,
    port: 8188,
  });
  const [isCancelling, setIsCancelling] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const mountedRef = useRef(true);
  const latestRequestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshStatus = useCallback(async (): Promise<DesktopLocalQwenStatus | undefined> => {
    const api = getDesktopLocalQwenApi();
    if (!api) {
      return undefined;
    }

    const currentRequestId = ++latestRequestIdRef.current;
    try {
      const result = await api.getStatus();
      if (result.ok && mountedRef.current && currentRequestId === latestRequestIdRef.current) {
        setStatus(result.value);
        return result.value;
      }
    } catch {
      // Ignore transient polling failure
    }
    return undefined;
  }, []);

  const startServer = useCallback(
    async (folder?: string): Promise<boolean> => {
      const api = getDesktopLocalQwenApi();
      if (!api) {
        return false;
      }

      setIsStarting(true);
      try {
        const targetFolder = folder?.trim() || loadLocalQwenSettings().comfyUiPath || undefined;
        const result = await api.startServer(targetFolder);
        if (mountedRef.current) {
          if (result.ok === false) {
            setStatus({
              state: 'error',
              isAppOwned: false,
              port: 8188,
              error: result.error.message,
            });
          } else {
            setStatus(result.value);
            return true;
          }
        }
        return false;
      } catch (err) {
        if (mountedRef.current) {
          setStatus({
            state: 'error',
            isAppOwned: false,
            port: 8188,
            error: (err as Error).message || 'Failed to start local ComfyUI',
          });
        }
        return false;
      } finally {
        if (mountedRef.current) {
          setIsStarting(false);
        }
      }
    },
    [],
  );

  const cancelJob = useCallback(async (): Promise<boolean> => {
    const api = getDesktopLocalQwenApi();
    if (!api) {
      return false;
    }

    setIsCancelling(true);
    try {
      const result = await api.cancelJob();
      await refreshStatus();
      return result.ok ? result.value.cancelled : false;
    } catch {
      return false;
    } finally {
      if (mountedRef.current) {
        setIsCancelling(false);
      }
    }
  }, [refreshStatus]);

  const retry = useCallback(async (): Promise<void> => {
    if (status.state === 'error' || status.state === 'stopped') {
      const started = await startServer();
      if (!started) {
        await refreshStatus();
      }
    } else {
      await refreshStatus();
    }
  }, [status.state, startServer, refreshStatus]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    void refreshStatus();

    const intervalMs =
      status.state === 'generating' || status.state === 'starting'
        ? activeIntervalMs
        : pollIntervalMs;

    const timer = setInterval(() => {
      void refreshStatus();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [autoRefresh, status.state, activeIntervalMs, pollIntervalMs, refreshStatus]);

  return {
    status,
    isCancelling,
    isStarting,
    refreshStatus,
    startServer,
    cancelJob,
    retry,
  };
};
