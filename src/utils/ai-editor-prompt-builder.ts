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
2. Change nothing else: no restyling, no reframing, no added or removed objects or people, no beauty retouching.
3. Reproduce text, logos, labels, and watermarks already in the image exactly as they appear. Never invent new ones, and never garble existing ones.

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

## EDIT RULES:
1. Apply the request in the role order listed above, using each referenced image for the role it is given.
2. Apply only the change the request names. Keep subject identity, pose, framing, crop, lighting, colours, and background exactly as they are unless the request asks for them.
3. Integrate the referenced content as one photograph: matching light direction, colour temperature, perspective, and contact shadows. No cut-out edges, halos, double outlines, or duplicated subjects.
4. Reproduce text, logos, labels, and watermarks already in the image exactly as they appear. Never invent new ones.

## OUTPUT:
Return the final edited image as the single result.`;
