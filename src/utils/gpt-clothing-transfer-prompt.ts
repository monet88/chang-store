/**
 * GPT Image Clothing Transfer prompt policy.
 * Owns GPT-specific indexed image roles, structured config contracts,
 * preservation rules, and exclusions independently from the Gemini policy.
 */

import type { Part } from '@google/genai';
import type { AspectRatio, GarmentScope, ImageFile, ImageResolution } from '../types';
import type { BrandModelProfile } from '../config/brandModelRoster';
import type { DisplayTemplate } from '../config/displayTemplates';
import { imagePart } from './promptFormat';
import {
  formatGptBlueprintConfig,
  parseOutfitBlueprint,
} from './ai-scan-blueprint';
import {
  formatGarmentScope,
  type ClothingTransferReferenceInput,
} from './clothing-transfer-prompt-types';

const destinationRoleLabel = 'DESTINATION SCENE (owns background, scene composition, lighting, display method, and any subject person)';

const sourceOutfitRoleLabel = (index: number, label: string): string =>
  `SOURCE OUTFIT ${index + 1} (extract this clothing — ${label})`;

/**
 * Build the GPT Part[] for a single Clothing Transfer job.
 * Produces a single structured JSON config with positional image roles.
 */
export function buildGptClothingTransferParts(
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

  const roleMap = roles.map((role, index) => `IMAGE ${index + 1} = ${role.label}`).join('\n');
  const parsedBlueprint = parseOutfitBlueprint(outfitBlueprint);
  const config: Record<string, unknown> = {
    TASK: 'Replace the clothing in the DESTINATION SCENE with the clothing from the SOURCE OUTFIT images, producing a single cohesive photo.',
    REFERENCE_OWNERSHIP: {
      destination: 'The DESTINATION image defines the entire environment: background, surfaces, walls, camera angle, perspective, framing, color temperature, ambient lighting, display method, spatial arrangement, and any subject person identity/pose.',
      sources: "SOURCE OUTFIT images own garment design and construction only. Do NOT transfer any source person's identity, face, body, or pose. Do NOT transfer any source background, furniture, hangers, shoes, bags, jewelry, or non-garment props.",
    },
    GARMENT_FIDELITY: [
      'Extract only the labeled garment/category, or clearly visible fashion garments when unlabeled.',
      'Faithfully reproduce silhouette, construction, collar, sleeves, waistband, seams, closures, hardware, colors, materials, textures, pattern scale/orientation, graphics, and supported branding.',
      'For multi-piece outfits preserve every garment component and bottom-garment structure, layers, pleats, ruffles, and hem finishing.',
    ],
    PLACEMENT_AND_INTEGRATION: [
      'Map each source garment to its corresponding location in the DESTINATION arrangement.',
      'Adapt drape to the destination display method with realistic gravity, folds, anatomical fit, contact shadows, and occlusion.',
      'Zero blending: completely replace the destination clothing; no old colors, silhouettes, patterns, or residual visual attributes may remain.',
      'Match destination light direction, intensity, color temperature, contact shadows, camera perspective, and foreground object boundaries.',
    ],
    STRICT_INVARIANTS_AND_EXCLUSIONS: [
      'No compositing artifacts, edge halos, mismatched shadows, or perspective discrepancies.',
      ...parsedBlueprint.detectedAccessories.map((accessory) => `exclude detected accessory: ${accessory}`),
    ],
    ...(parsedBlueprint.raw ? { AI_SCAN_BLUEPRINT: formatGptBlueprintConfig(outfitBlueprint) } : {}),
  };

  if (extraInstructions.trim()) {
    config.USER_INSTRUCTIONS = extraInstructions.trim();
  }

  return [
    { text: `${roleMap}\n\n/* CLOTHING_TRANSFER_CONFIG */\n${JSON.stringify(config, null, 2)}` },
    ...roles.map((role) => imagePart(role.image)),
  ];
}

/**
 * Build GPT prompt parts for Product Staging (Hanger or Flat Lay via text template).
 */
