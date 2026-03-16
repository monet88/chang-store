import { ImageFile, AspectRatio, ImageEditModel, ImageGenerateModel, ImageResolution, UpscaleQuality, DEFAULT_IMAGE_RESOLUTION } from '../types';
import * as geminiImageService from './gemini/image';
import { editImageLocal, generateImageLocal, generateTextLocal, createImageChatSessionLocal, type LocalProviderConfig } from './localProviderService';
import { editImageAnti, generateImageAnti, generateTextAnti, createImageChatSessionAnti, type AntiProviderConfig } from './antiProviderService';
import { getImageDimensions } from '../utils/imageUtils';
import { logApiCall } from './debugService';

interface ApiConfig {
    localApiBaseUrl?: string | null;
    localApiKey?: string | null;
    antiApiBaseUrl?: string | null;
    antiApiKey?: string | null;
    onStatusUpdate: (message: string) => void;
}

export type EditImageParams = geminiImageService.EditImageParams;

const LOCAL_PREFIX = 'local--';
const ANTI_PREFIX = 'anti--';
const isLocalModel = (model?: string) => !!model && model.startsWith(LOCAL_PREFIX);
const isAntiModel = (model?: string) => !!model && model.startsWith(ANTI_PREFIX);
const stripLocalPrefix = (model: string) => model.slice(LOCAL_PREFIX.length);
const stripAntiPrefix = (model: string) => model.slice(ANTI_PREFIX.length);

const RESOLUTION_BASE: Record<ImageResolution, number> = {
    '1K': 1024,
    '2K': 2048,
    '4K': 4096,
};

const buildLocalSize = (aspectRatio?: AspectRatio, resolution: ImageResolution = DEFAULT_IMAGE_RESOLUTION): string => {
    const base = RESOLUTION_BASE[resolution] ?? RESOLUTION_BASE[DEFAULT_IMAGE_RESOLUTION];
    if (!aspectRatio || aspectRatio === 'Default') {
        return `${base}x${base}`;
    }
    const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
    if (!Number.isFinite(widthRatio) || !Number.isFinite(heightRatio) || widthRatio <= 0 || heightRatio <= 0) {
        return `${base}x${base}`;
    }
    const ratio = widthRatio / heightRatio;
    if (ratio >= 1) {
        const height = Math.max(1, Math.round(base / ratio));
        return `${base}x${height}`;
    }
    const width = Math.max(1, Math.round(base * ratio));
    return `${width}x${base}`;
};

const buildLocalConfig = (config: ApiConfig) => ({
    baseUrl: config.localApiBaseUrl ?? '',
    apiKey: config.localApiKey ?? null,
});

const buildAntiConfig = (config: ApiConfig) => ({
    baseUrl: config.antiApiBaseUrl ?? '',
    apiKey: config.antiApiKey ?? null,
});

