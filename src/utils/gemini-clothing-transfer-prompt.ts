/**
 * Gemini Clothing Transfer prompt policy.
 * Owns Gemini-specific role framing, garment preservation rules, and the
 * interleaved role/image/task sequence for Clothing Transfer workflows.
 */

import type { Part } from '@google/genai';
import type { GarmentScope, ImageFile } from '../types';
import type { BrandModelProfile } from '../config/brandModelRoster';
import type { DisplayTemplate } from '../config/displayTemplates';
import { imagePart } from './promptFormat';
import {
  formatAiScanBlock,
  formatGeminiBlueprintBlock,
  parseOutfitBlueprint,
} from './ai-scan-blueprint';
import {
  formatGarmentScope,
  type ClothingTransferReferenceInput,
} from './clothing-transfer-prompt-types';

const destinationRoleLabel = 'DESTINATION SCENE (owns background, scene composition, lighting, display method, and any subject person)';

const AVOID_BULLETS = [
  'No leaking source background, furniture, hangers, accessories, or props into the scene.',
  'No transferring source model identity, face, hair, skin, or pose.',
  'No blending or residual visual attributes from the replaced destination clothing.',
  "No altering the destination scene's background, camera perspective, lighting geometry, or destination person identity.",
  'No compositing artifacts, edge halos, mismatched shadows, or perspective discrepancies.',
] as const;

const sourceOutfitRoleLabel = (index: number, label: string): string =>
  `SOURCE OUTFIT ${index + 1} (extract this clothing — ${label})`;

/**
 * Build the interleaved Part[] for a Gemini Clothing Transfer job.
 *
 * Structure: [label_concept, img_concept, label_ref1, img_ref1, ..., task_instructions]
 * Establishes a clear ownership model: destination owns scene/composition/display/person,
 * while source references own garment design and construction only.
 */
export function buildGeminiClothingTransferParts(
  conceptImage: ImageFile,
  references: ClothingTransferReferenceInput[],
  extraInstructions: string,
  outfitBlueprint: string = '',
): Part[] {
  const roles = [
    { label: destinationRoleLabel, image: conceptImage },
    ...references.map((ref, index) => ({
      label: sourceOutfitRoleLabel(index, ref.label?.trim() || 'auto-detect clothing type'),
      image: ref.image,
    })),
  ];

  const avoidBlock = AVOID_BULLETS.map((bullet) => `- ${bullet}`).join('\n');
  const blueprintBlock = formatGeminiBlueprintBlock(outfitBlueprint);

  const taskPrompt = `TASK: Replace the clothing in the DESTINATION SCENE with the clothing from the SOURCE OUTFIT images, producing a single cohesive photo.${blueprintBlock}
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
- Bottom garment & structural fidelity: For two-piece sets or layered outfits, faithfully extract each garment component (such as tops, bottoms, skirts, pants, shorts, or skorts). For bottom garments, preserve their authentic silhouette, structural construction (such as tiers, flounces, pleats, or ruffles), and all visible hemline edge finishing (such as lace borders, scalloped trims, sheer mesh bands, raw edges, fringes, or cuffs). Never simplify or collapse the bottom garment into a generic shape.
PLACEMENT & PHYSICAL INTEGRATION:
- Map each source garment to its corresponding location in the DESTINATION arrangement (e.g. source top to destination top position, source bottom to destination bottom position).
- Adapt the garment drape to the DESTINATION display method: natural gravity drape for hanging clothes, natural spread and realistic folds for flat lays, and natural anatomical fit and body folds when worn by a person.
- Preserve 3D garment silhouette: For voluminous, peplum, ruffled, or flared garments, preserve their authentic full 3D volume, flared drape, and silhouette rather than flattening or compressing them against the destination subject.
- Maintain accessory & object boundaries: If the destination subject holds a phone, camera, or bag, the hands and held objects remain in the foreground in front of the clothing, with clean occlusion edges and zero texture smearing or blending artifacts.
- Zero blending: completely replace the destination clothing without retaining old colors, silhouettes, or pattern remnants. Replaced clothing areas must have zero visual influence from the old garment.
- Lighting and contact: match the DESTINATION scene's light direction, intensity, color temperature, contact shadows, and occlusion so the transferred garment integrates believably as a single photograph.${extraInstructions.trim() ? `\n\nUSER INSTRUCTIONS:\n${extraInstructions.trim()}` : ''}

AVOID:
${avoidBlock}`;

  const parts: Part[] = [];
  roles.forEach((role) => {
    parts.push({ text: `${role.label}:` });
    parts.push(imagePart(role.image));
  });
  parts.push({ text: taskPrompt });

  return parts;
}

