import { describe, expect, it } from 'vitest';
import {
  AI_SCAN_BLOCK_HEADER,
  formatAiScanBlock,
  parseOutfitBlueprint,
  formatGeminiBlueprintBlock,
  formatGptBlueprintConfig,
} from '../../src/utils/ai-scan-blueprint';

describe('ai-scan-blueprint', () => {
  describe('formatAiScanBlock (legacy backward-compatibility)', () => {
    it('returns an empty string when there is no blueprint', () => {
      expect(formatAiScanBlock(undefined)).toBe('');
      expect(formatAiScanBlock(null)).toBe('');
      expect(formatAiScanBlock('')).toBe('');
      expect(formatAiScanBlock('   \n  ')).toBe('');
    });

    it('splices the blueprint under the AI Scan heading', () => {
      const block = formatAiScanBlock('WEAVE & MATERIAL: plissé accordion pleats, silk satin.');

      expect(block).toContain(AI_SCAN_BLOCK_HEADER);
      expect(block).toContain('WEAVE & MATERIAL: plissé accordion pleats, silk satin.');
    });

    it('trims the blueprint and keeps it on its own block', () => {
      const block = formatAiScanBlock('  DRAPE PHYSICS: fluid fall.  \n');

      expect(block.startsWith('\n\n')).toBe(true);
      expect(block).toContain(`${AI_SCAN_BLOCK_HEADER}:\nDRAPE PHYSICS: fluid fall.\n`);
      expect(block.endsWith('\n')).toBe(true);
    });
  });

  describe('parseOutfitBlueprint', () => {
    it('returns empty structure for empty or null inputs', () => {
      const emptyExpectation = {
        raw: '',
        coreGarments: '',
        textilePhysics: '',
        detectedAccessories: [],
      };
      expect(parseOutfitBlueprint(undefined)).toEqual(emptyExpectation);
      expect(parseOutfitBlueprint(null)).toEqual(emptyExpectation);
      expect(parseOutfitBlueprint('')).toEqual(emptyExpectation);
      expect(parseOutfitBlueprint('   ')).toEqual(emptyExpectation);
    });

    it('correctly parses 3 bounded sections from structured output', () => {
      const raw = `[1. CORE_GARMENTS]
- Top: White silk chiffon blouse with high Victorian collar and bishop sleeves.
- Bottom: High-waisted black wool pleated trousers.

[2. TEXTILE_PHYSICS]
- WEAVE & MATERIAL: 100% mulberry silk chiffon, fine worsted wool.
- OPTICAL PROPERTIES & FINISH: Semi-sheer sleeves, matte trouser finish.
- WEIGHT & DRAPE PHYSICS: Fluid cascading sleeves, crisp tailored trouser crease.

[3. DETECTED_ACCESSORIES]
- Leather belt with gold buckle
- Pearl stud earrings
- Black pointed-toe pumps`;

      const parsed = parseOutfitBlueprint(raw);
      expect(parsed.raw).toBe(raw.trim());
      expect(parsed.coreGarments).toContain('White silk chiffon blouse');
      expect(parsed.coreGarments).toContain('High-waisted black wool pleated trousers');
      expect(parsed.textilePhysics).toContain('mulberry silk chiffon');
      expect(parsed.textilePhysics).toContain('Fluid cascading sleeves');
      expect(parsed.detectedAccessories).toEqual([
        'Leather belt with gold buckle',
        'Pearl stud earrings',
        'Black pointed-toe pumps',
      ]);
    });

    it('handles empty or None accessory section', () => {
      const raw = `[1. CORE_GARMENTS]
One-piece floral linen sundress.

[2. TEXTILE_PHYSICS]
Breathable linen weave with crisp hand.

[3. DETECTED_ACCESSORIES]
None`;

      const parsed = parseOutfitBlueprint(raw);
      expect(parsed.coreGarments).toBe('One-piece floral linen sundress.');
      expect(parsed.textilePhysics).toBe('Breathable linen weave with crisp hand.');
      expect(parsed.detectedAccessories).toEqual([]);
    });

    it('parses comma-separated accessories on a single line', () => {
      const raw = `[1. CORE_GARMENTS]
Tailored blazer and skirt.

[2. TEXTILE_PHYSICS]
Structured houndstooth wool.

[3. DETECTED_ACCESSORIES]
Leather tote bag, sunglasses, silk neck scarf`;

      const parsed = parseOutfitBlueprint(raw);
      expect(parsed.detectedAccessories).toEqual([
        'Leather tote bag',
        'sunglasses',
        'silk neck scarf',
      ]);
    });

    it('falls back gracefully when legacy unstructured text is passed', () => {
      const legacy = '4. TEXTILE & FABRIC ENGINEERING:\n- WEAVE & MATERIAL: plissé accordion pleats, silk satin.\n- DRAPE PHYSICS: fluid fall.';
      const parsed = parseOutfitBlueprint(legacy);

      expect(parsed.raw).toBe(legacy);
      expect(parsed.textilePhysics).toContain('plissé accordion pleats');
      expect(parsed.coreGarments).toBeTruthy();
      expect(parsed.detectedAccessories).toEqual([]);
    });

    it('falls back gracefully for free-form text without any headers', () => {
      const freeForm = 'Vintage washed denim jacket with brass buttons and distressed hem.';
      const parsed = parseOutfitBlueprint(freeForm);

      expect(parsed.raw).toBe(freeForm);
      expect(parsed.coreGarments).toBe(freeForm);
      expect(parsed.textilePhysics).toBe(freeForm);
      expect(parsed.detectedAccessories).toEqual([]);
    });
  });

  describe('formatGeminiBlueprintBlock', () => {
    it('returns empty string when there is no blueprint', () => {
      expect(formatGeminiBlueprintBlock(undefined)).toBe('');
      expect(formatGeminiBlueprintBlock(null)).toBe('');
      expect(formatGeminiBlueprintBlock('')).toBe('');
      expect(formatGeminiBlueprintBlock('   ')).toBe('');
    });

    it('formats a 5-layer natural language brief including AI_SCAN_BLOCK_HEADER', () => {
      const raw = `[1. CORE_GARMENTS]
Top: Silk chiffon blouse with ruffled cuffs.

[2. TEXTILE_PHYSICS]
Translucent sheer chiffon with fluid drape.

[3. DETECTED_ACCESSORIES]
- Gold drop earrings`;

      const block = formatGeminiBlueprintBlock(raw, 'top');

      expect(block).toContain(AI_SCAN_BLOCK_HEADER);
      expect(block).toContain('CRITICAL OUTFIT DECONSTRUCTION (5-LAYER TECHNICAL BRIEF):');
      expect(block).toContain('1. GARMENT IDENTIFICATION & SCOPE:');
      expect(block).toContain('[Target Scope: TOP]');
      expect(block).toContain('Silk chiffon blouse with ruffled cuffs');
      expect(block).toContain('2. SILHOUETTE & CUT ARCHITECTURE:');
      expect(block).toContain('3. TEXTILE WEAVE & FABRICATION:');
      expect(block).toContain('Translucent sheer chiffon with fluid drape');
      expect(block).toContain('4. OPTICAL PROPERTIES & DRAPE PHYSICS:');
      expect(block).toContain('5. MICRO-EDGE DETAILS & ACCESSORIES:');
      expect(block).toContain('Gold drop earrings');
    });

    it('formats 5 layers gracefully when scope is not provided', () => {
      const raw = `[1. CORE_GARMENTS]
Wrap dress with tie waist.

[2. TEXTILE_PHYSICS]
Rayon jersey with stretch.

[3. DETECTED_ACCESSORIES]
None`;

      const block = formatGeminiBlueprintBlock(raw);

      expect(block).toContain(AI_SCAN_BLOCK_HEADER);
      expect(block).not.toContain('[Target Scope:');
      expect(block).toContain('Wrap dress with tie waist');
      expect(block).toContain('Accessories: None');
    });
  });

  describe('formatGptBlueprintConfig', () => {
    it('returns an empty object when there is no blueprint', () => {
      expect(formatGptBlueprintConfig(undefined)).toEqual({});
      expect(formatGptBlueprintConfig(null)).toEqual({});
      expect(formatGptBlueprintConfig('')).toEqual({});
      expect(formatGptBlueprintConfig('   ')).toEqual({});
    });

    it('returns a structured config object with parsed sections and scope', () => {
      const raw = `[1. CORE_GARMENTS]
Tailored wool trench coat with double-breasted closure.

[2. TEXTILE_PHYSICS]
Heavyweight gabardine with structured drape.

[3. DETECTED_ACCESSORIES]
- Leather belt
- Tortoiseshell buttons`;

      const config = formatGptBlueprintConfig(raw, 'outerwear');

      expect(config).toEqual({
        coreGarments: 'Tailored wool trench coat with double-breasted closure.',
        textilePhysics: 'Heavyweight gabardine with structured drape.',
        detectedAccessories: ['Leather belt', 'Tortoiseshell buttons'],
        garmentScope: 'outerwear',
      });
    });

    it('returns structured config without garmentScope when scope is omitted', () => {
      const raw = `[1. CORE_GARMENTS]
Cashmere sweater.

[2. TEXTILE_PHYSICS]
Soft knit.

[3. DETECTED_ACCESSORIES]
None`;

      const config = formatGptBlueprintConfig(raw);

      expect(config).toEqual({
        coreGarments: 'Cashmere sweater.',
        textilePhysics: 'Soft knit.',
        detectedAccessories: [],
      });
      expect(config).not.toHaveProperty('garmentScope');
    });
  });
});
