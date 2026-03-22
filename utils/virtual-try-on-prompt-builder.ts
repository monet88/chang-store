interface VirtualTryOnPromptInput {
  backgroundPrompt: string;
  extraPrompt: string;
}

/**
 * Builds the text prompt for Virtual Try-On requests.
 * The first image is the subject; all following images are the shared outfit set.
 */
export const buildVirtualTryOnPrompt = ({
  backgroundPrompt,
  extraPrompt,
}: VirtualTryOnPromptInput): string => {
  const newPoseInstruction = `Generate a new dynamic fashion pose that complements the background style and best showcases the outfit from the Clothing Source Image(s):
- Choose a pose that is confident, chic, and magazine-cover ready — never stiff or awkward.
- The posture should naturally highlight the garment's silhouette, details, and fit (e.g., one hand on hip, gentle stride, subtle arm movement, natural weight shift).
- Use editorial, real-model poses: standing tall, relaxed shoulders, soft or neutral facial expression, slight head tilt, elegant hand placement, and an overall relaxed yet stylish attitude.
- Expression should be soft, confident, fashion-forward — such as a gentle smile, subtle smirk, or neutral gaze. Never forced or exaggerated.
- Adjust the pose to enhance the mood and context of the background (e.g., relaxed and inviting in a living room or sofa scene, poised and strong in a minimalist studio, playful and lively in lifestyle settings).
- Always avoid robotic, unnatural, or stiff gestures.`;

  const promptStructure = {
    imageRoles:
      "The first image is the 'Subject Image' (the person). All subsequent images are 'Clothing Source Images' (the garments to apply).",
    absoluteHighestPriority:
      "The generated image must precisely preserve the person's facial features, hairstyle, body shape, skin tone, and proportions from the Subject Image. The resemblance must be unmistakable and identical.",
    task: {
      description:
        'Replace the outfit on the person in the Subject Image with the outfit provided in the Clothing Source Image(s). Use the clothing source(s) as the single source of truth for garment design, color, pattern, silhouette, and fabric texture.',
    },
    integrationRules: [
      'Completely remove the original outfit from the Subject Image; do NOT blend or reuse old clothing elements.',
      "Clothing must fit the subject's body naturally, aligned with pose and proportions.",
      'Respect garment construction from the Clothing Source (neckline, sleeve style, hem length, waistband height, silhouette, fabric drape, decorative details).',
      'CRITICAL STYLING RULE: Tops, shirts, and blouses MUST always be worn UNTUCKED — hanging naturally OUTSIDE the pants/skirt waistband. NEVER tuck any top into the bottom garment. The hem of the top should drape freely over the waistline, showing natural fabric fall. This applies to ALL top garments regardless of style.',
      'Preserve occlusions: keep hands, hair strands, accessories (like bags or cups), and natural shadows in front of the new outfit.',
      'Match lighting, shadows, and color grading of the Subject Image for a seamless result.',
      'Ensure correct scale and orientation of patterns from the Clothing Source (no mirroring, shrinking, duplication, or distortions).',
    ],
    poseAndExpression: {
      selected: newPoseInstruction,
    },
    background: {
      selected: backgroundPrompt.trim()
        ? `Keep the original background from the Subject Image but modify it with this description: "${backgroundPrompt.trim()}". The background must complement both the person and the new outfit.`
        : 'Keep the original background from the Subject Image exactly as is.',
    },
    strictNegativeConstraints: [
      'Do NOT add or keep any parts of the original outfit.',
      'Do NOT tuck tops/shirts/blouses into pants or skirts — tops must ALWAYS hang freely outside the waistband.',
      'Do NOT add text, logos, labels, watermarks, or extra people.',
      'Do NOT distort body shape, face, or hairstyle.',
      'The final output must be clean, photorealistic, high-resolution (2K), and professional-grade.',
    ],
  };

  return `
# INSTRUCTION: VIRTUAL FASHION TRY-ON

## 1. IMAGE ROLES
${promptStructure.imageRoles}

## 2. ABSOLUTE HIGHEST PRIORITY
${promptStructure.absoluteHighestPriority}

## 3. CORE TASK
**Description:** ${promptStructure.task.description}

## 4. INTEGRATION RULES (MUST FOLLOW)
${promptStructure.integrationRules.map((rule) => `- ${rule}`).join('\n')}${extraPrompt.trim() ? `\n- ${extraPrompt.trim()}` : ''}

## 5. POSE & EXPRESSION
**Action:** ${promptStructure.poseAndExpression.selected}

## 6. BACKGROUND
**Action:** ${promptStructure.background.selected}

## 7. STRICT NEGATIVE CONSTRAINTS (DO NOT DO)
${promptStructure.strictNegativeConstraints.map((rule) => `- ${rule}`).join('\n')}
  `.trim();
};
