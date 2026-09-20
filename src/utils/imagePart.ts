/**
 * Common inline image part helper.
 *
 * Feature workflows assemble requests through independent prompt policies at
 * the engine seam, while sharing this transport helper for inline image parts.
 */

import type { Part } from '@google/genai';
import type { ImageFile } from '../types';

/** Common inline image part helper for interleaved Gemini/GPT requests. */
export const imagePart = (image: ImageFile): Part => ({
  inlineData: { data: image.base64, mimeType: image.mimeType },
});
