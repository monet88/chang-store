import type { WorkflowContext } from '../../workflows/helpers';
import { editImage, generateImagesFromBatch } from '../gemini';

interface GeminiStepResult {
  results: Record<string, unknown>[];
}

function getFeatureFromInput(input: Record<string, unknown>, explicitFeature?: string): string {
  if (explicitFeature) return explicitFeature;
  if (input.personImage && input.garmentImage) return 'try-on';
  if (input.sourceImage && input.targetImage) return 'clothing-transfer';
  if (input.images && input.style !== undefined) return 'lookbook';
  if (input.images && input.format !== undefined) return 'photo-album';
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
};

export async function geminiExecuteStep(
  ctx: WorkflowContext,
  input: Record<string, unknown>,
  featureOverride?: string,
): Promise<GeminiStepResult> {
  const feature = getFeatureFromInput(input, featureOverride);
  const prompt = FEATURE_PROMPTS[feature] || 'Generate an image.';

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

    const imageStrings = input.images as string[];
    const results = await generateImagesFromBatch(imageStrings, prompt);

    return {
      results: results.map((img) => ({
        base64: img.base64,
        mimeType: img.mimeType,
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[GEMINI-EXECUTOR] Failed for ${feature}:`, message);
    throw err;
  }
}
