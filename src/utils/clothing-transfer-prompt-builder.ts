import type { Part } from '@google/genai';
import { ImageFile } from '../types';
import type { PromptFormat } from './promptFormat';
import { dropRestatedLines, imagePart } from './promptFormat';

export interface ClothingTransferReferenceInput {
  image: ImageFile;
  label: string;
}
const destinationRoleLabel = 'DESTINATION SCENE (owns background, scene composition, lighting, display method, and any subject person)';

const AVOID_BULLETS = [
  'No leaking source background, furniture, hangers, accessories, or props into the scene.',
  'No transferring source model identity, face, hair, skin, or pose.',
  'No blending or residual visual attributes from the replaced destination clothing.',
  "No altering the destination scene's background, camera perspective, lighting geometry, or destination person identity.",
  'No compositing artifacts, edge halos, mismatched shadows, or perspective discrepancies.',
] as const;

/**
 * Bullets 1-4 restate what `ROLE 1`, `ROLE 2`, and `PLACEMENT` already say in the
 * same prompt. The flat lane drops them because it is read as one block; only
 * the artifact list has no earlier statement, so both lanes keep that one.
 */
const RESTATED_AVOID_BULLETS = AVOID_BULLETS.slice(0, 4);

const sourceOutfitRoleLabel = (index: number, label: string): string =>
  `SOURCE OUTFIT ${index + 1} (extract this clothing — ${label})`;

/**
 * Build the parts for clothing transfer in the requested lane format.
 *
 * Structure (`parts`): [label_concept, img_concept, label_ref1, img_ref1, ..., task_instructions]
 * Structure (`text`): [role-map + task_instructions, img_concept, img_ref1, ...]
 *
 * Establishes a clear ownership model: destination owns scene/composition/display/person,
 * while source references own garment design and construction only.
 */
export function buildClothingTransferParts(
  conceptImage: ImageFile,
  references: ClothingTransferReferenceInput[],
  extraInstructions: string,
  format: PromptFormat = 'parts',
): Part[] {
  const roles = [
    { label: destinationRoleLabel, image: conceptImage },
    ...references.map((ref, index) => ({
      label: sourceOutfitRoleLabel(index, ref.label?.trim() || 'auto-detect clothing type'),
      image: ref.image,
    })),
  ];

  const avoidBlock = AVOID_BULLETS.map((bullet) => `- ${bullet}`).join('\n');
  const avoidSection = format === 'text'
    ? dropRestatedLines(avoidBlock, RESTATED_AVOID_BULLETS)
    : avoidBlock;

  const taskPrompt = `TASK: Replace the clothing in the DESTINATION SCENE with the clothing from the SOURCE OUTFIT images, producing a single cohesive photo.

REFERENCE OWNERSHIP & ROLES:

1. DESTINATION SCENE OWNS THE ENVIRONMENT AND COMPOSITION
- The DESTINATION image defines the entire environment: background, surfaces, walls, camera angle, perspective, framing, color temperature, and ambient lighting.
- The DESTINATION image defines the display method and spatial arrangement of clothing (such as flat lay, hanging in a closet or on a hanger, or worn on a person).
- If the DESTINATION contains a person: preserve that person's identity, face, hair, skin tone, body proportions, facial expression, and overall pose. The destination person wears the transferred clothing.
- All non-clothing elements from the DESTINATION (furniture, hangers, shelves, floor, walls, accessories, bags, shoes, and props) must remain in their original positions and appearance.

2. SOURCE OUTFIT REFERENCES OWN GARMENT DESIGN ONLY
- Extract ONLY fashion garments from each SOURCE OUTFIT image.
- Labeled sources: extract only the specified garment or category indicated by the label.
- Unlabeled sources: extract only clearly visible clothing garments (such as tops, bottoms, dresses, or outerwear).
- Do NOT transfer any source person's identity, face, body, or pose.
- Do NOT transfer any source background, furniture, hangers, shoes, bags, jewelry, or non-garment props into the result.
- Faithfully reproduce the source garment's silhouette, construction, collar style, sleeve length, waistband, seams, closures, buttons, zippers, hardware, colors, materials, textures, pattern scale, pattern orientation, graphics, and visible supported branding.

PLACEMENT & PHYSICAL INTEGRATION:
- Map each source garment to its corresponding location in the DESTINATION arrangement (e.g. source top to destination top position, source bottom to destination bottom position).
- Adapt the garment drape to the DESTINATION display method: natural gravity drape for hanging clothes, natural spread and realistic folds for flat lays, and natural anatomical fit and body folds when worn by a person.
- Zero blending: completely replace the destination clothing without retaining old colors, silhouettes, or pattern remnants. Replaced clothing areas must have zero visual influence from the old garment.
- Lighting and contact: match the DESTINATION scene's light direction, intensity, color temperature, contact shadows, and occlusion so the transferred garment integrates believably as a single photograph.${extraInstructions.trim() ? `\n\nUSER INSTRUCTIONS:\n${extraInstructions.trim()}` : ''}

AVOID:
${avoidSection}`;

  if (format === 'text') {
    const roleMap = roles.map((role, index) => `IMAGE ${index + 1} = ${role.label}`).join('\n');
    return [
      { text: `${roleMap}\n\n${taskPrompt}` },
      ...roles.map((role) => imagePart(role.image)),
    ];
  }

  const parts: Part[] = [];
  roles.forEach((role) => {
    parts.push({ text: `${role.label}:` });
    parts.push(imagePart(role.image));
  });
  parts.push({ text: taskPrompt });

  return parts;
}
