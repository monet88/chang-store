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

  const taskPrompt = `TASK: Replace all clothing in the DESTINATION SCENE with the clothing from the SOURCE OUTFIT images above.

RULES:
- The OUTPUT must use the DESTINATION SCENE's background, layout, camera angle, lighting, and arrangement style.
- The CLOTHING in the output must come from the SOURCE OUTFIT images — preserve their exact colors, patterns, textures, and fabric details.
- Remove existing clothing from the destination scene first, then insert the source outfits.
- Match the display style of the destination (hangers, flat lay, mannequin, closet display, etc.).
- Keep all non-clothing elements from the destination unchanged (props, accessories, background).${extraInstructions ? `\n\nAdditional instructions: ${extraInstructions}` : ''}`;

  parts.push({ text: taskPrompt });

  return parts;
}
