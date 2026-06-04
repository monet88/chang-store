import type { IncomingMessage } from 'node:http';
import { GatewayError } from '../http/error-response.js';
import { readMultipartBody } from '../lib/read-multipart.js';
import type { ImageWorkloads } from '../workloads/image-workloads.js';
import type { ImageDto } from '../workloads/image-normalizer.js';

const SUPPORTED_MODELS = new Set([
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
]);

const assertModel = (value: unknown): string => {
  const model = typeof value === 'string' && value.trim() ? value.trim() : 'gemini-3.1-flash-image';
  if (!SUPPORTED_MODELS.has(model)) {
    throw new GatewayError(400, 'VALIDATION_FAILED', `Unsupported image model: ${model}.`);
  }
  return model;
};

const parseDataUrl = (value: string): { mimeType: string; data: string } => {
  const match = value.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new GatewayError(400, 'VALIDATION_FAILED', 'Image inputs must be data URLs with base64-encoded image bytes.');
  }
  return { mimeType: match[1], data: match[2] };
};

const parseSizeToAspectRatio = (size: unknown): string | undefined => {
  if (size === undefined || size === null || size === '') return undefined;
  if (typeof size !== 'string') {
    throw new GatewayError(400, 'VALIDATION_FAILED', 'size must be a string.');
  }
  const normalized = size.trim().toLowerCase();
  const supported: Record<string, string> = {
    '1024x1024': '1:1',
    '1536x1024': '3:2',
    '1024x1536': '2:3',
    '1792x1024': '16:9',
    '1024x1792': '9:16',
  };
  const aspectRatio = supported[normalized];
  if (!aspectRatio) {
    throw new GatewayError(400, 'VALIDATION_FAILED', `Unsupported size: ${size}.`);
  }
  return aspectRatio;
};

const normalizeImagesResponse = (images: ImageDto[]) => ({
  created: Math.floor(Date.now() / 1000),
  data: images.map((image) => ({
    b64_json: image.dataUrl.replace(/^data:.+;base64,/, ''),
  })),
});

const rejectUnsupportedFields = (body: Record<string, unknown>, fields: string[]): void => {
  for (const field of fields) {
    if (body[field] !== undefined) {
      throw new GatewayError(400, 'VALIDATION_FAILED', `${field} is not supported by the gateway OpenAI image surface.`);
    }
  }
};

const buildGenerateRequest = (body: Record<string, unknown>): Record<string, unknown> => {
  rejectUnsupportedFields(body, ['response_format', 'quality', 'style', 'background', 'user']);
  if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
    throw new GatewayError(400, 'VALIDATION_FAILED', 'prompt is required.');
  }
  return {
    prompt: body.prompt.trim(),
    model: assertModel(body.model),
    numberOfImages: body.n,
    ...(parseSizeToAspectRatio(body.size) ? { aspectRatio: parseSizeToAspectRatio(body.size) } : {}),
  };
};

const extractEditImagesFromJson = (body: Record<string, unknown>): Array<{ mimeType: string; data: string }> => {
  const imageField = body.image;
  if (typeof imageField === 'string') {
    return [parseDataUrl(imageField)];
  }
  if (Array.isArray(imageField)) {
    return imageField.map((entry) => {
      if (typeof entry !== 'string') {
        throw new GatewayError(400, 'VALIDATION_FAILED', 'image[] entries must be data URL strings.');
      }
      return parseDataUrl(entry);
    });
  }
  throw new GatewayError(400, 'VALIDATION_FAILED', 'image is required.');
};

const buildEditRequestFromJson = (body: Record<string, unknown>): Record<string, unknown> => {
  rejectUnsupportedFields(body, ['mask', 'response_format', 'background', 'quality', 'size_hint', 'user']);
  if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
    throw new GatewayError(400, 'VALIDATION_FAILED', 'prompt is required.');
  }
  const aspectRatio = parseSizeToAspectRatio(body.size);
  return {
    prompt: body.prompt.trim(),
    model: assertModel(body.model),
    numberOfImages: body.n,
    images: extractEditImagesFromJson(body),
    ...(aspectRatio ? { aspectRatio } : {}),
  };
};

const buildEditRequestFromMultipart = async (
  req: IncomingMessage,
  maxBytes: number,
): Promise<Record<string, unknown>> => {
  const parts = await readMultipartBody(req, maxBytes);
  const fields = new Map<string, string[]>();
  const images: Array<{ mimeType: string; data: string }> = [];

  for (const part of parts) {
    if (part.filename) {
      if (part.name !== 'image' && part.name !== 'image[]') {
        throw new GatewayError(400, 'VALIDATION_FAILED', `Unsupported multipart file field: ${part.name}.`);
      }
      if (!part.contentType || !/^image\/(png|jpeg|jpg|webp)$/.test(part.contentType)) {
        throw new GatewayError(400, 'VALIDATION_FAILED', 'Unsupported multipart image content type.');
      }
      images.push({
        mimeType: part.contentType,
        data: part.data.toString('base64'),
      });
      continue;
    }
    const value = part.data.toString('utf8');
    fields.set(part.name, [...(fields.get(part.name) ?? []), value]);
  }

  if (images.length === 0) {
    throw new GatewayError(400, 'VALIDATION_FAILED', 'At least one multipart image file is required.');
  }
  const prompt = fields.get('prompt')?.[0]?.trim();
  if (!prompt) {
    throw new GatewayError(400, 'VALIDATION_FAILED', 'prompt is required.');
  }
  const rawSize = fields.get('size')?.[0];
  const aspectRatio = parseSizeToAspectRatio(rawSize);
  const body: Record<string, unknown> = {
    prompt,
    model: fields.get('model')?.[0],
    n: fields.get('n')?.[0] ? Number(fields.get('n')?.[0]) : undefined,
    size: rawSize,
  };
  rejectUnsupportedFields(body, ['mask', 'response_format', 'background', 'quality', 'size_hint', 'user']);
  return {
    prompt,
    model: assertModel(fields.get('model')?.[0]),
    numberOfImages: fields.get('n')?.[0] ? Number(fields.get('n')?.[0]) : undefined,
    images,
    ...(aspectRatio ? { aspectRatio } : {}),
  };
};

export const runOpenAiImageGenerationRoute = async (
  body: Record<string, unknown>,
  workloads: ImageWorkloads,
): Promise<Record<string, unknown>> => normalizeImagesResponse(
  (await workloads.generate(buildGenerateRequest(body))).images,
);

export const runOpenAiImageEditRoute = async (
  req: IncomingMessage,
  body: Record<string, unknown> | null,
  workloads: ImageWorkloads,
  maxBytes: number,
): Promise<Record<string, unknown>> => {
  const contentType = req.headers['content-type'];
  if (typeof contentType === 'string' && contentType.includes('multipart/form-data')) {
    return normalizeImagesResponse((await workloads.edit(await buildEditRequestFromMultipart(req, maxBytes))).images);
  }
  if (!body) {
    throw new GatewayError(400, 'VALIDATION_FAILED', 'JSON request body is required for non-multipart image edits.');
  }
  return normalizeImagesResponse((await workloads.edit(buildEditRequestFromJson(body))).images);
};
