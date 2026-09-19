/**
 * Lookbook Prompt Builder - Pure Functions
 *
 * Extracted from LookbookGenerator.tsx to improve maintainability and testability.
 * All prompt generation logic is contained here as pure functions with no side effects.
 */

import {
  BOXED_PROMPT,
  FOLDED_PROMPT,
  GHOST_MANNEQUIN_PROMPT,
  CLEAN_FLAT_LAY_PROMPT,
  MANNEQUIN_BACKGROUND_PROMPTS,
  LookbookStyle,
  GarmentType,
  FoldedPresentationType,
  MannequinBackgroundStyleKey,
  ProductShotSubType
} from '../components/LookbookGenerator.prompts';
import { ImageFile, AspectRatio } from '../types';
import { formatAiScanBlock } from './ai-scan-blueprint';
import type { PromptFormat } from './promptFormat';

/**
 * Form state interface for prompt building
 */
export interface LookbookFormState {
  clothingImages: Array<{ id: string; image: ImageFile | null }>;
  fabricTextureImage: ImageFile | null;
  fabricTexturePrompt: string;
  clothingDescription: string;
  lookbookStyle: LookbookStyle;
  garmentType: GarmentType;
  foldedPresentationType: FoldedPresentationType;
  mannequinBackgroundStyle: MannequinBackgroundStyleKey;
  negativePrompt: string;
  // Product Shot fields
  productShotSubType: ProductShotSubType;
  includeAccessories: boolean;
  includeFootwear: boolean;
}

/**
 * The AI Scan source set of a lookbook run: the garment images in slot order,
 * then the fabric texture image.
 *
 * One definition for the form's panel and the generation hook, because the two
 * must pass the SAME ImageFile objects — object identity is the scan cache key,
 * and a drifted list would label the run with a stale blueprint and pay for a
 * second analysis.
 */
export const lookbookAiScanSources = (
  clothingImages: Array<{ image: ImageFile | null }>,
  fabricTextureImage: ImageFile | null,
): ImageFile[] => [
  ...clothingImages.filter((item) => item.image !== null).map((item) => item.image as ImageFile),
  ...(fabricTextureImage ? [fabricTextureImage] : []),
];

/**
 * Builds the main lookbook generation prompt based on form state
 * Pure function - no side effects, deterministic output
 *
 * @param formState - Current form state
 * @param images - Array of clothing images for API
 * @param fabricTextureImage - Optional fabric texture image
 * @param format - Prompt layout mode for the active image driver
 * @param outfitBlueprint - Optional AI Scan textile deconstruction of the sources
 * @returns Complete prompt string for image generation
 */
