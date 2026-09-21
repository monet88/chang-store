/**
 * GPT Image Lookbook prompt policy.
 *
 * The OpenAI-compatible edit endpoint takes one `prompt` plus an ordered
 * `image[]`, so this policy owns the flat IMAGE ROLE map, image index labels,
 * structured AI Scan blueprint config, and the `/* LOOKBOOK_CONFIG *\/` JSON
 * envelope instead of markdown sections.
 */

import {
  buildLookbookSections,
  buildVariationBasePrompt,
  buildCloseUpBasePrompts,
} from './lookbook-prompt-sections';
import { formatGptBlueprintConfig } from './ai-scan-blueprint';
import type { LookbookPromptInput } from './lookbook-prompt-types';
import type { LookbookStyle } from '../components/LookbookGenerator.prompts';

/**
 * Builds the positional IMAGE ROLES section for GPT Image models when multiple
 * references are provided.
 */
const buildGptImageRoles = (
  imageCount: number,
  hasFabricTextureImage: boolean,
): string => {
  const roleLines: string[] = [];
  const clothingCount = hasFabricTextureImage ? imageCount - 1 : imageCount;

  for (let i = 0; i < clothingCount; i++) {
    roleLines.push(
      `IMAGE ${i + 1} = Clothing garment reference ${clothingCount > 1 ? `view #${i + 1}` : ''} (primary visual evidence for silhouette, construction, and cut)`,
    );
  }

  if (hasFabricTextureImage) {
    roleLines.push(
      `IMAGE ${imageCount} = Fabric texture reference (material surface and texture swatch only)`,
    );
  }

  return `## IMAGE ROLES\n${roleLines.join('\n')}`;
};

/**
 * Builds the main lookbook generation prompt for GPT Studio as a structured JSON config.
 */
export const buildGptLookbookPrompt = ({
  formState,
  images,
  fabricTextureImage,
  outfitBlueprint,
}: LookbookPromptInput): string => {
  const hasFabricTextureImage = Boolean(fabricTextureImage ?? formState.fabricTextureImage);
  const sections = buildLookbookSections(
    formState,
    images,
    fabricTextureImage,
    images.length,
  );

  const instructions: string[] = [];
  if (images.length > 1) {
    instructions.push(buildGptImageRoles(images.length, hasFabricTextureImage));
  }
  instructions.push(...sections.slice(1));

  const config: Record<string, unknown> = {
    OUTPUT: sections[0].replace(/^## OUTPUT\n/, ''),
    INSTRUCTIONS: instructions,
    ...(outfitBlueprint?.trim() ? { AI_SCAN_BLUEPRINT: formatGptBlueprintConfig(outfitBlueprint) } : {}),
  };

  return `/* LOOKBOOK_CONFIG */\n${JSON.stringify(config, null, 2)}`;
};

/**
 * Builds the variation prompt for GPT Studio with structured AI Scan blueprint config.
 */
export const buildGptVariationPrompt = (
  lookbookStyle: LookbookStyle,
  outfitBlueprint: string = '',
): string => {
  const base = buildVariationBasePrompt(lookbookStyle);

  if (outfitBlueprint?.trim()) {
    const gptConfig = formatGptBlueprintConfig(outfitBlueprint);
    return `${base}\n\n/* AI_SCAN_BLUEPRINT_CONFIG */\n${JSON.stringify(gptConfig, null, 2)}`;
  }

  return base;
};

/**
 * Builds the close-up prompts for GPT Studio with structured AI Scan blueprint config.
 */
export const buildGptCloseUpPrompts = (
  outfitBlueprint: string = '',
): string[] => {
  const aiScanBlock = outfitBlueprint?.trim()
    ? `\n\n/* AI_SCAN_BLUEPRINT_CONFIG */\n${JSON.stringify(formatGptBlueprintConfig(outfitBlueprint), null, 2)}`
    : '';

  return buildCloseUpBasePrompts().map((prompt) => prompt + aiScanBlock);
};
