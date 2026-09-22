/**
 * Shared flattening of the interleaved `Part[]` the workflow hooks hand every
 * image engine (role labels + images). Engines whose transport has no
 * interleaved content turn the text parts into one `prompt` and the inline
 * parts into the ordered `image[]` files.
 */

import type { Part } from '@google/genai';
import type { ImageFile } from '../types';

/** `null` when there are no parts, so callers keep their own prompt/images fallback. */
export const flattenInterleavedParts = (
  parts: Part[] | undefined,
): { prompt: string; images: ImageFile[] } | null => {
  if (!parts?.length) return null;
  return {
    prompt: parts.flatMap((part) => (part.text ? [part.text] : [])).join('\n\n'),
    images: parts.flatMap((part) =>
      part.inlineData?.data
        ? [{ base64: part.inlineData.data, mimeType: part.inlineData.mimeType ?? 'image/png' }]
        : [],
    ),
  };
};
