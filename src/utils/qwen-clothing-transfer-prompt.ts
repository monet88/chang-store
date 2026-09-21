/**
 * Qwen Clothing Transfer prompt policy.
 * Owns Qwen-specific prompt wording, reference image ordering (destination first, then clothing references),
 * textile/blueprint details, and local generation constraints.
 */

import type { Part } from '@google/genai';
import { imagePart } from './imagePart';
import { formatAiScanBlock, parseOutfitBlueprint } from './ai-scan-blueprint';
import type { ClothingTransferReferenceInput } from './clothing-transfer-prompt-types';
import { formatGarmentScope, formatGarmentScopeSelection } from './clothing-transfer-prompt-types';
import { isTuckingAllowed, UNTUCKED_DRAPE_INSTRUCTION } from './outfitDrapePolicy';
import type { AspectRatio, GarmentScope, ImageFile, ImageResolution } from '../types';
import type { DisplayTemplate } from '../config/displayTemplates';
import type { BrandModelProfile } from '../config/brandModelRoster';

const buildQwenClothingTransferPromptText = (
  references: ClothingTransferReferenceInput[],
  extraInstructions: string = '',
  outfitBlueprint: string = '',
): string => {
  const parsedBlueprint = parseOutfitBlueprint(outfitBlueprint);
  const tuckingAllowed = isTuckingAllowed(extraInstructions);

  const sections: string[] = [];

  sections.push(
    'QWEN CLOTHING TRANSFER SPECIFICATION\n' +
    'TASK: Replace clothing in the DESTINATION SCENE (image_1) with the clothing from the SOURCE OUTFIT references (image_2..N). Produce a single cohesive, photo-realistic image with clean garment transfer, preserving silhouette, anatomical realism, and environmental lighting coherence.',
  );

  // Reference roles mapping: image_1 is destination, image_2..N are source outfits
  const referenceLines = [
    'REFERENCE ROLES:',
    '- image_1: DESTINATION SCENE. Defines entire environment, background, lighting, camera angle, perspective, framing, surfaces, display method (mannequin, hanger, flat lay, or human model), and any destination subject person (faithfully preserve face, identity, hair, skin tone, body proportions, and pose).',
    ...references.map((ref, index) => {
      const imgId = `image_${index + 2}`;
      const label = ref.label?.trim() || 'auto-detect clothing type';
      return `- ${imgId}: SOURCE OUTFIT ${index + 1}. Extract clothing item (${label}). Transfer garment design, silhouette, construction, color, pattern, and fabric weave.`;
    }),
  ];
  sections.push(referenceLines.join('\n'));

  // Garment transfer & textile fidelity
  const garmentRules = [
    'GARMENT TRANSFER & TEXTILE FIDELITY:',
    'Extract ONLY fashion garments from each SOURCE OUTFIT reference. Do not transfer any source person identity, face, body, or pose.',
    'Do not transfer any source background, furniture, hangers, shoes, bags, or non-garment props.',
    'Faithfully reproduce garment silhouette, structural construction, collar style, sleeve cut, waistband, seams, closures, buttons, hardware, pattern scale, and logos.',
    'For two-piece sets or layered outfits, preserve authentic construction (tiers, flounces, pleats, ruffles) and visible hemline finishing (lace borders, scalloped trims, sheer mesh, fringes).',
    'Adapt garment drape realistically to destination geometry: natural gravity drape for hanging clothes, flat spread for flat lay, anatomical fit and body folds when worn by a person.',
    'Preserve authentic 3D garment volume and flared silhouette rather than flattening against the destination subject.',
    tuckingAllowed
      ? 'Tuck styling allowed as specified by user instructions.'
      : UNTUCKED_DRAPE_INSTRUCTION,
    'Zero blending: completely replace destination clothing with zero residual visual attributes, old colors, or silhouette remnants from the previous clothing.',
    "Match the DESTINATION scene's light direction, intensity, color temperature, contact shadows, and occlusion for seamless photorealism.",
  ];
  sections.push(garmentRules.join('\n'));

  // Blueprint details if present
  if (outfitBlueprint) {
    const formattedBlock = formatAiScanBlock(outfitBlueprint).trim();
    if (formattedBlock) {
      sections.push(formattedBlock);
    }
  }

  // Prohibitions
  const prohibitions = [
    'PROHIBITIONS:',
    "Do not alter the destination subject's identity, face, expression, or body proportions if a person is present.",
    'Do not leak source background, surfaces, or non-garment elements into the destination scene.',
    'No compositing artifacts, edge halos, blurred boundaries, or mismatched lighting/shadows.',
    'No synthetic CGI gloss, unrealistic textures, or distorted patterns.',
    ...(parsedBlueprint.detectedAccessories.length > 0
      ? [`Do not transfer non-clothing accessories from clothing references: ${parsedBlueprint.detectedAccessories.join(', ')}.`]
      : []),
  ];
  sections.push(prohibitions.join('\n'));

  if (extraInstructions?.trim()) {
    sections.push(`USER INSTRUCTIONS: ${extraInstructions.trim()}`);
  }

  return sections.join('\n\n');
};

