/**
 * Gemini Virtual Try-On prompt policy.
 * Owns Gemini-specific role framing, preservation rules and prompt structure.
 */

import type { Part } from '@google/genai';
import { imagePart } from './imagePart';
import { formatGeminiBlueprintBlock, parseOutfitBlueprint } from './ai-scan-blueprint';
import type { VirtualTryOnPromptInput, VirtualTryOnPromptSourceItem } from './virtual-try-on-prompt-types';
import { isTuckingAllowed, UNTUCKED_DRAPE_INSTRUCTION, UNTUCKED_PROHIBITION_LINE } from './outfitDrapePolicy';
import { CAMERA_FRAMING_INSTRUCTION, CAMERA_FRAMING_PROHIBITION_LINES } from './cameraFramingPolicy';

const MAX_SOURCE_ITEMS = 4;

const normalizeSourcePrompt = (value?: string) => value?.replace(/\s+/g, ' ').trim() ?? '';

const SUBJECT_ROLE_LABEL = 'SUBJECT: The person/model to dress. Preserve identity, face, body proportions, and pose.';

const PROHIBITION_BULLETS = [
  'Do not change unrelated clothing when applying shoes, bag, or accessory items.',
  "Do not keep the subject's original lower-body garment when a clothing source image includes its own lower-body garment.",
  'Do not put hands into pants pockets or hide hands unless the subject image already shows that exact pose.',
  UNTUCKED_PROHIBITION_LINE,
  "Do not alter the subject's face, features, expressions, age, or body proportions.",
  ...CAMERA_FRAMING_PROHIBITION_LINES,
  'Preserve source-supported garment graphics and text, but do not invent new logos, text, graphics, or watermarks.',
] as const;

const sourceItemRoleLabel = (item: VirtualTryOnPromptSourceItem, index: number): string =>
  `SOURCE ITEM #${index + 1} (${item.sourceItemType}): Apply this item.`;

/**
 * Build Gemini's interleaved role/image/task sequence for one Virtual Try-On job.
 *
 * @throws Error if subjectImage is missing, sourceItems empty or >4
 */
