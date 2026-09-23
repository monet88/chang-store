import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLocalQwenStatus } from '@/hooks/useLocalQwenStatus';
import { generateLocalQwenImage } from '@/services/providers/local-qwen/localQwenService';
import { saveLocalQwenSettings } from '@/config/localQwenSettings';
import type { DesktopLocalQwenStatus, DesktopLocalQwenStopResult } from '@/platform/desktopLocalQwen';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      if (key === 'studio.localQwenStatus.errors.failedToStart') return 'Failed to start local ComfyUI';
      return key;
    },
  }),
}));
describe('useLocalQwenStatus & First-use Auto-start', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    delete window.desktopLocalQwen;
  });

  describe('stopServer and releaseGpu', () => {
    it('calls desktop bridge stopServer and refreshes status', async () => {
      const mockStopResult: DesktopLocalQwenStopResult = {
        stopped: true,
        wasExternal: false,
      };
      const mockStoppedStatus: DesktopLocalQwenStatus = {
        state: 'stopped',
        isAppOwned: false,
        port: 8188,
      };

      const stopServerMock = vi.fn().mockResolvedValue({ ok: true, value: mockStopResult });
      const getStatusMock = vi.fn().mockResolvedValue({ ok: true, value: mockStoppedStatus });

      window.desktopLocalQwen = {
        getStatus: getStatusMock,
        startServer: vi.fn(),
        stopServer: stopServerMock,
        generateImage: vi.fn(),
        cancelJob: vi.fn(),
        upscaleImage: vi.fn(),
      };

      const { result } = renderHook(() => useLocalQwenStatus({ autoRefresh: false }));

      let stopRes: DesktopLocalQwenStopResult | undefined;
      await act(async () => {
        stopRes = await result.current.releaseGpu();
      });

      expect(stopServerMock).toHaveBeenCalledTimes(1);
      expect(stopRes).toEqual(mockStopResult);
      expect(result.current.status.state).toBe('stopped');
    });

    it('returns undefined when bridge is not available', async () => {
      const { result } = renderHook(() => useLocalQwenStatus({ autoRefresh: false }));

      let stopRes: DesktopLocalQwenStopResult | undefined;
      await act(async () => {
        stopRes = await result.current.releaseGpu();
      });

      expect(stopRes).toBeUndefined();
    });
  });

  describe('startServer and retry with persisted configured path', () => {
    it('startServer without argument uses persisted comfyUiPath', async () => {
      saveLocalQwenSettings({ comfyUiPath: 'D:\\CustomComfyUI' });

      const startServerMock = vi.fn().mockResolvedValue({
        ok: true,
        value: { state: 'ready', isAppOwned: true, port: 8188 },
      });

      window.desktopLocalQwen = {
        getStatus: vi.fn(),
        startServer: startServerMock,
        stopServer: vi.fn(),
        generateImage: vi.fn(),
        cancelJob: vi.fn(),
        upscaleImage: vi.fn(),
      };

      const { result } = renderHook(() => useLocalQwenStatus({ autoRefresh: false }));

      await act(async () => {
        await result.current.startServer();
      });

      expect(startServerMock).toHaveBeenCalledWith('D:\\CustomComfyUI');
      expect(result.current.status.state).toBe('ready');
    });

    it('uses localized fallback message when startServer throws without message', async () => {
      window.desktopLocalQwen = {
        getStatus: vi.fn().mockResolvedValue({ ok: true, value: { state: 'stopped', isAppOwned: false, port: 8188 } }),
        startServer: vi.fn().mockRejectedValue(new Error('')),
        stopServer: vi.fn(),
        generateImage: vi.fn(),
        cancelJob: vi.fn(),
        upscaleImage: vi.fn(),
      };

      const { result } = renderHook(() => useLocalQwenStatus({ autoRefresh: false }));

      await act(async () => {
        await result.current.startServer();
      });

      expect(result.current.status.state).toBe('error');
      expect(result.current.status.error).toBe('Failed to start local ComfyUI');
    });
    it('retry on stopped/error state invokes startServer with persisted path', async () => {
      saveLocalQwenSettings({ comfyUiPath: 'D:\\PersistedComfyUI' });

      const startServerMock = vi.fn().mockResolvedValue({
        ok: true,
        value: { state: 'ready', isAppOwned: true, port: 8188 },
      });

      window.desktopLocalQwen = {
        getStatus: vi.fn().mockResolvedValue({
          ok: true,
          value: { state: 'error', isAppOwned: false, port: 8188, error: 'Failed' },
        }),
        startServer: startServerMock,
        stopServer: vi.fn(),
        generateImage: vi.fn(),
        cancelJob: vi.fn(),
        upscaleImage: vi.fn(),
      };

      const { result } = renderHook(() => useLocalQwenStatus({ autoRefresh: false }));

      // Set initial status to error
      await act(async () => {
        await result.current.refreshStatus();
      });
      expect(result.current.status.state).toBe('error');

      // Now retry
      await act(async () => {
        await result.current.retry();
      });

      expect(startServerMock).toHaveBeenCalledWith('D:\\PersistedComfyUI');
    });
  });

  describe('first-use generation auto-start with configured path', () => {
    it('probes and auto-starts ComfyUI with configured path when server is stopped', async () => {
      saveLocalQwenSettings({ comfyUiPath: 'D:\\AutoStartComfyUI' });

      const getStatusMock = vi.fn().mockResolvedValue({
        ok: true,
        value: { state: 'stopped', isAppOwned: false, port: 8188 },
      });
      const startServerMock = vi.fn().mockResolvedValue({
        ok: true,
        value: { state: 'ready', isAppOwned: true, port: 8188 },
      });
      const generateImageMock = vi.fn().mockResolvedValue({
        ok: true,
        value: { image: { base64: 'generated-data', mimeType: 'image/png' } },
      });

      window.desktopLocalQwen = {
        getStatus: getStatusMock,
        startServer: startServerMock,
        stopServer: vi.fn(),
        generateImage: generateImageMock,
        cancelJob: vi.fn(),
        upscaleImage: vi.fn(),
      };

      const results = await generateLocalQwenImage({ prompt: 'Fashion dress' });

      expect(getStatusMock).toHaveBeenCalled();
      expect(startServerMock).toHaveBeenCalledWith('D:\\AutoStartComfyUI');
      expect(generateImageMock).toHaveBeenCalledWith({ prompt: 'Fashion dress' });
      expect(results[0].base64).toBe('generated-data');
    });

    it('fails locally without cloud fallback if auto-start fails', async () => {
      saveLocalQwenSettings({ comfyUiPath: 'D:\\BrokenComfyUI' });

      const getStatusMock = vi.fn().mockResolvedValue({
        ok: true,
        value: { state: 'stopped', isAppOwned: false, port: 8188 },
      });
      const startServerMock = vi.fn().mockResolvedValue({
        ok: false,
        error: { message: 'ComfyUI directory not found: D:\\BrokenComfyUI' },
      });

      window.desktopLocalQwen = {
        getStatus: getStatusMock,
        startServer: startServerMock,
        stopServer: vi.fn(),
        generateImage: vi.fn(),
        cancelJob: vi.fn(),
        upscaleImage: vi.fn(),
      };

      await expect(
        generateLocalQwenImage({ prompt: 'Fashion dress' }),
      ).rejects.toThrow(/ComfyUI directory not found/);
    });
  });
});
