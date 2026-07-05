/**
 * AI Editor prompt builders.
 *
 * Pure text builders extracted from `useAIEditor` so the instruction wording is
 * a single source of truth, testable in isolation, and the hook keeps only
 * state, mention resolution, and orchestration.
 */

/** Single-image / no-mention edit instruction. */
export const buildSingleImageEditPrompt = (userPrompt: string): string =>
  `# INSTRUCTION: IMAGE EDITING

## USER REQUEST:
${userPrompt}

## OUTPUT:
Return the edited image as the final result.`;

/**
 * Multi-image edit instruction. `imageRoles` maps each sent image to its
 * original `@imgN` mention tag; the caller resolves those tags from the mention
 * text so this builder stays dependency-free.
 */
export const buildMultiImageEditPrompt = (userPrompt: string, imageRoles: string): string =>
  `# INSTRUCTION: MULTI-IMAGE EDITING

## IMAGE ROLES:
${imageRoles}

## USER REQUEST:
${userPrompt}

## CRITICAL RULES:
1. Analyze all provided images based on the user's request
2. Apply edits as described, using referenced images appropriately
3. Maintain image quality and natural appearance

## OUTPUT:
Return the final edited image.`;
