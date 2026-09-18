import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MODEL_REGISTRY } from '@/config/modelRegistry';
import { GPT_IMAGE_MODELS } from '@/config/gptImageModelRegistry';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

describe('provider isolation regression', () => {
    it('keeps the Gemini model registry free of GPT Image models', () => {
        const ids = MODEL_REGISTRY.map((m) => m.modelId);
        expect(ids.some((id) => id.startsWith('gpt-image'))).toBe(false);
        // All Gemini registry entries stay on the google provider.
        expect(MODEL_REGISTRY.every((m) => m.providerId === 'google')).toBe(true);
    });

    it('keeps provider registries free of Gemini models', () => {
        expect(GPT_IMAGE_MODELS.every((m) => m.modelId.startsWith('gpt-image'))).toBe(true);
    });

    it('does not reference Gemini prompt builders or imageEditingService in provider code', () => {
        const providerFiles = [
            'src/hooks/useGptImageStudio.ts',
            'src/services/providers/gpt-image/gptImageService.ts',
            'src/components/studios/GptImageStudio.tsx',
        ];

        for (const relative of providerFiles) {
            const content = fs.readFileSync(path.join(PROJECT_ROOT, relative), 'utf-8');
            expect(content, `${relative} must not import imageEditingService`).not.toMatch(/imageEditingService/);
            expect(content, `${relative} must not import Gemini prompt builders`).not.toMatch(/prompt-builder/);
            expect(content, `${relative} must not import services/gemini`).not.toMatch(/services\/gemini/);
        }
    });

    it('injects the gateway and provider env vars in vite.config.ts define block', () => {
        const viteConfig = fs.readFileSync(path.join(PROJECT_ROOT, 'vite.config.ts'), 'utf-8');
        expect(viteConfig).toMatch(/process\.env\.CLIPROXY_API_KEY/);
        expect(viteConfig).not.toMatch(/process\.env\.GEMINI_API_KEY/);
        expect(viteConfig).toMatch(/process\.env\.GPT_IMAGE_API_KEY/);
        expect(viteConfig).toMatch(/process\.env\.GPT_IMAGE_BASE_URL/);
    });

    it('does not keep the misleading "Only inject Gemini API key" comment', () => {
        const viteConfig = fs.readFileSync(path.join(PROJECT_ROOT, 'vite.config.ts'), 'utf-8');
        expect(viteConfig).not.toMatch(/Only inject Gemini API key in explicit development mode/);
    });
});
