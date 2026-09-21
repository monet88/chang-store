import { beforeEach, describe, expect, it, vi } from 'vitest';
import EventEmitter from 'node:events';
import fs from 'node:fs';
import type { ChildProcess } from 'node:child_process';
import type { Mock } from 'vitest';
import {
  LocalQwenManager,
  verifyLoopbackOnly,
  DEFAULT_COMFYUI_PORT,
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
  });

  describe('launch command options', () => {
    it('launch arguments never contain --disable-dynamic-vram', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const manager = new LocalQwenManager();
      const { args } = manager.resolveLaunchCommand('D:\\ComfyUI_windows_portable');

      expect(args).toContain('--listen');
      expect(args).toContain('127.0.0.1');
      expect(args).toContain('--port');
      expect(args).toContain('8188');
      expect(args).toContain('--disable-auto-launch');
      expect(args).not.toContain('--disable-dynamic-vram');
    });
  });
});
