
import { ImageFile, AspectRatio, ImageEditModel, ImageGenerateModel, VideoGenerateModel, AIVideoAutoModel } from '../types';
import * as geminiImageService from './gemini/image';
import * as geminiTextService from './gemini/text';
import * as geminiVideoService from './gemini/video';
import * as aivideoautoService from './aivideoautoService';
import { getImageDimensions } from '../utils/imageUtils';

interface ApiConfig {
    aivideoautoAccessToken?: string | null;
    onStatusUpdate: (message: string) => void;
    aivideoautoVideoModels?: AIVideoAutoModel[];
    aivideoautoImageModels?: AIVideoAutoModel[];
}

export type EditImageParams = geminiImageService.EditImageParams;

export const editImage = async (
    params: EditImageParams,
    model: ImageEditModel,
    config: ApiConfig
): Promise<ImageFile[]> => {
    if (model.startsWith('aivideoauto--')) {
        if (!config.aivideoautoAccessToken) throw new Error("error.api.aivideoautoAuth");
        const modelIdBase = model.split('--')[1];
        
        const aivideoautoModel = config.aivideoautoImageModels?.find(m => m.id_base === modelIdBase);
        if (!aivideoautoModel) {
            throw new Error(`Invalid AIVideoAuto model ID for image editing: ${modelIdBase}.`);
        }
        
        const ratioMap: { [key in AspectRatio]?: '1_1' | '9_16' | '16_9' | '4_3' | '3_4' } = {
            '1:1': '1_1', '9:16': '9_16', '16:9': '16_9', '4:3': '4_3', '3:4': '3_4',
        };
        const ratio = params.aspectRatio ? ratioMap[params.aspectRatio] : undefined;
        
        const results = await Promise.all(Array.from({ length: params.numberOfImages || 1 }).map(() => 
            aivideoautoService.createImage(config.aivideoautoAccessToken!, {
                model: aivideoautoModel.model,
                prompt: params.prompt,
                subjects: params.images.length > 0 ? params.images : undefined,
                ratio,
            })
        ));
        return results;
    }
    return geminiImageService.editImage(params);
};

export const generateImage = async (
    prompt: string,
    aspectRatio: AspectRatio,
    numberOfImages: number,
    model: ImageGenerateModel,
    config: ApiConfig
): Promise<ImageFile[]> => {
    if (model.startsWith('aivideoauto--')) {
        const params: EditImageParams = { images: [], prompt, numberOfImages, aspectRatio };
        return editImage(params, model, config);
    }
    return geminiImageService.generateImageFromText(prompt, aspectRatio, numberOfImages, model);
};

export const upscaleImage = async (
    image: ImageFile,
    model: ImageEditModel,
    config: ApiConfig
): Promise<ImageFile> => {
    const prompt = "Upscale this image to a high-resolution 2K format. Enhance fine details, sharpness, and textures while maintaining strict photorealism. Do not add, remove, or change any content or subjects in the image. The result must be a higher-resolution version of the original.";
    const params: EditImageParams = { images: [image], prompt, numberOfImages: 1 };
    
    if (model.startsWith('aivideoauto--')) {
        const [result] = await editImage(params, model, config);
        return result;
    }
    return geminiImageService.upscaleImage(image);
};

export const extractOutfitItem = async (
    image: ImageFile, 
    itemDescription: string,
    model: ImageEditModel,
    config: ApiConfig
): Promise<ImageFile> => {
    const prompt = `From the provided image, precisely extract only the following clothing item: "${itemDescription}". Place the extracted item on a clean, neutral, white background. The output must be only the item itself, with no other parts of the original image or person visible. Ensure the item is fully visible and not cropped.`;
    const params: EditImageParams = { images: [image], prompt, numberOfImages: 1 };
    
    if (model.startsWith('aivideoauto--')) {
        const [result] = await editImage(params, model, config);
        return result;
    }
    return geminiImageService.extractOutfitItem(image, itemDescription, model);
};

export const critiqueAndRedesignOutfit = async (
  image: ImageFile,
  preset: geminiImageService.RedesignPreset,
  numberOfImages: number = 1,
  model: ImageEditModel,
  config: ApiConfig,
  aspectRatio: AspectRatio = 'Default'
): Promise<{ critique: string; redesignedImages: ImageFile[] }> => {
    const fullPrompt = geminiImageService.PRESET_PROMPTS[preset];
    const params: EditImageParams = { images: [image], prompt: fullPrompt, numberOfImages, aspectRatio };

    if (model.startsWith('aivideoauto--')) {
        config.onStatusUpdate('Generating critique with Gemini...');
        const critiquePrompt = `You are a professional fashion stylist. Based on the provided image, generate ONLY the text critique part of the following instruction. DO NOT generate an image or mention that you will. ONLY provide the text. \n\nINSTRUCTION:\n${fullPrompt}`;
        const critique = await geminiTextService.generateText(critiquePrompt);
        
        const redesignedImages = await editImage(params, model, config);
        return { critique, redesignedImages };
    }
    
    return geminiImageService.critiqueAndRedesignOutfit(image, preset, numberOfImages, model, aspectRatio);
};

export const recreateImageWithFace = async (
    prompt: string,
    faceImage: ImageFile,
    styleImage: ImageFile,
    model: ImageEditModel,
    config: ApiConfig,
    aspectRatio?: AspectRatio
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
    
    const [result] = await editImage({ images: [faceImage], prompt: finalPrompt, numberOfImages: 1, aspectRatio: finalAspectRatio }, model, config);
    if (!result) throw new Error('Image recreation failed to produce a result.');
    return result;
};

export const generateVideo = async (
    prompt: string,
    model: VideoGenerateModel,
    config: ApiConfig,
    faceImage?: ImageFile | null
): Promise<string> => {
    if (model.startsWith('aivideoauto--')) {
        if (!config.aivideoautoAccessToken) throw new Error("error.api.aivideoautoAuth");
        if (!faceImage) throw new Error("A reference image is mandatory for AIVideoAuto video generation.");

        const modelIdBase = model.split('--')[1];
        const aivideoautoModel = config.aivideoautoVideoModels?.find(m => m.id_base === modelIdBase);
        if (!aivideoautoModel) throw new Error(`Invalid AIVideoAuto model ID: ${modelIdBase}. Models not loaded.`);
        
        config.onStatusUpdate('Uploading reference image...');
        const uploaded = await aivideoautoService.uploadImage(config.aivideoautoAccessToken, faceImage);
        
        config.onStatusUpdate('Creating video task...');
        const videoId = await aivideoautoService.createVideoTask(config.aivideoautoAccessToken, {
            model: aivideoautoModel.model,
            prompt,
            images: [uploaded],
        });

        config.onStatusUpdate('Task created. Polling for video status...');
        return await aivideoautoService.pollForVideo(config.aivideoautoAccessToken, videoId, config.onStatusUpdate);
    }

    if (!faceImage) throw new Error("A reference image is mandatory for Gemini video generation.");
    return geminiVideoService.generateVideo(faceImage, prompt, config.onStatusUpdate, model);
};
