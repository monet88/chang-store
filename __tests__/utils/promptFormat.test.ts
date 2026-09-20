import { describe, expect, it } from 'vitest';
import { promptFormatFor, imagePart } from '@/utils/promptFormat';

describe('promptFormatFor', () => {
  it('asks the OpenAI-compatible lane for the flat text form', () => {
    expect(promptFormatFor('gptImage')).toBe('text');
  });

  it('keeps the interleaved form for Gemini and for an unwired engine', () => {
    expect(promptFormatFor('gemini')).toBe('parts');
    expect(promptFormatFor(undefined)).toBe('parts');
  });
});

describe('imagePart', () => {
  it('wraps an ImageFile into inlineData part format', () => {
    const part = imagePart({ base64: 'abc123', mimeType: 'image/jpeg' });
    expect(part).toEqual({
      inlineData: {
        data: 'abc123',
        mimeType: 'image/jpeg',
      },
    });
  });
});
