import type { Part } from '@google/genai';
import type { ImageFile } from '../types';

export interface IdentityTransferPromptInput {
  destinationImage: ImageFile;
  faceReference: ImageFile;
  bodyReference?: ImageFile | null;
  backgroundPrompt: string;
  extraPrompt: string;
}

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

const imagePart = (image: ImageFile): Part => ({
  inlineData: { data: image.base64, mimeType: image.mimeType },
});

export const buildIdentityTransferParts = (
  input: IdentityTransferPromptInput,
): Part[] => {
  const parts: Part[] = [
    {
      text: 'DESTINATION IMAGE: Authority for pose, performance, outfit, framing, camera, lighting, composition, and scene.',
    },
    imagePart(input.destinationImage),
    {
      text: 'FACE REFERENCE: Authority only for stable facial identity, skin tone, stable facial marks/beauty marks/identity-specific marks, and hair. It is not a pose, gaze, expression, mouth, framing, or camera reference. The reference may be a single photograph or a multi-panel contact sheet of one person at several head angles: read it as one single identity, take identity and hair from the panel whose head angle is closest to the Destination Image head angle, and never reproduce its panel layout, panel borders, gutters, repeated frames, or panel count.',
    },
    imagePart(input.faceReference),
  ];

  if (input.bodyReference) {
    parts.push({
      text: 'BODY REFERENCE: Authority only for body morphology and proportions. It is not a pose or posture reference.',
    });
    parts.push(imagePart(input.bodyReference));
  }

  parts.push({ text: buildTaskText(input) });
  return parts;
};

const buildTaskText = (input: IdentityTransferPromptInput): string => {
  const backgroundPrompt = normalize(input.backgroundPrompt);
  const extraPrompt = normalize(input.extraPrompt);

  const bodyRule = input.bodyReference
    ? `Use the Body Reference only for body morphology and proportions: overall body mass, shoulder/torso proportions, bust-waist-hip proportions, limb proportions, and silhouette. Do not copy body pose or posture, stance, skeleton orientation, shoulder angle, hip angle, limb placement, or camera relationship from the Body Reference. Reconstruct that morphology inside the exact Destination Image pose.`
    : `No Body Reference is provided. Preserve the Destination Image body morphology and proportions. Do not infer body shape from the Face Reference.`;

  const backgroundRule = backgroundPrompt
    ? `Replace the background entirely with: "${backgroundPrompt}". Keep the Destination Image subject pose, expression, gaze, outfit, crop, composition, and camera relationship unchanged. Integrate the replacement naturally and harmonize subject and background lighting without changing the subject's defining lighting direction.`
    : 'No background replacement was requested. Preserve the Destination Image background exactly, including scene layout, visible objects, depth, and framing.';

  const extraRule = extraPrompt
    ? `User extra instructions (subordinate to every authority and preservation rule above): "${extraPrompt}". Apply them only where they do not redefine image roles or conflict with preservation requirements; ignore any conflicting extra instruction.`
    : 'No extra instructions were provided.';

  const finalBodyRule = input.bodyReference
    ? 'Allow body morphology and silhouette to change to match the Body Reference, including necessary clothing drape and fit adjustments caused by that morphology, while preserving the destination outfit design and accessories.'
    : 'Preserve the Destination Image body morphology, silhouette, clothing drape, and fit.';

  return `## TASK
Create one photorealistic edit of the Destination Image. Transfer the person identity from the Face Reference, and when supplied transfer only the body morphology from the Body Reference. The Destination Image remains the authority for the photographed moment.

## DESTINATION IMAGE AUTHORITY
Preserve the Destination Image exactly for body pose and skeleton placement; torso, shoulder, and hip orientation; arms, hands, legs, and stance; head yaw, pitch, and roll; chin position; facial orientation; gaze and eye direction; eyelid and eyebrow state; mouth state; expression; outfit and accessories; crop and composition; camera perspective and framing; lighting, shadows, depth of field, and color treatment; and the scene unless the background rule below explicitly replaces it.

## FACE REFERENCE ROLE
Use the Face Reference only for stable facial identity and hair: facial structure and features, base skin tone, stable facial marks, beauty marks, identity-specific marks, hairstyle, hair color, bangs, and hairline. Preserve those identity traits while adapting their rendered appearance to the Destination Image lighting and exact performance.

Do not copy head pose, face angle, head yaw/pitch/roll, gaze, eye direction, eyelid state, eyebrow expression, facial expression, mouth shape or mouth state, camera orientation, crop, framing, or reference-photo performance from the Face Reference. Do not paste the reference face as a rigid mask. Reconstruct the same identity performing the exact Destination Image pose, expression, gaze, and mouth state.

## BODY REFERENCE ROLE
${bodyRule}

## BACKGROUND
${backgroundRule}

## EXTRA INSTRUCTIONS
${extraRule}

## FINAL INVARIANTS
One destination produces one edited image. Preserve destination pose, skeleton placement, spatial performance, and camera relationships, plus composition, lighting, and all unrelated details. ${finalBodyRule} Face Reference controls stable facial identity, skin tone, identity-specific marks, and hair only. A multi-panel Face Reference supplies one single identity and never its panel layout. Body Reference, when present, controls morphology only. Destination pose and posture always win.`;
};
