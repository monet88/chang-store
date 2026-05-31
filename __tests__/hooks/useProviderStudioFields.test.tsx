import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
    useProviderStudioFields,
    MAX_SOURCE_PROMPT_LENGTH,
} from '@/hooks/useProviderStudioFields';

describe('useProviderStudioFields', () => {
    it('sets per-source-item type and note at sparse indices', () => {
        const { result } = renderHook(() => useProviderStudioFields());

        act(() => {
            result.current.setSourceItemType(1, 'shoes');
            result.current.setSourceItemNote(1, 'white sneakers');
        });

        const options = result.current.buildPromptOptions();
        // Index 0 backfilled with defaults, index 1 carries the chosen values.
        expect(options.sourceItemTypes).toEqual(['clothing', 'shoes']);
        expect(options.sourceItemNotes).toEqual(['', 'white sneakers']);
    });

    it('normalizes and caps source-item notes at the max length', () => {
        const { result } = renderHook(() => useProviderStudioFields());
        const longNote = 'a'.repeat(MAX_SOURCE_PROMPT_LENGTH + 50);

        act(() => {
            result.current.setSourceItemNote(0, `  spaced   note  `);
        });
        expect(result.current.sourceItemNotes[0]).toBe(' spaced note ');

        act(() => {
            result.current.setSourceItemNote(0, longNote);
        });
        expect(result.current.sourceItemNotes[0]).toHaveLength(MAX_SOURCE_PROMPT_LENGTH);
    });

    it('maps background and extra fields into prompt options', () => {
        const { result } = renderHook(() => useProviderStudioFields());

        act(() => {
            result.current.setBackgroundPrompt('sunset beach');
            result.current.setExtraInstructions('roll the sleeves');
        });

        const options = result.current.buildPromptOptions();
        expect(options.backgroundPrompt).toBe('sunset beach');
        expect(options.extraPrompt).toBe('roll the sleeves');
    });

    it('clears all fields on reset', () => {
        const { result } = renderHook(() => useProviderStudioFields());

        act(() => {
            result.current.setBackgroundPrompt('bg');
            result.current.setExtraInstructions('extra');
            result.current.setSourceItemType(0, 'bag');
            result.current.setSourceItemNote(0, 'note');
        });

        act(() => {
            result.current.resetFields();
        });

        const options = result.current.buildPromptOptions();
        expect(result.current.backgroundPrompt).toBe('');
        expect(result.current.extraInstructions).toBe('');
        expect(options.sourceItemTypes).toEqual([]);
        expect(options.sourceItemNotes).toEqual([]);
    });
});
