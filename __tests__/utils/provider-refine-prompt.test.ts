import { describe, it, expect } from 'vitest';

import {
    buildProviderRefinePrompt,
    PROVIDER_UPSCALE_PROMPTS,
} from '@/utils/provider-refine-prompt';

describe('buildProviderRefinePrompt', () => {
    it('wraps the instruction with preservation guidance', () => {
        const prompt = buildProviderRefinePrompt('make the jacket red');

        expect(prompt).toContain('make the jacket red');
        expect(prompt).toContain('Preserve everything else');
        expect(prompt).toContain('ONLY the change');
    });

    it('trims surrounding whitespace from the instruction', () => {
        const prompt = buildProviderRefinePrompt('   add a hat   ');
        expect(prompt).toContain('Requested change: add a hat');
    });
});

describe('PROVIDER_UPSCALE_PROMPTS', () => {
    it('provides distinct 2K and 4K preservation prompts', () => {
        expect(PROVIDER_UPSCALE_PROMPTS['2K']).toContain('2K');
        expect(PROVIDER_UPSCALE_PROMPTS['4K']).toContain('4K');
        expect(PROVIDER_UPSCALE_PROMPTS['2K']).not.toBe(PROVIDER_UPSCALE_PROMPTS['4K']);
    });
});