/**
 * Build Gemini prompt parts for Product Staging (Hanger or Flat Lay via text template).
 */
export function buildGeminiProductStagingParts(
  sourceImage: ImageFile,
  template: DisplayTemplate,
  scope: GarmentScope,
  extraInstructions: string = '',
  outfitBlueprint: string = '',
): Part[] {
  const scopeDesc = formatGarmentScope(scope);
  const hasStagingImage = Boolean(template.image);
  const stagingSpec = hasStagingImage
    ? `Display the extracted garment realistically hanging, laid out, or staged matching the EXACT setting, hanger, surface, and lighting visible in the STAGING REFERENCE image.${template.prompt ? ` ${template.prompt}` : ''}`
    : template.prompt;
  const parsedBlueprint = parseOutfitBlueprint(outfitBlueprint);

  const layer1 = `LAYER 1: TASK & CANVAS
- TASK: Extract the ${scopeDesc} from the SOURCE OUTFIT image and render it as a professional standalone commercial e-commerce product photo staged into the STAGING REFERENCE setting.
- CANVAS CONTRACT: 3:4 portrait aspect ratio, clean catalog framing, centered garment presentation with balanced negative space.
- STAGING SPECIFICATION:
${stagingSpec}`;

  const layer2 = `LAYER 2: DYNAMIC SPATIAL ARRANGEMENT
1. MULTI-PIECE OUTFIT DECOMPOSITION & SPATIAL SEPARATION:
- When the SOURCE OUTFIT contains multiple pieces (e.g. top and bottom, two-piece set, layered garments) and the STAGING REFERENCE displays separated items (such as an upper hanging area and a lower counter, shelf, or surface):
- Distribute and stage each garment component according to the staging reference layout:
  * Upper garments (blouses, shirts, jackets, tops) hang naturally from the primary upper hanger.
  * Lower garments (skirts, skorts, pants, shorts) are arranged distinctly on the lower display surface, shelf, or pants hanger.
- Maintain clear spatial separation between distinct garments as shown in the staging reference. Do NOT merge separated garments into a single overlapping piece.
- For single-piece garments (such as a one-piece dress or jumpsuit), hang the complete garment from the primary hanger.
2. STRUCTURAL AND EDGE FIDELITY (ALL GARMENTS):
- Faithfully preserve each garment's authentic structural construction, fabric weight, drape, and silhouette.
- For bottom garments (skirts, skorts, pants, shorts): Accurately reproduce all structural layers, pleats, tiered ruffles, waistband details, and especially the exact hemline finishing (such as lace borders, scalloped trims, sheer mesh bands, fringes, or cuffs) visible in the source photo.
- Accurately render fabric drape, natural gravity folds, and soft realistic contact shadows on the staging surface.
- Preserve the exact staging surface, background cabinetry, hanger types, lighting, and ambient props from the STAGING REFERENCE.`;

  const layer3 = `LAYER 3: GARMENT BLUEPRINT
${parsedBlueprint.coreGarments ? `- Core Garments & Cut Architecture: ${parsedBlueprint.coreGarments}` : `- Authentic Garment Extraction: Extract the exact design, silhouette, collar style, sleeve cut, and construction of the ${scopeDesc}.`}`;
  const layer4 = `LAYER 4: TEXTILE PHYSICS
${parsedBlueprint.textilePhysics ? `- Textile Weave & Drape Physics: ${parsedBlueprint.textilePhysics}` : `- Fabric & Physics: Accurately render fabric weave, material texture, authentic light reflection, natural gravity drape, and soft contact shadows without synthetic CGI gloss.`}`;

  const accessoriesExclusion = parsedBlueprint.detectedAccessories.length > 0
    ? `- Exclude detected accessories: ${parsedBlueprint.detectedAccessories.join(', ')}.\n`
    : '';

  const userInstructions = extraInstructions.trim()
    ? `\nUSER INSTRUCTIONS:\n${extraInstructions.trim()}\n`
    : '';

  const layer5 = `LAYER 5: INVARIANTS & EXCLUSIONS
- Completely remove any person from the scene. The final image must contain ZERO human beings or mannequins; show ONLY the clothing item cleanly arranged or hung.
- No human models, heads, faces, arms, legs, or body parts in the scene.
- No merging separated garments into a single piece when staging references show distinct items.
- No cluttered background props or unrelated furniture.
- Clean typography and collar geometry, crisp edge finishing.
${accessoriesExclusion}- No altered colors, distorted patterns, or synthetic CGI gloss.${userInstructions}`;

  const taskPrompt = `${layer1}\n\n${layer2}\n\n${layer3}\n\n${layer4}\n\n${layer5}`;

  const parts: Part[] = [
    { text: `SOURCE OUTFIT (extract ${scopeDesc}):` },
    imagePart(sourceImage),
  ];
  if (template.image) {
    parts.push({ text: 'STAGING REFERENCE (target surface or hanger):' });
    parts.push(imagePart(template.image));
  }
  parts.push({ text: taskPrompt });
  return parts;
}

