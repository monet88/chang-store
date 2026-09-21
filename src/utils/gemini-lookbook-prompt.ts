/**
 * Gemini Lookbook prompt policy.
 *
 * Owns the interleaved-part envelope: markdown sections in reading order plus
 * the Gemini AI Scan block. Gemini consumes requests as interleaved parts, so
 * this policy joins the lane-neutral sections into a single markdown prompt
 * block and appends the Gemini-specific AI Scan blueprint when available.
 */

import {
  buildLookbookSections,
  buildVariationBasePrompt,
  buildCloseUpBasePrompts,
} from './lookbook-prompt-sections';
import { formatAiScanBlock, formatGeminiBlueprintBlock } from './ai-scan-blueprint';
import type { LookbookPromptInput } from './lookbook-prompt-types';
import type { LookbookStyle } from '../components/LookbookGenerator.prompts';

/**
 * Builds the main lookbook generation prompt for Gemini Studio.
 */
export const buildGeminiLookbookPrompt = ({
  formState,
  images,
  fabricTextureImage,
  outfitBlueprint,
}: LookbookPromptInput): string => {
  const sections = buildLookbookSections(formState, images, fabricTextureImage);
  const body = sections.join('\n\n');

  if (outfitBlueprint?.trim()) {
    return body + formatGeminiBlueprintBlock(outfitBlueprint);
  }

  return body;
};

/**
 * Builds the variation prompt for Gemini Studio.
 */
export const buildGeminiVariationPrompt = (
  lookbookStyle: LookbookStyle,
  outfitBlueprint: string = '',
): string => {
  const base = buildVariationBasePrompt(lookbookStyle);

  if (outfitBlueprint?.trim()) {
    return base + formatAiScanBlock(outfitBlueprint);
  }

  return base;
};

/**
 * Builds the close-up prompts for Gemini Studio.
 */
export const buildGeminiCloseUpPrompts = (
  outfitBlueprint: string = '',
): string[] => {
  const aiScanBlock = outfitBlueprint?.trim() ? formatAiScanBlock(outfitBlueprint) : '';
  return buildCloseUpBasePrompts().map((prompt) => prompt + aiScanBlock);
};
