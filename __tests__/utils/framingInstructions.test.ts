import { describe, expect, it } from 'vitest';
import { getEnglishFramingInstruction } from '@/utils/framingInstructions';
import { en } from '@/locales/en';

describe('getEnglishFramingInstruction', () => {
  it('returns default framing instruction when cameraView is undefined or empty', () => {
    expect(getEnglishFramingInstruction(undefined)).toBe('Use default framing provided by the model.');
    expect(getEnglishFramingInstruction('')).toBe('Use default framing provided by the model.');
  });

  it('returns default framing instruction when cameraView is default', () => {
    expect(getEnglishFramingInstruction('default')).toBe('Use default framing provided by the model.');
  });

  it('falls back to default framing for unknown or invalid cameraView keys', () => {
    expect(getEnglishFramingInstruction('unknownKey')).toBe('Use default framing provided by the model.');
    expect(getEnglishFramingInstruction('closeUp')).toBe('Use default framing provided by the model.');
  });

  it('returns English instructions for all defined framing views', () => {
    expect(getEnglishFramingInstruction('fullBody')).toBe(en.framingInstructions.fullBody);
    expect(getEnglishFramingInstruction('halfBody')).toBe(en.framingInstructions.halfBody);
    expect(getEnglishFramingInstruction('kneesUp')).toBe(en.framingInstructions.kneesUp);
  });
});
