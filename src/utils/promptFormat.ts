/**
 * Prompt assembly format per image lane.
 *
 * Gemini takes interleaved content: a text label immediately before the image it
 * describes. The OpenAI-compatible lane has no interleaved content — its edit
 * endpoint takes one `prompt` plus an ordered `image[]`, and
 * `gptImageEngine.flattenInterleavedParts` folds the text parts into that single
 * prompt. Asking a builder for `'text'` keeps the same role content (the task
 * text, invariants, and prohibitions stay a single source), but assembles it
 * once as a role map that names every image by position, instead of the labels
 * the flattened prompt would otherwise carry a second time.
 */

import type { Part } from '@google/genai';
import type { ImageEngineId, ImageFile } from '../types';

/** Common inline image part helper for interleaved Gemini/GPT requests. */
export const imagePart = (image: ImageFile): Part => ({
  inlineData: { data: image.base64, mimeType: image.mimeType },
});

/** How a builder assembles a request: interleaved parts, or one text block plus ordered images. */
export type PromptFormat = 'parts' | 'text';

/** Both lanes share one wording; only the assembly differs, and the lane picks it here. */
export const promptFormatFor = (engineId: ImageEngineId | undefined): PromptFormat =>
  engineId === 'gptImage' ? 'text' : 'parts';

/**
 * Drop the bullet lines whose text is listed in `restated`.
 *
 * The flat lane is read as one prompt, so a bullet that only repeats a section
 * above it is noise; the interleaved lane quotes it beside an image label. The
 * filter compares whole lines, so a reworded bullet survives instead of
 * silently losing its rule.
 */
export const dropRestatedLines = (text: string, restated: readonly string[]): string =>
  text
    .split('\n')
    .filter((line) => !restated.includes(line.replace(/^- /, '')))
    .join('\n');
