
import { Part, Modality } from "@google/genai";
import { ImageFile, ImageAspectRatio, ImageResolution, ImageEditModel, UpscaleQuality } from '../../types';
import { getGeminiClient } from '../apiClient';
import { getModelCapabilities } from '../../config/modelRegistry';

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

export const editImage = async ({ images, prompt, model = 'gemini-2.5-flash-image', aspectRatio, resolution, negativePrompt, numberOfImages = 1, interleavedParts }: EditImageParams): Promise<ImageFile[]> => {
  const ai = getGeminiClient();
  try {
    // Build content parts: use interleaved parts if provided, otherwise default pattern
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
        // Build imageConfig - only include imageSize for models that support it
        const capabilities = getModelCapabilities(model);
        const imageConfig: { aspectRatio?: string; imageSize?: string } = {};
        
        if (aspectRatio && aspectRatio !== 'Default' && capabilities.supportsAspectRatio) {
            imageConfig.aspectRatio = aspectRatio;
        }
        if (resolution && capabilities.supportsImageSize) {
            imageConfig.imageSize = resolution;
        }

        // Debug logging: Track aspect ratio configuration
        console.log('📐 Gemini Image Config:', {
            model,
            aspectRatio,
            resolution,
            imageConfig,
            capabilities
        });

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: contentParts },
            config: {
                responseModalities: [Modality.IMAGE],
                ...(Object.keys(imageConfig).length > 0 && { imageConfig }),
            },
        });
        
        if (response.promptFeedback?.blockReason) {
            console.error("Request blocked due to prompt feedback:", JSON.stringify(response.promptFeedback, null, 2));
            throw new Error('error.api.safetyBlock');
        }

        if (!response.candidates || response.candidates.length === 0) {
            console.error("API response contained no candidates, likely due to a safety block. Full response:", JSON.stringify(response, null, 2));
            throw new Error('error.api.safetyBlock');
        }

        const candidate = response.candidates[0];

        const finishReason = candidate.finishReason;
        if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'OTHER') {
            const safetyRatings = candidate.safetyRatings;
            console.error("Request blocked due to content safety reason:", finishReason, JSON.stringify(safetyRatings, null, 2));
            throw new Error('error.api.safetyBlock');
        }

        if (finishReason === 'NO_IMAGE') {
            console.error("Model could not generate an image. This can happen with complex edits or certain image content.");
            throw new Error('error.api.noImageGenerated');
        }

        const content = candidate.content;
        
        if (content?.parts && content.parts.length > 0) {
            for (const part of content.parts) {
              if (part.inlineData) {
                return {
                    base64: part.inlineData.data,
                    mimeType: part.inlineData.mimeType,
                };
              }
            }
        }
        
        const textResponse = response.text;
        if (textResponse) {
            console.error("API response contained text but no image. Text:", textResponse);
            throw new Error(`error.api.textOnlyResponse:${textResponse}`);
        }

        if (!content || !content.parts || content.parts.length === 0) {
            console.error("API response had no content parts. Full response:", JSON.stringify(response, null, 2));
            throw new Error('error.api.noContent');
        }

        console.error("API response contained parts but no image and no text. Full response:", JSON.stringify(response, null, 2));
        throw new Error('error.api.noImageInParts');
    };
    
    const generationPromises = Array.from({ length: numberOfImages }, () => generateSingleImage());
    return await Promise.all(generationPromises);

  } catch (error) {
    console.error("Error editing image with Gemini API:", error);
    const errorMessage = error instanceof Error ? error.message : "error.unknown";
    throw new Error(errorMessage.startsWith('error.') ? errorMessage : `error.api.geminiFailed:${errorMessage}`);
  }
};

export const generateImageFromText = async (prompt: string, aspectRatio: ImageAspectRatio = '1:1', numberOfImages: number = 1, model: string = 'imagen-4.0-generate-001'): Promise<ImageFile[]> => {
    const ai = getGeminiClient();
    try {
        const response = await ai.models.generateImages({
            model: model,
            prompt: prompt,
            config: {
                numberOfImages: numberOfImages,
                outputMimeType: 'image/png',
                aspectRatio: aspectRatio === 'Default' ? '1:1' : aspectRatio,
            },
        });

        if (!response.generatedImages || response.generatedImages.length === 0) {
            throw new Error('error.api.noImageInParts');
        }

        return response.generatedImages.map(img => ({
            base64: img.image.imageBytes,
            mimeType: 'image/png',
        }));

    } catch (error) {
        console.error("Error generating image from text with Gemini API:", error);
        const errorMessage = error instanceof Error ? error.message : "error.unknown";
        throw new Error(errorMessage.startsWith('error.') ? errorMessage : `error.api.geminiFailed:${errorMessage}`);
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
        imageConfig: { imageSize: quality }, // "2K" or "4K" - Gemini 3 format
      },
    });

    if (response.promptFeedback?.blockReason) {
        console.error("Request blocked due to prompt feedback:", JSON.stringify(response.promptFeedback, null, 2));
        throw new Error('error.api.safetyBlock');
    }

    if (!response.candidates || response.candidates.length === 0) {
        console.error("API response contained no candidates, likely due to a safety block. Full response:", JSON.stringify(response, null, 2));
        throw new Error('error.api.safetyBlock');
    }

    const candidate = response.candidates[0];

    const finishReason = candidate.finishReason;
    if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'OTHER') {
        const safetyRatings = candidate.safetyRatings;
        console.error("Request blocked due to content safety reason:", finishReason, JSON.stringify(safetyRatings, null, 2));
        throw new Error('error.api.safetyBlock');
    }

    const content = candidate.content;
    
    if (content?.parts && content.parts.length > 0) {
        for (const part of content.parts) {
          if (part.inlineData) {
            return {
                base64: part.inlineData.data,
                mimeType: part.inlineData.mimeType,
            };
          }
        }
    }

    const textResponse = response.text;
    if (textResponse) {
        console.error("API response for upscale contained text but no image. Text:", textResponse);
        throw new Error(`error.api.textOnlyResponse:${textResponse}`);
    }

    if (!content || !content.parts || content.parts.length === 0) {
        console.error("API response had no content parts during upscale. Full response:", JSON.stringify(response, null, 2));
        throw new Error('error.api.noContent');
    }

    console.error("API response contained parts but no image and no text during upscale. Full response:", JSON.stringify(response, null, 2));
    throw new Error('error.api.noImageInParts');

  } catch (error) {
    console.error("Error upscaling image with Gemini API:", error);
    const errorMessage = error instanceof Error ? error.message : "error.unknown";
    throw new Error(errorMessage.startsWith('error.') ? errorMessage : `error.api.geminiFailed:${errorMessage}`);
  }
};

