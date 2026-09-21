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
