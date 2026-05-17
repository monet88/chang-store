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

  const taskPrompt = `TASK: Replace the clothing in the DESTINATION SCENE with the clothing from the SOURCE OUTFIT images, producing a single cohesive photo.

CRITICAL RULES — follow every rule exactly, in priority order:

**A. DESTINATION SCENE IS THE BLUEPRINT**
1. The DESTINATION image defines EVERYTHING about the scene: background, camera angle, perspective, lighting direction, shadows, color temperature, props (hangers, shelves, bags, shoes, toys, furniture), and the exact spatial arrangement / display method of clothing (flat lay, hanging in closet, on hanger, draped on chair, etc.).
2. Replicate the DESTINATION scene pixel-perfectly — same camera distance, same lens distortion, same crop, same ambient lighting. The viewer should feel the output photo was taken in the exact same physical location with the same camera setup.
3. ALL non-clothing elements from the DESTINATION (floor, walls, hangers, accessories, bags, stuffed animals, shoes, magazines, furniture) must remain in their exact original positions and appearance.

**B. SOURCE OUTFIT IS THE ONLY CLOTHING SOURCE**
4. Extract ONLY the clothing garments (shirts, tops, pants, skirts, dresses, jackets, etc.) from the SOURCE OUTFIT images. IGNORE everything else visible in the source photo — do NOT transfer accessories, bags, shoes, hangers, stuffed animals, jewelry, props, furniture, or any non-garment objects from the SOURCE into the output.
5. The extracted clothing MUST be 100% faithful to the SOURCE OUTFIT — exact colors, exact patterns (including pattern scale, repeat, and orientation), exact textures, exact fabric weight and drape characteristics. Copy them with absolute fidelity.
6. ZERO blending: Do NOT blend, average, or mix any visual attribute (color, texture, pattern, silhouette) between the source and destination outfits. The destination outfit's appearance must have ZERO influence on the output clothing.
7. Preserve the source garment's silhouette and construction details (collar style, sleeve length, button placement, pleat depth, waistband style).

**C. PLACEMENT & ARRANGEMENT**
8. Place the source clothing items in the SAME positions, orientations, and arrangement as the clothing in the DESTINATION scene — NOT in the positions from the SOURCE image. The spatial layout follows the DESTINATION.
9. If the source has multiple pieces (e.g., top + bottom), map each piece to the corresponding position in the DESTINATION layout (top garment position → source top, bottom garment position → source bottom).
10. Adapt the fabric folds, creases, and drape of the source clothing to match the display method of the DESTINATION (e.g., if destination shows clothes hanging, show source clothes hanging with natural gravity folds; if flat lay, show source clothes laid flat).
11. Only clothing garments are placed into the scene. All non-clothing props and accessories in the output must come from the DESTINATION scene, never from the SOURCE.

**D. REALISM & CONSISTENCY**
12. Lighting on the replaced clothing must match the DESTINATION scene's lighting — same direction, intensity, color temperature, and shadow behavior.
13. The final image must look like a single real photograph — no compositing artifacts, no edge halos, no inconsistent shadows or perspective mismatches.${extraInstructions ? `\n\n**E. USER INSTRUCTIONS**\n${extraInstructions}` : ''}`;

  parts.push({ text: taskPrompt });

  return parts;
}
