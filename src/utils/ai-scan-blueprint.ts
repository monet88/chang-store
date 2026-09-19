/**
 * AI Scan blueprint formatting and source selection (issue #162).
 *
 * `analyzeOutfitBlueprint` returns a free-text textile and garment
 * deconstruction. Every image prompt that consumes it — the E-Com Pack lanes
 * and the AI Scan layer in Virtual Try-On, Lookbook, Identity Transfer, Pose
 * Changer and Background Replacer — splices the same block, so the heading and
 * the whitespace live here instead of in each prompt builder.
 */

import type { ImageFile } from '../types';

/** Heading the blueprint rides under inside an image prompt. */
export const AI_SCAN_BLOCK_HEADER =
  'AI SCAN — TEXTILE & GARMENT DECONSTRUCTION (observed in the source images)';

/** Source images analyzed per scan; beyond this the report repeats itself. */
const AI_SCAN_MAX_SOURCES = 4;

const isUsableImage = (image: ImageFile | null | undefined): image is ImageFile =>
  Boolean(image?.base64 && image?.mimeType);

/**
 * The scan source set of ONE generation: the feature's own images first, then
 * the shared reference images (the subject / model the issue asks to
 * deconstruct too).
 *
 * One slot of `AI_SCAN_MAX_SOURCES` is reserved for a shared reference, so a
 * full item list can never crowd the subject — or the fabric texture swatch —
 * out of the analysis it appears in. Callers on both sides of the layer — the
 * panel's pre-scan and the generation call — must pass the SAME ImageFile
 * objects: object identity is the scan cache key.
 */
export const aiScanSourceSet = (
  items: Array<ImageFile | null>,
  shared: Array<ImageFile | null> = [],
): ImageFile[] => {
  const sharedSources = shared.filter(isUsableImage).slice(0, 1);
  const itemSlots = AI_SCAN_MAX_SOURCES - sharedSources.length;
  return [...items.filter(isUsableImage).slice(0, itemSlots), ...sharedSources];
};

/**
 * Splice a blueprint into a prompt as a subordinate technical specification.
 * Returns an empty string when there is no blueprint, so a disabled, failed or
 * cancelled scan leaves the base prompt byte-identical.
 */
export const formatAiScanBlock = (blueprint?: string | null): string => {
  const trimmed = blueprint?.trim();
  return trimmed ? `\n\n${AI_SCAN_BLOCK_HEADER}:\n${trimmed}\n` : '';
};
