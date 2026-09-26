
import { Part, Modality } from "@google/genai";
import { ImageFile, ImageAspectRatio, ImageResolution, ImageEditModel, UpscaleQuality } from '../../types';
import { getGeminiClient, isProxyEnabled } from '../apiClient';
import { getModelCapabilities, resolveImageSizeConfig } from '../../config/modelRegistry';
import { runBoundedWorkers } from '../../utils/run-bounded-workers';
import { appendNegativePrompt, negativePromptSentence } from '../../utils/negative-prompt-builder';

const PROXY_IMAGE_TIMEOUT_MS = 30_000;
const MAX_CONCURRENT_GEMINI_IMAGE_REQUESTS = 10;

let activeGeminiImageRequests = 0;
const geminiImageRequestQueue: Array<() => void> = [];

export interface GeneratedImageFile extends ImageFile {
  metadata?: {
    requestedModel?: string;
  };
}

export interface EditImageParams {
  images: ImageFile[];
  prompt: string;
  model?: ImageEditModel;
  aspectRatio?: ImageAspectRatio;
  resolution?: ImageResolution;
  negativePrompt?: string;
  numberOfImages?: number;
  /** Pre-built interleaved parts (text labels + images). When provided, overrides images+prompt auto-assembly. */
  interleavedParts?: Part[];
}

const isSafetyFinishReason = (finishReason: string | undefined): boolean =>
  finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'OTHER';

const createGeminiFailedError = (error: unknown): Error => {
  const errorMessage = error instanceof Error ? error.message : 'error.unknown';
  return new Error(errorMessage.startsWith('error.') ? errorMessage : `error.api.geminiFailed:${errorMessage}`);
};

const extractInlineImagePart = (
  response: {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{
      finishReason?: string;
      safetyRatings?: unknown;
      content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
    }>;
    text?: string;
  },
  metadata?: GeneratedImageFile['metadata'],
): GeneratedImageFile => {
  if (response.promptFeedback?.blockReason) {
    throw new Error('error.api.safetyBlock');
  }

  if (!response.candidates || response.candidates.length === 0) {
    throw new Error('error.api.safetyBlock');
  }

  const candidate = response.candidates[0];
  if (isSafetyFinishReason(candidate.finishReason)) {
    throw new Error('error.api.safetyBlock');
  }

  if (candidate.finishReason === 'NO_IMAGE') {
    throw new Error('error.api.noImageGenerated');
  }

  const parts = candidate.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data && part.inlineData.mimeType) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType,
        ...(metadata && { metadata }),
      };
    }
  }

  if (response.text) {
    throw new Error(`error.api.textOnlyResponse:${response.text}`);
  }

  if (parts.length === 0) {
    throw new Error('error.api.noContent');
  }

  throw new Error('error.api.noImageInParts');
};

const buildProxyImageRequest = (prompt: string, aspectRatio: ImageAspectRatio) => ({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  config: {
    responseModalities: [Modality.IMAGE],
    ...(aspectRatio !== 'Default' && {
      imageConfig: {
        aspectRatio,
      },
    }),
    httpOptions: {
      timeout: PROXY_IMAGE_TIMEOUT_MS,
    },
  },
});

const splitIntoBatches = (count: number, batchSize: number): number[] => {
  const safeBatchSize = Math.max(1, batchSize);
  const batches: number[] = [];
  let remaining = count;
  while (remaining > 0) {
    const current = Math.min(safeBatchSize, remaining);
    batches.push(current);
    remaining -= current;
  }
  return batches;
};

const acquireGeminiImageRequestSlot = async (): Promise<void> => {
  if (activeGeminiImageRequests < MAX_CONCURRENT_GEMINI_IMAGE_REQUESTS) {
    activeGeminiImageRequests += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    geminiImageRequestQueue.push(() => {
      activeGeminiImageRequests += 1;
      resolve();
    });
  });
};

const releaseGeminiImageRequestSlot = (): void => {
  activeGeminiImageRequests -= 1;
  geminiImageRequestQueue.shift()?.();
};

const withGeminiImageRequestSlot = async <T>(task: () => Promise<T>): Promise<T> => {
  await acquireGeminiImageRequestSlot();
  try {
    return await task();
  } finally {
    releaseGeminiImageRequestSlot();
  }
};

const generateProxyImage = async (
  prompt: string,
  aspectRatio: ImageAspectRatio,
  model: string,
): Promise<GeneratedImageFile> => {
  const ai = getGeminiClient();
  const request = buildProxyImageRequest(prompt, aspectRatio);

  const response = await withGeminiImageRequestSlot(() => ai.models.generateContent({
    model,
    ...request,
  }));

  return extractInlineImagePart(response, { requestedModel: model });
};