export const editImage = async (
    params: EditImageParams,
    model: ImageEditModel,
    config: ApiConfig
): Promise<ImageFile[]> => {
    const startTime = Date.now();
    const provider = isLocalModel(model) ? 'Local' : isAntiModel(model) ? 'Anti' : 'Gemini';

    try {
        let result: ImageFile[];

        if (isLocalModel(model)) {
            if (!config.localApiBaseUrl) throw new Error('error.api.localProviderFailed');
            if (params.images.length === 0) throw new Error('error.api.noImage');
            const size = buildLocalSize(params.aspectRatio, params.resolution ?? DEFAULT_IMAGE_RESOLUTION);
            const localModel = stripLocalPrefix(model);
            let finalPrompt = params.prompt;
            if (params.negativePrompt?.trim()) {
                finalPrompt += ` Negative prompt: strictly avoid including ${params.negativePrompt.trim()}.`;
            }
            const localConfig = buildLocalConfig(config);
            const count = params.numberOfImages || 1;
            result = await Promise.all(
                Array.from({ length: count }).map(() =>
                    editImageLocal(params.images[0], finalPrompt, localModel, localConfig, size)
                )
            );
        } else if (isAntiModel(model)) {
            if (!config.antiApiBaseUrl) throw new Error('error.api.antiProviderFailed');
            if (params.images.length === 0) throw new Error('error.api.noImage');
            const size = buildLocalSize(params.aspectRatio, params.resolution ?? DEFAULT_IMAGE_RESOLUTION);
            const antiModel = stripAntiPrefix(model);
            let finalPrompt = params.prompt;
            if (params.negativePrompt?.trim()) {
                finalPrompt += ` Negative prompt: strictly avoid including ${params.negativePrompt.trim()}.`;
            }
            const antiConfig = buildAntiConfig(config);
            const count = params.numberOfImages || 1;
            result = await Promise.all(
                Array.from({ length: count }).map(() =>
                    editImageAnti(params.images[0], finalPrompt, antiModel, antiConfig, size)
                )
            );
        } else {
            let resolvedModel = model;
            if (!resolvedModel) {
                console.warn('[ImageEditingService] Model is undefined or empty, falling back to gemini-3.1-flash-image-preview');
                resolvedModel = 'gemini-3.1-flash-image-preview';
            }
            result = await geminiImageService.editImage({ ...params, model: resolvedModel });
        }

        logApiCall({
            provider,
            model,
            feature: 'Image Edit',
            prompt: params.prompt,
            duration: Date.now() - startTime,
            status: 'success',
            responseSize: result.reduce((sum, img) => sum + img.base64.length * 0.75, 0),
        });

        return result;
    } catch (error) {
        logApiCall({
            provider,
            model,
            feature: 'Image Edit',
            prompt: params.prompt,
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
    const provider = isLocalModel(model) ? 'Local' : isAntiModel(model) ? 'Anti' : 'Gemini';

    try {
        let result: ImageFile[];

        if (isLocalModel(model)) {
            if (!config.localApiBaseUrl) throw new Error('error.api.localProviderFailed');
            const size = buildLocalSize(aspectRatio, DEFAULT_IMAGE_RESOLUTION);
            const localModel = stripLocalPrefix(model);
            const localConfig = buildLocalConfig(config);
            const count = numberOfImages || 1;
            result = await Promise.all(
                Array.from({ length: count }).map(() =>
                    generateImageLocal(prompt, localModel, localConfig, size)
                )
            );
        } else if (isAntiModel(model)) {
            if (!config.antiApiBaseUrl) throw new Error('error.api.antiProviderFailed');
            const size = buildLocalSize(aspectRatio, DEFAULT_IMAGE_RESOLUTION);
            const antiModel = stripAntiPrefix(model);
            const antiConfig = buildAntiConfig(config);
            const count = numberOfImages || 1;
            result = await Promise.all(
                Array.from({ length: count }).map(() =>
                    generateImageAnti(prompt, antiModel, antiConfig, size)
                )
            );
        } else {
            result = await geminiImageService.generateImageFromText(prompt, aspectRatio, numberOfImages, model);
        }

        logApiCall({
            provider,
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
            provider,
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

/** Locked preservation-first upscale prompts — single source of truth */
const UPSCALE_PROMPTS: Record<UpscaleQuality, string> = {
    '2K': 'Upscale this image to 2K resolution. Enhance the details, make the fabric textures look sharp and realistic, and ensure the colors are vibrant and accurate. Keep the model\'s face and the overall composition exactly the same. Photorealistic, fashion photography quality, 2K quality.',
    '4K': 'Upscale this image to 4K resolution. Enhance the details, make the fabric textures look sharp and realistic, and ensure the colors are vibrant and accurate. Keep the model\'s face and the overall composition exactly the same. Photorealistic, fashion photography quality, 4K quality.',
};

export const upscaleImage = async (
    image: ImageFile,
    model: ImageEditModel,
    config: ApiConfig,
    quality: UpscaleQuality = '2K',
    quickModel?: string
): Promise<ImageFile> => {
    const resolvedModel = quickModel ?? model;
    const startTime = Date.now();
    const provider = isLocalModel(resolvedModel) ? 'Local' : isAntiModel(resolvedModel) ? 'Anti' : 'Gemini';
    const prompt = UPSCALE_PROMPTS[quality];

    try {
        let result: ImageFile;

        if (isLocalModel(resolvedModel) || isAntiModel(resolvedModel)) {
            const params: EditImageParams = { images: [image], prompt, numberOfImages: 1 };
            const [upscaled] = await editImage(params, resolvedModel, config);
            result = upscaled;
        } else {
            result = await geminiImageService.upscaleImage(image, quality, prompt, resolvedModel);
        }

        logApiCall({
            provider,
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
            provider,
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

export const extractOutfitItem = async (
    image: ImageFile,
    itemDescription: string,
    model: ImageEditModel,
    config: ApiConfig
): Promise<ImageFile> => {
    const startTime = Date.now();
    const provider = isLocalModel(model) ? 'Local' : isAntiModel(model) ? 'Anti' : 'Gemini';
    const prompt = `From the provided image, precisely extract only the following clothing item: "${itemDescription}". Place the extracted item on a clean, neutral, white background. The output must be only the item itself, with no other parts of the original image or person visible. Ensure the item is fully visible and not cropped.`;

    try {
        let result: ImageFile;

        if (isLocalModel(model) || isAntiModel(model)) {
            const params: EditImageParams = { images: [image], prompt, numberOfImages: 1 };
            const [extracted] = await editImage(params, model, config);
            result = extracted;
        } else {
            result = await geminiImageService.extractOutfitItem(image, itemDescription, model);
        }

        logApiCall({
            provider,
            model,
            feature: 'Extract Outfit',
            prompt,
            duration: Date.now() - startTime,
            status: 'success',
            responseSize: result.base64.length * 0.75,
        });

        return result;
    } catch (error) {
        logApiCall({
            provider,
            model,
            feature: 'Extract Outfit',
            prompt,
            duration: Date.now() - startTime,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
};

export const critiqueAndRedesignOutfit = async (
  image: ImageFile,
  preset: geminiImageService.RedesignPreset,
  numberOfImages: number = 1,
  model: ImageEditModel,
  config: ApiConfig,
  aspectRatio: AspectRatio = 'Default',
  resolution?: ImageResolution
): Promise<{ critique: string; redesignedImages: ImageFile[] }> => {
    const startTime = Date.now();
    const provider = isLocalModel(model) ? 'Local' : isAntiModel(model) ? 'Anti' : 'Gemini';
    const fullPrompt = geminiImageService.PRESET_PROMPTS[preset];

    try {
        let result: { critique: string; redesignedImages: ImageFile[] };

        if (isLocalModel(model)) {
            if (!config.localApiBaseUrl) throw new Error('error.api.localProviderFailed');
            const critiquePrompt = `You are a professional fashion stylist. Based on the provided image, generate ONLY the text critique part of the following instruction. DO NOT generate an image or mention that you will. ONLY provide the text. \n\nINSTRUCTION:\n${fullPrompt}`;
            config.onStatusUpdate('Generating critique with local provider...');
            const critique = await generateTextLocal(critiquePrompt, stripLocalPrefix(model), buildLocalConfig(config));
            const params: EditImageParams = { images: [image], prompt: fullPrompt, numberOfImages, aspectRatio, resolution };
            const redesignedImages = await editImage(params, model, config);
            result = { critique, redesignedImages };
        } else if (isAntiModel(model)) {
            if (!config.antiApiBaseUrl) throw new Error('error.api.antiProviderFailed');
            const critiquePrompt = `You are a professional fashion stylist. Based on the provided image, generate ONLY the text critique part of the following instruction. DO NOT generate an image or mention that you will. ONLY provide the text. \n\nINSTRUCTION:\n${fullPrompt}`;
            config.onStatusUpdate('Generating critique with Anti provider...');
            const critique = await generateTextAnti(critiquePrompt, stripAntiPrefix(model), buildAntiConfig(config));
            const params: EditImageParams = { images: [image], prompt: fullPrompt, numberOfImages, aspectRatio, resolution };
            const redesignedImages = await editImage(params, model, config);
            result = { critique, redesignedImages };
        } else {
            result = await geminiImageService.critiqueAndRedesignOutfit(image, preset, numberOfImages, model, aspectRatio, resolution);
        }

        const responseSize = result.critique.length +
            result.redesignedImages.reduce((sum, img) => sum + img.base64.length * 0.75, 0);

        logApiCall({
            provider,
            model,
            feature: 'Outfit Redesign',
            prompt: fullPrompt,
            duration: Date.now() - startTime,
            status: 'success',
            responseSize,
        });

        return result;
    } catch (error) {
        logApiCall({
            provider,
            model,
            feature: 'Outfit Redesign',
            prompt: fullPrompt,
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
    const provider = isLocalModel(model) ? 'Local' : isAntiModel(model) ? 'Anti' : 'Gemini';

    const finalPrompt = `
# INSTRUCTION: IMAGE RECREATION WITH NEW SUBJECT
## 1. CORE TASK: Recreate a new image based *only* on the provided text prompt. The subject MUST be the person from the reference image.
## 2. REFERENCE IMAGE ROLE: The single provided image is the **'Face Reference'**. Use this image ONLY to capture the person's facial features, hair, and identity.
## 3. TEXT PROMPT (STYLE GUIDE): The following text prompt is the complete guide for the new image's aesthetic. Adhere to it strictly.\n---\n${prompt}\n---
## 4. CRITICAL RULES: Ignore any visual style from other images. The 'Face Reference' is for identity only. The text prompt is for style only.
## 5. FINAL OUTPUT: Generate a single, high-resolution (2K), photorealistic image that fuses the person from the 'Face Reference' with the style from the text prompt.`;

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
            provider,
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
            provider,
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
export type { RefinementHistoryItem } from './gemini/chat';
import { createImageChatSession as createImageChatSessionGemini } from './gemini/chat';

// Unified ImageChatSession interface
export interface ImageChatSession {
    sendRefinement(prompt: string, currentImage: ImageFile): Promise<ImageFile>;
    getHistory(): Array<{ prompt: string; timestamp: number }>;
    reset(): void;
}

/**
 * Create a chat session for iterative image refinement.
 * Routes to the appropriate provider based on model prefix.
 */
export const createImageChatSession = (
    model: string,
    config: ApiConfig
): ImageChatSession => {
    if (isLocalModel(model)) {
        if (!config.localApiBaseUrl) {
            throw new Error('error.api.localProviderFailed');
        }
        const localModel = stripLocalPrefix(model);
        const localConfig: LocalProviderConfig = {
            baseUrl: config.localApiBaseUrl,
            apiKey: config.localApiKey ?? undefined,
        };
        return createImageChatSessionLocal(localModel, localConfig);
    }

    if (isAntiModel(model)) {
        if (!config.antiApiBaseUrl) {
            throw new Error('error.api.antiProviderFailed');
        }
        const antiModel = stripAntiPrefix(model);
        const antiConfig: AntiProviderConfig = {
            baseUrl: config.antiApiBaseUrl,
            apiKey: config.antiApiKey ?? undefined,
        };
        return createImageChatSessionAnti(antiModel, antiConfig);
    }

    // Default to Gemini
    return createImageChatSessionGemini(model) as ImageChatSession;
};

