import { describe, it, expect } from 'vitest';
import { buildVirtualTryOnParts, VirtualTryOnPromptInput } from '@/utils/virtual-try-on-prompt-builder';
import type { Part } from '@google/genai';

const mockImage = (id: string) => ({
  base64: `mock-base64-${id}`,
  mimeType: 'image/png' as const,
});

const defaultInput: VirtualTryOnPromptInput = {
  subjectImage: mockImage('subject'),
  sourceItems: [{ image: mockImage('clothing-1'), sourceItemType: 'clothing' }],
  extraPrompt: '',
  backgroundPrompt: '',
};

const mixedSourceInput: VirtualTryOnPromptInput = {
  subjectImage: mockImage('subject'),
  sourceItems: [
    { image: mockImage('shirt'), sourceItemType: 'clothing' },
    { image: mockImage('pants'), sourceItemType: 'clothing' },
    { image: mockImage('shoes'), sourceItemType: 'shoes' },
    { image: mockImage('bag'), sourceItemType: 'bag' },
  ],
  extraPrompt: '',
  backgroundPrompt: '',
};

const getFullText = (parts: Part[]): string =>
  parts.filter((p) => p.text).map((p) => p.text).join('\n');

const getTaskText = (parts: Part[]): string => {
  const textParts = parts.filter((p) => p.text);
  return textParts[textParts.length - 1]?.text ?? '';
};

