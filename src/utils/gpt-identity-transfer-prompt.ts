/**
 * GPT Image Identity Transfer prompt policy.
 * Owns the OpenAI-compatible flat role map, compacted instruction brief,
 * and positional image parts for Identity Transfer.
 */

import type { Part } from '@google/genai';
import { imagePart } from './promptFormat';
import { formatAiScanBlock } from './ai-scan-blueprint';
import type { IdentityTransferPromptInput } from './identity-transfer-prompt-types';

const destinationRoleLabel =
  'DESTINATION IMAGE: Authority for pose, performance, outfit design, framing, camera, lighting, composition, and scene. It is not the authority for facial identity or body morphology.';

const faceRoleLabel =
  'FACE REFERENCE: Authority for stable facial identity, skin tone, stable facial marks/beauty marks/identity-specific marks, hair, and the worn makeup and grooming look. It is not a pose, gaze, expression, mouth state, framing, or camera reference. The reference may be a single photograph or a multi-panel contact sheet of one person at several head angles: read it as one single identity, take identity and hair from the panel whose head angle is closest to the Destination Image head angle, and never reproduce its panel layout, panel borders, gutters, repeated frames, or panel count. Ignore and never reproduce any text, labels, numbers, captions, watermarks, or UI chrome the reference carries.';

const bodyRoleLabel =
  'BODY REFERENCE: Authority for body morphology, bust size and chest volume, curves, build, silhouette, and physical mass (full bust, shoulders, waist, hips, and limbs). The output subject must take the body shape, full bust proportions, and curves of this reference, not the Destination Image.';

/** Image roles in authority order: destination first, then face, then body when supplied. */
const rolesOf = (input: IdentityTransferPromptInput): { label: string; image: IdentityTransferPromptInput['destinationImage'] }[] => {
  const roles = [
    { label: destinationRoleLabel, image: input.destinationImage },
    { label: faceRoleLabel, image: input.faceReference },
  ];
  if (input.bodyReference) {
    roles.push({ label: bodyRoleLabel, image: input.bodyReference });
  }
  return roles;
};

/**
 * Build flat Part[] for a GPT Image Identity Transfer job.
 * Produces a single leading text block (role map + compacted brief) followed
 * by the referenced images in positional order.
 */
export const buildGptIdentityTransferParts = (
  input: IdentityTransferPromptInput,
): Part[] => {
  const roles = rolesOf(input);
  const roleMap = roles.map((role, index) => `IMAGE ${index + 1} = ${role.label}`).join('\n');
  return [
    { text: `${roleMap}\n\n${buildGptTaskText(input)}` },
    ...roles.map((role) => imagePart(role.image)),
  ];
};

