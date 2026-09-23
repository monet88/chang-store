import { describe, expect, it, vi } from 'vitest';
import EventEmitter from 'node:events';
import fs from 'node:fs';
import type { ChildProcess } from 'node:child_process';
import type { Mock } from 'vitest';
import {
  LocalQwenManager,
  type WebSocketLike,
  type WebSocketConstructor,
} from '../../electron/localQwenManager';
import {
  classifyLocalQwenError,
  type DesktopLocalQwenStatus,
} from '../../src/platform/desktopLocalQwen';

vi.mock('electron', () => ({
  app: {
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
    queueMicrotask(() => {
      proc.emit('exit', 0, signal ?? 'SIGTERM');
    });
    return true;
  });
  return proc;
};

class MockWebSocket extends EventEmitter implements WebSocketLike {
  public static instances: MockWebSocket[] = [];
  public url: string;
  public onmessage: ((event: { data: unknown }) => void) | null = null;

  constructor(url: string) {
    super();
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  public close(): void {
    this.emit('close');
  }

  public simulateMessage(data: unknown): void {
    const event = { data: typeof data === 'string' ? data : JSON.stringify(data) };
    this.emit('message', event);
    this.onmessage?.(event);
  }
}

describe('LocalQwenManager Lifecycle, Cancellation, and Progress', () => {
  describe('cancellation behavior', () => {
    it('sends POST to /interrupt and sets state to error with cancellation message', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/interrupt')) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        }
        return Promise.resolve(new Response('Not found', { status: 404 }));
      });

      const manager = new LocalQwenManager({ fetchFn: mockFetch });
      manager.state = 'generating';
      manager.currentProgress = { step: 5, maxSteps: 16 };

      const result = await manager.cancelJob();

      expect(result).toEqual({ cancelled: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8188/interrupt',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(manager.state).toBe('error');
      expect(manager.lastError).toBe('Generation cancelled by user');
      expect(manager.currentProgress).toBeUndefined();

      const classified = classifyLocalQwenError(manager.lastError);
      expect(classified.kind).toBe('cancellation');
    });

    it('returns cancelled: true and proceeds cleanly even if /interrupt fails network-wise', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const manager = new LocalQwenManager({ fetchFn: mockFetch });
      manager.state = 'generating';

      const result = await manager.cancelJob();
      expect(result).toEqual({ cancelled: true });
      expect(manager.state).toBe('error');
    });

    it('cancels hung in-flight loopback fetch and releases generation job path', async () => {
      let promptSignal: AbortSignal | undefined;
      const { promise: promptStarted, resolve: signalPromptStarted } = Promise.withResolvers<void>();
      const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/system_stats')) {
          return Promise.resolve(new Response(JSON.stringify({ system: { os: 'windows' } }), { status: 200 }));
        }
        if (url.endsWith('/interrupt')) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        }
        if (url.endsWith('/prompt')) {
          promptSignal = init?.signal as AbortSignal | undefined;
          const { promise, reject } = Promise.withResolvers<Response>();
          promptSignal?.addEventListener(
            'abort',
            () => {
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            },
            { once: true },
          );
          signalPromptStarted();
          return promise;
        }
        return Promise.resolve(new Response('{}', { status: 200 }));
      });

      const manager = new LocalQwenManager({
        probeFn: vi.fn().mockResolvedValue(true),
        fetchFn: mockFetch,
      });
      const genPromise = manager.generateImage({
        prompt: 'test prompt',
      });

      await promptStarted;
      expect(manager.state).toBe('generating');
      expect(promptSignal).toBeDefined();
      expect(promptSignal?.aborted).toBe(false);

      await manager.cancelJob();

      await expect(genPromise).rejects.toThrow('Generation cancelled by user');
      expect(manager.state).not.toBe('generating');
    });

    it('immediately transitions active job to error and exposes concrete failure when process exits during generation', async () => {
      const { promise: promptStarted, resolve: signalPromptStarted } = Promise.withResolvers<void>();
      const mockProc = createMockProcess(5555);

      const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/prompt')) {
          signalPromptStarted();
          const { promise, reject } = Promise.withResolvers<Response>();
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
          return promise;
        }
        return Promise.resolve(new Response('{}', { status: 200 }));
      });
      let isReady = false;
      const probeFn = vi.fn().mockImplementation(async () => isReady);
      const spawnFn = vi.fn().mockImplementation(() => {
        isReady = true;
        return mockProc;
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const manager = new LocalQwenManager({
        probeFn,
        fetchFn: mockFetch,
        spawnFn,
        readinessPollIntervalMs: 10,
        readinessTimeoutMs: 1000,
      });
      vi.spyOn(manager, 'resolveLaunchCommand').mockReturnValue({
        executable: 'python.exe',
        args: ['main.py'],
      });

      await manager.startServer('D:\\ComfyUI');
      const genPromise = manager.generateImage({
        prompt: 'test prompt',
      });

      await promptStarted;
      expect(manager.state).toBe('generating');

      // Simulate unexpected crash of the child process
      mockProc.emit('exit', 1, null);

      await expect(genPromise).rejects.toThrow(/ComfyUI process exited unexpectedly/);
      expect(manager.state).toBe('error');
      expect(manager.lastError).toContain('ComfyUI process exited unexpectedly');
    });
  });

  describe('quit hook behavior (handleBeforeQuit)', () => {
    it('cancels active job and stops owned child process on before-quit', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
      const mockProc = createMockProcess(9876);
      const manager = new LocalQwenManager({ fetchFn: mockFetch });

      manager.isAppOwned = true;
      manager.state = 'generating';
      manager.childProcess = mockProc as unknown as ChildProcess;

      const cancelSpy = vi.spyOn(manager, 'cancelJob');
      const stopSpy = vi.spyOn(manager, 'stopServer');

      await manager.handleBeforeQuit();

      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect(stopSpy).toHaveBeenCalledTimes(1);
      expect(manager.isAppOwned).toBe(false);
      expect(manager.state).toBe('stopped');
    });

    it('stops owned child process without cancelling when state is ready', async () => {
      const mockProc = createMockProcess(9876);
      const manager = new LocalQwenManager();

      manager.isAppOwned = true;
      manager.state = 'ready';
      manager.childProcess = mockProc as unknown as ChildProcess;

      const cancelSpy = vi.spyOn(manager, 'cancelJob');
      const stopSpy = vi.spyOn(manager, 'stopServer');

      await manager.handleBeforeQuit();

      expect(cancelSpy).not.toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalledTimes(1);
      expect(manager.isAppOwned).toBe(false);
      expect(manager.state).toBe('stopped');
    });

    it('never terminates or stops externally owned ComfyUI on before-quit', async () => {
      const mockProc = createMockProcess(9999);
      const manager = new LocalQwenManager();

      // Externally owned instance
      manager.isAppOwned = false;
      manager.state = 'ready';
      manager.childProcess = mockProc as unknown as ChildProcess;

      const cancelSpy = vi.spyOn(manager, 'cancelJob');
      const stopSpy = vi.spyOn(manager, 'stopServer');

      await manager.handleBeforeQuit();

      expect(cancelSpy).not.toHaveBeenCalled();
      expect(stopSpy).not.toHaveBeenCalled();
      // External process was NOT killed
      expect(mockProc.kill).not.toHaveBeenCalled();
    });

    it('cancels active job without killing process when externally owned and generating on before-quit', async () => {
      const mockProc = createMockProcess(9999);
      const manager = new LocalQwenManager();

      manager.isAppOwned = false;
      manager.state = 'generating';
      manager.childProcess = mockProc as unknown as ChildProcess;

      const cancelSpy = vi.spyOn(manager, 'cancelJob');
      const stopSpy = vi.spyOn(manager, 'stopServer');

      await manager.handleBeforeQuit();

      expect(cancelSpy).not.toHaveBeenCalled();
      expect(stopSpy).not.toHaveBeenCalled();
      expect(mockProc.kill).not.toHaveBeenCalled();
    });

    it('strictly executes cancelJob BEFORE stopServer when app-owned server is generating during quit', async () => {
      const mockProc = createMockProcess(1234);
      const manager = new LocalQwenManager();
      manager.isAppOwned = true;
      manager.state = 'generating';
      manager.childProcess = mockProc as unknown as ChildProcess;

      const executionOrder: string[] = [];
      vi.spyOn(manager, 'cancelJob').mockImplementation(async () => {
        executionOrder.push('cancelJob');
        manager.state = 'stopped';
        return { cancelled: true };
      });
      vi.spyOn(manager, 'stopServer').mockImplementation(async () => {
        executionOrder.push('stopServer');
        manager.isAppOwned = false;
        return { stopped: true, wasExternal: false };
      });

      await manager.handleBeforeQuit();

      expect(executionOrder).toEqual(['cancelJob', 'stopServer']);
    });

    it('wires app before-quit event listener properly to call handleBeforeQuit', async () => {
      const manager = new LocalQwenManager();
      manager.isAppOwned = true;
      const handleBeforeQuitSpy = vi.spyOn(manager, 'handleBeforeQuit').mockResolvedValue();

      // Simulate electron app EventEmitter
      const appEmitter = new EventEmitter() as EventEmitter & { quit: () => void };
      appEmitter.quit = vi.fn();

      let isStoppingComfyUI = false;
      appEmitter.on('before-quit', (event: { preventDefault: () => void }) => {
        if (manager.isAppOwned && !isStoppingComfyUI) {
          event.preventDefault();
          isStoppingComfyUI = true;
          void manager.handleBeforeQuit().finally(() => {
            appEmitter.quit();
          });
        }
      });

      const preventDefaultMock = vi.fn();
      appEmitter.emit('before-quit', { preventDefault: preventDefaultMock });

      expect(preventDefaultMock).toHaveBeenCalledTimes(1);
      expect(handleBeforeQuitSpy).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      expect(appEmitter.quit).toHaveBeenCalledTimes(1);
    });
  });

  describe('progress tracking and getStatus', () => {
    it('reports generating state with step progress when generating', async () => {
      const manager = new LocalQwenManager();
      manager.state = 'generating';
      manager.isAppOwned = true;
      manager.currentProgress = { step: 7, maxSteps: 16 };

      const status: DesktopLocalQwenStatus = await manager.getStatus();

      expect(status.state).toBe('generating');
      expect(status.isAppOwned).toBe(true);
      expect(status.progress).toEqual({ step: 7, maxSteps: 16 });
    });

    it('updates currentProgress via ComfyUI websocket progress messages', async () => {
      MockWebSocket.instances = [];
      const probeFn = vi.fn().mockResolvedValue(true);
      let hasCompleted = false;
      let promptSent = false;

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/prompt')) {
          promptSent = true;
          return Promise.resolve(new Response(JSON.stringify({ prompt_id: 'pid-123' }), { status: 200 }));
        }
        if (url.includes('/history/pid-123')) {
          if (!hasCompleted) {
            return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
          }
          return Promise.resolve(
            new Response(
              JSON.stringify({
                'pid-123': {
                  outputs: {
                    '9': {
                      images: [{ filename: 'out.png', subfolder: '', type: 'output' }],
                    },
                  },
                },
              }),
              { status: 200 },
            ),
          );
        }
        if (url.includes('/view?filename=out.png')) {
          return Promise.resolve(new Response(Buffer.from('image-data'), { status: 200 }));
        }
        return Promise.resolve(new Response('{}', { status: 200 }));
      });

      const manager = new LocalQwenManager({
        probeFn,
        fetchFn: mockFetch,
        wsConstructor: MockWebSocket as unknown as WebSocketConstructor,
      });

      // Start generation
      const genPromise = manager.generateImage({ prompt: 'test portrait', steps: 20 });
      await new Promise((r) => setTimeout(r, 10));

      // Check WS instance created
      expect(MockWebSocket.instances.length).toBe(1);
      const ws = MockWebSocket.instances[0];

      // Simulate progress message from ComfyUI
      ws.simulateMessage({
        type: 'progress',
        data: { value: 12, max: 20 },
      });

      expect(manager.currentProgress).toEqual({ step: 12, maxSteps: 20 });

      const status = await manager.getStatus();
      expect(status.state).toBe('generating');
      expect(status.progress).toEqual({ step: 12, maxSteps: 20 });

      hasCompleted = true;
      const result = await genPromise;
      expect(result.image.base64).toBeDefined();
      expect(manager.state).toBe('ready');
      expect(manager.currentProgress).toBeUndefined();
    });
  });

  describe('error classifications and actionable suggestions', () => {
    it('classifies startup failures', () => {
      const cases = [
        'ComfyUI directory not found: D:\\invalid\\path',
        'Timed out waiting for ComfyUI to become ready: logs',
        'ComfyUI process exited prematurely with code 1',
        'connect ECONNREFUSED 127.0.0.1:8188',
      ];

      for (const msg of cases) {
        const classified = classifyLocalQwenError(msg);
        expect(classified.kind).toBe('startup');
        expect(classified.actionableSuggestion).toContain('Settings');
        expect(classified.actionableSuggestion).not.toContain('Gemini');
        expect(classified.actionableSuggestion).not.toContain('cloud');
      }
    });

    it('classifies incompatible health failures', () => {
      const cases = [
        'ComfyUI is incompatible: custom node ComfyUI-GGUF is missing',
        'ComfyUI /system_stats failed or returned unsupported version',
      ];

      for (const msg of cases) {
        const classified = classifyLocalQwenError(msg);
        expect(classified.kind).toBe('incompatible_health');
        expect(classified.actionableSuggestion).toContain('ComfyUI-GGUF');
      }
    });

    it('classifies missing model failures', () => {
      const cases = [
        'UnetLoaderGGUF: qwen-image-2.1-Q4_K_M.gguf not found',
        'CLIPLoader: qwen3vl_8b_w4a8.safetensors missing from models/text_encoders',
        'VAELoader: qwen_image_2.1_vae_bf16.safetensors does not exist',
        'FileNotFoundError: [Errno 2] No such file or directory: models/diffusion_models',
      ];

      for (const msg of cases) {
        const classified = classifyLocalQwenError(msg);
        expect(classified.kind).toBe('missing_model');
        expect(classified.actionableSuggestion).toContain('models');
      }
    });

    it('classifies invalid workflow failures', () => {
      const cases = [
        'ComfyUI prompt rejected (400): Prompt graph contains cycle',
        'workflow error: Value not in list for sampler_name',
      ];

      for (const msg of cases) {
        const classified = classifyLocalQwenError(msg);
        expect(classified.kind).toBe('invalid_workflow');
        expect(classified.actionableSuggestion).toContain('workflow');
      }
    });

    it('classifies cancellation failures', () => {
      const cases = [
        'Generation cancelled by user',
        'Execution interrupted',
        'Aborted by client',
      ];

      for (const msg of cases) {
        const classified = classifyLocalQwenError(msg);
        expect(classified.kind).toBe('cancellation');
        expect(classified.title).toBe('Generation Cancelled');
      }
    });

    it('classifies OOM failures', () => {
      const cases = [
        'torch.cuda.OutOfMemoryError: CUDA out of memory. Tried to allocate 2.00 GiB',
        'CUDA error: out of memory on device',
        'VRAM exceeded: allocated 7.9GB of 8.0GB',
      ];

      for (const msg of cases) {
        const classified = classifyLocalQwenError(msg);
        expect(classified.kind).toBe('oom');
        expect(classified.actionableSuggestion).toContain('512');
        expect(classified.actionableSuggestion).toContain('Settings');
      }
    });

    it('renders localized title and suggestion when t function is provided', () => {
      const mockT = vi.fn((key: string) => {
        if (key === 'studio.localQwenStatus.errors.oom.title') return 'GPU Hết Bộ Nhớ';
        if (key === 'studio.localQwenStatus.errors.oom.suggestion') return 'Giảm độ phân giải xuống 512';
        return key;
      });

      const classified = classifyLocalQwenError('CUDA out of memory', mockT);
      expect(classified.kind).toBe('oom');
      expect(classified.titleKey).toBe('studio.localQwenStatus.errors.oom.title');
      expect(classified.suggestionKey).toBe('studio.localQwenStatus.errors.oom.suggestion');
      expect(classified.title).toBe('GPU Hết Bộ Nhớ');
      expect(classified.actionableSuggestion).toBe('Giảm độ phân giải xuống 512');
      expect(mockT).toHaveBeenCalledWith('studio.localQwenStatus.errors.oom.title');
      expect(mockT).toHaveBeenCalledWith('studio.localQwenStatus.errors.oom.suggestion');
    });

    it('distinguishes missing node types from missing model files', () => {
      const missingNodeCases = [
        'Cannot find node type UnetLoaderGGUF',
        'Invalid node TextEncodeQwenImage21',
        'Node type UnetLoaderGGUF not found',
      ];
      for (const msg of missingNodeCases) {
        const classified = classifyLocalQwenError(msg);
        expect(classified.kind).toBe('incompatible_health');
      }

      const missingModelCases = [
        'UnetLoaderGGUF: qwen-image-2.1-Q4_K_M.gguf not found',
        'CLIPLoader: qwen3vl_8b_w4a8.safetensors missing from models/text_encoders',
      ];
      for (const msg of missingModelCases) {
        const classified = classifyLocalQwenError(msg);
        expect(classified.kind).toBe('missing_model');
      }
    });

    it('handles circular and non-serializable objects gracefully without throwing', () => {
      const circular: Record<string, unknown> = { error: 'something crashed' };
      circular.self = circular;

      expect(() => classifyLocalQwenError(circular)).not.toThrow();
      const classified = classifyLocalQwenError(circular);
      expect(classified.kind).toBe('unknown');
      expect(classified.message).toBeDefined();
    });
  });
});
