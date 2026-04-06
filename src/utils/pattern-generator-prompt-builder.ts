import type { Part } from '@google/genai';
import { ImageFile } from '../types';

export const TASK_PROMPT = `TASK: Generate a seamless tileable textile pattern based on the reference image(s) above.

REQUIREMENTS:
1. The pattern MUST tile seamlessly — edges must match perfectly when repeated in all directions.
2. Output as a square image (1:1 aspect ratio).
3. Preserve the color palette, motifs, and design language from the reference image(s).
4. The pattern should be suitable for fabric or surface design use.
5. Do NOT include any garment silhouettes, models, or non-pattern elements in the output.
6. High resolution and crisp detail throughout.`;

export const REFINE_CORRECTION = `\n\nIMPORTANT: Maintain the exact same tile size, seamless repeat structure, and overall color palette unless explicitly instructed to change them. Only apply the specific modification requested above.`;

export function buildPatternGeneratorParts(
  referenceImages: ImageFile[],
  taskPrompt: string = TASK_PROMPT,
): Part[] {
  const parts: Part[] = [];

  referenceImages.forEach((image, index) => {
    parts.push({ text: `REFERENCE IMAGE ${index + 1}:` });
    parts.push({ inlineData: { data: image.base64, mimeType: image.mimeType } });
  });

  parts.push({ text: taskPrompt });

  return parts;
}