/**
 * Builds the interleaved parts for Qwen Clothing Transfer.
 * Guarantees deterministic reference ordering:
 * - image_1: destination / concept scene
 * - image_2..N: source clothing references in feature-defined order
 */
export function buildQwenClothingTransferParts(
  conceptImage: ImageFile,
  references: ClothingTransferReferenceInput[],
  extraInstructions: string = '',
  outfitBlueprint: string = '',
): Part[] {
  if (!conceptImage?.base64 || !conceptImage?.mimeType) {
    throw new Error('conceptImage is required');
  }
  if (!references || references.length === 0) {
    throw new Error('references must contain at least one item');
  }
  references.forEach((ref, index) => {
    if (!ref.image?.base64 || !ref.image?.mimeType) {
      throw new Error(`references[${index}] must contain a valid image`);
    }
  });

  const promptText = buildQwenClothingTransferPromptText(
    references,
    extraInstructions,
    outfitBlueprint,
  );

  return [
    { text: promptText },
    imagePart(conceptImage),
    ...references.map((ref) => imagePart(ref.image)),
  ];
}

/**
 * Builds the interleaved parts for Qwen Product Staging.
 * Guarantees deterministic reference ordering:
 * - image_1: source outfit
 * - image_2: staging reference (if image template provided)
 */
