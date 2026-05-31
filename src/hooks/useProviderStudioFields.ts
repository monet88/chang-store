import { useCallback, useState } from 'react';
import { VirtualTryOnSourceItemType } from '../types';
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
        resetFields,
        buildPromptOptions,
    };
};
