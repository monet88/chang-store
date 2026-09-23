/**
 * Qwen Virtual Try-On prompt policy.
 * Owns Qwen-specific prompt wording, reference image ordering (subject first, then garments),
 * textile/blueprint details, and local generation constraints.
 */

import type { Part } from '@google/genai';
import { imagePart } from './imagePart';
import { formatAiScanBlock, parseOutfitBlueprint } from './ai-scan-blueprint';
import type { VirtualTryOnPromptInput, VirtualTryOnPromptSourceItem } from './virtual-try-on-prompt-types';
import { isTuckingAllowed, UNTUCKED_DRAPE_INSTRUCTION } from './outfitDrapePolicy';
import { CAMERA_FRAMING_INSTRUCTION, CAMERA_FRAMING_PROHIBITION_LINES } from './cameraFramingPolicy';

const MAX_SOURCE_ITEMS = 4;

const normalizeSourcePrompt = (value?: string): string => value?.replace(/\s+/g, ' ').trim() ?? '';

const buildQwenPromptText = (input: VirtualTryOnPromptInput): string => {
  const parsedBlueprint = parseOutfitBlueprint(input.outfitBlueprint);
  const hasClothing = input.sourceItems.some((item) => item.sourceItemType === 'clothing');
  const hasNonClothing = input.sourceItems.some((item) => item.sourceItemType !== 'clothing');
  const tuckingAllowed = isTuckingAllowed(input.extraPrompt);

  const sections: string[] = [];

  sections.push(
    'QWEN VIRTUAL TRY-ON SPECIFICATION\n' +
    'TASK: High-fidelity virtual garment try-on. Replace clothing on the model with the reference garments while strictly preserving identity, anatomical realism, lighting coherence, and scene context.',
  );

  // Reference roles mapping
  const referenceLines = [
    'REFERENCE ROLES:',
    '- image_1: Primary model/subject to dress. Faithfully preserve facial features, identity, expression, hairstyle, skin tone, body proportions, posture, and lighting.',
    ...input.sourceItems.map((item, index) => {
      const imgId = `image_${index + 2}`;
      const note = normalizeSourcePrompt(item.sourcePrompt);
      return `- ${imgId}: Source ${item.sourceItemType} item. Transfer this piece onto the model.${note ? ` Description: ${note}` : ''}`;
    }),
  ];
  sections.push(referenceLines.join('\n'));

  // Garment replacement & textile fidelity
  const garmentRules = [
    'GARMENT REPLACEMENT & TEXTILE FIDELITY:',
    ...(hasClothing
      ? [
          "Replace the model's corresponding garments with the exact clothing from the source images.",
          "Do not preserve the model's original lower-body clothing if the source image provides a lower-body piece or full outfit.",
          tuckingAllowed
            ? 'Tuck styling allowed as specified by user instructions.'
            : UNTUCKED_DRAPE_INSTRUCTION,
        ]
      : []),
    ...(hasNonClothing
      ? [
          'For shoes, bags, or accessories, apply only the specified item without modifying unaffected garments.',
        ]
      : []),
    'Accurately replicate textile weave, fabric texture, seams, collar, cuffs, drape, hemline, structural silhouette, pattern scale, and logos from the reference garments.',
  ];
  sections.push(garmentRules.join('\n'));

  // Blueprint details if present
  if (input.outfitBlueprint) {
    const formattedBlock = formatAiScanBlock(input.outfitBlueprint).trim();
    if (formattedBlock) {
      sections.push(formattedBlock);
    }
  }

  // Model & Pose preservation
  const modelPreservation = [
    'MODEL & SCENE PRESERVATION:',
    'Maintain the exact face, expression, hair texture, body geometry, stance, and hand positions.',
    'Do not hide hands or place hands in pockets unless already positioned there in image_1.',
    CAMERA_FRAMING_INSTRUCTION,
    input.backgroundPrompt?.trim()
      ? `BACKGROUND: Replace background with "${input.backgroundPrompt.trim()}" and blend naturally with lighting.`
      : 'BACKGROUND: Preserve the exact background and environmental lighting from image_1.',
  ];
  sections.push(modelPreservation.join('\n'));

  // Negative / Prohibitions
  const prohibitions = [
    'PROHIBITIONS:',
    "Do not alter the model's identity, face, age, or body proportions.",
    'Do not invent new text, logos, or watermarks not present in the reference images.',
    ...CAMERA_FRAMING_PROHIBITION_LINES,
    ...(input.isMultiPersonMode
      ? [
          'A red dot with a white ring marks the target subject: remove the marker completely and modify only the targeted person.',
        ]
      : ['Do not add or remove people from the scene.']),
    ...(parsedBlueprint.detectedAccessories.length > 0 && hasClothing
      ? [`Do not transfer non-clothing accessories from clothing references: ${parsedBlueprint.detectedAccessories.join(', ')}.`]
      : []),
  ];
  sections.push(prohibitions.join('\n'));

  if (input.extraPrompt?.trim()) {
    sections.push(`USER INSTRUCTIONS: ${input.extraPrompt.trim()}`);
  }

  return sections.join('\n\n');
};

/**
 * Builds the interleaved parts for Qwen Virtual Try-On.
 * Guarantees deterministic reference ordering:
 * - image_1: primary subject/model
 * - image_2..N: garment/source references in feature-defined order
 */
export const buildQwenVirtualTryOnParts = (input: VirtualTryOnPromptInput): Part[] => {
  const { subjectImage, sourceItems } = input;

  if (!subjectImage) {
    throw new Error('subjectImage is required');
  }
  if (!sourceItems || sourceItems.length === 0) {
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

  const promptText = buildQwenPromptText(input);

  return [
    { text: promptText },
    imagePart(subjectImage),
    ...sourceItems.map((item) => imagePart(item.image)),
  ];
};
