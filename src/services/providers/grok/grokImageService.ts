import { ImageFile } from '../../../types';
import {
  GrokModelId,
  GrokAspectRatio,
  GrokResolution,
  GROK_MIN_OUTPUTS,
  GROK_MAX_OUTPUTS,
  GROK_MAX_REFERENCE_IMAGES,
} from '../../../config/grokModelRegistry';
import { ProviderApiError } from '../shared/ProviderApiError';
import { parseOpenAIResponse } from '../shared/openaiCompatibleResponse';
import { withRetry } from '../shared/withRetry';
import { validatePrompt } from '../shared/validatePrompt';
import { validateProviderBaseUrl } from '../../../utils/provider-url-validation';
import { safeFetch } from '../shared/safeFetch';

export interface GrokServiceConfig {
  apiKey: string;
  baseUrl: string;
}

export interface GrokGenerateParams {
  model: GrokModelId;
  prompt: string;
  n: number;
  aspectRatio: GrokAspectRatio;
  resolution: GrokResolution;
}

export interface GrokEditParams {
  model: GrokModelId;
  prompt: string;
  /** Source images. 1 image → `image` object; 2-3 → `images` array. */
  images: ImageFile[];
  n: number;
  aspectRatio?: GrokAspectRatio;
  resolution: GrokResolution;
}

const RESULT_MIME_TYPE = 'image/png';

const toDataUri = (image: ImageFile): string => `data:${image.mimeType};base64,${image.base64}`;

const buildHeaders = (apiKey: string): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
});

const joinUrl = (baseUrl: string, path: string): string => {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}${path}`;
};

const assertConfig = (config: GrokServiceConfig): void => {
  if (!config.apiKey) {
    throw new ProviderApiError('error.provider.missingApiKey', 401, 'missing_api_key');
  }
  // Enforce HTTPS + a parseable URL before sending the bearer token anywhere.
  const urlCheck = validateProviderBaseUrl(config.baseUrl);
  if (urlCheck.status === 'invalid') {
    throw new ProviderApiError('error.provider.missingBaseUrl', 400, 'invalid_base_url');
  }
};

const validateOutputCount = (n: number): void => {
  if (!Number.isInteger(n) || n < GROK_MIN_OUTPUTS || n > GROK_MAX_OUTPUTS) {
    throw new ProviderApiError('error.provider.invalidImageCount', 400, 'invalid_image_count');
  }
};

/**
 * Read a fetch Response and throw ProviderApiError on non-2xx. Otherwise parse
 * the OpenAI-compatible JSON body into ImageFile[] (requires b64_json output).
 */
async function handleResponse(response: Response): Promise<ImageFile[]> {
  if (!response.ok) {
    let code: string | undefined;
    let message = `error.provider.requestFailed`;
    try {
      const body = await response.json();
      message = body?.error?.message ?? message;
      code = body?.error?.code ?? body?.error?.type;
    } catch {
      // Non-JSON error body; keep generic message.
    }
    throw new ProviderApiError(message, response.status, code);
  }

  const data = await response.json();
  return parseOpenAIResponse(data, RESULT_MIME_TYPE);
}

/**
 * Generate images via xAI `POST /v1/images/generations`.
 * Always requests `response_format: 'b64_json'`. Throws a typed
 * unsupported-response error if the provider returns URL-only output.
 */
export async function generateGrokImage(
  params: GrokGenerateParams,
  config: GrokServiceConfig,
  signal?: AbortSignal,
): Promise<ImageFile[]> {
  assertConfig(config);
  validateOutputCount(params.n);
  const prompt = validatePrompt(params.prompt);

  const body = {
    model: params.model,
    prompt,
    n: params.n,
    aspect_ratio: params.aspectRatio,
    resolution: params.resolution,
    response_format: 'b64_json',
  };

  return withRetry(
    async (retrySignal) => {
      const response = await safeFetch(joinUrl(config.baseUrl, '/images/generations'), {
        method: 'POST',
        headers: buildHeaders(config.apiKey),
        body: JSON.stringify(body),
        signal: retrySignal,
      });
      return handleResponse(response);
    },
    { signal },
  );
}

/**
 * Edit images via xAI `POST /v1/images/edits`.
 * Single source uses the `image` object; multiple sources use the `images`
 * array (max 3). Always requests `response_format: 'b64_json'`.
 */
export async function editGrokImage(
  params: GrokEditParams,
  config: GrokServiceConfig,
  signal?: AbortSignal,
): Promise<ImageFile[]> {
  assertConfig(config);
  validateOutputCount(params.n);

  if (params.images.length === 0) {
    throw new ProviderApiError('error.provider.response.noImages', 400, 'no_source_image');
  }
  if (params.images.length > GROK_MAX_REFERENCE_IMAGES) {
    throw new ProviderApiError('error.provider.tooManyImages', 400, 'too_many_images');
  }

  const prompt = validatePrompt(params.prompt);

  const body: Record<string, unknown> = {
    model: params.model,
    prompt,
    n: params.n,
    resolution: params.resolution,
    response_format: 'b64_json',
  };

  if (params.aspectRatio) {
    body.aspect_ratio = params.aspectRatio;
  }

  if (params.images.length === 1) {
    body.image = { type: 'image_url', url: toDataUri(params.images[0]) };
  } else {
    body.images = params.images.map((image) => ({
      type: 'image_url',
      url: toDataUri(image),
    }));
  }

  return withRetry(
    async (retrySignal) => {
      const response = await safeFetch(joinUrl(config.baseUrl, '/images/edits'), {
        method: 'POST',
        headers: buildHeaders(config.apiKey),
        body: JSON.stringify(body),
        signal: retrySignal,
      });
      return handleResponse(response);
    },
    { signal },
  );
}
