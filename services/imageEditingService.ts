import { ImageFile, AspectRatio, ImageEditModel, ImageGenerateModel, ImageResolution, UpscaleQuality, DEFAULT_IMAGE_RESOLUTION } from '../types';
import * as geminiImageService from './gemini/image';
import { editImageLocal, generateImageLocal, generateTextLocal } from './localProviderService';
import { getImageDimensions } from '../utils/imageUtils';
import { logApiCall } from './debugService';

interface ApiConfig {
    localApiBaseUrl?: string | null;
    localApiKey?: string | null;
    onStatusUpdate: (message: string) => void;
}

export type EditImageParams = geminiImageService.EditImageParams;

const LOCAL_PREFIX = 'local--';
const isLocalModel = (model: string) => model.startsWith(LOCAL_PREFIX);
const stripLocalPrefix = (model: string) => model.slice(LOCAL_PREFIX.length);

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

export const editImage = async (
    params: EditImageParams,
    model: ImageEditModel,
    config: ApiConfig
): Promise<ImageFile[]> => {
    const startTime = Date.now();
    const provider = isLocalModel(model) ? 'Local' : 'Gemini';

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
        } else {
            result = await geminiImageService.editImage({ ...params, model });
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
    const provider = isLocalModel(model) ? 'Local' : 'Gemini';

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

export const upscaleImage = async (
    image: ImageFile,
    model: ImageEditModel,
    config: ApiConfig,
    quality: UpscaleQuality = '2K'
): Promise<ImageFile> => {
    const startTime = Date.now();
    const provider = isLocalModel(model) ? 'Local' : 'Gemini';
    const prompt = `Upscale this image to a high-resolution ${quality} format (${quality === '4K' ? '4096' : '2048'}px). Enhance fine details, sharpness, and textures while maintaining strict photorealism. Do not add, remove, or change any content or subjects in the image. The result must be a higher-resolution version of the original.`;

    try {
        let result: ImageFile;

        if (isLocalModel(model)) {
            const params: EditImageParams = { images: [image], prompt, numberOfImages: 1 };
            const [upscaled] = await editImage(params, model, config);
            result = upscaled;
        } else {
            result = await geminiImageService.upscaleImage(image, quality);
        }

        logApiCall({
            provider,
            model,
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
            model,
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
    const provider = isLocalModel(model) ? 'Local' : 'Gemini';
    const prompt = `From the provided image, precisely extract only the following clothing item: "${itemDescription}". Place the extracted item on a clean, neutral, white background. The output must be only the item itself, with no other parts of the original image or person visible. Ensure the item is fully visible and not cropped.`;

    try {
        let result: ImageFile;

        if (isLocalModel(model)) {
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
    const fullPrompt = geminiImageService.PRESET_PROMPTS[preset];
    const params: EditImageParams = { images: [image], prompt: fullPrompt, numberOfImages, aspectRatio, resolution };
    const critiquePrompt = `You are a professional fashion stylist. Based on the provided image, generate ONLY the text critique part of the following instruction. DO NOT generate an image or mention that you will. ONLY provide the text. \n\nINSTRUCTION:\n${fullPrompt}`;

    if (isLocalModel(model)) {
        if (!config.localApiBaseUrl) throw new Error('error.api.localProviderFailed');
        config.onStatusUpdate('Generating critique with local provider...');
        const critique = await generateTextLocal(critiquePrompt, stripLocalPrefix(model), buildLocalConfig(config));
        const redesignedImages = await editImage(params, model, config);
        return { critique, redesignedImages };
    }

    return geminiImageService.critiqueAndRedesignOutfit(image, preset, numberOfImages, model, aspectRatio, resolution);
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
    const finalPrompt = `
# INSTRUCTION: IMAGE RECREATION WITH NEW SUBJECT
## 1. CORE TASK: Recreate a new image based *only* on the provided text prompt. The subject MUST be the person from the reference image.
## 2. REFERENCE IMAGE ROLE: The single provided image is the **'Face Reference'**. Use this image ONLY to capture the person's facial features, hair, and identity.
## 3. TEXT PROMPT (STYLE GUIDE): The following text prompt is the complete guide for the new image's aesthetic. Adhere to it strictly.\n---\n${prompt}\n---
## 4. CRITICAL RULES: Ignore any visual style from other images. The 'Face Reference' is for identity only. The text prompt is for style only.
## 5. FINAL OUTPUT: Generate a single, high-resolution (2K), photorealistic image that fuses the person from the 'Face Reference' with the style from the text prompt.`;

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
    return result;
};

// Export chat service for image refinement
export { createImageChatSession, type ImageChatSession, type RefinementHistoryItem } from './gemini/chat';
