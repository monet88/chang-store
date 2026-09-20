import type { ImageFile } from '../types';
import type { LookbookFormState } from '../hooks/useLookbookDraft';
import { aiScanSourceSet } from './ai-scan-blueprint';

/**
 * Engine-agnostic Lookbook prompt input.
 *
 * Both model-family policies consume exactly this shape, so the fields are
 * shared input vocabulary rather than either family's policy.
 */
export interface LookbookPromptInput {
  formState: LookbookFormState;
  images: ImageFile[];
  fabricTextureImage: ImageFile | null;
  /** AI Scan textile deconstruction of the sources (issue #162). */
  outfitBlueprint?: string | null;
}

/**
 * The AI Scan source set of a lookbook run: the garment images in slot order,
 * then the fabric texture image.
 *
 * One definition for the form's panel and the generation hook, because the two
 * must pass the SAME ImageFile objects — object identity is the scan cache key,
 * and a drifted list would label the run with a stale blueprint and pay for a
 * second analysis. `aiScanSourceSet` reserves a slot for the shared reference,
 * so a full garment list can never crowd the fabric texture swatch out of the
 * analysis — the swatch would otherwise be silently dropped.
 */
export const lookbookAiScanSources = (
  clothingImages: Array<{ image: ImageFile | null }>,
  fabricTextureImage: ImageFile | null,
): ImageFile[] => aiScanSourceSet(clothingImages.map((item) => item.image), [fabricTextureImage]);

/**
 * Combined negative prompt for close-up generation.
 *
 * This belongs to the driver request (`negativePrompt`), not to prompt
 * assembly: every image lane sends the same avoid list, so both model-family
 * policies share it instead of restating the wording.
 */
export const buildCloseUpNegativePrompt = (baseNegativePrompt: string): string => {
  const closeUpNegativePrompt = 'invented buttons, invented pockets, invented trims, invented collars, incorrect stitching, distorted proportions, blurry details, fabric warping, color shift, fake logos, watermark, background clutter';
  return [baseNegativePrompt.trim(), closeUpNegativePrompt].filter(Boolean).join(', ');
};
