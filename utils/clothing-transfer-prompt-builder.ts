import type { Part } from '@google/genai';
import { ImageFile } from '../types';

interface ClothingTransferReferenceInput {
  image: ImageFile;
  label: string;
}

/**
 * Build interleaved parts for clothing transfer.
 * Structure: [label_concept, img_concept, label_ref1, img_ref1, ..., task_instructions]
 * This ensures Gemini knows exactly which image is the destination vs source.
 */
export function buildClothingTransferParts(
  conceptImage: ImageFile,
  references: ClothingTransferReferenceInput[],
  extraInstructions: string,
): Part[] {
  const parts: Part[] = [];

  parts.push({ text: 'DESTINATION SCENE (keep this background, arrangement and display style):' });
  parts.push({ inlineData: { data: conceptImage.base64, mimeType: conceptImage.mimeType } });

  references.forEach((ref, index) => {
    const label = ref.label || 'auto-detect clothing type';
    parts.push({ text: `SOURCE OUTFIT ${index + 1} (extract this clothing — ${label}):` });
    parts.push({ inlineData: { data: ref.image.base64, mimeType: ref.image.mimeType } });
  });

  const taskPrompt = `TASK: Composite the SOURCE OUTFIT clothing into the DESTINATION SCENE, replacing the existing clothing entirely.

CRITICAL RULES — follow exactly:
1. SCENE ONLY from DESTINATION: Use the DESTINATION image ONLY for its background, setting, camera angle, lighting, props, hangers, and display arrangement. The destination clothing is IRRELEVANT — treat it as if it does not exist.
2. CLOTHING ONLY from SOURCE: The output clothing MUST be 100% from the SOURCE OUTFIT images. Copy their exact colors, patterns, textures, fabric drape, and silhouette with zero modification.
3. ZERO blending or mixing: Do NOT blend, average, or mix colors/textures between the source outfit and the destination outfit. The destination outfit's appearance must have absolutely NO influence on the output clothing.
4. Display style: Match how items are displayed in the destination (on hanger, flat lay, mannequin, hanging in closet, etc.).
5. Preserve non-clothing elements: Keep all background elements, props, hangers, and accessories from the destination unchanged.
6. If the SOURCE OUTFIT has multiple pieces (top + bottom), place each in the same relative positions as in the SOURCE OUTFIT.${extraInstructions ? `\n\nAdditional instructions from user: ${extraInstructions}` : ''}`;

  parts.push({ text: taskPrompt });

  return parts;
}
