import type { Part } from '@google/genai';
import type { WorkflowContext } from '../../workflows/helpers.js';
import { editImage, generateImage, generateImagesFromBatch, type ImageInput } from '../gemini.js';

interface GeminiStepResult {
  results: Record<string, unknown>[];
}

function getFeatureFromInput(input: Record<string, unknown>, explicitFeature?: string): string {
  if (explicitFeature) return explicitFeature;
  if (input.personImage && input.garmentImage) return 'try-on';
  if (input.sourceImage && input.targetImage) return 'clothing-transfer';
  if (input.subjectImage && input.poseReferenceImage) return 'pose';
  if (input.subjectImage && (input.backgroundImage || input.prompt)) return 'background';
  if (input.image && input.prompt) return 'watermark-remover';
  if (input.images && (input.interleavedParts !== undefined || input.numImages !== undefined)) return 'pattern-generator';
  if (input.images && input.style !== undefined) return 'lookbook';
  if (input.images && input.format !== undefined) return 'photo-album';
  if (input.images && input.prompt) return 'ai-editor';
  if (input.images && !input.style && !input.format) return 'lookbook';
  throw new Error('Unknown feature: cannot determine feature from input shape');
}

const FEATURE_PROMPTS: Record<string, string> = {
  'try-on':
    'Replace the clothing on the person in the first image with the garment shown in the second image. ' +
    'Preserve the person\'s pose, face, skin tone, and the background exactly. ' +
    'The new garment should fit naturally on the person\'s body with realistic draping and shadows.',
  'clothing-transfer':
    'Transfer the clothing from the person in the first image onto the person in the second image. ' +
    'Preserve the target person\'s pose, face, skin tone, and background exactly. ' +
    'The transferred clothing should fit the target person naturally with realistic draping and shadows.',
  lookbook:
    'Create a fashion lookbook image showing these clothing items styled together in a cohesive outfit. ' +
    'Place the items on a clean, editorial-style fashion background with good lighting.',
  'photo-album':
    'Create a photo album image from these reference images. ' +
    'Arrange the images in a visually appealing layout suitable for a photo album.',
  background: 'Replace the image background while preserving the subject.',
  pose: 'Apply the target pose while preserving identity and garment details.',
  'ai-editor': 'Edit the image set according to the instruction prompt.',
  'watermark-remover': 'Remove watermark artifacts and restore natural image details.',
  'pattern-generator': 'Generate seamless textile pattern from reference images.',
};

const PATTERN_FALLBACK_PROMPT = FEATURE_PROMPTS['pattern-generator'];

function parseDataUrl(dataUrl: string): ImageInput {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64: match[2] };
  }
  return { mimeType: 'image/png', base64: dataUrl };
}

function toImageInputs(images: string[]): ImageInput[] {
  return images.map(parseDataUrl);
}

function toResults(items: Array<{ base64: string; mimeType: string }>): Record<string, unknown>[] {
  return items.map((img) => ({ base64: img.base64, mimeType: img.mimeType }));
}

function getPrompt(feature: string, input: Record<string, unknown>): string {
  const inputPrompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  if (inputPrompt.length > 0) return inputPrompt;
  return FEATURE_PROMPTS[feature] || 'Generate an image.';
}

export async function geminiExecuteStep(
  ctx: WorkflowContext,
  input: Record<string, unknown>,
  featureOverride?: string,
): Promise<GeminiStepResult> {
  const feature = getFeatureFromInput(input, featureOverride);
  const prompt = getPrompt(feature, input);

  try {
    if (feature === 'try-on') {
      const result = await editImage(
        input.personImage as string,
        input.garmentImage as string,
        prompt,
      );
      return { results: [{ base64: result.base64, mimeType: result.mimeType }] };
    }

    if (feature === 'clothing-transfer') {
      const result = await editImage(
        input.sourceImage as string,
        input.targetImage as string,
        prompt,
      );
      return { results: [{ base64: result.base64, mimeType: result.mimeType }] };
    }

    if (feature === 'background') {
      const images = [input.subjectImage as string, input.backgroundImage as string | undefined]
        .filter((item): item is string => typeof item === 'string' && item.length > 0);
      const results = await generateImage({
        images: toImageInputs(images),
        prompt,
        numberOfImages: typeof input.numberOfImages === 'number' ? input.numberOfImages : 1,
      });
      return { results: toResults(results) };
    }

    if (feature === 'pose') {
      const images = [input.subjectImage as string, input.poseReferenceImage as string | undefined]
        .filter((item): item is string => typeof item === 'string' && item.length > 0);
      const results = await generateImage({
        images: toImageInputs(images),
        prompt,
        numberOfImages: 1,
      });
      return { results: toResults(results) };
    }

    if (feature === 'ai-editor') {
      const imageStrings = input.images as string[];
      const results = await generateImagesFromBatch(imageStrings, prompt);
      return { results: toResults(results) };
    }

    if (feature === 'watermark-remover') {
      const results = await generateImage({
        images: toImageInputs([input.image as string]),
        prompt,
        model: (input.model as string | undefined) || undefined,
        numberOfImages: 1,
      });
      return { results: toResults(results) };
    }

    if (feature === 'pattern-generator') {
      const numberOfImages = typeof input.numImages === 'number' ? input.numImages : 1;
      const interleavedParts = Array.isArray(input.interleavedParts)
        ? (input.interleavedParts as Part[])
        : undefined;

      const results = interleavedParts && interleavedParts.length > 0
        ? await generateImage({
            images: [],
            prompt: '',
            interleavedParts,
            numberOfImages,
          })
        : await generateImage({
            images: toImageInputs(input.images as string[]),
            prompt: PATTERN_FALLBACK_PROMPT,
            numberOfImages,
          });

      return { results: toResults(results) };
    }

    const imageStrings = input.images as string[];
    const results = await generateImagesFromBatch(imageStrings, prompt);

    return { results: toResults(results) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[GEMINI-EXECUTOR] Failed for ${feature}:`, message);
    throw err;
  }
}
