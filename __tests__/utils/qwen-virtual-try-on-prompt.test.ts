import { describe, it, expect } from 'vitest';
import { buildQwenVirtualTryOnParts } from '@/utils/qwen-virtual-try-on-prompt';
import type { VirtualTryOnPromptInput } from '@/utils/virtual-try-on-prompt-types';
import { AI_SCAN_BLOCK_HEADER } from '@/utils/ai-scan-blueprint';
import { UNTUCKED_DRAPE_INSTRUCTION } from '@/utils/outfitDrapePolicy';
import { CAMERA_FRAMING_INSTRUCTION } from '@/utils/cameraFramingPolicy';

const mockImage = (id: string) => ({
  base64: `mock-base64-${id}`,
  mimeType: 'image/png' as const,
});

describe('buildQwenVirtualTryOnParts', () => {
  const defaultInput: VirtualTryOnPromptInput = {
    subjectImage: mockImage('subject'),
    sourceItems: [
      { image: mockImage('top'), sourceItemType: 'clothing', sourcePrompt: 'White silk blouse' },
    ],
    extraPrompt: '',
    backgroundPrompt: '',
  };

  describe('validation', () => {
    it('throws if subjectImage is missing', () => {
      expect(() =>
        buildQwenVirtualTryOnParts({
          ...defaultInput,
          subjectImage: null as unknown as VirtualTryOnPromptInput['subjectImage'],
        }),
      ).toThrow('subjectImage is required');
    });

    it('throws if sourceItems is empty', () => {
      expect(() =>
        buildQwenVirtualTryOnParts({
          ...defaultInput,
          sourceItems: [],
        }),
      ).toThrow('sourceItems must contain at least one item');
    });

    it('throws if sourceItems exceeds 4 items', () => {
      const fiveItems = Array.from({ length: 5 }, (_, i) => ({
        image: mockImage(`item-${i}`),
        sourceItemType: 'clothing' as const,
      }));
      expect(() =>
        buildQwenVirtualTryOnParts({
          ...defaultInput,
          sourceItems: fiveItems,
        }),
      ).toThrow('sourceItems must contain 1 to 4 items');
    });

    it('throws if a source item image is invalid', () => {
      expect(() =>
        buildQwenVirtualTryOnParts({
          ...defaultInput,
          sourceItems: [
            { image: { base64: '', mimeType: 'image/png' }, sourceItemType: 'clothing' },
          ],
        }),
      ).toThrow('sourceItems[0] must contain a valid image');
    });
  });

  describe('reference ordering', () => {
    it('orders references with subject image FIRST, followed by source garments', () => {
      const multiInput: VirtualTryOnPromptInput = {
        subjectImage: mockImage('model-subject'),
        sourceItems: [
          { image: mockImage('blouse'), sourceItemType: 'clothing' },
          { image: mockImage('skirt'), sourceItemType: 'clothing' },
          { image: mockImage('heels'), sourceItemType: 'shoes' },
        ],
        extraPrompt: '',
        backgroundPrompt: '',
      };

      const parts = buildQwenVirtualTryOnParts(multiInput);

      // Part 0 is prompt text
      expect(parts[0].text).toBeDefined();

      // Part 1 must be subject image (image_1)
      expect(parts[1].inlineData?.data).toBe('mock-base64-model-subject');

      // Parts 2..4 must be source items in order (image_2..4)
      expect(parts[2].inlineData?.data).toBe('mock-base64-blouse');
      expect(parts[3].inlineData?.data).toBe('mock-base64-skirt');
      expect(parts[4].inlineData?.data).toBe('mock-base64-heels');
    });
  });

  describe('prompt content and wording', () => {
    it('contains Qwen-specific virtual try-on specification and roles', () => {
      const parts = buildQwenVirtualTryOnParts(defaultInput);
      const promptText = parts[0].text ?? '';

      expect(promptText).toContain('QWEN VIRTUAL TRY-ON SPECIFICATION');
      expect(promptText).toContain('image_1: Primary model/subject to dress');
      expect(promptText).toContain('image_2: Source clothing item');
      expect(promptText).toContain('White silk blouse');
      expect(promptText).toContain(CAMERA_FRAMING_INSTRUCTION);
    });

    it('enforces untucked drape policy when tucking is not requested', () => {
      const parts = buildQwenVirtualTryOnParts(defaultInput);
      const promptText = parts[0].text ?? '';

      expect(promptText).toContain(UNTUCKED_DRAPE_INSTRUCTION);
    });

    it('omits untucked drape instruction and preserves user request when tucking is opted in', () => {
      const parts = buildQwenVirtualTryOnParts({
        ...defaultInput,
        extraPrompt: 'Please tuck the shirt neatly into the trousers',
      });
      const promptText = parts[0].text ?? '';

      expect(promptText).not.toContain(UNTUCKED_DRAPE_INSTRUCTION);
      expect(promptText).toContain('Please tuck the shirt neatly into the trousers');
    });
    it('incorporates AI scan textile blueprint when provided', () => {
      const blueprintText = 'FABRIC: 100% Mulberry Silk, 19mm momme, satin weave with lustrous finish.';
      const parts = buildQwenVirtualTryOnParts({
        ...defaultInput,
        outfitBlueprint: blueprintText,
      });
      const promptText = parts[0].text ?? '';

      expect(promptText).toContain(AI_SCAN_BLOCK_HEADER);
      expect(promptText).toContain(blueprintText);
    });

    it('incorporates background prompt when provided', () => {
      const parts = buildQwenVirtualTryOnParts({
        ...defaultInput,
        backgroundPrompt: 'Parisian fashion boutique interior with soft ambient lighting',
      });
      const promptText = parts[0].text ?? '';

      expect(promptText).toContain('Parisian fashion boutique interior');
    });

    it('handles multi-person targeting instructions when enabled', () => {
      const parts = buildQwenVirtualTryOnParts({
        ...defaultInput,
        isMultiPersonMode: true,
      });
      const promptText = parts[0].text ?? '';

      expect(promptText).toContain('red dot with a white ring marks the target subject');
    });

    it('includes user instructions from extraPrompt', () => {
      const parts = buildQwenVirtualTryOnParts({
        ...defaultInput,
        extraPrompt: 'Roll up the sleeves slightly to forearm level.',
      });
      const promptText = parts[0].text ?? '';

      expect(promptText).toContain('Roll up the sleeves slightly to forearm level.');
    });
  });
});
