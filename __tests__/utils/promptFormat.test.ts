import { describe, expect, it } from 'vitest';
import { imagePart } from '@/utils/promptFormat';

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
