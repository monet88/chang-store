/**
 * GPT Image Virtual Try-On prompt policy.
 * Owns GPT-specific indexed image roles, config shape, preservation rules and
 * negative guidance independently from the Gemini policy.
 */

import type { Part } from '@google/genai';
import { imagePart } from './imagePart';
import { formatGptBlueprintConfig, parseOutfitBlueprint } from './ai-scan-blueprint';
import type { VirtualTryOnPromptInput, VirtualTryOnPromptSourceItem } from './virtual-try-on-prompt-types';
import { isTuckingAllowed, UNTUCKED_DRAPE_INSTRUCTION } from './outfitDrapePolicy';
import { CAMERA_FRAMING_INSTRUCTION, CAMERA_FRAMING_PROHIBITION_LINES } from './cameraFramingPolicy';

const MAX_SOURCE_ITEMS = 4;

const normalizeSourcePrompt = (value?: string) => value?.replace(/\s+/g, ' ').trim() ?? '';

const SUBJECT_ROLE_LABEL = 'SUBJECT: The person/model to dress. Preserve identity, face, body proportions, and pose.';

const sourceItemRoleLabel = (item: VirtualTryOnPromptSourceItem, index: number): string =>
  `SOURCE ITEM #${index + 1} (${item.sourceItemType}): Apply this item.`;

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

export const buildGptVirtualTryOnParts = (input: VirtualTryOnPromptInput): Part[] => {
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

  const parsedBlueprint = parseOutfitBlueprint(input.outfitBlueprint);
  const hasClothing = sourceItems.some((item) => item.sourceItemType === 'clothing');
  const hasNonClothing = sourceItems.some((item) => item.sourceItemType !== 'clothing');
  const tuckingAllowed = isTuckingAllowed(input.extraPrompt);
  const config: Record<string, unknown> = {
    TASK: 'Apply all provided fashion source items to the subject while preserving face, facial features, expression, hair, skin tone, exact age, body proportions, pose, and unrelated scene content.',
    IMAGE_ROLES: buildRoleMap(input).split('\n'),
    APPLICATION_RULES: [
      ...(hasClothing ? [`For each clothing source item, replace every visible matching clothing category from that source image, including complete upper/lower looks. Do not preserve the subject's original pants, skirt, shorts, or jeans when the clothing source image already shows a lower-body garment. Zero original elements in replaced clothing areas may remain.${!tuckingAllowed ? ' Tops hang freely outside the waistband with natural hem drape; never tucked in.' : ''}`] : []),
      ...(!tuckingAllowed ? [UNTUCKED_DRAPE_INSTRUCTION] : []),
      ...(hasNonClothing ? ['For shoes, bag, or accessory source items, add or replace only that category and preserve clothing areas not targeted by a clothing source item.'] : []),
      'Replicate silhouette, construction, collar, sleeves, hems, straps, hardware, sole, texture, material, color, supported graphics/text, pattern scale, folds, contact points, lighting, and occlusion faithfully.',
    ],
    POSE: 'Keep the subject overall pose and stance. Minor natural adjustments are allowed only for realistic fit. Do not insert hands into pants pockets or hide fingers unless already present.',
    CAMERA_AND_FRAMING: CAMERA_FRAMING_INSTRUCTION,
    BACKGROUND: input.backgroundPrompt.trim()
      ? `Replace the background entirely with: "${input.backgroundPrompt.trim()}" and integrate it naturally with the subject and lighting.`
      : 'Keep the original background from the Subject Image exactly as is.',
    PROHIBITIONS: [
      'Do not change unrelated clothing when applying shoes, bag, or accessory items.',
      "Do not alter the subject's face, features, expressions, age, or body proportions.",
      'Preserve source-supported garment graphics and text, but do not invent new logos, text, graphics, or watermarks.',
      ...CAMERA_FRAMING_PROHIBITION_LINES,
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
};
