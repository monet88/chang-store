import { describe, it, expect } from 'vitest';
import {
  buildClothingTransferParts,
  buildProductStagingParts,
  buildBrandModelParts,
  formatGarmentScope,
  ClothingTransferReferenceInput,
} from '@/utils/clothing-transfer-prompt-builder';
import type { DisplayTemplate } from '@/config/displayTemplates';
import type { BrandModelProfile } from '@/config/brandModelRoster';
import type { ImageFile } from '@/types';
import type { Part } from '@google/genai';

const mockImage = (id: string): ImageFile => ({
  base64: `mock-base64-${id}`,
  mimeType: 'image/png',
});

const defaultConcept = mockImage('concept-scene');
const defaultReference: ClothingTransferReferenceInput = {
  image: mockImage('source-outfit-1'),
  label: '',
};

const getTaskText = (parts: Part[]): string => {
  const textParts = parts.filter((p) => p.text);
  return textParts[textParts.length - 1]?.text ?? '';
};

describe('buildClothingTransferParts', () => {
  describe('interleaved structure', () => {
    it('structures parts with destination first, then source outfits, then task prompt', () => {
      const references = [
        { image: mockImage('top'), label: 'blouse' },
        { image: mockImage('bottom'), label: 'skirt' },
      ];
      const parts = buildClothingTransferParts(defaultConcept, references, '');

      // 1 destination (label + img) + 2 references (2 * (label + img)) + 1 task text = 7 parts
      expect(parts).toHaveLength(7);
      expect(parts[0].text).toContain('DESTINATION SCENE');
      expect(parts[1].inlineData?.data).toBe('mock-base64-concept-scene');
      expect(parts[2].text).toContain('SOURCE OUTFIT 1');
      expect(parts[2].text).toContain('blouse');
      expect(parts[3].inlineData?.data).toBe('mock-base64-top');
      expect(parts[4].text).toContain('SOURCE OUTFIT 2');
      expect(parts[4].text).toContain('skirt');
      expect(parts[5].inlineData?.data).toBe('mock-base64-bottom');
      expect(parts[6].text).toContain('TASK: Replace the clothing in the DESTINATION SCENE');
    });

    it('falls back to generic extraction label when reference has no label', () => {
      const parts = buildClothingTransferParts(defaultConcept, [defaultReference], '');
      expect(parts[2].text).toContain('SOURCE OUTFIT 1 (extract this clothing — auto-detect clothing type)');
    });
  });

  describe('ownership contract & task prompt', () => {
    it('establishes destination ownership of scene, background, camera, and display geometry', () => {
      const parts = buildClothingTransferParts(defaultConcept, [defaultReference], '');
      const taskText = getTaskText(parts);

      expect(taskText).toContain('DESTINATION SCENE OWNS THE ENVIRONMENT AND COMPOSITION');
      expect(taskText).toContain('defines the entire environment: background, surfaces, walls, camera angle, perspective, framing');
      expect(taskText).toContain('defines the display method and spatial arrangement of clothing');
      expect(taskText).toContain('All non-clothing elements from the DESTINATION');
    });

    it('preserves destination person identity, face, expression, and pose when destination contains a person', () => {
      const parts = buildClothingTransferParts(defaultConcept, [defaultReference], '');
      const taskText = getTaskText(parts);

      expect(taskText).toContain('If the DESTINATION contains a person: preserve that person\'s identity, face, hair, skin tone, body proportions, facial expression, and overall pose');
      expect(taskText).toContain('The destination person wears the transferred clothing');
    });

    it('establishes source ownership of garments only and prohibits source person or prop leakage', () => {
      const parts = buildClothingTransferParts(defaultConcept, [defaultReference], '');
      const taskText = getTaskText(parts);

      expect(taskText).toContain('SOURCE OUTFIT REFERENCES OWN GARMENT DESIGN ONLY');
      expect(taskText).toContain('Extract ONLY fashion garments from each SOURCE OUTFIT image');
      expect(taskText).toContain('Do NOT transfer any source person\'s identity, face, body, or pose');
      expect(taskText).toContain('Do NOT transfer any source background, furniture, hangers, shoes, bags, jewelry, or non-garment props');
    });

    it('distinguishes labeled and unlabeled source extraction semantics', () => {
      const parts = buildClothingTransferParts(defaultConcept, [defaultReference], '');
      const taskText = getTaskText(parts);

      expect(taskText).toContain('Labeled sources: extract only the specified garment or category indicated by the label');
      expect(taskText).toContain('Unlabeled sources: extract only clearly visible clothing garments');
    });

    it('preserves source garment construction, silhouette, colors, patterns, and supported branding', () => {
      const parts = buildClothingTransferParts(defaultConcept, [defaultReference], '');
      const taskText = getTaskText(parts);

      expect(taskText).toContain('Faithfully reproduce the source garment\'s silhouette, construction');
      expect(taskText).toContain('pattern scale, pattern orientation, graphics, and visible supported branding');
    });

    it('maps garments to destination layout and enforces zero blending of old clothing', () => {
      const parts = buildClothingTransferParts(defaultConcept, [defaultReference], '');
      const taskText = getTaskText(parts);

      expect(taskText).toContain('Map each source garment to its corresponding location in the DESTINATION arrangement');
      expect(taskText).toContain('Zero blending: completely replace the destination clothing without retaining old colors, silhouettes, or pattern remnants');
      expect(taskText).toContain('Replaced clothing areas must have zero visual influence from the old garment');
    });

    it('adapts garment drape to destination display method (hanging, flat lay, or worn)', () => {
      const parts = buildClothingTransferParts(defaultConcept, [defaultReference], '');
      const taskText = getTaskText(parts);

      expect(taskText).toContain('natural gravity drape for hanging clothes');
      expect(taskText).toContain('natural spread and realistic folds for flat lays');
      expect(taskText).toContain('natural anatomical fit and body folds when worn by a person');
    });

    it('integrates destination lighting, shadows, and contact perspective', () => {
      const parts = buildClothingTransferParts(defaultConcept, [defaultReference], '');
      const taskText = getTaskText(parts);

      expect(taskText).toContain('match the DESTINATION scene\'s light direction, intensity, color temperature, contact shadows, and occlusion');
    });

    it('appends user instructions when provided', () => {
      const parts = buildClothingTransferParts(defaultConcept, [defaultReference], 'keep vintage belt');
      const taskText = getTaskText(parts);

      expect(taskText).toContain('USER INSTRUCTIONS:\nkeep vintage belt');
    });

    it('omits user instructions section when empty or whitespace', () => {
      const parts = buildClothingTransferParts(defaultConcept, [defaultReference], '   ');
      const taskText = getTaskText(parts);

      expect(taskText).not.toContain('USER INSTRUCTIONS');
    });

    it('contains short, targeted, non-contradictory avoid constraints', () => {
      const parts = buildClothingTransferParts(defaultConcept, [defaultReference], '');
      const taskText = getTaskText(parts);

      expect(taskText).toContain('AVOID:');
      expect(taskText).toContain('No leaking source background, furniture, hangers, accessories, or props into the scene');
      expect(taskText).toContain('No transferring source model identity, face, hair, skin, or pose');
      expect(taskText).toContain('No blending or residual visual attributes from the replaced destination clothing');
      expect(taskText).toContain('No altering the destination scene\'s background, camera perspective, lighting geometry, or destination person identity');
    });
  });

  describe('flat prompt format', () => {
    it('maps every image by position and keeps the same task instructions', () => {
      const references = [
        { image: mockImage('top'), label: 'blouse' },
        { image: mockImage('bottom'), label: '' },
      ];
      const parts = buildClothingTransferParts(defaultConcept, references, '', 'text');

      // 1 role map + 3 images: the flat lane has no interleaving to carry roles.
      expect(parts).toHaveLength(4);
      expect(parts[0].text).toContain('IMAGE 1 = DESTINATION SCENE (owns background, scene composition, lighting, display method, and any subject person)');
      expect(parts[0].text).toContain('IMAGE 2 = SOURCE OUTFIT 1 (extract this clothing — blouse)');
      expect(parts[0].text).toContain('IMAGE 3 = SOURCE OUTFIT 2 (extract this clothing — auto-detect clothing type)');
      expect(parts[0].text).toContain('TASK: Replace the clothing in the DESTINATION SCENE');
      expect(parts[0].text).toContain('SOURCE OUTFIT REFERENCES OWN GARMENT DESIGN ONLY');
      expect(parts[0].text).toContain('AVOID:');
      expect(parts[1].inlineData?.data).toBe('mock-base64-concept-scene');
      expect(parts[2].inlineData?.data).toBe('mock-base64-top');
      expect(parts[3].inlineData?.data).toBe('mock-base64-bottom');
    });

    it('drops the avoid bullets that only restate ROLE 1/2 and PLACEMENT', () => {
      const interleaved = getTaskText(buildClothingTransferParts(defaultConcept, [defaultReference], ''));
      const flat = getTaskText(buildClothingTransferParts(defaultConcept, [defaultReference], '', 'text'));

      // The interleaved lane keeps the full list next to its image labels.
      expect(interleaved).toContain('No leaking source background');
      // Gone on the flat lane: four restatements of the ownership sections.
      ['No leaking source background', 'No transferring source model identity',
        'No blending or residual visual attributes', "No altering the destination scene's background"]
        .forEach((bullet) => expect(flat).not.toContain(bullet));
      // Kept: the artifact list (no earlier statement) and the positive rules.
      expect(flat).toContain('No compositing artifacts, edge halos, mismatched shadows, or perspective discrepancies.');
      expect(flat).toContain('Do NOT transfer any source background, furniture, hangers, shoes, bags, jewelry');
      expect(flat).toContain("Do NOT transfer any source person's identity, face, body, or pose.");
      expect(flat).toContain('Zero blending: completely replace the destination clothing');
      expect(flat).toContain('The DESTINATION image defines the entire environment');
    });

    it('carries user instructions into the flat format too', () => {
      const parts = buildClothingTransferParts(defaultConcept, [defaultReference], 'keep vintage belt', 'text');

      expect(parts[0].text).toContain('USER INSTRUCTIONS:\nkeep vintage belt');
    });
  });
});