const buildGptTaskText = (input: IdentityTransferPromptInput): string => {
  const backgroundPrompt = input.backgroundPrompt.replace(/\s+/g, ' ').trim();
  const extraPrompt = input.extraPrompt.replace(/\s+/g, ' ').trim();

  const bodyRule = input.bodyReference
    ? 'Transfer and enforce the body morphology and proportions from the Body Reference: full bust size and chest volume, overall body mass, shoulder width, torso proportions, bust-waist-hip proportions, waistline, limb thickness, and silhouette. The subject must adopt the fuller, larger bust proportions and body curves from the Body Reference rather than the Destination Image. Do not preserve the original Destination Image body shape or bust size. Do not copy body pose or posture, stance, skeleton orientation, shoulder angle, hip angle, limb placement, or camera relationship from the Body Reference. Reconstruct that morphology inside the exact Destination Image pose, and adjust clothing fit, neckline/bustier drape, and natural cleavage to wrap the new body contours.'
    : 'No Body Reference is provided. Preserve the Destination Image body morphology and proportions. Do not infer body shape from the Face Reference.';

  const backgroundRule = backgroundPrompt
    ? `Replace the background entirely with: "${backgroundPrompt}". Keep the Destination Image subject pose, expression, gaze, outfit, crop, composition, and camera relationship unchanged. Integrate the replacement naturally and harmonize subject and background lighting without changing the subject's defining lighting direction.`
    : 'No background replacement was requested. Preserve the Destination Image background exactly, including scene layout, visible objects, depth, and framing.';

  const extraRule = extraPrompt
    ? `User extra instructions (subordinate to every authority and preservation rule above): "${extraPrompt}". Apply them only where they do not redefine image roles or conflict with preservation requirements; ignore any conflicting extra instruction.`
    : 'No extra instructions were provided.';

  const finalBodyRule = input.bodyReference
    ? 'Always reshape body morphology and silhouette to match the Body Reference instead of preserving the destination body shape, including necessary clothing drape and fit adjustments caused by that morphology, while preserving the destination outfit design and accessories.'
    : 'Preserve the Destination Image body morphology, silhouette, clothing drape, and fit.';

  const taskText = `## TASK
Create one photorealistic edit of the Destination Image. Transfer the person identity from the Face Reference, and transfer the body shape, morphology, silhouette, and proportions from the Body Reference. Do not preserve the original Destination Image body shape or proportions when a Body Reference is provided. The Destination Image remains the authority for the photographed pose, outfit design, and scene.

## DESTINATION IMAGE AUTHORITY
Preserve the Destination Image for the photographed pose, gesture, stance, and action (arms, hands, legs, and body angle); head yaw, pitch, and roll; chin position; facial orientation; gaze and eye direction; eyelid and eyebrow state; mouth state; expression; outfit and accessories; nails; crop and composition; camera perspective and framing; lighting, shadows, depth of field, and color treatment; and the scene unless the background rule below explicitly replaces it. When a Body Reference is provided, do NOT preserve the Destination Image body shape or bust proportions — reshape the body build, bust volume, shoulders, waist, and limbs to match the Body Reference while keeping the destination pose.

Reproduce the destination expression exactly as photographed: eye openness, gaze direction and focus, lid crease visibility, brow height and shape, lip parting, lip corner tension, cheek and jaw tension. Reproduce the destination colour treatment as well: white balance, colour grade, contrast, saturation, grain, and the rendered skin tone of the photographed subject. The transferred identity must sit inside that grade rather than bring its own rendering.

## FACE REFERENCE ROLE
Use the Face Reference for stable facial identity, hair, and the worn makeup look: facial structure and features; the underlying skin tone family and melanin level, re-rendered inside the Destination Image colour grade, lighting and white balance; the makeup worn in the reference — lash and brow styling, eye and lip styling, lip colour and finish, blush, and contour — carried over as a look and re-lit by the Destination Image lighting; and stable facial marks, beauty marks, identity-specific marks, hairstyle, hair color, bangs, and hairline. Preserve those identity traits while adapting their rendered appearance to the Destination Image lighting and exact performance.

Do not paste the reference face as a rigid mask, and never inherit its rendering of skin: no poreless, waxy, porcelain, plastic or airbrushed finish may cross over from the reference. Do not beautify, slim, reshape, smooth, or idealize the face, its skin, or its features. Reconstruct the same identity performing the exact Destination Image pose, expression, gaze, and mouth state.

## SKIN AND SURFACE
Keep the Destination Image skin real at full size: visible pores across the cheeks, nose and forehead; fine lines around the eyes and mouth; natural tone unevenness; small blemishes, freckles, moles and fine facial hair. Rebuild the physical light response across the skin: raking highlights, T-zone oil sheen, and soft contact shadows under the nose, lips, chin and jaw. When a makeup look is carried over from the Face Reference, lay it on as a thin layer that leaves the pores and texture visible through it; foundation must never flatten, seal or blur the surface. Hair keeps individual strands, flyaways and natural density instead of one painted mass, and eyes keep the destination's wet specular highlights, iris texture and separated lashes. This is the one place where the reference may not be followed: a smoother face is never an acceptable result.

## BODY REFERENCE ROLE
${bodyRule}

## BACKGROUND
${backgroundRule}

## EXTRA INSTRUCTIONS
${extraRule}

## FINAL INVARIANTS
One destination produces one edited image. ${finalBodyRule} Body Reference, when present, controls morphology and silhouette, replacing destination body proportions. Destination pose and posture always win. Avoid plastic or waxy skin, poreless porcelain finish, airbrushed beauty-filter smoothing, smeared foundation, painted-on hair, and dead eyes; keep pores, fine lines and small blemishes visible.`;

  return `${taskText}${formatAiScanBlock(input.outfitBlueprint)}`;
};