export function buildQwenProductStagingParts(
  sourceImage: ImageFile,
  template: DisplayTemplate,
  scope: GarmentScope,
  extraInstructions: string = '',
  outfitBlueprint: string = '',
  aspectRatio: AspectRatio = '3:4',
  resolution: ImageResolution = '1K',
): Part[] {
  if (!sourceImage?.base64 || !sourceImage?.mimeType) {
    throw new Error('sourceImage is required');
  }

  const scopeDesc = formatGarmentScope(scope);
  const hasStagingImage = Boolean(template.image?.base64 && template.image?.mimeType);
  const stagingSpec = hasStagingImage
    ? `Display the extracted garment realistically hanging, laid out, or staged matching the EXACT setting, hanger, surface, and lighting visible in the STAGING REFERENCE (image_2).${template.prompt ? ` ${template.prompt}` : ''}`
    : template.prompt;
  const stagingTarget = hasStagingImage ? 'STAGING REFERENCE (image_2)' : 'staging specification';

  const parsedBlueprint = parseOutfitBlueprint(outfitBlueprint);

  const sections: string[] = [];

  sections.push(
    'QWEN PRODUCT STAGING SPECIFICATION\n' +
    `TASK: Extract the ${scopeDesc} from the SOURCE OUTFIT (image_1) and render as a professional standalone commercial e-commerce product photo staged according to ${stagingTarget}.\n` +
    `CANVAS CONTRACT: ${aspectRatio} aspect ratio (${resolution}), clean catalog framing, centered garment presentation with balanced negative space.\n` +
    `STAGING SPECIFICATION: ${stagingSpec}`,
  );

  const referenceLines = [
    'REFERENCE ROLES:',
    `- image_1: SOURCE OUTFIT. Authority for garment design, cut, textile weave, pattern, and color of the ${scopeDesc}.`,
    ...(hasStagingImage ? ['- image_2: STAGING REFERENCE. Authority for display method, hanger, surface, setting, and lighting.'] : []),
  ];
  sections.push(referenceLines.join('\n'));

  const spatialAndStructural = [
    'DYNAMIC SPATIAL ARRANGEMENT & STRUCTURAL FIDELITY:',
    'When the source outfit contains multiple pieces (e.g. top and bottom, two-piece set), separate components naturally:',
    '  * Upper garments hang naturally from the primary upper hanger.',
    '  * Lower garments are arranged distinctly on the lower display surface, shelf, or pants hanger.',
    'Maintain clear spatial separation between distinct garments. Do not merge separate garments into a single overlapping piece.',
    'For single-piece garments (such as a dress or jumpsuit), hang the complete garment from the primary hanger.',
    'Faithfully preserve authentic structural construction, fabric weight, drape, silhouette, pleats, tiered ruffles, waistband, and hemline edge finishing (lace, scalloped trims, fringes, cuffs).',
    'Accurately render fabric weave, natural gravity drape, authentic light reflection, and soft realistic contact shadows on the staging surface.',
  ];
  sections.push(spatialAndStructural.join('\n'));

  if (parsedBlueprint.coreGarments || parsedBlueprint.textilePhysics) {
    const blueprintDetails = [
      'GARMENT BLUEPRINT & TEXTILE PHYSICS:',
      parsedBlueprint.coreGarments ? `- Apparel Architecture: ${parsedBlueprint.coreGarments}` : '',
      parsedBlueprint.textilePhysics ? `- Drape & Textile Physics: ${parsedBlueprint.textilePhysics}` : '',
    ].filter(Boolean);
    sections.push(blueprintDetails.join('\n'));
  } else if (outfitBlueprint) {
    const formattedBlock = formatAiScanBlock(outfitBlueprint).trim();
    if (formattedBlock) {
      sections.push(formattedBlock);
    }
  }

  const exclusions = [
    'STRICT INVARIANTS & EXCLUSIONS:',
    'Completely remove any person from the scene. The final image must contain ZERO human beings or mannequins; show ONLY the clothing item cleanly arranged or hung.',
    'No human models, heads, faces, arms, legs, or body parts in the scene.',
    'No cluttered background props or unrelated furniture.',
    'Clean typography and collar/hemline geometry.',
    'No altered colors, distorted patterns, or synthetic CGI gloss.',
    ...(parsedBlueprint.detectedAccessories.length > 0
      ? [`Exclude detected accessories: ${parsedBlueprint.detectedAccessories.join(', ')}.`]
      : []),
  ];
  sections.push(exclusions.join('\n'));

  if (extraInstructions?.trim()) {
    sections.push(`USER INSTRUCTIONS: ${extraInstructions.trim()}`);
  }

  const promptText = sections.join('\n\n');

  return [
    { text: promptText },
    imagePart(sourceImage),
    ...(hasStagingImage && template.image ? [imagePart(template.image)] : []),
  ];
}

/**
 * Builds the interleaved parts for Qwen Brand Model dressing.
 * Guarantees deterministic reference ordering:
 * - image_1: destination photo (source outfit image)
 * - image_2: brand model face
 * - image_3: brand model body (if provided)
 */
