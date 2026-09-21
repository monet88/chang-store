import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { ipcMain } from 'electron';
import {
  DESKTOP_LOCAL_QWEN_CHANNELS,
  type DesktopLocalQwenState,
  type DesktopLocalQwenStatus,
  type DesktopLocalQwenStopResult,
  type LocalQwenGenerateParams,
  type LocalQwenGenerateResult,
  type LocalQwenUpscaleParams,
  type LocalQwenUpscaleResult,
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
  fetchFn?: typeof fetch;
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
  private fetchFn: typeof fetch;
  private readinessTimeoutMs: number;
  private readinessPollIntervalMs: number;

  constructor(options: LocalQwenManagerOptions = {}) {
    this.port = options.port ?? DEFAULT_COMFYUI_PORT;
    this.probeFn = options.probeFn ?? defaultProbeFn;
    this.spawnFn =
      options.spawnFn ??
      ((cmd, args, opts) => spawn(cmd, args as string[], opts as Parameters<typeof spawn>[2]));
    this.fetchFn = options.fetchFn ?? ((url, init) => fetch(url, init));
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
  public async generateImage(params: LocalQwenGenerateParams): Promise<LocalQwenGenerateResult> {
    const isReady = await this.probe();
    if (!isReady) {
      throw new Error(`ComfyUI server is not running on 127.0.0.1:${this.port}. Please start it first.`);
    }

    const host = `127.0.0.1:${this.port}`;
    const baseUrl = `http://${host}`;

    const uploadedFileNames: string[] = [];
    if (params.images && params.images.length > 0) {
      for (let i = 0; i < params.images.length; i++) {
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
        });

        if (!uploadRes.ok) {
          const errText = await uploadRes.text().catch(() => uploadRes.statusText);
          throw new Error(`Failed to upload reference image ${i + 1} to ComfyUI: ${errText}`);
        }

        const uploadData = (await uploadRes.json()) as { name?: string };
        uploadedFileNames.push(uploadData.name || filename);
      }
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
    const steps = params.steps ?? 16;
    const cfg = params.cfg ?? 1.0;
    const seed = params.seed ?? Math.floor(Math.random() * 1_000_000_000);

    const workflow: Record<string, unknown> = {
      '1': {
        class_type: 'UnetLoaderGGUF',
        inputs: {
          unet_name: 'qwen-image-2.1-Q4_K_M.gguf',
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
        model: ['1', 0],
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

    const clientId = `chang-store-${Date.now()}`;
    const promptRes = await this.fetchFn(`${baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
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

    const timeoutMs = 600_000;
    const pollIntervalMs = 500;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const historyRes = await this.fetchFn(`${baseUrl}/history/${promptId}`);
      if (historyRes.ok) {
        const historyData = (await historyRes.json()) as Record<string, {
          outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }>;
          status?: { status_str?: string; messages?: unknown };
        }>;

        const item = historyData[promptId];
        if (item) {
          if (item.status?.status_str === 'error') {
            throw new Error(`ComfyUI execution failed: ${JSON.stringify(item.status.messages || 'Unknown error')}`);
          }

          if (item.outputs) {
            for (const nodeId of Object.keys(item.outputs)) {
              const nodeOut = item.outputs[nodeId];
              if (nodeOut?.images && nodeOut.images.length > 0) {
                const imgInfo = nodeOut.images[0];
                const viewUrl = `${baseUrl}/view?filename=${encodeURIComponent(imgInfo.filename)}&subfolder=${encodeURIComponent(imgInfo.subfolder || '')}&type=${encodeURIComponent(imgInfo.type || 'output')}`;
                const viewRes = await this.fetchFn(viewUrl);
                if (!viewRes.ok) {
                  throw new Error(`Failed to fetch rendered image from ComfyUI: ${viewRes.statusText}`);
                }
                const buffer = Buffer.from(await viewRes.arrayBuffer());
                const base64 = buffer.toString('base64');
                return {
                  image: {
                    base64,
                    mimeType: 'image/png',
                  },
                };
              }
            }
          }
        }
      }

      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, pollIntervalMs);
      await promise;
    }

    throw new Error('ComfyUI generation timed out.');
  }

  public async upscaleImage(params: LocalQwenUpscaleParams): Promise<LocalQwenUpscaleResult> {
    const isReady = await this.probe();
    if (!isReady) {
      throw new Error(`ComfyUI server is not running on 127.0.0.1:${this.port}. Please start it first.`);
    }

    if (!params || typeof params.image !== 'string' || !params.image.trim()) {
      throw new Error('No image provided for upscale.');
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

    const timeoutMs = 600_000;
    const pollIntervalMs = 500;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const historyRes = await this.fetchFn(`${baseUrl}/history/${promptId}`);
      if (historyRes.ok) {
        const historyData = (await historyRes.json()) as Record<string, {
          outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }>;
          status?: { status_str?: string; messages?: unknown };
        }>;

        const item = historyData[promptId];
        if (item) {
          if (item.status?.status_str === 'error') {
            throw new Error(`ComfyUI upscale execution failed: ${JSON.stringify(item.status.messages || 'Unknown error')}`);
          }

          if (item.outputs) {
            for (const nodeId of Object.keys(item.outputs)) {
              const nodeOut = item.outputs[nodeId];
              if (nodeOut?.images && nodeOut.images.length > 0) {
                const imgInfo = nodeOut.images[0];
                const viewUrl = `${baseUrl}/view?filename=${encodeURIComponent(imgInfo.filename)}&subfolder=${encodeURIComponent(imgInfo.subfolder || '')}&type=${encodeURIComponent(imgInfo.type || 'output')}`;
                const viewRes = await this.fetchFn(viewUrl);
                if (!viewRes.ok) {
                  throw new Error(`Failed to fetch upscaled image from ComfyUI: ${viewRes.statusText}`);
                }
                const imageBuffer = Buffer.from(await viewRes.arrayBuffer());
                const base64 = imageBuffer.toString('base64');
                return {
                  image: base64,
                };
              }
            }
          }
        }
      }

      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, pollIntervalMs);
      await promise;
    }

    throw new Error('ComfyUI upscale timed out.');
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
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.generateImage, (event, params) =>
    trustedBridge(event, () => manager.generateImage(params as LocalQwenGenerateParams)),
  );
  ipcMain.handle(DESKTOP_LOCAL_QWEN_CHANNELS.upscaleImage, (event, params) =>
    trustedBridge(event, () => manager.upscaleImage(params as LocalQwenUpscaleParams)),
  );
};
