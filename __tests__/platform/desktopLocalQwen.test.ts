import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOCAL_QWEN_SETTINGS,
  KNOWN_PORTABLE_COMFYUI_PATH,
  LOCAL_QWEN_SETTINGS_KEY,
  detectPortableComfyUiPath,
  loadLocalQwenSettings,
  saveLocalQwenSettings,
  snapshotLocalQwenSettings,
} from '@/config/localQwenSettings';
import {
  DESKTOP_LOCAL_QWEN_CHANNELS,
  getDesktopLocalQwenApi,
  type DesktopLocalQwenApi,
  type DesktopLocalQwenStatus,
  type DesktopLocalQwenStopResult,
} from '@/platform/desktopLocalQwen';

describe('desktopLocalQwen and settings', () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.desktopLocalQwen;
  });

  describe('settings defaults and persistence', () => {
    it('returns approved default settings when storage is empty', () => {
      const settings = loadLocalQwenSettings();
      expect(settings.resolution).toBe(512);
      expect(settings.steps).toBe(16);
      expect(settings.cfg).toBe(1.0);
      expect(settings.sampler).toBe('Euler');
      expect(settings.scheduler).toBe('Simple');
      if (process.platform === 'win32') {
        expect(settings.comfyUiPath).toBe(KNOWN_PORTABLE_COMFYUI_PATH);
      }
    });

    it('persists and reloads updated settings', () => {
      saveLocalQwenSettings({
        resolution: 768,
        steps: 24,
        cfg: 2.5,
        sampler: 'DPM++ 2M',
        scheduler: 'Karras',
        comfyUiPath: 'C:\\ComfyUI',
      });

      const loaded = loadLocalQwenSettings();
      expect(loaded.resolution).toBe(768);
      expect(loaded.steps).toBe(24);
      expect(loaded.cfg).toBe(2.5);
      expect(loaded.sampler).toBe('DPM++ 2M');
      expect(loaded.scheduler).toBe('Karras');
      expect(loaded.comfyUiPath).toBe('C:\\ComfyUI');

      const raw = JSON.parse(localStorage.getItem(LOCAL_QWEN_SETTINGS_KEY) ?? '{}');
      expect(raw.resolution).toBe(768);
      expect(raw.steps).toBe(24);
    });

    it('partially updates settings while preserving other fields', () => {
      saveLocalQwenSettings({ steps: 30 });
      let loaded = loadLocalQwenSettings();
      expect(loaded.steps).toBe(30);
      expect(loaded.resolution).toBe(512);

      saveLocalQwenSettings({ resolution: 1024 });
      loaded = loadLocalQwenSettings();
      expect(loaded.steps).toBe(30);
      expect(loaded.resolution).toBe(1024);
    });
  });

  describe('validation ranges and sanitization', () => {
    it('sanitizes and clamps out-of-range steps and cfg values', () => {
      // Steps below min (1) or above max (50)
      saveLocalQwenSettings({ steps: 0, cfg: 0.01 });
      let loaded = loadLocalQwenSettings();
      expect(loaded.steps).toBe(1);
      expect(loaded.cfg).toBe(0.1);

      saveLocalQwenSettings({ steps: 999, cfg: 99.9 });
      loaded = loadLocalQwenSettings();
      expect(loaded.steps).toBe(50);
      expect(loaded.cfg).toBe(10.0);
    });

    it('falls back to defaults for invalid resolution, sampler, or scheduler', () => {
      localStorage.setItem(
        LOCAL_QWEN_SETTINGS_KEY,
        JSON.stringify({
          resolution: 999,
          sampler: 'InvalidSampler',
          scheduler: 'InvalidScheduler',
        }),
      );

      const loaded = loadLocalQwenSettings();
      expect(loaded.resolution).toBe(512);
      expect(loaded.sampler).toBe('Euler');
      expect(loaded.scheduler).toBe('Simple');
    });

    it('accepts all curated resolutions, samplers, and schedulers', () => {
      saveLocalQwenSettings({
        resolution: 1024,
        sampler: 'Euler a',
        scheduler: 'Normal',
      });
      let loaded = loadLocalQwenSettings();
      expect(loaded.resolution).toBe(1024);
      expect(loaded.sampler).toBe('Euler a');
      expect(loaded.scheduler).toBe('Normal');

      saveLocalQwenSettings({
        sampler: 'DPM++ 2M SDE',
        scheduler: 'Karras',
      });
      loaded = loadLocalQwenSettings();
      expect(loaded.sampler).toBe('DPM++ 2M SDE');
      expect(loaded.scheduler).toBe('Karras');
    });
  });

  describe('snapshotting', () => {
    it('creates an immutable frozen snapshot that does not mutate when settings change later', () => {
      saveLocalQwenSettings({ resolution: 512, steps: 16 });
      const snapshot = snapshotLocalQwenSettings();

      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(snapshot.resolution).toBe(512);
      expect(snapshot.steps).toBe(16);

      // Mutate settings in storage afterwards
      saveLocalQwenSettings({ resolution: 1024, steps: 40 });

      // Snapshot must retain original values
      expect(snapshot.resolution).toBe(512);
      expect(snapshot.steps).toBe(16);

      // Latest loaded settings reflect new values
      const current = loadLocalQwenSettings();
      expect(current.resolution).toBe(1024);
      expect(current.steps).toBe(40);
    });
  });

  describe('portable path auto-detection', () => {
    it('detects known portable install on Windows and returns empty string on other platforms', () => {
      expect(detectPortableComfyUiPath('win32')).toBe(KNOWN_PORTABLE_COMFYUI_PATH);
      expect(detectPortableComfyUiPath('darwin')).toBe('');
      expect(detectPortableComfyUiPath('linux')).toBe('');
    });
  });

  describe('bridge API access and invocation', () => {
    it('returns undefined when running in browser mode without desktopLocalQwen', () => {
      expect(getDesktopLocalQwenApi()).toBeUndefined();
    });

    it('provides typed bridge methods when running in desktop mode', async () => {
      const mockStatus: DesktopLocalQwenStatus = {
        state: 'ready',
        isAppOwned: true,
        port: 8188,
      };
      const mockStop: DesktopLocalQwenStopResult = {
        stopped: true,
        wasExternal: false,
      };

      const mockFolderCheck = {
        exists: true,
        hasComfyUiMain: true,
      };

      const mockApi: DesktopLocalQwenApi = {
        getStatus: vi.fn().mockResolvedValue({ ok: true, value: mockStatus }),
        startServer: vi.fn().mockResolvedValue({ ok: true, value: mockStatus }),
        stopServer: vi.fn().mockResolvedValue({ ok: true, value: mockStop }),
        generateImage: vi.fn().mockResolvedValue({ ok: true, value: { image: { base64: 'abc', mimeType: 'image/png' } } }),
        cancelJob: vi.fn().mockResolvedValue({ ok: true, value: { cancelled: true } }),
        upscaleImage: vi.fn().mockResolvedValue({ ok: true, value: { image: 'upscaled' } }),
        verifyFolder: vi.fn().mockResolvedValue({ ok: true, value: mockFolderCheck }),
      };

      Object.defineProperty(window, 'desktopLocalQwen', {
        value: mockApi,
        configurable: true,
      });

      const api = getDesktopLocalQwenApi();
      expect(api).toBeDefined();

      const statusRes = await api!.getStatus();
      expect(mockApi.getStatus).toHaveBeenCalled();
      expect(statusRes).toEqual({ ok: true, value: mockStatus });

      const startRes = await api!.startServer('D:\\ComfyUI');
      expect(mockApi.startServer).toHaveBeenCalledWith('D:\\ComfyUI');
      expect(startRes).toEqual({ ok: true, value: mockStatus });

      const stopRes = await api!.stopServer();
      expect(mockApi.stopServer).toHaveBeenCalled();
      expect(stopRes).toEqual({ ok: true, value: mockStop });

      const genRes = await api!.generateImage({ prompt: 'test' });
      expect(mockApi.generateImage).toHaveBeenCalledWith({ prompt: 'test' });
      expect(genRes).toEqual({ ok: true, value: { image: { base64: 'abc', mimeType: 'image/png' } } });

      const cancelRes = await api!.cancelJob();
      expect(mockApi.cancelJob).toHaveBeenCalled();
      expect(cancelRes).toEqual({ ok: true, value: { cancelled: true } });

      const upscaleRes = await api!.upscaleImage({ image: 'abc', scale: 2 });
      expect(mockApi.upscaleImage).toHaveBeenCalledWith({ image: 'abc', scale: 2 });
      expect(upscaleRes).toEqual({ ok: true, value: { image: 'upscaled' } });

      const folderRes = await api!.verifyFolder!('D:\\ComfyUI');
      expect(mockApi.verifyFolder).toHaveBeenCalledWith('D:\\ComfyUI');
      expect(folderRes).toEqual({ ok: true, value: mockFolderCheck });
    });

    it('has channel constants matching the desktop-local-qwen prefix and exactly pins the named bridge surface', () => {
      expect(DESKTOP_LOCAL_QWEN_CHANNELS).toEqual({
        getStatus: 'desktop-local-qwen:get-status',
        startServer: 'desktop-local-qwen:start-server',
        stopServer: 'desktop-local-qwen:stop-server',
        generateImage: 'desktop-local-qwen:generate-image',
        cancelJob: 'desktop-local-qwen:cancel-job',
        upscaleImage: 'desktop-local-qwen:upscale-image',
        verifyFolder: 'desktop-local-qwen:verify-folder',
      });

      const channelKeys = Object.keys(DESKTOP_LOCAL_QWEN_CHANNELS).sort();
      expect(channelKeys).toEqual([
        'cancelJob',
        'generateImage',
        'getStatus',
        'startServer',
        'stopServer',
        'upscaleImage',
        'verifyFolder',
      ]);

      const channelValues = Object.values(DESKTOP_LOCAL_QWEN_CHANNELS);
      channelValues.forEach((channel) => {
        expect(channel).toMatch(/^desktop-local-qwen:/);
        expect(channel).not.toMatch(/shell|exec|spawn|proxy|cmd|eval/i);
      });
    });
  });
});
