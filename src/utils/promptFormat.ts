/**
 * Shared Part conversion helper.
 *
 * Feature workflows migrated to independent prompt policies (Virtual Try-On,
 * Clothing Transfer, Identity Transfer, Lookbook) assemble their own requests.
 * This file retains the common inline image part helper.
 */

import type { Part } from '@google/genai';
import type { ImageFile } from '../types';

/** Common inline image part helper for interleaved Gemini/GPT requests. */
export const imagePart = (image: ImageFile): Part => ({
  inlineData: { data: image.base64, mimeType: image.mimeType },
});
