
import { Part, Modality } from "@google/genai";
import { ImageFile, ImageAspectRatio, ImageResolution, ImageEditModel, UpscaleQuality } from '../../types';
import { getActiveApiKey, getGeminiBaseUrl, getGeminiClient, isProxyEnabled } from '../apiClient';
import { getModelCapabilities } from '../../config/modelRegistry';

const PROXY_IMAGE_TIMEOUT_MS = 30_000;

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

const getGatewayRootUrl = (): string | null => {
  const baseUrl = getGeminiBaseUrl();
  if (!baseUrl) return null;

  const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmedBaseUrl.endsWith('/gemini')) return null;

  return trimmedBaseUrl.slice(0, -'/gemini'.length);
};

const toGatewayImage = (dataUrl: string): ImageFile => {
  // Performance optimization: Avoid regex on large base64 strings which is O(N).
  // Using string methods is O(1) for finding the mimeType prefix.
  if (!dataUrl.startsWith('data:')) {
    throw new Error('error.api.invalidGatewayImage');
  }

  const semiColonIdx = dataUrl.indexOf(';');
  if (semiColonIdx === -1) {
    throw new Error('error.api.invalidGatewayImage');
  }

  const mimeType = dataUrl.substring(5, semiColonIdx);

  const base64Prefix = ';base64,';
  const base64Idx = dataUrl.indexOf(base64Prefix, semiColonIdx);
  if (base64Idx === -1 || base64Idx !== semiColonIdx) {
    throw new Error('error.api.invalidGatewayImage');
  }

  const base64 = dataUrl.substring(base64Idx + base64Prefix.length);

  return {
    mimeType,
    base64,
  };
};

const callGatewayImageRoute = async (
  path: '/api/images/edit' | '/api/images/generate' | '/api/images/upscale',
  body: Record<string, unknown>,
): Promise<ImageFile[]> => {
  const gatewayRoot = getGatewayRootUrl();
  if (!gatewayRoot) {
    throw new Error('error.api.invalidGatewayBaseUrl');
  }

  const response = await fetch(`${gatewayRoot}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getActiveApiKey(),
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null) as
    | { success?: boolean; images?: Array<{ dataUrl?: string }>; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.success) {
    const errorMessage = payload?.error?.message || `Gateway image route failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  if (!Array.isArray(payload.images) || payload.images.length === 0) {
    throw new Error('error.api.noImageGenerated');
  }

  return payload.images
    .map((image) => image.dataUrl)
    .filter((dataUrl): dataUrl is string => typeof dataUrl === 'string' && dataUrl.length > 0)
    .map(toGatewayImage);
};

const generateProxyImage = async (
  prompt: string,
  aspectRatio: ImageAspectRatio,
  model: string,
): Promise<GeneratedImageFile> => {
  const ai = getGeminiClient();
  const request = buildProxyImageRequest(prompt, aspectRatio);

  const response = await ai.models.generateContent({
    model,
    ...request,
  });

  return extractInlineImagePart(response, { requestedModel: model });
};

export const editImage = async ({ images, prompt, model = 'gemini-3.1-flash-image', aspectRatio, resolution, negativePrompt, numberOfImages = 1, interleavedParts }: EditImageParams): Promise<ImageFile[]> => {
  const ai = getGeminiClient();
  try {
    let contentParts: Part[];
    let finalPrompt = prompt;
    if (interleavedParts && interleavedParts.length > 0) {
      contentParts = interleavedParts;
    } else {
      const imageParts: Part[] = images.map(image => ({
        inlineData: {
          data: image.base64,
          mimeType: image.mimeType,
        },
      }));

      if (negativePrompt?.trim()) {
        finalPrompt += ` Negative prompt: strictly avoid including ${negativePrompt.trim()}.`;
      }

      contentParts = [...imageParts, { text: finalPrompt }];
    }

    const gatewayRoot = getGatewayRootUrl();
    if (gatewayRoot && !interleavedParts) {
      const gatewayImages = images.map((image) => ({
        data: image.base64,
        mimeType: image.mimeType,
      }));

      return callGatewayImageRoute('/api/images/edit', {
        model,
        images: gatewayImages,
        prompt: finalPrompt,
        aspectRatio,
        resolution,
        numberOfImages,
      });
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
        contents: [{ role: 'user', parts: contentParts }],
        config: {
          responseModalities: [Modality.IMAGE],
          ...(Object.keys(imageConfig).length > 0 && { imageConfig }),
        },
      });

      return extractInlineImagePart(response, { requestedModel: model });
    };

    return await Promise.all(Array.from({ length: numberOfImages }, () => generateSingleImage()));
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
    const gatewayRoot = getGatewayRootUrl();

    if (gatewayRoot) {
      const gatewayResults = await callGatewayImageRoute('/api/images/generate', {
        model,
        prompt,
        aspectRatio: normalizedAspectRatio,
        numberOfImages,
      });
      return gatewayResults.map((image) => ({ ...image, metadata: { requestedModel: model } }));
    }

    if (!isProxyEnabled()) {
      return await Promise.all(Array.from({ length: numberOfImages }, async () => {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            responseModalities: [Modality.IMAGE],
            imageConfig: { aspectRatio: normalizedAspectRatio },
          },
        });
        return extractInlineImagePart(response, { requestedModel: model });
      }));
    }

    return await Promise.all(Array.from({ length: numberOfImages }, () =>
      generateProxyImage(prompt, normalizedAspectRatio, model),
    ));
  } catch (error) {
    console.error("Error generating image from text with Gemini API:", error);
    throw createGeminiFailedError(error);
  }
};

export const upscaleImage = async (image: ImageFile, quality: UpscaleQuality = '2K', prompt?: string, model: string = 'gemini-3.1-flash-image'): Promise<ImageFile> => {
  const ai = getGeminiClient();
  try {
    const gatewayRoot = getGatewayRootUrl();
    if (gatewayRoot) {
      const [gatewayImage] = await callGatewayImageRoute('/api/images/upscale', {
        model,
        image: {
          data: image.base64,
          mimeType: image.mimeType,
        },
        quality,
        prompt,
      });

      if (!gatewayImage) {
        throw new Error('error.api.noImageGenerated');
      }

      return gatewayImage;
    }

    const imagePart: Part = { inlineData: { data: image.base64, mimeType: image.mimeType } };
    const textPart: Part = { text: prompt ?? `Upscale this image with enhanced details, sharpness, and texture clarity. Reduce noise and compression artifacts. Preserve all original content exactly - do not add, remove, or modify any elements.` };

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [imagePart, textPart] }],
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
