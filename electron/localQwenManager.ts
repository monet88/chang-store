import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { ipcMain } from 'electron';
import {
  DESKTOP_LOCAL_QWEN_CHANNELS,
  type DesktopLocalQwenState,
  type DesktopLocalQwenStatus,
  type DesktopLocalQwenStopResult,
} from '../src/platform/desktopLocalQwen';
import { KNOWN_PORTABLE_COMFYUI_PATH } from '../src/config/localQwenSettings';
import { trustedBridge } from './gateway';

declare global {
  interface PromiseConstructor {
    withResolvers<T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  }
}

export const DEFAULT_COMFYUI_PORT = 8188;

export const verifyLoopbackOnly = (targetUrl: string): boolean => {
  try {
    const parsed = new URL(targetUrl);
    return parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
};

export const defaultProbeFn = async (endpoint: string, timeoutMs = 2000): Promise<boolean> => {
  if (!verifyLoopbackOnly(endpoint)) {
    throw new Error('Security error: Only loopback 127.0.0.1 is permitted for ComfyUI endpoint.');
  }
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export interface LocalQwenManagerOptions {
  port?: number;
  probeFn?: (endpoint: string) => Promise<boolean>;
  spawnFn?: (command: string, args: readonly string[], options: Record<string, unknown>) => ChildProcess;
  readinessTimeoutMs?: number;
  readinessPollIntervalMs?: number;
}

export class LocalQwenManager {
  public port: number;
  public state: DesktopLocalQwenState = 'stopped';
  public isAppOwned = false;
  public childProcess?: ChildProcess;
  public childPid?: number;
  public lastError?: string;

  private probeFn: (endpoint: string) => Promise<boolean>;
  private spawnFn: (command: string, args: readonly string[], options: Record<string, unknown>) => ChildProcess;
  private readinessTimeoutMs: number;
  private readinessPollIntervalMs: number;

  constructor(options: LocalQwenManagerOptions = {}) {
    this.port = options.port ?? DEFAULT_COMFYUI_PORT;
    this.probeFn = options.probeFn ?? defaultProbeFn;
    this.spawnFn =
      options.spawnFn ??
      ((cmd, args, opts) => spawn(cmd, args as string[], opts as Parameters<typeof spawn>[2]));
    this.readinessTimeoutMs = options.readinessTimeoutMs ?? 60_000;
    this.readinessPollIntervalMs = options.readinessPollIntervalMs ?? 500;
  }

  public async probe(endpoint?: string): Promise<boolean> {
    const target = endpoint ?? `http://127.0.0.1:${this.port}/system_stats`;
    if (!verifyLoopbackOnly(target)) {
      throw new Error('Security error: Only loopback 127.0.0.1 is permitted for ComfyUI endpoint.');
    }
    return this.probeFn(target);
  }

  public async getStatus(): Promise<DesktopLocalQwenStatus> {
    const isResponding = await this.probe();
    if (isResponding) {
      this.state = 'ready';
      this.lastError = undefined;
      return {
        state: 'ready',
        isAppOwned: this.isAppOwned,
        port: this.port,
      };
    }

    if (this.childProcess && !this.childProcess.killed && this.state === 'starting') {
      return {
        state: 'starting',
        isAppOwned: true,
        port: this.port,
      };
    }

    if (this.state === 'error') {
      return {
        state: 'error',
        isAppOwned: this.isAppOwned,
        port: this.port,
        error: this.lastError,
      };
    }

    this.state = 'stopped';
    this.isAppOwned = false;
    return {
      state: 'stopped',
      isAppOwned: false,
      port: this.port,
    };
  }

  public resolveLaunchCommand(folder: string): { executable: string; args: string[] } {
    const isWin = process.platform === 'win32';
    const portablePython = path.join(folder, 'python_embeded', isWin ? 'python.exe' : 'python');
    const portableMain = path.join(folder, 'ComfyUI', 'main.py');
    const rootMain = path.join(folder, 'main.py');

    if (fs.existsSync(portablePython) && fs.existsSync(portableMain)) {
      return {
        executable: portablePython,
        args: [
          '-s',
          portableMain,
          '--windows-standalone-build',
          '--listen',
          '127.0.0.1',
          '--port',
          String(this.port),
          '--disable-auto-launch',
        ],
      };
    }

    if (fs.existsSync(rootMain)) {
      return {
        executable: isWin ? 'python.exe' : 'python',
        args: [
          rootMain,
          '--listen',
          '127.0.0.1',
          '--port',
          String(this.port),
          '--disable-auto-launch',
        ],
      };
    }

    throw new Error(`Could not find ComfyUI main.py in ${folder}`);
  }

  public async startServer(folder?: string): Promise<DesktopLocalQwenStatus> {
    // 1. Probe loopback first
    const alreadyResponding = await this.probe();
    if (alreadyResponding) {
      this.isAppOwned = false;
      this.state = 'ready';
      this.lastError = undefined;
      return {
        state: 'ready',
        isAppOwned: false,
        port: this.port,
      };
    }

    // 2. If already starting, wait for readiness
    if (this.childProcess && !this.childProcess.killed && this.state === 'starting') {
      const ready = await this.waitForReady(this.readinessTimeoutMs);
      if (ready) {
        return { state: 'ready', isAppOwned: true, port: this.port };
      }
      throw new Error(this.lastError || 'ComfyUI server failed to start within timeout.');
    }

    // 3. Resolve folder
    const comfyDir = folder?.trim() || KNOWN_PORTABLE_COMFYUI_PATH;
    if (!fs.existsSync(comfyDir)) {
      this.state = 'error';
      this.lastError = `ComfyUI directory not found: ${comfyDir}`;
      throw new Error(this.lastError);
    }

    // 4. Resolve command
    const { executable, args } = this.resolveLaunchCommand(comfyDir);

    // 5. Spawn child process
    this.state = 'starting';
    this.isAppOwned = true;
    this.lastError = undefined;

    let stderrOutput = '';
    const child = this.spawnFn(executable, args, {
      cwd: comfyDir,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.childProcess = child;
    this.childPid = child.pid;

    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderrOutput += chunk.toString();
      if (stderrOutput.length > 4000) {
        stderrOutput = stderrOutput.slice(-4000);
      }
    });

    child.on('error', (err: Error) => {
      this.state = 'error';
      this.lastError = `ComfyUI process error: ${err.message}`;
      this.isAppOwned = false;
      this.childProcess = undefined;
      this.childPid = undefined;
    });

    child.on('exit', (code: number | null, signal: string | null) => {
      if (this.state === 'starting') {
        this.state = 'error';
        this.lastError = `ComfyUI process exited prematurely with code ${code ?? signal}: ${stderrOutput.trim()}`;
      } else if (this.state === 'ready') {
        this.state = 'stopped';
      }
      this.isAppOwned = false;
      this.childProcess = undefined;
      this.childPid = undefined;
    });

    // 6. Wait for ready
    const isReady = await this.waitForReady(this.readinessTimeoutMs);
    if (!isReady) {
      if ((this.state as DesktopLocalQwenState) !== 'error') {
        this.state = 'error';
        this.lastError = `Timed out waiting for ComfyUI to become ready: ${stderrOutput.trim()}`;
      }
      if (this.childProcess && !this.childProcess.killed) {
        try {
          this.childProcess.kill();
        } catch {
          // Ignore
        }
      }
      this.childProcess = undefined;
      this.childPid = undefined;
      this.isAppOwned = false;
      throw new Error(this.lastError);
    }

    this.state = 'ready';
    return {
      state: 'ready',
      isAppOwned: true,
      port: this.port,
    };
  }

  public async stopServer(): Promise<DesktopLocalQwenStopResult> {
    if (!this.isAppOwned) {
      return { stopped: false, wasExternal: true };
    }

    if (this.childProcess && !this.childProcess.killed) {
      try {
        this.childProcess.kill('SIGTERM');
        const { promise, resolve } = Promise.withResolvers<void>();
        const timer = setTimeout(() => {
          if (this.childProcess && !this.childProcess.killed) {
            try {
              this.childProcess.kill('SIGKILL');
            } catch {
              // Ignore
            }
          }
          resolve();
        }, 1500);

        this.childProcess.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
        await promise;
      } catch {
        // Ignore
      }
    }

    this.childProcess = undefined;
    this.childPid = undefined;
    this.isAppOwned = false;
    this.state = 'stopped';
    this.lastError = undefined;

    return { stopped: true, wasExternal: false };
  }

  private async waitForReady(timeoutMs: number): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (this.childProcess?.killed || (this.state === 'error' && this.lastError)) {
        return false;
      }
      try {
        const isResponding = await this.probe();
        if (isResponding) {
          return true;
        }
      } catch {
        // Transient error while starting
      }
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, this.readinessPollIntervalMs);
      await promise;
    }
    return false;
  }
}

export const localQwenManager = new LocalQwenManager();

export const registerDesktopLocalQwenHandlers = (
  manager: LocalQwenManager = localQwenManager,
): void => {
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.getStatus, (event) =>
    trustedBridge(event, () => manager.getStatus()),
  );
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.startServer, (event, folder) =>
    trustedBridge(event, () => manager.startServer(typeof folder === 'string' ? folder : undefined)),
  );
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.stopServer, (event) =>
    trustedBridge(event, () => manager.stopServer()),
  );
};
