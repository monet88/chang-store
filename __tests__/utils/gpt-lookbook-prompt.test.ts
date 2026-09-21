import { describe, expect, it } from 'vitest';
import type { ImageFile } from '@/types';
import type { LookbookFormState } from '@/hooks/useLookbookDraft';
import {
  buildGptLookbookPrompt,
  buildGptVariationPrompt,
  buildGptCloseUpPrompts,
} from '@/utils/gpt-lookbook-prompt';

const mockImage = (id: string): ImageFile => ({
  base64: `mock-base64-${id}`,
  mimeType: 'image/png',
});

const createFormState = (
  overrides: Partial<LookbookFormState> = {},
): LookbookFormState => ({
  clothingImages: [{ id: '1', image: mockImage('garment') }],
  fabricTextureImage: null,
  fabricTexturePrompt: '',
  clothingDescription: '',
  lookbookStyle: 'product shot',
  garmentType: 'one-piece',
  foldedPresentationType: 'boxed',
  mannequinBackgroundStyle: 'minimalistShowroom',
  negativePrompt: '',
  productShotSubType: 'ghost-mannequin',
  includeAccessories: false,
  includeFootwear: false,
  ...overrides,
});

describe('buildGptLookbookPrompt', () => {
  it('formats prompt as structured JSON config without markdown OUTPUT heading', () => {
    const prompt = buildGptLookbookPrompt({
      formState: createFormState(),
      images: [mockImage('front')],
      fabricTextureImage: null,
    });

    expect(prompt).toContain('/* LOOKBOOK_CONFIG */');
    expect(prompt).not.toContain('## OUTPUT');

    const jsonMatch = prompt.match(/\/\* LOOKBOOK_CONFIG \*\/\n([\s\S]+)$/);
    expect(jsonMatch).not.toBeNull();
    const config = JSON.parse(jsonMatch![1]);
    expect(config.OUTPUT).toContain('Render exactly one complete, standalone photograph');
    expect(Array.isArray(config.INSTRUCTIONS)).toBe(true);
  });

  it('binds image roles for the flat GPT lane when multiple images or fabric texture are provided', () => {
    const multiPrompt = buildGptLookbookPrompt({
      formState: createFormState(),
      images: [mockImage('front'), mockImage('back'), mockImage('texture')],
      fabricTextureImage: mockImage('texture'),
    });

    expect(multiPrompt).toContain('## IMAGE ROLES');
    expect(multiPrompt).toContain('IMAGE 1 = Clothing garment reference view #1');
    expect(multiPrompt).toContain('IMAGE 2 = Clothing garment reference view #2');
    expect(multiPrompt).toContain('IMAGE 3 = Fabric texture reference (material surface and texture swatch only)');
    expect(multiPrompt).toContain('The fabric texture reference (IMAGE 3) controls material surface and texture only.');
  });

  it('omits image roles section when only a single garment image and no texture are provided', () => {
    const singlePrompt = buildGptLookbookPrompt({
      formState: createFormState(),
      images: [mockImage('front')],
      fabricTextureImage: null,
    });

    expect(singlePrompt).not.toContain('## IMAGE ROLES');
  });

  it('formats blueprint as structured JSON config for GPT Image lane', () => {
    const structuredBlueprint = `[CORE_GARMENTS]
Silk crepe evening gown with bias-cut bodice
[TEXTILE_PHYSICS]
Heavy drape, soft sheen, fluid movement
[DETECTED_ACCESSORIES]
Pearl necklace, gold clutch`;

    const prompt = buildGptLookbookPrompt({
      formState: createFormState(),
      images: [mockImage('front')],
      fabricTextureImage: null,
      outfitBlueprint: structuredBlueprint,
    });

    expect(prompt).toContain('/* LOOKBOOK_CONFIG */');
    const jsonMatch = prompt.match(/\/\* LOOKBOOK_CONFIG \*\/\n([\s\S]+)$/);
    expect(jsonMatch).not.toBeNull();
    const config = JSON.parse(jsonMatch![1]);
    expect(config.AI_SCAN_BLUEPRINT.coreGarments).toBe('Silk crepe evening gown with bias-cut bodice');
    expect(config.AI_SCAN_BLUEPRINT.textilePhysics).toBe('Heavy drape, soft sheen, fluid movement');
    expect(prompt).toContain('"Pearl necklace"');
  });

  it('leaves prompt without blueprint config when blueprint is absent or blank', () => {
    const expected = buildGptLookbookPrompt({
      formState: createFormState(),
      images: [mockImage('front')],
      fabricTextureImage: null,
    });

    expect(buildGptLookbookPrompt({
      formState: createFormState(),
      images: [mockImage('front')],
      fabricTextureImage: null,
      outfitBlueprint: '',
    })).toBe(expected);

    expect(buildGptLookbookPrompt({
      formState: createFormState(),
      images: [mockImage('front')],
      fabricTextureImage: null,
      outfitBlueprint: '   \n ',
    })).toBe(expected);
  });
});

describe('buildGptVariationPrompt', () => {
  it('requests a single standalone output prohibiting collages and grids', () => {
    const prompt = buildGptVariationPrompt('flat lay');

    expect(prompt).toContain('TASK: PRODUCT LOOKBOOK VARIATION SHOT');
    expect(prompt).toContain('Single output image: render exactly one complete, standalone photograph');
    expect(prompt).toContain('Do NOT generate a collage, grid, diptych, split-screen, contact sheet, or multi-panel composition');
  });

  it('formats blueprint as structured JSON config for variation', () => {
    const blueprint = 'Material: 92% silk crepe. Bias-cut bodice.';
    const variation = buildGptVariationPrompt('flat lay', blueprint);

    expect(variation).toContain('/* AI_SCAN_BLUEPRINT_CONFIG */');
    expect(variation).toContain('"coreGarments":');
  });

  it('leaves variation prompt byte-identical when blueprint is absent or blank', () => {
    const expected = buildGptVariationPrompt('flat lay');
    expect(buildGptVariationPrompt('flat lay', '')).toBe(expected);
    expect(buildGptVariationPrompt('flat lay', '  ')).toBe(expected);
  });
});

describe('buildGptCloseUpPrompts', () => {
  it('formats blueprint as structured JSON config for close-up prompts', () => {
    const blueprint = 'Material: 92% silk crepe. Bias-cut bodice.';
    const closeUps = buildGptCloseUpPrompts(blueprint);

    expect(closeUps).toHaveLength(3);
    closeUps.forEach((prompt) => {
      expect(prompt).toContain('/* AI_SCAN_BLUEPRINT_CONFIG */');
      expect(prompt).toContain('"textilePhysics":');
    });
  });

  it('leaves close-up prompts byte-identical when blueprint is absent or blank', () => {
    const expected = buildGptCloseUpPrompts();
    expect(buildGptCloseUpPrompts('')).toEqual(expected);
    expect(buildGptCloseUpPrompts('\n\t ')).toEqual(expected);
  });
});
