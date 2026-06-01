import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import {
    useProviderStudioFields,
    MAX_SOURCE_PROMPT_LENGTH,
} from '@/hooks/useProviderStudioFields';
import { ImageFile } from '@/types';

const img = (tag: string): ImageFile => ({ base64: tag, mimeType: 'image/png' });

/** Harness exposing the fields hook + a local images array (as a studio hook would own). */
const useAlignmentHarness = () => {
    const [images, setImages] = useState<ImageFile[]>([]);
    const fields = useProviderStudioFields();
    return { images, setImages, fields };
};

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

describe('useProviderStudioFields source-item alignment (Red Team #1)', () => {
    it('keeps images[i+1] aligned with type/note[i] after add/remove sequences', () => {
        const { result } = renderHook(() => useAlignmentHarness());

        // Set subject, then add two source items.
        act(() => {
            result.current.fields.setSubjectImage(result.current.images, result.current.setImages, img('subject'));
        });
        act(() => {
            result.current.fields.addSourceItem(result.current.images, result.current.setImages, img('src0'));
        });
        act(() => {
            result.current.fields.addSourceItem(result.current.images, result.current.setImages, img('src1'));
        });
        act(() => {
            result.current.fields.setSourceItemType(0, 'shoes');
            result.current.fields.setSourceItemNote(0, 'note-0');
            result.current.fields.setSourceItemType(1, 'bag');
            result.current.fields.setSourceItemNote(1, 'note-1');
        });

        // images = [subject, src0, src1]; types/notes index 0 -> src0, 1 -> src1.
        expect(result.current.images.map((i) => i.base64)).toEqual(['subject', 'src0', 'src1']);

        // Remove the FIRST source item (index 0 -> images[1]).
        act(() => {
            result.current.fields.removeSourceItem(result.current.images, result.current.setImages, 0);
        });

        // images[1] is now the former src1; type/note arrays shifted in lockstep.
        expect(result.current.images.map((i) => i.base64)).toEqual(['subject', 'src1']);
        const opts = result.current.fields.buildPromptOptions();
        expect(opts.sourceItemTypes).toEqual(['bag']);
        expect(opts.sourceItemNotes).toEqual(['note-1']);
    });

    it('replaces a source image at index i (images[i+1]) without disturbing others', () => {
        const { result } = renderHook(() => useAlignmentHarness());

        act(() => {
            result.current.fields.setSubjectImage(result.current.images, result.current.setImages, img('subject'));
        });
        act(() => {
            result.current.fields.addSourceItem(result.current.images, result.current.setImages, img('src0'));
        });
        act(() => {
            result.current.fields.updateSourceItem(result.current.images, result.current.setImages, 0, img('src0-new'));
        });

        expect(result.current.images.map((i) => i.base64)).toEqual(['subject', 'src0-new']);
    });

    it('clearing the subject clears sources to keep alignment unambiguous', () => {
        const { result } = renderHook(() => useAlignmentHarness());

        act(() => {
            result.current.fields.setSubjectImage(result.current.images, result.current.setImages, img('subject'));
        });
        act(() => {
            result.current.fields.addSourceItem(result.current.images, result.current.setImages, img('src0'));
        });
        act(() => {
            result.current.fields.setSubjectImage(result.current.images, result.current.setImages, null);
        });

        expect(result.current.images).toEqual([]);
        const opts = result.current.fields.buildPromptOptions();
        expect(opts.sourceItemTypes).toEqual([]);
        expect(opts.sourceItemNotes).toEqual([]);
    });
});
