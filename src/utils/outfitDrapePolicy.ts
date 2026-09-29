/**
 * Outfit Drape Policy
 *
 * Hard-codes the studio invariant: all outfits MUST have shirts/blouses/tops
 * completely untucked (outside pants, shorts, skirts), draping over the waistband.
 * Tucking is strictly disallowed unless the user explicitly permits it in the
 * additional instructions (extra instructions / extra prompt).
 */

/**
 * Keywords that explicitly forbid tucking or ask for untucked shirts.
 * If any of these are present, tucking is definitely not allowed.
 */
const NEGATIVE_TUCK_REGEX =
  /(không\s+(được\s+|bao\s*giờ\s+)?(sơ\s*vin|cắm\s*thùng|đóng\s*thùng|cho\s*áo\s*vào)|đừng\s+(sơ\s*vin|cắm\s*thùng|đóng\s*thùng)|chớ\s+(sơ\s*vin|cắm\s*thùng)|bỏ\s*áo\s*ngoài|(no|never|don't|not|without|stop)\s+tuck|untuck)/i;

/**
 * Keywords that explicitly request or permit tucking.
 */
const POSITIVE_TUCK_REGEX =
  /(cho\s*phép\s+(sơ\s*vin|cắm\s*thùng|đóng\s*thùng)|được\s*phép\s+(sơ\s*vin|cắm\s*thùng|đóng\s*thùng)|sơ\s*vin|cắm\s*thùng|đóng\s*thùng|cho\s*áo\s*vào\s*(trong\s*)?(quần|váy)|\btuck(ed|ing)?(\s+in|\s+into)?\b)/i;
/**
 * Check whether tucking is explicitly allowed by the user.
 * Returns `false` by default (untucked enforced).
 * Only returns `true` if the user explicitly mentions tucking and does not negate it.
 */
export function isTuckingAllowed(extraInstructions?: string | null): boolean {
  if (!extraInstructions || !extraInstructions.trim()) {
    return false;
  }
  const text = extraInstructions.trim();

  // If user says "không sơ vin", "bỏ áo ngoài", "untucked", etc., tucking is NOT allowed.
  if (NEGATIVE_TUCK_REGEX.test(text)) {
    return false;
  }

  // Check if tucking is explicitly requested or permitted
  return POSITIVE_TUCK_REGEX.test(text);
}

/**
 * Affirmative spatial instructions for Gemini/GPT image models to force tops untucked.
 */
export const UNTUCKED_DRAPE_INSTRUCTION =
  'CRITICAL HEM & WAISTBAND OVERLAY: All shirts, blouses, tops, and upper garments MUST be worn completely untucked and hang freely outside the waistband. The bottom hem of the upper garment must visibly drape over and fully cover the waistband, beltline, and top closure/buttons of the pants, shorts, or skirt. Even if the subject, reference model, or destination photo shows a tucked-in shirt or high-waisted bottom, you MUST render the new top fully untucked with its hem extending downward over the waistband. Tops hang freely outside the waistband with natural hem drape; never tucked in.';

/**
 * Prohibition sentence for negative constraint blocks.
 */
export const UNTUCKED_PROHIBITION_LINE =
  'No tucking tops into pants or skirts. All shirts, blouses, and upper garments must remain fully untucked outside the waistband.';

/**
 * Prioritized hemline override for the Virtual Try-On prompt builders (Gemini,
 * GPT Image, Local Qwen): it names the exact failure it forbids (high-waisted
 * bottoms, pre-tucked subject photos) so a busy surrounding prompt cannot
 * re-introduce tucking. Shared so the three policies cannot drift apart.
 */
export const UNTUCKED_OVERRIDE_HEADLINE =
  'CRITICAL OVERRIDE — HEMLINE & WAISTBAND (NEVER TUCK IN): All tops, blouses, and shirts MUST hang completely untucked outside the waistband. Even if the subject in the photo is standing straight, wears high-waisted pants/skirt, or originally had their shirt tucked in, you MUST drape the new top completely outside and over the waistband of the lower garment. The waistband and beltline must be covered or partially overlapped by the top\'s hemline; under no circumstances should the top be stuffed or tucked into the pants/skirt.';