export const buildGeminiVirtualTryOnParts = (
  input: VirtualTryOnPromptInput,
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

  parts.push({ text: SUBJECT_ROLE_LABEL });
  parts.push(imagePart(subjectImage));

  sourceItems.forEach((item, index) => {
    parts.push({ text: sourceItemRoleLabel(item, index) });
    parts.push(imagePart(item.image));
  });

  parts.push({ text: buildTaskText(input) });

  return parts;
};

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
  const tuckingAllowed = isTuckingAllowed(extraPrompt);

  const untuckedTaskHeadline = !tuckingAllowed
    ? '\n\nCRITICAL OVERRIDE — HEMLINE & WAISTBAND (NEVER TUCK IN): All tops, blouses, and shirts MUST hang completely untucked outside the waistband. Even if the subject in the photo is standing straight, wears high-waisted pants/skirt, or originally had their shirt tucked in, you MUST drape the new top completely outside and over the waistband of the lower garment. The waistband and beltline must be covered or partially overlapped by the top\'s hemline; under no circumstances should the top be stuffed or tucked into the pants/skirt.'
    : '';

  const userNotesSummary = sourceItems
    .map((item, index) => {
      const note = normalizeSourcePrompt(item.sourcePrompt);
      return note ? `- Item #${index + 1} (${item.sourceItemType}): "${note}"` : null;
    })
    .filter(Boolean);

  const userNotesSection = userNotesSummary.length > 0
    ? `\n\n## USER SPECIFIC INSTRUCTIONS FOR GARMENTS (STRICT COMPLIANCE REQUIRED)\n${userNotesSummary.join('\n')}\nPay meticulous attention to the user notes above: apply the exact fit, silhouette, and garment type specified.`
    : '';

  const clothingRule = hasClothing
    ? `A clothing source item may contain one garment or a coordinated outfit with multiple garments. For each clothing source item, replace every visible matching clothing category from that source image: top, bottom, dress, outerwear, belt, or other wearable garment. If a single clothing source image visibly contains a complete look with both upper-body and lower-body garments, treat it as one full-look reference and transfer every visible garment from that image together: remove the subject's original top and original bottom together and replace both with the source look in the same result. Do not preserve the subject's original pants, skirt, shorts, or jeans when the clothing source image already shows a lower-body garment. If multiple clothing source items contain the same clothing category, use the later source item in list order for that category. Zero original elements in replaced clothing areas may remain.${!tuckingAllowed ? ' Tops hang freely outside the waistband with natural hem drape; never tucked in.' : ''}`
    : '';

  const nonClothingRule = hasNonClothing
    ? 'For every shoes, bag, or accessory source item, add or replace only that category. Preserve clothing areas not targeted by any clothing source item, plus body, face, hair, background, and all unrelated items exactly. Never use shoes, bag, or accessory preservation to keep old clothing that a clothing source item should replace. Place each item naturally on the body, in the hand, on the shoulder, or on the feet as appropriate for its type.'
    : '';

  const untuckedDrapeRule = !tuckingAllowed ? UNTUCKED_DRAPE_INSTRUCTION : '';

  const backgroundSection = backgroundPrompt.trim()
    ? `Replace the background entirely with: "${backgroundPrompt.trim()}". The new background must integrate naturally with the subject and lighting.`
    : 'Keep the original background from the Subject Image exactly as is.';

  const extraSection = extraPrompt.trim()
    ? `\n\n## ADDITIONAL INSTRUCTIONS\n${extraPrompt.trim()}`
    : '';

  const sourceTypeSection = `## SOURCE ITEM TYPES
User-selected source types by image:
${sourceTypeLines}
Treat each source image as its listed type. Only edit the matching category or target area for that specific image.

`;

  const multiPersonSection = isMultiPersonMode
    ? '\n\nTargeting: The input image contains multiple people. A highly visible red dot with a white outline marks ONE specific person. The dot and its white ring are targeting marks only: remove them completely from the result, leaving the clothing and the skin clean. Modify ONLY the person with the red dot. Preserve all other people (without the red dot) in the image exactly as they are, with no changes to their clothing, faces, or pose. Do not add or remove any people.'
    : '';

  const multiPersonProhibition = isMultiPersonMode
    ? '\n- Remove the red targeting dot and its white ring completely; no dot, ring, or halo may remain on the person.\n- Do not modify anyone except the person with the red dot; do not add or remove people.'
    : '\n- Do not add or remove people.';

  const parsedBlueprint = parseOutfitBlueprint(input.outfitBlueprint);
  const accessoryExclusion = parsedBlueprint.detectedAccessories.length > 0 && hasClothing
    ? `\n- Do not transfer non-clothing accessories from the clothing source image: ${parsedBlueprint.detectedAccessories.join(', ')}.`
    : '';
  const activeProhibitions = PROHIBITION_BULLETS.filter((bullet) => {
    if (tuckingAllowed && bullet === UNTUCKED_PROHIBITION_LINE) {
      return false;
    }
    return true;
  });
  const prohibitions = activeProhibitions.map((bullet) => `- ${bullet}`).join('\n') + accessoryExclusion;
  return `## TASK
Apply all provided fashion source items to the subject while preserving their face, facial features, expressions, hair, skin tone, exact age, body proportions, and overall pose. Only the target fashion items change.${untuckedTaskHeadline}${multiPersonSection}${formatGeminiBlueprintBlock(input.outfitBlueprint)}${userNotesSection}

${sourceTypeSection}## APPLICATION RULES
${[clothingRule, nonClothingRule, untuckedDrapeRule].filter(Boolean).join('\n\n')}

Applied items must fit naturally to the subject's existing body, aligned with their stance, contours, and physical proportions, with physically correct fabric folds and contact points. Replicate construction details: silhouette, collar, sleeves, hems, straps, hardware, sole, texture, material, and color. Maintain correct pattern scale and orientation without distortion or mirroring. Match the lighting direction, shadows, and color temperature of the subject image so the clothing looks photographed in the same environment. Preserve occlusions: hands, fingers, hair, existing accessories, and foreground objects stay in front where physically appropriate. Preserve visible graphics, logos, and text that are supported by the source clothing references; do not invent new or unsupported logos, text, graphics, or watermarks.

## POSE
Keep the subject's overall pose and stance. Minor natural adjustments to posture, shoulder angle, or arm position are acceptable only where the applied outfit requires it for realistic fit. Do not insert hands into pants pockets or hide fingers unless the subject image already shows hands inside pockets. ${CAMERA_FRAMING_INSTRUCTION}
## BACKGROUND
${backgroundSection}${extraSection}

## PROHIBITIONS
${prohibitions}${multiPersonProhibition}`;
}
