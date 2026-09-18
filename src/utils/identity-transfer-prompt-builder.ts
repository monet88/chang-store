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
      text: 'FACE REFERENCE: Authority for stable facial identity, skin tone, stable facial marks/beauty marks/identity-specific marks, hair, and the worn makeup and grooming look. It is not a pose, gaze, expression, mouth state, framing, or camera reference. The reference may be a single photograph or a multi-panel contact sheet of one person at several head angles: read it as one single identity, take identity and hair from the panel whose head angle is closest to the Destination Image head angle, and never reproduce its panel layout, panel borders, gutters, repeated frames, or panel count. Ignore and never reproduce any text, labels, numbers, captions, watermarks, or UI chrome the reference carries.',
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
Preserve the Destination Image exactly for body pose and skeleton placement; torso, shoulder, and hip orientation; arms, hands, legs, and stance; head yaw, pitch, and roll; chin position; facial orientation; gaze and eye direction; eyelid and eyebrow state; mouth state; expression; outfit and accessories; nails; crop and composition; camera perspective and framing; lighting, shadows, depth of field, and color treatment; and the scene unless the background rule below explicitly replaces it.

Reproduce the destination expression exactly as photographed: eye openness, gaze direction and focus, lid crease visibility, brow height and shape, lip parting, lip corner tension, cheek and jaw tension. Reproduce the destination colour treatment as well: white balance, colour grade, contrast, saturation, grain, and the rendered skin tone of the photographed subject. The transferred identity must sit inside that grade rather than bring its own rendering.

## FACE REFERENCE ROLE
Use the Face Reference for stable facial identity, hair, and the worn makeup look: facial structure and features; the underlying skin tone family and melanin level, re-rendered inside the Destination Image colour grade, lighting and white balance; the makeup worn in the reference — lash and brow styling, eye and lip styling, lip colour and finish, blush, and contour — carried over as a look and re-lit by the Destination Image lighting; and stable facial marks, beauty marks, identity-specific marks, hairstyle, hair color, bangs, and hairline. Preserve those identity traits while adapting their rendered appearance to the Destination Image lighting and exact performance.

Do not copy head pose, face angle, head yaw/pitch/roll, gaze, eye direction, eyelid state, eyebrow expression, facial expression, mouth shape or mouth state, lens colour, colour grade, white balance, camera orientation, crop, framing, or reference-photo performance from the Face Reference — every one of those comes from the Destination Image instead. Do not paste the reference face as a rigid mask, and never inherit its rendering of skin: no poreless, waxy, porcelain, plastic or airbrushed finish may cross over from the reference. Do not beautify, slim, reshape, smooth, or idealize the face, its skin, or its features. Reconstruct the same identity performing the exact Destination Image pose, expression, gaze, and mouth state.

## SKIN AND SURFACE
Keep the Destination Image skin real at full size: visible pores across the cheeks, nose and forehead; fine lines around the eyes and mouth; natural tone unevenness; small blemishes, freckles, moles and fine facial hair. Rebuild the physical light response across the skin: raking highlights, T-zone oil sheen, and soft contact shadows under the nose, lips, chin and jaw. When a makeup look is carried over from the Face Reference, lay it on as a thin layer that leaves the pores and texture visible through it; foundation must never flatten, seal or blur the surface. Hair keeps individual strands, flyaways and natural density instead of one painted mass, and eyes keep the destination's wet specular highlights, iris texture and separated lashes. This is the one place where the reference may not be followed: a smoother face is never an acceptable result.

## BODY REFERENCE ROLE
${bodyRule}

## BACKGROUND
${backgroundRule}

## EXTRA INSTRUCTIONS
${extraRule}

## FINAL INVARIANTS
One destination produces one edited image. Preserve destination pose, skeleton placement, spatial performance, and camera relationships, plus composition, lighting, and all unrelated details. The worn makeup look — lashes, brows, eye and lip styling, lip colour and finish, blush, contour — is taken from the Face Reference, re-lit by the destination lighting and laid thinly over real skin; nails, outfit and the scene stay with the Destination Image. The destination expression and colour grade win over the Face Reference's own expression, lighting and rendering: the transferred identity is lit, graded, and performing exactly as the Destination Image. ${finalBodyRule} Face Reference controls stable facial identity, the underlying skin tone family (re-rendered in the destination grade), identity-specific marks, hair, and the worn makeup look. A multi-panel Face Reference supplies one single identity and never its panel layout, and no text, label, or watermark from any reference may appear in the result. Body Reference, when present, controls morphology only. Destination pose and posture always win. Avoid plastic or waxy skin, poreless porcelain finish, airbrushed beauty-filter smoothing, smeared foundation, painted-on hair, and dead eyes; keep pores, fine lines and small blemishes visible.`;
};
