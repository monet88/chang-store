
import { Part, Modality, Type } from "@google/genai";
import { ImageFile, ImageAspectRatio, ImageResolution, ImageEditModel, UpscaleQuality } from '../../types';
import { getGeminiClient } from '../apiClient';

/**
 * Check if model supports imageSize parameter.
 * Only Gemini 3 and Imagen 4 models support imageSize.
 * Gemini 2.5 flash-image only supports aspectRatio.
 */
const supportsImageSize = (model: string): boolean => {
    return model.includes('gemini-3') || model.includes('imagen-4');
};

export interface EditImageParams {
  images: ImageFile[];
  prompt: string;
  model?: ImageEditModel;
  aspectRatio?: ImageAspectRatio;
  resolution?: ImageResolution;
  negativePrompt?: string;
  numberOfImages?: number;
}

export const editImage = async ({ images, prompt, model = 'gemini-2.5-flash-image', aspectRatio, resolution, negativePrompt, numberOfImages = 1 }: EditImageParams): Promise<ImageFile[]> => {
  const ai = getGeminiClient();
  try {
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

    const textPart: Part = { text: finalPrompt };

    const generateSingleImage = async (): Promise<ImageFile> => {
        // Build imageConfig - only include imageSize for models that support it
        const imageConfig: { aspectRatio?: string; imageSize?: string } = {};
        if (aspectRatio && aspectRatio !== 'Default') {
            imageConfig.aspectRatio = aspectRatio;
        }
        if (resolution && supportsImageSize(model)) {
            imageConfig.imageSize = resolution;
        }

        // Debug logging: Track aspect ratio configuration
        console.log('📐 Gemini Image Config:', {
            model,
            aspectRatio,
            resolution,
            imageConfig,
            supportsImageSize: supportsImageSize(model)
        });

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [...imageParts, textPart] },
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

export const upscaleImage = async (image: ImageFile, quality: UpscaleQuality = '2K'): Promise<ImageFile> => {
  const ai = getGeminiClient();
  try {
    const imagePart: Part = { inlineData: { data: image.base64, mimeType: image.mimeType } };
    const textPart: Part = { text: `Upscale this image with enhanced details, sharpness, and texture clarity. Reduce noise and compression artifacts. Preserve all original content exactly - do not add, remove, or modify any elements.` };

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
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

export const extractOutfitItem = async (
    image: ImageFile, 
    itemDescription: string,
    model: string = 'gemini-2.5-flash-image'
): Promise<ImageFile> => {
    const ai = getGeminiClient();
    try {
        const imagePart: Part = { inlineData: { data: image.base64, mimeType: image.mimeType } };
        const textPart: Part = { text: `From the provided image, precisely extract only the following clothing item: "${itemDescription}". Place the extracted item on a clean, neutral, white background. The output must be only the item itself, with no other parts of the original image or person visible. Ensure the item is fully visible and not cropped.` };

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [imagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        if (response.promptFeedback?.blockReason) {
            throw new Error('error.api.safetyBlock');
        }
        if (!response.candidates || response.candidates.length === 0) {
            throw new Error('error.api.noContent');
        }

        const candidate = response.candidates[0];
        if (candidate.finishReason !== 'STOP') {
            throw new Error('error.api.safetyBlock');
        }
        
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            return {
                base64: part.inlineData.data,
                mimeType: part.inlineData.mimeType,
            };
          }
        }
        
        throw new Error('error.api.noImageInParts');

    } catch (error) {
        console.error("Error extracting outfit item with Gemini API:", error);
        const errorMessage = error instanceof Error ? error.message : "error.unknown";
        throw new Error(errorMessage.startsWith('error.') ? errorMessage : `error.api.extractionFailed:${errorMessage}`);
  }
};

export type RedesignPreset = 'casual' | 'smart-casual' | 'luxury' | 'asian-style';

export const PRESET_PROMPTS: Record<RedesignPreset, string> = {
    'casual': `
        **Critique**: You are a friendly fashion blogger. Briefly critique the provided outfit for a casual, everyday context.
        **Redesign**: Now, redesign the outfit for a modern, chic, casual look. Generate a new image of the same person wearing the redesigned outfit. Maintain the original person's identity but give them a fresh, stylish, and comfortable casual outfit. The new image should be a full-body shot in a natural, street-style setting.
    `,
    'smart-casual': `
        **Critique**: You are a professional stylist. Briefly critique the provided outfit for a smart-casual or business-casual event.
        **Redesign**: Redesign the outfit to be more polished and sophisticated for a smart-casual setting. Generate a new image of the same person wearing the elevated outfit. Maintain the original person's identity. The new image should be a full-body shot in a modern, elegant indoor setting.
    `,
    'luxury': `
        **Critique**: You are a high-fashion editor for a magazine like Vogue. Provide a concise, professional critique of the outfit's potential for a luxury market.
        **Redesign**: Reimagine and redesign the outfit with a high-fashion, luxury aesthetic. Use premium materials, intricate details, and a more avant-garde silhouette. Generate a new image of the same person wearing this luxury redesign. Maintain the original person's identity. The new image should be a dramatic, editorial-style shot with professional lighting.
    `,
    'asian-style': `
        **Critique**: You are a stylist specializing in contemporary Asian fashion (e.g., Korean, Japanese street style). Briefly critique the provided outfit from that perspective.
        **Redesign**: Redesign the outfit to reflect modern Asian street style trends. This might include layering, oversized fits, unique accessories, and a minimalist color palette. Generate a new image of the same person wearing this new outfit. Maintain the original person's identity. The shot should be a candid-style street photograph in a city like Seoul or Tokyo.
    `,
};


export const critiqueAndRedesignOutfit = async (
  image: ImageFile,
  preset: RedesignPreset,
  numberOfImages: number = 1,
  model: string = 'gemini-2.5-flash-image',
  aspectRatio: ImageAspectRatio = 'Default',
  resolution?: ImageResolution
): Promise<{ critique: string; redesignedImages: ImageFile[] }> => {
  const ai = getGeminiClient();
  try {
    const imagePart: Part = { inlineData: { data: image.base64, mimeType: image.mimeType } };
    let prompt = PRESET_PROMPTS[preset];

    const textPart: Part = { text: prompt };

    const generateSingleRedesign = async (): Promise<{ critique: string; image: ImageFile }> => {
        // Build imageConfig - only include imageSize for models that support it
        const imageConfig: { aspectRatio?: string; imageSize?: string } = {};
        if (aspectRatio && aspectRatio !== 'Default') {
            imageConfig.aspectRatio = aspectRatio;
        }
        if (resolution && supportsImageSize(model)) {
            imageConfig.imageSize = resolution;
        }

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [imagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
                ...(Object.keys(imageConfig).length > 0 && { imageConfig }),
            },
        });

        if (response.promptFeedback?.blockReason) {
            throw new Error('error.api.safetyBlock');
        }
        if (!response.candidates || response.candidates.length === 0) {
            throw new Error('error.api.noContent');
        }

        const candidate = response.candidates[0];
        if (candidate.finishReason !== 'STOP') {
            console.error("Request stopped for reason:", candidate.finishReason, JSON.stringify(candidate.safetyRatings, null, 2));
            throw new Error('error.api.safetyBlock');
        }
        
        let critiqueText = '';
        let generatedImage: ImageFile | null = null;
        
        for (const part of candidate.content.parts) {
            if (part.text) {
                critiqueText += part.text;
            } else if (part.inlineData) {
                generatedImage = {
                    base64: part.inlineData.data,
                    mimeType: part.inlineData.mimeType,
                };
            }
        }

        if (!generatedImage || !critiqueText) {
            console.error("API response was missing image or text part for redesign.", JSON.stringify(response, null, 2));
            throw new Error('error.api.critiqueFailed');
        }

        return { critique: critiqueText.trim(), image: generatedImage };
    };
    
    const generationPromises = Array.from({ length: numberOfImages }, () => generateSingleRedesign());
    const results = await Promise.all(generationPromises);
    
    const critique = results.length > 0 ? results[0].critique : '';
    const redesignedImages = results.map(r => r.image);

    return { critique, redesignedImages };
  } catch (error) {
    console.error("Error in critiqueAndRedesignOutfit with Gemini API:", error);
    const errorMessage = error instanceof Error ? error.message : "error.unknown";
    throw new Error(errorMessage.startsWith('error.') ? errorMessage : `error.api.critiqueFailed:${errorMessage}`);
  }
};
