/**
 * Tests for Virtual Try-On Prompt Builder — Interleaved Part[] Output
 *
 * Verifies Part[] structure, input validation, prompt content sections,
 * garment rules, dual-garment logic, form state integration, and determinism.
 */

import { describe, it, expect, test } from 'vitest';
import { buildVirtualTryOnParts, VirtualTryOnPromptInput } from '@/utils/virtual-try-on-prompt-builder';
import type { Part } from '@google/genai';

// --- Test helpers ---

const mockImage = (id: string) => ({
  base64: `mock-base64-${id}`,
  mimeType: 'image/png' as const,
});

const defaultInput: VirtualTryOnPromptInput = {
  subjectImage: mockImage('subject'),
  clothingImages: [mockImage('clothing-1')],
  extraPrompt: '',
  backgroundPrompt: '',
};

const dualGarmentInput: VirtualTryOnPromptInput = {
  subjectImage: mockImage('subject'),
  clothingImages: [mockImage('top'), mockImage('bottom')],
  extraPrompt: '',
  backgroundPrompt: '',
};

const getFullText = (parts: Part[]): string =>
  parts.filter((p) => p.text).map((p) => p.text).join('\n');

const getTaskText = (parts: Part[]): string => {
  const textParts = parts.filter((p) => p.text);
  return textParts[textParts.length - 1]?.text ?? '';
};

// --- Tests ---