export function buildGptProductStagingParts(
  sourceImage: ImageFile,
  template: DisplayTemplate,
  scope: GarmentScope,
  extraInstructions: string = '',
  outfitBlueprint: string = '',
  aspectRatio: AspectRatio = '3:4',
  resolution: ImageResolution = '1K',
): Part[] {
  const scopeDesc = formatGarmentScope(scope);
  const hasStagingImage = Boolean(template.image);
  const stagingSpec = hasStagingImage
    ? `Display the extracted garment realistically hanging, laid out, or staged matching the EXACT setting, hanger, surface, and lighting visible in the STAGING REFERENCE image.${template.prompt ? ` ${template.prompt}` : ''}`
    : template.prompt;
  const parsedBlueprint = parseOutfitBlueprint(outfitBlueprint);

  const header = hasStagingImage
    ? `IMAGE 1 = SOURCE OUTFIT (extract ${scopeDesc})\nIMAGE 2 = STAGING REFERENCE (target surface or hanger)\n\n`
    : `IMAGE 1 = SOURCE OUTFIT (extract ${scopeDesc})\n\n`;

  const config: Record<string, unknown> = {
    TASK: `Extract the ${scopeDesc} from the SOURCE OUTFIT image and render it as a professional standalone commercial e-commerce product photo staged into the STAGING REFERENCE setting.`,
    CANVAS_CONTRACT: {
      aspect_ratio: aspectRatio,
      resolution,
      framing: 'catalog framing',
      presentation: 'commercial e-commerce product photograph',
    },
    ENVIRONMENT: {
      target_scene: template.prompt || (hasStagingImage ? 'matching staging reference image' : 'studio staging setting'),
      staging_specification: stagingSpec,
    },
    STAGING_ZONES: {
      upper_hanger: 'upper garments (blouses, shirts, jackets, tops) and single-piece dresses hang naturally from primary upper hanger',
      lower_surface: 'lower garments (skirts, skorts, pants, shorts) arranged distinctly on lower display surface, shelf, or pants hanger',
      spatial_separation: 'maintain clear physical separation between distinct garments; zero merging into a single piece',
    },
    GARMENT_BLUEPRINT: {
      target_scope: scopeDesc,
      apparel_specifications: parsedBlueprint.coreGarments || `Extract ${scopeDesc} with authentic cut, construction, and silhouette`,
      textile_physics: parsedBlueprint.textilePhysics || 'Authentic fabric drape, natural gravity folds, and soft contact shadows',
    },
    STRICT_INVARIANTS_AND_EXCLUSIONS: [
      'zero human models, heads, faces, arms, legs, or body parts in the scene (contain ZERO human beings or mannequins)',
      'zero phantom props or unrelated furniture',
      'clean typography and collar/hemline geometry',
      'zero merging of separated garments into a single piece',
      'no altered colors, distorted patterns, or synthetic CGI gloss',
      ...parsedBlueprint.detectedAccessories.map(
        (accessory) => `exclude detected accessory: ${accessory}`,
      ),
    ],
  };

  if (extraInstructions.trim()) {
    config.USER_INSTRUCTIONS = extraInstructions.trim();
  }

  const jsonPrompt = `/* PRODUCT_STAGING_CONFIG */\n${JSON.stringify(config, null, 2)}`;
  const fullText = `${header}${jsonPrompt}`;

  const parts: Part[] = [{ text: fullText }, imagePart(sourceImage)];
  if (template.image) {
    parts.push(imagePart(template.image));
  }
  return parts;
}

/**
 * Build GPT prompt parts for dressing a Brand Model (Linh, Mai, Custom) in the outfit photo.
 */
export function buildGptBrandModelParts(
  sourceImage: ImageFile,
  model: BrandModelProfile,
  scope: GarmentScope,
  extraInstructions: string = '',
  outfitBlueprint: string = '',
): Part[] {
  if (!model.faceImage) {
    return [imagePart(sourceImage), { text: 'Preserve destination image.' }];
  }

  const parsedBlueprint = parseOutfitBlueprint(outfitBlueprint);

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

  const roleMap = roles.map((r, i) => `IMAGE ${i + 1} = ${r.label}`).join('\n');
  const gptBlueprint = formatGptBlueprintConfig(outfitBlueprint, scope);

  const config: Record<string, unknown> = {
    TASK: `Replace model's head and face in DESTINATION PHOTO with BRAND MODEL (${model.name}) while maintaining a 100% strict lock on clothing and environment.`,
    CANVAS_CONTRACT: {
      framing: 'preserve destination scene composition and framing exactly',
      output_format: 'high-end commercial fashion catalog photograph',
    },
    IDENTITY_TRANSFER: {
      target_model: model.name,
      facial_identity_authority: 'IMAGE 2',
      facial_features: model.metadata.facialFeatures || 'distinctive eye shape, delicate nose contour, lip shape, and signature facial beauty aesthetics',
      head_integration: `seamlessly blend ${model.name}'s head onto the body matching photographed head angle, gaze direction, and natural scene lighting`,
      ...(model.bodyImage
        ? {
            body_morphology: `reshape body morphology and proportions to match BRAND MODEL BODY reference (${model.metadata.bodyType || 'slender feminine build'})`,
          }
        : {}),
    },
    LOCKED_ELEMENTS: {
      garment_lock: '100% FROZEN: Preserve exact clothing down to smallest detail, including colors, fabric textures, seams, ties, lace patterns, and hemlines. Zero alteration to clothing design.',
      environment_lock: '100% FROZEN: Preserve entire background scene, camera perspective, room setting, lighting geometry, and ambiance.',
      pose_lock: '100% FROZEN: Preserve exact body pose, stance, hand placement, and gesture from DESTINATION PHOTO.',
      ...(parsedBlueprint.raw ? { garment_blueprint: gptBlueprint } : {}),
    },
    STRICT_INVARIANTS_AND_EXCLUSIONS: [
      'Do NOT retain original facial features or expression of person in DESTINATION PHOTO (must be completely replaced by BRAND MODEL)',
      'Do NOT alter clothing design, fabric textures, or colors (100% garment lock)',
      'Do NOT alter background scene, furniture, camera perspective, or lighting (100% environment lock)',
      ...parsedBlueprint.detectedAccessories.map(
        (acc) => `exclude detected accessory: ${acc}`,
      ),
    ],
  };

  if (extraInstructions.trim()) {
    config.USER_INSTRUCTIONS = extraInstructions.trim();
  }

  const jsonPrompt = `/* BRAND_MODEL_IDENTITY_CONFIG */\n${JSON.stringify(config, null, 2)}`;
  return [
    { text: `${roleMap}\n\n${jsonPrompt}` },
    ...roles.map((r) => imagePart(r.image)),
  ];
}
