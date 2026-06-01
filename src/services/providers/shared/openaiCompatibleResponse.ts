import { ImageFile } from '../../../types';
import { ProviderApiError, ProviderUnsupportedResponseError } from './ProviderApiError';

/** Minimal shape of an OpenAI-compatible image response item. */
interface OpenAiImageItem {
  b64_json?: string;
  url?: string;
}

interface OpenAiImageResponse {
  data?: OpenAiImageItem[];
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

const DEFAULT_MIME_TYPE = 'image/png';

/**
 * Parse an OpenAI-compatible image response into `ImageFile[]`.
 *
 * Contract:
 * 1. If the response carries an `error` envelope (some providers return 200 +
 *    error body), throw {@link ProviderApiError}.
 * 2. Extract `data[].b64_json`. If items exist but only carry `url`, throw
 *    {@link ProviderUnsupportedResponseError} — the studio is local-only.
 * 3. If no usable image data is present, throw `ProviderUnsupportedResponseError`.
 *
 * @param mimeType MIME type to stamp onto returned images (defaults to image/png).
 */
export function parseOpenAIResponse(
  response: unknown,
  mimeType: string = DEFAULT_MIME_TYPE,
): ImageFile[] {
  if (!response || typeof response !== 'object') {
    throw new ProviderUnsupportedResponseError('error.provider.response.malformed');
  }

  const payload = response as OpenAiImageResponse;

  if (payload.error) {
    const message = payload.error.message || 'error.provider.response.error';
    throw new ProviderApiError(message, 0, payload.error.code || payload.error.type);
  }

  const items = Array.isArray(payload.data) ? payload.data : [];

  if (items.length === 0) {
    throw new ProviderUnsupportedResponseError('error.provider.response.noImages');
  }

  const images: ImageFile[] = [];
  let sawUrlOnly = false;

  for (const item of items) {
    if (item && typeof item.b64_json === 'string' && item.b64_json.length > 0) {
      images.push({ base64: item.b64_json, mimeType });
    } else if (item && typeof item.url === 'string' && item.url.length > 0) {
      sawUrlOnly = true;
    }
  }

  if (images.length === 0) {
    if (sawUrlOnly) {
      // Provider returned URL-only output; the studio cannot store remote images.
      throw new ProviderUnsupportedResponseError('error.provider.response.urlOnly');
    }
    throw new ProviderUnsupportedResponseError('error.provider.response.noImages');
  }

  return images;
}
