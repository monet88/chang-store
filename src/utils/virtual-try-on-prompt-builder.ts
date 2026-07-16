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
    ? '[CRITICAL] A clothing source item may contain one garment or a coordinated outfit with multiple garments. For each clothing source item, replace every visible matching clothing category from that source image: top, bottom, dress, outerwear, belt, or other wearable garment. If multiple clothing source items contain the same clothing category, use the later source item in list order for that category. Zero original elements in replaced clothing areas may remain. Tops hang freely outside the waistband with natural hem drape; never tucked in.'
    : '';
  const nonClothingRule = hasNonClothing
    ? 'For every shoes, bag, or accessory source item, add or replace only that category. Preserve clothing areas not targeted by any clothing source item, plus body, face, hair, background, and all unrelated items exactly. Never use shoes, bag, or accessory preservation to keep old clothing that a clothing source item should replace. Place each item naturally on the body, in the hand, on the shoulder, or on the feet as appropriate for its type.'
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
Apply all provided fashion source item(s) to the subject while preserving their face, hair, skin tone, body proportions, pose, and non-target styling exactly. [CRITICAL] FACE PRESERVATION: You must keep the subject's face, facial features, expressions, and identity 100% identical to the Subject Image. Do not alter, redraw, or modify the face in any way. You must strictly preserve the subject's exact age, body type (e.g., child, toddler, adult), and physical proportions. Do NOT alter the subject's age, height, or body shape to match the clothing source.${multiPersonSection}

## SOURCE ITEM TYPES
User-selected source types by image:
${sourceTypeLines}
Treat each source image as its listed type. Only edit the matching category or target area for that specific image. If a single clothing source image visibly contains a complete look with both upper-body and lower-body garments, treat it as one full-look reference and transfer every visible garment from that image together.

## APPLICATION RULES
${[clothingRule, nonClothingRule].filter(Boolean).join('\n\n')}

When one clothing source image includes both a top and a bottom, remove the subject's original top and original bottom together and replace both with the source look in the same result. Do not preserve the subject's original pants, skirt, shorts, or jeans when the clothing source image already shows a lower-body garment.

The applied items fit naturally to the subject's body, aligned with pose and proportions. Replicate exact construction: shape, straps, hardware, sole, heel, texture, material, pattern, color, scale, and decorative details. Maintain correct pattern scale and orientation — no mirroring, shrinking, or distortion. CRITICAL: Match the lighting, shadows, and color grading of the ORIGINAL SUBJECT IMAGE exactly. The applied clothing must look like it was photographed in the exact same environment and lighting conditions. Preserve occlusions: hands, hair, and existing accessories stay in front where physically correct.${extraSection}

## POSE
Keep the subject's overall pose and stance. Minor natural adjustments to posture, shoulder angle, or arm position are acceptable where the applied outfit requires it for a realistic fit. Do not insert hands into pants pockets or hide fingers unless the subject image already shows hands inside pockets.

## BACKGROUND
${backgroundSection}

## PROHIBITIONS
- Do not change unrelated clothing when applying shoes, bag, or accessory items.
- Do not keep the subject's original lower-body garment when a clothing source image includes its own lower-body garment.
- Do not put hands into pants pockets or hide hands unless the subject image already shows that exact pose.
- No tucking tops into pants or skirts.
- No text, logos, watermarks, extra people.
- No body/face/hair distortion. Do not change the subject's face, features, expressions, age, or body shape. Keep the face 100% identical.
- No pattern mirroring, shrinking, or duplication.${multiPersonProhibition}

## CRITICAL RECAP
Each source item is 100% preserved and applied only to its selected category. A clothing source image showing a full outfit must replace every visible garment in that outfit, including both top and bottom when both are present; shoes, bags, and accessories do not rewrite unrelated areas. Face (100% identical, absolutely no changes to face features/expression), hair/skin preserved; overall pose kept with only minor outfit-fit adjustments allowed.${multiPersonRecap} Photorealistic, professional-grade.`;
}
