/**
 * AI Editor prompt builders.
 *
 * Pure text builders extracted from `useAIEditor` so the instruction wording is
 * a single source of truth, testable in isolation, and the hook keeps only
 * state, mention resolution, and orchestration.
 *
 * Both lanes send these verbatim, so the wording states the edit invariants the
 * render has to hold: apply only the named change, keep the rest of the frame
 * intact, never invent content or typography.
 */

/** Single-image / no-mention edit instruction. */
export const buildSingleImageEditPrompt = (userPrompt: string): string =>
  `# INSTRUCTION: IMAGE EDITING

## USER REQUEST:
${userPrompt}

## EDIT RULES:
1. Apply only the change the request names. Keep subject identity, pose, framing, crop, lighting, colours, and background exactly as they are unless the request asks for them.
2. Change nothing else: no restyling, no reframing, no added or removed objects or people, and no beauty retouching unless the user request explicitly asks for that change.
3. Reproduce existing text, logos, labels, and watermarks exactly as they appear unless the user request explicitly asks to add, remove, replace, or edit them. Never invent new ones outside the requested edit, and never garble unchanged ones.

## OUTPUT:
Return the edited image as the final result — exactly one image, not a grid, collage, or multi-panel sheet.`;

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

## EDIT RULES:
1. Apply the request in the role order listed above, using each referenced image for the role it is given.
2. Apply only the change the request names. Keep subject identity, pose, framing, crop, lighting, colours, and background exactly as they are unless the request asks for them.
3. Integrate the referenced content as one photograph: matching light direction, colour temperature, perspective, and contact shadows. No cut-out edges, halos, double outlines, or duplicated subjects unless the user request explicitly asks for duplication.
4. Reproduce existing text, logos, labels, and watermarks exactly as they appear unless the user request explicitly asks to add, remove, replace, or edit them. Never invent new ones outside the requested edit, and never garble unchanged ones.

## OUTPUT:
Return the final edited image as the single result — exactly one image, not a grid, collage, or multi-panel sheet.`;

/**
 * Single-image / no-mention edit instruction for Local Qwen.
 *
 * The user's prompt is authoritative; does not silently inject strong identity,
 * pose, framing, or background preservation rules.
 */
export const buildQwenSingleImageEditPrompt = (userPrompt: string): string =>
  `# INSTRUCTION: LOCAL QWEN IMAGE EDITING

## USER REQUEST:
${userPrompt}

## OUTPUT:
Return the edited image as the final result — exactly one image, not a grid, collage, or multi-panel sheet.`;

/**
 * Multi-image edit instruction for Local Qwen.
 *
 * Minimal image-role mapping with user prompt authoritative; does not silently
 * inject strong identity or background preservation rules.
 */
export const buildQwenMultiImageEditPrompt = (userPrompt: string, imageRoles: string): string =>
  `# INSTRUCTION: LOCAL QWEN MULTI-IMAGE EDITING

## IMAGE ROLES:
${imageRoles}

## USER REQUEST:
${userPrompt}

## OUTPUT:
Return the final edited image as the single result — exactly one image, not a grid, collage, or multi-panel sheet.`;

/**
 * Convenience prompt builder for Local Qwen AI Editor.
 */
export const buildQwenAiEditorPrompt = (userPrompt: string, imageRoles?: string): string => {
  if (imageRoles && imageRoles.trim().length > 0) {
    return buildQwenMultiImageEditPrompt(userPrompt, imageRoles);
  }
  return buildQwenSingleImageEditPrompt(userPrompt);
};
