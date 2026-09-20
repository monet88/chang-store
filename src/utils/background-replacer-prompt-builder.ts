/**
 * Background Replacer prompt builder.
 *
 * Pure text builder extracted from `useBackgroundReplacer` so the wording is a
 * single source of truth, testable in isolation, and the hook keeps only state
 * and orchestration. Framing text is resolved by the caller (it depends on the
 * i18n `t` function) and passed in; the builder itself reads no context.
 */

import { formatAiScanBlock } from './ai-scan-blueprint';

export interface BackgroundReplacerPromptInput {
  /** Resolved framing instruction (camera view), already localized. */
  framingInstruction: string;
  /** True when a background source image is supplied (vs text-only). */
  hasBackgroundImage: boolean;
  /** Optional free-text background/modification note. */
  promptText: string;
  /** AI Scan blueprint of the source garments; blank disables the layer. */
  outfitBlueprint?: string;
}

const buildCoreInstruction = (framingInstruction: string): string => `
      **Task**: Perform a photorealistic background replacement for a fashion photograph.
      **Subject Image**: Contains the model to be isolated.
      **Background Source**: The new environment into which the subject will be placed.
      **Instructions for Integration**:
      1. **Subject Isolation**: From the Subject Image, isolate only the main person. Remove all other people or objects.
      2. **Preserve Subject Integrity**: CRITICAL RULE. Do not alter the subject in any way. Preserve body proportions, facial features, pose, and clothing details.
      3. **Seamless Masking**: Perform a perfect, high-quality cutout. No halos, rough edges, or leftover background artifacts.
      4. **Lighting and Shadow Harmony**: Match lighting, add shadows, and apply consistent color grading.
      5. **Perspective and Proportion**: Scale the subject naturally to match the environment.
      6. **Framing**: ${framingInstruction}
      **Goal**: A high-resolution, photorealistic image where the subject is seamlessly integrated into the new background.
    `;

/**
 * Compose the background-replacement prompt. When a background image is present
 * it becomes the source (with an optional modification note); otherwise the
 * background is generated from `promptText`.
 */
export const buildBackgroundReplacementPrompt = ({
  framingInstruction,
  hasBackgroundImage,
  promptText,
  outfitBlueprint,
}: BackgroundReplacerPromptInput): string => {
  const coreInstruction = buildCoreInstruction(framingInstruction);
  // Trim so whitespace-only input is treated as "no note" (matches the other
  // prompt builders) instead of interpolating blank text into the prompt.
  const trimmedPrompt = promptText.trim();
  // The subject photo carries the outfit being preserved, so the blueprint
  // rides along as a subordinate spec reinforcing rule 2.
  const blueprintBlock = formatAiScanBlock(outfitBlueprint);

  if (hasBackgroundImage) {
    if (trimmedPrompt) {
      return `${coreInstruction}\n**Background Source**: Replace with the provided Background Source image.\n**Modification**: Also apply: "${trimmedPrompt}".${blueprintBlock}`;
    }
    return `${coreInstruction}\n**Background Source**: Replace with the provided Background Source image.${blueprintBlock}`;
  }

  return `${coreInstruction}\n**Background Source**: Generate a new photorealistic background: "${trimmedPrompt}".${blueprintBlock}`;
};
