import { describe, it, expect } from 'vitest';
import type { Part } from '@google/genai';

import {
  buildPatternGeneratorParts,
  REFINE_CORRECTION,
  TASK_PROMPT,
  TEXT_ONLY_TASK_PROMPT,
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
  it('assembles flat text format with positional role map and images in order', () => {
    const parts = buildPatternGeneratorParts([mockImage('a'), mockImage('b')], 'CUSTOM TASK', 'text');

    expect(parts).toHaveLength(3);
    expect(parts[0].text).toContain('IMAGE 1 = REFERENCE IMAGE 1');
    expect(parts[0].text).toContain('IMAGE 2 = REFERENCE IMAGE 2');
    expect(parts[0].text).toContain('CUSTOM TASK');
    expect(parts[1]).toEqual({ inlineData: { data: 'mock-base64-a', mimeType: 'image/png' } });
    expect(parts[2]).toEqual({ inlineData: { data: 'mock-base64-b', mimeType: 'image/png' } });
  });

  it('locks the extraction prompt to seamless flat textile requirements', () => {
    expect(TASK_PROMPT).toContain('tileable textile pattern repeat unit');
    expect(TASK_PROMPT).toContain('PATTERN ONLY — NO GARMENT STRUCTURE');
    expect(TASK_PROMPT).toContain('Any motif crossing one edge must continue naturally on the opposite edge');
    expect(TASK_PROMPT).toContain('No mockup, no perspective, no shadows, no fabric folds, no text, no watermark, no logo');
    expect(TASK_PROMPT).toContain('If the reference fabric has no clear printed motif');
  });

  it('exports a reference-agnostic text-only prompt for provider studios', () => {
    expect(TEXT_ONLY_TASK_PROMPT).toContain("from the user's text prompt");
    expect(TEXT_ONLY_TASK_PROMPT).toContain('NO SCENE OR NON-PATTERN ELEMENTS');
    expect(TEXT_ONLY_TASK_PROMPT).toContain('flat, top-down, orthographic 2D textile repeat unit');
    expect(TEXT_ONLY_TASK_PROMPT).not.toContain('reference image');
  });

  it('exports the refinement correction text verbatim', () => {
    expect(REFINE_CORRECTION).toBe(
      '\n\nIMPORTANT: Maintain the exact same tile size, seamless repeat structure, and overall color palette unless explicitly instructed to change them. Only apply the specific modification requested above.'
    );
  });
});
