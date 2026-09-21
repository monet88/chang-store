import type { ImageFile } from '../types';

/**
 * Engine-agnostic Identity Transfer prompt input.
 *
 * Both prompt families consume exactly this shape, so the fields are shared
 * input vocabulary rather than either family's policy.
 */
export interface IdentityTransferPromptInput {
  destinationImage: ImageFile;
  faceReference: ImageFile;
  bodyReference?: ImageFile | null;
  backgroundPrompt: string;
  extraPrompt: string;
  /** AI Scan deconstruction of the outfit in the destination photo (issue #162). */
  outfitBlueprint?: string | null;
}
