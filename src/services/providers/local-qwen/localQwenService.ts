import type { ImageFile } from '../../../types';
import {
  getDesktopLocalQwenApi,
  type LocalQwenGenerateParams,
} from '../../../platform/desktopLocalQwen';
import { loadLocalQwenSettings } from '../../../config/localQwenSettings';

/**
 * Calls desktop Local Qwen bridge to generate an image using local ComfyUI.
 *
 * Contract:
 * - Desktop only. Throws if invoked in a browser environment.
 * - Local failures stay local and NEVER fall back to cloud providers (Gemini, GPT Image).
 */
export const generateLocalQwenImage = async (
  params: LocalQwenGenerateParams,
  signal?: AbortSignal,
): Promise<ImageFile[]> => {
  const desktopLocalQwen = getDesktopLocalQwenApi();
  if (!desktopLocalQwen) {
    throw new Error('Local Qwen generation is only available in the desktop application.');
  }

  if (signal?.aborted) {
    throw new Error('Local Qwen generation was cancelled.');
  }

  const abortHandler = () => {
    void desktopLocalQwen.cancelJob().catch(() => {});
  };
  signal?.addEventListener('abort', abortHandler, { once: true });

  try {
    const statusRes = await desktopLocalQwen.getStatus();
    if (signal?.aborted) {
      throw new Error('Local Qwen generation was cancelled.');
    }

    if (statusRes?.ok && statusRes.value.state !== 'ready' && statusRes.value.state !== 'generating') {
      const configuredPath = loadLocalQwenSettings().comfyUiPath || undefined;
      const startRes = await desktopLocalQwen.startServer(configuredPath);
      if (signal?.aborted) {
        throw new Error('Local Qwen generation was cancelled.');
      }
      if (startRes?.ok === false) {
        throw new Error(startRes.error.message || 'Failed to auto-start local ComfyUI server.');
      }
    }

    if (signal?.aborted) {
      throw new Error('Local Qwen generation was cancelled.');
    }

    const result = await desktopLocalQwen.generateImage(params);
    if (signal?.aborted) {
      throw new Error('Local Qwen generation was cancelled.');
    }
    if (result.ok === false) {
      throw new Error(result.error.message || 'Local Qwen generation failed.');
    }

    return [
      {
        base64: result.value.image.base64,
        mimeType: result.value.image.mimeType || 'image/png',
      },
    ];
  } finally {
    signal?.removeEventListener('abort', abortHandler);
  }
};
