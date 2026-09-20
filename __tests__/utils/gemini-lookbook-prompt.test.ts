import { describe, expect, it } from 'vitest';
import type { ImageFile } from '@/types';
import type { LookbookFormState } from '@/hooks/useLookbookDraft';
import {
  buildGeminiLookbookPrompt,
  buildGeminiVariationPrompt,
  buildGeminiCloseUpPrompts,
} from '@/utils/gemini-lookbook-prompt';

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

describe('buildGeminiLookbookPrompt', () => {
  it('keeps source images as primary truth when clothing description is present', () => {
    const prompt = buildGeminiLookbookPrompt({
      formState: createFormState({
        clothingDescription: 'Add pearl buttons and hidden lace trim.',
      }),
      images: [mockImage('front')],
      fabricTextureImage: null,
    });

    expect(prompt).toContain('source image(s) remain the primary source of truth');
    expect(prompt).toContain('Do NOT invent new trims, pockets, buttons, labels, logos, embroidery, closures, or construction details');
    expect(prompt).not.toContain('should be prioritized to clarify the garment');
  });

  it('uses ghost mannequin specific accessory and footwear wording', () => {
    const prompt = buildGeminiLookbookPrompt({
      formState: createFormState({
        includeAccessories: true,
        includeFootwear: true,
        productShotSubType: 'ghost-mannequin',
      }),
      images: [mockImage('front'), mockImage('back')],
      fabricTextureImage: null,
    });

    expect(prompt).toContain('Present them as separate product elements near the garment without overlap.');
    expect(prompt).toContain('Present the pair separately below the ghost mannequin garment on the same white background.');
    expect(prompt).toContain('Do NOT invent unseen sole, heel, or trim details.');
  });

  it('uses clean flat lay specific accessory and footwear wording', () => {
    const prompt = buildGeminiLookbookPrompt({
      formState: createFormState({
        garmentType: 'two-piece',
        productShotSubType: 'clean-flat-lay',
        includeAccessories: true,
        includeFootwear: true,
      }),
      images: [mockImage('front'), mockImage('side')],
      fabricTextureImage: null,
    });

    expect(prompt).toContain('Display them as separate laid-out items alongside the garment pieces without overlap.');
    expect(prompt).toContain('Display shoes/boots as the bottom-most separate item in the layout, below all garment pieces.');
    expect(prompt).toContain('Do NOT invent unseen sole, heel, or trim details.');
  });

  it('adds hidden-detail guardrails for product-shot extraction', () => {
    const prompt = buildGeminiLookbookPrompt({
      formState: createFormState({
        productShotSubType: 'clean-flat-lay',
      }),
      images: [mockImage('front'), mockImage('detail'), mockImage('back')],
      fabricTextureImage: null,
    });

    expect(prompt).toContain('If a region is hidden or unresolved across all source views');
    expect(prompt).toContain('Never blend contradictory details from multiple views into a new hybrid design.');
    expect(prompt).toContain('NO invented hidden garment details');
  });

  it('reconciles multi-view and multi-piece evidence without blending or merging pieces', () => {
    const prompt = buildGeminiLookbookPrompt({
      formState: createFormState(),
      images: [mockImage('front'), mockImage('back')],
      fabricTextureImage: null,
    });

    expect(prompt).toContain('REFERENCE EVIDENCE & RECONCILIATION');
    expect(prompt).toContain('may contain multiple views of the same garment, distinct pieces of a multi-piece outfit, or both');
    expect(prompt).toContain('Never blend contradictory details from multiple views into a new hybrid design');
    expect(prompt).toContain('keep distinct garment pieces separate according to the outfit structure');
    expect(prompt).toContain('if any garment region is hidden or unresolved across all source views');
    expect(prompt).toContain('Do NOT invent new trims, pockets, buttons, labels, logos, embroidery, closures, or construction details');
  });

  it('uses single-image evidence contract when only one clothing image is provided', () => {
    const prompt = buildGeminiLookbookPrompt({
      formState: createFormState(),
      images: [mockImage('single')],
      fabricTextureImage: null,
    });

    expect(prompt).toContain('The uploaded clothing image provides the visual evidence');
    expect(prompt).toContain('Conservative completion: preserve visible construction, seams, colors, and textures');
  });

  it('applies fabric texture reference to control material only without altering silhouette or construction', () => {
    const prompt = buildGeminiLookbookPrompt({
      formState: createFormState({
        fabricTexturePrompt: 'rich ribbed velvet',
      }),
      images: [mockImage('front')],
      fabricTextureImage: mockImage('velvet-texture'),
    });

    expect(prompt).toContain('FABRIC TEXTURE APPLICATION');
    expect(prompt).toContain('The fabric texture reference controls material surface and texture only');
    expect(prompt).toContain('Wrap the texture realistically across the garment\'s folds, seams, drape, and contours under the scene lighting');
    expect(prompt).toContain('Strictly preserve the garment\'s supported silhouette, cut, seams, and non-fabric construction details');
    expect(prompt).toContain('Fabric texture note: "rich ribbed velvet" provides secondary guidance to guide texture application.');
  });

  it('controls material only via fabric texture reference image when no text prompt is provided', () => {
    const prompt = buildGeminiLookbookPrompt({
      formState: createFormState({
        fabricTexturePrompt: '',
      }),
      images: [mockImage('front')],
      fabricTextureImage: mockImage('velvet-texture'),
    });

    expect(prompt).toContain('FABRIC TEXTURE APPLICATION');
    expect(prompt).toContain('The fabric texture reference controls material surface and texture only');
    expect(prompt).not.toContain('Fabric texture note:');
  });

  it('treats fabric texture prompt as material and texture guidance only when no texture image is uploaded', () => {
    const prompt = buildGeminiLookbookPrompt({
      formState: createFormState({
        fabricTexturePrompt: 'rich ribbed velvet',
      }),
      images: [mockImage('front')],
      fabricTextureImage: null,
    });

    expect(prompt).toContain('FABRIC TEXTURE APPLICATION');
    expect(prompt).toContain('Fabric texture note: "rich ribbed velvet" provides material and texture guidance only.');
    expect(prompt).toContain('Wrap the texture realistically across the garment\'s folds, seams, drape, and contours under the scene lighting');
    expect(prompt).toContain('Strictly preserve the garment\'s supported silhouette, cut, seams, and non-fabric construction details');
    expect(prompt).not.toContain('fabric texture reference');
    expect(prompt).not.toContain('fabric texture image');
  });

  it('generates presentation-specific prompts for every Lookbook style', () => {
    const flatLay = buildGeminiLookbookPrompt({
      formState: createFormState({ lookbookStyle: 'flat lay', garmentType: 'two-piece' }),
      images: [mockImage('1')],
      fabricTextureImage: null,
    });
    expect(flatLay).toContain('PRESENTATION: LIFESTYLE FLAT LAY');
    expect(flatLay).toContain('top placed above, pants/skirt directly below in a straight, aligned layout');

    const boxed = buildGeminiLookbookPrompt({
      formState: createFormState({ lookbookStyle: 'folded', foldedPresentationType: 'boxed' }),
      images: [mockImage('1')],
      fabricTextureImage: null,
    });
    expect(boxed).toContain('PRESENTATION: BOXED UNBOXING SHOT');
    expect(boxed).toContain('rigid presentation box in cream white or soft pastel');

    const folded = buildGeminiLookbookPrompt({
      formState: createFormState({ lookbookStyle: 'folded', foldedPresentationType: 'folded' }),
      images: [mockImage('1')],
      fabricTextureImage: null,
    });
    expect(folded).toContain('PRESENTATION: CLEAN FOLDED SHOT');
    expect(folded).toContain('neatly folded directly on a flat presentation surface');

    const mannequin = buildGeminiLookbookPrompt({
      formState: createFormState({ lookbookStyle: 'mannequin', mannequinBackgroundStyle: 'whiteStudio' }),
      images: [mockImage('1')],
      fabricTextureImage: null,
    });
    expect(mannequin).toContain('PRESENTATION: TAILORED MANNEQUIN SHOT');
    expect(mannequin).toContain('Headless, armless, and legless torso form');

    const hanger = buildGeminiLookbookPrompt({
      formState: createFormState({ lookbookStyle: 'hanger', garmentType: 'two-piece' }),
      images: [mockImage('1')],
      fabricTextureImage: null,
    });
    expect(hanger).toContain('PRESENTATION: BOUTIQUE CLOSET HANGER SHOT');
    expect(hanger).toContain('minimalist built-in alcove');

    const studioBg = buildGeminiLookbookPrompt({
      formState: createFormState({ lookbookStyle: 'studio background' }),
      images: [mockImage('1')],
      fabricTextureImage: null,
    });
    expect(studioBg).toContain('PRESENTATION: STUDIO BACKGROUND EDIT');
    expect(studioBg).toContain('Preserve the model\'s identity, face, hair, skin tone, body proportions, exact outfit, and pose completely');

    const showroom = buildGeminiLookbookPrompt({
      formState: createFormState({ lookbookStyle: 'minimalist showroom', garmentType: 'one-piece' }),
      images: [mockImage('1')],
      fabricTextureImage: null,
    });
    expect(showroom).toContain('PRESENTATION: MINIMALIST SHOWROOM');
    expect(showroom).toContain('freestanding rectangular clothing rack');
  });

  it('requests one standalone photograph for every style, ahead of the presentation contract', () => {
    const styles = ['flat lay', 'folded', 'mannequin', 'hanger', 'studio background', 'minimalist showroom', 'product shot'] as const;

    styles.forEach((lookbookStyle) => {
      const prompt = buildGeminiLookbookPrompt({
        formState: createFormState({ lookbookStyle }),
        images: [mockImage('1')],
        fabricTextureImage: null,
      });

      expect(prompt).toContain('Render exactly one complete, standalone photograph');
      expect(prompt).toContain('Do NOT generate a collage, grid, diptych, split-screen, contact sheet, or multi-panel composition');
      expect(prompt.indexOf('## OUTPUT')).toBeLessThan(prompt.indexOf('## PRESENTATION'));
    });
  });

  it('splices the deconstruction into the main lookbook prompt', () => {
    const blueprint = 'Material: 92% silk crepe. Bias-cut bodice, French seams, covered placket.';
    const prompt = buildGeminiLookbookPrompt({
      formState: createFormState(),
      images: [mockImage('front')],
      fabricTextureImage: null,
      outfitBlueprint: blueprint,
    });

    expect(prompt).toContain('AI SCAN — TEXTILE & GARMENT DECONSTRUCTION (observed in the source images):');
    expect(prompt).toContain(blueprint);
  });

  it('leaves the main builder byte-identical when the blueprint is absent or blank', () => {
    const expected = buildGeminiLookbookPrompt({
      formState: createFormState(),
      images: [mockImage('front')],
      fabricTextureImage: null,
    });

    expect(buildGeminiLookbookPrompt({
      formState: createFormState(),
      images: [mockImage('front')],
      fabricTextureImage: null,
      outfitBlueprint: '',
    })).toBe(expected);

    expect(buildGeminiLookbookPrompt({
      formState: createFormState(),
      images: [mockImage('front')],
      fabricTextureImage: null,
      outfitBlueprint: '   \n ',
    })).toBe(expected);
  });
});