export function buildQwenBrandModelParts(
  sourceImage: ImageFile,
  model: BrandModelProfile,
  extraInstructions: string = '',
  outfitBlueprint: string = '',
  garmentScopes: GarmentScope[] = ['full-set'],
): Part[] {
  if (!sourceImage?.base64 || !sourceImage?.mimeType) {
    throw new Error('sourceImage is required');
  }

  if (!model.faceImage?.base64 || !model.faceImage?.mimeType) {
    return [imagePart(sourceImage), { text: 'Preserve destination image.' }];
  }

  const hasBodyImage = Boolean(model.bodyImage?.base64 && model.bodyImage?.mimeType);
  const parsedBlueprint = parseOutfitBlueprint(outfitBlueprint);
  const scopeDescription = formatGarmentScopeSelection(garmentScopes);
  const isFullSet = garmentScopes.includes('full-set');

  const sections: string[] = [];

  sections.push(
    'QWEN BRAND MODEL SPECIFICATION\n' +
    `TASK: Transfer the facial identity, expression, and morphological aesthetics of BRAND MODEL (${model.name}) onto the DESTINATION PHOTO (image_1). Strictly preserve the original outfit (${scopeDescription}), pose, hand placement, background environment, and lighting.`,
  );

  const referenceLines = [
    'REFERENCE ROLES:',
    '- image_1: DESTINATION PHOTO. 100% frozen authority for the outfit, body pose, stance, hand placement, background room, and lighting.',
    `- image_2: BRAND MODEL FACE (${model.name}). Sole authority for facial features, eyes, nose, lips, jawline, skin tone, facial bone structure, and hairstyle aesthetics.`,
    ...(hasBodyImage ? [`- image_3: BRAND MODEL BODY (${model.name}). Reference for body morphology, proportions, and skin tone.`] : []),
  ];
  sections.push(referenceLines.join('\n'));

  const lockedElements = [
    'LOCKED ELEMENTS & IDENTITY TRANSFER:',
    `1. GARMENT LOCK: 100% FROZEN for ${scopeDescription}. Preserve the exact garment design, fabric weave, colors, patterns, fit, creases, and drape from image_1.`,
    ...(!isFullSet ? [`Unselected source clothing outside [${scopeDescription}] may be adapted or harmonized with the brand model.`] : []),
    '2. ENVIRONMENT & POSE LOCK: 100% FROZEN. The background scene, walls, furniture, props, lighting angle, perspective, and camera distance must remain identical to image_1.',
    '3. POSE & HANDS LOCK: Maintain the exact body stance, limb positioning, head angle, gesture, and hand positions from image_1. Do not hide hands or alter gestures.',
    `4. FACIAL IDENTITY: Replace the face in image_1 with the brand model face from image_2 (${model.name}). Faithfully render ${model.name}'s facial bone structure, eyes, nose, lips, facial proportions, skin tone, and hairstyle while matching the facial expression, gaze direction, and lighting from image_1.`,
  ];
  if (model.metadata) {
    lockedElements.push(
      `Brand model aesthetics: Age ~${model.metadata.age}, height ${model.metadata.height}, body type ${model.metadata.bodyType}, skin tone ${model.metadata.skinTone}, features ${model.metadata.facialFeatures}, vibe ${model.metadata.styleVibe}.`,
    );
  }
  sections.push(lockedElements.join('\n'));

  if (outfitBlueprint) {
    const formattedBlock = formatAiScanBlock(outfitBlueprint).trim();
    if (formattedBlock) {
      sections.push(formattedBlock);
    }
  }

  const prohibitions = [
    'PROHIBITIONS:',
    'Do not alter the garment design, colors, patterns, or fabric texture from image_1.',
    'Do not change the background room, lighting direction, or camera perspective from image_1.',
    'Do not retain the original face or facial identity from image_1: the new face must recognizably be the brand model.',
    'No compositing seams around the neck or hairline, no edge halos, and no skin tone mismatches.',
    ...(parsedBlueprint.detectedAccessories.length > 0
      ? [`Exclude detected accessories: ${parsedBlueprint.detectedAccessories.join(', ')}.`]
      : []),
  ];
  sections.push(prohibitions.join('\n'));

  if (extraInstructions?.trim()) {
    sections.push(`USER INSTRUCTIONS: ${extraInstructions.trim()}`);
  }

  const promptText = sections.join('\n\n');

  return [
    { text: promptText },
    imagePart(sourceImage),
    imagePart(model.faceImage),
    ...(hasBodyImage && model.bodyImage ? [imagePart(model.bodyImage)] : []),
  ];
}
