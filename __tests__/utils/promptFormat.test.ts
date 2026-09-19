import { describe, expect, it } from 'vitest';
import { promptFormatFor, imagePart, dropRestatedLines } from '@/utils/promptFormat';

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

describe('dropRestatedLines', () => {
  it('filters lines whose text without leading dash matches restated list', () => {
    const text = '- Bullet 1\n- Bullet 2\n- Bullet 3';
    const filtered = dropRestatedLines(text, ['Bullet 1', 'Bullet 3']);
    expect(filtered).toBe('- Bullet 2');
  });

  it('preserves reworded bullets not present in restated list', () => {
    const text = '- Original Bullet\n- Modified Bullet';
    const filtered = dropRestatedLines(text, ['Original Bullet']);
    expect(filtered).toBe('- Modified Bullet');
  });
});
