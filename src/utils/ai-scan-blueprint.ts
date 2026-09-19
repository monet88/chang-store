/**
 * AI Scan blueprint formatting (issue #162).
 *
 * `analyzeOutfitBlueprint` returns a free-text textile and garment
 * deconstruction. Every image prompt that consumes it — the E-Com Pack lanes
 * and the AI Scan layer in Virtual Try-On, Lookbook, Identity Transfer, Pose
 * Changer and Background Replacer — splices the same block, so the heading and
 * the whitespace live here instead of in each prompt builder.
 */

/** Heading the blueprint rides under inside an image prompt. */
export const AI_SCAN_BLOCK_HEADER =
  'AI SCAN — TEXTILE & GARMENT DECONSTRUCTION (observed in the source images)';

/**
 * Splice a blueprint into a prompt as a subordinate technical specification.
 * Returns an empty string when there is no blueprint, so a disabled, failed or
 * cancelled scan leaves the base prompt byte-identical.
 */
export const formatAiScanBlock = (blueprint?: string | null): string => {
  const trimmed = blueprint?.trim();
  return trimmed ? `\n\n${AI_SCAN_BLOCK_HEADER}:\n${trimmed}\n` : '';
};
