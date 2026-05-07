/**
 * Virtual Try-On Prompt Builder — Interleaved Part[] for Gemini
 *
 * Returns interleaved [text-label, image, text-label, image, ..., task-text] parts
 * so Gemini knows the role of each image in context.
 */

import type { Part } from '@google/genai';
import { ImageFile, VirtualTryOnSourceItemType } from '../types';

/**
 * Input for building interleaved Virtual Try-On parts.
 * One subject per job — the hook handles batching.
 */
export interface VirtualTryOnPromptInput {
  subjectImage: ImageFile;
  clothingImages: ImageFile[];
  sourceItemType: VirtualTryOnSourceItemType;
  extraPrompt: string;
  backgroundPrompt: string;
  isMultiPersonMode?: boolean;
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
  const { subjectImage, clothingImages, sourceItemType, extraPrompt, backgroundPrompt } = input;

  if (!subjectImage) {
    throw new Error('subjectImage is required');
  }
  if (clothingImages.length === 0) {
    throw new Error('clothingImages must contain at least one item');
  }
  if (clothingImages.length > 2) {
    throw new Error('clothingImages must contain 1 or 2 items');
  }
  if (sourceItemType !== 'clothing' && clothingImages.length > 1) {
    throw new Error('Only clothing source type supports 2 source images');
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
    parts.push({ text: `SOURCE ITEM (${sourceItemType}): Apply this item exactly.` });
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
  const { sourceItemType, extraPrompt, backgroundPrompt, isMultiPersonMode } = input;
  const dualGarmentRule = isDualGarment
    ? ' The top garment drapes outside the bottom\'s waistband, preserving source hem length exactly.'
    : '';

  const backgroundSection = backgroundPrompt.trim()
    ? `[CRITICAL] Replace the background entirely with: "${backgroundPrompt.trim()}". Do NOT keep the original background — generate a new background matching this description exactly. The background must complement both the person and the new outfit.`
    : 'Keep the original background from the Subject Image exactly as is.';

  const extraSection = extraPrompt.trim()
    ? `\n${extraPrompt.trim()}`
    : '';

  const multiPersonSection = isMultiPersonMode
    ? `\n\n[CRITICAL MULTI-PERSON TARGETING]\nThe input image contains multiple people. A highly visible red dot with a white outline has been painted on ONE specific person. YOU MUST ONLY MODIFY THE PERSON WITH THE RED DOT. Leave all other people (without the red dot) in the image EXACTLY as they are. Do not change their clothing, faces, or pose. Only the targeted person with the red dot gets the new outfit.`
    : '';

  const multiPersonProhibition = isMultiPersonMode ? '\n- Do not modify anyone except the person with the red dot.' : '';
  const multiPersonRecap = isMultiPersonMode ? ' ONLY modify the person with the red dot.' : '';

  return `## TASK
Apply the provided fashion source item(s) to the subject while preserving their face, hair, skin tone, body proportions, pose, and non-target styling exactly.${multiPersonSection}

## SOURCE ITEM TYPE
User-selected source type: ${sourceItemType}. Treat every source image as this type. Only edit the matching target area on the subject.

## APPLICATION RULES
[CRITICAL] If the source type is clothing, replace only the corresponding garment area with the source garment — zero original elements in that target clothing area may remain. Tops hang freely outside the waistband with natural hem drape; never tucked in.${dualGarmentRule}

If the source type is shoes, bag, or accessory, add or replace only that category. Preserve the subject's existing outfit, body, face, hair, background, and all unrelated items exactly. Place the item naturally on the body, in the hand, on the shoulder, or on the feet as appropriate for its type.

The applied item fits naturally to the subject's body, aligned with pose and proportions. Replicate exact construction: shape, straps, hardware, sole, heel, texture, material, pattern, color, scale, and decorative details. Maintain correct pattern scale and orientation — no mirroring, shrinking, or distortion. Match lighting, shadows, and color grading from the subject image. Preserve occlusions: hands, hair, and existing accessories stay in front where physically correct.${extraSection}

## POSE
Maintain the subject's original pose. Allow only minor, natural hand, foot, or contact-point adjustments required to hold, wear, or support the source item — never change the overall posture or stance.

## BACKGROUND
${backgroundSection}

## PROHIBITIONS
- Do not change non-target clothing when source type is shoes, bag, or accessory.
- No tucking tops into pants or skirts.
- No text, logos, watermarks, extra people.
- No body/face/hair distortion.
- No pattern mirroring, shrinking, or duplication.${multiPersonProhibition}

## CRITICAL RECAP
Source item 100% preserved and applied only to its matching category. Clothing replaces target clothing only; accessories do not rewrite the outfit. Face/hair/skin/pose preserved exactly.${multiPersonRecap} Photorealistic, professional-grade.`;
}
