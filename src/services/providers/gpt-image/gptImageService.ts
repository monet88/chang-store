import { ImageFile } from '../../../types';
import {
  GptImageModelId,
  GptImageQuality,
  GptImageSize,
  GPT_IMAGE_OUTPUT_COUNT,
  MAX_GPT_REFERENCE_IMAGES,
} from '../../../config/gptImageModelRegistry';
import { ProviderApiError } from '../shared/ProviderApiError';
import { parseOpenAIResponse } from '../shared/openaiCompatibleResponse';
import { withRetry } from '../shared/withRetry';
import { validatePrompt } from '../shared/validatePrompt';
import { validateProviderBaseUrl } from '../../../utils/provider-url-validation';
import { safeFetch } from '../shared/safeFetch';

export interface GptImageServiceConfig {
  apiKey: string;
  baseUrl: string;
}

export interface GptImageGenerateParams {
  model: GptImageModelId;
  prompt: string;
  size: GptImageSize;
  quality: GptImageQuality;
}

export interface GptImageEditParams {
  model: GptImageModelId;
  prompt: string;
  images: ImageFile[];
  size: GptImageSize;
  quality: GptImageQuality;
}

const RESULT_MIME_TYPE = 'image/png';

const joinUrl = (baseUrl: string, path: string): string => {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}${path}`;
};

const assertConfig = (config: GptImageServiceConfig): void => {
  if (!config.apiKey) {
    throw new ProviderApiError('error.provider.missingApiKey', 401, 'missing_api_key');
  }
  // Require a parseable HTTP(S) URL before sending the bearer token anywhere.
  const urlCheck = validateProviderBaseUrl(config.baseUrl);
  if (urlCheck.status === 'invalid') {
    throw new ProviderApiError('error.provider.missingBaseUrl', 400, 'invalid_base_url');
  }
};

const extensionForMime = (mimeType: string): string => {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
};

/** Convert an ImageFile (base64) into a Blob preserving its MIME type. */
export function imageFileToBlob(image: ImageFile): Blob {
  const binary = atob(image.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: image.mimeType || 'image/png' });
}

async function handleResponse(response: Response): Promise<ImageFile[]> {
  if (!response.ok) {
    let code: string | undefined;
    let message = 'error.provider.requestFailed';
    try {
      const body = await response.json();
      message = body?.error?.message ?? message;
      code = body?.error?.code ?? body?.error?.type;
    } catch {
      // Non-JSON error body.
    }
    throw new ProviderApiError(message, response.status, code);
  }

  const data = await response.json();
  return parseOpenAIResponse(data, RESULT_MIME_TYPE);
}

/**
 * Generate an image via OpenAI `POST /v1/images/generations` (JSON body).
 */
export async function generateGptImage(
  params: GptImageGenerateParams,
  config: GptImageServiceConfig,
  signal?: AbortSignal,
): Promise<ImageFile[]> {
  assertConfig(config);
  const prompt = validatePrompt(params.prompt);

  const body = {
    model: params.model,
    prompt,
    n: GPT_IMAGE_OUTPUT_COUNT,
    size: params.size,
    quality: params.quality,
  };

  return withRetry(
    async (retrySignal) => {
      const response = await safeFetch(joinUrl(config.baseUrl, '/images/generations'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: retrySignal,
      });
      return handleResponse(response);
    },
    { signal },
  );
}

/**
 * Edit images via OpenAI `POST /v1/images/edits` using multipart/form-data with
 * repeated `image[]` fields. Content-Type is NOT set manually — the browser
 * adds the multipart boundary.
 */
export async function editGptImage(
  params: GptImageEditParams,
  config: GptImageServiceConfig,
  signal?: AbortSignal,
): Promise<ImageFile[]> {
  assertConfig(config);

  if (params.images.length === 0) {
    throw new ProviderApiError('error.provider.response.noImages', 400, 'no_source_image');
  }
  if (params.images.length > MAX_GPT_REFERENCE_IMAGES) {
    throw new ProviderApiError('error.provider.tooManyImages', 400, 'too_many_images');
  }

  const prompt = validatePrompt(params.prompt);

  return withRetry(
    async (retrySignal) => {
      const form = new FormData();
      form.append('model', params.model);
      form.append('prompt', prompt);
      form.append('n', String(GPT_IMAGE_OUTPUT_COUNT));
      form.append('size', params.size);
      form.append('quality', params.quality);

      params.images.forEach((image, index) => {
        const blob = imageFileToBlob(image);
        form.append('image[]', blob, `image-${index}.${extensionForMime(image.mimeType)}`);
      });

      const response = await safeFetch(joinUrl(config.baseUrl, '/images/edits'), {
        method: 'POST',
        headers: {
          // Do NOT set Content-Type — the browser sets the multipart boundary.
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: form,
        signal: retrySignal,
      });
      return handleResponse(response);
    },
    { signal },
  );
}
