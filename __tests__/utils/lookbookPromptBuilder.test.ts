import { describe, expect, it } from 'vitest';
import type { ImageFile } from '@/types';
import {
  buildLookbookPrompt,
  buildVariationPrompt,
  buildCloseUpPrompts,
  buildCloseUpNegativePrompt,
  lookbookAiScanSources,
  type LookbookFormState,
} from '@/utils/lookbookPromptBuilder';

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

  it('reconciles multi-view and multi-piece evidence without blending or merging pieces', () => {
    const prompt = buildLookbookPrompt(
      createFormState(),
      [mockImage('front'), mockImage('back')],
      null,
    );

    expect(prompt).toContain('REFERENCE EVIDENCE & RECONCILIATION');
    expect(prompt).toContain('may contain multiple views of the same garment, distinct pieces of a multi-piece outfit, or both');
    expect(prompt).toContain('Never blend contradictory details from multiple views into a new hybrid design');
    expect(prompt).toContain('keep distinct garment pieces separate according to the outfit structure');
    expect(prompt).toContain('Do NOT invent new trims, pockets, buttons, labels, logos, embroidery, closures, or construction details');
  });

  it('uses single-image evidence contract when only one clothing image is provided', () => {
    const prompt = buildLookbookPrompt(
      createFormState(),
      [mockImage('single')],
      null,
    );

    expect(prompt).toContain('The uploaded clothing image provides the visual evidence');
    expect(prompt).toContain('Conservative completion: preserve visible construction, seams, colors, and textures');
  });

  it('applies fabric texture reference to control material only without altering silhouette or construction', () => {
    const prompt = buildLookbookPrompt(
      createFormState({
        fabricTexturePrompt: 'rich ribbed velvet',
      }),
      [mockImage('front')],
      mockImage('velvet-texture'),
    );

    expect(prompt).toContain('FABRIC TEXTURE APPLICATION');
    expect(prompt).toContain('The fabric texture reference controls material surface and texture only');
    expect(prompt).toContain('Wrap the texture realistically across the garment\'s folds, seams, drape, and contours under the scene lighting');
    expect(prompt).toContain('Strictly preserve the garment\'s supported silhouette, cut, seams, and non-fabric construction details');
    expect(prompt).toContain('Fabric texture note: "rich ribbed velvet" provides secondary guidance to guide texture application.');
  });

  it('controls material only via fabric texture reference image when no text prompt is provided', () => {
    const prompt = buildLookbookPrompt(
      createFormState({
        fabricTexturePrompt: '',
      }),
      [mockImage('front')],
      mockImage('velvet-texture'),
    );

    expect(prompt).toContain('FABRIC TEXTURE APPLICATION');
    expect(prompt).toContain('The fabric texture reference controls material surface and texture only');
    expect(prompt).not.toContain('Fabric texture note:');
  });

  it('treats fabric texture prompt as material and texture guidance only when no texture image is uploaded', () => {
    const prompt = buildLookbookPrompt(
      createFormState({
        fabricTexturePrompt: 'rich ribbed velvet',
      }),
      [mockImage('front')],
      null,
    );

    expect(prompt).toContain('FABRIC TEXTURE APPLICATION');
    expect(prompt).toContain('Fabric texture note: "rich ribbed velvet" provides material and texture guidance only.');
    expect(prompt).toContain('Wrap the texture realistically across the garment\'s folds, seams, drape, and contours under the scene lighting');
    expect(prompt).toContain('Strictly preserve the garment\'s supported silhouette, cut, seams, and non-fabric construction details');
    expect(prompt).not.toContain('fabric texture reference');
    expect(prompt).not.toContain('fabric texture image');
  });

  it('generates presentation-specific prompts for every Lookbook style', () => {
    const flatLay = buildLookbookPrompt(createFormState({ lookbookStyle: 'flat lay', garmentType: 'two-piece' }), [mockImage('1')], null);
    expect(flatLay).toContain('PRESENTATION: LIFESTYLE FLAT LAY');
    expect(flatLay).toContain('top placed above, pants/skirt directly below in a straight, aligned layout');

    const boxed = buildLookbookPrompt(createFormState({ lookbookStyle: 'folded', foldedPresentationType: 'boxed' }), [mockImage('1')], null);
    expect(boxed).toContain('PRESENTATION: BOXED UNBOXING SHOT');
    expect(boxed).toContain('rigid presentation box in cream white or soft pastel');

    const folded = buildLookbookPrompt(createFormState({ lookbookStyle: 'folded', foldedPresentationType: 'folded' }), [mockImage('1')], null);
    expect(folded).toContain('PRESENTATION: CLEAN FOLDED SHOT');
    expect(folded).toContain('neatly folded directly on a flat presentation surface');

    const mannequin = buildLookbookPrompt(createFormState({ lookbookStyle: 'mannequin', mannequinBackgroundStyle: 'whiteStudio' }), [mockImage('1')], null);
    expect(mannequin).toContain('PRESENTATION: TAILORED MANNEQUIN SHOT');
    expect(mannequin).toContain('Headless, armless, and legless torso form');

    const hanger = buildLookbookPrompt(createFormState({ lookbookStyle: 'hanger', garmentType: 'two-piece' }), [mockImage('1')], null);
    expect(hanger).toContain('PRESENTATION: BOUTIQUE CLOSET HANGER SHOT');
    expect(hanger).toContain('minimalist built-in alcove');

    const studioBg = buildLookbookPrompt(createFormState({ lookbookStyle: 'studio background' }), [mockImage('1')], null);
    expect(studioBg).toContain('PRESENTATION: STUDIO BACKGROUND EDIT');
    expect(studioBg).toContain('Preserve the model\'s identity, face, hair, skin tone, body proportions, exact outfit, and pose completely');

    const showroom = buildLookbookPrompt(createFormState({ lookbookStyle: 'minimalist showroom', garmentType: 'one-piece' }), [mockImage('1')], null);
    expect(showroom).toContain('PRESENTATION: MINIMALIST SHOWROOM');
    expect(showroom).toContain('freestanding rectangular clothing rack');
  });

  it('requests one standalone photograph for every style, ahead of the presentation contract', () => {
    const styles = ['flat lay', 'folded', 'mannequin', 'hanger', 'studio background', 'minimalist showroom', 'product shot'] as const;

    styles.forEach((lookbookStyle) => {
      const prompt = buildLookbookPrompt(createFormState({ lookbookStyle }), [mockImage('1')], null);

      expect(prompt).toContain('Render exactly one complete, standalone photograph');
      expect(prompt).toContain('Do NOT generate a collage, grid, diptych, split-screen, contact sheet, or multi-panel composition');
      expect(prompt.indexOf('## OUTPUT')).toBeLessThan(prompt.indexOf('## PRESENTATION'));
    });
  });

  it('binds image roles for the flat GPT lane when multiple images or fabric texture are provided', () => {
    const multiPrompt = buildLookbookPrompt(
      createFormState(),
      [mockImage('front'), mockImage('back'), mockImage('texture')],
      mockImage('texture'),
      'text',
    );

    expect(multiPrompt).toContain('## IMAGE ROLES');
    expect(multiPrompt).toContain('IMAGE 1 = Clothing garment reference view #1');
    expect(multiPrompt).toContain('IMAGE 2 = Clothing garment reference view #2');
    expect(multiPrompt).toContain('IMAGE 3 = Fabric texture reference (material surface and texture swatch only)');
    expect(multiPrompt).toContain('The fabric texture reference (IMAGE 3) controls material surface and texture only.');
  });
});

