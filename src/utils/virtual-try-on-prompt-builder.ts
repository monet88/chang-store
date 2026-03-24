/**
 * Virtual Try-On Prompt Builder — Interleaved Part[] for Gemini
 *
 * Returns interleaved [text-label, image, text-label, image, ..., task-text] parts
 * so Gemini knows the role of each image in context.
 */

import type { Part } from '@google/genai';
import { ImageFile } from '../types';

/**
 * Input for building interleaved Virtual Try-On parts.
 * One subject per job — the hook handles batching.
 */
export interface VirtualTryOnPromptInput {
  subjectImage: ImageFile;
  clothingImages: ImageFile[];
  extraPrompt: string;
  backgroundPrompt: string;
}

/**
 * Build interleaved Part[] for a single Virtual Try-On job.
 *
 * Structure:
 * - Single garment → 5 parts: [subject-label, subject-img, clothing-label, clothing-img, task-text]
 * - Dual garment  → 7 parts: [subject-label, subject-img, top-label, top-img, bottom-label, bottom-img, task-text]
 *
 * @throws Error if subjectImage is missing, clothingImages empty or >2
 */
export const buildVirtualTryOnParts = (
  input: VirtualTryOnPromptInput
): Part[] => {
  const { subjectImage, clothingImages, extraPrompt, backgroundPrompt } = input;

  if (!subjectImage) {
    throw new Error('subjectImage is required');
  }
  if (clothingImages.length === 0) {
    throw new Error('clothingImages must contain at least one item');
  }
  if (clothingImages.length > 2) {
    throw new Error('clothingImages must contain 1 or 2 items');
  }

  const isDualGarment = clothingImages.length === 2;
  const parts: Part[] = [];

  parts.push({ text: 'SUBJECT: The person/model to dress.' });
  parts.push({ inlineData: { data: subjectImage.base64, mimeType: subjectImage.mimeType } });

  if (isDualGarment) {
    parts.push({ text: 'TOP GARMENT: Apply this garment exactly.' });
    parts.push({ inlineData: { data: clothingImages[0].base64, mimeType: clothingImages[0].mimeType } });
    parts.push({ text: 'BOTTOM GARMENT: Apply this garment exactly.' });
    parts.push({ inlineData: { data: clothingImages[1].base64, mimeType: clothingImages[1].mimeType } });
  } else {
    parts.push({ text: 'CLOTHING SOURCE: Apply this garment exactly.' });
    parts.push({ inlineData: { data: clothingImages[0].base64, mimeType: clothingImages[0].mimeType } });
  }

  parts.push({ text: buildTaskText(input, isDualGarment) });

  return parts;
};

/**
 * Build the consolidated task-text block with optimized prompt content.
 * Private helper — not exported.
 */
function buildTaskText(
  input: VirtualTryOnPromptInput,
  isDualGarment: boolean,
): string {
  const { extraPrompt, backgroundPrompt } = input;
  const dualGarmentRule = isDualGarment
    ? ' The top garment drapes outside the bottom\'s waistband, preserving source hem length exactly.'
    : '';

  const backgroundSection = backgroundPrompt.trim()
    ? `Keep the original background from the Subject Image but modify it with this description: "${backgroundPrompt.trim()}". The background must complement both the person and the new outfit.`
    : 'Keep the original background from the Subject Image exactly as is.';

  const extraSection = extraPrompt.trim()
    ? `\n${extraPrompt.trim()}`
    : '';

  return `## TASK
Replace the subject's entire outfit with the provided garments while preserving their face, hair, skin tone, and body proportions exactly.

## GARMENT RULES
[CRITICAL] The output clothing must be 100% from the Source images — zero original outfit elements may remain. All tops hang freely outside the waistband with natural hem drape; never tucked in.${dualGarmentRule}

Clothing fits naturally to the subject's body, aligned with pose and proportions. Replicate exact garment construction: neckline, sleeve style, hem length, silhouette, fabric drape, and decorative details. Maintain correct pattern scale and orientation — no mirroring, shrinking, or distortion. Match lighting, shadows, and color grading from the subject image. Preserve occlusions: hands, hair, and accessories stay in front of the outfit.${extraSection}

## POSE
Maintain the subject's original pose. Allow only minor, natural adjustments to complement the new outfit's silhouette and fit — never change the overall posture or stance.

## BACKGROUND
${backgroundSection}

## PROHIBITIONS
- Zero original outfit elements in output.
- No tucking tops into pants or skirts.
- No text, logos, watermarks, extra people.
- No body/face/hair distortion.
- No pattern mirroring, shrinking, or duplication.

## CRITICAL RECAP
Clothing 100% from Source — zero blending with original. Tops ALWAYS outside waistband. Face/hair/skin preserved exactly. Photorealistic, professional-grade.`;
}
