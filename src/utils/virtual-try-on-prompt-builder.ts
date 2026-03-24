/**
 * Virtual Try-On Prompt Builder - Pure Functions
 *
 * Extracted from VirtualTryOn.tsx to improve maintainability and testability.
 * All prompt generation logic is contained here as pure functions with no side effects.
 */

/**
 * Form state interface for Virtual Try-On prompt building
 */
export interface VirtualTryOnFormState {
  subjectImageCount: number;
  clothingImageCount: number;
  extraPrompt: string;
  backgroundPrompt: string;
  numImages: number;
}

/**
 * Builds the Virtual Try-On generation prompt based on form state
 * Pure function - no side effects, deterministic output
 *
 * @param formState - Current form state with subject/clothing counts and prompts
 * @returns Complete prompt string for image generation
 */
export const buildVirtualTryOnPrompt = (
  formState: VirtualTryOnFormState
): string => {
  const {
    backgroundPrompt,
    clothingImageCount,
    extraPrompt,
  } = formState;

  // Dual-garment path: exactly 2 clothing images → slot 1 = top, slot 2 = bottom
  const isDualGarment = clothingImageCount === 2;



  // IMAGE ROLES — dual-garment binds Image 2 = top, Image 3 = bottom explicitly
  const imageRoles = isDualGarment
    ? "Image 1 (Subject Image): the person/model. Image 2 (Top Garment Image): the top garment to apply (uploaded first). Image 3 (Bottom Garment Image): the bottom garment to apply (uploaded second)."
    : "The **first image** is the 'Subject Image' (the person). All subsequent images are 'Clothing Source Images' (the garments to apply).";

  // Dual-garment waistband-overlap rule (only injected when exactly 2 clothing images)
  const dualGarmentWaistRule = isDualGarment
    ? "3. **[CRITICAL]** DUAL-GARMENT LAYERING: Top (Image 2) drapes OUTSIDE bottom (Image 3) waistband. Preserve source hem length exactly."
    : null;

  const integrationRules = [
    "1. **[CRITICAL]** Completely remove the original outfit. Do NOT blend, reuse, or retain any element of the old clothing.",
    "2. **[CRITICAL]** Tops/shirts/blouses MUST be worn UNTUCKED — hem hangs freely outside the waistband. Never tucked in.",
    ...(dualGarmentWaistRule ? [dualGarmentWaistRule] : []),
    `${isDualGarment ? '4' : '3'}. Fit clothing naturally to the subject's body, respecting pose and proportions.`,
    `${isDualGarment ? '5' : '4'}. Replicate garment construction exactly: neckline, sleeve style, hem length, silhouette, fabric drape, decorative details.`,
    `${isDualGarment ? '6' : '5'}. Preserve correct scale and orientation of patterns — no mirroring, shrinking, or distortion.`,
    `${isDualGarment ? '7' : '6'}. Match lighting, shadows, and color grading of the Subject Image.`,
    `${isDualGarment ? '8' : '7'}. Preserve occlusions: hands, hair, accessories, and natural shadows stay in front of the outfit.`,
  ];

  if (extraPrompt.trim()) {
    integrationRules.push(`${isDualGarment ? '9' : '8'}. ${extraPrompt.trim()}`);
  }

  const promptStructure = {
    imageRoles,
    primaryObjective: "Replace the person's ENTIRE outfit with the garments from the Clothing Source Image(s). The new clothing's design, color, pattern, silhouette, and fabric must be replicated EXACTLY. Zero traces of the original outfit may remain.",
    integrationRules,
    personPreservation: "Accurately preserve: facial features, hairstyle, skin tone, body proportions. Use a natural, confident pose — relaxed posture, soft expression, editorial styling.",
    background: backgroundPrompt.trim()
      ? `Keep the original background from the Subject Image but modify it with this description: "${backgroundPrompt.trim()}". The background must complement both the person and the new outfit.`
      : "Keep the original background from the Subject Image exactly as is.",
    forbidden: [
      "Adding/keeping any part of the original outfit",
      "Tucking tops into bottoms",
      "Adding text, logos, watermarks, or extra people",
      "Distorting body shape, face, or hairstyle",
    ]
  };

  return `
# INSTRUCTION: VIRTUAL FASHION TRY-ON

## 1. IMAGE ROLES
${promptStructure.imageRoles}

## 2. PRIMARY OBJECTIVE
${promptStructure.primaryObjective}

## 3. INTEGRATION RULES (ranked by priority)
${promptStructure.integrationRules.join('\n')}

## 4. PERSON PRESERVATION
${promptStructure.personPreservation}

## 5. BACKGROUND
**Action:** ${promptStructure.background}

## 6. FORBIDDEN
${promptStructure.forbidden.map(rule => `- ${rule}`).join('\n')}
  `.trim();
};
