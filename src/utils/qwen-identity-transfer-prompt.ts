/**
 * Qwen Identity Transfer prompt policy.
 * Owns Qwen-specific prompt wording, reference image ordering (destination first, then face, then body),
 * facial geometry, skin tone, and hair texture preservation, destination scene context, and AI scan blueprint.
 */

import type { Part } from '@google/genai';
import { imagePart } from './imagePart';
import { formatAiScanBlock } from './ai-scan-blueprint';
import type { IdentityTransferPromptInput } from './identity-transfer-prompt-types';

const buildQwenPromptText = (input: IdentityTransferPromptInput): string => {
  const sections: string[] = [];

  sections.push(
    'QWEN IDENTITY TRANSFER SPECIFICATION\n' +
    'TASK: High-fidelity photorealistic identity transfer. Transfer the person\'s identity from the face reference onto the subject in the destination image while strictly preserving the destination pose, clothing, camera framing, lighting, and scene context.',
  );

  const referenceLines = [
    'REFERENCE ROLES:',
    '- image_1: Destination image. Authority for pose, gesture, clothing design, scene composition, lighting, shadows, depth of field, and environment. It is not the authority for facial identity or body morphology.',
    '- image_2: Face reference. Authority for stable facial identity, facial geometry, eye shape and gaze, nose structure, lips, skin tone, hair texture, hairstyle, and facial features. Faithfully transfer this person\'s identity onto the subject in image_1.',
  ];

  if (input.bodyReference) {
    referenceLines.push(
      '- image_3: Body reference. Authority for body morphology, build, silhouette, bust volume, and physical proportions. The subject must adopt these body contours instead of the destination body shape.',
    );
  }
  sections.push(referenceLines.join('\n'));

  const facialRealism = [
    'IDENTITY & FACIAL REALISM:',
    'Accurately transfer facial geometry, bone structure, eye shape, nose, mouth, jawline, skin tone, and hair texture from image_2.',
    'Render authentic human skin texture with visible fine pores, subtle imperfections, fine lines, and natural skin luster that harmonizes with image_1 lighting.',
    'Do not paste the face as a rigid mask or flat sticker. Blend seamlessly with the head angle, neck, and jawline of image_1.',
    'Avoid artificial plastic or waxy skin, heavy beauty-filter smoothing, cartoonish rendering, or airbrushed textures.',
  ];
  sections.push(facialRealism.join('\n'));

  const destinationPreservation = [
    'SCENE, POSE & LIGHTING PRESERVATION:',
    'Faithfully maintain the exact pose, posture, head angle, facial expression, stance, hand positions, and gestures from image_1.',
    'Preserve the clothing design, outfit textures, accessories, and styling from image_1.',
    'Strictly preserve the camera perspective, focal length, framing, depth of field, and color treatment of image_1.',
    'Harmonize illumination, shadows, color temperature, and ambient reflections to match the environmental lighting of image_1.',
  ];
  sections.push(destinationPreservation.join('\n'));

  const bodyRules = [
    'BODY MORPHOLOGY & PROPORTIONS:',
    input.bodyReference
      ? 'Transfer body morphology, build, curves, and proportions from image_3. Reshape body silhouette and adjust clothing drape to fit the new body contours while preserving the outfit design from image_1.'
      : 'No body reference provided. Faithfully preserve the original body morphology, silhouette, and proportions from image_1.',
  ];
  sections.push(bodyRules.join('\n'));

  const backgroundPrompt = input.backgroundPrompt?.replace(/\s+/g, ' ').trim();
  const backgroundRules = [
    'BACKGROUND & ENVIRONMENT:',
    backgroundPrompt
      ? `Replace the background entirely with: "${backgroundPrompt}". Integrate the replacement naturally while keeping the subject pose, lighting direction, and scene interaction coherent.`
      : 'Preserve the exact background, scene geometry, and environmental lighting from image_1.',
  ];
  sections.push(backgroundRules.join('\n'));

  const prohibitions = [
    'PROHIBITIONS:',
    'Do not alter the destination pose, skeleton orientation, or camera angle from image_1.',
    'Do not change or distort the clothing design from image_1 (except natural drape adjustments for body morphology when image_3 is provided).',
    'Do not generate waxy, plastic, poreless, or airbrushed skin.',
    'Do not alter the facial identity or distinctive features of image_2.',
    'Do not invent or add unwanted text, watermarks, UI elements, or borders.',
  ];
  sections.push(prohibitions.join('\n'));

  const extraPrompt = input.extraPrompt?.replace(/\s+/g, ' ').trim();
  if (extraPrompt) {
    sections.push(`USER INSTRUCTIONS (subordinate to reference roles and preservation rules):\n${extraPrompt}`);
  }

  const baseText = sections.join('\n\n');
  const scanBlock = formatAiScanBlock(input.outfitBlueprint);
  return `${baseText}${scanBlock}`;
};

/**
 * Builds interleaved Part[] for a Local Qwen Identity Transfer job.
 * Enforces deterministic reference ordering:
 * - image_1: destination image (authority for pose, scene, clothing)
 * - image_2: face reference (authority for identity, skin tone, hair)
 * - image_3: optional body reference (authority for morphology)
 */
export const buildQwenIdentityTransferParts = (input: IdentityTransferPromptInput): Part[] => {
  if (!input) {
    throw new Error('input is required');
  }
  if (!input.destinationImage) {
    throw new Error('destinationImage is required');
  }
  if (!input.destinationImage.base64 || !input.destinationImage.mimeType) {
    throw new Error('destinationImage must contain a valid image');
  }
  if (!input.faceReference) {
    throw new Error('faceReference is required');
  }
  if (!input.faceReference.base64 || !input.faceReference.mimeType) {
    throw new Error('faceReference must contain a valid image');
  }
  if (input.bodyReference && (!input.bodyReference.base64 || !input.bodyReference.mimeType)) {
    throw new Error('bodyReference must contain a valid image when provided');
  }

  const promptText = buildQwenPromptText(input);

  const parts: Part[] = [
    { text: promptText },
    imagePart(input.destinationImage),
    imagePart(input.faceReference),
  ];

  if (input.bodyReference) {
    parts.push(imagePart(input.bodyReference));
  }

  return parts;
};
