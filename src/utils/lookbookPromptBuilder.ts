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

/**
 * Form state interface for prompt building
 */
export interface LookbookFormState {
  clothingImages: Array<{ id: number; image: ImageFile | null }>;
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
 * Builds the main lookbook generation prompt based on form state
 * Pure function - no side effects, deterministic output
 *
 * @param formState - Current form state
 * @param images - Array of clothing images for API
 * @param fabricTextureImage - Optional fabric texture image
 * @returns Complete prompt string for image generation
 */
export const buildLookbookPrompt = (
  formState: LookbookFormState,
  images: ImageFile[],
  fabricTextureImage: ImageFile | null
): string => {
  const {
    lookbookStyle,
    foldedPresentationType,
    garmentType,
    mannequinBackgroundStyle,
    clothingDescription,
    fabricTexturePrompt
  } = formState;

  let prompt = '';

  // Multi-image synthesis instruction
  if (images.length > (fabricTextureImage ? 2 : 1)) {
    prompt += `
      **Image Roles**: Multiple images of the same clothing item are provided, showing different angles (e.g., front, side, back).
      **Core Synthesis Task**: Your primary goal is to mentally reconstruct a complete, 3D understanding of the single garment from these multiple 2D views. Synthesize all details—shape, seams, texture, pattern flow, and features—into one cohesive object. The final output should feature this synthesized garment.
    `;
  } else {
    prompt += `
      **Image Role**: A single image of a clothing item is provided.
    `;
  }

  // Fabric texture section
  let fabricPromptSection = '';
  if (fabricTextureImage) {
    fabricPromptSection += `
      **Critical Instruction: Fabric Replacement**
      - An additional image ('Fabric Texture Image') is provided. Your most important task is to replace the original fabric of the main clothing item with the texture from this image.
      - The new texture must wrap realistically around the garment's folds, seams, and contours.
      - The lighting on the new texture must match the scene's overall lighting.
    `;
  }

  if (fabricTexturePrompt.trim()) {
    fabricPromptSection += `
      **Fabric Texture Description**: Use this description to guide the texture application: "${fabricTexturePrompt.trim()}".
    `;
  }

  if (fabricTextureImage || fabricTexturePrompt.trim()) {
    fabricPromptSection += `
      - Preserve the clothing's original silhouette, shape, and all non-fabric details (buttons, zippers).
      - This texture application instruction overrides any conflicting details from the source clothing.
    `;
  }

  // Prepend fabric section if present
  if (fabricPromptSection) {
    prompt = fabricPromptSection + '\n\n' + prompt;
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

  prompt += '\n\n' + stylePrompt;

  // Apply clothing description as a critical note if provided, for relevant styles
  if (clothingDescription.trim() && lookbookStyle !== 'studio background') {
    const descriptionInstruction = `

**Critical Note on Garment Details (IMPORTANT)**:
- Rely on the following user-provided description to ensure accuracy of the product details.
- This description is a supplementary source of truth and should be prioritized to clarify the garment's features in the output image.
- **Detailed Description**: "${clothingDescription.trim()}"
    `.trim();
    prompt += descriptionInstruction;
  }

  return prompt;
};

/**
 * Build flat lay style prompt
 * @param garmentType - Type of garment (one-piece, two-piece, three-piece)
 * @returns Flat lay prompt string
 */
const buildFlatLayPrompt = (garmentType: GarmentType): string => {
  const basePrompt = `
**Task**: Create a high-end e-commerce flat lay photo of the \${outfitType}, matching the reference image's style: top-down angle, soft natural light, and a clean lifestyle composition.

**Subject**: \${outfitType} from the source image, laid out neatly on a bright background.

- CRITICAL RULE: Maintain every outfit detail with 100% accuracy – fabric, seams, folds, patterns, buttons, zippers, elastic bands, hardware, and true colors.
- Do not alter, simplify, or redraw any details.

**Display Instructions**:
1. The outfit is laid out naturally, shot from top-down.
    - If **one-piece (dress/jumpsuit)** → lay out the full continuous form, showing its natural drape.
    - If **two-piece (top + pants/skirt)** → place the top above, pants/skirt directly below, in a straight layout.
    - If **multi-piece (inner top + pants/skirt + jacket)** → layer each piece in natural order or place them neatly in parallel.
2. Background: light-colored rug + warm-toned wood floor/furniture, maintaining the reference image's minimal, lifestyle vibe.
3. Decor accessories should match the vibe: magazines, a bright boucle chair, a wooden table, a decorative wool basket.
4. Lighting: natural, soft, slightly angled, creating soft, not harsh, shadows.
5. Composition: outfit is central, decor accessories are arranged around it to complement, not obstruct the main form.
6. The output image must be hyper-realistic, 2K, sharp, and color-accurate.

**Negative prompt**:
no mannequin, no human body parts, no extra outfits not in source,
no distorted proportions, no misplaced seams, no extra buttons,
no fake logos, no text overlay, no watermarks, no clutter,
no harsh shadows, no reflections, no oversaturation, no underexposure,
no blurry details, no fabric distortion, no incorrect colors.
  `;

  const outfitTypeMap: Record<GarmentType, string> = {
    'one-piece': 'a one-piece garment (dress or jumpsuit)',
    'two-piece': 'a two-piece set (top + pants, or top + skirt)',
    'three-piece': 'a three-piece set (inner top, pants/skirt, and outer jacket)'
  };
  const outfitTypeText = outfitTypeMap[garmentType];
  return basePrompt.replace(/\$\{outfitType\}/g, outfitTypeText);
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
  const basePrompt = `
**Task**: Generate a professional studio photograph of clothing on a high-end mannequin.
**Subject**: Replace the mannequin's outfit with the clothing from the provided source image(s). Preserve every intricate detail with 100% accuracy — fabric texture, true colors, seams, pleats, stitching, embroidery, hardware, and proportions.

**Mannequin Style (Strict Requirement)**:
- Headless, armless, and legless female torso, solid ivory/cream color.
- Topped with a short, plain cylindrical neck block (ivory/cream), capped by a flat round metallic gold disk.
- Mounted on a slim metallic stand with a simple square base.

**Clothing Integration**:
- Transfer the outfit onto the mannequin, maintaining exact proportions, layers, and structure.
- Render folds, shine, and depth photorealistically, with lighting and shadows matching the scene.
- No simplification, no missing parts, no blending errors.

**Background Instructions**:
Use the following background style:
**\${backgroundStyle}**

**Lighting**: Soft, diffuse studio or daylight, subtle highlights and shadows to enhance form and fabric.

**Goal**: Flawless 2K photorealistic image, where all elements are true to the description — only the outfit changes.

**Negative prompt (Strict)**:
NO mannequin heads (ball, oval, dome, fabric-wrapped, stylized), NO mannequin arms, NO mannequin legs, NO human body parts, NO skin.
No extra mannequins, no background props, no shelving, no clutter,
no reflections, no color casts, no harsh shadows, no over/underexposure,
no text overlay, no fake logos, no watermarks, no background changes,
no distortion, no missing garment details, no incorrect colors.
  `;

  const backgroundStyleText = MANNEQUIN_BACKGROUND_PROMPTS[backgroundStyle];
  return basePrompt.replace(/\$\{backgroundStyle\}/g, backgroundStyleText);
};

/**
 * Build hanger style prompt
 * @param garmentType - Type of garment
 * @returns Hanger prompt string
 */
const buildHangerPrompt = (garmentType: GarmentType): string => {
  const basePrompt = `
**Task**: Generate a photorealistic, professional e-commerce product image.

**Subject**: \${outfitType} from the provided source image(s).

**Background & Arrangement Instructions**:
- The setting is a minimalist, built-in closet alcove with off-white matte walls.
- Both sides have open white shutter-style panel doors, framing the closet.
- A single horizontal chrome clothing rack (matte silver) is mounted near the top of the alcove.
- Garments are hung as follows:
    - For one-piece: Hang the single item (dress, jumpsuit, shirt, or pants/skirt) on the transparent acrylic hanger (right position).
    - For two-piece: Hang the top on the transparent acrylic hanger (right) and the bottom on the gold metal hanger (left), side by side.
    - For three-piece: Hang the top and bottom as above, with the jacket/outer layer either layered on the right hanger or on a separate hanger next to the others, matching the spacing in the scene.
- Hangers must be slim (one transparent acrylic, one gold metal), spaced identically as described, and attached to the rack in the same alignment and proportions.

**Props & Decor**:
- On the left of the built-in white shelf, place a stylish bag that visually complements and matches the style, color palette, and level of formality of \${outfitType}. The bag should enhance the overall fashion aesthetic, remain minimalist and clean in design, and never distract from the garment(s).
- On the right of the shelf, place a pair of elegant shoes (heels, loafers, or sandals) that coordinate perfectly with \${outfitType} in both color and style. Shoes should be neatly paired, fashion-forward, and appropriate for the type of garment(s) displayed.
- The props must always look modern, tasteful, and catalog-ready, fitting a minimalist closet scene.
- All surfaces must remain clean, with no excess clutter or unrelated items.

**Lighting & Mood**:
- Soft, bright natural light from above or slightly to the side, with gentle shadows under rack, clothes, bag, and shoes.
- Modern, calm, and catalog-ready mood, with subtle highlights on metal and acrylic details.

**Display**:
- \${outfitType} must be displayed fully visible from hanger top to hem, with spacing, proportions, and arrangement matching the above description exactly.

**Critical Rule**:
- Every detail of the new garment(s) must be preserved with 100% accuracy — fabric texture, color, pattern, seams, stitching, hardware, etc.
- Do not stylize, simplify, or alter fit/silhouette.
- Do not change or move any other background element, only props (bag and shoes) are allowed to adapt to match the outfit.

**Output Specs**:
- High-resolution (2K or higher), photorealistic.

**Goal**:
Produce a flawless product shot of \${outfitType} in a minimalist closet scene as described, with **bag and shoes auto-styled to match and enhance the outfit**, maintaining a clean, professional, and harmonious visual presentation.
  `;

  const outfitTypeMap: Record<GarmentType, string> = {
    'one-piece': 'the one-piece garment (dress, jumpsuit, single shirt, single pants/skirt)',
    'two-piece': 'the two-piece set (shirt + pants, shirt + skirt)',
    'three-piece': 'the three-piece set (shirt + pants/skirt + jacket/outer layer)'
  };
  const outfitTypeText = outfitTypeMap[garmentType];
  return basePrompt.replace(/\$\{outfitType\}/g, outfitTypeText);
};

/**
 * Build studio background style prompt
 * @returns Studio background prompt string
 */
const buildStudioBackgroundPrompt = (): string => {
  return `
    **Task**: Recreate the provided image with a new, professional studio background, while perfectly preserving the subject.
    **Subject**: The person and their complete outfit from the source image.
    **CRITICAL RULES**:
    1.  **Perfect Subject Preservation**: The person's identity (face, hair, body shape), their entire outfit (design, color, texture, fit), and their exact pose MUST be preserved with 100% accuracy. Do NOT alter, redraw, or change the subject in any way.
    2.  **Background Replacement**: Completely remove and discard the original background.
    3.  **New Background Generation**: Generate a new, photorealistic, and clean studio background. The background should be a seamless, slightly off-white or light gray paper backdrop, subtly textured.
    4.  **Studio Lighting**: The lighting on the model must be adjusted to match a professional studio lighting setup. Use soft, diffused light (like from a large softbox) to create gentle, flattering shadows. The lighting should look clean, polished, and consistent across the model and the new background.
    5.  **Floor**: The floor should be a smooth, reflective surface that subtly mirrors the model, creating a sense of space and professionalism.
    6.  **Seamless Integration**: Ensure the model is perfectly integrated into the new scene. Pay close attention to edges, hair strands, and semi-translucent fabrics to avoid any "cut-out" look. The model must look like they were actually photographed in the new studio environment.
    **Goal**: A high-resolution (2K), photorealistic image suitable for a premium e-commerce catalog or fashion lookbook, featuring the original model and clothing in a new, clean studio setting.
  `;
};

/**
 * Build minimalist showroom style prompt
 * @param garmentType - Type of garment
 * @returns Minimalist showroom prompt string
 */
const buildMinimalistShowroomPrompt = (garmentType: GarmentType): string => {
  const basePrompt = `
Task: Generate a photorealistic, high-end lookbook image of \${outfitType} displayed in a fixed minimalist beige studio setup.
The background, rack, floor, and lighting must match a premium beige studio aesthetic.
The outfit, bag, and shoes change according to styling logic below.

Scene (LOCKED):
- Background: seamless matte beige wall, warm and even tone.
- Floor: smooth light-gray concrete with soft reflection.
- Lighting: natural daylight from upper-left, diffused and shadow-soft. No visible window streaks.
- Composition: centered, straight-on camera, mid height, symmetrical layout.

Rack (LOCKED):
- Freestanding rectangular clothing rack with two vertical posts and one horizontal bar in brushed/satin silver.
- Bottom shelf in same metal, visible across frame.
- Positioned level and centered; no hanging cables or ceiling wires.

Pedestal (LOCKED):
- Left side: a tall rectangular concrete pedestal with soft matte surface, neutral gray tone.
- Size proportionate (roughly ¼ rack height), flush with floor.
- Used to display the handbag accessory dynamically generated per outfit.

Garment Display (variable):
- \${outfitType} hangs naturally on thin gold/brass hangers.
- For two-piece sets: top (left) and bottom (right) slightly spaced, full length visible.
- For one-piece: center aligned.
- Fabric hangs with natural gravity, realistic folds, premium texture.

Auto-Styled Accessories (UNLOCKED):
1️⃣ **Bag (on pedestal):**
   - AI automatically generates a handbag that harmonizes with the outfit's tone, material, and formality.
   - Style logic:
     • For structured or tailored outfits → classic boxy leather handbag or mini satchel.
     • For flowy or feminine outfits → soft clutch, curved shoulder bag, or woven tote.
     • For casual outfits → minimalist bucket or crescent bag.
   - Color harmony:
     • If outfit light or neutral → darker accent bag (black, chocolate, tan).
     • If outfit dark → lighter contrast (ivory, nude, beige).
     • If outfit colorful → tonal analog (warm camel, soft taupe).
   - The bag must sit realistically on the pedestal, lit by the same light direction.

2️⃣ **Shoes (on floor, centered below rack):**
   - AI automatically generates shoes that complement both outfit and bag in tone and mood.
   - Style logic:
     • Dresses/skirts → pumps, slingbacks, or mules.
     • Trousers/suits → loafers, pointed heels, or structured flats.
     • Relaxed sets → sandals or minimalist sneakers.
   - Color harmony:
     • Shoes either match or stay one tone lighter than the bag.
     • Use only neutral, metallic, or soft tonal shades — never saturated hues.
   - Shoes placed symmetrically, toes forward, shadow direction matching light source.

Lighting & Color:
- White balance: warm-neutral daylight (~4800K).
- Keep overall tone balanced, soft, and realistic.
- No high contrast or spotlights.

Composition:
- Camera angle straight-on, mid-height.
- Equal headroom above rack and foot space below shelf.
- Everything aligned on center axis.

Negative prompt:
no mannequin, no human, no clutter, no text, no bright colors, no mirror, no harsh shadows, no ceiling cables, no props outside scene, no perspective tilt, no spotlight beams, no white background.

Absolute priorities:
- Scene geometry (wall, rack, pedestal, floor, lighting) remains identical.
- Bag and shoes adapt intelligently to outfit tone and style.
  `;

  const outfitTypeMap: Record<GarmentType, string> = {
    'one-piece': 'the one-piece garment (dress, jumpsuit, single shirt, single pants/skirt)',
    'two-piece': 'the two-piece set (shirt + pants, shirt + skirt)',
    'three-piece': 'the three-piece set (shirt + pants/skirt + jacket/outer layer)'
  };
  const outfitTypeText = outfitTypeMap[garmentType];
  return basePrompt.replace(/\$\{outfitType\}/g, outfitTypeText);
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

  const accessoriesSection = includeAccessories
    ? '- INCLUDE all accessories that are part of the outfit: belts, scarves, ties, brooches, pins. Display them alongside the garment pieces.'
    : '- EXCLUDE all accessories: no belts, scarves, ties, brooches, jewelry. Extract ONLY the core garment pieces.';

  const footwearSection = includeFootwear
    ? '- INCLUDE footwear worn by the model. Display shoes/boots as the bottom-most item in the layout, below all garment pieces.'
    : '- EXCLUDE footwear entirely. Do NOT include any shoes, boots, or sandals.';

  return basePrompt
    .replace('${ACCESSORIES_SECTION}', accessoriesSection)
    .replace('${FOOTWEAR_SECTION}', footwearSection);
};

/**
 * Build variation generation prompt
 * @param lookbookStyle - Current lookbook style
 * @param variationCount - Number of variations to generate
 * @returns Variation prompt string
 */
export const buildVariationPrompt = (
  lookbookStyle: LookbookStyle,
  variationCount: number
): string => {
  return `
    **Task**: Generate ${variationCount} professional variations for a product lookbook.
    **Base Image**: Use the provided image as the reference.
    **Instructions**:
    1.  Each variation must be a new, unique, photorealistic image.
    2.  Strictly maintain the core subject (the clothing) and the original '${lookbookStyle}' aesthetic.
    3.  Introduce subtle, professional variations. Ideas:
        *   Slightly different camera angles (e.g., lower, higher, slightly to the side).
        *   Minor adjustments in professional studio lighting (e.g., changing the key light position).
        *   For '${lookbookStyle}', subtle changes in arrangement or pose that a photographer would make between shots.
    4.  **Crucially, do not change the clothing item itself.** The goal is to provide alternative shots of the same product.
    **Goal**: A set of cohesive, e-commerce ready, 2K resolution images that could be used together in a product gallery.
  `;
};

/**
 * Build close-up generation prompts
 * @returns Array of close-up prompt strings
 */
export const buildCloseUpPrompts = (): string[] => {
  return [
    `A hyper-realistic, high-end e-commerce close-up photograph of the garment's neckline or collar area. Focus on capturing the clean lines of the neckline (or collar if present), visible trims, seams, and stitching accuracy. Show texture and finishing details clearly, including buttons or fastenings if they exist. Lighting is soft and directional to highlight edges, fabric sheen, and precision craftsmanship. Background is clean and softly blurred, professional catalog style. Resolution 2K, sharp, color-accurate. Preserve 100% accuracy of garment details.`,
    `A hyper-realistic, high-end e-commerce close-up photograph of the garment's sleeve area. Focus on the sleeve hem and structure — whether long, short, or sleeveless (if sleeveless, highlight the armhole finishing instead). Capture stitching precision, fabric weave, trims, and edge finishing. Lighting is angled and soft, emphasizing subtle folds and fabric depth. Background is clean and softly blurred, professional catalog style. Resolution 2K, sharp, color-accurate. Preserve 100% accuracy of garment details.`,
    `A hyper-realistic, high-end e-commerce close-up photograph of the garment's front lower body section. Focus on showing the front design details clearly — waistband or hemline, seams, pleats, darts, fastenings (buttons, zippers, drawstrings, elastic waistband) if they exist. If the garment has no fastenings, emphasize the clean fabric surface and finishing quality. Capture fabric texture, stitching accuracy, edge finishing, and alignment of details. Lighting is soft and overhead, producing a clean catalog style that highlights craftsmanship. Background is clean and softly blurred. Resolution 2K, sharp, color-accurate. Preserve 100% accuracy of garment details and structure.`
  ];
};

/**
 * Build combined negative prompt for close-up generation
 * @param baseNegativePrompt - User-provided negative prompt
 * @returns Combined negative prompt string
 */
export const buildCloseUpNegativePrompt = (baseNegativePrompt: string): string => {
  const closeUpNegativePrompt = 'no distorted proportions, no extra buttons, no missing buttons, no extra seams, no incorrect stitching, no unrealistic textures, no blurry details, no fabric warping, no duplicated trims, no misplaced zippers, no fake logos, no added accessories, no stains, no wrinkles beyond natural folds, no color shifting, no oversaturation, no underexposure, no pixelation, no watermark, no background objects';
  return [baseNegativePrompt.trim(), closeUpNegativePrompt].filter(Boolean).join(', ');
};
