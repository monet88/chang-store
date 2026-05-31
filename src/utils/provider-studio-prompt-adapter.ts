/**
 * Provider Studio Prompt Adapter
 *
 * Bridges the Gemini prompt builders (which return interleaved `Part[]`) to the
 * provider services (Grok / GPT Image), which take a `prompt: string` plus a
 * separate `images: ImageFile[]` array.
 *
 * Strategy: reuse each Gemini builder, then extract ONLY the text segments from
 * its `Part[]` output (dropping inline images, since provider services receive
 * images separately). Role-label text ("SUBJECT:", "SOURCE ITEM #1 (clothing):")
 * is preserved so the provider model still understands image ordering.
 *
 * Pure function — no side effects, no React imports. Gemini pipeline untouched.
 */

import type { Part } from '@google/genai';
import { Feature, ImageFile } from '../types';
import { buildVirtualTryOnParts } from './virtual-try-on-prompt-builder';
import { buildClothingTransferParts } from './clothing-transfer-prompt-builder';
import { buildPatternGeneratorParts, TASK_PROMPT } from './pattern-generator-prompt-builder';
import { buildLookbookPrompt, LookbookFormState } from './lookbookPromptBuilder';

/**
 * Join the text segments of a builder's `Part[]`, skipping inline image parts.
 */
const extractText = (parts: Part[]): string =>
    parts
        .map((part) => part.text)
        .filter((text): text is string => typeof text === 'string' && text.length > 0)
        .join('\n\n');

/**
 * Reference-agnostic Pattern Generator task (text-only path): drops the
 * "based on the reference image(s) above" wording so the prompt stays coherent
 * when no reference image is uploaded (red-team F5).
 */
const PATTERN_TASK_TEXT_ONLY = TASK_PROMPT.replace(' based on the reference image(s) above', '');

/**
 * Initial Lookbook form value for provider studios.
 *
 * Phase 6 adds a user-facing picker that overrides this; until then it is the
 * default. `lookbookStyle: 'flat lay'` is a clothing-only presentation — the
 * provider Lookbook workflow uploads CLOTHING reference images (not a person
 * photo), so a person-based style like 'studio background' would be incoherent
 * (red-team F2).
 */
export const DEFAULT_PROVIDER_LOOKBOOK_STATE: LookbookFormState = {
    clothingImages: [],
    fabricTextureImage: null,
    fabricTexturePrompt: '',
    clothingDescription: '',
    lookbookStyle: 'flat lay',
    garmentType: 'one-piece',
    foldedPresentationType: 'boxed',
    mannequinBackgroundStyle: 'minimalistShowroom',
    negativePrompt: '',
    productShotSubType: 'ghost-mannequin',
    includeAccessories: false,
    includeFootwear: false,
};

/**
 * Compose a builder-enriched prompt string for a provider studio request.
 *
 * Images are NOT embedded — they flow to the service separately, so only the
 * builder's text segments are returned. Falls back to the raw `userPrompt` when
 * a builder's image preconditions are not met (the adapter never throws).
 */
export const buildProviderStudioPrompt = (
    feature: Feature,
    userPrompt: string,
    images: ImageFile[],
): string => {
    switch (feature) {
        case Feature.TryOn: {
            // Requires subject (image[0]) + at least one source item (image[1..]).
            if (images.length < 2) return userPrompt;
            const [subjectImage, ...sourceImages] = images;
            const parts = buildVirtualTryOnParts({
                subjectImage,
                sourceItems: sourceImages.map((image) => ({ image, sourceItemType: 'clothing' })),
                extraPrompt: userPrompt,
                backgroundPrompt: '',
            });
            return extractText(parts);
        }

        case Feature.ClothingTransfer: {
            // Requires concept (image[0]) + at least one source outfit (image[1..]).
            if (images.length < 2) return userPrompt;
            const [conceptImage, ...referenceImages] = images;
            const parts = buildClothingTransferParts(
                conceptImage,
                referenceImages.map((image) => ({ image, label: '' })),
                userPrompt,
            );
            return extractText(parts);
        }

        case Feature.PatternGenerator: {
            const trimmed = userPrompt.trim();
            if (images.length === 0) {
                // Text-only: reference-agnostic task + user note.
                return trimmed ? `${PATTERN_TASK_TEXT_ONLY}\n\n${trimmed}` : PATTERN_TASK_TEXT_ONLY;
            }
            const taskPrompt = trimmed ? `${TASK_PROMPT}\n\n${trimmed}` : TASK_PROMPT;
            return extractText(buildPatternGeneratorParts(images, taskPrompt));
        }

        case Feature.Lookbook: {
            // buildLookbookPrompt already returns a string (no Part[] extraction).
            return buildLookbookPrompt(
                { ...DEFAULT_PROVIDER_LOOKBOOK_STATE, clothingDescription: userPrompt },
                images,
                null,
            );
        }

        // AI Editor (and any other feature): Gemini has no builder — pass through.
        default:
            return userPrompt;
    }
};
