import { describe, it, expect } from 'vitest';
import {
  buildQwenClothingTransferParts,
  buildQwenProductStagingParts,
  buildQwenBrandModelParts,
} from '@/utils/qwen-clothing-transfer-prompt';
import type { ClothingTransferReferenceInput } from '@/utils/clothing-transfer-prompt-types';
import type { DisplayTemplate } from '@/config/displayTemplates';
import type { BrandModelProfile } from '@/config/brandModelRoster';
import type { ImageFile } from '@/types';
import { AI_SCAN_BLOCK_HEADER } from '@/utils/ai-scan-blueprint';
import { UNTUCKED_DRAPE_INSTRUCTION } from '@/utils/outfitDrapePolicy';

const mockImage = (id: string): ImageFile => ({
  base64: `mock-base64-${id}`,
  mimeType: 'image/png',
});

const defaultConcept = mockImage('concept-scene');
const defaultReference: ClothingTransferReferenceInput = {
  image: mockImage('source-outfit-1'),
  label: 'blouse',
};

describe('buildQwenClothingTransferParts', () => {
  describe('validation', () => {
    it('throws if conceptImage is missing or invalid', () => {
      expect(() =>
        buildQwenClothingTransferParts(
          null as unknown as ImageFile,
          [defaultReference],
          '',
        ),
      ).toThrow('conceptImage is required');

      expect(() =>
        buildQwenClothingTransferParts(
          { base64: '', mimeType: 'image/png' },
          [defaultReference],
          '',
        ),
      ).toThrow('conceptImage is required');
    });

    it('throws if references array is empty', () => {
      expect(() =>
        buildQwenClothingTransferParts(defaultConcept, [], ''),
      ).toThrow('references must contain at least one item');
    });

    it('throws if a reference image is invalid', () => {
      expect(() =>
        buildQwenClothingTransferParts(
          defaultConcept,
          [{ image: { base64: '', mimeType: 'image/png' }, label: 'top' }],
          '',
        ),
      ).toThrow('references[0] must contain a valid image');
    });
  });

  describe('reference ordering', () => {
    it('orders references with destination scene FIRST (image_1), followed by source garments in order (image_2..N)', () => {
      const references: ClothingTransferReferenceInput[] = [
        { image: mockImage('top-blouse'), label: 'blouse' },
        { image: mockImage('pleated-skirt'), label: 'skirt' },
        { image: mockImage('leather-jacket'), label: 'jacket' },
      ];

      const parts = buildQwenClothingTransferParts(defaultConcept, references, '');

      // Part 0 is prompt text
      expect(parts[0].text).toBeDefined();

      // Part 1 must be concept / destination image (image_1)
      expect(parts[1].inlineData?.data).toBe('mock-base64-concept-scene');

      // Parts 2..4 must be source references in order (image_2..4)
      expect(parts[2].inlineData?.data).toBe('mock-base64-top-blouse');
      expect(parts[3].inlineData?.data).toBe('mock-base64-pleated-skirt');
      expect(parts[4].inlineData?.data).toBe('mock-base64-leather-jacket');
    });
  });

  describe('prompt content and wording', () => {
    it('contains Qwen-specific specification, task, and reference role mappings', () => {
      const references: ClothingTransferReferenceInput[] = [
        { image: mockImage('top'), label: 'silk shirt' },
        { image: mockImage('bottom'), label: '' },
      ];
      const parts = buildQwenClothingTransferParts(defaultConcept, references, '');
      const promptText = parts[0].text ?? '';

      expect(promptText).toContain('QWEN CLOTHING TRANSFER SPECIFICATION');
      expect(promptText).toContain('image_1: DESTINATION SCENE');
      expect(promptText).toContain('image_2: SOURCE OUTFIT 1');
      expect(promptText).toContain('silk shirt');
      expect(promptText).toContain('image_3: SOURCE OUTFIT 2');
      expect(promptText).toContain('auto-detect clothing type');
      expect(promptText).toContain('Zero blending');
    });

    it('enforces untucked drape policy when tucking is not requested', () => {
      const parts = buildQwenClothingTransferParts(defaultConcept, [defaultReference], '');
      const promptText = parts[0].text ?? '';

      expect(promptText).toContain(UNTUCKED_DRAPE_INSTRUCTION);
    });

    it('allows tuck styling when requested in extraInstructions', () => {
      const parts = buildQwenClothingTransferParts(
        defaultConcept,
        [defaultReference],
        'tuck the blouse neatly into the pants',
      );
      const promptText = parts[0].text ?? '';

      expect(promptText).toContain('Tuck styling allowed as specified by user instructions.');
      expect(promptText).not.toContain(UNTUCKED_DRAPE_INSTRUCTION);
    });

    it('incorporates AI scan textile blueprint when provided', () => {
      const blueprintText = `[CORE_GARMENTS]\nSilk blouse with shaped waist\n[TEXTILE_PHYSICS]\nSoft satin drape\n[DETECTED_ACCESSORIES]\nPearl handbag, gold earrings`;
      const parts = buildQwenClothingTransferParts(
        defaultConcept,
        [defaultReference],
        '',
        blueprintText,
      );
      const promptText = parts[0].text ?? '';

      expect(promptText).toContain(AI_SCAN_BLOCK_HEADER);
      expect(promptText).toContain('Silk blouse with shaped waist');
      expect(promptText).toContain('Do not transfer non-clothing accessories from clothing references: Pearl handbag, gold earrings');
    });

    it('includes user instructions from extraInstructions', () => {
      const parts = buildQwenClothingTransferParts(
        defaultConcept,
        [defaultReference],
        'preserve vintage watch and leather bracelet',
      );
      const promptText = parts[0].text ?? '';

      expect(promptText).toContain('USER INSTRUCTIONS: preserve vintage watch and leather bracelet');
    });
  });
});

