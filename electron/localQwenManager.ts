import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { ipcMain } from 'electron';
import {
  DESKTOP_LOCAL_QWEN_CHANNELS,
  type DesktopLocalQwenState,
  type DesktopLocalQwenStatus,
  type DesktopLocalQwenStopResult,
  type LocalQwenFolderCheck,
  type LocalQwenGenerateParams,
  type LocalQwenGenerateResult,
  type LocalQwenProgress,
  type LocalQwenUpscaleParams,
  type LocalQwenUpscaleResult,
  isUncensoredModel,
} from '../src/platform/desktopLocalQwen';
import {
  KNOWN_PORTABLE_COMFYUI_PATH,
  LOCAL_QWEN_MAX_CFG,
  LOCAL_QWEN_MAX_STEPS,
  LOCAL_QWEN_MIN_CFG,
  LOCAL_QWEN_MIN_STEPS,
  LOCAL_QWEN_RESOLUTIONS,
  LOCAL_QWEN_SAMPLERS,
  LOCAL_QWEN_SCHEDULERS,
} from '../src/config/localQwenSettings';
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
export const DEFAULT_QWEN_UNET_NAME = 'qwen-image-2.1-UC-Q4_K_M.gguf';
export const FALLBACK_QWEN_UNET_NAME = 'qwen-image-2.1-Q4_K_M.gguf';
/** Face-swap LoRA auto-injected for identity-transfer / brand-model workflows. */
export const FACE_SWAP_LORA_NAME = 'bfs_head_v1.1_qwen_2.1.safetensors';
/** Speed (turbo) LoRA documented for the local pipeline; detected on disk, wired in a later phase. */
export const TURBO_LORA_NAME = 'Qwen-Image-2.1-viggle-turbo-v0.2.1-6step-lora-r128.safetensors';

export const verifyLoopbackOnly = (targetUrl: string): boolean => {
  try {
    const parsed = new URL(targetUrl);
    return parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
};

const buildComfyUIViewUrl = (
  baseUrl: string,
  imgInfo: { filename: string; subfolder?: string; type?: string },
): string =>
  `${baseUrl}/view?filename=${encodeURIComponent(imgInfo.filename)}&subfolder=${encodeURIComponent(imgInfo.subfolder || '')}&type=${encodeURIComponent(imgInfo.type || 'output')}`;

export interface LocalQwenHealth {
  compatible: boolean;
  error?: string;
}

/** What on-disk detection knows about one configured ComfyUI root. */
export interface LocalQwenModelAssets {
  folder: string;
  /** `null` when neither the UC nor the fallback unet exists under `folder`. */
  unet: string | null;
  faceSwapLora: boolean;
  turboLora: boolean;
  resolvedAt: number;
}

export type HealthCheckFn = (baseUrl: string) => Promise<LocalQwenHealth>;

export const defaultProbeFn = async (endpoint: string, timeoutMs = 2000): Promise<boolean> => {
  if (!verifyLoopbackOnly(endpoint)) {
    throw new Error('Security error: Only loopback 127.0.0.1 is permitted for ComfyUI endpoint.');
  }
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { system?: unknown } | null;
    return Boolean(body && typeof body === 'object' && 'system' in body && body.system);
  } catch {
    return false;
  }
};

export const defaultHealthCheckFn = async (
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 3000,
): Promise<LocalQwenHealth> => {
  try {
    const statsRes = await fetchFn(`${baseUrl}/system_stats`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!statsRes.ok) {
      return {
        compatible: false,
        error: `ComfyUI /system_stats failed with status ${statsRes.status}`,
      };
    }
    const stats = (await statsRes.json().catch(() => null)) as { system?: unknown } | null;
    if (!stats || typeof stats !== 'object' || !stats.system) {
      return {
        compatible: false,
        error: 'ComfyUI /system_stats failed or returned unsupported version',
      };
    }

    const unetRes = await fetchFn(`${baseUrl}/object_info/UnetLoaderGGUF`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!unetRes.ok) {
      return {
        compatible: false,
        error: 'ComfyUI is incompatible: custom node ComfyUI-GGUF is missing',
      };
    }
    const unetData = (await unetRes.json().catch(() => null)) as {
      UnetLoaderGGUF?: { input?: { required?: { unet_name?: unknown[] } } };
    } | null;
    if (!unetData?.UnetLoaderGGUF) {
      return {
        compatible: false,
        error: 'ComfyUI is incompatible: custom node ComfyUI-GGUF is missing',
      };
    }

    const unetNames = unetData.UnetLoaderGGUF.input?.required?.unet_name?.[0];
    const hasCompatibleUnet =
      Array.isArray(unetNames) &&
      (unetNames.includes(DEFAULT_QWEN_UNET_NAME) || unetNames.includes(FALLBACK_QWEN_UNET_NAME));
    if (!hasCompatibleUnet) {
      return {
        compatible: false,
        error: `UnetLoaderGGUF: ${DEFAULT_QWEN_UNET_NAME} or ${FALLBACK_QWEN_UNET_NAME} not found in models/diffusion_models`,
      };
    }

    const textEncodeRes = await fetchFn(`${baseUrl}/object_info/TextEncodeQwenImage21`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!textEncodeRes.ok) {
      return {
        compatible: false,
        error: 'ComfyUI is incompatible: node TextEncodeQwenImage21 is missing',
      };
    }

    return { compatible: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      compatible: false,
      error: `ComfyUI is incompatible: health check failed (${message})`,
    };
  }
};
export interface WebSocketLike {
  addEventListener?(type: string, listener: (event: unknown) => void): void;
  removeEventListener?(type: string, listener: (event: unknown) => void): void;
  on?(event: string, listener: (data: unknown) => void): void;
  onmessage?: ((event: { data: unknown }) => void) | null;
  close(): void;
}

export type WebSocketConstructor = new (url: string) => WebSocketLike;

export interface LocalQwenManagerOptions {
  port?: number;
  comfyUiFolder?: string;
  probeFn?: (endpoint: string) => Promise<boolean>;
  healthCheckFn?: HealthCheckFn;
  spawnFn?: (command: string, args: readonly string[], options: Record<string, unknown>) => ChildProcess;
  readinessTimeoutMs?: number;
  readinessPollIntervalMs?: number;
  fetchFn?: typeof fetch;
  wsConstructor?: WebSocketConstructor;
}

