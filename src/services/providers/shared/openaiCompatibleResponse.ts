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
/** Chunk size for `String.fromCharCode` — a 1.4 MB PNG is ~1.9 M characters. */
const BASE64_CHUNK = 0x8000;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + BASE64_CHUNK));
  }
  return btoa(binary);
};

/**
 * Download a provider-hosted image into a base64 payload. A gateway that answers
 * `url` instead of `b64_json` is supported, not rejected (measured on both
 * gateways, whose CDN sends `Access-Control-Allow-Origin` echoing the Origin).
 * Any download or decoding failure keeps the old `urlOnly` error.
 */
const downloadImage = async (url: string, fallbackMimeType: string): Promise<ImageFile> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new ProviderUnsupportedResponseError('error.provider.response.urlOnly');
    }
    const contentType = response.headers.get('content-type')?.split(';')[0].trim();

    return {
      base64: bytesToBase64(new Uint8Array(await response.arrayBuffer())),
      mimeType: contentType?.startsWith('image/') ? contentType : fallbackMimeType,
    };
  } catch (error) {
    if (error instanceof ProviderUnsupportedResponseError) {
      throw error;
    }
    throw new ProviderUnsupportedResponseError('error.provider.response.urlOnly');
  }
};

/**
 * Parse an OpenAI-compatible image response into `ImageFile[]`.
 *
 * Contract:
 * 1. If the response carries an `error` envelope (some providers return 200 +
 *    error body), throw {@link ProviderApiError}.
 * 2. Use `data[].b64_json` directly; download `data[].url` and convert it;
 *    a mixed response keeps its item order.
 * 3. Neither shape present, or an empty `data[]`, throws
 *    {@link ProviderUnsupportedResponseError} — `unknownShape` / `noImages`.
 *
 * @param mimeType MIME type to stamp onto a `b64_json` payload (defaults to image/png).
 */
export async function parseOpenAIResponse(
  response: unknown,
  mimeType: string = DEFAULT_MIME_TYPE,
): Promise<ImageFile[]> {
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

  for (const item of items) {
    if (item && typeof item.b64_json === 'string' && item.b64_json.length > 0) {
      images.push({ base64: item.b64_json, mimeType });
    } else if (item && typeof item.url === 'string' && item.url.length > 0) {
      images.push(await downloadImage(item.url, mimeType));
    }
  }

  if (images.length === 0) {
    throw new ProviderUnsupportedResponseError('error.provider.response.unknownShape');
  }

  return images;
}
