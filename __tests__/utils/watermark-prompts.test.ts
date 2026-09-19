import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PROMPT_ID,
  DEFAULT_WATERMARK_MODEL,
  WATERMARK_MODELS,
  WATERMARK_PROMPTS,
  getPromptText,
} from '@/utils/watermark-prompts';

describe('watermark prompts', () => {
  it('uses clean as the default prompt preset', () => {
    expect(DEFAULT_PROMPT_ID).toBe('clean');
  });

  it('keeps stock prompts free of sensitive watermark/logo/text-overlay wording', () => {
    for (const prompt of WATERMARK_PROMPTS) {
      const normalized = prompt.prompt.toLowerCase();
      expect(normalized).not.toContain('watermark');
      expect(normalized).not.toContain('logo');
      expect(normalized).not.toContain('text overlay');
    }
  });

  it('uses the rewritten default prompt as fallback text', () => {
    expect(getPromptText('missing-id')).toBe(
      WATERMARK_PROMPTS.find((prompt) => prompt.id === DEFAULT_PROMPT_ID)?.prompt,
    );
  });

  it('defaults to gemini-3.1-flash-image and only includes contracted models', () => {
    expect(DEFAULT_WATERMARK_MODEL).toBe('gemini-3.1-flash-image');
    expect(WATERMARK_MODELS.map((m) => m.id)).toEqual(['gemini-3.1-flash-image']);
  });
});