/**
 * Phrases that explicitly REFUSE a face swap ("no face swap", "không đổi mặt").
 * Checked first so a prompt that merely bans swapping never triggers the LoRA.
 */
const FACE_SWAP_REFUSAL_PHRASES = [
  'no face swap',
  'without face swap',
  'do not swap',
  "don't swap",
  'not swap face',
  'keep the original face',
  'không đổi mặt',
  'không thay mặt',
  'không ghép mặt',
  'không đổi khuôn mặt',
  'không thay khuôn mặt',
  'không chuyển mặt',
  'không chuyển danh tính',
];

export const isFaceSwapPrompt = (prompt: string): boolean => {
  if (!prompt) return false;
  const promptLower = prompt.toLowerCase();
  if (FACE_SWAP_REFUSAL_PHRASES.some((phrase) => promptLower.includes(phrase))) {
    return false;
  }
  return (
    prompt.includes('QWEN IDENTITY TRANSFER SPECIFICATION') ||
    prompt.includes('QWEN BRAND MODEL SPECIFICATION') ||
    prompt.includes('IDENTITY TRANSFER') ||
    prompt.includes('head_swap') ||
    promptLower.includes('face swap') ||
    promptLower.includes('faceswap') ||
    promptLower.includes('swap face') ||
    promptLower.includes('head swap') ||
    promptLower.includes('replace face') ||
    promptLower.includes('facial identity') ||
    promptLower.includes('đổi mặt') ||
    promptLower.includes('hoán đổi mặt') ||
    promptLower.includes('ghép mặt') ||
    promptLower.includes('thay mặt') ||
    promptLower.includes('đổi khuôn mặt') ||
    promptLower.includes('thay khuôn mặt') ||
    promptLower.includes('chuyển mặt') ||
    promptLower.includes('chuyển danh tính')
  );
};

export class LocalQwenManager {
  public port: number;
  public comfyUiFolder?: string;
  public state: DesktopLocalQwenState = 'stopped';
  public isAppOwned = false;
  public childProcess?: ChildProcess;
  public childPid?: number;
  public lastError?: string;
  public currentProgress?: LocalQwenProgress;
  public isCancelled = false;
  private isShuttingDown = false;
  private childProcessExitError?: string;

  public get isStarting(): boolean {
    return this.state === 'starting';
  }

  private activeAbortController?: AbortController;
  private wsConstructor?: WebSocketConstructor;
  private probeFn: (endpoint: string) => Promise<boolean>;
  private healthCheckFn: HealthCheckFn;
  private spawnFn: (command: string, args: readonly string[], options: Record<string, unknown>) => ChildProcess;
  private fetchFn: typeof fetch;
  private readinessTimeoutMs: number;
  private readinessPollIntervalMs: number;
  private cachedModelAssets?: LocalQwenModelAssets;

  constructor(options: LocalQwenManagerOptions = {}) {
    this.port = options.port ?? DEFAULT_COMFYUI_PORT;
    this.comfyUiFolder = options.comfyUiFolder;
    this.probeFn = options.probeFn ?? defaultProbeFn;
    this.healthCheckFn =
      options.healthCheckFn ??
      (options.probeFn && options.probeFn !== defaultProbeFn
        ? async () => ({ compatible: true })
        : (url) => defaultHealthCheckFn(url, this.fetchFn));
    this.spawnFn =
      options.spawnFn ??
      ((cmd, args, opts) => spawn(cmd, args as string[], opts as Parameters<typeof spawn>[2]));
    this.fetchFn = options.fetchFn ?? ((url, init) => fetch(url, init));
    this.readinessTimeoutMs = options.readinessTimeoutMs ?? 60_000;
    this.readinessPollIntervalMs = options.readinessPollIntervalMs ?? 500;
    this.wsConstructor = options.wsConstructor;
  }

  public async probe(endpoint?: string): Promise<boolean> {
    const target = endpoint ?? `http://127.0.0.1:${this.port}/system_stats`;
    if (!verifyLoopbackOnly(target)) {
      throw new Error('Security error: Only loopback 127.0.0.1 is permitted for ComfyUI endpoint.');
    }
    return this.probeFn(target);
  }
  public async checkCompatibility(baseUrl?: string): Promise<LocalQwenHealth> {
    const target = baseUrl ?? `http://127.0.0.1:${this.port}`;
    if (!verifyLoopbackOnly(target)) {
      throw new Error('Security error: Only loopback 127.0.0.1 is permitted for ComfyUI endpoint.');
    }
    return this.healthCheckFn(target);
  }

  public invalidateModelCache(): void {
    this.cachedModelAssets = undefined;
  }

  /**
   * Configured ComfyUI root: an explicit folder (the renderer's saved setting)
   * wins, then the folder the server was started from, then the known portable
   * install — so status reports the install the user actually configured
   * instead of silently probing the default one.
   */
  private resolveComfyRoot(folder?: string): string {
    return folder?.trim() || this.comfyUiFolder || KNOWN_PORTABLE_COMFYUI_PATH;
  }

  /** On-disk model detection for one ComfyUI root, cached for 30s per folder. */
  private resolveModelAssets(
    forceRefresh = false,
    folder?: string,
  ): LocalQwenModelAssets {
    const comfyRoot = this.resolveComfyRoot(folder);
    const now = Date.now();
    const cached = this.cachedModelAssets;
    if (!forceRefresh && cached && cached.folder === comfyRoot && now - cached.resolvedAt < 30_000) {
      return cached;
    }

    const inModels = (dir: 'diffusion_models' | 'loras', file: string): boolean =>
      fs.existsSync(path.join(comfyRoot, 'ComfyUI', 'models', dir, file)) ||
      fs.existsSync(path.join(comfyRoot, 'models', dir, file));

    const hasUcModel = inModels('diffusion_models', DEFAULT_QWEN_UNET_NAME);
    const hasFallbackModel = inModels('diffusion_models', FALLBACK_QWEN_UNET_NAME);

    const assets = {
      folder: comfyRoot,
      unet: hasUcModel
        ? DEFAULT_QWEN_UNET_NAME
        : hasFallbackModel
          ? FALLBACK_QWEN_UNET_NAME
          : null,
      faceSwapLora: inModels('loras', FACE_SWAP_LORA_NAME),
      turboLora: inModels('loras', TURBO_LORA_NAME),
      resolvedAt: now,
    };
    this.cachedModelAssets = assets;
    return assets;
  }