describe('buildVirtualTryOnParts', () => {
  describe('interleaved structure', () => {
    it('single source item returns exactly 5 parts', () => {
      expect(buildVirtualTryOnParts(defaultInput)).toHaveLength(5);
    });

    it('four source items return exactly 11 parts', () => {
      expect(buildVirtualTryOnParts(mixedSourceInput)).toHaveLength(11);
    });

    it('first part is SUBJECT text label', () => {
      const parts = buildVirtualTryOnParts(defaultInput);
      expect(parts[0].text).toContain('SUBJECT');
    });

    it('second part is subject inlineData', () => {
      const parts = buildVirtualTryOnParts(defaultInput);
      expect(parts[1].inlineData?.data).toBe('mock-base64-subject');
    });

    it('labels every source item with its selected type', () => {
      const parts = buildVirtualTryOnParts(mixedSourceInput);
      expect(parts[2].text).toContain('SOURCE ITEM #1 (clothing)');
      expect(parts[4].text).toContain('SOURCE ITEM #2 (clothing)');
      expect(parts[6].text).toContain('SOURCE ITEM #3 (shoes)');
      expect(parts[8].text).toContain('SOURCE ITEM #4 (bag)');
      expect(getFullText(parts)).not.toContain('CLOTHING SOURCE');
    });

    it('keeps source image data in input order', () => {
      const parts = buildVirtualTryOnParts(mixedSourceInput);
      expect(parts[3].inlineData?.data).toBe('mock-base64-shirt');
      expect(parts[5].inlineData?.data).toBe('mock-base64-pants');
      expect(parts[7].inlineData?.data).toBe('mock-base64-shoes');
      expect(parts[9].inlineData?.data).toBe('mock-base64-bag');
    });

    it('last part is task text', () => {
      const parts = buildVirtualTryOnParts(defaultInput);
      const lastPart = parts[parts.length - 1];
      expect(lastPart).toHaveProperty('text');
      expect(lastPart).not.toHaveProperty('inlineData');
    });
  });

  describe('input validation', () => {
    it('throws on null/falsy subjectImage', () => {
      expect(() =>
        buildVirtualTryOnParts({ ...defaultInput, subjectImage: null as unknown as typeof defaultInput.subjectImage })
      ).toThrow('subjectImage is required');
    });

    it('throws on empty sourceItems', () => {
      expect(() =>
        buildVirtualTryOnParts({ ...defaultInput, sourceItems: [] })
      ).toThrow('sourceItems must contain at least one item');
    });

    it('throws on more than four sourceItems', () => {
      expect(() =>
        buildVirtualTryOnParts({
          ...defaultInput,
          sourceItems: [
            { image: mockImage('a'), sourceItemType: 'clothing' },
            { image: mockImage('b'), sourceItemType: 'clothing' },
            { image: mockImage('c'), sourceItemType: 'shoes' },
            { image: mockImage('d'), sourceItemType: 'bag' },
            { image: mockImage('e'), sourceItemType: 'accessory' },
          ],
        })
      ).toThrow('sourceItems must contain 1 to 4 items');
    });

    it('throws on sourceItems with invalid image payload', () => {
      expect(() =>
        buildVirtualTryOnParts({
          ...defaultInput,
          sourceItems: [{ image: { base64: '', mimeType: '' }, sourceItemType: 'bag' }],
        })
      ).toThrow('sourceItems[0] must contain a valid image');
    });
  });

  describe('task text', () => {
    it('contains required sections in order', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      const sections = [
        '## TASK',
        '## SOURCE ITEM TYPES',
        '## APPLICATION RULES',
        '## POSE',
        '## BACKGROUND',
        '## PROHIBITIONS',
        '## CRITICAL RECAP',
      ];

      let lastIndex = -1;
      sections.forEach((section) => {
        const currentIndex = text.indexOf(section);
        expect(currentIndex).toBeGreaterThan(lastIndex);
        lastIndex = currentIndex;
      });
    });

    it('lists each user-selected source type', () => {
      const text = getTaskText(buildVirtualTryOnParts(mixedSourceInput));
      expect(text).toContain('User-selected source types by image');
      expect(text).toContain('- Source item #1: clothing');
      expect(text).toContain('- Source item #2: clothing');
      expect(text).toContain('- Source item #3: shoes');
      expect(text).toContain('- Source item #4: bag');
      expect(text).toContain('Treat each source image as its listed type');
      expect(text).not.toContain('First identify each source image');
    });

    it('includes normalized per-source user notes', () => {
      const text = getTaskText(buildVirtualTryOnParts({
        ...defaultInput,
        sourceItems: [{ image: mockImage('pants'), sourceItemType: 'clothing', sourcePrompt: '  wide pants,\nno hand   in pocket  ' }],
      }));

      expect(text).toContain('- Source item #1: clothing. User note: wide pants, no hand in pocket');
      expect(text).not.toContain('  wide pants');
      expect(text).not.toContain('\nno hand');
    });

    it('keeps clothing replacement rules when clothing exists', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('may contain one garment or a coordinated outfit with multiple garments');
      expect(text).toContain('replace every visible matching clothing category from that source image');
      expect(text).toContain('use the later source item in list order for that category');
      expect(text).toContain('Zero original elements in replaced clothing areas may remain');
      expect(text).toContain('Tops hang freely outside the waistband');
      expect(text).toContain('No tucking tops into pants or skirts');
    });

    it('explicitly treats one clothing source image as a full-look reference when it shows both top and bottom', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('treat it as one full-look reference and transfer every visible garment from that image together');
      expect(text).toContain('remove the subject\'s original top and original bottom together and replace both with the source look in the same result');
      expect(text).toContain('Do not preserve the subject\'s original pants, skirt, shorts, or jeans when the clothing source image already shows a lower-body garment');
      expect(text).toContain('Do not keep the subject\'s original lower-body garment when a clothing source image includes its own lower-body garment');
      expect(text).toContain('including both top and bottom when both are present');
    });

    it('makes non-clothing preservation subordinate to clothing replacements in mixed requests', () => {
      const text = getTaskText(buildVirtualTryOnParts(mixedSourceInput));
      expect(text).toContain('Preserve clothing areas not targeted by any clothing source item');
      expect(text).toContain('Never use shoes, bag, or accessory preservation to keep old clothing that a clothing source item should replace');
      expect(text).not.toContain('Preserve the subject\'s existing outfit');
    });

    it('keeps non-clothing preservation rules when accessories exist', () => {
      const text = getTaskText(buildVirtualTryOnParts({
        ...defaultInput,
        sourceItems: [{ image: mockImage('bag'), sourceItemType: 'bag' }],
      }));
      expect(text).toContain('For every shoes, bag, or accessory source item');
      expect(text).toContain('Preserve clothing areas not targeted by any clothing source item');
      expect(text).toContain('Do not change unrelated clothing');
    });

    it('contains natural fit, occlusion, and lighting requirements', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('fit naturally');
      expect(text).toContain('Preserve occlusions');
      expect(text).toContain('Match the lighting, shadows, and color grading of the ORIGINAL SUBJECT IMAGE exactly');
    });

    it('preserves original pose and does not invent hands in pockets', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('Keep the subject\'s overall pose and stance');
      expect(text).toContain('Minor natural adjustments to posture');
      expect(text).toContain('Do not insert hands into pants pockets or hide fingers unless the subject image already shows hands inside pockets');
      expect(text).toContain('Do not put hands into pants pockets or hide hands');
      expect(text).not.toContain('new dynamic fashion pose');
    });

    it('contains critical recap at the end', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      const recapIndex = text.indexOf('## CRITICAL RECAP');
      expect(recapIndex).toBeGreaterThan(0);
      expect(text.substring(recapIndex + '## CRITICAL RECAP'.length)).not.toMatch(/^## /m);
      expect(text).toContain('Each source item is 100% preserved');
      expect(text).toContain('shoes, bags, and accessories do not rewrite unrelated areas');
      expect(text).toContain('Face (100% identical, absolutely no changes to face features/expression)');
      expect(text).toContain('hair/skin preserved; overall pose kept with only minor outfit-fit adjustments allowed');
    });
  });

  describe('form state', () => {
    it('appends extraPrompt when provided', () => {
      const text = getTaskText(buildVirtualTryOnParts({ ...defaultInput, extraPrompt: 'shirt untucked' }));
      expect(text).toContain('shirt untucked');
    });

    it('trims whitespace from extraPrompt', () => {
      const text = getTaskText(buildVirtualTryOnParts({ ...defaultInput, extraPrompt: '   trimmed instruction   ' }));
      expect(text).toContain('trimmed instruction');
      expect(text).not.toContain('   trimmed instruction   ');
    });

    it('uses backgroundPrompt when provided', () => {
      const text = getTaskText(buildVirtualTryOnParts({ ...defaultInput, backgroundPrompt: 'Minimalist white studio' }));
      expect(text).toContain('Minimalist white studio');
      expect(text).toContain('Replace the background entirely with');
    });

    it('keeps original background when empty', () => {
      const text = getTaskText(buildVirtualTryOnParts({ ...defaultInput, backgroundPrompt: '' }));
      expect(text).toContain('Keep the original background from the Subject Image exactly as is');
    });
  });

  describe('legacy patterns removed', () => {
    it('does NOT contain old negative framing or old headers', () => {
      const fullText = getFullText(buildVirtualTryOnParts(defaultInput));
      expect(fullText).not.toContain('Do NOT tuck');
      expect(fullText).not.toContain('# INSTRUCTION: VIRTUAL FASHION TRY-ON');
      expect(fullText).not.toContain('## 1.');
    });
  });
});