describe('buildVariationPrompt', () => {
  it('requests a single standalone output and explicitly prohibits collages and grids', () => {
    const prompt = buildVariationPrompt('flat lay');

    expect(prompt).toContain('TASK: PRODUCT LOOKBOOK VARIATION SHOT');
    expect(prompt).toContain('Single output image: render exactly one complete, standalone photograph');
    expect(prompt).toContain('Do NOT generate a collage, grid, diptych, split-screen, contact sheet, or multi-panel composition');
    expect(prompt).toContain('No collages, grids, split images, multi-panel layouts, or contact sheets');
    expect(prompt).toContain('No changing the core \'flat lay\' presentation concept');
    expect(prompt).not.toContain('Generate 3 professional variations');
  });
});

describe('buildCloseUpPrompts & buildCloseUpNegativePrompt', () => {
  it('provides three macro detail contracts with conservative fallback instructions', () => {
    const prompts = buildCloseUpPrompts();
    expect(prompts).toHaveLength(3);

    // Neckline/collar
    expect(prompts[0]).toContain('DETAIL CLOSE-UP — NECKLINE / COLLAR');
    expect(prompts[0]).toContain('Conservative fallback: if specific fasteners or collar details are absent or obscured');
    expect(prompts[0]).toContain('without inventing buttons, trims, collars, or embroidery');

    // Sleeve/cuff
    expect(prompts[1]).toContain('DETAIL CLOSE-UP — SLEEVE / CUFF / ARMHOLE');
    expect(prompts[1]).toContain('Conservative fallback: if cuff hardware, buttons, or decorative trims are not clearly visible');
    expect(prompts[1]).toContain('without inventing cuffs, tabs, buttons, or embellishments');

    // Lower body/waistband/hem
    expect(prompts[2]).toContain('DETAIL CLOSE-UP — LOWER BODY / HEMLINE / WAISTBAND');
    expect(prompts[2]).toContain('Conservative fallback: if waist fastenings, drawstrings, or pockets are not present');
    expect(prompts[2]).toContain('without inventing pockets, buttons, zippers, or ornamental details');
  });

  it('combines base negative prompt with targeted close-up avoid guidance', () => {
    const combined = buildCloseUpNegativePrompt('no blur, no grain');
    expect(combined).toContain('no blur, no grain');
    expect(combined).toContain('invented buttons, invented pockets, invented trims, invented collars');
  });
});