describe('buildQwenProductStagingParts', () => {
  const template: DisplayTemplate = {
    id: 'hanger-wood',
    name: 'Móc Gỗ',
    category: 'hanger',
    modality: 'text',
    prompt: 'Hang on a natural wood hanger against an off-white wall.',
  };

  const imageTemplate: DisplayTemplate = {
    id: 'hanger-studio',
    name: 'Móc Studio',
    category: 'hanger',
    modality: 'image',
    image: mockImage('staging-surface-hanger'),
    prompt: 'Studio aesthetic with warm directional spotlight.',
  };

  it('throws if sourceImage is missing or invalid', () => {
    expect(() =>
      buildQwenProductStagingParts(
        null as unknown as ImageFile,
        template,
        'top',
      ),
    ).toThrow('sourceImage is required');
  });

  it('structures parts with source outfit (image_1) and staging reference (image_2) when template has image', () => {
    const sourceImage = mockImage('source-outfit');
    const parts = buildQwenProductStagingParts(sourceImage, imageTemplate, 'top');

    expect(parts).toHaveLength(3);
    expect(parts[0].text).toContain('QWEN PRODUCT STAGING SPECIFICATION');
    expect(parts[0].text).toContain('STAGING REFERENCE (image_2)');
    expect(parts[1].inlineData?.data).toBe('mock-base64-source-outfit');
    expect(parts[2].inlineData?.data).toBe('mock-base64-staging-surface-hanger');
  });

  it('structures parts with only source outfit when template has no image', () => {
    const sourceImage = mockImage('source-outfit');
    const parts = buildQwenProductStagingParts(sourceImage, template, 'dress');

    expect(parts).toHaveLength(2);
    expect(parts[0].text).toContain('QWEN PRODUCT STAGING SPECIFICATION');
    expect(parts[0].text).toContain('ZERO human beings or mannequins');
    expect(parts[1].inlineData?.data).toBe('mock-base64-source-outfit');
  });

  it('incorporates blueprint apparel specifications and textile physics', () => {
    const sourceImage = mockImage('source-outfit');
    const blueprint = `[CORE_GARMENTS]\nTailored linen blazer\n[TEXTILE_PHYSICS]\nCrisp linen weave with sharp structural folds\n[DETECTED_ACCESSORIES]\nLeather tote bag`;

    const parts = buildQwenProductStagingParts(sourceImage, template, 'top', '', blueprint);
    const promptText = parts[0].text ?? '';

    expect(promptText).toContain('Apparel Architecture: Tailored linen blazer');
    expect(promptText).toContain('Drape & Textile Physics: Crisp linen weave');
    expect(promptText).toContain('Exclude detected accessories: Leather tote bag');
  });
});

