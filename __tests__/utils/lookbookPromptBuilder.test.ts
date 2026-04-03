import { describe, expect, it } from 'vitest';
import type { ImageFile } from '@/types';
import type { LookbookFormState } from '@/utils/lookbookPromptBuilder';
import { buildLookbookPrompt } from '@/utils/lookbookPromptBuilder';

const mockImage = (id: string): ImageFile => ({
  base64: `mock-base64-${id}`,
  mimeType: 'image/png',
});

const createFormState = (
  overrides: Partial<LookbookFormState> = {},
): LookbookFormState => ({
  clothingImages: [{ id: 1, image: mockImage('garment') }],
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

describe('buildLookbookPrompt', () => {
  it('keeps source images as primary truth when clothing description is present', () => {
    const prompt = buildLookbookPrompt(
      createFormState({
        clothingDescription: 'Add pearl buttons and hidden lace trim.',
      }),
      [mockImage('front')],
      null,
    );

    expect(prompt).toContain('source image(s) remain the primary source of truth');
    expect(prompt).toContain('Do NOT invent new trims, pockets, buttons, labels, logos, embroidery, closures, or construction details');
    expect(prompt).not.toContain('should be prioritized to clarify the garment');
  });

  it('uses ghost mannequin specific accessory and footwear wording', () => {
    const prompt = buildLookbookPrompt(
      createFormState({
        includeAccessories: true,
        includeFootwear: true,
        productShotSubType: 'ghost-mannequin',
      }),
      [mockImage('front'), mockImage('back')],
      null,
    );

    expect(prompt).toContain('Present them as separate product elements near the garment without overlap.');
    expect(prompt).toContain('Present the pair separately below the ghost mannequin garment on the same white background.');
    expect(prompt).toContain('Do NOT invent unseen sole, heel, or trim details.');
  });

  it('uses clean flat lay specific accessory and footwear wording', () => {
    const prompt = buildLookbookPrompt(
      createFormState({
        garmentType: 'two-piece',
        productShotSubType: 'clean-flat-lay',
        includeAccessories: true,
        includeFootwear: true,
      }),
      [mockImage('front'), mockImage('side')],
      null,
    );

    expect(prompt).toContain('Display them as separate laid-out items alongside the garment pieces without overlap.');
    expect(prompt).toContain('Display shoes/boots as the bottom-most separate item in the layout, below all garment pieces.');
    expect(prompt).toContain('Do NOT invent unseen sole, heel, or trim details.');
  });

  it('adds hidden-detail guardrails for product-shot extraction', () => {
    const prompt = buildLookbookPrompt(
      createFormState({
        productShotSubType: 'clean-flat-lay',
      }),
      [mockImage('front'), mockImage('detail'), mockImage('back')],
      null,
    );

    expect(prompt).toContain('If a region is hidden or unresolved across all source views');
    expect(prompt).toContain('Never blend contradictory details from multiple views into a new hybrid design.');
    expect(prompt).toContain('NO invented hidden garment details');
  });
});
