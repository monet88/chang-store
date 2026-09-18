import { describe, expect, it } from 'vitest';
import { promptFormatFor } from '@/utils/promptFormat';

describe('promptFormatFor', () => {
  it('asks the OpenAI-compatible lane for the flat text form', () => {
    expect(promptFormatFor('gptImage')).toBe('text');
  });

  it('keeps the interleaved form for Gemini and for an unwired engine', () => {
    expect(promptFormatFor('gemini')).toBe('parts');
    expect(promptFormatFor(undefined)).toBe('parts');
  });
});
