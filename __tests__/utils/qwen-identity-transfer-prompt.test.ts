import { describe, it, expect } from 'vitest';
import { buildQwenIdentityTransferParts } from '@/utils/qwen-identity-transfer-prompt';
import type { IdentityTransferPromptInput } from '@/utils/identity-transfer-prompt-types';
import { AI_SCAN_BLOCK_HEADER } from '@/utils/ai-scan-blueprint';

const mockImage = (id: string) => ({
  base64: `mock-base64-${id}`,
  mimeType: 'image/png' as const,
});

describe('buildQwenIdentityTransferParts', () => {
  const defaultInput: IdentityTransferPromptInput = {
    destinationImage: mockImage('dest'),
    faceReference: mockImage('face'),
    bodyReference: mockImage('body'),
    backgroundPrompt: '',
    extraPrompt: '',
  };

  describe('validation', () => {
    it('throws if input is missing', () => {
      expect(() => buildQwenIdentityTransferParts(null as unknown as IdentityTransferPromptInput)).toThrow(
        'input is required',
      );
    });

    it('throws if destinationImage is missing or invalid', () => {
      expect(() =>
        buildQwenIdentityTransferParts({ ...defaultInput, destinationImage: null as unknown as typeof defaultInput.destinationImage }),
      ).toThrow('destinationImage is required');

      expect(() =>
        buildQwenIdentityTransferParts({
          ...defaultInput,
          destinationImage: { base64: '', mimeType: 'image/png' },
        }),
      ).toThrow('destinationImage must contain a valid image');
    });

    it('throws if faceReference is missing or invalid', () => {
      expect(() =>
        buildQwenIdentityTransferParts({ ...defaultInput, faceReference: null as unknown as typeof defaultInput.faceReference }),
      ).toThrow('faceReference is required');

      expect(() =>
        buildQwenIdentityTransferParts({
          ...defaultInput,
          faceReference: { base64: '', mimeType: 'image/png' },
        }),
      ).toThrow('faceReference must contain a valid image');
    });

    it('throws if bodyReference is invalid when provided', () => {
      expect(() =>
        buildQwenIdentityTransferParts({
          ...defaultInput,
          bodyReference: { base64: '', mimeType: 'image/png' },
        }),
      ).toThrow('bodyReference must contain a valid image when provided');
    });
  });

  describe('deterministic reference ordering', () => {
    it('orders references: destination (image_1) first, face (image_2) second, body (image_3) third', () => {
      const parts = buildQwenIdentityTransferParts(defaultInput);

      expect(parts).toHaveLength(4);

      // Part 0: prompt text
      expect(parts[0].text).toBeDefined();

      // Part 1: destination image first (image_1)
      expect(parts[1].inlineData?.data).toBe('mock-base64-dest');

      // Part 2: face reference second (image_2)
      expect(parts[2].inlineData?.data).toBe('mock-base64-face');

      // Part 3: body reference third (image_3)
      expect(parts[3].inlineData?.data).toBe('mock-base64-body');
    });

    it('omits body reference image when bodyReference is null or undefined', () => {
      const partsNull = buildQwenIdentityTransferParts({ ...defaultInput, bodyReference: null });
      expect(partsNull).toHaveLength(3);
      expect(partsNull[1].inlineData?.data).toBe('mock-base64-dest');
      expect(partsNull[2].inlineData?.data).toBe('mock-base64-face');

      const partsUndefined = buildQwenIdentityTransferParts({ ...defaultInput, bodyReference: undefined });
      expect(partsUndefined).toHaveLength(3);
      expect(partsUndefined[1].inlineData?.data).toBe('mock-base64-dest');
      expect(partsUndefined[2].inlineData?.data).toBe('mock-base64-face');
    });
  });

  describe('prompt wording tailored to Qwen model', () => {
    it('contains Qwen identity transfer specification and reference role mappings', () => {
      const parts = buildQwenIdentityTransferParts(defaultInput);
      const text = parts[0].text ?? '';

      expect(text).toContain('QWEN IDENTITY TRANSFER SPECIFICATION');
      expect(text).toContain('image_1: Destination image');
      expect(text).toContain('image_2: Face reference');
      expect(text).toContain('image_3: Body reference');
    });

    it('omits image_3 role when bodyReference is not provided', () => {
      const parts = buildQwenIdentityTransferParts({ ...defaultInput, bodyReference: null });
      const text = parts[0].text ?? '';

      expect(text).toContain('image_1: Destination image');
      expect(text).toContain('image_2: Face reference');
      expect(text).not.toContain('image_3: Body reference');
      expect(text).toContain('No body reference provided');
    });

    it('instructs preservation of face geometry, skin tone, and hair texture', () => {
      const parts = buildQwenIdentityTransferParts(defaultInput);
      const text = parts[0].text ?? '';

      expect(text).toContain('facial geometry');
      expect(text).toContain('skin tone');
      expect(text).toContain('hair texture');
      expect(text).toContain('visible fine pores');
    });

    it('instructs preservation of destination pose, clothing, and scene context', () => {
      const parts = buildQwenIdentityTransferParts(defaultInput);
      const text = parts[0].text ?? '';

      expect(text).toContain('Faithfully maintain the exact pose');
      expect(text).toContain('Preserve the clothing design');
      expect(text).toContain('environmental lighting of image_1');
    });

    it('handles background replacement when backgroundPrompt is provided', () => {
      const parts = buildQwenIdentityTransferParts({
        ...defaultInput,
        backgroundPrompt: 'cozy sunset cafe terrace',
      });
      const text = parts[0].text ?? '';

      expect(text).toContain('Replace the background entirely with: "cozy sunset cafe terrace"');
    });

    it('handles user instructions when extraPrompt is provided', () => {
      const parts = buildQwenIdentityTransferParts({
        ...defaultInput,
        extraPrompt: 'subtle smile and warm lighting',
      });
      const text = parts[0].text ?? '';

      expect(text).toContain('USER INSTRUCTIONS');
      expect(text).toContain('subtle smile and warm lighting');
    });
  });

  describe('AI Scan blueprint incorporation', () => {
    const BLUEPRINT = 'WEAVE & MATERIAL: organic raw denim; contrasting brass buttons.';

    it('incorporates AI scan textile blueprint into prompt text', () => {
      const parts = buildQwenIdentityTransferParts({
        ...defaultInput,
        outfitBlueprint: BLUEPRINT,
      });
      const text = parts[0].text ?? '';

      expect(text).toContain(AI_SCAN_BLOCK_HEADER);
      expect(text).toContain(BLUEPRINT);
    });

    it('leaves prompt byte-identical when blueprint is absent or whitespace', () => {
      const baseParts = buildQwenIdentityTransferParts(defaultInput);
      const absentParts = buildQwenIdentityTransferParts({ ...defaultInput, outfitBlueprint: undefined });
      const blankParts = buildQwenIdentityTransferParts({ ...defaultInput, outfitBlueprint: '   \n\t  ' });

      expect(absentParts).toEqual(baseParts);
      expect(blankParts).toEqual(baseParts);
      expect(baseParts[0].text).not.toContain(AI_SCAN_BLOCK_HEADER);
    });
  });
});
