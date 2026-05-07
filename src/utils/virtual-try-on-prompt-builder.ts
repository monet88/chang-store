/**
 * Virtual Try-On Prompt Builder — Interleaved Part[] for Gemini
 *
 * Returns interleaved [text-label, image, text-label, image, ..., task-text] parts
 * so Gemini knows the role of each image in context.
 */

import type { Part } from '@google/genai';
import { ImageFile, VirtualTryOnSourceItemType } from '../types';

const MAX_SOURCE_ITEMS = 4;

export interface VirtualTryOnPromptSourceItem {
  image: ImageFile;
  sourceItemType: VirtualTryOnSourceItemType;
}

/**
 * Input for building interleaved Virtual Try-On parts.
 * One subject per job — the hook handles batching.
 */
export interface VirtualTryOnPromptInput {
  subjectImage: ImageFile;
  sourceItems: VirtualTryOnPromptSourceItem[];
  extraPrompt: string;
  backgroundPrompt: string;
  isMultiPersonMode?: boolean;
}

/**
 * Build interleaved Part[] for a single Virtual Try-On job.
 *
 * Structure:
 * - N source items → [subject-label, subject-img, source-label, source-img..., task-text]
 *
 * @throws Error if subjectImage is missing, sourceItems empty or >4
 */
export const buildVirtualTryOnParts = (
  input: VirtualTryOnPromptInput
): Part[] => {
  const { subjectImage, sourceItems } = input;

  if (!subjectImage) {
    throw new Error('subjectImage is required');
  }
  if (sourceItems.length === 0) {
    throw new Error('sourceItems must contain at least one item');
  }
  if (sourceItems.length > MAX_SOURCE_ITEMS) {
    throw new Error(`sourceItems must contain 1 to ${MAX_SOURCE_ITEMS} items`);
  }
  sourceItems.forEach((item, index) => {
    if (!item.image?.base64 || !item.image?.mimeType) {
      throw new Error(`sourceItems[${index}] must contain a valid image`);
    }
  });

  const parts: Part[] = [];

  parts.push({ text: 'SUBJECT: The person/model to dress.' });
  parts.push({ inlineData: { data: subjectImage.base64, mimeType: subjectImage.mimeType } });

  sourceItems.forEach((item, index) => {
    parts.push({ text: `SOURCE ITEM #${index + 1} (${item.sourceItemType}): Apply this item exactly.` });
    parts.push({ inlineData: { data: item.image.base64, mimeType: item.image.mimeType } });
  });

  parts.push({ text: buildTaskText(input) });

  return parts;
};

/**
 * Build the consolidated task-text block with optimized prompt content.
 * Private helper — not exported.
 */
function buildTaskText(input: VirtualTryOnPromptInput): string {
  const { sourceItems, extraPrompt, backgroundPrompt, isMultiPersonMode } = input;
  const sourceTypeLines = sourceItems
    .map((item, index) => `- Source item #${index + 1}: ${item.sourceItemType}`)
    .join('\n');
  const hasClothing = sourceItems.some((item) => item.sourceItemType === 'clothing');
  const hasNonClothing = sourceItems.some((item) => item.sourceItemType !== 'clothing');
  const clothingRule = hasClothing
    ? '[CRITICAL] For every clothing source item, replace only the corresponding garment target area with that source garment — zero original elements in that target clothing area may remain. Tops hang freely outside the waistband with natural hem drape; never tucked in.'
    : '';
  const nonClothingRule = hasNonClothing
    ? 'For every shoes, bag, or accessory source item, add or replace only that category. Preserve the subject\'s existing outfit, body, face, hair, background, and all unrelated items exactly. Place each item naturally on the body, in the hand, on the shoulder, or on the feet as appropriate for its type.'
    : '';

  const backgroundSection = backgroundPrompt.trim()
    ? `[CRITICAL] Replace the background entirely with: "${backgroundPrompt.trim()}". Do NOT keep the original background — generate a new background matching this description exactly. The background must complement both the person and the applied source items.`
    : 'Keep the original background from the Subject Image exactly as is.';

  const extraSection = extraPrompt.trim()
    ? `\n${extraPrompt.trim()}`
    : '';

  const multiPersonSection = isMultiPersonMode
    ? `\n\n[CRITICAL MULTI-PERSON TARGETING]\nThe input image contains multiple people. A highly visible red dot with a white outline has been painted on ONE specific person. YOU MUST ONLY MODIFY THE PERSON WITH THE RED DOT. Leave all other people (without the red dot) in the image EXACTLY as they are. Do not change their clothing, faces, or pose. Only the targeted person with the red dot gets the source items.`
    : '';

  const multiPersonProhibition = isMultiPersonMode ? '\n- Do not modify anyone except the person with the red dot.' : '';
  const multiPersonRecap = isMultiPersonMode ? ' ONLY modify the person with the red dot.' : '';

  return `## TASK
Apply all provided fashion source item(s) to the subject while preserving their face, hair, skin tone, body proportions, pose, and non-target styling exactly.${multiPersonSection}

## SOURCE ITEM TYPES
User-selected source types by image:
${sourceTypeLines}
Treat each source image as its listed type. Only edit the matching category or target area for that specific image.

## APPLICATION RULES
${[clothingRule, nonClothingRule].filter(Boolean).join('\n\n')}

The applied items fit naturally to the subject's body, aligned with pose and proportions. Replicate exact construction: shape, straps, hardware, sole, heel, texture, material, pattern, color, scale, and decorative details. Maintain correct pattern scale and orientation — no mirroring, shrinking, or distortion. Match lighting, shadows, and color grading from the subject image. Preserve occlusions: hands, hair, and existing accessories stay in front where physically correct.${extraSection}

## POSE
Maintain the subject's original pose. Allow only minor, natural hand, foot, or contact-point adjustments required to hold, wear, or support the source items — never change the overall posture or stance.

## BACKGROUND
${backgroundSection}

## PROHIBITIONS
- Do not change unrelated clothing when applying shoes, bag, or accessory items.
- No tucking tops into pants or skirts.
- No text, logos, watermarks, extra people.
- No body/face/hair distortion.
- No pattern mirroring, shrinking, or duplication.${multiPersonProhibition}

## CRITICAL RECAP
Each source item is 100% preserved and applied only to its selected category. Clothing replaces target clothing only; accessories do not rewrite the outfit. Face/hair/skin/pose preserved exactly.${multiPersonRecap} Photorealistic, professional-grade.`;
}
