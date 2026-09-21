import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';
import {
  LocalQwenManager,
  registerDesktopLocalQwenHandlers,
} from '../../electron/localQwenManager';
import { DESKTOP_LOCAL_QWEN_CHANNELS } from '../../src/platform/desktopLocalQwen';

// Mock electron
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

describe('LocalQwenManager - upscaleImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects with clean error when ComfyUI is not running', async () => {
    const probeFn = vi.fn().mockResolvedValue(false);
    const manager = new LocalQwenManager({ probeFn });

    await expect(
      manager.upscaleImage({ image: 'valid-base64-data', scale: 2 }),
    ).rejects.toThrow(/ComfyUI server is not running on 127\.0\.0\.1:8188/);
  });

  it('rejects when image parameter is empty or missing', async () => {
    const probeFn = vi.fn().mockResolvedValue(true);
    const manager = new LocalQwenManager({ probeFn });

    await expect(
      manager.upscaleImage({ image: '', scale: 2 }),
    ).rejects.toThrow(/No image provided for upscale/);

    await expect(
      manager.upscaleImage({ image: '   ' }),
    ).rejects.toThrow(/No image provided for upscale/);
  });

  it('uploads image and submits ImageScaleBy workflow to local ComfyUI', async () => {
    const promptId = 'test-prompt-upscale-123';
    const uploadedName = 'uploaded_input.png';
    const outputFilename = 'upscaled_result_00001.png';
    const upscaledBytes = Buffer.from('fake-upscaled-png-bytes');

    let submittedWorkflow: Record<string, unknown> | null = null;
    const fetchFn = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      // Must strictly connect to loopback
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:8188/);

      if (url.endsWith('/upload/image')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ name: uploadedName }),
        };
      }

      if (url.endsWith('/prompt')) {
        const body = JSON.parse(init?.body as string);
        submittedWorkflow = body.prompt;
        return {
          ok: true,
          status: 200,
          json: async () => ({ prompt_id: promptId }),
        };
      }

      if (url.includes(`/history/${promptId}`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            [promptId]: {
              outputs: {
                '3': {
                  images: [{ filename: outputFilename, subfolder: '', type: 'output' }],
                },
              },
            },
          }),
        };
      }

      if (url.includes('/view')) {
        expect(url).toContain(encodeURIComponent(outputFilename));
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => upscaledBytes.buffer.slice(upscaledBytes.byteOffset, upscaledBytes.byteOffset + upscaledBytes.byteLength),
        };
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    const probeFn = vi.fn().mockResolvedValue(true);
    const manager = new LocalQwenManager({ probeFn, fetchFn: fetchFn as unknown as typeof fetch });

    const result = await manager.upscaleImage({
      image: 'data:image/png;base64,' + Buffer.from('input-data').toString('base64'),
      scale: 2,
    });

    expect(result).toBeDefined();
    expect(result.image).toBe(upscaledBytes.toString('base64'));

    // Verify workflow structure
    expect(submittedWorkflow).toBeDefined();
    const wf = submittedWorkflow as Record<string, { class_type: string; inputs: Record<string, unknown> }>;

    expect(wf['1'].class_type).toBe('LoadImage');
    expect(wf['1'].inputs.image).toBe(uploadedName);

    expect(wf['2'].class_type).toBe('ImageScaleBy');
    expect(wf['2'].inputs.image).toEqual(['1', 0]);
    expect(wf['2'].inputs.scale_by).toBe(2);
    expect(wf['2'].inputs.upscale_method).toBe('bicubic');

    expect(wf['3'].class_type).toBe('SaveImage');
    expect(wf['3'].inputs.images).toEqual(['2', 0]);
    expect(wf['3'].inputs.filename_prefix).toBe('Qwen_Upscale');
  });

  it('respects custom scale factor (e.g. 4 for 4K quality)', async () => {
    const promptId = 'test-prompt-4k';
    let submittedScale: number | null = null;

    const fetchFn = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/upload/image')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ name: 'input.png' }),
        };
      }
      if (url.endsWith('/prompt')) {
        const body = JSON.parse(init?.body as string);
        submittedScale = body.prompt['2'].inputs.scale_by;
        return {
          ok: true,
          status: 200,
          json: async () => ({ prompt_id: promptId }),
        };
      }
      if (url.includes(`/history/${promptId}`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            [promptId]: {
              outputs: {
                '3': { images: [{ filename: 'result.png' }] },
              },
            },
          }),
        };
      }
      if (url.includes('/view')) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => Buffer.from('4k-bytes').buffer,
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    const probeFn = vi.fn().mockResolvedValue(true);
    const manager = new LocalQwenManager({ probeFn, fetchFn: fetchFn as unknown as typeof fetch });

    await manager.upscaleImage({
      image: Buffer.from('raw-image-bytes').toString('base64'),
      scale: 4,
    });

    expect(submittedScale).toBe(4);
  });

  it('returns clean local error when ComfyUI rejects prompt', async () => {
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/upload/image')) {
        return { ok: true, status: 200, json: async () => ({ name: 'img.png' }) };
      }
      if (url.endsWith('/prompt')) {
        return {
          ok: false,
          status: 400,
          text: async () => 'Custom node missing or invalid input',
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    const probeFn = vi.fn().mockResolvedValue(true);
    const manager = new LocalQwenManager({ probeFn, fetchFn: fetchFn as unknown as typeof fetch });

    await expect(
      manager.upscaleImage({ image: 'some-base64', scale: 2 }),
    ).rejects.toThrow(/ComfyUI upscale rejected \(400\): Custom node missing/);
  });

  it('returns clean local error when ComfyUI execution fails in history', async () => {
    const promptId = 'failed-prompt-id';
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/upload/image')) {
        return { ok: true, status: 200, json: async () => ({ name: 'img.png' }) };
      }
      if (url.endsWith('/prompt')) {
        return { ok: true, status: 200, json: async () => ({ prompt_id: promptId }) };
      }
      if (url.includes(`/history/${promptId}`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            [promptId]: {
              status: {
                status_str: 'error',
                messages: ['CUDA out of memory in ImageScaleBy'],
              },
            },
          }),
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    const probeFn = vi.fn().mockResolvedValue(true);
    const manager = new LocalQwenManager({ probeFn, fetchFn: fetchFn as unknown as typeof fetch });

    await expect(
      manager.upscaleImage({ image: 'some-base64', scale: 2 }),
    ).rejects.toThrow(/ComfyUI upscale execution failed/);
  });

  it('registers upscaleImage handler with desktopLocalQwen channels', () => {
    const manager = new LocalQwenManager();
    registerDesktopLocalQwenHandlers(manager);

    expect(ipcMain.handle).toHaveBeenCalledWith(
      DESKTOP_LOCAL_QWEN_CHANNELS.upscaleImage,
      expect.any(Function),
    );
  });
});
