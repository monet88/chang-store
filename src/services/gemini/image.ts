
import { Part, Modality } from "@google/genai";
import { ImageFile, ImageAspectRatio, ImageResolution, ImageEditModel, UpscaleQuality } from '../../types';
import { getGeminiClient, isProxyEnabled } from '../apiClient';
import { getModelCapabilities } from '../../config/modelRegistry';

const PROXY_IMAGE_TIMEOUT_MS = 30_000;
const PROXY_FAST_FALLBACK_MODEL = 'imagen-4.0-fast-generate-001';

export interface GeneratedImageFile extends ImageFile {
  metadata?: {
    fallbackModel?: string;
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

const isQuotaError = (errorMessage: string): boolean => {
  const normalized = errorMessage.toLowerCase();
  return normalized.includes('429') || normalized.includes('resource_exhausted');
};

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

const generateProxyImage = async (
  prompt: string,
  aspectRatio: ImageAspectRatio,
  model: string,
): Promise<GeneratedImageFile> => {
  const ai = getGeminiClient();
  const request = buildProxyImageRequest(prompt, aspectRatio);

  try {
    const response = await ai.models.generateContent({
      model,
      ...request,
    });

    return extractInlineImagePart(response, { requestedModel: model });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'error.unknown';
    if (model !== PROXY_FAST_FALLBACK_MODEL && isQuotaError(errorMessage)) {
      const fallbackResponse = await ai.models.generateContent({
        model: PROXY_FAST_FALLBACK_MODEL,
        ...request,
      });
      return extractInlineImagePart(fallbackResponse, {
        requestedModel: model,
        fallbackModel: PROXY_FAST_FALLBACK_MODEL,
      });
    }

    throw error;
  }
};

export const editImage = async ({ images, prompt, model = 'gemini-2.5-flash-image', aspectRatio, resolution, negativePrompt, numberOfImages = 1, interleavedParts }: EditImageParams): Promise<ImageFile[]> => {
  const ai = getGeminiClient();
  try {
    let contentParts: Part[];
    if (interleavedParts && interleavedParts.length > 0) {
      contentParts = interleavedParts;
    } else {
      const imageParts: Part[] = images.map(image => ({
        inlineData: {
          data: image.base64,
          mimeType: image.mimeType,
        },
      }));

      let finalPrompt = prompt;
      if (negativePrompt?.trim()) {
        finalPrompt += ` Negative prompt: strictly avoid including ${negativePrompt.trim()}.`;
      }

      contentParts = [...imageParts, { text: finalPrompt }];
    }

    const generateSingleImage = async (): Promise<ImageFile> => {
      const capabilities = getModelCapabilities(model);
      const imageConfig: { aspectRatio?: string; imageSize?: string } = {};

      if (aspectRatio && aspectRatio !== 'Default' && capabilities.supportsAspectRatio) {
        imageConfig.aspectRatio = aspectRatio;
      }
      if (resolution && capabilities.supportsImageSize) {
        imageConfig.imageSize = resolution;
      }

      const response = await ai.models.generateContent({
        model,
        contents: { parts: contentParts },
        config: {
          responseModalities: [Modality.IMAGE],
          ...(Object.keys(imageConfig).length > 0 && { imageConfig }),
        },
      });

      return extractInlineImagePart(response, { requestedModel: model });
    };

    const generationPromises = Array.from({ length: numberOfImages }, () => generateSingleImage());
    return await Promise.all(generationPromises);
  } catch (error) {
    console.error("Error editing image with Gemini API:", error);
    throw createGeminiFailedError(error);
  }
};

export const generateImageFromText = async (
  prompt: string,
  aspectRatio: ImageAspectRatio = '1:1',
  numberOfImages: number = 1,
  model: string = 'imagen-4.0-generate-001',
): Promise<GeneratedImageFile[]> => {
  const ai = getGeminiClient();

  try {
    if (!isProxyEnabled()) {
      const response = await ai.models.generateImages({
        model,
        prompt,
        config: {
          numberOfImages,
          outputMimeType: 'image/png',
          aspectRatio: aspectRatio === 'Default' ? '1:1' : aspectRatio,
        },
      });

      if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error('error.api.noImageInParts');
      }

      return response.generatedImages.map((img) => ({
        base64: img.image.imageBytes,
        mimeType: 'image/png',
      }));
    }

    const normalizedAspectRatio = aspectRatio === 'Default' ? '1:1' : aspectRatio;
    const results: GeneratedImageFile[] = [];

    for (let index = 0; index < numberOfImages; index += 1) {
      results.push(await generateProxyImage(prompt, normalizedAspectRatio, model));
    }

    return results;
  } catch (error) {
    console.error("Error generating image from text with Gemini API:", error);
    throw createGeminiFailedError(error);
  }
};

export const upscaleImage = async (image: ImageFile, quality: UpscaleQuality = '2K', prompt?: string, model: string = 'gemini-3.1-flash-image-preview'): Promise<ImageFile> => {
  const ai = getGeminiClient();
  try {
    const imagePart: Part = { inlineData: { data: image.base64, mimeType: image.mimeType } };
    const textPart: Part = { text: prompt ?? `Upscale this image with enhanced details, sharpness, and texture clarity. Reduce noise and compression artifacts. Preserve all original content exactly - do not add, remove, or modify any elements.` };

    const response = await ai.models.generateContent({
      model,
      contents: { parts: [imagePart, textPart] },
      config: {
        responseModalities: [Modality.IMAGE],
        imageConfig: { imageSize: quality },
      },
    });

    return extractInlineImagePart(response, { requestedModel: model });
  } catch (error) {
    console.error("Error upscaling image with Gemini API:", error);
    throw createGeminiFailedError(error);
  }
};
