/**
 * Virtual Try-On Prompt Builder
 *
 * `parts` (Gemini): interleaved [text-label, image, text-label, image, ..., task-text]
 * so Gemini knows the role of each image in context.
 * `text` (OpenAI-compatible lane): one role map that names every image by
 * position, followed by the same task text, plus the images in the same order.
 */

import type { Part } from '@google/genai';
import { ImageFile, VirtualTryOnSourceItemType } from '../types';
import type { PromptFormat } from './promptFormat';
import { dropRestatedLines, imagePart } from './promptFormat';
import { formatGeminiBlueprintBlock, formatGptBlueprintConfig, parseOutfitBlueprint } from './ai-scan-blueprint';

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
  /** AI Scan textile deconstruction of the source items (issue #162). */
  outfitBlueprint?: string;
}

const SUBJECT_ROLE_LABEL = 'SUBJECT: The person/model to dress. Preserve identity, face, body proportions, and pose.';

const PROHIBITION_BULLETS = [
  'Do not change unrelated clothing when applying shoes, bag, or accessory items.',
  "Do not keep the subject's original lower-body garment when a clothing source image includes its own lower-body garment.",
  'Do not put hands into pants pockets or hide hands unless the subject image already shows that exact pose.',
  'No tucking tops into pants or skirts.',
  "Do not alter the subject's face, features, expressions, age, or body proportions.",
  'Preserve source-supported garment graphics and text, but do not invent new logos, text, graphics, or watermarks.',
] as const;

/**
 * Bullets 2-4 restate sentences the same prompt already carries: the lower-body
 * rule and the tucking rule live in `## APPLICATION RULES`, the pockets rule in
 * `## POSE`. The flat lane drops them because it is read as one block; the
 * interleaved lane keeps them beside the image labels.
 */
const RESTATED_PROHIBITIONS = PROHIBITION_BULLETS.slice(1, 4);

const sourceItemRoleLabel = (item: VirtualTryOnPromptSourceItem, index: number): string =>
  `SOURCE ITEM #${index + 1} (${item.sourceItemType}): Apply this item.`;

/**
 * Flat-lane role map: names every image by position, so the one prompt the
 * OpenAI-compatible lane receives still binds each image to its role. The
 * per-item user notes ride here so the task text needs no second listing.
 */
const buildRoleMap = (input: VirtualTryOnPromptInput): string =>
  [
    `IMAGE 1 = ${SUBJECT_ROLE_LABEL}`,
    ...input.sourceItems.map((item, index) => {
      const sourcePrompt = normalizeSourcePrompt(item.sourcePrompt);
      const label = `IMAGE ${index + 2} = ${sourceItemRoleLabel(item, index)}`;
      return sourcePrompt ? `${label} User note: ${sourcePrompt}` : label;
    }),
    'Treat each source image as its listed type. Only edit the matching category or target area for that specific image.',
  ].join('\n');

/**
 * Build the Part[] for a single Virtual Try-On job in the requested lane format.
 *
 * Structure (`parts`): N source items → [subject-label, subject-img, source-label, source-img..., task-text]
 * Structure (`text`): [role-map + task-text, subject-img, source-img...]
 *
 * @throws Error if subjectImage is missing, sourceItems empty or >4
 */