  /**
   * Unet on disk under the configured folder, or `null` when neither build is
   * installed: a default filename is a fallback for generation, never a
   * detection result to report back to the UI.
   */
  public resolveActiveUnet(forceRefresh = false, folder?: string): string | null {
    return this.resolveModelAssets(forceRefresh, folder).unet;
  }

  /**
   * What detection can honestly claim about the configured install. Everything
   * stays `undefined` while no unet resolves (unknown folder, nothing
   * installed), so the UI shows neither a model nor a badge.
   */
  public resolveModelInfo(forceRefresh = false, folder?: string): {
    activeModel?: string;
    isUncensored?: boolean;
    faceSwapLoraAvailable?: boolean;
    turboLoraAvailable?: boolean;
  } {
    const assets = this.resolveModelAssets(forceRefresh, folder);
    if (!assets.unet) {
      return {};
    }
    return {
      activeModel: assets.unet,
      isUncensored: isUncensoredModel(assets.unet),
      faceSwapLoraAvailable: assets.faceSwapLora,
      turboLoraAvailable: assets.turboLora,
    };
  }

  /**
   * Fail an auto face-swap job fast when the BFS LoRA is missing: ComfyUI
   * would otherwise reject the workflow with an opaque "Value not in list"
   * error after the queue round-trip. An explicitly requested `loraName` and an
   * unknown install are left to ComfyUI to report.
   */
  private assertFaceSwapLoraAvailable(): void {
    const info = this.resolveModelInfo();
    if (info.activeModel && info.faceSwapLoraAvailable === false) {
      throw new Error(
        `Face swap LoRA not found in the configured ComfyUI install: ${FACE_SWAP_LORA_NAME} (models/loras). ` +
          'Place the file there, or run the job with workflow "standard".',
      );
    }
  }