describe('buildProductStagingParts', () => {
  const template: DisplayTemplate = {
    id: 'hanger-wood',
    name: 'Móc Gỗ',
    category: 'hanger',
    modality: 'text',
    prompt: 'Hang on a natural wood hanger against an off-white wall.',
  };

  it('structures parts with source outfit image and staging task prompt', () => {
    const sourceImage = mockImage('source-outfit');
    const parts = buildProductStagingParts(sourceImage, template, 'top');

    expect(parts).toHaveLength(3);
    expect(parts[0].text).toContain('SOURCE OUTFIT');
    expect(parts[0].text).toContain('top garment');
    expect(parts[1].inlineData?.data).toBe('mock-base64-source-outfit');
    expect(parts[2].text).toContain('TASK: Extract the top garment');
    expect(parts[2].text).toContain('Hang on a natural wood hanger');
    expect(parts[2].text).toContain('ZERO human beings or mannequins');
  });

  it('formats industrial JSON-config format for OpenAI image lane (format === "text")', () => {
    const sourceImage = mockImage('source-outfit');
    const blueprint = `[CORE_GARMENTS]
Tailored linen blazer and pleated trousers
[TEXTILE_PHYSICS]
Crisp linen weave with sharp structural folds
[DETECTED_ACCESSORIES]
Leather tote bag, tortoiseshell sunglasses`;

    const parts = buildProductStagingParts(sourceImage, template, 'dress', '', 'text', blueprint);

    expect(parts).toHaveLength(2);
    expect(parts[0].text).toContain('IMAGE 1 = SOURCE OUTFIT');
    expect(parts[0].text).toContain('one-piece dress');
    expect(parts[0].text).toContain('/* PRODUCT_STAGING_CONFIG */');

    // Parse the JSON payload following the comment
    const jsonMatch = parts[0].text.match(/\/\* PRODUCT_STAGING_CONFIG \*\/\n([\s\S]+)$/);
    expect(jsonMatch).not.toBeNull();
    const config = JSON.parse(jsonMatch![1]);

    expect(config.CANVAS_CONTRACT).toBeDefined();
    expect(config.CANVAS_CONTRACT.aspect_ratio).toBe('3:4');
    expect(config.CANVAS_CONTRACT.framing).toContain('catalog framing');

    expect(config.ENVIRONMENT).toBeDefined();
    expect(config.ENVIRONMENT.target_scene).toBe(template.prompt);

    expect(config.STAGING_ZONES).toBeDefined();
    expect(config.STAGING_ZONES.upper_hanger).toContain('upper garments');
    expect(config.STAGING_ZONES.lower_surface).toContain('lower garments');

    expect(config.GARMENT_BLUEPRINT).toBeDefined();
    expect(config.GARMENT_BLUEPRINT.apparel_specifications).toContain('Tailored linen blazer');
    expect(config.GARMENT_BLUEPRINT.textile_physics).toContain('Crisp linen weave');

    expect(config.STRICT_INVARIANTS_AND_EXCLUSIONS).toBeInstanceOf(Array);
    expect(config.STRICT_INVARIANTS_AND_EXCLUSIONS).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ZERO human beings or mannequins'),
        expect.stringContaining('zero phantom props'),
        expect.stringContaining('clean typography and collar/hemline geometry'),
        expect.stringContaining('exclude detected accessory: Leather tote bag'),
        expect.stringContaining('exclude detected accessory: tortoiseshell sunglasses'),
      ]),
    );

    expect(parts[1].inlineData?.data).toBe('mock-base64-source-outfit');
  });

  it('outputs 5-layer natural language specification for Gemini lane (format === "parts")', () => {
    const sourceImage = mockImage('source-outfit');
    const blueprint = `[CORE_GARMENTS]
Silk evening gown with bias cut
[TEXTILE_PHYSICS]
Heavy fluid drape, soft luster
[DETECTED_ACCESSORIES]
Gold chain belt`;

    const parts = buildProductStagingParts(sourceImage, template, 'dress', '', 'parts', blueprint);

    expect(parts).toHaveLength(3);
    const taskText = parts[2].text;

    expect(taskText).toContain('LAYER 1: TASK & CANVAS');
    expect(taskText).toContain('CANVAS CONTRACT: 3:4 portrait aspect ratio');

    expect(taskText).toContain('LAYER 2: DYNAMIC SPATIAL ARRANGEMENT');
    expect(taskText).toContain('MULTI-PIECE OUTFIT DECOMPOSITION & SPATIAL SEPARATION:');

    expect(taskText).toContain('LAYER 3: GARMENT BLUEPRINT');
    expect(taskText).toContain('Core Garments & Cut Architecture: Silk evening gown with bias cut');

    expect(taskText).toContain('LAYER 4: TEXTILE PHYSICS');
    expect(taskText).toContain('Textile Weave & Drape Physics: Heavy fluid drape, soft luster');

    expect(taskText).toContain('LAYER 5: INVARIANTS & EXCLUSIONS');
    expect(taskText).toContain('Exclude detected accessories: Gold chain belt.');
    expect(taskText).toContain('ZERO human beings or mannequins');
  });

  it('includes staging reference image when template.image is provided', () => {
    const sourceImage = mockImage('source-outfit');
    const stagingImage = mockImage('custom-hanger-photo');
    const customTemplate: DisplayTemplate = {
      ...template,
      id: 'custom-hanger',
      modality: 'image',
      image: stagingImage,
    };

    const parts = buildProductStagingParts(sourceImage, customTemplate, 'top');
    expect(parts).toHaveLength(5);
    expect(parts[0].text).toContain('SOURCE OUTFIT');
    expect(parts[1].inlineData?.data).toBe('mock-base64-source-outfit');
    expect(parts[2].text).toContain('STAGING REFERENCE');
    expect(parts[3].inlineData?.data).toBe('mock-base64-custom-hanger-photo');
    expect(parts[4].text).toContain('STAGING REFERENCE');
  });
});