export const buildVirtualTryOnParts = (
  input: VirtualTryOnPromptInput,
  format: PromptFormat = 'parts',
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

  if (format === 'text') {
    const parsedBlueprint = parseOutfitBlueprint(input.outfitBlueprint);
    const hasClothing = sourceItems.some((item) => item.sourceItemType === 'clothing');
    const hasNonClothing = sourceItems.some((item) => item.sourceItemType !== 'clothing');
    const config: Record<string, unknown> = {
      TASK: 'Apply all provided fashion source items to the subject while preserving face, facial features, expression, hair, skin tone, exact age, body proportions, pose, and unrelated scene content.',
      IMAGE_ROLES: buildRoleMap(input).split('\n'),
      APPLICATION_RULES: [
        ...(hasClothing ? ["For each clothing source item, replace every visible matching clothing category from that source image, including complete upper/lower looks. Do not preserve the subject's original pants, skirt, shorts, or jeans when the clothing source image already shows a lower-body garment. Zero original elements in replaced clothing areas may remain. Tops hang freely outside the waistband with natural hem drape; never tucked in."] : []),
        ...(hasNonClothing ? ['For shoes, bag, or accessory source items, add or replace only that category and preserve clothing areas not targeted by a clothing source item.'] : []),
        'Replicate silhouette, construction, collar, sleeves, hems, straps, hardware, sole, texture, material, color, supported graphics/text, pattern scale, folds, contact points, lighting, and occlusion faithfully.',
      ],
      POSE: 'Keep the subject overall pose and stance. Minor natural adjustments are allowed only for realistic fit. Do not insert hands into pants pockets or hide fingers unless already present.',
      BACKGROUND: input.backgroundPrompt.trim()
        ? `Replace the background entirely with: "${input.backgroundPrompt.trim()}" and integrate it naturally with the subject and lighting.`
        : 'Keep the original background from the Subject Image exactly as is.',
      PROHIBITIONS: [
        'Do not change unrelated clothing when applying shoes, bag, or accessory items.',
        "Do not alter the subject's face, features, expressions, age, or body proportions.",
        'Preserve source-supported garment graphics and text, but do not invent new logos, text, graphics, or watermarks.',
        ...(input.isMultiPersonMode
          ? ['Remove the red targeting dot and its white ring completely.', 'Modify ONLY the person with the red dot; preserve all other people and do not add or remove people.']
          : ['Do not add or remove people.']),
        ...(parsedBlueprint.detectedAccessories.length > 0 && hasClothing
          ? [`Do not transfer non-clothing accessories from the clothing source image: ${parsedBlueprint.detectedAccessories.join(', ')}.`]
          : []),
      ],
      ...(parsedBlueprint.raw ? { AI_SCAN_BLUEPRINT: formatGptBlueprintConfig(input.outfitBlueprint) } : {}),
    };
    if (input.extraPrompt.trim()) {
      config.USER_INSTRUCTIONS = input.extraPrompt.trim();
    }
    if (input.isMultiPersonMode) {
      config.TARGETING = 'A highly visible red dot with a white outline marks ONE specific person. The dot and its white ring are targeting marks only: remove them completely from the result.';
    }
    return [
      { text: `/* VIRTUAL_TRY_ON_CONFIG */\n${JSON.stringify(config, null, 2)}` },
      imagePart(subjectImage),
      ...sourceItems.map((item) => imagePart(item.image)),
    ];
  }

  const parts: Part[] = [];

  parts.push({ text: SUBJECT_ROLE_LABEL });
  parts.push(imagePart(subjectImage));

  sourceItems.forEach((item, index) => {
    parts.push({ text: sourceItemRoleLabel(item, index) });
    parts.push(imagePart(item.image));
  });

  parts.push({ text: buildTaskText(input, { includeSourceTypeList: true }) });

  return parts;
};

/**
 * Build the consolidated task-text block with optimized prompt content.
 * Private helper — not exported.
 *
 * `includeSourceTypeList` is false for the flat lane, whose role map already
 * names each image, its type, and its user note. `compactRestatements` is the
 * flat lane's form: it drops the prohibition bullets that only repeat an
 * earlier section (see `RESTATED_PROHIBITIONS`).
 */
function buildTaskText(
  input: VirtualTryOnPromptInput,
  options: { includeSourceTypeList: boolean; compactRestatements?: boolean },
): string {
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

  const sourceTypeSection = options.includeSourceTypeList
    ? `## SOURCE ITEM TYPES
User-selected source types by image:
${sourceTypeLines}
Treat each source image as its listed type. Only edit the matching category or target area for that specific image.

`
    : '';

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
  const prohibitionBlock = PROHIBITION_BULLETS.map((bullet) => `- ${bullet}`).join('\n') + accessoryExclusion;
  const prohibitions = options.compactRestatements
    ? dropRestatedLines(prohibitionBlock, RESTATED_PROHIBITIONS)
    : prohibitionBlock;
  return `## TASK
Apply all provided fashion source items to the subject while preserving their face, facial features, expressions, hair, skin tone, exact age, body proportions, and overall pose. Only the target fashion items change.${multiPersonSection}${formatGeminiBlueprintBlock(input.outfitBlueprint)}

${sourceTypeSection}## APPLICATION RULES
${[clothingRule, nonClothingRule].filter(Boolean).join('\n\n')}

Applied items must fit naturally to the subject's existing body, aligned with their stance, contours, and physical proportions, with physically correct fabric folds and contact points. Replicate construction details: silhouette, collar, sleeves, hems, straps, hardware, sole, texture, material, and color. Maintain correct pattern scale and orientation without distortion or mirroring. Match the lighting direction, shadows, and color temperature of the subject image so the clothing looks photographed in the same environment. Preserve occlusions: hands, fingers, hair, existing accessories, and foreground objects stay in front where physically appropriate. Preserve visible graphics, logos, and text that are supported by the source clothing references; do not invent new or unsupported logos, text, graphics, or watermarks.

## POSE
Keep the subject's overall pose and stance. Minor natural adjustments to posture, shoulder angle, or arm position are acceptable only where the applied outfit requires it for realistic fit. Do not insert hands into pants pockets or hide fingers unless the subject image already shows hands inside pockets.

## BACKGROUND
${backgroundSection}${extraSection}

## PROHIBITIONS
${prohibitions}${multiPersonProhibition}`;
}
