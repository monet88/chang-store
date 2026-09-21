import { describe, it, expect } from 'vitest';
import {
  isTuckingAllowed,
  UNTUCKED_DRAPE_INSTRUCTION,
  UNTUCKED_PROHIBITION_LINE,
} from '@/utils/outfitDrapePolicy';
import { buildGeminiVirtualTryOnParts } from '@/utils/gemini-virtual-try-on-prompt';
import { buildGptVirtualTryOnParts } from '@/utils/gpt-virtual-try-on-prompt';
import { buildGeminiClothingTransferParts } from '@/utils/gemini-clothing-transfer-prompt';
import { buildGptClothingTransferParts } from '@/utils/gpt-clothing-transfer-prompt';
import type { VirtualTryOnPromptInput } from '@/utils/virtual-try-on-prompt-types';
import type { ImageFile } from '@/types';

const mockImage: ImageFile = {
  base64: 'mock-base64',
  mimeType: 'image/png',
};

const vtoInput = (extraPrompt: string): VirtualTryOnPromptInput => ({
  subjectImage: mockImage,
  sourceItems: [{ image: mockImage, sourceItemType: 'clothing' }],
  extraPrompt,
  backgroundPrompt: '',
});

describe('outfitDrapePolicy', () => {
  describe('isTuckingAllowed', () => {
    it('returns false for empty, null, or undefined values', () => {
      expect(isTuckingAllowed()).toBe(false);
      expect(isTuckingAllowed('')).toBe(false);
      expect(isTuckingAllowed('   ')).toBe(false);
      expect(isTuckingAllowed(null)).toBe(false);
    });

    it('returns false for unrelated user instructions', () => {
      expect(isTuckingAllowed('make the background a cafe')).toBe(false);
      expect(isTuckingAllowed('tăng độ sáng và tương phản')).toBe(false);
      expect(isTuckingAllowed('add sunglasses and silver necklace')).toBe(false);
    });

    it('returns false when user explicitly requests untucked / forbids tucking', () => {
      expect(isTuckingAllowed('áo không sơ vin')).toBe(false);
      expect(isTuckingAllowed('không được sơ vin')).toBe(false);
      expect(isTuckingAllowed('không cắm thùng')).toBe(false);
      expect(isTuckingAllowed('bỏ áo ngoài quần')).toBe(false);
      expect(isTuckingAllowed('untucked shirt')).toBe(false);
      expect(isTuckingAllowed('do not tuck')).toBe(false);
      expect(isTuckingAllowed('never tuck into pants')).toBe(false);
      expect(isTuckingAllowed('keep top untucked')).toBe(false);
    });

    it('returns true when user explicitly permits or requests tucking', () => {
      expect(isTuckingAllowed('cho phép sơ vin')).toBe(true);
      expect(isTuckingAllowed('được phép sơ vin')).toBe(true);
      expect(isTuckingAllowed('sơ vin áo vào quần')).toBe(true);
      expect(isTuckingAllowed('cắm thùng áo vào váy')).toBe(true);
      expect(isTuckingAllowed('đóng thùng')).toBe(true);
      expect(isTuckingAllowed('cho áo vào trong quần')).toBe(true);
      expect(isTuckingAllowed('cho áo vào váy')).toBe(true);
      expect(isTuckingAllowed('tuck in')).toBe(true);
      expect(isTuckingAllowed('tucked into the shorts')).toBe(true);
      expect(isTuckingAllowed('allow tucking')).toBe(true);
    });
  });

  describe('Virtual Try-On prompt enforcement', () => {
    it('hard-codes untucked drape rules and prohibitions by default', () => {
      const parts = buildGeminiVirtualTryOnParts(vtoInput(''));
      const text = parts.map((p) => p.text || '').join('\n');

      expect(text).toContain(UNTUCKED_DRAPE_INSTRUCTION);
      expect(text).toContain('No tucking tops into pants or skirts.');
      expect(text).toContain('Tops hang freely outside the waistband with natural hem drape; never tucked in.');
    });

    it('removes untucked constraint when user explicitly writes "cho phép sơ vin"', () => {
      const parts = buildGeminiVirtualTryOnParts(vtoInput('cho phép sơ vin'));
      const text = parts.map((p) => p.text || '').join('\n');

      expect(text).not.toContain(UNTUCKED_DRAPE_INSTRUCTION);
      expect(text).not.toContain('No tucking tops into pants or skirts.');
      expect(text).not.toContain('never tucked in');
      expect(text).toContain('cho phép sơ vin');
    });

    it('enforces untucked rules in GPT Virtual Try-On by default', () => {
      const parts = buildGptVirtualTryOnParts(vtoInput(''));
      const text = parts[0]?.text || '';

      expect(text).toContain(UNTUCKED_DRAPE_INSTRUCTION);
      expect(text).toContain('never tucked in');
    });

    it('disables untucked rules in GPT Virtual Try-On when tucking is permitted', () => {
      const parts = buildGptVirtualTryOnParts(vtoInput('tuck the shirt into pants'));
      const text = parts[0]?.text || '';

      expect(text).not.toContain(UNTUCKED_DRAPE_INSTRUCTION);
      expect(text).not.toContain('never tucked in');
      expect(text).toContain('tuck the shirt into pants');
    });
  });

  describe('Clothing Transfer prompt enforcement', () => {
    it('enforces untucked drape rules in Gemini Clothing Transfer by default', () => {
      const parts = buildGeminiClothingTransferParts(mockImage, [{ image: mockImage, label: 'top' }], '');
      const text = parts.map((p) => p.text || '').join('\n');

      expect(text).toContain(UNTUCKED_DRAPE_INSTRUCTION);
      expect(text).toContain(UNTUCKED_PROHIBITION_LINE);
    });

    it('disables untucked drape rules in Gemini Clothing Transfer when user allows tucking', () => {
      const parts = buildGeminiClothingTransferParts(mockImage, [{ image: mockImage, label: 'top' }], 'được phép sơ vin');
      const text = parts.map((p) => p.text || '').join('\n');

      expect(text).not.toContain(UNTUCKED_DRAPE_INSTRUCTION);
      expect(text).not.toContain(UNTUCKED_PROHIBITION_LINE);
      expect(text).toContain('được phép sơ vin');
    });

    it('enforces untucked drape rules in GPT Clothing Transfer by default', () => {
      const parts = buildGptClothingTransferParts(mockImage, [{ image: mockImage, label: 'top' }], '');
      const text = parts[0]?.text || '';

      expect(text).toContain(UNTUCKED_DRAPE_INSTRUCTION);
      expect(text).toContain(UNTUCKED_PROHIBITION_LINE);
    });

    it('disables untucked drape rules in GPT Clothing Transfer when user allows tucking', () => {
      const parts = buildGptClothingTransferParts(mockImage, [{ image: mockImage, label: 'top' }], 'allow tucking');
      const text = parts[0]?.text || '';

      expect(text).not.toContain(UNTUCKED_DRAPE_INSTRUCTION);
      expect(text).not.toContain(UNTUCKED_PROHIBITION_LINE);
      expect(text).toContain('allow tucking');
    });
  });
});
