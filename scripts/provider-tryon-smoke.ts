/**
 * Phase 7 live smoke test — provider Try-On default-prompt tucked-in check.
 *
 * Uses the REAL provider adapter (buildProviderStudioPrompt) + REAL provider
 * edit services against the local proxy. No manual prompt hints — proves the
 * composed builder prompt (rule: "never tucked in") flows through both provider
 * edit paths.
 *
 * Run: npx tsx scripts/provider-tryon-smoke.ts [grok|gpt|both]
 * Env: SMOKE_BASE_URL, SMOKE_API_KEY (defaults to the local proxy).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Feature, ImageFile } from '../src/types';
import { buildProviderStudioPrompt } from '../src/utils/provider-studio-prompt-adapter';
import { editGrokImage } from '../src/services/providers/grok/grokImageService';
import { editGptImage } from '../src/services/providers/gpt-image/gptImageService';
import { DEFAULT_GROK_MODEL, DEFAULT_GROK_ASPECT_RATIO } from '../src/config/grokModelRegistry';
import { DEFAULT_GPT_IMAGE_MODEL } from '../src/config/gptImageModelRegistry';

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:8333/v1';
const API_KEY = process.env.SMOKE_API_KEY ?? 'monet-4292';
const config = { apiKey: API_KEY, baseUrl: BASE_URL };

const loadImage = (path: string): ImageFile => {
    const buf = readFileSync(resolve(path));
    return { base64: buf.toString('base64'), mimeType: 'image/jpeg' };
};

const saveResult = (name: string, image?: ImageFile): void => {
    if (!image) {
        console.log(`  ${name}: NO IMAGE RETURNED`);
        return;
    }
    const outPath = resolve(`.playwright-mcp/smoke-tryon-${name}.jpg`);
    writeFileSync(outPath, Buffer.from(image.base64, 'base64'));
    console.log('  Saved →', outPath);
};

async function runGrok(subject: ImageFile, outfit: ImageFile, prompt: string): Promise<void> {
    console.log('\n=== GROK: editGrokImage ===');
    const start = Date.now();
    const results = await editGrokImage(
        { model: DEFAULT_GROK_MODEL, prompt, images: [subject, outfit], n: 1, aspectRatio: DEFAULT_GROK_ASPECT_RATIO, resolution: '1k' },
        config,
    );
    console.log(`  Returned ${results.length} image(s) in ${((Date.now() - start) / 1000).toFixed(1)}s`);
    saveResult('grok', results[0]);
}

async function runGpt(subject: ImageFile, outfit: ImageFile, prompt: string): Promise<void> {
    console.log('\n=== GPT IMAGE: editGptImage ===');
    const start = Date.now();
    const results = await editGptImage(
        { model: DEFAULT_GPT_IMAGE_MODEL, prompt, images: [subject, outfit], size: '1024x1536', quality: 'high' },
        config,
    );
    console.log(`  Returned ${results.length} image(s) in ${((Date.now() - start) / 1000).toFixed(1)}s`);
    saveResult('gpt', results[0]);
}

async function main(): Promise<void> {
    const subject = loadImage('.playwright-mcp/people.jpg');
    const outfit = loadImage('.playwright-mcp/outfit-2.jpg');

    // DEFAULT path: empty user prompt, no manual hints, default clothing type.
    const composedPrompt = buildProviderStudioPrompt(Feature.TryOn, '', [subject, outfit]);

    console.log('=== Composed Try-On prompt (default) ===');
    console.log('Contains "never tucked in":', composedPrompt.includes('never tucked in'));
    console.log('Prompt length:', composedPrompt.length);
    console.log('Target proxy:', BASE_URL);

    const target = process.argv[2] ?? 'both';
    if (target === 'grok' || target === 'both') await runGrok(subject, outfit, composedPrompt);
    if (target === 'gpt' || target === 'both') await runGpt(subject, outfit, composedPrompt);
}

main().catch((err) => {
    console.error('SMOKE TEST FAILED:', err);
    process.exit(1);
});
