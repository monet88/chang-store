import { ImageFile } from '../types';

export interface LocalProviderConfig {
  baseUrl: string;
  apiKey?: string | null;
}

const DEFAULT_IMAGE_SIZE = '1024x1024';
const DEFAULT_ASPECT_RATIO = '1:1';
const DEFAULT_IMAGE_RESOLUTION = '1K';

type InlineData = {
  data?: string;
  mimeType?: string;
  mime_type?: string;
};

type GeminiPart = {
  text?: string;
  inlineData?: InlineData;
  inline_data?: InlineData;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function buildGeminiUrl(baseUrl: string, model: string, action: 'generateContent', apiKey?: string | null): string {
  const trimmed = normalizeBaseUrl(baseUrl);
  const baseWithVersion = trimmed.endsWith('/v1beta') ? trimmed : `${trimmed}/v1beta`;
  const url = `${baseWithVersion}/models/${model}:${action}`;
  if (!apiKey) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}key=${encodeURIComponent(apiKey)}`;
}

async function postJson<T>(
  url: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('error.api.localProviderFailed');
  }

  const text = await response.text();
  try {
    return text ? JSON.parse(text) : ({} as T);
  } catch {
    throw new Error('error.api.invalidResponse');
  }
}

function normalizeError(error: unknown): Error {
  const message = error instanceof Error ? error.message : 'error.unknown';
  if (message.startsWith('error.')) {
    return new Error(message);
  }
  return new Error('error.api.localProviderFailed');
}

function normalizeBase64(base64: string): string {
  return base64.includes(',') ? base64.split(',')[1] : base64;
}

function extractParts(data: GeminiResponse): GeminiPart[] {
  return data?.candidates?.[0]?.content?.parts ?? [];
}

function extractText(parts: GeminiPart[]): string | null {
  const text = parts.map((part) => part.text).filter(Boolean).join(' ').trim();
  return text || null;
}

function extractInlineImage(parts: GeminiPart[]): { data: string; mimeType: string } | null {
  for (const part of parts) {
    const inline = part.inlineData ?? part.inline_data;
    if (inline?.data) {
      return {
        data: inline.data,
        mimeType: inline.mimeType ?? inline.mime_type ?? 'image/png',
      };
    }
  }
  return null;
}

function mapSizeToAspectRatio(size: string): string {
  const [widthStr, heightStr] = size.split('x');
  const width = Number(widthStr);
  const height = Number(heightStr);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return DEFAULT_ASPECT_RATIO;
  }
  const ratio = width / height;
  const candidates: Array<{ ratio: number; value: string }> = [
    { ratio: 1, value: '1:1' },
    { ratio: 9 / 16, value: '9:16' },
    { ratio: 16 / 9, value: '16:9' },
    { ratio: 4 / 3, value: '4:3' },
    { ratio: 3 / 4, value: '3:4' },
    { ratio: 2 / 3, value: '2:3' },
    { ratio: 3 / 2, value: '3:2' },
    { ratio: 4 / 5, value: '4:5' },
    { ratio: 5 / 4, value: '5:4' },
    { ratio: 21 / 9, value: '21:9' },
  ];

  let closest = candidates[0];
  let minDiff = Math.abs(ratio - closest.ratio);
  for (const candidate of candidates) {
    const diff = Math.abs(ratio - candidate.ratio);
    if (diff < minDiff) {
      minDiff = diff;
      closest = candidate;
    }
  }
  return closest.value;
}

function mapSizeToImageSize(size: string): string {
  const [widthStr, heightStr] = size.split('x');
  const width = Number(widthStr);
  const height = Number(heightStr);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return DEFAULT_IMAGE_RESOLUTION;
  }
  const maxDimension = Math.max(width, height);
  if (maxDimension <= 1536) {
    return '1K';
  }
  if (maxDimension <= 3072) {
    return '2K';
  }
  return '4K';
}

export async function generateTextLocal(
  prompt: string,
  model: string,
  config: LocalProviderConfig
): Promise<string> {
  try {
    if (!config.baseUrl) {
      throw new Error('error.api.localProviderFailed');
    }
    const url = buildGeminiUrl(config.baseUrl, model, 'generateContent', config.apiKey ?? null);
    const data = await postJson<GeminiResponse>(url, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = extractText(extractParts(data));
    if (!text) {
      throw new Error('error.api.noText');
    }
    return text;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function generateTextFromImageLocal(
  image: ImageFile,
  prompt: string,
  model: string,
  config: LocalProviderConfig
): Promise<string> {
  try {
    if (!config.baseUrl) {
      throw new Error('error.api.localProviderFailed');
    }
    const url = buildGeminiUrl(config.baseUrl, model, 'generateContent', config.apiKey ?? null);
    const data = await postJson<GeminiResponse>(url, {
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { data: normalizeBase64(image.base64), mimeType: image.mimeType } },
        ],
      }],
    });

    const text = extractText(extractParts(data));
    if (!text) {
      throw new Error('error.api.noText');
    }
    return text;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function generateImageLocal(
  prompt: string,
  model: string,
  config: LocalProviderConfig,
  size: string = DEFAULT_IMAGE_SIZE
): Promise<ImageFile> {
  try {
    if (!config.baseUrl) {
      throw new Error('error.api.localProviderFailed');
    }
    const url = buildGeminiUrl(config.baseUrl, model, 'generateContent', config.apiKey ?? null);
    const data = await postJson<GeminiResponse>(url, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: mapSizeToAspectRatio(size),
          imageSize: mapSizeToImageSize(size),
        },
      },
    });

    const inlineImage = extractInlineImage(extractParts(data));
    if (!inlineImage?.data) {
      throw new Error('error.api.noImage');
    }
    return { base64: inlineImage.data, mimeType: inlineImage.mimeType || 'image/png' };
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function editImageLocal(
  image: ImageFile,
  prompt: string,
  model: string,
  config: LocalProviderConfig,
  size: string = DEFAULT_IMAGE_SIZE
): Promise<ImageFile> {
  try {
    if (!config.baseUrl) {
      throw new Error('error.api.localProviderFailed');
    }
    const url = buildGeminiUrl(config.baseUrl, model, 'generateContent', config.apiKey ?? null);
    const data = await postJson<GeminiResponse>(url, {
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: normalizeBase64(image.base64), mimeType: image.mimeType } },
          { text: prompt },
        ],
      }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: mapSizeToAspectRatio(size),
          imageSize: mapSizeToImageSize(size),
        },
      },
    });

    const inlineImage = extractInlineImage(extractParts(data));
    if (!inlineImage?.data) {
      throw new Error('error.api.noImage');
    }
    return { base64: inlineImage.data, mimeType: inlineImage.mimeType || 'image/png' };
  } catch (error) {
    throw normalizeError(error);
  }
}
