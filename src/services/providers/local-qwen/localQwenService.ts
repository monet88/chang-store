import type { ImageFile } from '../../../types';
import {
  getDesktopLocalQwenApi,
  type LocalQwenGenerateParams,
} from '../../../platform/desktopLocalQwen';

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
    const result = await desktopLocalQwen.generateImage(params);
    if (!result.ok) {
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
