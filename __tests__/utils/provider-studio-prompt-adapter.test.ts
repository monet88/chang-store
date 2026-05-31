import { describe, it, expect } from 'vitest';

import {
    buildProviderStudioPrompt,
    DEFAULT_PROVIDER_LOOKBOOK_STATE,
} from '@/utils/provider-studio-prompt-adapter';
import { Feature, ImageFile } from '@/types';

const mockImage = (id: string): ImageFile => ({
    base64: `mock-base64-${id}`,
    mimeType: 'image/png',
});

describe('buildProviderStudioPrompt', () => {
    it('composes Try-On rules and appends the user note', () => {
        const prompt = buildProviderStudioPrompt(Feature.TryOn, 'wear it', [
            mockImage('subject'),
            mockImage('clothing'),
        ]);

        expect(prompt).toContain('never tucked in');
        expect(prompt).toContain('wear it');
        // Inline image data must NOT leak into the composed text.
        expect(prompt).not.toContain('mock-base64');
    });

    it('composes Clothing Transfer rules', () => {
        const prompt = buildProviderStudioPrompt(Feature.ClothingTransfer, 'swap outfit', [
            mockImage('concept'),
            mockImage('source'),
        ]);

        expect(prompt).toContain('DESTINATION SCENE');
        expect(prompt).toContain('swap outfit');
    });

    it('composes Pattern Generator rules with a reference image', () => {
        const prompt = buildProviderStudioPrompt(Feature.PatternGenerator, 'floral', [mockImage('ref')]);

        expect(prompt).toContain('tile seamlessly');
        expect(prompt).toContain('floral');
    });

    it('uses a reference-agnostic Pattern task when no images are uploaded', () => {
        const prompt = buildProviderStudioPrompt(Feature.PatternGenerator, 'floral', []);

        expect(prompt).toContain('tile seamlessly');
        expect(prompt).not.toContain('based on the reference image(s) above');
        expect(prompt).toContain('floral');
    });

    it('composes Lookbook prompt using the default flat-lay style', () => {
        const prompt = buildProviderStudioPrompt(Feature.Lookbook, 'linen dress', [mockImage('a')]);

        // 'flat lay' default produces the e-commerce flat lay rule text.
        expect(prompt).toContain('flat lay');
        expect(prompt).toContain('linen dress');
        expect(DEFAULT_PROVIDER_LOOKBOOK_STATE.lookbookStyle).toBe('flat lay');
    });

    it('passes the AI Editor prompt through unchanged', () => {
        expect(buildProviderStudioPrompt(Feature.AIEditor, 'x', [mockImage('a')])).toBe('x');
    });

    it('falls back to the raw prompt when Try-On is missing images', () => {
        expect(buildProviderStudioPrompt(Feature.TryOn, 'raw', [mockImage('only-one')])).toBe('raw');
        expect(buildProviderStudioPrompt(Feature.TryOn, 'raw', [])).toBe('raw');
    });

    it('falls back to the raw prompt when Clothing Transfer is missing images', () => {
        expect(buildProviderStudioPrompt(Feature.ClothingTransfer, 'raw', [mockImage('one')])).toBe('raw');
    });

    it('reflects per-source-item types in the Try-On composed prompt', () => {
        const prompt = buildProviderStudioPrompt(
            Feature.TryOn,
            '',
            [mockImage('subject'), mockImage('shoes')],
            { sourceItemTypes: ['shoes'], sourceItemNotes: ['white sneakers'] },
        );

        expect(prompt).toContain('shoes');
        expect(prompt).toContain('white sneakers');
    });

    it('injects the background prompt into the Try-On composed prompt', () => {
        const prompt = buildProviderStudioPrompt(
            Feature.TryOn,
            '',
            [mockImage('subject'), mockImage('clothing')],
            { backgroundPrompt: 'sunset beach' },
        );

        expect(prompt).toContain('sunset beach');
    });

    it('prefers the dedicated extra prompt over the main user prompt for Try-On', () => {
        const prompt = buildProviderStudioPrompt(
            Feature.TryOn,
            'main box text',
            [mockImage('subject'), mockImage('clothing')],
            { extraPrompt: 'keep the sleeves rolled' },
        );

        expect(prompt).toContain('keep the sleeves rolled');
        expect(prompt).not.toContain('main box text');
    });

    it('passes a source-item note as the Clothing Transfer reference label', () => {
        const prompt = buildProviderStudioPrompt(
            Feature.ClothingTransfer,
            '',
            [mockImage('concept'), mockImage('source')],
            { sourceItemNotes: ['floral dress'] },
        );

        expect(prompt).toContain('floral dress');
    });

    it('enables the multi-person targeting block for Try-On', () => {
        const prompt = buildProviderStudioPrompt(
            Feature.TryOn,
            '',
            [mockImage('subject'), mockImage('clothing')],
            { isMultiPersonMode: true },
        );

        expect(prompt).toContain('red dot');
    });

    it('uses the user-chosen Lookbook style from the form state', () => {
        const prompt = buildProviderStudioPrompt(
            Feature.Lookbook,
            'linen dress',
            [mockImage('a')],
            { lookbookState: { ...DEFAULT_PROVIDER_LOOKBOOK_STATE, lookbookStyle: 'mannequin' } },
        );

        // Mannequin style emits the mannequin-specific instruction text.
        expect(prompt).toContain('mannequin');
        expect(prompt).toContain('linen dress');
    });

    it('seeds Lookbook clothingDescription from the form state when set', () => {
        const prompt = buildProviderStudioPrompt(
            Feature.Lookbook,
            'main prompt',
            [mockImage('a')],
            {
                lookbookState: {
                    ...DEFAULT_PROVIDER_LOOKBOOK_STATE,
                    clothingDescription: 'silk blouse',
                },
            },
        );

        expect(prompt).toContain('silk blouse');
    });
});