  /**
   * @param folder ComfyUI folder the renderer has configured; model detection
   * reports against it so a badge never describes a different install.
   */
  public async getStatus(folder?: string): Promise<DesktopLocalQwenStatus> {
    const modelInfo = this.resolveModelInfo(false, folder);

    if (this.state === 'generating') {
      return {
        state: 'generating',
        isAppOwned: this.isAppOwned,
        port: this.port,
        progress: this.currentProgress,
        ...modelInfo,
      };
    }

    // `.killed` only reports that a signal was sent, not that the process
    // exited (see stopServer). The tracked child reference is cleared by its
    // own exit/error handlers, so the reference itself is the lifetime signal.
    if (this.childProcess && this.state === 'starting') {
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

    const isResponding = await this.probe();
    if (isResponding) {
      const health = await this.checkCompatibility();
      if (!health.compatible) {
        this.state = 'error';
        this.lastError = health.error;
        return {
          state: 'error',
          isAppOwned: this.isAppOwned,
          port: this.port,
          error: this.lastError,
        };
      }
      this.state = 'ready';
      this.lastError = undefined;
      return {
        state: 'ready',
        isAppOwned: this.isAppOwned,
        port: this.port,
        ...modelInfo,
      };
    }

    if (this.isAppOwned && this.childProcess) {
      // Probe failed, but the child we own is still tracked: keep ownership so
      // Release GPU/RAM and before-quit cleanup stay valid, and report a
      // non-ready state instead of claiming ready or dropping to stopped.
      return {
        state: 'starting',
        isAppOwned: true,
        port: this.port,
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

  public clearError(): void {
    this.lastError = undefined;
    if (this.state === 'error') {
      this.state = 'stopped';
    }
  }

  public async cancelJob(): Promise<{ cancelled: boolean }> {
    this.isCancelled = true;
    this.activeAbortController?.abort();

    try {
      const baseUrl = `http://127.0.0.1:${this.port}`;
      await this.fetchFn(`${baseUrl}/interrupt`, {
        method: 'POST',
        signal: AbortSignal.timeout(1500),
      });
    } catch {
      // Ignore network errors when interrupting ComfyUI
    }

    if (this.state === 'generating') {
      this.state = 'error';
      this.lastError = 'Generation cancelled by user';
      this.currentProgress = undefined;
    }

    return { cancelled: true };
  }

  public async handleBeforeQuit(): Promise<void> {
    this.isShuttingDown = true;

    if (!this.isAppOwned) {
      return;
    }

    if (this.state === 'generating') {
      try {
        await this.cancelJob();
      } catch {
        // Ignore
      }
    }

    await this.stopServer();
  }

  public resolveLaunchCommand(folder: string): { executable: string; args: string[] } {
    if (!folder || typeof folder !== 'string' || !folder.trim()) {
      throw new Error('ComfyUI folder must be a non-empty string.');
    }

    const trimmed = folder.trim();
    // Reject UNC / network paths (e.g. \\server\share or //server/share)
    if (trimmed.startsWith('\\\\') || trimmed.startsWith('//')) {
      throw new Error(`Security error: UNC and remote network paths are prohibited: ${trimmed}`);
    }

    // Resolve realpath to canonicalize symlinks and relative path escapes
    let canonicalFolder: string;
    try {
      canonicalFolder = fs.realpathSync(trimmed);
    } catch {
      throw new Error(`ComfyUI directory not found: ${trimmed}`);
    }

    const stat = fs.statSync(canonicalFolder);
    if (!stat.isDirectory()) {
      throw new Error(`ComfyUI path is not a directory: ${canonicalFolder}`);
    }

    const isWin = process.platform === 'win32';
    const portablePython = path.join(canonicalFolder, 'python_embeded', isWin ? 'python.exe' : 'python');
    const portableMain = path.join(canonicalFolder, 'ComfyUI', 'main.py');
    const rootMain = path.join(canonicalFolder, 'main.py');
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
  public checkFolder(folder: string): LocalQwenFolderCheck {
    try {
      if (!folder || typeof folder !== 'string' || !folder.trim()) {
        return { exists: false, hasComfyUiMain: false };
      }
      const trimmed = folder.trim();
      if (!fs.existsSync(trimmed)) {
        return { exists: false, hasComfyUiMain: false };
      }
      const stat = fs.statSync(trimmed);
      if (!stat.isDirectory()) {
        return { exists: false, hasComfyUiMain: false };
      }

      const isWin = process.platform === 'win32';
      const portablePython = path.join(trimmed, 'python_embeded', isWin ? 'python.exe' : 'python');
      const portableMain = path.join(trimmed, 'ComfyUI', 'main.py');
      const rootMain = path.join(trimmed, 'main.py');

      const hasComfyUiMain =
        (fs.existsSync(portablePython) && fs.existsSync(portableMain)) || fs.existsSync(rootMain);

      return { exists: true, hasComfyUiMain };
    } catch {
      return { exists: false, hasComfyUiMain: false };
    }
  }


  public async startServer(folder?: string): Promise<DesktopLocalQwenStatus> {
    if (this.isShuttingDown) {
      throw new Error('Application is shutting down.');
    }
    // 1. Probe loopback first
    const alreadyResponding = await this.probe();
    if (alreadyResponding) {
      const hasLiveOwnedChild = Boolean(this.isAppOwned && this.childProcess);
      this.isAppOwned = hasLiveOwnedChild;

      const health = await this.checkCompatibility();
      if (!health.compatible) {
        this.state = 'error';
        this.lastError = health.error;
        return {
          state: 'error',
          isAppOwned: this.isAppOwned,
          port: this.port,
          error: this.lastError,
        };
      }

      this.state = 'ready';
      this.lastError = undefined;
      return {
        state: 'ready',
        isAppOwned: this.isAppOwned,
        port: this.port,
        ...this.resolveModelInfo(),
      };
    }

    // 2. If already starting, wait for readiness
    if (this.childProcess && !this.childProcess.killed && this.state === 'starting') {
      const ready = await this.waitForReady(this.readinessTimeoutMs);
      if (ready) {
        return {
          state: 'ready',
          isAppOwned: true,
          port: this.port,
          ...this.resolveModelInfo(),
        };
      }
      throw new Error(this.lastError || 'ComfyUI server failed to start within timeout.');
    }

    // 3. Resolve folder
    const comfyDir = folder?.trim() || KNOWN_PORTABLE_COMFYUI_PATH;
    this.comfyUiFolder = comfyDir;
    this.invalidateModelCache();
    if (!fs.existsSync(comfyDir)) {
      this.state = 'error';
      this.lastError = `ComfyUI directory not found: ${comfyDir}`;
      throw new Error(this.lastError);
    }

    // 4. Resolve command
    const { executable, args } = this.resolveLaunchCommand(comfyDir);

    // 5. Release any process we still own before spawning a replacement
    if (this.childProcess && this.isAppOwned) {
      await this.stopServer();
    }

    // 6. Spawn child process
    if (this.isShuttingDown) {
      this.state = 'stopped';
      throw new Error('Application is shutting down.');
    }

    this.state = 'starting';
    this.isAppOwned = true;
    this.lastError = undefined;

    let stderrOutput = '';
    const child = this.spawnFn(executable, args, {
      cwd: comfyDir,
      detached: false,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    child.stdout?.resume?.();

    this.childProcess = child;
    this.childPid = child.pid;

    if (this.isShuttingDown) {
      try {
        child.kill();
      } catch {
        // Ignore
      }
      this.childProcess = undefined;
      this.childPid = undefined;
      this.isAppOwned = false;
      this.state = 'stopped';
      throw new Error('Application is shutting down.');
    }

    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderrOutput += chunk.toString();
      if (stderrOutput.length > 4000) {
        stderrOutput = stderrOutput.slice(-4000);
      }
    });

    child.on('error', (err: Error) => {
      if (this.childProcess !== child) return;
      const errorMsg = `ComfyUI process error: ${err.message}`;
      if (this.state === 'generating') {
        this.childProcessExitError = errorMsg;
        this.activeAbortController?.abort();
      }
      this.state = 'error';
      this.lastError = errorMsg;
      this.isAppOwned = false;
      this.childProcess = undefined;
      this.childPid = undefined;
    });

    child.on('exit', (code: number | null, signal: string | null) => {
      if (this.childProcess !== child) return;
      if (this.state === 'starting') {
        this.state = 'error';
        this.lastError = `ComfyUI process exited prematurely with code ${code ?? signal}: ${stderrOutput.trim()}`;
      } else if (this.state === 'generating') {
        const exitMsg = `ComfyUI process exited unexpectedly during generation with code ${code ?? signal}: ${stderrOutput.trim()}`.trim();
        this.childProcessExitError = exitMsg;
        this.state = 'error';
        this.lastError = exitMsg;
        this.currentProgress = undefined;
        this.activeAbortController?.abort();
      } else if (this.state === 'ready') {
        this.state = 'stopped';
      }
      this.isAppOwned = false;
      this.childProcess = undefined;
      this.childPid = undefined;
    });
    // 7. Wait for ready
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

    const health = await this.checkCompatibility();
    if (!health.compatible) {
      this.state = 'error';
      this.lastError = health.error;
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
      ...this.resolveModelInfo(),
    };
  }
  public async stopServer(): Promise<DesktopLocalQwenStopResult> {
    if (!this.isAppOwned) {
      return { stopped: false, wasExternal: true };
    }

    const child = this.childProcess;
    if (child) {
      const { promise, resolve } = Promise.withResolvers<void>();
      // `.killed` only reports that a signal was sent, not that the process died.
      // Track the real exit so a child that ignores SIGTERM still gets SIGKILL.
      let exited = false;
      const timer = setTimeout(() => {
        if (!exited) {
          try {
            child.kill('SIGKILL');
          } catch {
            // Ignore
          }
        }
        resolve();
      }, 1500);

      child.once('exit', () => {
        exited = true;
        clearTimeout(timer);
        resolve();
      });

      try {
        child.kill('SIGTERM');
      } catch {
        clearTimeout(timer);
        resolve();
      }

      await promise;
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
      if (this.isShuttingDown) {
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
  public async generateImage(params: LocalQwenGenerateParams): Promise<LocalQwenGenerateResult> {
    const isReady = await this.probe();
    if (!isReady) {
      this.state = 'error';
      this.lastError = `ComfyUI server is not running on 127.0.0.1:${this.port}. Please start it first.`;
      throw new Error(this.lastError);
    }

    this.state = 'generating';
    this.isCancelled = false;
    this.lastError = undefined;
    const steps = params.steps ?? 16;
    this.currentProgress = { step: 0, maxSteps: steps };
    const abortController = new AbortController();
    this.activeAbortController = abortController;

    const host = `127.0.0.1:${this.port}`;
    const baseUrl = `http://${host}`;

    let ws: WebSocketLike | null = null;
    const clientId = `chang-store-${Date.now()}`;

    try {
      const WsClass = this.wsConstructor ?? (typeof WebSocket !== 'undefined' ? (WebSocket as unknown as WebSocketConstructor) : undefined);
      if (WsClass) {
        ws = new WsClass(`ws://${host}/ws?clientId=${clientId}`);
        const onWsMsg = (eventOrData: unknown) => {
          try {
            let raw = '';
            if (typeof eventOrData === 'string') {
              raw = eventOrData;
            } else if (
              eventOrData &&
              typeof eventOrData === 'object' &&
              'data' in eventOrData &&
              (eventOrData as { data: unknown }).data != null
            ) {
              raw = String((eventOrData as { data: unknown }).data);
            } else if (eventOrData != null) {
              raw = String(eventOrData);
            }
            const msg = JSON.parse(raw);
            if (msg.type === 'progress' && msg.data) {
              const { value, max } = msg.data;
              if (typeof value === 'number' && typeof max === 'number') {
                this.currentProgress = { step: value, maxSteps: max };
              }
            } else if (msg.type === 'execution_interrupted') {
              this.isCancelled = true;
            }
          } catch {
            // Ignore malformed WS message
          }
        };
        if (typeof ws.addEventListener === 'function') {
          ws.addEventListener('message', onWsMsg);
        } else if (typeof ws.on === 'function') {
          ws.on('message', onWsMsg);
        } else {
          ws.onmessage = onWsMsg;
        }
      }
    } catch {
      // WS connect failed, proceed with polling
    }

    try {
      const uploadedFileNames: string[] = [];
      if (params.images && params.images.length > 0) {
        for (let i = 0; i < params.images.length; i++) {
          if (this.isCancelled || abortController.signal.aborted) {
            throw new Error('Generation cancelled by user');
          }
          const img = params.images[i];
          const buffer = Buffer.from(img.base64, 'base64');
          const mimeType = img.mimeType || 'image/png';
          const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
          const filename = `input_${Date.now()}_${i}.${ext}`;

          const formData = new FormData();
          const blob = new Blob([buffer], { type: mimeType });
          formData.append('image', blob, filename);
          formData.append('overwrite', 'true');

          const uploadRes = await this.fetchFn(`${baseUrl}/upload/image`, {
            method: 'POST',
            body: formData,
            signal: abortController.signal,
          });

          if (!uploadRes.ok) {
            const errText = await uploadRes.text().catch(() => uploadRes.statusText);
            throw new Error(`Failed to upload reference image ${i + 1} to ComfyUI: ${errText}`);
          }

          const uploadData = (await uploadRes.json()) as { name?: string };
          uploadedFileNames.push(uploadData.name || filename);
        }
      }

      if (this.isCancelled || abortController.signal.aborted) {
        throw new Error('Generation cancelled by user');
      }

      const samplerMap: Record<string, string> = {
        Euler: 'euler',
        'Euler a': 'euler_ancestral',
        'DPM++ 2M': 'dpmpp_2m',
        'DPM++ 2M SDE': 'dpmpp_2m_sde',
      };
      const schedulerMap: Record<string, string> = {
        Simple: 'simple',
        Normal: 'normal',
        Karras: 'karras',
      };

      const samplerName = (params.sampler && samplerMap[params.sampler]) || 'euler';
      const schedulerName = (params.scheduler && schedulerMap[params.scheduler]) || 'simple';
      const resolution = params.resolution ?? 512;
      const cfg = params.cfg ?? 1.0;
      const seed = params.seed ?? Math.floor(Math.random() * 1_000_000_000);

      const isIdentityTransfer =
        params.workflow === 'identity-transfer' ||
        params.workflow === 'face-swap' ||
        (params.workflow !== 'standard' && isFaceSwapPrompt(params.prompt || ''));

      const effectiveLoraName = params.loraName ?? (isIdentityTransfer ? FACE_SWAP_LORA_NAME : undefined);
      const loraStrength = typeof params.loraStrength === 'number' && Number.isFinite(params.loraStrength)
        ? params.loraStrength
        : 1.0;

      if (effectiveLoraName === FACE_SWAP_LORA_NAME && params.loraName === undefined) {
        this.assertFaceSwapLoraAvailable();
      }

      const unetName = params.unetName || this.resolveActiveUnet() || DEFAULT_QWEN_UNET_NAME;

      const workflow: Record<string, unknown> = {
        '1': {
          class_type: 'UnetLoaderGGUF',
          inputs: {
            unet_name: unetName,
          },
        },
        '2': {
          class_type: 'CLIPLoader',
          inputs: {
            clip_name: 'qwen3vl_8b_w4a8.safetensors',
            type: 'qwen_image',
          },
        },
        '3': {
          class_type: 'VAELoader',
          inputs: {
            vae_name: 'qwen_image_2.1_vae_bf16.safetensors',
          },
        },
      };

      let modelTarget: [string, number] = ['1', 0];
      if (effectiveLoraName) {
        workflow['5'] = {
          class_type: 'LoraLoaderModelOnly',
          inputs: {
            model: ['1', 0],
            lora_name: effectiveLoraName,
            strength_model: loraStrength,
          },
        };
        modelTarget = ['5', 0];
      }

      const textEncodeInputs: Record<string, unknown> = {
        clip: ['2', 0],
        vae: ['3', 0],
        prompt: params.prompt,
        negative_prompt: params.negativePrompt ?? '',
        resolution,
      };

      uploadedFileNames.forEach((fileName, index) => {
        const nodeId = String(10 + index);
        workflow[nodeId] = {
          class_type: 'LoadImage',
          inputs: {
            image: fileName,
          },
        };
        textEncodeInputs[`images.image_${index + 1}`] = [nodeId, 0];
      });

      workflow['4'] = {
        class_type: 'TextEncodeQwenImage21',
        inputs: textEncodeInputs,
      };

      workflow['7'] = {
        class_type: 'KSampler',
        inputs: {
          model: modelTarget,
          positive: ['4', 0],
          negative: ['4', 1],
          latent_image: ['4', 2],
          seed,
          steps,
          cfg,
          sampler_name: samplerName,
          scheduler: schedulerName,
          denoise: 1.0,
        },
      };

      workflow['8'] = {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['7', 0],
          vae: ['3', 0],
        },
      };

      workflow['9'] = {
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: 'Qwen_VTO',
          images: ['8', 0],
        },
      };

      const promptRes = await this.fetchFn(`${baseUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow, client_id: clientId }),
        signal: abortController.signal,
      });

      if (!promptRes.ok) {
        const errText = await promptRes.text().catch(() => promptRes.statusText);
        throw new Error(`ComfyUI prompt rejected (${promptRes.status}): ${errText}`);
      }

      const promptData = (await promptRes.json()) as { prompt_id: string };
      const promptId = promptData.prompt_id;
      if (!promptId) {
        throw new Error('ComfyUI did not return a prompt_id.');
      }

      const { base64, mimeType } = await this.pollComfyUIHistory(
        promptId,
        baseUrl,
        abortController.signal,
        'Generation cancelled by user',
        'generation',
      );

      this.state = 'ready';
      this.lastError = undefined;
      return {
        image: {
          base64,
          mimeType,
        },
        activeUnetName: unetName,
      };
    } catch (err) {
      this.state = 'error';
      if (this.childProcessExitError) {
        this.lastError = this.childProcessExitError;
        throw new Error(this.childProcessExitError);
      }
      const isCancelled =
        this.isCancelled ||
        abortController.signal.aborted ||
        (err instanceof Error && err.name === 'AbortError');
      this.lastError = isCancelled ? 'Generation cancelled by user' : (err as Error).message || String(err);
      throw isCancelled ? new Error('Generation cancelled by user') : err;
    } finally {
      this.childProcessExitError = undefined;
      if (ws) {
        try {
          if (typeof ws.close === 'function') ws.close();
        } catch {
          // Ignore
        }
      }
      this.activeAbortController = undefined;
      this.currentProgress = undefined;
      if (this.state === 'generating') {
        this.state = 'ready';
      }
    }
  }

  public async upscaleImage(params: LocalQwenUpscaleParams): Promise<LocalQwenUpscaleResult> {
    const isReady = await this.probe();
    if (!isReady) {
      throw new Error(`ComfyUI server is not running on 127.0.0.1:${this.port}. Please start it first.`);
    }

    if (!params || typeof params.image !== 'string' || !params.image.trim()) {
      throw new Error('No image provided for upscale.');
    }

    this.state = 'generating';
    this.isCancelled = false;
    this.lastError = undefined;
    const abortController = new AbortController();
    this.activeAbortController = abortController;

    try {
      return await this.runUpscaleWorkflow(params, abortController.signal);
    } catch (err) {
      this.state = 'error';
      if (this.childProcessExitError) {
        this.lastError = this.childProcessExitError;
        throw new Error(this.childProcessExitError);
      }
      const isCancelled =
        this.isCancelled ||
        abortController.signal.aborted ||
        (err instanceof Error && err.name === 'AbortError');
      this.lastError = isCancelled ? 'Upscale cancelled by user' : (err as Error).message || String(err);
      throw isCancelled ? new Error('Upscale cancelled by user') : err;
    } finally {
      this.childProcessExitError = undefined;
      this.activeAbortController = undefined;
      this.currentProgress = undefined;
      if (this.state === 'generating') {
        this.state = 'ready';
      }
    }
  }

  private async runUpscaleWorkflow(
    params: LocalQwenUpscaleParams,
    signal: AbortSignal,
  ): Promise<LocalQwenUpscaleResult> {
    if (this.isCancelled || signal.aborted) {
      throw new Error('Upscale cancelled by user');
    }
    const host = `127.0.0.1:${this.port}`;
    const baseUrl = `http://${host}`;
    let rawBase64 = params.image.trim();
    let mimeType = 'image/png';
    if (rawBase64.startsWith('data:')) {
      const match = rawBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        rawBase64 = match[2];
      }
    }

    const buffer = Buffer.from(rawBase64, 'base64');
    const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
    const filename = `upscale_input_${Date.now()}.${ext}`;

    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('image', blob, filename);
    formData.append('overwrite', 'true');

    const uploadRes = await this.fetchFn(`${baseUrl}/upload/image`, {
      method: 'POST',
      body: formData,
      signal,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => uploadRes.statusText);
      throw new Error(`Failed to upload image to ComfyUI for upscale: ${errText}`);
    }

    const uploadData = (await uploadRes.json()) as { name?: string };
    const uploadedFileName = uploadData.name || filename;

    const scale = typeof params.scale === 'number' && Number.isFinite(params.scale) && params.scale > 0
      ? params.scale
      : 2.0;
    if (this.isCancelled || signal.aborted) {
      throw new Error('Upscale cancelled by user');
    }

    const workflow: Record<string, unknown> = {
      '1': {
        class_type: 'LoadImage',
        inputs: {
          image: uploadedFileName,
        },
      },
      '2': {
        class_type: 'ImageScaleBy',
        inputs: {
          image: ['1', 0],
          upscale_method: 'bicubic',
          scale_by: scale,
        },
      },
      '3': {
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: 'Qwen_Upscale',
          images: ['2', 0],
        },
      },
    };

    const clientId = `chang-store-upscale-${Date.now()}`;
    const promptRes = await this.fetchFn(`${baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
      signal,
    });

    if (!promptRes.ok) {
      const errText = await promptRes.text().catch(() => promptRes.statusText);
      throw new Error(`ComfyUI upscale rejected (${promptRes.status}): ${errText}`);
    }

    const promptData = (await promptRes.json()) as { prompt_id: string };
    const promptId = promptData.prompt_id;
    if (!promptId) {
      throw new Error('ComfyUI did not return a prompt_id.');
    }

    const { base64, mimeType: resultMime } = await this.pollComfyUIHistory(
      promptId,
      baseUrl,
      signal,
      'Upscale cancelled by user',
      'upscale',
    );

    return {
      image: base64,
      mimeType: resultMime || 'image/png',
    };
  }

  /**
   * Polls ComfyUI /history/{promptId} until the rendered image is available,
   * then downloads it as base64. Shared by generation and upscale workflows.
   */
  private async pollComfyUIHistory(
    promptId: string,
    baseUrl: string,
    signal: AbortSignal,
    cancelledMessage: string,
    label: 'generation' | 'upscale',
  ): Promise<{ base64: string; mimeType: string }> {
    const timeoutMs = 600_000;
    const pollIntervalMs = 500;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (this.isCancelled || signal.aborted) {
        throw new Error(cancelledMessage);
      }

      const historyRes = await this.fetchFn(`${baseUrl}/history/${promptId}`, {
        signal,
      });
      if (historyRes.ok) {
        const historyData = (await historyRes.json()) as Record<string, {
          outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }>;
          status?: { status_str?: string; messages?: unknown };
        }>;

        const item = historyData[promptId];
        if (item) {
          if (item.status?.status_str === 'error') {
            throw new Error(`ComfyUI ${label} execution failed: ${JSON.stringify(item.status.messages || 'Unknown error')}`);
          }

          if (item.outputs) {
            for (const nodeId of Object.keys(item.outputs)) {
              const nodeOut = item.outputs[nodeId];
              const imgInfo = nodeOut?.images?.[0];
              if (imgInfo) {
                const viewRes = await this.fetchFn(buildComfyUIViewUrl(baseUrl, imgInfo), {
                  signal,
                });
                if (!viewRes.ok) {
                  throw new Error(`Failed to fetch image from ComfyUI: ${viewRes.statusText}`);
                }
                const buffer = Buffer.from(await viewRes.arrayBuffer());
                return { base64: buffer.toString('base64'), mimeType: 'image/png' };
              }
            }
          }
        }
      }
      if (this.isCancelled || signal.aborted) {
        throw new Error(cancelledMessage);
      }

      await new Promise<void>((resolve, reject) => {
        let timer: NodeJS.Timeout | undefined;
        const onAbort = () => {
          clearTimeout(timer);
          signal.removeEventListener('abort', onAbort);
          reject(new Error(cancelledMessage));
        };

        if (signal.aborted) {
          reject(new Error(cancelledMessage));
          return;
        }

        signal.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => {
          signal.removeEventListener('abort', onAbort);
          resolve();
        }, pollIntervalMs);
      });
    }
    throw new Error(`ComfyUI ${label} timed out.`);
  }
}

type UnknownRecord = Record<string, unknown>;

const requireRecord = (value: unknown, name: string): UnknownRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid local Qwen ${name}.`);
  }
  return value as UnknownRecord;
};

const requireString = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid local Qwen ${name}.`);
  }
  return value.trim();
};

const assertOnlyKeys = (input: UnknownRecord, allowed: readonly string[], name: string): void => {
  const unexpected = Object.keys(input).find((key) => !allowed.includes(key));
  if (unexpected) {
    throw new Error(`Invalid local Qwen ${name}: unsupported field ${unexpected}.`);
  }
};

export const parseLocalQwenGenerateParams = (value: unknown): LocalQwenGenerateParams => {
  const input = requireRecord(value, 'generate params');
  assertOnlyKeys(
    input,
    ['prompt', 'negativePrompt', 'images', 'resolution', 'steps', 'cfg', 'sampler', 'scheduler', 'seed', 'loraName', 'loraStrength', 'unetName', 'workflow'],
    'generate params',
  );

  const prompt = requireString(input.prompt, 'prompt');
  if (prompt.length > 8000) {
    throw new Error('Invalid local Qwen prompt: length exceeds 8000 characters.');
  }

  let negativePrompt: string | undefined;
  if (input.negativePrompt !== undefined) {
    if (typeof input.negativePrompt !== 'string') {
      throw new Error('Invalid local Qwen negative prompt: must be a string.');
    }
    const trimmed = input.negativePrompt.trim();
    if (trimmed.length > 8000) {
      throw new Error('Invalid local Qwen negative prompt: length exceeds 8000 characters.');
    }
    negativePrompt = trimmed || undefined;
  }

  let images: Array<{ base64: string; mimeType: string }> | undefined;
  if (input.images !== undefined) {
    if (!Array.isArray(input.images)) {
      throw new Error('Invalid local Qwen images: must be an array.');
    }
    images = input.images.map((img, idx) => {
      const rec = requireRecord(img, `reference image [${idx}]`);
      assertOnlyKeys(rec, ['base64', 'mimeType'], `reference image [${idx}]`);
      const base64 = requireString(rec.base64, `reference image [${idx}] base64`);
      const mimeType = requireString(rec.mimeType, `reference image [${idx}] mimeType`);
      if (!mimeType.startsWith('image/')) {
        throw new Error(`Invalid local Qwen reference image [${idx}] mimeType: must start with image/.`);
      }
      return { base64, mimeType };
    });
  }

  let resolution: number | undefined;
  if (input.resolution !== undefined) {
    if (
      typeof input.resolution !== 'number' ||
      !(LOCAL_QWEN_RESOLUTIONS as readonly number[]).includes(input.resolution)
    ) {
      throw new Error(
        `Invalid local Qwen resolution: must be one of ${LOCAL_QWEN_RESOLUTIONS.join(', ')}.`,
      );
    }
    resolution = input.resolution;
  }

  let steps: number | undefined;
  if (input.steps !== undefined) {
    if (
      typeof input.steps !== 'number' ||
      !Number.isInteger(input.steps) ||
      input.steps < LOCAL_QWEN_MIN_STEPS ||
      input.steps > LOCAL_QWEN_MAX_STEPS
    ) {
      throw new Error(
        `Invalid local Qwen steps: must be an integer between ${LOCAL_QWEN_MIN_STEPS} and ${LOCAL_QWEN_MAX_STEPS}.`,
      );
    }
    steps = input.steps;
  }

  let cfg: number | undefined;
  if (input.cfg !== undefined) {
    if (
      typeof input.cfg !== 'number' ||
      !Number.isFinite(input.cfg) ||
      input.cfg < LOCAL_QWEN_MIN_CFG ||
      input.cfg > LOCAL_QWEN_MAX_CFG
    ) {
      throw new Error(
        `Invalid local Qwen cfg: must be a number between ${LOCAL_QWEN_MIN_CFG} and ${LOCAL_QWEN_MAX_CFG}.`,
      );
    }
    cfg = input.cfg;
  }

  let sampler: string | undefined;
  if (input.sampler !== undefined) {
    if (
      typeof input.sampler !== 'string' ||
      !(LOCAL_QWEN_SAMPLERS as readonly string[]).includes(input.sampler)
    ) {
      throw new Error(
        `Invalid local Qwen sampler: must be one of ${LOCAL_QWEN_SAMPLERS.join(', ')}.`,
      );
    }
    sampler = input.sampler;
  }

  let scheduler: string | undefined;
  if (input.scheduler !== undefined) {
    if (
      typeof input.scheduler !== 'string' ||
      !(LOCAL_QWEN_SCHEDULERS as readonly string[]).includes(input.scheduler)
    ) {
      throw new Error(
        `Invalid local Qwen scheduler: must be one of ${LOCAL_QWEN_SCHEDULERS.join(', ')}.`,
      );
    }
    scheduler = input.scheduler;
  }

  let seed: number | undefined;
  if (input.seed !== undefined) {
    if (
      typeof input.seed !== 'number' ||
      !Number.isInteger(input.seed) ||
      input.seed < 0 ||
      input.seed > 4_294_967_295
    ) {
      throw new Error('Invalid local Qwen seed: must be an integer between 0 and 4294967295.');
    }
    seed = input.seed;
  }

  let loraName: string | undefined;
  if (input.loraName !== undefined) {
    if (typeof input.loraName !== 'string') {
      throw new Error('Invalid local Qwen loraName: must be a string.');
    }
    const trimmed = input.loraName.trim();
    loraName = trimmed || undefined;
  }

  let loraStrength: number | undefined;
  if (input.loraStrength !== undefined) {
    if (typeof input.loraStrength !== 'number' || !Number.isFinite(input.loraStrength)) {
      throw new Error('Invalid local Qwen loraStrength: must be a finite number.');
    }
    loraStrength = input.loraStrength;
  }

  let unetName: string | undefined;
  if (input.unetName !== undefined) {
    if (typeof input.unetName !== 'string') {
      throw new Error('Invalid local Qwen unetName: must be a string.');
    }
    const trimmed = input.unetName.trim();
    unetName = trimmed || undefined;
  }

  let workflow: 'identity-transfer' | 'face-swap' | 'standard' | undefined;
  if (input.workflow !== undefined) {
    if (
      typeof input.workflow !== 'string' ||
      !['identity-transfer', 'face-swap', 'standard'].includes(input.workflow)
    ) {
      throw new Error('Invalid local Qwen workflow: must be identity-transfer, face-swap, or standard.');
    }
    workflow = input.workflow as 'identity-transfer' | 'face-swap' | 'standard';
  }

  return {
    prompt,
    negativePrompt,
    images,
    resolution,
    steps,
    cfg,
    sampler,
    scheduler,
    seed,
    loraName,
    loraStrength,
    unetName,
    workflow,
  };
};

export const parseLocalQwenUpscaleParams = (value: unknown): LocalQwenUpscaleParams => {
  const input = requireRecord(value, 'upscale params');
  assertOnlyKeys(input, ['image', 'scale'], 'upscale params');

  const image = requireString(input.image, 'upscale image');

  let scale: number | undefined;
  if (input.scale !== undefined) {
    if (
      typeof input.scale !== 'number' ||
      !Number.isFinite(input.scale) ||
      input.scale <= 0 ||
      input.scale > 8
    ) {
      throw new Error('Invalid local Qwen upscale scale: must be a number in (0, 8].');
    }
    scale = input.scale;
  }

  return { image, scale };
};

export const parseLocalQwenFolder = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  return requireString(value, 'folder path');
};

export const localQwenManager = new LocalQwenManager();
export const registerDesktopLocalQwenHandlers = (
  manager: LocalQwenManager = localQwenManager,
): void => {
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.getStatus, (event, folder?: string) =>
    trustedBridge(event, () => manager.getStatus(folder)),
  );
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.startServer, (event, folder) =>
    trustedBridge(event, () => {
      const parsedFolder = parseLocalQwenFolder(folder);
      return manager.startServer(parsedFolder);
    }),
  );
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.stopServer, (event) =>
    trustedBridge(event, () => manager.stopServer()),
  );
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.generateImage, (event, params) =>
    trustedBridge(event, () => {
      const validated = parseLocalQwenGenerateParams(params);
      return manager.generateImage(validated);
    }),
  );
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.cancelJob, (event) =>
    trustedBridge(event, () => manager.cancelJob()),
  );
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.upscaleImage, (event, params) =>
    trustedBridge(event, () => {
      const validated = parseLocalQwenUpscaleParams(params);
      return manager.upscaleImage(validated);
    }),
  );
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.verifyFolder, (event, folder) =>
    trustedBridge(event, () => {
      const parsedFolder = parseLocalQwenFolder(folder);
      return manager.checkFolder(parsedFolder || '');
    }),
  );
};
