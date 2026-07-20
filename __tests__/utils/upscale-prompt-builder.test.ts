import { describe, it, expect } from 'vitest';
import { buildUpscalePrompt, buildUpscalePromptTable } from '../../src/utils/upscale-prompt-builder';
import { PROVIDER_UPSCALE_PROMPTS } from '../../src/utils/provider-refine-prompt';

// These strings are locked contracts sent to the image models. The refactor
// must keep them byte-identical to the previous inline tables.
const GEMINI_2K =
  "Upscale this image to 2K resolution. Enhance the details, make the fabric textures look sharp and realistic, and ensure the colors are vibrant and accurate. Keep the model's face and the overall composition exactly the same. Photorealistic, fashion photography quality, 2K quality.";
const GEMINI_4K =
  "Upscale this image to 4K resolution. Enhance the details, make the fabric textures look sharp and realistic, and ensure the colors are vibrant and accurate. Keep the model's face and the overall composition exactly the same. Photorealistic, fashion photography quality, 4K quality.";
const PROVIDER_2K =
  "Upscale this image to 2K resolution. Enhance the details, make the fabric textures look sharp and realistic, and ensure the colors are vibrant and accurate. Keep the subject's face and the overall composition exactly the same. Photorealistic, fashion photography quality, 2K quality.";
const PROVIDER_4K =
  "Upscale this image to 4K resolution. Enhance the details, make the fabric textures look sharp and realistic, and ensure the colors are vibrant and accurate. Keep the subject's face and the overall composition exactly the same. Photorealistic, fashion photography quality, 4K quality.";

describe('buildUpscalePrompt', () => {
  it('produces the Gemini (model) wording byte-for-byte', () => {
    expect(buildUpscalePrompt('2K', 'model')).toBe(GEMINI_2K);
    expect(buildUpscalePrompt('4K', 'model')).toBe(GEMINI_4K);
  });

  it('produces the provider (subject) wording byte-for-byte', () => {
    expect(buildUpscalePrompt('2K', 'subject')).toBe(PROVIDER_2K);
    expect(buildUpscalePrompt('4K', 'subject')).toBe(PROVIDER_4K);
  });

  it('builds a full quality table', () => {
    expect(buildUpscalePromptTable('model')).toEqual({ '2K': GEMINI_2K, '4K': GEMINI_4K });
  });
});

describe('PROVIDER_UPSCALE_PROMPTS', () => {
  it('matches the locked provider wording', () => {
    expect(PROVIDER_UPSCALE_PROMPTS['2K']).toBe(PROVIDER_2K);
    expect(PROVIDER_UPSCALE_PROMPTS['4K']).toBe(PROVIDER_4K);
  });
});