export const buildLookbookPrompt = (
  formState: LookbookFormState,
  images: ImageFile[],
  fabricTextureImage: ImageFile | null,
  format: PromptFormat = 'parts',
  outfitBlueprint: string = '',
): string => {
  const {
    lookbookStyle,
    foldedPresentationType,
    garmentType,
    mannequinBackgroundStyle,
    clothingDescription,
    fabricTexturePrompt
  } = formState;

  const sections: string[] = [];

  // Every presentation style is one standalone product photo. Without this rule
  // the models drift into collage / contact-sheet boards (same guard the
  // variation prompt already carries).
  sections.push(`## OUTPUT
Render exactly one complete, standalone photograph. Do NOT generate a collage, grid, diptych, split-screen, contact sheet, or multi-panel composition.`);

  const effectiveFabricTextureImage = fabricTextureImage ?? formState.fabricTextureImage ?? null;

  if (format === 'text' && images.length > 1) {
    const roleLines: string[] = [];
    const clothingCount = effectiveFabricTextureImage ? images.length - 1 : images.length;
    for (let i = 0; i < clothingCount; i++) {
      roleLines.push(`IMAGE ${i + 1} = Clothing garment reference ${clothingCount > 1 ? `view #${i + 1}` : ''} (primary visual evidence for silhouette, construction, and cut)`);
    }
    if (effectiveFabricTextureImage) {
      roleLines.push(`IMAGE ${images.length} = Fabric texture reference (material surface and texture swatch only)`);
    }
    sections.push(`## IMAGE ROLES\n${roleLines.join('\n')}`);
  }
  // Multi-view and multi-piece reference evidence instruction
  const isMultiImage = images.length > (effectiveFabricTextureImage ? 2 : 1);
  const garmentEvidenceSection = isMultiImage
    ? `## REFERENCE EVIDENCE & RECONCILIATION
- The uploaded clothing images provide visual evidence. They may contain multiple views of the same garment, distinct pieces of a multi-piece outfit, or both.
- Multi-view reconciliation: when multiple views show the same piece from different angles, reconcile its complete 3D form from the clearest supported visual evidence across views. Never blend contradictory details from multiple views into a new hybrid design.
- Multi-piece outfits: keep distinct garment pieces separate according to the outfit structure. Do not merge separate tops, bottoms, or layers into an invented single garment.
- Conservative completion: if any garment region is hidden or unresolved across all source views, keep only the most likely continuous garment shape. Do NOT invent new trims, pockets, buttons, labels, logos, embroidery, closures, or construction details that lack visual support.`
    : `## REFERENCE EVIDENCE & RECONCILIATION
- The uploaded clothing image provides the visual evidence for the garment design, silhouette, construction, and materials.
- Conservative completion: preserve visible construction, seams, colors, and textures. If any region is obscured, complete it conservatively without inventing new trims, pockets, buttons, labels, logos, embroidery, or closures.`;

  sections.push(garmentEvidenceSection);

  // Fabric texture section
  if (effectiveFabricTextureImage) {
    const textureRefLabel = format === 'text' ? ` (IMAGE ${images.length})` : '';
    const fabricLines: string[] = [
      '## FABRIC TEXTURE APPLICATION',
      `- The fabric texture reference${textureRefLabel} controls material surface and texture only.`,
      '- Wrap the texture realistically across the garment\'s folds, seams, drape, and contours under the scene lighting, maintaining physical depth rather than appearing flat or pasted on.',
      '- Strictly preserve the garment\'s supported silhouette, cut, seams, and non-fabric construction details (such as buttons, zippers, fasteners, and hardware).',
    ];
    if (fabricTexturePrompt.trim()) {
      fabricLines.push(`- Fabric texture note: "${fabricTexturePrompt.trim()}" provides secondary guidance to guide texture application.`);
    }
    sections.push(fabricLines.join('\n'));
  } else if (fabricTexturePrompt.trim()) {
    const fabricLines: string[] = [
      '## FABRIC TEXTURE APPLICATION',
      `- Fabric texture note: "${fabricTexturePrompt.trim()}" provides material and texture guidance only.`,
      '- Wrap the texture realistically across the garment\'s folds, seams, drape, and contours under the scene lighting, maintaining physical depth rather than appearing flat or pasted on.',
      '- Strictly preserve the garment\'s supported silhouette, cut, seams, and non-fabric construction details (such as buttons, zippers, fasteners, and hardware).',
    ];
    sections.push(fabricLines.join('\n'));
  }

  // Style-specific prompt generation
  let stylePrompt = '';
  switch (lookbookStyle) {
    case 'flat lay':
      stylePrompt = buildFlatLayPrompt(garmentType);
      break;
    case 'folded':
      stylePrompt = buildFoldedPrompt(foldedPresentationType, garmentType);
      break;
    case 'mannequin':
      stylePrompt = buildMannequinPrompt(mannequinBackgroundStyle);
      break;
    case 'hanger':
      stylePrompt = buildHangerPrompt(garmentType);
      break;
    case 'studio background':
      stylePrompt = buildStudioBackgroundPrompt();
      break;
    case 'minimalist showroom':
      stylePrompt = buildMinimalistShowroomPrompt(garmentType);
      break;
    case 'product shot':
      stylePrompt = buildProductShotPrompt(
        formState.productShotSubType,
        formState.includeAccessories,
        formState.includeFootwear
      );
      break;
    default:
      stylePrompt = buildFlatLayPrompt(garmentType);
  }

  sections.push(stylePrompt);

  // Apply clothing description as secondary guidance if provided
  if (clothingDescription.trim() && lookbookStyle !== 'studio background') {
    const descriptionInstruction = `## GARMENT DESCRIPTION (SECONDARY GUIDANCE)
- Use the following user-provided description ONLY to clarify garment details that are already visible in, or strongly supported by, the source image(s).
- The source image(s) remain the primary source of truth. If this description conflicts with any visible evidence in the source image(s), follow the source image(s).
- Do NOT invent new trims, pockets, buttons, labels, logos, embroidery, closures, or construction details that are not supported by the source image(s).
- Detailed Description: "${clothingDescription.trim()}"`;
    sections.push(descriptionInstruction);
  }

  return sections.join('\n\n') + formatAiScanBlock(outfitBlueprint);
};

/**
 * Build flat lay style prompt
 * @param garmentType - Type of garment (one-piece, two-piece, three-piece)
 * @returns Flat lay prompt string
 */
const buildFlatLayPrompt = (garmentType: GarmentType): string => {
  const outfitTypeMap: Record<GarmentType, string> = {
    'one-piece': 'a one-piece garment (dress or jumpsuit)',
    'two-piece': 'a two-piece set (top + pants, or top + skirt)',
    'three-piece': 'a three-piece set (inner top, pants/skirt, and outer jacket)'
  };
  const outfitTypeText = outfitTypeMap[garmentType];

  return `## PRESENTATION: LIFESTYLE FLAT LAY
Create a high-end e-commerce flat lay photograph of ${outfitTypeText}, laid out naturally from a top-down camera angle in a clean lifestyle composition.

Display & Composition:
1. Layout: arrange the outfit neatly from directly above:
    - If one-piece: continuous layout showing the garment's natural silhouette and drape.
    - If two-piece: top placed above, pants/skirt directly below in a straight, aligned layout.
    - If three-piece: top, bottom, and outer layer arranged in natural order or parallel alignment.
2. Background & Setting: light-colored textured rug and warm-toned wood floor or furniture, maintaining a minimal lifestyle aesthetic.
3. Supporting Props: tasteful, restrained decor accessories (such as magazines, a ceramic vessel, or a clean textile) placed around the perimeter to complement without obstructing the garment.
4. Lighting: soft, natural directional lighting creating gentle contact shadows that reveal fabric weave and texture.

Avoid:
- No mannequins, human body parts, or extra outfits not in the references.
- No clutter or props overlapping or covering the clothing.
- No invented buttons, altered silhouettes, or incorrect colors.`;
};

/**
 * Build folded style prompt
 * @param presentationType - Boxed or folded presentation
 * @param garmentType - Type of garment
 * @returns Folded prompt string
 */
const buildFoldedPrompt = (
  presentationType: FoldedPresentationType,
  garmentType: GarmentType
): string => {
  const basePrompt = presentationType === 'boxed' ? BOXED_PROMPT : FOLDED_PROMPT;
  const outfitTypeMap: Record<GarmentType, string> = {
    'one-piece': 'a one-piece garment (dress or jumpsuit)',
    'two-piece': 'a two-piece set (top + pants, or top + skirt)',
    'three-piece': 'a three-piece set (inner top, pants/skirt, and outer jacket)'
  };
  const outfitTypeText = outfitTypeMap[garmentType];
  return basePrompt.replace(/\$\{outfitType\}/g, outfitTypeText);
};

/**
 * Build mannequin style prompt
 * @param backgroundStyle - Selected background style key
 * @returns Mannequin prompt string
 */
const buildMannequinPrompt = (backgroundStyle: MannequinBackgroundStyleKey): string => {
  const backgroundStyleText = MANNEQUIN_BACKGROUND_PROMPTS[backgroundStyle];

  return `## PRESENTATION: TAILORED MANNEQUIN SHOT
Generate a professional studio photograph of clothing displayed on a high-end fashion mannequin.

Mannequin Specification:
- Headless, armless, and legless torso form in solid ivory/cream tone.
- Topped with a short cylindrical neck block capped with a flat metallic gold disk.
- Mounted on a slender metallic floor stand with a simple square base.

Garment Integration:
- Fit the outfit naturally onto the mannequin torso, respecting the garment's cut, layers, and proportions.
- Render natural fabric drape, folds, seams, and closures under the scene lighting.

Environment & Lighting:
- Background: ${backgroundStyleText}
- Lighting: soft, diffused studio illumination enhancing fabric texture, depth, and silhouette.

Avoid:
- NO mannequin heads, arms, legs, or human skin/body parts.
- NO extra mannequins, clutter, or unrelated props.
- NO invented details, missing garment pieces, or altered colors.`;
};

/**
 * Build hanger style prompt
 * @param garmentType - Type of garment
 * @returns Hanger prompt string
 */
const buildHangerPrompt = (garmentType: GarmentType): string => {
  const outfitTypeMap: Record<GarmentType, string> = {
    'one-piece': 'the one-piece garment (dress, jumpsuit, single shirt, single pants/skirt)',
    'two-piece': 'the two-piece set (shirt + pants, shirt + skirt)',
    'three-piece': 'the three-piece set (shirt + pants/skirt + jacket/outer layer)'
  };
  const outfitTypeText = outfitTypeMap[garmentType];

  return `## PRESENTATION: BOUTIQUE CLOSET HANGER SHOT
Generate a professional e-commerce product photograph of ${outfitTypeText} displayed in an elegant closet setting.

Setting & Arrangement:
- Closet Setting: minimalist built-in alcove with off-white matte walls and open white shutter-style panel doors framing the space.
- Clothing Rack: a horizontal satin chrome rack mounted cleanly across the alcove.
- Hanger Configuration:
    - One-piece: hung on a slim transparent acrylic hanger on the right position.
    - Two-piece: top hung on a transparent acrylic hanger (right), bottom on a gold metal hanger (left), displayed side-by-side with balanced spacing.
    - Three-piece: top and bottom hung as above, with the outer jacket hung on an adjacent hanger or layered naturally.
- Display: the garment hangs fully visible from hanger to hem with natural vertical gravity drape.

Supporting Props:
- Left shelf: a stylish, minimalist handbag that harmonizes with the outfit's formality, material, and color palette.
- Right shelf: a neatly paired set of shoes (heels, loafers, or sandals) that complements the outfit's style and color.
- Props serve as subtle catalog accents without distracting from the clothing.

Lighting:
- Soft, bright natural daylight from above and slightly to the side, casting gentle contact shadows beneath the rack, garments, bag, and shoes.

Avoid:
- No mannequins, human figures, or clutter.
- No altered garment silhouettes, missing pieces, or invented details.`;
};

/**
 * Build studio background style prompt
 * @returns Studio background prompt string
 */
const buildStudioBackgroundPrompt = (): string => {
  return `## PRESENTATION: STUDIO BACKGROUND EDIT
Recreate the image in a professional studio setting while strictly preserving the subject.

Subject Preservation:
- Preserve the model's identity, face, hair, skin tone, body proportions, exact outfit, and pose completely. Do not alter or redraw the subject.

Studio Environment:
- Background: completely replace the original background with a seamless, clean off-white or light gray studio paper backdrop with subtle fine texture.
- Floor: smooth studio surface with soft, natural reflections beneath the model.
- Lighting: soft diffused studio lighting (such as a large softbox) balanced across the subject and backdrop, creating gentle, flattering shadows.
- Integration: seamless edges around hair and clothing contours with no cutout halo or compositing artifacts.

Avoid:
- No changes to the model's face, hair, body, clothing, or pose.
- No residual elements from the old background.
- No artificial compositing artifacts or mismatched lighting angles.`;
};

/**
 * Build minimalist showroom style prompt
 * @param garmentType - Type of garment
 * @returns Minimalist showroom prompt string
 */
const buildMinimalistShowroomPrompt = (garmentType: GarmentType): string => {
  const outfitTypeMap: Record<GarmentType, string> = {
    'one-piece': 'the one-piece garment (dress, jumpsuit, single shirt, single pants/skirt)',
    'two-piece': 'the two-piece set (shirt + pants, shirt + skirt)',
    'three-piece': 'the three-piece set (shirt + pants/skirt + jacket/outer layer)'
  };
  const outfitTypeText = outfitTypeMap[garmentType];

  return `## PRESENTATION: MINIMALIST SHOWROOM
Generate a high-end lookbook photograph of ${outfitTypeText} displayed in a fixed minimalist beige studio showroom.

Locked Scene Geometry:
- Background: seamless matte warm beige wall with even tone.
- Floor: smooth light-gray concrete with soft subtle reflections.
- Rack: freestanding rectangular clothing rack with two vertical posts and one horizontal bar in brushed satin silver, with a bottom shelf, positioned centered and level.
- Pedestal: on the left side, a rectangular matte concrete pedestal (approx. 1/4 rack height) flush with the floor.
- Framing: centered, straight-on camera at mid-height, symmetrical alignment.
- Lighting: warm-neutral daylight (~4800K) diffused from the upper-left with gentle, soft shadows.

Garment Display:
- ${outfitTypeText} hangs naturally on thin gold/brass hangers:
    - Two-piece sets: top on the left, bottom on the right, slightly spaced with full length visible.
    - One-piece: centered on the rack.
- Fabric hangs with natural gravity drape and realistic folds.

Adaptive Accessories:
1. Handbag (on pedestal): automatically styled handbag that harmonizes with the outfit's tone, formality, and materials (e.g. structured leather for tailored looks, soft clutch for fluid silhouettes).
2. Shoes (on floor, centered below rack): automatically styled shoes that coordinate with the outfit and bag (e.g. pumps/slingbacks for dresses, loafers for tailoring, clean sneakers for relaxed sets). Placed symmetrically, toes forward.

Avoid:
- No mannequins, humans, or clutter.
- No changes to the locked scene geometry (wall color, rack design, pedestal, floor, or lighting angle).
- No invented garment details or distorted garment proportions.`;
};

/**
 * Build product shot prompt — Ghost Mannequin or Clean Flat Lay
 */
const buildProductShotPrompt = (
  subType: ProductShotSubType,
  includeAccessories: boolean,
  includeFootwear: boolean
): string => {
  const basePrompt = subType === 'ghost-mannequin'
    ? GHOST_MANNEQUIN_PROMPT
    : CLEAN_FLAT_LAY_PROMPT;

  const accessoriesSection = subType === 'ghost-mannequin'
    ? (
      includeAccessories
        ? '- INCLUDE only accessories clearly visible in the source outfit, such as belts, scarves, ties, brooches, or pins. Present them as separate product elements near the garment without overlap. Do NOT invent hidden accessory details.'
        : '- EXCLUDE all removable accessories entirely. Do not include belts, scarves, ties, brooches, pins, or jewelry unless they are inseparable parts of the garment itself.'
    )
    : (
      includeAccessories
        ? '- INCLUDE only accessories clearly visible in the source outfit, such as belts, scarves, ties, brooches, or pins. Display them as separate laid-out items alongside the garment pieces without overlap. Do NOT invent hidden accessory details.'
        : '- EXCLUDE all removable accessories entirely. Do not include belts, scarves, ties, brooches, pins, or jewelry unless they are inseparable parts of the garment itself.'
    );

  const footwearSection = subType === 'ghost-mannequin'
    ? (
      includeFootwear
        ? '- INCLUDE only footwear clearly visible in the source outfit. Present the pair separately below the ghost mannequin garment on the same white background. Do NOT invent unseen sole, heel, or trim details.'
        : '- EXCLUDE footwear entirely. Do NOT include any shoes, boots, or sandals.'
    )
    : (
      includeFootwear
        ? '- INCLUDE only footwear clearly visible in the source outfit. Display shoes/boots as the bottom-most separate item in the layout, below all garment pieces. Do NOT invent unseen sole, heel, or trim details.'
        : '- EXCLUDE footwear entirely. Do NOT include any shoes, boots, or sandals.'
    );

  return basePrompt
    .replace('${ACCESSORIES_SECTION}', accessoriesSection)
    .replace('${FOOTWEAR_SECTION}', footwearSection);
};

/**
 * Build variation generation prompt
 * @param lookbookStyle - Current lookbook style
 * @param outfitBlueprint - Optional AI Scan textile deconstruction of the sources
 * @returns Variation prompt string
 */
export const buildVariationPrompt = (
  lookbookStyle: LookbookStyle,
  outfitBlueprint: string = '',
): string => {
  return `## TASK: PRODUCT LOOKBOOK VARIATION SHOT
Generate a single alternate photograph of the exact same clothing product shown in the reference image, maintaining the '${lookbookStyle}' presentation style.

## EDIT & VARIATION RULES
1. Single output image: render exactly one complete, standalone photograph. Do NOT generate a collage, grid, diptych, split-screen, contact sheet, or multi-panel composition.
2. Product identity preservation: the garment design, silhouette, construction, color, pattern, texture, and details must remain identical to the reference product. Do not redesign, restyle, or alter the clothing item itself.
3. Permitted photographic variations: introduce modest photographic changes such as:
    - A subtle shift in camera angle (e.g. slightly higher, lower, or angled).
    - A minor variation in camera distance or crop.
    - A realistic adjustment in studio lighting direction or highlight placement.
    - For '${lookbookStyle}', natural micro-adjustments in fabric drape or prop arrangement consistent with a real photoshoot.

## AVOID
- No collages, grids, split images, multi-panel layouts, or contact sheets.
- No altering or redesigning the garment, colors, patterns, or construction details.
- No changing the core '${lookbookStyle}' presentation concept.
- No blurry details, distortion, or artificial compositing artifacts.` + formatAiScanBlock(outfitBlueprint);
};

/**
 * Build close-up generation prompts
 * @param outfitBlueprint - Optional AI Scan textile deconstruction of the sources
 * @returns Array of close-up prompt strings
 */
export const buildCloseUpPrompts = (outfitBlueprint: string = ''): string[] => {
  const aiScanBlock = formatAiScanBlock(outfitBlueprint);
  return [
    `## TASK: DETAIL CLOSE-UP — NECKLINE / COLLAR
Generate a high-end e-commerce macro detail photograph focusing on the neckline or collar of the garment from the reference image.
- Grounding: capture the exact neckline or collar construction visible in the reference, including seams, stitching, fabric weave, and any visible fasteners (buttons, placket, or zip).
- Conservative fallback: if specific fasteners or collar details are absent or obscured in the reference, faithfully capture the plain neckline contour and fabric surface without inventing buttons, trims, collars, or embroidery.
- Photography: sharp macro focus on craftsmanship, soft directional lighting to reveal fabric texture and edge finishing, softly blurred clean catalog background. Preserve the exact product color, material, and construction.`,

    `## TASK: DETAIL CLOSE-UP — SLEEVE / CUFF / ARMHOLE
Generate a high-end e-commerce macro detail photograph focusing on the sleeve or armhole area of the garment from the reference image.
- Grounding: capture the sleeve hem, cuff structure, or armhole finishing exactly as supported by the reference (whether long sleeve, short sleeve, or sleeveless).
- Conservative fallback: if cuff hardware, buttons, or decorative trims are not clearly visible in the reference, render clean continuous seam finishing without inventing cuffs, tabs, buttons, or embellishments.
- Photography: sharp macro focus on seam precision, fabric weave, and edge construction, soft angled lighting highlighting fabric depth, clean catalog background. Preserve true garment colors and textures.`,

    `## TASK: DETAIL CLOSE-UP — LOWER BODY / HEMLINE / WAISTBAND
Generate a high-end e-commerce macro detail photograph focusing on the lower section, waistband, or hemline of the garment from the reference image.
- Grounding: capture visible waistband construction, front hemline, pleats, pockets, or closures exactly as shown in the reference.
- Conservative fallback: if waist fastenings, drawstrings, or pockets are not present in the reference, emphasize the clean fabric surface, authentic drape, and hem finishing without inventing pockets, buttons, zippers, or ornamental details.
- Photography: sharp macro focus on textile texture and stitching quality, clean overhead soft studio lighting, softly blurred catalog background. Preserve true garment design and structure.`
  ].map((prompt) => prompt + aiScanBlock);
};

/**
 * Build combined negative prompt for close-up generation
 * @param baseNegativePrompt - User-provided negative prompt
 * @returns Combined negative prompt string
 */
export const buildCloseUpNegativePrompt = (baseNegativePrompt: string): string => {
  const closeUpNegativePrompt = 'invented buttons, invented pockets, invented trims, invented collars, incorrect stitching, distorted proportions, blurry details, fabric warping, color shift, fake logos, watermark, background clutter';
  return [baseNegativePrompt.trim(), closeUpNegativePrompt].filter(Boolean).join(', ');
};
