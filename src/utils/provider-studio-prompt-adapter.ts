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
import { Feature, ImageFile, VirtualTryOnSourceItemType } from '../types';
import { buildVirtualTryOnParts } from './virtual-try-on-prompt-builder';
import { buildClothingTransferParts } from './clothing-transfer-prompt-builder';
import { buildPatternGeneratorParts, TASK_PROMPT, TEXT_ONLY_TASK_PROMPT } from './pattern-generator-prompt-builder';
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
 * Reference-agnostic Pattern Generator task for text-only provider requests.
 * Keeps the no-image flow coherent while the image flow uses `TASK_PROMPT`.
 */
const PATTERN_TASK_TEXT_ONLY = TEXT_ONLY_TASK_PROMPT;

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
 * Optional structured metadata for a richer composed prompt (Phase 3).
 *
 * - `sourceItemTypes[i]` types the i-th SOURCE image (image[1..] for Try-On).
 *   Index 0 corresponds to the first source item (i.e. images[1]).
 * - `sourceItemNotes[i]` is a short per-source-item note (capped by the caller).
 * - `backgroundPrompt` maps to the Try-On builder's background section.
 * - `extraPrompt` maps to the builder's extra-instructions section. When
 *   provided, it takes precedence over `userPrompt` as the builder's extra note
 *   (the studio's main prompt box and the dedicated extra field stay distinct).
 */
export interface ProviderStudioPromptOptions {
    sourceItemTypes?: VirtualTryOnSourceItemType[];
    sourceItemNotes?: string[];
    backgroundPrompt?: string;
    extraPrompt?: string;
    /**
     * Enables the Try-On builder's multi-person targeting block. The caller must
     * composite the red-dot marker onto the subject image BEFORE generation; this
     * flag only toggles the matching prohibition text in the prompt.
     */
    isMultiPersonMode?: boolean;
    /**
     * Full Lookbook form state (Phase 6). When provided, the Lookbook branch
     * composes the prompt from the user-chosen style/garment/fabric/negative
     * instead of the forced default. `clothingDescription` falls back to the
     * main user prompt when empty.
     */
    lookbookState?: LookbookFormState;
    /** Optional fabric texture image for the Lookbook branch. */
    fabricTextureImage?: ImageFile | null;
}

/**
 * Compose a builder-enriched prompt string for a provider studio request.
 *
 * Images are NOT embedded — they flow to the service separately, so only the
 * builder's text segments are returned. Falls back to the raw `userPrompt` when
 * a builder's image preconditions are not met (the adapter never throws).
 *
 * `options` carries the Phase 3 structured fields (source-item types/notes,
 * background, extra instructions). It is optional so callers without those
 * fields keep working unchanged.
 */
export const buildProviderStudioPrompt = (
    feature: Feature,
    userPrompt: string,
    images: ImageFile[],
    options: ProviderStudioPromptOptions = {},
): string => {
    switch (feature) {
        case Feature.TryOn: {
            // Requires subject (image[0]) + at least one source item (image[1..]).
            if (images.length < 2) return userPrompt;
            const [subjectImage, ...sourceImages] = images;
            const { sourceItemTypes = [], sourceItemNotes = [], backgroundPrompt = '', extraPrompt, isMultiPersonMode = false } = options;
            const parts = buildVirtualTryOnParts({
                subjectImage,
                sourceItems: sourceImages.map((image, index) => ({
                    image,
                    sourceItemType: sourceItemTypes[index] ?? 'clothing',
                    sourcePrompt: sourceItemNotes[index] ?? '',
                })),
                extraPrompt: (extraPrompt ?? userPrompt) || '',
                backgroundPrompt,
                isMultiPersonMode,
            });
            return extractText(parts);
        }

        case Feature.ClothingTransfer: {
            // Requires concept (image[0]) + at least one source outfit (image[1..]).
            if (images.length < 2) return userPrompt;
            const [conceptImage, ...referenceImages] = images;
            const { sourceItemNotes = [], extraPrompt } = options;
            const parts = buildClothingTransferParts(
                conceptImage,
                referenceImages.map((image, index) => ({ image, label: sourceItemNotes[index] ?? '' })),
                (extraPrompt ?? userPrompt) || '',
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
            // Phase 6: use the user-driven form state when provided; the main
            // prompt seeds clothingDescription when the form field is empty.
            const baseState = options.lookbookState ?? DEFAULT_PROVIDER_LOOKBOOK_STATE;
            const clothingDescription = baseState.clothingDescription.trim() || userPrompt;
            return buildLookbookPrompt(
                { ...baseState, clothingDescription },
                images,
                options.fabricTextureImage ?? baseState.fabricTextureImage ?? null,
            );
        }

        // AI Editor (and any other feature): Gemini has no builder — pass through.
        default:
            return userPrompt;
    }
};
