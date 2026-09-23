import { beforeEach, describe, expect, it, vi } from 'vitest';
import EventEmitter from 'node:events';
import fs from 'node:fs';
import type { ChildProcess } from 'node:child_process';
import type { Mock } from 'vitest';
import {
  LocalQwenManager,
  verifyLoopbackOnly,
  DEFAULT_COMFYUI_PORT,
  defaultHealthCheckFn,
  parseLocalQwenGenerateParams,
  parseLocalQwenUpscaleParams,
  parseLocalQwenFolder,
} from '../../electron/localQwenManager';

// Mock electron so importing localQwenManager or gateway does not fail in vitest
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    quit: vi.fn(),
    on: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

interface MockProcess extends EventEmitter {
  pid: number;
  killed: boolean;
  kill: Mock<(signal?: string) => boolean>;
  stderr: EventEmitter;
}

const createMockProcess = (pid = 12345): MockProcess => {
  const proc = new EventEmitter() as MockProcess;
  proc.pid = pid;
  proc.killed = false;
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn((signal?: string) => {
    proc.killed = true;
    proc.emit('exit', 0, signal ?? 'SIGTERM');
    return true;
  });
  return proc;
};

describe('LocalQwenManager', () => {
  describe('loopback enforcement', () => {
    it('accepts loopback 127.0.0.1 endpoints', () => {
      expect(verifyLoopbackOnly('http://127.0.0.1:8188/system_stats')).toBe(true);
      expect(verifyLoopbackOnly('http://127.0.0.1:9000/prompt')).toBe(true);
      expect(verifyLoopbackOnly('http://127.0.0.1')).toBe(true);
    });

    it('rejects non-loopback or dangerous endpoints', () => {
      // Must reject localhost (which can resolve to non-127 IPv6 or be spoofed)
      expect(verifyLoopbackOnly('http://localhost:8188/system_stats')).toBe(false);
      // Must reject 0.0.0.0
      expect(verifyLoopbackOnly('http://0.0.0.0:8188')).toBe(false);
      // Must reject LAN IP addresses
      expect(verifyLoopbackOnly('http://192.168.1.100:8188')).toBe(false);
      expect(verifyLoopbackOnly('http://10.0.0.1:8188')).toBe(false);
      // Must reject WAN / public hostnames
      expect(verifyLoopbackOnly('https://api.comfyui.cloud')).toBe(false);
      expect(verifyLoopbackOnly('http://evil.com:8188')).toBe(false);
      // Must reject invalid URLs
      expect(verifyLoopbackOnly('not-a-valid-url')).toBe(false);
    });

    it('throws security error if probing a non-127.0.0.1 endpoint', async () => {
      const manager = new LocalQwenManager();
      await expect(manager.probe('http://localhost:8188/system_stats')).rejects.toThrow(
        /Only loopback 127\.0\.0\.1 is permitted/,
      );
      await expect(manager.probe('http://192.168.1.1:8188/system_stats')).rejects.toThrow(
        /Only loopback 127\.0\.0\.1 is permitted/,
      );
    });
  });

  describe('probe functionality', () => {
    it('returns true when probe endpoint responds ok', async () => {
      const probeFn = vi.fn().mockResolvedValue(true);
      const manager = new LocalQwenManager({ probeFn });

      const result = await manager.probe();
      expect(result).toBe(true);
      expect(probeFn).toHaveBeenCalledWith(`http://127.0.0.1:${DEFAULT_COMFYUI_PORT}/system_stats`);
    });

    it('returns false when probe endpoint is not reachable', async () => {
      const probeFn = vi.fn().mockResolvedValue(false);
      const manager = new LocalQwenManager({ probeFn });

      const result = await manager.probe();
      expect(result).toBe(false);
    });
  });

  describe('ownership tracking on startServer', () => {
    it('marks pre-existing ComfyUI as externally owned and does not spawn process', async () => {
      // Simulate ComfyUI already responding
      const probeFn = vi.fn().mockResolvedValue(true);
      const spawnFn = vi.fn();

      const manager = new LocalQwenManager({ probeFn, spawnFn });

      const status = await manager.startServer('D:\\ComfyUI_windows_portable');

      expect(status.state).toBe('ready');
      expect(status.isAppOwned).toBe(false);
      expect(manager.isAppOwned).toBe(false);
      expect(spawnFn).not.toHaveBeenCalled();
    });

    it('spawns child process and marks as app-owned when ComfyUI is not running initially', async () => {
      let isReady = false;
      const probeFn = vi.fn().mockImplementation(async () => isReady);
      const mockProc = createMockProcess(9999);
      const spawnFn = vi.fn().mockImplementation(() => {
        // Once spawned, the next probe succeeds
        isReady = true;
        return mockProc as unknown as ChildProcess;
      });

      // Mock resolveLaunchCommand on manager instance
      const manager = new LocalQwenManager({
        probeFn,
        spawnFn,
        readinessPollIntervalMs: 10,
        readinessTimeoutMs: 1000,
      });

      vi.spyOn(manager, 'resolveLaunchCommand').mockReturnValue({
        executable: 'D:\\ComfyUI_windows_portable\\python_embeded\\python.exe',
        args: [
          '-s',
          'D:\\ComfyUI_windows_portable\\ComfyUI\\main.py',
          '--windows-standalone-build',
          '--listen',
          '127.0.0.1',
          '--port',
          '8188',
          '--disable-auto-launch',
        ],
      });

      // Mock folder existence check
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const status = await manager.startServer('D:\\ComfyUI_windows_portable');

      expect(status.state).toBe('ready');
      expect(status.isAppOwned).toBe(true);
      expect(manager.isAppOwned).toBe(true);
      expect(manager.childPid).toBe(9999);
      expect(spawnFn).toHaveBeenCalled();
    });
  });

  describe('safe stopServer behavior', () => {
    it('never kills external process when isAppOwned is false', async () => {
      const mockProc = createMockProcess();
      const manager = new LocalQwenManager();
      manager.isAppOwned = false;
      manager.childProcess = mockProc as unknown as ChildProcess;

      const stopResult = await manager.stopServer();

      expect(stopResult.stopped).toBe(false);
      expect(stopResult.wasExternal).toBe(true);
      expect(mockProc.kill).not.toHaveBeenCalled();
    });

    it('kills process and resets ownership when isAppOwned is true', async () => {
      const mockProc = createMockProcess();
      const manager = new LocalQwenManager();
      manager.isAppOwned = true;
      manager.state = 'ready';
      manager.childProcess = mockProc as unknown as ChildProcess;
      manager.childPid = 12345;

      const stopResult = await manager.stopServer();

      expect(stopResult.stopped).toBe(true);
      expect(stopResult.wasExternal).toBe(false);
      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
      expect(manager.isAppOwned).toBe(false);
      expect(manager.state).toBe('stopped');
      expect(manager.childProcess).toBeUndefined();
    });
  });

  describe('getStatus reporting', () => {
    it('reports stopped when server is not responding and no child process', async () => {
      const probeFn = vi.fn().mockResolvedValue(false);
      const manager = new LocalQwenManager({ probeFn });

      const status = await manager.getStatus();
      expect(status.state).toBe('stopped');
      expect(status.isAppOwned).toBe(false);
    });

    it('reports ready with isAppOwned: false for external running server', async () => {
      const probeFn = vi.fn().mockResolvedValue(true);
      const manager = new LocalQwenManager({ probeFn });
      manager.isAppOwned = false;

      const status = await manager.getStatus();
      expect(status.state).toBe('ready');
      expect(status.isAppOwned).toBe(false);
    });

    it('reports ready with isAppOwned: true for app-owned running server', async () => {
      const probeFn = vi.fn().mockResolvedValue(true);
      const manager = new LocalQwenManager({ probeFn });
      manager.isAppOwned = true;

      const status = await manager.getStatus();
      expect(status.state).toBe('ready');
      expect(status.isAppOwned).toBe(true);
    });

    it('reports starting when child process is active but server not yet responding', async () => {
      const probeFn = vi.fn().mockResolvedValue(false);
      const mockProc = createMockProcess();
      const manager = new LocalQwenManager({ probeFn });
      manager.state = 'starting';
      manager.isAppOwned = true;
      manager.childProcess = mockProc as unknown as ChildProcess;

      const status = await manager.getStatus();
      expect(status.state).toBe('starting');
      expect(status.isAppOwned).toBe(true);
    });

    it('preserves app ownership when probe fails transiently while tracked child is alive', async () => {
      const probeFn = vi.fn().mockResolvedValue(false);
      const mockProc = createMockProcess();
      const manager = new LocalQwenManager({ probeFn });
      manager.state = 'ready';
      manager.isAppOwned = true;
      manager.childProcess = mockProc as unknown as ChildProcess;

      const status = await manager.getStatus();
      expect(status.isAppOwned).toBe(true);
      expect(manager.isAppOwned).toBe(true);
      // Release GPU/RAM (stopServer) remains valid
      const stopResult = await manager.stopServer();
      expect(stopResult.stopped).toBe(true);
      expect(stopResult.wasExternal).toBe(false);
      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('keeps ownership when the tracked child was signalled but has not emitted exit', async () => {
      const probeFn = vi.fn().mockResolvedValue(false);
      const mockProc = createMockProcess();
      const manager = new LocalQwenManager({ probeFn });
      manager.state = 'ready';
      manager.isAppOwned = true;
      manager.childProcess = mockProc as unknown as ChildProcess;
      // Node sets `.killed` as soon as a signal is sent; the process may still
      // be running and has emitted no exit, so ownership must survive.
      mockProc.killed = true;

      const status = await manager.getStatus();

      expect(status.isAppOwned).toBe(true);
      expect(manager.isAppOwned).toBe(true);
      // Probe failed: never claim ready, and never drop to stopped
      expect(status.state).not.toBe('ready');
      expect(status.state).not.toBe('stopped');

      // Release GPU/RAM remains valid for the still-tracked child
      const stopResult = await manager.stopServer();
      expect(stopResult.stopped).toBe(true);
      expect(stopResult.wasExternal).toBe(false);
    });

    it('delayed exit or error from an old child does not mutate replacement child state', async () => {
      let spawnCount = 0;
      const child1 = createMockProcess(1001);
      const child2 = createMockProcess(1002);
      const spawnFn = vi.fn().mockImplementation(() => {
        spawnCount++;
        return spawnCount === 1 ? child1 : child2;
      });

      const probeFn = vi.fn().mockResolvedValue(true);
      const manager = new LocalQwenManager({
        probeFn,
        spawnFn,
        readinessPollIntervalMs: 10,
        readinessTimeoutMs: 1000,
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(manager, 'resolveLaunchCommand').mockReturnValue({
        executable: 'python.exe',
        args: ['main.py'],
      });

      // Initially probe false to force spawn
      probeFn.mockResolvedValueOnce(false).mockResolvedValue(true);
      await manager.startServer('D:\\ComfyUI_windows_portable');

      expect(manager.childProcess).toBe(child1);
      expect(manager.childPid).toBe(1001);
      expect(manager.isAppOwned).toBe(true);

      // Now spawn replacement child2
      probeFn.mockResolvedValueOnce(false).mockResolvedValue(true);
      await manager.startServer('D:\\ComfyUI_windows_portable');

      expect(manager.childProcess).toBe(child2);
      expect(manager.childPid).toBe(1002);
      expect(manager.isAppOwned).toBe(true);

      // Delayed exit from old child1
      child1.emit('exit', 0, 'SIGTERM');

      // Replacement child2 must still be tracked!
      expect(manager.childProcess).toBe(child2);
      expect(manager.childPid).toBe(1002);
      expect(manager.isAppOwned).toBe(true);
      expect(manager.state).toBe('ready');

      // Delayed error from old child1
      child1.emit('error', new Error('delayed error'));

      expect(manager.childProcess).toBe(child2);
      expect(manager.childPid).toBe(1002);
      expect(manager.isAppOwned).toBe(true);
      expect(manager.state).toBe('ready');
    });
  });

  describe('launch command options', () => {
    it('rejects UNC and remote network paths', () => {
      const manager = new LocalQwenManager();
      expect(() => manager.resolveLaunchCommand('\\\\remote-server\\share\\ComfyUI')).toThrow(/Security error.*UNC/);
      expect(() => manager.resolveLaunchCommand('//remote-server/share/ComfyUI')).toThrow(/Security error.*UNC/);
    });

    it('rejects non-existent folders during launch command resolution', () => {
      const manager = new LocalQwenManager();
      expect(() => manager.resolveLaunchCommand('D:\\NonExistent_Fake_Dir_12345')).toThrow(/directory not found/);
    });

    it('launch arguments never contain --disable-dynamic-vram', async () => {
      const realpathSpy = vi.spyOn(fs, 'realpathSync').mockImplementation((p) => p.toString());
      const statSpy = vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as fs.Stats);
      const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const manager = new LocalQwenManager();
      const { args } = manager.resolveLaunchCommand('D:\\ComfyUI_windows_portable');

      expect(args).toContain('--listen');
      expect(args).toContain('127.0.0.1');
      expect(args).toContain('--port');
      expect(args).toContain('8188');
      expect(args).toContain('--disable-auto-launch');
      expect(args).not.toContain('--disable-dynamic-vram');

      realpathSpy.mockRestore();
      statSpy.mockRestore();
      existsSpy.mockRestore();
    });
  });

  describe('ownership preservation on Retry startServer', () => {
    it('preserves isAppOwned: true when app-owned child is still alive and responding', async () => {
      const probeFn = vi.fn().mockResolvedValue(true);
      const mockProc = createMockProcess(1234);
      const manager = new LocalQwenManager({ probeFn });

      manager.isAppOwned = true;
      manager.state = 'error';
      manager.childProcess = mockProc as unknown as ChildProcess;
      manager.childPid = 1234;

      const status = await manager.startServer('D:\\ComfyUI_windows_portable');

      expect(status.state).toBe('ready');
      expect(status.isAppOwned).toBe(true);
      expect(manager.isAppOwned).toBe(true);
      expect(manager.childPid).toBe(1234);
    });

    it('sets isAppOwned: false when probe succeeds but no app child process exists', async () => {
      const probeFn = vi.fn().mockResolvedValue(true);
      const manager = new LocalQwenManager({ probeFn });

      manager.isAppOwned = false;
      manager.childProcess = undefined;

      const status = await manager.startServer('D:\\ComfyUI_windows_portable');

      expect(status.state).toBe('ready');
      expect(status.isAppOwned).toBe(false);
      expect(manager.isAppOwned).toBe(false);
    });
  });

  describe('compatibility probe and environment health', () => {
    it('marks error when /system_stats returns 200 but lacks system object', async () => {
      const probeFn = vi.fn().mockResolvedValue(true);
      const healthCheckFn = vi.fn().mockResolvedValue({
        compatible: false,
        error: 'ComfyUI /system_stats failed or returned unsupported version',
      });
      const manager = new LocalQwenManager({ probeFn, healthCheckFn });

      const status = await manager.getStatus();
      expect(status.state).toBe('error');
      expect(status.error).toContain('system_stats failed or returned unsupported version');
    });

    it('marks error when custom node ComfyUI-GGUF is missing', async () => {
      const probeFn = vi.fn().mockResolvedValue(true);
      const healthCheckFn = vi.fn().mockResolvedValue({
        compatible: false,
        error: 'ComfyUI is incompatible: custom node ComfyUI-GGUF is missing',
      });
      const manager = new LocalQwenManager({ probeFn, healthCheckFn });

      const status = await manager.getStatus();
      expect(status.state).toBe('error');
      expect(status.error).toContain('ComfyUI-GGUF is missing');
    });

    it('marks error on startServer if environment is incompatible', async () => {
      const probeFn = vi.fn().mockResolvedValue(true);
      const healthCheckFn = vi.fn().mockResolvedValue({
        compatible: false,
        error: 'UnetLoaderGGUF: qwen-image-2.1-Q4_K_M.gguf not found in models/diffusion_models',
      });
      const manager = new LocalQwenManager({ probeFn, healthCheckFn });

      const status = await manager.startServer();
      expect(status.state).toBe('error');
      expect(status.error).toContain('qwen-image-2.1-Q4_K_M.gguf not found');
    });

    it('defaultHealthCheckFn validates system_stats and node endpoints', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/system_stats')) {
          return new Response(JSON.stringify({ system: { os: 'nt', argv: [] } }), { status: 200 });
        }
        if (url.endsWith('/object_info/UnetLoaderGGUF')) {
          return new Response(
            JSON.stringify({
              UnetLoaderGGUF: {
                input: {
                  required: {
                    unet_name: [['qwen-image-2.1-Q4_K_M.gguf', 'other.gguf']],
                  },
                },
              },
            }),
            { status: 200 },
          );
        }
        if (url.endsWith('/object_info/TextEncodeQwenImage21')) {
          return new Response(JSON.stringify({ TextEncodeQwenImage21: {} }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const result = await defaultHealthCheckFn('http://127.0.0.1:8188', mockFetch as unknown as typeof fetch);
      expect(result.compatible).toBe(true);
    });

    it('defaultHealthCheckFn fails closed on thrown network/timeout error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8188'));
      const result = await defaultHealthCheckFn('http://127.0.0.1:8188', mockFetch as unknown as typeof fetch);
      expect(result.compatible).toBe(false);
      expect(result.error).toContain('ECONNREFUSED');
    });

    it('defaultHealthCheckFn fails closed on AbortError timeout', async () => {
      const timeoutError = new Error('The operation was aborted due to timeout');
      timeoutError.name = 'TimeoutError';
      const mockFetch = vi.fn().mockRejectedValue(timeoutError);
      const result = await defaultHealthCheckFn('http://127.0.0.1:8188', mockFetch as unknown as typeof fetch);
      expect(result.compatible).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('checkFolder validation', () => {
    it('returns exists: false for invalid or missing folder', () => {
      const manager = new LocalQwenManager();
      expect(manager.checkFolder('')).toEqual({ exists: false, hasComfyUiMain: false });
      expect(manager.checkFolder('   ')).toEqual({ exists: false, hasComfyUiMain: false });
      expect(manager.checkFolder('D:\\NonExistentPath_xyz_123')).toEqual({ exists: false, hasComfyUiMain: false });
    });

    it('returns exists: true and hasComfyUiMain: true for valid ComfyUI directory', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as fs.Stats);

      const manager = new LocalQwenManager();
      const result = manager.checkFolder('D:\\ComfyUI_windows_portable');
      expect(result.exists).toBe(true);
      expect(result.hasComfyUiMain).toBe(true);
    });
  });

  describe('IPC boundary validation (parse-first)', () => {
    it('parses valid generate params cleanly', () => {
      const parsed = parseLocalQwenGenerateParams({
        prompt: 'A beautiful portrait',
        negativePrompt: 'blurry, bad quality',
        resolution: 768,
        steps: 20,
        cfg: 2.0,
        sampler: 'Euler a',
        scheduler: 'Karras',
        seed: 42,
        images: [
          { base64: 'abc123==', mimeType: 'image/png' },
        ],
      });

      expect(parsed.prompt).toBe('A beautiful portrait');
      expect(parsed.resolution).toBe(768);
      expect(parsed.steps).toBe(20);
      expect(parsed.images?.length).toBe(1);
    });

    it('rejects generate params with missing or empty prompt', () => {
      expect(() => parseLocalQwenGenerateParams({})).toThrow(/prompt/);
      expect(() => parseLocalQwenGenerateParams({ prompt: '' })).toThrow(/prompt/);
      expect(() => parseLocalQwenGenerateParams({ prompt: '   ' })).toThrow(/prompt/);
    });

    it('rejects generate params with unsupported keys', () => {
      expect(() =>
        parseLocalQwenGenerateParams({
          prompt: 'valid',
          evilKey: 'malicious',
        }),
      ).toThrow(/unsupported field evilKey/);
    });

    it('accepts >4 reference images at generic IPC transport level (structured VTO/transfer flows)', () => {
      const sixImages = Array.from({ length: 6 }, (_, i) => ({
        base64: `img${i}`,
        mimeType: 'image/png',
      }));

      const parsed = parseLocalQwenGenerateParams({
        prompt: 'A stylish dress',
        images: sixImages,
      });
      expect(parsed.images).toHaveLength(6);
    });

    it('rejects out-of-range steps, cfg, or invalid sampler', () => {
      expect(() => parseLocalQwenGenerateParams({ prompt: 'test', steps: 0 })).toThrow(/steps/);
      expect(() => parseLocalQwenGenerateParams({ prompt: 'test', steps: 51 })).toThrow(/steps/);
      expect(() => parseLocalQwenGenerateParams({ prompt: 'test', cfg: 0.05 })).toThrow(/cfg/);
      expect(() => parseLocalQwenGenerateParams({ prompt: 'test', cfg: 10.5 })).toThrow(/cfg/);
      expect(() => parseLocalQwenGenerateParams({ prompt: 'test', sampler: 'FakeSampler' })).toThrow(/sampler/);
      expect(() => parseLocalQwenGenerateParams({ prompt: 'test', scheduler: 'FakeScheduler' })).toThrow(/scheduler/);
      expect(() => parseLocalQwenGenerateParams({ prompt: 'test', resolution: 600 })).toThrow(/resolution/);
    });

    it('parses valid upscale params and rejects malformed ones', () => {
      const valid = parseLocalQwenUpscaleParams({ image: 'base64-data', scale: 2 });
      expect(valid.image).toBe('base64-data');
      expect(valid.scale).toBe(2);

      expect(() => parseLocalQwenUpscaleParams({ image: '' })).toThrow(/upscale image/);
      expect(() => parseLocalQwenUpscaleParams({ image: 'valid', scale: 10 })).toThrow(/scale/);
      expect(() => parseLocalQwenUpscaleParams({ image: 'valid', extraKey: true })).toThrow(/unsupported field/);
    });

    it('parses folder and handles undefined/non-string', () => {
      expect(parseLocalQwenFolder(undefined)).toBeUndefined();
      expect(parseLocalQwenFolder(null)).toBeUndefined();
      expect(parseLocalQwenFolder('  D:\\ComfyUI  ')).toBe('D:\\ComfyUI');
      expect(() => parseLocalQwenFolder(123)).toThrow(/folder path/);
    });
  });
});