describe('buildGeminiVariationPrompt', () => {
  it('requests a single standalone output and explicitly prohibits collages and grids', () => {
    const prompt = buildGeminiVariationPrompt('flat lay');

    expect(prompt).toContain('TASK: PRODUCT LOOKBOOK VARIATION SHOT');
    expect(prompt).toContain('Single output image: render exactly one complete, standalone photograph');
    expect(prompt).toContain('Do NOT generate a collage, grid, diptych, split-screen, contact sheet, or multi-panel composition');
    expect(prompt).toContain('No collages, grids, split images, multi-panel layouts, or contact sheets');
    expect(prompt).toContain('No changing the core \'flat lay\' presentation concept');
    expect(prompt).not.toContain('Generate 3 professional variations');
  });

  it('splices the deconstruction into the variation prompt', () => {
    const blueprint = 'Material: 92% silk crepe. Bias-cut bodice, French seams, covered placket.';
    const prompt = buildGeminiVariationPrompt('flat lay', blueprint);

    expect(prompt).toContain('AI SCAN — TEXTILE & GARMENT DECONSTRUCTION (observed in the source images):');
    expect(prompt).toContain(blueprint);
  });

  it('leaves variation builder byte-identical when the blueprint is absent or blank', () => {
    const expected = buildGeminiVariationPrompt('flat lay');
    expect(buildGeminiVariationPrompt('flat lay', '')).toBe(expected);
    expect(buildGeminiVariationPrompt('flat lay', '  ')).toBe(expected);
  });
});