describe('buildBrandModelParts', () => {
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

  it('structures parts preserving destination pose, outfit and scene while transferring brand model identity', () => {
    const sourceImage = mockImage('source-outfit');
    const parts = buildBrandModelParts(sourceImage, model, 'full-set');

    // destination (label + img) + face (label + img) + body (label + img) + task prompt = 7 parts
    expect(parts).toHaveLength(7);
    expect(parts[0].text).toContain('DESTINATION PHOTO');
    expect(parts[1].inlineData?.data).toBe('mock-base64-source-outfit');
    expect(parts[2].text).toContain('BRAND MODEL FACE (Linh');
    expect(parts[3].inlineData?.data).toBe('mock-base64-linh-face');
    expect(parts[4].text).toContain('BRAND MODEL BODY (Linh');
    expect(parts[5].inlineData?.data).toBe('mock-base64-linh-body');
    expect(parts[6].text).toContain('TASK: Replace the model\'s head and face');
    expect(parts[6].text).toContain('BRAND MODEL (Linh)');
  });

  it('formats structured prompt locking garment and environment for brand model text lane (format === "text")', () => {
    const sourceImage = mockImage('source-outfit');
    const blueprint = `[CORE_GARMENTS]
Velvet cocktail dress
[TEXTILE_PHYSICS]
Deep pile velvet with rich light absorption
[DETECTED_ACCESSORIES]
Diamond drop earrings`;

    const parts = buildBrandModelParts(sourceImage, model, 'full-set', '', 'text', blueprint);

    // text lane: prompt + 3 images (dest, face, body)
    expect(parts).toHaveLength(4);
    expect(parts[0].text).toContain('IMAGE 1 = DESTINATION PHOTO');
    expect(parts[0].text).toContain('IMAGE 2 = BRAND MODEL FACE (Linh');
    expect(parts[0].text).toContain('/* BRAND_MODEL_IDENTITY_CONFIG */');

    const jsonMatch = parts[0].text.match(/\/\* BRAND_MODEL_IDENTITY_CONFIG \*\/\n([\s\S]+)$/);
    expect(jsonMatch).not.toBeNull();
    const config = JSON.parse(jsonMatch![1]);

    expect(config.IDENTITY_TRANSFER).toBeDefined();
    expect(config.IDENTITY_TRANSFER.target_model).toBe('Linh');
    expect(config.IDENTITY_TRANSFER.facial_identity_authority).toBe('IMAGE 2');

    expect(config.LOCKED_ELEMENTS).toBeDefined();
    expect(config.LOCKED_ELEMENTS.garment_lock).toContain('100% FROZEN');
    expect(config.LOCKED_ELEMENTS.environment_lock).toContain('100% FROZEN');
    expect(config.LOCKED_ELEMENTS.pose_lock).toContain('100% FROZEN');

    expect(config.STRICT_INVARIANTS_AND_EXCLUSIONS).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Do NOT retain original facial features'),
        expect.stringContaining('100% garment lock'),
        expect.stringContaining('100% environment lock'),
        expect.stringContaining('exclude detected accessory: Diamond drop earrings'),
      ]),
    );
  });
});