/**
 * Build Gemini prompt parts for dressing a Brand Model (Linh, Mai, Custom) in the outfit photo.
 * Preserves the exact pose, expression, gesture, outfit, lighting, and scene from the source photo,
 * transferring the face identity and body morphology of the selected brand model.
 */
export function buildGeminiBrandModelParts(
  sourceImage: ImageFile,
  model: BrandModelProfile,
  extraInstructions: string = '',
  outfitBlueprint: string = '',
): Part[] {
  if (!model.faceImage) {
    return [imagePart(sourceImage), { text: 'Preserve destination image.' }];
  }

  const parsedBlueprint = parseOutfitBlueprint(outfitBlueprint);
  const blueprintBlock = formatAiScanBlock(outfitBlueprint);

  const roles = [
    {
      label: 'DESTINATION PHOTO (Preserve this exact outfit, body pose, hand placement, background room, and lighting):',
      image: sourceImage,
    },
    {
      label: `BRAND MODEL FACE (${model.name} - Authority for facial identity, eyes, nose, lips, facial bone structure, hairstyle, and beauty aesthetics):`,
      image: model.faceImage,
    },
  ];

  if (model.bodyImage) {
    roles.push({
      label: `BRAND MODEL BODY (${model.name} - Authority for body morphology, build, silhouette, and proportions):`,
      image: model.bodyImage,
    });
  }

  const taskPrompt = `TASK: Replace the model's head and face in the DESTINATION PHOTO with the BRAND MODEL (${model.name}), producing a high-end fashion catalog photo.${blueprintBlock}
CRITICAL INSTRUCTIONS:
1. FACE REPLACEMENT & IDENTITY TRANSFER:
- Replace the face and head in the DESTINATION PHOTO so it is unmistakably the BRAND MODEL (${model.name}) shown in the reference photo.
- The face must clearly adopt ${model.name}'s distinctive features: eye shape and gaze, delicate nose contour, lip shape, and signature facial beauty aesthetics (${model.metadata.facialFeatures || ''}).
- Do NOT retain the original facial features or expression of the woman in the DESTINATION PHOTO. Her face must be completely replaced by ${model.name}.
- Seamlessly blend ${model.name}'s head onto the body matching the photographed head angle, gaze direction, and natural lighting of the scene.
${model.bodyImage ? `- Reshape body morphology and proportions to match the BRAND MODEL BODY reference (${model.metadata.bodyType || 'slender feminine build'}).` : ''}

2. OUTFIT, POSE & SCENE PRESERVATION (100%):
- Preserve the exact clothing down to the smallest detail: colors, fabric textures, seams, ties, lace patterns, and hemlines.
- Preserve the exact body pose, stance, hand placement, and gesture from the DESTINATION PHOTO.
- Preserve the entire background scene, camera perspective, lighting geometry, and ambiance.${extraInstructions.trim() ? `\n\nUSER INSTRUCTIONS:\n${extraInstructions.trim()}` : ''}

AVOID:
- No keeping the original person's face or facial features.
- No altering the clothing design, fabric textures, or color.
- No altering the background scene, furniture, or camera perspective.
${parsedBlueprint.detectedAccessories.length > 0 ? `- Exclude detected accessories: ${parsedBlueprint.detectedAccessories.join(', ')}.` : ''}`;

  const parts: Part[] = [];
  roles.forEach((r) => {
    parts.push({ text: r.label });
    parts.push(imagePart(r.image));
  });
  parts.push({ text: taskPrompt });
  return parts;
}
