import type { Part } from '@google/genai';
import { ImageFile } from '../types';
import { imagePart } from './promptFormat';

export const TASK_PROMPT = `TASK:
Generate a seamless, square, tileable textile pattern repeat unit from the reference image(s).

PRIMARY GOAL:
Extract only the repeating surface design printed on the fabric: motifs, colors, linework, texture, background color, spacing, and artistic style.

CRITICAL REQUIREMENTS:

1. PATTERN ONLY — NO GARMENT STRUCTURE
Completely ignore and remove all garment construction details, including buttons, zippers, collars, sleeves, seams, hems, pockets, wrinkles, fabric folds, stitching, shadows, labels, and any clothing silhouette. The output must not look like a garment or fabric draped on a body.

2. IGNORE NON-PATTERN ELEMENTS
Discard all background, models, mannequins, hangers, floors, chairs, hands, props, lighting effects, and scene context. Do not include any non-textile objects.

3. PERFECT FLAT 2D TILE
Create a flat, top-down, orthographic 2D textile repeat unit. The image must tile seamlessly in all directions. Left/right and top/bottom edges must align perfectly. Any motif crossing one edge must continue naturally on the opposite edge. No visible seams, borders, frames, or edge artifacts.

4. STYLE, COLOR, AND TEXTURE FIDELITY
Match the original fabric print as closely as possible:
- same artistic style
- same line quality
- same level of detail
- same color palette
- same background color
- same texture character

5. MOTIF SCALE FIDELITY
Preserve the motif size and proportions relative to the visible fabric as closely as possible. Do not unnecessarily shrink, enlarge, simplify, or densely repack the motifs.

6. SPACING AND DENSITY
Maintain the spacing and density of the original pattern. If the source has widely spaced motifs, keep generous negative space. If the source is dense, keep it dense. Do not crowd sparse patterns or over-simplify dense ones.

7. OUTPUT FORMAT
Output a square 1:1 image containing only the seamless pattern repeat unit. No mockup, no perspective, no shadows, no fabric folds, no text, no watermark, no logo.

8. FALLBACK
If the reference fabric has no clear printed motif, generate a flat seamless textile texture using the dominant fabric color, weave/texture impression, and subtle surface variation from the reference, without inventing unrelated motifs.`;

export const TEXT_ONLY_TASK_PROMPT = `TASK:
Generate a seamless, square, tileable textile pattern repeat unit from the user's text prompt.

PRIMARY GOAL:
Create only the repeating textile surface design described by the prompt: motifs, colors, linework, texture, background color, spacing, and artistic style.

CRITICAL REQUIREMENTS:

1. PATTERN ONLY — NO GARMENT STRUCTURE
Do not include garment construction details, including buttons, zippers, collars, sleeves, seams, hems, pockets, wrinkles, fabric folds, stitching, shadows, labels, or any clothing silhouette. The output must not look like a garment or fabric draped on a body.

2. NO SCENE OR NON-PATTERN ELEMENTS
Do not include models, mannequins, hangers, floors, chairs, hands, props, lighting effects, scene context, or any non-textile objects.

3. PERFECT FLAT 2D TILE
Create a flat, top-down, orthographic 2D textile repeat unit. The image must tile seamlessly in all directions. Left/right and top/bottom edges must align perfectly. Any motif crossing one edge must continue naturally on the opposite edge. No visible seams, borders, frames, or edge artifacts.

4. STYLE, COLOR, AND TEXTURE FIDELITY
Follow the requested textile style, color palette, line quality, detail level, background color, and texture character as closely as possible.

5. MOTIF SCALE, SPACING, AND DENSITY
Use motif sizes, proportions, spacing, and density that match the user's prompt. Keep sparse patterns spacious with generous negative space, and keep dense patterns dense.

6. OUTPUT FORMAT
Output a square 1:1 image containing only the seamless pattern repeat unit. No mockup, no perspective, no shadows, no fabric folds, no text, no watermark, no logo.

7. FALLBACK
If the prompt does not describe a clear printed motif, generate a flat seamless textile texture using the requested or inferred fabric color, weave/texture impression, and subtle surface variation, without inventing unrelated motifs.`;

export const REFINE_CORRECTION = `\n\nIMPORTANT: Maintain the exact same tile size, seamless repeat structure, and overall color palette unless explicitly instructed to change them. Only apply the specific modification requested above.`;

export function buildPatternGeneratorParts(
  referenceImages: ImageFile[],
  taskPrompt: string = TASK_PROMPT,
): Part[] {
  const parts: Part[] = [];

  referenceImages.forEach((image, index) => {
    parts.push({ text: `REFERENCE IMAGE ${index + 1}:` });
    parts.push(imagePart(image));
  });

  parts.push({ text: taskPrompt });

  return parts;
}
