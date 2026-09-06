/**
 * Virtual Try-On Prompt Builder — Interleaved Part[] for Gemini
 *
 * Returns interleaved [text-label, image, text-label, image, ..., task-text] parts
 * so Gemini knows the role of each image in context.
 */

import type { Part } from '@google/genai';
import { ImageFile, VirtualTryOnSourceItemType } from '../types';

const MAX_SOURCE_ITEMS = 4;

const normalizeSourcePrompt = (value?: string) => value?.replace(/\s+/g, ' ').trim() ?? '';

export interface VirtualTryOnPromptSourceItem {
  image: ImageFile;
  sourceItemType: VirtualTryOnSourceItemType;
  sourcePrompt?: string;
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

  parts.push({ text: 'SUBJECT: The person/model to dress. Preserve identity, face, body proportions, and pose.' });
  parts.push({ inlineData: { data: subjectImage.base64, mimeType: subjectImage.mimeType } });

  sourceItems.forEach((item, index) => {
    parts.push({ text: `SOURCE ITEM #${index + 1} (${item.sourceItemType}): Apply this item.` });
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
    .map((item, index) => {
      const sourcePrompt = normalizeSourcePrompt(item.sourcePrompt);
      return sourcePrompt
        ? `- Source item #${index + 1}: ${item.sourceItemType}. User note: ${sourcePrompt}`
        : `- Source item #${index + 1}: ${item.sourceItemType}`;
    })
    .join('\n');
  const hasClothing = sourceItems.some((item) => item.sourceItemType === 'clothing');
  const hasNonClothing = sourceItems.some((item) => item.sourceItemType !== 'clothing');

  const clothingRule = hasClothing
    ? 'A clothing source item may contain one garment or a coordinated outfit with multiple garments. For each clothing source item, replace every visible matching clothing category from that source image: top, bottom, dress, outerwear, belt, or other wearable garment. If a single clothing source image visibly contains a complete look with both upper-body and lower-body garments, treat it as one full-look reference and transfer every visible garment from that image together: remove the subject\'s original top and original bottom together and replace both with the source look in the same result. Do not preserve the subject\'s original pants, skirt, shorts, or jeans when the clothing source image already shows a lower-body garment. If multiple clothing source items contain the same clothing category, use the later source item in list order for that category. Zero original elements in replaced clothing areas may remain. Tops hang freely outside the waistband with natural hem drape; never tucked in.'
    : '';

  const nonClothingRule = hasNonClothing
    ? 'For every shoes, bag, or accessory source item, add or replace only that category. Preserve clothing areas not targeted by any clothing source item, plus body, face, hair, background, and all unrelated items exactly. Never use shoes, bag, or accessory preservation to keep old clothing that a clothing source item should replace. Place each item naturally on the body, in the hand, on the shoulder, or on the feet as appropriate for its type.'
    : '';

  const backgroundSection = backgroundPrompt.trim()
    ? `Replace the background entirely with: "${backgroundPrompt.trim()}". The new background must integrate naturally with the subject and lighting.`
    : 'Keep the original background from the Subject Image exactly as is.';

  const extraSection = extraPrompt.trim()
    ? `\n\n## ADDITIONAL INSTRUCTIONS\n${extraPrompt.trim()}`
    : '';

  const multiPersonSection = isMultiPersonMode
    ? '\n\nTargeting: The input image contains multiple people. A highly visible red dot with a white outline marks ONE specific person. Modify ONLY the person with the red dot. Preserve all other people (without the red dot) in the image exactly as they are, with no changes to their clothing, faces, or pose. Do not add or remove any people.'
    : '';

  const multiPersonProhibition = isMultiPersonMode
    ? '\n- Do not modify anyone except the person with the red dot; do not add or remove people.'
    : '\n- Do not add or remove people.';

  return `## TASK
Apply all provided fashion source items to the subject while preserving their face, facial features, expressions, hair, skin tone, exact age, body proportions, and overall pose. Only the target fashion items change.${multiPersonSection}

## SOURCE ITEM TYPES
User-selected source types by image:
${sourceTypeLines}
Treat each source image as its listed type. Only edit the matching category or target area for that specific image.

## APPLICATION RULES
${[clothingRule, nonClothingRule].filter(Boolean).join('\n\n')}

Applied items must fit naturally to the subject's existing body, aligned with their stance, contours, and physical proportions, with physically correct fabric folds and contact points. Replicate construction details: silhouette, collar, sleeves, hems, straps, hardware, sole, texture, material, and color. Maintain correct pattern scale and orientation without distortion or mirroring. Match the lighting direction, shadows, and color temperature of the subject image so the clothing looks photographed in the same environment. Preserve occlusions: hands, fingers, hair, existing accessories, and foreground objects stay in front where physically appropriate. Preserve visible graphics, logos, and text that are supported by the source clothing references; do not invent new or unsupported logos, text, graphics, or watermarks.

## POSE
Keep the subject's overall pose and stance. Minor natural adjustments to posture, shoulder angle, or arm position are acceptable only where the applied outfit requires it for realistic fit. Do not insert hands into pants pockets or hide fingers unless the subject image already shows hands inside pockets.

## BACKGROUND
${backgroundSection}${extraSection}

## PROHIBITIONS
- Do not change unrelated clothing when applying shoes, bag, or accessory items.
- Do not keep the subject's original lower-body garment when a clothing source image includes its own lower-body garment.
- Do not put hands into pants pockets or hide hands unless the subject image already shows that exact pose.
- No tucking tops into pants or skirts.
- Do not alter the subject's face, features, expressions, age, or body proportions.
- Preserve source-supported garment graphics and text, but do not invent new logos, text, graphics, or watermarks.${multiPersonProhibition}`;
}