export const editImage = async ({ images, prompt, model = 'gemini-3.1-flash-image', aspectRatio, resolution, negativePrompt, numberOfImages = 1, interleavedParts }: EditImageParams): Promise<ImageFile[]> => {
  const ai = getGeminiClient();
  try {
    let contentParts: Part[];
    if (interleavedParts && interleavedParts.length > 0) {
      // A parts-based request carries its own text, so the avoid-sentence joins
      // it as one more part instead of being dropped.
      const avoidSentence = negativePromptSentence(negativePrompt);
      contentParts = avoidSentence ? [...interleavedParts, { text: avoidSentence }] : interleavedParts;
    } else {
      const imageParts: Part[] = images.map(image => ({
        inlineData: {
          data: image.base64,
          mimeType: image.mimeType,
        },
      }));

      contentParts = [{ text: appendNegativePrompt(prompt, negativePrompt) }, ...imageParts];
    }

    const generateSingleImage = async (): Promise<ImageFile> => {
      const capabilities = getModelCapabilities(model);
      const imageConfig: { aspectRatio?: string; imageSize?: string } = {};

      if (aspectRatio && aspectRatio !== 'Default' && capabilities.supportsAspectRatio) {
        imageConfig.aspectRatio = aspectRatio;
      }
      const imageSize = resolveImageSizeConfig(model, resolution);
      if (imageSize) {
        imageConfig.imageSize = imageSize;
      }

      const response = await withGeminiImageRequestSlot(() => ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: contentParts }],
        config: {
          responseModalities: [Modality.IMAGE],
          ...(Object.keys(imageConfig).length > 0 && { imageConfig }),
        },
      }));

      return extractInlineImagePart(response, { requestedModel: model });
    };

    const results: ImageFile[] = [];
    for (const batchSize of splitIntoBatches(numberOfImages, MAX_CONCURRENT_GEMINI_IMAGE_REQUESTS)) {
      const batchResults: ImageFile[] = new Array(batchSize);
      const batchSlots = Array.from({ length: batchSize }, (_, index) => index);
      await runBoundedWorkers(
        batchSlots,
        batchSize,
        async (index) => {
          batchResults[index] = await generateSingleImage();
        },
      );
      results.push(...batchResults);
    }
    return results;
  } catch (error) {
    console.error("Error editing image with Gemini API:", error);
    throw createGeminiFailedError(error);
  }
};

export const generateImageFromText = async (
  prompt: string,
  aspectRatio: ImageAspectRatio = '1:1',
  numberOfImages: number = 1,
  model: string = 'gemini-3.1-flash-image',
): Promise<GeneratedImageFile[]> => {
  const ai = getGeminiClient();

  try {
    const normalizedAspectRatio = aspectRatio === 'Default' ? '1:1' : aspectRatio;

    if (!isProxyEnabled()) {
      const results: GeneratedImageFile[] = [];
      for (const batchSize of splitIntoBatches(numberOfImages, MAX_CONCURRENT_GEMINI_IMAGE_REQUESTS)) {
        const batchResults: GeneratedImageFile[] = new Array(batchSize);
        await runBoundedWorkers(
          Array.from({ length: batchSize }, (_, index) => index),
          batchSize,
          async (index) => {
            const response = await withGeminiImageRequestSlot(() => ai.models.generateContent({
              model,
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              config: {
                responseModalities: [Modality.IMAGE],
                imageConfig: { aspectRatio: normalizedAspectRatio },
              },
            }));
            batchResults[index] = extractInlineImagePart(response, { requestedModel: model });
          },
        );
        results.push(...batchResults);
      }
      return results;
    }

    const proxyResults: GeneratedImageFile[] = [];
    for (const batchSize of splitIntoBatches(numberOfImages, MAX_CONCURRENT_GEMINI_IMAGE_REQUESTS)) {
      const batchResults: GeneratedImageFile[] = new Array(batchSize);
      await runBoundedWorkers(
        Array.from({ length: batchSize }, (_, index) => index),
        batchSize,
        async (index) => {
          batchResults[index] = await generateProxyImage(prompt, normalizedAspectRatio, model);
        },
      );
      proxyResults.push(...batchResults);
    }
    return proxyResults;
  } catch (error) {
    console.error("Error generating image from text with Gemini API:", error);
    throw createGeminiFailedError(error);
  }
};

export const upscaleImage = async (image: ImageFile, quality: UpscaleQuality = '2K', prompt?: string, model: string = 'gemini-3.1-flash-image'): Promise<ImageFile> => {
  const ai = getGeminiClient();
  try {
    const imagePart: Part = { inlineData: { data: image.base64, mimeType: image.mimeType } };
    const textPart: Part = { text: prompt ?? `Upscale this image with enhanced details, sharpness, and texture clarity. Reduce noise and compression artifacts. Preserve all original content exactly - do not add, remove, or modify any elements.` };
    const imageSize = resolveImageSizeConfig(model, quality);

    const response = await withGeminiImageRequestSlot(() => ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [imagePart, textPart] }],
      config: {
        responseModalities: [Modality.IMAGE],
        ...(imageSize && { imageConfig: { imageSize } }),
      },
    }));

    return extractInlineImagePart(response, { requestedModel: model });
  } catch (error) {
    console.error("Error upscaling image with Gemini API:", error);
    throw createGeminiFailedError(error);
  }
};
