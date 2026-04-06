import { describe, it, expect } from 'vitest';
import type { Part } from '@google/genai';

import {
  buildPatternGeneratorParts,
  REFINE_CORRECTION,
  TASK_PROMPT,
} from '@/utils/pattern-generator-prompt-builder';

const mockImage = (id: string) => ({
  base64: `mock-base64-${id}`,
  mimeType: 'image/png' as const,
});

const getTextParts = (parts: Part[]): string[] =>
  parts.filter((part) => part.text).map((part) => part.text ?? '');

describe('buildPatternGeneratorParts', () => {
  it('interleaves reference labels and inline image data in order', () => {
    const parts = buildPatternGeneratorParts([mockImage('a'), mockImage('b')], 'CUSTOM TASK');

    expect(parts).toHaveLength(5);
    expect(parts[0]).toEqual({ text: 'REFERENCE IMAGE 1:' });
    expect(parts[1]).toEqual({ inlineData: { data: 'mock-base64-a', mimeType: 'image/png' } });
    expect(parts[2]).toEqual({ text: 'REFERENCE IMAGE 2:' });
    expect(parts[3]).toEqual({ inlineData: { data: 'mock-base64-b', mimeType: 'image/png' } });
    expect(parts[4]).toEqual({ text: 'CUSTOM TASK' });
  });

  it('uses TASK_PROMPT by default', () => {
    const parts = buildPatternGeneratorParts([mockImage('a')]);

    expect(getTextParts(parts)).toContain(TASK_PROMPT);
    expect(parts[parts.length - 1]).toEqual({ text: TASK_PROMPT });
  });

  it('exports the refinement correction text verbatim', () => {
    expect(REFINE_CORRECTION).toBe(
      '\n\nIMPORTANT: Maintain the exact same tile size, seamless repeat structure, and overall color palette unless explicitly instructed to change them. Only apply the specific modification requested above.'
    );
  });
});