describe('buildQwenBrandModelParts', () => {
  const model: BrandModelProfile = {
    id: 'linh',
    name: 'Linh',
    faceImage: mockImage('linh-face'),
    bodyImage: mockImage('linh-body'),
    metadata: {
      age: 22,
      height: '1m66',
      weight: '48kg',
      bodyType: 'slender hourglass',
      skinTone: 'fair porcelain',
      facialFeatures: 'almond eyes',
      styleVibe: 'muse',
    },
  };

  it('throws if sourceImage is missing', () => {
    expect(() =>
      buildQwenBrandModelParts(
        null as unknown as ImageFile,
        model,
      ),
    ).toThrow('sourceImage is required');
  });

  it('falls back to preserving destination image if model has no faceImage', () => {
    const sourceImage = mockImage('source-outfit');
    const modelWithoutFace: BrandModelProfile = {
      id: 'no-face',
      name: 'No Face',
      faceImage: null,
      bodyImage: null,
      metadata: {
        age: 25,
        height: '168cm',
        weight: '50kg',
        bodyType: 'Slim',
        skinTone: 'Fair',
        facialFeatures: 'Natural',
        styleVibe: 'Casual',
      },
    };

    const parts = buildQwenBrandModelParts(sourceImage, modelWithoutFace);
    expect(parts).toHaveLength(2);
    expect(parts[0].inlineData?.data).toBe('mock-base64-source-outfit');
    expect(parts[1].text).toBe('Preserve destination image.');
  });

  it('structures parts with destination photo first (image_1), model face (image_2), and body (image_3)', () => {
    const sourceImage = mockImage('source-outfit');
    const parts = buildQwenBrandModelParts(sourceImage, model);

    expect(parts).toHaveLength(4);
    expect(parts[0].text).toContain('QWEN BRAND MODEL SPECIFICATION');
    expect(parts[0].text).toContain('image_1: DESTINATION PHOTO');
    expect(parts[0].text).toContain('image_2: BRAND MODEL FACE (Linh)');
    expect(parts[0].text).toContain('image_3: BRAND MODEL BODY (Linh)');

    expect(parts[1].inlineData?.data).toBe('mock-base64-source-outfit');
    expect(parts[2].inlineData?.data).toBe('mock-base64-linh-face');
    expect(parts[3].inlineData?.data).toBe('mock-base64-linh-body');
  });

  it('locks garment, environment, pose and transfers facial identity to brand model', () => {
    const sourceImage = mockImage('source-outfit');
    const parts = buildQwenBrandModelParts(sourceImage, model, 'keep pearl necklace');
    const promptText = parts[0].text ?? '';

    expect(promptText).toContain('1. GARMENT LOCK: 100% FROZEN');
    expect(promptText).toContain('2. ENVIRONMENT & POSE LOCK: 100% FROZEN');
    expect(promptText).toContain('USER INSTRUCTIONS: keep pearl necklace');
  });

  it('preserves only selected scopes when garmentScopes is specified', () => {
    const sourceImage = mockImage('source-outfit');
    const parts = buildQwenBrandModelParts(
      sourceImage,
      model,
      '',
      '',
      ['top', 'bottom'],
    );
    const promptText = parts[0].text ?? '';

    expect(promptText).toContain('top garment (shirt/blouse/jacket) + bottom garment (pants/skirt/trousers)');
    expect(promptText).toContain('Unselected source clothing outside');
  });
});
