import { UpscaleQuality } from '../types';

/**
 * Upscale prompt builder — single source of truth for the preservation-first
 * upscale wording shared by the Gemini image service and the provider studios.
 *
 * The only wording difference between the two historical copies was the subject
 * noun ("model's face" for Gemini, "subject's face" for providers), so callers
 * pass the noun they want. Output is byte-identical to the previous inline
 * tables for each caller.
 */

/** Subject noun used in the "Keep the ...'s face" clause. */
export type UpscaleSubjectNoun = 'model' | 'subject';

/** Build the preservation-first upscale prompt for a quality + subject noun. */
export const buildUpscalePrompt = (
  quality: UpscaleQuality,
  subjectNoun: UpscaleSubjectNoun,
): string =>
  `Upscale this image to ${quality} resolution. Enhance the details, make the fabric textures look sharp and realistic, and ensure the colors are vibrant and accurate. Keep the ${subjectNoun}'s face and the overall composition exactly the same. Photorealistic, fashion photography quality, ${quality} quality.`;

/** Build the full quality→prompt table for a given subject noun. */
export const buildUpscalePromptTable = (
  subjectNoun: UpscaleSubjectNoun,
): Record<UpscaleQuality, string> => ({
  '2K': buildUpscalePrompt('2K', subjectNoun),
  '4K': buildUpscalePrompt('4K', subjectNoun),
});
