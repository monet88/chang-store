import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PROMPT_ID,
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
});