describe('AI Scan blueprint injection', () => {
  const blueprint = 'Material: 92% silk crepe. Bias-cut bodice, French seams, covered placket.';

  it('splices the deconstruction into the main lookbook prompt', () => {
    const prompt = buildLookbookPrompt(
      createFormState(),
      [mockImage('front')],
      null,
      'parts',
      blueprint,
    );

    expect(prompt).toContain('AI SCAN — TEXTILE & GARMENT DECONSTRUCTION (observed in the source images):');
    expect(prompt).toContain(blueprint);
  });
  it('formats blueprint as structured JSON config for GPT Image lane (format === "text")', () => {
    const structuredBlueprint = `[CORE_GARMENTS]
Silk crepe evening gown with bias-cut bodice
[TEXTILE_PHYSICS]
Heavy drape, soft sheen, fluid movement
[DETECTED_ACCESSORIES]
Pearl necklace, gold clutch`;

    const prompt = buildLookbookPrompt(
      createFormState(),
      [mockImage('front')],
      null,
      'text',
      structuredBlueprint,
    );

    expect(prompt).toContain('/* AI_SCAN_BLUEPRINT_CONFIG */');
    expect(prompt).toContain('"coreGarments": "Silk crepe evening gown with bias-cut bodice"');
    expect(prompt).toContain('"textilePhysics": "Heavy drape, soft sheen, fluid movement"');
    expect(prompt).toContain('"Pearl necklace"');
  });

  it('splices the deconstruction into the variation prompt', () => {
    const prompt = buildVariationPrompt('flat lay', blueprint);

    expect(prompt).toContain('AI SCAN — TEXTILE & GARMENT DECONSTRUCTION (observed in the source images):');
    expect(prompt).toContain(blueprint);
  });

  it('splices the deconstruction into every close-up prompt', () => {
    const prompts = buildCloseUpPrompts(blueprint);

    expect(prompts).toHaveLength(3);
    prompts.forEach((prompt) => {
      expect(prompt).toContain('AI SCAN — TEXTILE & GARMENT DECONSTRUCTION (observed in the source images):');
      expect(prompt).toContain(blueprint);
    });
  });

  it('leaves every builder byte-identical when the blueprint is absent or blank', () => {
    const expectedMain = buildLookbookPrompt(createFormState(), [mockImage('front')], null);
    const expectedVariation = buildVariationPrompt('flat lay');
    const expectedCloseUps = buildCloseUpPrompts();

    expect(buildLookbookPrompt(createFormState(), [mockImage('front')], null, 'parts', '')).toBe(expectedMain);
    expect(buildLookbookPrompt(createFormState(), [mockImage('front')], null, 'parts', '   \n ')).toBe(expectedMain);
    expect(buildVariationPrompt('flat lay', '')).toBe(expectedVariation);
    expect(buildVariationPrompt('flat lay', '  ')).toBe(expectedVariation);
    expect(buildCloseUpPrompts('')).toEqual(expectedCloseUps);
    expect(buildCloseUpPrompts('\n\t ')).toEqual(expectedCloseUps);
  });
});

describe('lookbookAiScanSources', () => {
  const slots = (count: number): Array<{ id: string; image: ImageFile | null }> =>
    Array.from({ length: count }, (_, index) => ({ id: String(index), image: mockImage(`garment-${index}`) }));
  const fabric = mockImage('fabric-texture');

  it('reserves a scan slot for the fabric texture when the clothing list fills the limit', () => {
    const clothing = slots(6);

    expect(lookbookAiScanSources(clothing, fabric)).toEqual([
      clothing[0].image,
      clothing[1].image,
      clothing[2].image,
      fabric,
    ]);
  });

  it('keeps the slot order and appends the fabric texture last', () => {
    const clothing = slots(2);

    expect(lookbookAiScanSources(clothing, fabric)).toEqual([
      clothing[0].image,
      clothing[1].image,
      fabric,
    ]);
  });

  it('ignores empty slots and a missing fabric texture', () => {
    const clothing = [{ id: '1', image: mockImage('garment') }, { id: '2', image: null }];

    expect(lookbookAiScanSources(clothing, null)).toEqual([clothing[0].image]);
  });
});
