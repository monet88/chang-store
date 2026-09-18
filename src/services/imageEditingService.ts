import { ImageFile, AspectRatio, ImageEditModel, ImageGenerateModel, UpscaleQuality } from '../types';
import type { ImageResolution } from '../types';
import { resolveEffectiveImageResolution } from '../config/modelRegistry';
import * as geminiImageService from './gemini/image';
import type { GeneratedImageFile } from './gemini/image';
import { getImageDimensions } from '../utils/imageUtils';
import { buildUpscalePrompt } from '../utils/upscale-prompt-builder';
import { logApiCall } from './debugService';

interface ApiConfig {
    onStatusUpdate: (message: string) => void;
}

export type EditImageParams = geminiImageService.EditImageParams;

export const editImage = async (
    params: EditImageParams,
    model: ImageEditModel,
    config: ApiConfig
): Promise<ImageFile[]> => {
    const startTime = Date.now();

    const logPrompt = params.prompt
        || (params.interleavedParts
            ?.filter((p) => p.text)
            .map((p) => p.text)
            .join(' | ')
        ) || '';

    try {
        let resolvedModel = model;
        if (!resolvedModel) {
            console.warn('[ImageEditingService] Model is undefined or empty, falling back to gemini-3.1-flash-image');
            resolvedModel = 'gemini-3.1-flash-image';
        }
        const result = await geminiImageService.editImage({ ...params, model: resolvedModel });

        logApiCall({
            provider: 'Gemini',
            model,
            feature: 'Image Edit',
            prompt: logPrompt,
            duration: Date.now() - startTime,
            status: 'success',
            responseSize: result.reduce((sum, img) => sum + img.base64.length * 0.75, 0),
        });

        return result;
    } catch (error) {
        logApiCall({
            provider: 'Gemini',
            model,
            feature: 'Image Edit',
            prompt: logPrompt,
            duration: Date.now() - startTime,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
};

export const generateImage = async (
    prompt: string,
    aspectRatio: AspectRatio,
    numberOfImages: number,
    model: ImageGenerateModel,
    config: ApiConfig
): Promise<ImageFile[]> => {
    const startTime = Date.now();

    try {
        const result: GeneratedImageFile[] = await geminiImageService.generateImageFromText(prompt, aspectRatio, numberOfImages, model);

        logApiCall({
            provider: 'Gemini',
            model,
            feature: 'Image Generate',
            prompt,
            duration: Date.now() - startTime,
            status: 'success',
            responseSize: result.reduce((sum, img) => sum + img.base64.length * 0.75, 0),
        });

        return result;
    } catch (error) {
        logApiCall({
            provider: 'Gemini',
            model,
            feature: 'Image Generate',
            prompt,
            duration: Date.now() - startTime,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
};

export const upscaleImage = async (
    image: ImageFile,
    model: ImageEditModel,
    config: ApiConfig,
    quality: UpscaleQuality = '2K',
    quickModel?: string,
    promptOverride?: string
): Promise<ImageFile> => {
    const resolvedModel = quickModel ?? model;
    const startTime = Date.now();
    const effectiveQuality = resolveEffectiveImageResolution(resolvedModel, quality);
    const prompt = promptOverride ?? buildUpscalePrompt(effectiveQuality, 'model');

    try {
        const result = await geminiImageService.upscaleImage(image, quality, prompt, resolvedModel);

        logApiCall({
            provider: 'Gemini',
            model: resolvedModel,
            feature: 'Upscale',
            prompt,
            duration: Date.now() - startTime,
            status: 'success',
            responseSize: result.base64.length * 0.75,
        });

        return result;
    } catch (error) {
        logApiCall({
            provider: 'Gemini',
            model: resolvedModel,
            feature: 'Upscale',
            prompt,
            duration: Date.now() - startTime,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
};

export const recreateImageWithFace = async (
    prompt: string,
    faceImage: ImageFile,
    styleImage: ImageFile,
    model: ImageEditModel,
    config: ApiConfig,
    aspectRatio?: AspectRatio,
    resolution?: ImageResolution
): Promise<ImageFile> => {
    const startTime = Date.now();

    const finalPrompt = `
# INSTRUCTION: IMAGE RECREATION WITH NEW SUBJECT
## 1. CORE TASK: Recreate a new image based *only* on the provided text prompt. The subject MUST be the person from the reference image.
## 2. REFERENCE IMAGE ROLE: The single provided image is the **'Face Reference'**. Use this image ONLY to capture the person's facial features, hair, and identity.
## 3. TEXT PROMPT (STYLE GUIDE): The following text prompt is the complete guide for the new image's aesthetic. Adhere to it strictly.\n---\n${prompt}\n---
## 4. CRITICAL RULES: Ignore any visual style from other images. The 'Face Reference' is for identity only. The text prompt is for style only.
## 5. FINAL OUTPUT: Generate a single, high-resolution, photorealistic image that fuses the person from the 'Face Reference' with the style from the text prompt.`;

    try {
        let finalAspectRatio: AspectRatio = 'Default';

        if (aspectRatio && aspectRatio !== 'Default') {
            finalAspectRatio = aspectRatio;
        } else {
            const { width, height } = await getImageDimensions(styleImage.base64, styleImage.mimeType);
            const ratio = width / height;

            const ratios: Record<string, number> = {
                '1:1': 1,
                '9:16': 9 / 16,
                '16:9': 16 / 9,
                '4:3': 4 / 3,
                '3:4': 3 / 4,
            };

            let closestRatioKey: AspectRatio = 'Default';
            let minDiff = Infinity;

            for (const key in ratios) {
                const diff = Math.abs(ratio - ratios[key]);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestRatioKey = key as AspectRatio;
                }
            }

            if (minDiff < 0.1) {
                finalAspectRatio = closestRatioKey;
            }
        }

        const [result] = await editImage({ images: [faceImage], prompt: finalPrompt, numberOfImages: 1, aspectRatio: finalAspectRatio, resolution }, model, config);
        if (!result) throw new Error('Image recreation failed to produce a result.');

        logApiCall({
            provider: 'Gemini',
            model,
            feature: 'Face Recreation',
            prompt,
            duration: Date.now() - startTime,
            status: 'success',
            responseSize: result.base64.length * 0.75,
        });

        return result;
    } catch (error) {
        logApiCall({
            provider: 'Gemini',
            model,
            feature: 'Face Recreation',
            prompt,
            duration: Date.now() - startTime,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
};

// Re-export types for compatibility
export type { RefinementHistoryItem } from '../types';
import { createImageChatSession as createImageChatSessionGemini } from './gemini/chat';

// Unified ImageChatSession interface
export interface ImageChatSession {
    sendRefinement(prompt: string, currentImage: ImageFile): Promise<ImageFile>;
    getHistory(): Array<{ prompt: string; timestamp: number }>;
    reset(): void;
}

/**
 * Create a chat session for iterative image refinement.
 */
export const createImageChatSession = (
    model: string,
    _config: ApiConfig
): ImageChatSession => {
    return createImageChatSessionGemini(model) as ImageChatSession;
};
