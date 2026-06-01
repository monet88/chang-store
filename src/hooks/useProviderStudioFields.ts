import { useCallback, useState } from 'react';
import { ImageFile, VirtualTryOnSourceItemType } from '../types';
import { ProviderStudioPromptOptions } from '../utils/provider-studio-prompt-adapter';

/** Mirrors Gemini's per-source-item note cap. */
export const MAX_SOURCE_PROMPT_LENGTH = 180;

const normalizeNote = (value: string): string =>
    value.replace(/\s+/g, ' ').slice(0, MAX_SOURCE_PROMPT_LENGTH);

/**
 * Shared state for the Phase 3 provider-studio input fields: per-source-item
 * type/note plus dedicated background and extra-instruction fields. Kept in a
 * single hook so both provider studio hooks stay thin and DRY (no Gemini change).
 *
 * Source-item arrays are indexed by SOURCE position — index 0 is the first
 * source image (images[1] for Try-On). Missing entries default in the adapter.
 */
export interface UseProviderStudioFieldsReturn {
    backgroundPrompt: string;
    setBackgroundPrompt: (value: string) => void;
    extraInstructions: string;
    setExtraInstructions: (value: string) => void;
    sourceItemTypes: VirtualTryOnSourceItemType[];
    setSourceItemType: (index: number, type: VirtualTryOnSourceItemType) => void;
    sourceItemNotes: string[];
    setSourceItemNote: (index: number, note: string) => void;
    /**
     * Append a source image. Subject is images[0]; source index i maps to
     * images[i+1]. New source defaults type 'clothing' / empty note. Operates on
     * the studio hook's `images` array via the passed setter so all three arrays
     * stay index-aligned (Red Team #1).
     */
    addSourceItem: (images: ImageFile[], setImages: (next: ImageFile[]) => void, image: ImageFile) => void;
    /** Remove source item at source index i (images[i+1]) and realign type/note arrays. */
    removeSourceItem: (images: ImageFile[], setImages: (next: ImageFile[]) => void, index: number) => void;
    /** Replace the image of source item at source index i (images[i+1]). */
    updateSourceItem: (images: ImageFile[], setImages: (next: ImageFile[]) => void, index: number, image: ImageFile) => void;
    /** Set/replace the subject image (images[0]) without disturbing source alignment. */
    setSubjectImage: (images: ImageFile[], setImages: (next: ImageFile[]) => void, image: ImageFile | null) => void;
    /** Clear all fields (call on active-feature change). */
    resetFields: () => void;
    /** Build the adapter options object from the current field state. */
    buildPromptOptions: () => ProviderStudioPromptOptions;
}

const setAtIndex = <T,>(list: T[], index: number, value: T, fill: T): T[] => {
    const next = list.slice();
    while (next.length <= index) next.push(fill);
    next[index] = value;
    return next;
};

export const useProviderStudioFields = (): UseProviderStudioFieldsReturn => {
    const [backgroundPrompt, setBackgroundPrompt] = useState('');
    const [extraInstructions, setExtraInstructions] = useState('');
    const [sourceItemTypes, setSourceItemTypes] = useState<VirtualTryOnSourceItemType[]>([]);
    const [sourceItemNotes, setSourceItemNotes] = useState<string[]>([]);

    const setSourceItemType = useCallback((index: number, type: VirtualTryOnSourceItemType) => {
        setSourceItemTypes((prev) => setAtIndex(prev, index, type, 'clothing'));
    }, []);

    const setSourceItemNote = useCallback((index: number, note: string) => {
        setSourceItemNotes((prev) => setAtIndex(prev, index, normalizeNote(note), ''));
    }, []);

    const addSourceItem = useCallback(
        (images: ImageFile[], setImages: (next: ImageFile[]) => void, image: ImageFile) => {
            // Subject occupies images[0]; new sources append after it.
            setImages([...(images.length === 0 ? [] : images), image]);
            setSourceItemTypes((prev) => [...prev, 'clothing']);
            setSourceItemNotes((prev) => [...prev, '']);
        },
        [],
    );

    const removeSourceItem = useCallback(
        (images: ImageFile[], setImages: (next: ImageFile[]) => void, index: number) => {
            // source index i -> images[i+1]; drop the same slot from all 3 arrays.
            setImages(images.filter((_, i) => i !== index + 1));
            setSourceItemTypes((prev) => prev.filter((_, i) => i !== index));
            setSourceItemNotes((prev) => prev.filter((_, i) => i !== index));
        },
        [],
    );

    const updateSourceItem = useCallback(
        (images: ImageFile[], setImages: (next: ImageFile[]) => void, index: number, image: ImageFile) => {
            setImages(images.map((current, i) => (i === index + 1 ? image : current)));
        },
        [],
    );

    const setSubjectImage = useCallback(
        (images: ImageFile[], setImages: (next: ImageFile[]) => void, image: ImageFile | null) => {
            if (image === null) {
                // Clearing subject also clears sources to keep alignment unambiguous.
                setImages([]);
                setSourceItemTypes([]);
                setSourceItemNotes([]);
                return;
            }
            setImages(images.length === 0 ? [image] : [image, ...images.slice(1)]);
        },
        [],
    );

    const resetFields = useCallback(() => {
        setBackgroundPrompt('');
        setExtraInstructions('');
        setSourceItemTypes([]);
        setSourceItemNotes([]);
    }, []);

    const buildPromptOptions = useCallback((): ProviderStudioPromptOptions => ({
        sourceItemTypes,
        sourceItemNotes,
        backgroundPrompt,
        extraPrompt: extraInstructions,
    }), [sourceItemTypes, sourceItemNotes, backgroundPrompt, extraInstructions]);

    return {
        backgroundPrompt,
        setBackgroundPrompt,
        extraInstructions,
        setExtraInstructions,
        sourceItemTypes,
        setSourceItemType,
        sourceItemNotes,
        setSourceItemNote,
        addSourceItem,
        removeSourceItem,
        updateSourceItem,
        setSubjectImage,
        resetFields,
        buildPromptOptions,
    };
};