describe('buildVirtualTryOnParts', () => {

  // ====================================================================
  // Interleaved structure tests
  // ====================================================================
  describe('interleaved structure', () => {
    it('single garment returns exactly 5 parts', () => {
      const parts = buildVirtualTryOnParts(defaultInput);
      expect(parts).toHaveLength(5);
    });

    it('dual garment returns exactly 7 parts', () => {
      const parts = buildVirtualTryOnParts(dualGarmentInput);
      expect(parts).toHaveLength(7);
    });

    it('first part is SUBJECT text label', () => {
      const parts = buildVirtualTryOnParts(defaultInput);
      expect(parts[0]).toHaveProperty('text');
      expect(parts[0].text).toContain('SUBJECT');
    });

    it('second part is subject inlineData', () => {
      const parts = buildVirtualTryOnParts(defaultInput);
      expect(parts[1]).toHaveProperty('inlineData');
      expect(parts[1].inlineData?.data).toBe('mock-base64-subject');
    });

    it('single garment: third part is CLOTHING SOURCE label', () => {
      const parts = buildVirtualTryOnParts(defaultInput);
      expect(parts[2]).toHaveProperty('text');
      expect(parts[2].text).toContain('CLOTHING SOURCE');
    });

    it('dual garment: has TOP GARMENT and BOTTOM GARMENT labels', () => {
      const parts = buildVirtualTryOnParts(dualGarmentInput);
      expect(parts[2].text).toContain('TOP GARMENT');
      expect(parts[4].text).toContain('BOTTOM GARMENT');
    });

    it('dual garment: image data matches input order', () => {
      const parts = buildVirtualTryOnParts(dualGarmentInput);
      expect(parts[3].inlineData?.data).toBe('mock-base64-top');
      expect(parts[5].inlineData?.data).toBe('mock-base64-bottom');
    });

    it('last part is task text (no inlineData)', () => {
      const parts = buildVirtualTryOnParts(defaultInput);
      const lastPart = parts[parts.length - 1];
      expect(lastPart).toHaveProperty('text');
      expect(lastPart).not.toHaveProperty('inlineData');
    });
  });

  // ====================================================================
  // Input validation tests
  // ====================================================================
  describe('input validation', () => {
    it('throws on null/falsy subjectImage', () => {
      expect(() =>
        buildVirtualTryOnParts({ ...defaultInput, subjectImage: null as unknown as typeof defaultInput.subjectImage })
      ).toThrow('subjectImage is required');
    });

    it('throws on empty clothingImages', () => {
      expect(() =>
        buildVirtualTryOnParts({ ...defaultInput, clothingImages: [] })
      ).toThrow('clothingImages must contain at least one item');
    });

    it('throws on >2 clothingImages', () => {
      expect(() =>
        buildVirtualTryOnParts({
          ...defaultInput,
          clothingImages: [mockImage('a'), mockImage('b'), mockImage('c')],
        })
      ).toThrow('clothingImages must contain 1 or 2 items');
    });
  });

  // ====================================================================
  // Task text - required sections
  // ====================================================================
  describe('task text - required sections', () => {
    it('contains ## TASK', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('## TASK');
    });

    it('contains ## GARMENT RULES', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('## GARMENT RULES');
    });

    it('contains ## POSE', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('## POSE');
    });

    it('contains ## BACKGROUND', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('## BACKGROUND');
    });

    it('contains ## PROHIBITIONS', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('## PROHIBITIONS');
    });

    it('contains ## CRITICAL RECAP at the end', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('## CRITICAL RECAP');
      // RECAP should be the last section — no further ## headers after it
      const recapIndex = text.indexOf('## CRITICAL RECAP');
      const afterRecapContent = text.substring(recapIndex + '## CRITICAL RECAP'.length);
      expect(afterRecapContent).not.toContain('## ');
    });

    it('sections appear in correct order', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      const sections = [
        '## TASK',
        '## GARMENT RULES',
        '## POSE',
        '## BACKGROUND',
        '## PROHIBITIONS',
        '## CRITICAL RECAP',
      ];

      let lastIndex = -1;
      sections.forEach(section => {
        const currentIndex = text.indexOf(section);
        expect(currentIndex).toBeGreaterThan(lastIndex);
        lastIndex = currentIndex;
      });
    });
  });

  // ====================================================================
  // Garment rules - critical styling
  // ====================================================================
  describe('garment rules - critical styling', () => {
    it('contains [CRITICAL] marker', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('[CRITICAL]');
    });

    it('contains untucked rule (positive framing)', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('tops hang freely outside the waistband');
    });

    it('contains zero original outfit requirement', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('zero original outfit elements may remain');
    });

    it('contains natural fit requirement', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('fits naturally');
    });

    it('contains occlusion preservation', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('Preserve occlusions');
    });

    it('contains lighting match requirement', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('Match lighting, shadows, and color grading');
    });
  });

  // ====================================================================
  // Pose - preserve original
  // ====================================================================
  describe('pose - preserve original', () => {
    it('maintains original pose', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('Maintain the subject\'s original pose');
    });

    it('does NOT generate new dynamic pose', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).not.toContain('new dynamic fashion pose');
      expect(text).not.toContain('magazine-cover ready');
    });
  });

  // ====================================================================
  // Prohibitions
  // ====================================================================
  describe('prohibitions', () => {
    it('contains no-tucking prohibition', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('No tucking tops into pants or skirts');
    });

    it('contains no-distortion prohibition', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('No body/face/hair distortion');
    });

    it('contains no-watermarks prohibition', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('No text, logos, watermarks, extra people');
    });
  });

  // ====================================================================
  // Critical recap (recency bias)
  // ====================================================================
  describe('critical recap (recency bias)', () => {
    it('contains clothing source recap', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('Clothing 100% from Source');
    });

    it('contains waistband recap', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('Tops ALWAYS outside waistband');
    });

    it('contains face preservation recap', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('Face/hair/skin preserved exactly');
    });

    it('recap is the last section', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      const recapIndex = text.indexOf('## CRITICAL RECAP');
      expect(recapIndex).toBeGreaterThan(0);
      // No more ## headers after RECAP
      const afterRecap = text.substring(recapIndex + '## CRITICAL RECAP'.length);
      expect(afterRecap).not.toMatch(/^## /m);
    });
  });

  // ====================================================================
  // Dual-garment rules
  // ====================================================================
  describe('dual-garment rules', () => {
    it('dual adds waistband-overlap rule', () => {
      const text = getTaskText(buildVirtualTryOnParts(dualGarmentInput));
      expect(text).toContain('top garment drapes outside the bottom\'s waistband');
    });

    it('dual preserves source hem length', () => {
      const text = getTaskText(buildVirtualTryOnParts(dualGarmentInput));
      expect(text).toContain('preserving source hem length exactly');
    });

    it('single does NOT have waistband-overlap rule', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).not.toContain('top garment drapes outside the bottom\'s waistband');
    });
  });

  // ====================================================================
  // Form state - extraPrompt
  // ====================================================================
  describe('form state - extraPrompt', () => {
    it('appends extraPrompt when provided', () => {
      const input = { ...defaultInput, extraPrompt: 'shirt untucked' };
      const text = getTaskText(buildVirtualTryOnParts(input));
      expect(text).toContain('shirt untucked');
    });

    it('does not append when empty', () => {
      const withEmpty = { ...defaultInput, extraPrompt: '' };
      const withWhitespace = { ...defaultInput, extraPrompt: '   ' };
      const textEmpty = getTaskText(buildVirtualTryOnParts(withEmpty));
      const textWhitespace = getTaskText(buildVirtualTryOnParts(withWhitespace));
      expect(textEmpty).toBe(textWhitespace);
    });

    it('trims whitespace from extraPrompt', () => {
      const input = { ...defaultInput, extraPrompt: '   trimmed instruction   ' };
      const text = getTaskText(buildVirtualTryOnParts(input));
      expect(text).toContain('trimmed instruction');
      expect(text).not.toContain('   trimmed instruction   ');
    });
  });

  // ====================================================================
  // Form state - backgroundPrompt
  // ====================================================================
  describe('form state - backgroundPrompt', () => {
    it('uses backgroundPrompt when provided', () => {
      const input = { ...defaultInput, backgroundPrompt: 'Minimalist white studio' };
      const text = getTaskText(buildVirtualTryOnParts(input));
      expect(text).toContain('Minimalist white studio');
      expect(text).toContain('Replace the background entirely with');
    });

    it('keeps original background when empty', () => {
      const input = { ...defaultInput, backgroundPrompt: '' };
      const text = getTaskText(buildVirtualTryOnParts(input));
      expect(text).toContain('Keep the original background from the Subject Image exactly as is');
    });

    it('keeps original background when whitespace only', () => {
      const input = { ...defaultInput, backgroundPrompt: '   ' };
      const text = getTaskText(buildVirtualTryOnParts(input));
      expect(text).toContain('Keep the original background from the Subject Image exactly as is');
    });

    it('trims whitespace from backgroundPrompt', () => {
      const input = { ...defaultInput, backgroundPrompt: '   Park setting   ' };
      const text = getTaskText(buildVirtualTryOnParts(input));
      expect(text).toContain('Park setting');
      expect(text).not.toContain('   Park setting   ');
    });
  });

  // ====================================================================
  // Determinism
  // ====================================================================
  describe('determinism', () => {
    it('identical inputs produce identical outputs', () => {
      const input = {
        ...defaultInput,
        extraPrompt: 'Test extra',
        backgroundPrompt: 'Test background',
      };
      const parts1 = buildVirtualTryOnParts(input);
      const parts2 = buildVirtualTryOnParts(input);
      expect(getFullText(parts1)).toBe(getFullText(parts2));
      expect(parts1).toHaveLength(parts2.length);
    });
  });

  // ====================================================================
  // Legacy negative — old patterns MUST NOT exist
  // ====================================================================
  describe('legacy patterns removed', () => {
    it('does NOT contain old "Do NOT tuck" negative framing', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).not.toContain('Do NOT tuck');
    });

    it('does NOT contain old INSTRUCTION header', () => {
      const fullText = getFullText(buildVirtualTryOnParts(defaultInput));
      expect(fullText).not.toContain('# INSTRUCTION: VIRTUAL FASHION TRY-ON');
    });

    it('does NOT reference numbered sections (old format)', () => {
      const fullText = getFullText(buildVirtualTryOnParts(defaultInput));
      expect(fullText).not.toContain('## 1.');
      expect(fullText).not.toContain('## 2.');
    });
  });
});
