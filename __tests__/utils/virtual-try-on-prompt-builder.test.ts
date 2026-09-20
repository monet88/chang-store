import { describe, it, expect } from 'vitest';
import { buildVirtualTryOnParts, VirtualTryOnPromptInput } from '@/utils/virtual-try-on-prompt-builder';
import { AI_SCAN_BLOCK_HEADER } from '@/utils/ai-scan-blueprint';
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
      expect(text).toContain('physically correct fabric folds and contact points');
      expect(text).toContain('Preserve occlusions: hands, fingers, hair, existing accessories, and foreground objects stay in front where physically appropriate');
      expect(text).toContain('Match the lighting direction, shadows, and color temperature of the subject image');
    });

    it('preserves original pose and does not invent hands in pockets', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('Keep the subject\'s overall pose and stance');
      expect(text).toContain('Minor natural adjustments to posture');
      expect(text).toContain('Do not insert hands into pants pockets or hide fingers unless the subject image already shows hands inside pockets');
      expect(text).toContain('Do not put hands into pants pockets or hide hands');
      expect(text).not.toContain('new dynamic fashion pose');
    });

    it('distinguishes supported logo/graphic preservation from invented text prohibition', () => {
      const text = getTaskText(buildVirtualTryOnParts(defaultInput));
      expect(text).toContain('Preserve visible graphics, logos, and text that are supported by the source clothing references');
      expect(text).toContain('do not invent new or unsupported logos, text, graphics, or watermarks');
      expect(text).toContain('Preserve source-supported garment graphics and text, but do not invent new logos, text, graphics, or watermarks');
    });

    it('preserves unmarked people and targets marked person in multi-person mode', () => {
      const text = getTaskText(buildVirtualTryOnParts({
        ...defaultInput,
        isMultiPersonMode: true,
      }));
      expect(text).toContain('Modify ONLY the person with the red dot');
      expect(text).toContain('Preserve all other people (without the red dot) in the image exactly as they are');
      expect(text).toContain('Do not add or remove any people');
      expect(text).toContain('Do not modify anyone except the person with the red dot; do not add or remove people');
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

  describe('flat prompt format', () => {
    const promptText = (parts: Part[]) =>
      parts.filter((p) => p.text).map((p) => p.text).join('\n');

    it('sends one prompt that names every image by position, then the images in input order', () => {
      const parts = buildVirtualTryOnParts(mixedSourceInput, 'text');

      expect(parts).toHaveLength(6);
      expect(parts[0].text).toContain('IMAGE 1 = SUBJECT');
      expect(parts[0].text).toContain('IMAGE 2 = SOURCE ITEM #1 (clothing)');
      expect(parts[0].text).toContain('IMAGE 5 = SOURCE ITEM #4 (bag)');
      expect(parts[0].text).toContain('## APPLICATION RULES');
      expect(parts[1].inlineData?.data).toBe('mock-base64-subject');
      expect(parts[2].inlineData?.data).toBe('mock-base64-shirt');
      expect(parts[5].inlineData?.data).toBe('mock-base64-bag');
    });

    it('names each source item once instead of repeating a source-type list', () => {
      const text = promptText(buildVirtualTryOnParts(mixedSourceInput, 'text'));

      expect(text).not.toContain('## SOURCE ITEM TYPES');
      expect(text.match(/SOURCE ITEM #1 \(clothing\)/g)).toHaveLength(1);
      expect(text.match(/SOURCE ITEM #4 \(bag\)/g)).toHaveLength(1);
      expect(text).toContain('Treat each source image as its listed type');
    });

    it('carries each normalized user note on the image it belongs to', () => {
      const text = promptText(buildVirtualTryOnParts({
        ...defaultInput,
        sourceItems: [{ image: mockImage('pants'), sourceItemType: 'clothing', sourcePrompt: '  wide pants,\nno hand   in pocket  ' }],
      }, 'text'));

      expect(text).toContain('IMAGE 2 = SOURCE ITEM #1 (clothing): Apply this item. User note: wide pants, no hand in pocket');
      expect(text).not.toContain('  wide pants');
    });

    it('keeps the shared editing rules when the labels collapse into one prompt', () => {
      const text = promptText(buildVirtualTryOnParts({ ...defaultInput, extraPrompt: 'keep the shoes' }, 'text'));

      expect(text).toContain('## TASK');
      expect(text).toContain('## APPLICATION RULES');
      expect(text).toContain('Zero original elements in replaced clothing areas may remain');
      expect(text).toContain('## PROHIBITIONS');
      expect(text).toContain('## ADDITIONAL INSTRUCTIONS');
    });
    it('drops the prohibition bullets that only restate an earlier section', () => {
      const flat = promptText(buildVirtualTryOnParts(defaultInput, 'text'));

      // Gone: the lower-body and tucking rules (## APPLICATION RULES) and the
      // pockets rule (## POSE) are already stated earlier in this same prompt.
      expect(flat).not.toContain("Do not keep the subject's original lower-body garment");
      expect(flat).not.toContain('No tucking tops into pants or skirts.');
      expect(flat).not.toContain('Do not put hands into pants pockets or hide hands unless');
      // Upstream statements of those same rules must survive.
      expect(flat).toContain("Do not preserve the subject's original pants, skirt, shorts, or jeans");
      expect(flat).toContain('never tucked in');
      expect(flat).toContain('Do not insert hands into pants pockets or hide fingers');
      // Every prohibition with no earlier statement stays.
      ['Do not change unrelated clothing when applying shoes, bag, or accessory items.',
        "Do not alter the subject's face, features, expressions, age, or body proportions.",
        'do not invent new logos, text, graphics, or watermarks',
        'Do not add or remove people.'].forEach((rule) => expect(flat).toContain(rule));
    });

    it('keeps every prohibition on the interleaved lane, dots included', () => {
      const interleaved = promptText(buildVirtualTryOnParts(defaultInput));
      const flat = promptText(buildVirtualTryOnParts({ ...defaultInput, isMultiPersonMode: true }, 'text'));

      expect(interleaved).toContain('No tucking tops into pants or skirts.');
      expect(flat).toContain('Remove the red targeting dot and its white ring completely');
    });
  });

  describe('multi-person marker', () => {
    const multiPersonInput: VirtualTryOnPromptInput = { ...defaultInput, isMultiPersonMode: true };

    it('asks for the targeting dot to be erased in the interleaved format', () => {
      const text = getTaskText(buildVirtualTryOnParts(multiPersonInput));

      expect(text).toContain('The dot and its white ring are targeting marks only: remove them completely from the result');
      expect(text).toContain('Remove the red targeting dot and its white ring completely; no dot, ring, or halo may remain on the person');
    });

    it('asks for the targeting dot to be erased in the flat format too', () => {
      const parts = buildVirtualTryOnParts(multiPersonInput, 'text');
      const text = parts[0].text ?? '';

      expect(text).toContain('The dot and its white ring are targeting marks only: remove them completely from the result');
      expect(text).toContain('Remove the red targeting dot and its white ring completely');
      expect(text).toContain('Modify ONLY the person with the red dot');
    });
  });

  describe('AI Scan blueprint', () => {
    const BLUEPRINT = 'WEAVE & MATERIAL: plissé accordion pleats.\nDRAPE PHYSICS: fluid fall.';

    it('injects the blueprint under the AI Scan heading on both lanes', () => {
      const lanes = (['parts', 'text'] as const).map((format) =>
        getFullText(buildVirtualTryOnParts({ ...defaultInput, outfitBlueprint: BLUEPRINT }, format)),
      );

      lanes.forEach((text) => {
        expect(text).toContain(AI_SCAN_BLOCK_HEADER);
        expect(text).toContain('WEAVE & MATERIAL: plissé accordion pleats.');
        expect(text).toContain('DRAPE PHYSICS: fluid fall.');
      });
    });

    it('carries the blueprint inside the task text, after the TASK paragraph', () => {
      const text = getTaskText(buildVirtualTryOnParts({ ...defaultInput, outfitBlueprint: BLUEPRINT }));

      expect(text.indexOf(AI_SCAN_BLOCK_HEADER)).toBeGreaterThan(text.indexOf('## TASK'));
      expect(text.indexOf(AI_SCAN_BLOCK_HEADER)).toBeLessThan(text.indexOf('## SOURCE ITEM TYPES'));
      expect(text).toContain(`AI SCAN — TEXTILE & GARMENT DECONSTRUCTION (observed in the source images):\n${BLUEPRINT}`);
    });

    it('leaves both lanes byte-identical when no blueprint is supplied', () => {
      (['parts', 'text'] as const).forEach((format) => {
        const base = buildVirtualTryOnParts(defaultInput, format);

        expect(buildVirtualTryOnParts({ ...defaultInput, outfitBlueprint: undefined }, format)).toEqual(base);
        expect(buildVirtualTryOnParts({ ...defaultInput, outfitBlueprint: '' }, format)).toEqual(base);
        expect(getFullText(base)).not.toContain(AI_SCAN_BLOCK_HEADER);
      });
    });

    it('ignores a whitespace-only blueprint', () => {
      const base = buildVirtualTryOnParts(defaultInput);
      const blank = buildVirtualTryOnParts({ ...defaultInput, outfitBlueprint: '  \n ' });

      expect(blank).toEqual(base);
    });
    it('dynamically excludes non-clothing accessories when a structured blueprint contains them', () => {
      const STRUCTURED_BLUEPRINT = `[1. CORE_GARMENTS]
- Upper: Silk blouse.
[2. TEXTILE_PHYSICS]
- Optical: Sheer.
[3. DETECTED_ACCESSORIES]
- Olive canvas tote bag
- Sheer dotted tights`;
      const parts = buildVirtualTryOnParts({ ...defaultInput, outfitBlueprint: STRUCTURED_BLUEPRINT });
      const text = getTaskText(parts);

      expect(text).toContain('Do not transfer non-clothing accessories from the clothing source image:');
      expect(text).toContain('Olive canvas tote bag');
      expect(text).toContain('Sheer dotted tights');
    });
    it('does not append non-clothing accessory exclusion when there is no clothing source item', () => {
      const STRUCTURED_BLUEPRINT = `[1. CORE_GARMENTS]
- Upper: Silk blouse.
[2. TEXTILE_PHYSICS]
- Optical: Sheer.
[3. DETECTED_ACCESSORIES]
- Olive canvas tote bag`;
      const parts = buildVirtualTryOnParts({
        ...defaultInput,
        sourceItems: [{ image: mockImage('bag'), sourceItemType: 'bag' }],
        outfitBlueprint: STRUCTURED_BLUEPRINT,
      });
      const text = getTaskText(parts);

      expect(text).not.toContain('Do not transfer non-clothing accessories from the clothing source image');
    });
  });
});