/**
 * The AI Scan blueprint is the shared analytical layer (issue #162): all three
 * E-Com Pack lanes splice the same block, and an absent blueprint must leave the
 * lane prompt exactly as it was.
 */
describe('AI Scan blueprint injection', () => {
  const blueprint = 'WEAVE & MATERIAL: plissé accordion pleats. DRAPE PHYSICS: fluid fall.';
  const template: DisplayTemplate = {
    id: 'hanger-wood',
    name: 'Móc Gỗ',
    category: 'hanger',
    modality: 'text',
    prompt: 'Hang on a natural wood hanger against an off-white wall.',
  };

  it('splices the blueprint into every E-Com Pack lane', () => {
    const sourceImage = mockImage('source-outfit');
    const model: BrandModelProfile = {
      id: 'linh',
      name: 'Linh',
      faceImage: mockImage('linh-face'),
      bodyImage: null,
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

    const transfer = getTaskText(buildClothingTransferParts(defaultConcept, [defaultReference], '', 'parts', blueprint));
    const staging = getTaskText(buildProductStagingParts(sourceImage, template, 'top', '', 'parts', blueprint));
    const brandModel = getTaskText(buildBrandModelParts(sourceImage, model, 'full-set', '', 'parts', blueprint));

    for (const taskText of [transfer, staging, brandModel]) {
      expect(taskText).toContain('AI SCAN — TEXTILE & GARMENT DECONSTRUCTION');
      expect(taskText).toContain(blueprint);
    }
  });

  it('leaves the lane prompt untouched when no blueprint was scanned', () => {
    const sourceImage = mockImage('source-outfit');

    expect(getTaskText(buildClothingTransferParts(defaultConcept, [defaultReference], '')))
      .toBe(getTaskText(buildClothingTransferParts(defaultConcept, [defaultReference], '', 'parts', '   ')));
    expect(getTaskText(buildProductStagingParts(sourceImage, template, 'top')))
      .toBe(getTaskText(buildProductStagingParts(sourceImage, template, 'top', '', 'parts', undefined)));
  });
});
