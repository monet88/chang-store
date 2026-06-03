import type { GatewayConfig } from '../config/env.js';
import { GatewayError } from '../http/error-response.js';
import { Semaphore } from '../lib/concurrency.js';
import type { GenAiClient } from '../lib/google-genai-client.js';
import { retryWithJitter } from '../lib/retry.js';
import { withTimeout } from '../lib/timeout.js';
import { extractText, normalizeInlineImages, type ImageDto } from './image-normalizer.js';

interface ImageInput {
  mimeType: string;
  data: string;
}

const defaultGenerateModel = 'gemini-3.1-flash-image';
const defaultImageModel = 'gemini-3.1-flash-image';

const assertString = (body: Record<string, unknown>, key: string): string => {
  const value = body[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new GatewayError(400, 'VALIDATION_FAILED', `${key} is required.`);
  }
  return value.trim();
};

const decodedBytes = (base64: string): number => Math.ceil(base64.length * 0.75);

const validateImages = (images: unknown, config: GatewayConfig): ImageInput[] => {
  if (!Array.isArray(images) || images.length === 0) throw new GatewayError(400, 'VALIDATION_FAILED', 'images is required.');
  if (images.length > config.maxImages) throw new GatewayError(413, 'PAYLOAD_TOO_LARGE', 'Too many input images.');
  return images.map((image) => {
    const candidate = image as Partial<ImageInput>;
    if (typeof candidate.mimeType !== 'string' || !/^image\/(png|jpeg|jpg|webp)$/.test(candidate.mimeType)) {
      throw new GatewayError(400, 'VALIDATION_FAILED', 'Unsupported image mimeType.');
    }
    if (typeof candidate.data !== 'string' || decodedBytes(candidate.data) > config.maxDecodedImageBytes) {
      throw new GatewayError(413, 'PAYLOAD_TOO_LARGE', 'Image payload exceeds decoded byte limit.');
    }
    return { mimeType: candidate.mimeType, data: candidate.data };
  });
};

const buildImageParts = (images: ImageInput[]) => images.map((image) => ({
  inlineData: { mimeType: image.mimeType, data: image.data },
}));

export class ImageWorkloads {
  private readonly semaphore: Semaphore;

  constructor(private readonly ai: GenAiClient, private readonly config: GatewayConfig) {
    this.semaphore = new Semaphore(config.upstreamConcurrency);
  }

  async generate(body: Record<string, unknown>): Promise<{ images: ImageDto[] }> {
    const prompt = assertString(body, 'prompt');
    const model = typeof body.model === 'string' ? body.model : defaultGenerateModel;
    const aspectRatio = typeof body.aspectRatio === 'string' && body.aspectRatio !== 'Default' ? body.aspectRatio : '1:1';
    const numberOfImages = Math.min(Number(body.numberOfImages ?? 1), this.config.maxImages);
    if (!Number.isInteger(numberOfImages) || numberOfImages < 1) {
      throw new GatewayError(400, 'VALIDATION_FAILED', 'numberOfImages must be between 1 and maxImages.');
    }
    const images: ImageDto[] = [];
    for (let index = 0; index < numberOfImages; index += 1) {
      const response = await this.safeGenerate(() => this.ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio } },
      }));
      images.push(...normalizeInlineImages(response, { model, requestedIndex: index }));
    }
    return { images: images.map((image, index) => ({ ...image, index })) };
  }

  async edit(body: Record<string, unknown>): Promise<{ images: ImageDto[] }> {
    const prompt = assertString(body, 'prompt');
    const images = validateImages(body.images, this.config);
    const model = typeof body.model === 'string' ? body.model : defaultImageModel;
    const response = await this.unsafeGenerate(() => this.ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [...buildImageParts(images), { text: prompt }] }],
      config: { responseModalities: ['IMAGE'] },
    }));
    return { images: normalizeInlineImages(response, { model }) };
  }

  async upscale(body: Record<string, unknown>): Promise<{ images: ImageDto[] }> {
    const image = validateImages([body.image], this.config);
    const quality = typeof body.quality === 'string' ? body.quality : '2K';
    const model = typeof body.model === 'string' ? body.model : defaultImageModel;
    const response = await this.unsafeGenerate(() => this.ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [...buildImageParts(image), { text: `Upscale this image to ${quality}. Preserve the original subject and composition.` }] }],
      config: { responseModalities: ['IMAGE'], imageConfig: { imageSize: quality } },
    }));
    return { images: normalizeInlineImages(response, { model, quality }) };
  }

  async describe(body: Record<string, unknown>): Promise<{ text: string }> {
    const images = validateImages([body.image], this.config);
    const prompt = typeof body.prompt === 'string' ? body.prompt : 'Describe this image concisely.';
    const model = typeof body.model === 'string' ? body.model : 'gemini-2.5-flash';
    const response = await this.safeGenerate(() => this.ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [...buildImageParts(images), { text: prompt }] }],
    }));
    return { text: extractText(response) };
  }

  async validateSession(body: Record<string, unknown>): Promise<{ ok: true; model?: string; text?: string }> {
    const model = typeof body.model === 'string' ? body.model : undefined;
    if (!model) return { ok: true };
    const response = await this.safeGenerate(() => this.ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: typeof body.prompt === 'string' ? body.prompt : 'Reply with ok.' }] }],
    }));
    return { ok: true, model, text: extractText(response) };
  }

  private async safeGenerate(task: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> {
    const { value } = await retryWithJitter(() => this.semaphore.run(() => withTimeout(task(), this.config.upstreamTimeoutMs)), 1);
    return value;
  }

  private async unsafeGenerate(task: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> {
    return this.semaphore.run(() => withTimeout(task(), this.config.upstreamTimeoutMs));
  }
}
