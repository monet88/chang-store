import { describe, it, expect } from 'vitest';
import { validatePrompt, MAX_PROMPT_LENGTH } from '@/services/providers/shared/validatePrompt';

describe('validatePrompt', () => {
  it('trims surrounding whitespace', () => {
    expect(validatePrompt('  a fashion photo  ')).toBe('a fashion photo');
  });

  it('strips null bytes and control characters but keeps newlines/tabs', () => {
    const dirty = 'line1\u0000\u0007\nline2\tend';
    expect(validatePrompt(dirty)).toBe('line1\nline2\tend');
  });

  it('throws for empty or whitespace-only prompts', () => {
    expect(() => validatePrompt('')).toThrow('error.provider.prompt.empty');
    expect(() => validatePrompt('   ')).toThrow('error.provider.prompt.empty');
  });

  it('throws when prompt exceeds the max length', () => {
    const tooLong = 'x'.repeat(MAX_PROMPT_LENGTH + 1);
    expect(() => validatePrompt(tooLong)).toThrow('error.provider.prompt.tooLong');
  });

  it('accepts a prompt exactly at the max length', () => {
    const atLimit = 'x'.repeat(MAX_PROMPT_LENGTH);
    expect(validatePrompt(atLimit)).toHaveLength(MAX_PROMPT_LENGTH);
  });
});