describe('buildGeminiCloseUpPrompts', () => {
  it('provides three macro detail contracts with conservative fallback instructions', () => {
    const prompts = buildGeminiCloseUpPrompts();
    expect(prompts).toHaveLength(3);

    expect(prompts[0]).toContain('DETAIL CLOSE-UP — NECKLINE / COLLAR');
    expect(prompts[0]).toContain('Conservative fallback: if specific fasteners or collar details are absent or obscured');
    expect(prompts[0]).toContain('without inventing buttons, trims, collars, or embroidery');

    expect(prompts[1]).toContain('DETAIL CLOSE-UP — SLEEVE / CUFF / ARMHOLE');
    expect(prompts[1]).toContain('Conservative fallback: if cuff hardware, buttons, or decorative trims are not clearly visible');
    expect(prompts[1]).toContain('without inventing cuffs, tabs, buttons, or embellishments');

    expect(prompts[2]).toContain('DETAIL CLOSE-UP — LOWER BODY / HEMLINE / WAISTBAND');
    expect(prompts[2]).toContain('Conservative fallback: if waist fastenings, drawstrings, or pockets are not present');
    expect(prompts[2]).toContain('without inventing pockets, buttons, zippers, or ornamental details');
  });

  it('splices the deconstruction into every close-up prompt', () => {
    const blueprint = 'Material: 92% silk crepe. Bias-cut bodice, French seams, covered placket.';
    const prompts = buildGeminiCloseUpPrompts(blueprint);

    expect(prompts).toHaveLength(3);
    prompts.forEach((prompt) => {
      expect(prompt).toContain('AI SCAN — TEXTILE & GARMENT DECONSTRUCTION (observed in the source images):');
      expect(prompt).toContain(blueprint);
    });
  });

  it('leaves close-up builder byte-identical when the blueprint is absent or blank', () => {
    const expected = buildGeminiCloseUpPrompts();
    expect(buildGeminiCloseUpPrompts('')).toEqual(expected);
    expect(buildGeminiCloseUpPrompts('\n\t ')).toEqual(expected);
  });
});
