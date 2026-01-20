# Integrate Debug Logging into Services Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Add `logApiCall()` to imageEditingService and textService to log API calls with provider, model, duration, and response size to browser console.

**Architecture:**
- Wrap each API function with try/catch that logs success/error
- Determine provider from model prefix (`local--` → Local, else → Gemini)
- Calculate response size from base64 length (×0.75) for images, direct length for text

**Tech Stack:** TypeScript, debugService (console.group API)

---

## Task 1: Add logging to imageEditingService - editImage

**Files:**
- Modify: `services/imageEditingService.ts`

**Step 1: Add import for logApiCall**

At top of file, add:
```typescript
import { logApiCall } from './debugService';
```

**Step 2: Wrap editImage function with logging**

Replace the `editImage` function:
```typescript
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
```

**Step 3: Run build to verify no errors**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add services/imageEditingService.ts
git commit -m "feat(debug): add logging to editImage"
```

---

## Task 2: Add logging to generateImage

**Files:**
- Modify: `services/imageEditingService.ts`

**Step 1: Wrap generateImage function with logging**

Replace the `generateImage` function:
```typescript
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
```

**Step 2: Commit**

```bash
git add services/imageEditingService.ts
git commit -m "feat(debug): add logging to generateImage"
```

---

## Task 3: Add logging to upscaleImage

**Files:**
- Modify: `services/imageEditingService.ts`

**Step 1: Wrap upscaleImage function with logging**

Replace the `upscaleImage` function:
```typescript
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
```

**Step 2: Commit**

```bash
git add services/imageEditingService.ts
git commit -m "feat(debug): add logging to upscaleImage"
```

---

## Task 4: Add logging to extractOutfitItem

**Files:**
- Modify: `services/imageEditingService.ts`

**Step 1: Wrap extractOutfitItem function with logging**

Replace the `extractOutfitItem` function:
```typescript
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
```

**Step 2: Commit**

```bash
git add services/imageEditingService.ts
git commit -m "feat(debug): add logging to extractOutfitItem"
```

---

## Task 5: Add logging to critiqueAndRedesignOutfit

**Files:**
- Modify: `services/imageEditingService.ts`

**Step 1: Wrap critiqueAndRedesignOutfit function with logging**

Replace the `critiqueAndRedesignOutfit` function:
```typescript
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
    const provider = isLocalModel(model) ? 'Local' : 'Gemini';
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
```

**Step 2: Commit**

```bash
git add services/imageEditingService.ts
git commit -m "feat(debug): add logging to critiqueAndRedesignOutfit"
```

---

## Task 6: Add logging to recreateImageWithFace

**Files:**
- Modify: `services/imageEditingService.ts`

**Step 1: Wrap recreateImageWithFace function with logging**

Replace the `recreateImageWithFace` function:
```typescript
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
    const provider = isLocalModel(model) ? 'Local' : 'Gemini';

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
```

**Step 2: Run build and tests**

Run: `npm run build && npm run test -- --run`
Expected: Build succeeds, all tests pass

**Step 3: Commit**

```bash
git add services/imageEditingService.ts
git commit -m "feat(debug): add logging to recreateImageWithFace"
```

---

## Task 7: Add logging to textService - generateText

**Files:**
- Modify: `services/textService.ts`

**Step 1: Add import for logApiCall**

At top of file after existing imports, add:
```typescript
import { logApiCall } from './debugService';
```

**Step 2: Wrap generateText function with logging**

Replace the `generateText` function:
```typescript
export const generateText = async (
    prompt: string,
    model: TextGenerateModel,
    config?: TextServiceConfig
): Promise<string> => {
    const startTime = Date.now();
    const provider = isLocalModel(model) ? 'Local' : 'Gemini';

    try {
        const result = isLocalModel(model)
            ? await generateTextLocal(prompt, stripLocalPrefix(model), buildLocalConfig(config))
            : await geminiTextService.generateText(prompt, model);

        logApiCall({
            provider,
            model,
            feature: 'Text Generate',
            prompt,
            duration: Date.now() - startTime,
            status: 'success',
            responseSize: result.length,
        });

        return result;
    } catch (error) {
        logApiCall({
            provider,
            model,
            feature: 'Text Generate',
            prompt,
            duration: Date.now() - startTime,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
};
```

**Step 3: Commit**

```bash
git add services/textService.ts
git commit -m "feat(debug): add logging to generateText"
```

---

## Task 8: Add logging to remaining textService functions

**Files:**
- Modify: `services/textService.ts`

**Step 1: Wrap generateImageDescription**

```typescript
export const generateImageDescription = async (image: ImageFile): Promise<string> => {
    const startTime = Date.now();

    try {
        const result = await geminiTextService.generateImageDescription(image);

        logApiCall({
            provider: 'Gemini',
            model: 'gemini-2.0-flash',
            feature: 'Image Description',
            prompt: IMAGE_DESCRIPTION_PROMPT,
            duration: Date.now() - startTime,
            status: 'success',
            responseSize: result.length,
        });

        return result;
    } catch (error) {
        logApiCall({
            provider: 'Gemini',
            model: 'gemini-2.0-flash',
            feature: 'Image Description',
            prompt: IMAGE_DESCRIPTION_PROMPT,
            duration: Date.now() - startTime,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
};
```

**Step 2: Wrap generateClothingDescription**

```typescript
export const generateClothingDescription = async (image: ImageFile): Promise<string> => {
    const startTime = Date.now();

    try {
        const result = await geminiTextService.generateClothingDescription(image);

        logApiCall({
            provider: 'Gemini',
            model: 'gemini-2.0-flash',
            feature: 'Clothing Description',
            prompt: CLOTHING_DESCRIPTION_PROMPT,
            duration: Date.now() - startTime,
            status: 'success',
            responseSize: result.length,
        });

        return result;
    } catch (error) {
        logApiCall({
            provider: 'Gemini',
            model: 'gemini-2.0-flash',
            feature: 'Clothing Description',
            prompt: CLOTHING_DESCRIPTION_PROMPT,
            duration: Date.now() - startTime,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
};
```

**Step 3: Wrap generatePoseDescription**

```typescript
export const generatePoseDescription = async (image: ImageFile): Promise<string> => {
    const startTime = Date.now();

    try {
        const result = await geminiTextService.generatePoseDescription(image);

        logApiCall({
            provider: 'Gemini',
            model: 'gemini-2.0-flash',
            feature: 'Pose Description',
            prompt: POSE_DESCRIPTION_PROMPT,
            duration: Date.now() - startTime,
            status: 'success',
            responseSize: result.length,
        });

        return result;
    } catch (error) {
        logApiCall({
            provider: 'Gemini',
            model: 'gemini-2.0-flash',
            feature: 'Pose Description',
            prompt: POSE_DESCRIPTION_PROMPT,
            duration: Date.now() - startTime,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
};
```

**Step 4: Wrap analyzeOutfit**

```typescript
export const analyzeOutfit = async (image: ImageFile): Promise<OutfitAnalysis> => {
    const startTime = Date.now();

    try {
        const result = await geminiTextService.analyzeOutfit(image);

        logApiCall({
            provider: 'Gemini',
            model: 'gemini-2.0-flash',
            feature: 'Outfit Analysis',
            prompt: OUTFIT_ANALYSIS_PROMPT,
            duration: Date.now() - startTime,
            status: 'success',
            responseSize: JSON.stringify(result).length,
        });

        return result;
    } catch (error) {
        logApiCall({
            provider: 'Gemini',
            model: 'gemini-2.0-flash',
            feature: 'Outfit Analysis',
            prompt: OUTFIT_ANALYSIS_PROMPT,
            duration: Date.now() - startTime,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
};
```

**Step 5: Wrap generateStylePromptFromImage**

```typescript
export const generateStylePromptFromImage = async (
    image: ImageFile,
    model: TextGenerateModel,
    config?: TextServiceConfig
): Promise<string> => {
    const startTime = Date.now();
    const provider = isLocalModel(model) ? 'Local' : 'Gemini';

    try {
        const result = isLocalModel(model)
            ? await generateTextLocal(STYLE_PROMPT_FROM_IMAGE, stripLocalPrefix(model), buildLocalConfig(config))
            : await geminiTextService.generateStylePromptFromImage(image, model);

        logApiCall({
            provider,
            model,
            feature: 'Style Prompt',
            prompt: STYLE_PROMPT_FROM_IMAGE,
            duration: Date.now() - startTime,
            status: 'success',
            responseSize: result.length,
        });

        return result;
    } catch (error) {
        logApiCall({
            provider,
            model,
            feature: 'Style Prompt',
            prompt: STYLE_PROMPT_FROM_IMAGE,
            duration: Date.now() - startTime,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
};
```

**Step 6: Wrap analyzeScene**

```typescript
export const analyzeScene = async (
    image: ImageFile,
    model: TextGenerateModel,
    config?: TextServiceConfig
): Promise<string> => {
    const startTime = Date.now();
    const provider = isLocalModel(model) ? 'Local' : 'Gemini';

    try {
        const result = isLocalModel(model)
            ? await generateTextLocal(ANALYZE_SCENE_PROMPT, stripLocalPrefix(model), buildLocalConfig(config))
            : await geminiTextService.analyzeScene(image, model);

        logApiCall({
            provider,
            model,
            feature: 'Scene Analysis',
            prompt: ANALYZE_SCENE_PROMPT,
            duration: Date.now() - startTime,
            status: 'success',
            responseSize: result.length,
        });

        return result;
    } catch (error) {
        logApiCall({
            provider,
            model,
            feature: 'Scene Analysis',
            prompt: ANALYZE_SCENE_PROMPT,
            duration: Date.now() - startTime,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
};
```

**Step 7: Run build and tests**

Run: `npm run build && npm run test -- --run`
Expected: Build succeeds, all tests pass

**Step 8: Commit**

```bash
git add services/textService.ts
git commit -m "feat(debug): add logging to all textService functions"
```

---

## Task 9: Final verification and push

**Step 1: Run full verification**

Run: `npm run lint && npm run test -- --run && npm run build`
Expected: All pass

**Step 2: Final commit and push**

```bash
git add -A
git commit -m "feat: complete debug logging integration in services"
git push
```

**Step 3: Manual test**

1. Run `npm run dev`
2. Open browser, go to Settings
3. Enable "Debug Mode"
4. Perform any image operation
5. Open F12 Console - verify styled logs appear

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add logging to editImage | imageEditingService.ts |
| 2 | Add logging to generateImage | imageEditingService.ts |
| 3 | Add logging to upscaleImage | imageEditingService.ts |
| 4 | Add logging to extractOutfitItem | imageEditingService.ts |
| 5 | Add logging to critiqueAndRedesignOutfit | imageEditingService.ts |
| 6 | Add logging to recreateImageWithFace | imageEditingService.ts |
| 7 | Add logging to generateText | textService.ts |
| 8 | Add logging to remaining text functions | textService.ts |
| 9 | Final verification and push | - |

**Total: 9 tasks, 2 files modified**
