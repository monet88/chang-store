import { ImageFile } from '../../../types';
import {
  GptImageQuality,
  GPT_IMAGE_OUTPUT_COUNT,
  MAX_GPT_REFERENCE_IMAGES,
} from '../../../config/gptImageModelRegistry';
import { ProviderApiError } from '../shared/ProviderApiError';
import { parseOpenAIResponse } from '../shared/openaiCompatibleResponse';
import { prepareRequestFields, resolveDriverPolicy, verifyReturnedDimensions, type DriverPolicy } from '../shared/imageDriverPolicy';
import { withRetry } from '../shared/withRetry';
import { validatePrompt } from '../shared/validatePrompt';
import { validateProviderBaseUrl } from '../../../utils/provider-url-validation';
import { safeFetch } from '../shared/safeFetch';

export interface GptImageServiceConfig {
  apiKey: string;
  baseUrl: string;
}

export interface GptImageGenerateParams {
  /** Model id sent verbatim; the catalog decides which ids a gateway can serve. */
  model: string;
  prompt: string;
  size: string;
  quality: GptImageQuality;
}

export interface GptImageEditParams {
  /** Model id sent verbatim; the catalog decides which ids a gateway can serve. */
  model: string;
  prompt: string;
  images: ImageFile[];
  size: string;
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
export async function imageFileToBlob(image: ImageFile): Promise<Blob> {
  // ⚡ Bolt: Optimize by replacing synchronous atob loop with native async fetch API
  // atob + charCodeAt loop is O(N) in JS and blocks the main thread for large base64 strings.
  // Using fetch() delegates the base64 decoding to the browser's native C++ implementation
  // which is significantly faster and non-blocking.
  const mimeType = image.mimeType || 'image/png';
  const response = await fetch(`data:${mimeType};base64,${image.base64}`);
  return response.blob();
}

async function handleResponse(response: Response, policy: DriverPolicy | null, requestedSize: string): Promise<ImageFile[]> {
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
  const images = await parseOpenAIResponse(data, RESULT_MIME_TYPE);

  if (policy) {
    const mismatch = await verifyReturnedDimensions(images, requestedSize, policy.capabilities, {
      modelId: policy.descriptor.modelId,
    });
    // The guard never drops an image; it marks it so the tile can say what came back.
    return mismatch ? images.map((image) => ({ ...image, sizeWarning: mismatch })) : images;
  }

  return images;
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
  const policy = resolveDriverPolicy(params.model, config.baseUrl);
  const fields = prepareRequestFields(params.model, params, policy);

  const body: Record<string, string | number> = {
    model: params.model,
    prompt,
    n: GPT_IMAGE_OUTPUT_COUNT,
    response_format: 'b64_json',
  };
  for (const [name, value] of fields) {
    body[name] = value;
  }

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
      return handleResponse(response, policy, params.size);
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
  const policy = resolveDriverPolicy(params.model, config.baseUrl);
  const fields = prepareRequestFields(params.model, params, policy);

  return withRetry(
    async (retrySignal) => {
      const form = new FormData();
      form.append('model', params.model);
      form.append('prompt', prompt);
      form.append('n', String(GPT_IMAGE_OUTPUT_COUNT));
      form.append('response_format', 'b64_json');
      for (const [name, value] of fields) {
        form.append(name, value);
      }

      const blobs = await Promise.all(params.images.map(imageFileToBlob));
      params.images.forEach((image, index) => {
        form.append('image[]', blobs[index], `image-${index}.${extensionForMime(image.mimeType)}`);
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
      return handleResponse(response, policy, params.size);
    },
    { signal },
  );
}
